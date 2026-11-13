use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::panic;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};
use base64::{engine::general_purpose::STANDARD, Engine as _};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Serialize)]
struct AppInfo {
    name: &'static str,
    version: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MusicTrack {
    file_name: String,
    path: String,
    size: u64,
    modified: u64,
}

#[tauri::command]
fn app_info() -> AppInfo {
    AppInfo {
        name: "墨阅",
        version: env!("CARGO_PKG_VERSION"),
    }
}

#[tauri::command]
fn music_dir(app: tauri::AppHandle) -> Result<String, String> {
    let folder = music_folder(&app)?;
    Ok(folder.to_string_lossy().into_owned())
}

#[tauri::command]
fn list_music(app: tauri::AppHandle) -> Result<Vec<MusicTrack>, String> {
    let folder = music_folder(&app)?;
    let mut tracks = Vec::new();
    collect_music(&folder, &mut tracks, 0);
    tracks.sort_by(|a, b| a.file_name.to_lowercase().cmp(&b.file_name.to_lowercase()));
    Ok(tracks)
}

#[tauri::command]
fn open_music_folder(app: tauri::AppHandle) -> Result<(), String> {
    let folder = music_folder(&app)?;
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&folder)
            .spawn()
            .map_err(|error| format!("无法打开音乐文件夹：{error}"))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        return Err("当前平台暂不支持自动打开文件夹".to_string());
    }
    Ok(())
}

#[tauri::command]
fn data_dir(app: tauri::AppHandle) -> Result<String, String> {
    let folder = app_data_folder(&app)?;
    Ok(folder.to_string_lossy().into_owned())
}

#[tauri::command]
fn open_data_folder(app: tauri::AppHandle) -> Result<(), String> {
    let folder = app_data_folder(&app)?;
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&folder)
            .spawn()
            .map_err(|error| format!("无法打开数据文件夹：{error}"))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        return Err("当前平台暂不支持自动打开文件夹".to_string());
    }
    Ok(())
}

#[tauri::command]
fn backup_dir(app: tauri::AppHandle) -> Result<String, String> {
    let folder = backup_folder(&app)?;
    Ok(folder.to_string_lossy().into_owned())
}

#[tauri::command]
fn open_backup_folder(app: tauri::AppHandle) -> Result<(), String> {
    let folder = backup_folder(&app)?;
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&folder)
            .spawn()
            .map_err(|error| format!("无法打开备份文件夹：{error}"))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        return Err("当前平台暂不支持自动打开文件夹".to_string());
    }
    Ok(())
}

const SPONSOR_ISSUE_URL: &str = "https://github.com/Langlijun666/moyue-reader/issues/new?template=sponsorship.yml&title=%5B%E8%B5%9E%E5%8A%A9%E7%99%BB%E8%AE%B0%5D%20";
const BUG_ISSUE_URL: &str = "https://github.com/Langlijun666/moyue-reader/issues/new?template=bug_report.yml&title=%5B%E9%97%AE%E9%A2%98%5D%20";
const FEATURE_ISSUE_URL: &str = "https://github.com/Langlijun666/moyue-reader/issues/new?template=feature_request.yml&title=%5B%E5%BB%BA%E8%AE%AE%5D%20";

const SHERPA_ENGINE_URL: &str = "https://github.com/k2-fsa/sherpa-onnx/releases/download/v2.0.1/sherpa-onnx-v2.0.1-win-x64-shared-MD-Release.tar.bz2";
const SHERPA_ENGINE_SHA256: &str = "ce987d5bfca42c74b54f7b3bbaaa8c1febe3c5cd0fea8f94be80ea30e72f1f61";
const SHERPA_MODEL_URL: &str = "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-melo-tts-zh_en.tar.bz2";
const SHERPA_MODEL_SHA256: &str = "e58351ed7149f290a54534538badd4077cdbe6fddc964b24d0bee870415d1514";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NeuralStatus {
    installed: bool,
    directory: String,
    bytes: u64,
    message: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NeuralProgress {
    stage: String,
    downloaded: u64,
    total: u64,
    percent: f64,
    message: String,
}

#[tauri::command]
fn neural_status(app: tauri::AppHandle) -> Result<NeuralStatus, String> {
    let folder = neural_folder(&app)?;
    let engine = neural_engine_path(&folder);
    let model = neural_model_path(&folder);
    let installed = engine.exists() && model.exists();
    let bytes = folder_size(&folder);
    Ok(NeuralStatus {
        installed,
        directory: folder.to_string_lossy().into_owned(),
        bytes,
        message: if installed {
            "离线自然语音已就绪".to_string()
        } else {
            "尚未下载离线自然语音".to_string()
        },
    })
}

#[tauri::command]
async fn download_neural(app: tauri::AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || download_neural_blocking(app))
        .await
        .map_err(|error| format!("下载任务失败：{error}"))?
}

