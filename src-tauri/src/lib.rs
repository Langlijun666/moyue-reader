use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;
use tauri::Manager;

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
        .invoke_handler(tauri::generate_handler![
            app_info,
            music_dir,
            list_music,
            open_music_folder,
            data_dir,
            open_data_folder,
            uninstall_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