#[tauri::command]
fn remove_neural(app: tauri::AppHandle) -> Result<(), String> {
    let folder = neural_folder(&app)?;
    fs::remove_dir_all(&folder).map_err(|error| format!("无法删除离线语音：{error}"))?;
    Ok(())
}

#[tauri::command]
fn sherpa_speak(app: tauri::AppHandle, text: String, speed: f64) -> Result<String, String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("没有可朗读的文字".to_string());
    }
    if trimmed.chars().count() > 500 {
        return Err("朗读文本过长".to_string());
    }

    let folder = neural_folder(&app)?;
    let engine = neural_engine_path(&folder);
    let model = neural_model_path(&folder);
    if !engine.exists() || !model.exists() {
        return Err("离线自然语音尚未下载".to_string());
    }

    let cache = folder.join("cache");
    fs::create_dir_all(&cache).map_err(|error| format!("无法创建语音缓存：{error}"))?;
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    let output = cache.join(format!("tts-{stamp}.wav"));
    let bin_dir = engine.parent().ok_or_else(|| "无法定位语音引擎".to_string())?;
    let model_dir = model
        .parent()
        .ok_or_else(|| "无法定位离线语音模型".to_string())?;

    let result = Command::new(&engine)
        .current_dir(bin_dir)
        .arg(format!("--vits-model={}", model.to_string_lossy()))
        .arg(format!(
            "--vits-lexicon={}",
            model_dir.join("lexicon.txt").to_string_lossy()
        ))
        .arg(format!(
            "--vits-tokens={}",
            model_dir.join("tokens.txt").to_string_lossy()
        ))
        .arg("--num-threads=4")
        .arg(format!("--speed={}", speed.clamp(0.5, 2.0)))
        .arg(format!("--output-filename={}", output.to_string_lossy()))
        .arg(trimmed)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|error| format!("无法启动离线语音：{error}"))?;

    if !result.status.success() || !output.exists() {
        let detail = String::from_utf8_lossy(&result.stderr);
        eprintln!("sherpa tts failed: {}", detail.trim());
        return Err("离线语音合成失败，请重试".to_string());
    }
    prune_cache(&cache, 40);
    Ok(output.to_string_lossy().into_owned())
}

fn download_neural_blocking(app: tauri::AppHandle) -> Result<(), String> {
    let folder = neural_folder(&app)?;
    let downloads = folder.join("_downloads");
    fs::create_dir_all(&downloads).map_err(|error| error.to_string())?;

    let engine_archive = downloads.join("sherpa-onnx.tar.bz2");
    let model_archive = downloads.join("vits-melo-tts-zh_en.tar.bz2");

    download_file(
        &app,
        SHERPA_ENGINE_URL,
        &engine_archive,
        SHERPA_ENGINE_SHA256,
        "engine",
        "下载离线语音引擎",
    )?;
    download_file(
        &app,
        SHERPA_MODEL_URL,
        &model_archive,
        SHERPA_MODEL_SHA256,
        "model",
        "下载中文自然语音模型",
    )?;

    emit_neural_progress(&app, "extract", 0, 0, 0.0, "正在解压语音引擎…");
    let engine_dir = folder.join("engine");
    if engine_dir.exists() {
        fs::remove_dir_all(&engine_dir).map_err(|error| error.to_string())?;
    }
    fs::create_dir_all(&engine_dir).map_err(|error| error.to_string())?;
    extract_tar(&engine_archive, &engine_dir)?;

    emit_neural_progress(&app, "extract", 0, 0, 0.0, "正在解压中文语音模型…");
    let model_dir = folder.join("model");
    if model_dir.exists() {
        fs::remove_dir_all(&model_dir).map_err(|error| error.to_string())?;
    }
    fs::create_dir_all(&model_dir).map_err(|error| error.to_string())?;
    extract_tar(&model_archive, &model_dir)?;

    let _ = fs::remove_file(engine_archive);
    let _ = fs::remove_file(model_archive);
    emit_neural_progress(&app, "done", 1, 1, 1.0, "离线自然语音已就绪");
    Ok(())
}

fn download_file(
    app: &tauri::AppHandle,
    url: &str,
    destination: &Path,
    expected_hash: &str,
    stage: &str,
    label: &str,
) -> Result<(), String> {
    if destination.exists() {
        if file_hash(destination)? == expected_hash {
            return Ok(());
        }
        let _ = fs::remove_file(destination);
    }

    let client = reqwest::blocking::Client::builder()
        .user_agent("Moyue/0.11 neural-tts")
        .timeout(std::time::Duration::from_secs(1800))
        .build()
        .map_err(|error| format!("无法创建下载连接：{error}"))?;
    let mut response = client
        .get(url)
        .send()
        .map_err(|error| format!("下载失败：{error}"))?;
    if !response.status().is_success() {
        return Err(format!("下载失败：HTTP {}", response.status()));
    }
    let total = response.content_length().unwrap_or(0);
    let mut file = fs::File::create(destination).map_err(|error| error.to_string())?;
    let mut hasher = Sha256::new();
    let mut downloaded = 0u64;
    let mut buffer = [0u8; 256 * 1024];
    let started = std::time::Instant::now();
    let mut last_emit = started;

    loop {
        let read = response
            .read(&mut buffer)
            .map_err(|error| format!("下载中断：{error}"))?;
        if read == 0 {
            break;
        }
        file.write_all(&buffer[..read])
            .map_err(|error| format!("写入失败：{error}"))?;
        hasher.update(&buffer[..read]);
        downloaded += read as u64;
        if last_emit.elapsed().as_millis() >= 180 || downloaded == total {
            last_emit = std::time::Instant::now();
            let percent = if total > 0 {
                downloaded as f64 / total as f64 * 100.0
            } else {
                0.0
            };
            emit_neural_progress(app, stage, downloaded, total, percent, label);
        }
    }
    file.flush().map_err(|error| error.to_string())?;

    let actual = format!("{:x}", hasher.finalize());
    if actual != expected_hash {
        let _ = fs::remove_file(destination);
        return Err("下载文件校验失败，已取消".to_string());
    }
    Ok(())
}

fn extract_tar(archive: &Path, destination: &Path) -> Result<(), String> {
    let status = Command::new("tar")
        .arg("-xjf")
        .arg(archive)
        .arg("-C")
        .arg(destination)
        .arg("--strip-components=1")
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map_err(|error| format!("无法解压语音文件：{error}"))?;
    if !status.success() {
        return Err("解压语音文件失败".to_string());
    }
    Ok(())
}

fn file_hash(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|error| error.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 256 * 1024];
    loop {
        let read = file.read(&mut buffer).map_err(|error| error.to_string())?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn emit_neural_progress(
    app: &tauri::AppHandle,
    stage: &str,
    downloaded: u64,
    total: u64,
    percent: f64,
    message: &str,
) {
    let _ = app.emit(
        "neural-progress",
        NeuralProgress {
            stage: stage.to_string(),
            downloaded,
            total,
            percent,
            message: message.to_string(),
        },
    );
}

fn neural_folder(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let folder = app_data_folder(app)?.join("neural");
    fs::create_dir_all(&folder).map_err(|error| format!("无法创建离线语音目录：{error}"))?;
    Ok(folder)
}

fn neural_engine_path(folder: &Path) -> PathBuf {
    folder
        .join("engine")
        .join("bin")
        .join("sherpa-onnx-offline-tts.exe")
}

fn neural_model_path(folder: &Path) -> PathBuf {
    folder.join("model").join("model.onnx")
}

fn folder_size(folder: &Path) -> u64 {
    let Ok(entries) = fs::read_dir(folder) else {
        return 0;
    };
    entries
        .flatten()
        .map(|entry| {
            let path = entry.path();
            if path.is_dir() {
                folder_size(&path)
            } else {
                entry.metadata().map(|meta| meta.len()).unwrap_or(0)
            }
        })
        .sum()
}

fn prune_cache(folder: &Path, keep: usize) {
    let Ok(entries) = fs::read_dir(folder) else {
        return;
    };
    let mut files: Vec<PathBuf> = entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.is_file() && path.extension().and_then(|ext| ext.to_str()) == Some("wav"))
        .collect();
    files.sort();
    if files.len() > keep {
        for path in &files[..files.len() - keep] {
            let _ = fs::remove_file(path);
        }
    }
}

#[tauri::command]
fn open_sponsor_issue() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // `explorer` does not reliably open http(s) URLs on every Windows
        // setup. FileProtocolHandler hands the URL to the default browser.
        Command::new("rundll32.exe")
            .arg("url.dll,FileProtocolHandler")
            .arg(SPONSOR_ISSUE_URL)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|error| format!("无法打开赞助登记页面：{error}"))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        return Err("当前平台暂不支持自动打开浏览器".to_string());
    }
    Ok(())
}

#[tauri::command]
fn open_feedback(kind: String) -> Result<(), String> {
    let url = if kind == "feature" {
        FEATURE_ISSUE_URL
    } else {
        BUG_ISSUE_URL
    };
    open_external_url(url)
}

#[tauri::command]
fn append_diagnostic(
    app: tauri::AppHandle,
    level: String,
    message: String,
    detail: String,
) -> Result<(), String> {
    let folder = diagnostic_folder(&app)?;
    let level = level.chars().take(12).collect::<String>();
    let message = message.chars().take(2000).collect::<String>();
    let detail = detail.chars().take(12000).collect::<String>();
    let line = format!(
        "[{}] [{}] {}{}\n",
        now_millis(),
        level,
        message.replace('\n', " "),
        if detail.is_empty() {
            String::new()
        } else {
            format!("\n{}", detail)
        }
    );
    append_log(&folder.join("moyue.log"), &line)
}

#[tauri::command]
fn write_diagnostic_report(app: tauri::AppHandle, content: String) -> Result<String, String> {
    if content.len() > 200_000 {
        return Err("诊断内容过大".to_string());
    }
    let folder = diagnostic_folder(&app)?;
    let path = folder.join(format!("diagnostics-{}.txt", now_millis()));
    fs::write(&path, content).map_err(|error| format!("无法保存诊断报告：{error}"))?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn open_diagnostics_folder(app: tauri::AppHandle) -> Result<(), String> {
    let folder = diagnostic_folder(&app)?;
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&folder)
            .spawn()
            .map_err(|error| format!("无法打开日志文件夹：{error}"))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        return Err("当前平台暂不支持自动打开文件夹".to_string());
    }
    Ok(())
}

fn diagnostic_folder(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let folder = app_data_folder(app)?.join("logs");
    fs::create_dir_all(&folder).map_err(|error| format!("无法创建日志目录：{error}"))?;
    Ok(folder)
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

fn append_log(path: &Path, line: &str) -> Result<(), String> {
    if let Ok(metadata) = fs::metadata(path) {
        if metadata.len() > 2 * 1024 * 1024 {
            let first = path.with_extension("log.1");
            let second = path.with_extension("log.2");
            let _ = fs::remove_file(&second);
            let _ = fs::rename(&first, &second);
            let _ = fs::rename(path, &first);
        }
    }
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|error| format!("无法写入日志：{error}"))?;
    file.write_all(line.as_bytes())
        .map_err(|error| format!("无法写入日志：{error}"))
}

fn open_external_url(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("rundll32.exe")
            .arg("url.dll,FileProtocolHandler")
            .arg(url)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|error| format!("无法打开浏览器：{error}"))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = url;
        return Err("当前平台暂不支持自动打开浏览器".to_string());
    }
    Ok(())
}

#[tauri::command]
fn write_backup(
    app: tauri::AppHandle,
    data_base64: String,
    kind: String,
) -> Result<String, String> {
    if data_base64.len() > 1_500_000_000 {
        return Err("备份文件过大，无法保存".to_string());
    }
    let bytes = STANDARD
        .decode(data_base64.as_bytes())
        .map_err(|error| format!("备份数据损坏：{error}"))?;
    let folder = backup_folder(&app)?;
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    let label = match kind.as_str() {
        "auto" => "auto",
        "pre-restore" => "pre-restore",
        _ => "manual",
    };
    let path = folder.join(format!("moyue-{label}-{stamp}.zip"));
    fs::write(&path, bytes).map_err(|error| format!("写入备份失败：{error}"))?;
    prune_backups(&folder, 8);
    Ok(path.to_string_lossy().into_owned())
}

fn backup_folder(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let folder = app_data_folder(app)?.join("backups");
    fs::create_dir_all(&folder).map_err(|error| format!("无法创建备份目录：{error}"))?;
    Ok(folder)
}

fn prune_backups(folder: &Path, keep: usize) {
    let Ok(entries) = fs::read_dir(folder) else {
        return;
    };
    let mut files: Vec<PathBuf> = entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_file()
                && path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .map(|name| name.starts_with("moyue-") && name.ends_with(".zip"))
                    .unwrap_or(false)
        })
        .collect();
    files.sort();
    if files.len() > keep {
        for path in &files[..files.len() - keep] {
            let _ = fs::remove_file(path);
        }
    }
}

#[tauri::command]
fn uninstall_app(app: tauri::AppHandle, delete_data: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let executable = std::env::current_exe()
            .map_err(|error| format!("无法定位当前程序：{error}"))?;
        let install_dir = executable
            .parent()
            .ok_or_else(|| "无法定位安装目录".to_string())?;
        let uninstaller = install_dir.join("uninstall.exe");
        if !uninstaller.exists() {
            return Err("没有找到卸载程序，请使用安装包重新安装后再卸载".to_string());
        }

        let data_folder = app_data_folder(&app)?;
        let delete_data_line = if delete_data {
            format!(
                "rmdir /s /q \"{}\"\r\n",
                data_folder.to_string_lossy()
            )
        } else {
            String::new()
        };
        let batch_path = std::env::temp_dir().join(format!(
            "moyue-uninstall-{}.cmd",
            std::process::id()
        ));
        let script = format!(
            "@echo off\r\n\
             timeout /t 2 /nobreak >nul\r\n\
             start \"\" /wait \"{}\" /S\r\n\
             timeout /t 2 /nobreak >nul\r\n\
             {}\
             del \"%~f0\"\r\n",
            uninstaller.to_string_lossy(),
            delete_data_line
        );
        fs::write(&batch_path, script)
            .map_err(|error| format!("无法准备卸载程序：{error}"))?;

        Command::new("cmd")
            .arg("/C")
            .arg(&batch_path)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|error| format!("无法启动卸载程序：{error}"))?;

        app.exit(0);
        return Ok(());
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        let _ = delete_data;
        Err("自动卸载目前仅支持 Windows".to_string())
    }
}

fn app_data_folder(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let folder = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("无法定位应用数据目录：{error}"))?;
    fs::create_dir_all(&folder).map_err(|error| format!("无法创建应用数据目录：{error}"))?;
    Ok(folder)
}

fn music_folder(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let folder = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法定位应用数据目录：{error}"))?
        .join("music");
    fs::create_dir_all(&folder).map_err(|error| format!("无法创建音乐文件夹：{error}"))?;
    Ok(folder)
}

fn collect_music(folder: &Path, tracks: &mut Vec<MusicTrack>, depth: u8) {
    if depth > 4 {
        return;
    }
    let Ok(entries) = fs::read_dir(folder) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_music(&path, tracks, depth + 1);
            continue;
        }
        if !is_audio_file(&path) {
            continue;
        }
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        let modified = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_secs())
            .unwrap_or(0);
        tracks.push(MusicTrack {
            file_name: path
                .file_name()
                .map(|name| name.to_string_lossy().into_owned())
                .unwrap_or_default(),
            path: path.to_string_lossy().into_owned(),
            size: metadata.len(),
            modified,
        });
    }
}

fn is_audio_file(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.to_ascii_lowercase())
            .as_deref(),
        Some("mp3" | "flac" | "wav" | "m4a" | "aac" | "ogg" | "opus")
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            if let Ok(dir) = app.path().app_local_data_dir() {
                let logs = dir.join("logs");
                let _ = fs::create_dir_all(&logs);
                let previous = panic::take_hook();
                panic::set_hook(Box::new(move |info| {
                    let line = format!("[{}] [PANIC] {}\n", now_millis(), info);
                    let _ = append_log(&logs.join("moyue.log"), &line);
                    previous(info);
                }));
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_info,
            music_dir,
            list_music,
            open_music_folder,
            data_dir,
            open_data_folder,
            backup_dir,
            open_backup_folder,
            write_backup,
            open_sponsor_issue,
            open_feedback,
            append_diagnostic,
            write_diagnostic_report,
            open_diagnostics_folder,
            neural_status,
            download_neural,
            remove_neural,
            sherpa_speak,
            uninstall_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
