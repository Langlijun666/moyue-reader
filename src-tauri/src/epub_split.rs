use regex::Regex;
use roxmltree::Document;
use serde::Serialize;
use std::collections::{HashMap, HashSet, VecDeque};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitVolumeInfo {
    pub name: String,
    pub path: String,
}

struct ManifestItem {
    href: String,
    media_type: String,
    properties: String,
}

#[derive(Clone)]
struct NavEntry {
    href: String,
    label: String,
}

fn parse_xml(text: &str) -> Result<Document<'_>, String> {
    Document::parse_with_options(
        text,
        roxmltree::ParsingOptions {
            allow_dtd: true,
            ..Default::default()
        },
    )
    .map_err(|error| error.to_string())
}

fn parent(path: &str) -> String {
    path.rsplit_once('/')
        .map(|(dir, _)| dir.to_string())
        .unwrap_or_default()
}

fn normalize(base: &str, href: &str) -> String {
    let clean = href.split('#').next().unwrap_or("");
    if clean.is_empty()
        || clean.starts_with("http://")
        || clean.starts_with("https://")
        || clean.starts_with("data:")
        || clean.starts_with("mailto:")
    {
        return clean.to_string();
    }
    let mut parts: Vec<&str> = if clean.starts_with('/') {
        Vec::new()
    } else {
        base.split('/').filter(|part| !part.is_empty()).collect()
    };
    for part in clean.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." {
            parts.pop();
        } else {
            parts.push(part);
        }
    }
    parts.join("/")
}

fn dir_of(path: &str) -> String {
    parent(path)
}

fn text_of(node: Option<roxmltree::Node<'_, '_>>) -> String {
    node.and_then(|item| item.text())
        .unwrap_or("")
        .trim()
        .to_string()
}

fn read_text(archive: &mut ZipArchive<File>, path: &str) -> Result<String, String> {
    let mut entry = archive
        .by_name(path)
        .map_err(|error| format!("EPUB 缺少 {path}：{error}"))?;
    let mut text = String::new();
    entry
        .read_to_string(&mut text)
        .map_err(|error| format!("EPUB 读取 {path} 失败：{error}"))?;
    Ok(text)
}

fn read_bytes(archive: &mut ZipArchive<File>, path: &str) -> Result<Vec<u8>, String> {
    let mut entry = archive
        .by_name(path)
        .map_err(|error| format!("EPUB 缺少 {path}：{error}"))?;
    let mut bytes = Vec::new();
    entry
        .read_to_end(&mut bytes)
        .map_err(|error| format!("EPUB 读取 {path} 失败：{error}"))?;
    Ok(bytes)
}

fn manifest_from_opf(
    opf: &Document<'_>,
    opf_dir: &str,
) -> (HashMap<String, ManifestItem>, Vec<String>, String, String) {
    let mut manifest = HashMap::new();
    for node in opf
        .descendants()
        .filter(|node| node.has_tag_name("item"))
    {
        let Some(id) = node.attribute("id") else { continue };
        let Some(href) = node.attribute("href") else { continue };
        manifest.insert(
            id.to_string(),
            ManifestItem {
                href: normalize(opf_dir, href),
                media_type: node.attribute("media-type").unwrap_or("").to_string(),
                properties: node.attribute("properties").unwrap_or("").to_string(),
            },
        );
    }
    let mut spine = Vec::new();
    for node in opf
        .descendants()
        .filter(|node| node.has_tag_name("itemref"))
    {
        if let Some(idref) = node.attribute("idref") {
            if let Some(item) = manifest.get(idref) {
                spine.push(item.href.clone());
            }
        }
    }
    let title = text_of(
        opf.descendants()
            .find(|node| node.has_tag_name("title")),
    );
    let creator = text_of(
        opf.descendants()
            .find(|node| node.has_tag_name("creator")),
    );
    (manifest, spine, title, creator)
}

fn nav_entries(
    archive: &mut ZipArchive<File>,
    nav_path: &str,
) -> Result<Vec<NavEntry>, String> {
    let text = read_text(archive, nav_path)?;
    let document = parse_xml(&text).map_err(|error| format!("目录解析失败：{error}"))?;
    let base = dir_of(nav_path);
    let mut entries = Vec::new();
    for anchor in document
        .descendants()
        .filter(|node| node.has_tag_name("a"))
    {
        let Some(href) = anchor.attribute("href") else { continue };
        let href = normalize(&base, href);
        if !href.ends_with(".xhtml") && !href.ends_with(".html") {
            continue;
        }
        let label = anchor
            .descendants()
            .filter_map(|node| node.text())
            .collect::<String>()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");
        if label.is_empty() {
            continue;
        }
        entries.push(NavEntry { href, label });
    }
    Ok(entries)
}

fn ncx_entries(archive: &mut ZipArchive<File>, ncx_path: &str) -> Result<Vec<NavEntry>, String> {
    let text = read_text(archive, ncx_path)?;
    let document = parse_xml(&text).map_err(|error| format!("NCX 解析失败：{error}"))?;
    let base = dir_of(ncx_path);
    let mut entries = Vec::new();
    for point in document
        .descendants()
        .filter(|node| node.has_tag_name("navPoint"))
    {
        let Some(content) = point
            .descendants()
            .find(|node| node.has_tag_name("content"))
        else {
            continue;
        };
        let Some(src) = content.attribute("src") else { continue };
        let href = normalize(&base, src);
        let label = point
            .descendants()
            .find(|node| node.has_tag_name("navLabel"))
            .and_then(|node| node.descendants().find(|child| child.has_tag_name("text")))
            .and_then(|node| node.text())
            .unwrap_or("")
            .trim()
            .to_string();
        if !href.is_empty() && !label.is_empty() {
            entries.push(NavEntry { href, label });
        }
    }
    Ok(entries)
}

fn make_groups(entries: &[NavEntry], spine: &[String]) -> Vec<Vec<NavEntry>> {
    if entries.is_empty() {
        return spine
            .chunks(25)
            .map(|chunk| {
                chunk
                    .iter()
                    .map(|href| NavEntry {
                        href: href.clone(),
                        label: href.clone(),
                    })
                    .collect()
            })
            .collect();
    }
    let mut groups: Vec<Vec<NavEntry>> = Vec::new();
    let mut current: Vec<NavEntry> = Vec::new();
    for entry in entries {
        current.push(NavEntry {
            href: entry.href.clone(),
            label: entry.label.clone(),
        });
        if entry.label.contains("插图") {
            groups.push(current);
            current = Vec::new();
        }
    }
    if !current.is_empty() {
        groups.push(current);
    }
    groups
}

fn collect_assets(
    archive: &mut ZipArchive<File>,
    chapters: &[NavEntry],
) -> Result<HashSet<String>, String> {
    let href_re = Regex::new(r#"(?i)(?:src|href|xlink:href)\s*=\s*["']([^"']+)["']"#).unwrap();
    let css_re = Regex::new(r#"(?i)url\(\s*["']?([^"')]+)"#).unwrap();
    let mut assets = HashSet::new();
    let mut queue: VecDeque<(String, String)> = chapters
        .iter()
        .map(|entry| (entry.href.clone(), dir_of(&entry.href)))
        .collect();
    while let Some((path, base)) = queue.pop_front() {
        if path.ends_with(".xhtml") || path.ends_with(".html") || path.ends_with(".css") {
            if assets.contains(&path) {
                continue;
            }
            let text = match read_text(archive, &path) {
                Ok(text) => text,
                Err(_) => continue,
            };
            let regex = if path.ends_with(".css") {
                &css_re
            } else {
                &href_re
            };
            for capture in regex.captures_iter(&text) {
                let raw = capture.get(1).map(|item| item.as_str()).unwrap_or("");
                let next = normalize(&base, raw);
                if next.is_empty() || next.starts_with("http") || next.starts_with("data:") {
                    continue;
                }
                if next == path {
                    continue;
                }
                if next.ends_with(".xhtml") || next.ends_with(".html") {
                    continue;
                }
                if !assets.contains(&next) {
                    assets.insert(next.clone());
                    let base = dir_of(&next);
                    queue.push_back((next, base));
                }
            }
        }
    }
    Ok(assets)
}

fn media_type_for(path: &str) -> &'static str {
    match path.rsplit('.').next().unwrap_or("").to_ascii_lowercase().as_str() {
        "xhtml" => "application/xhtml+xml",
        "html" => "text/html",
        "css" => "text/css",
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        _ => "application/octet-stream",
    }
}

fn safe_name(value: &str) -> String {
    let cleaned: String = value
        .chars()
        .map(|ch| if "\\/:*?\"<>|".contains(ch) { '_' } else { ch })
        .collect();
    cleaned.trim().chars().take(64).collect()
}

fn write_entry(
    writer: &mut ZipWriter<File>,
    name: &str,
    bytes: &[u8],
    stored: bool,
) -> Result<(), String> {
    let options = SimpleFileOptions::default().compression_method(if stored {
        CompressionMethod::Stored
    } else {
        CompressionMethod::Deflated
    });
    writer
        .start_file(name, options)
        .map_err(|error| format!("写入分卷失败：{error}"))?;
    writer
        .write_all(bytes)
        .map_err(|error| format!("写入分卷失败：{error}"))
}

pub fn split_epub(
    input: &Path,
    output_dir: &Path,
    max_bytes: u64,
) -> Result<Vec<SplitVolumeInfo>, String> {
    let size = fs::metadata(input)
        .map_err(|error| format!("无法读取 EPUB：{error}"))?
        .len();
    if size <= max_bytes {
        return Ok(Vec::new());
    }
    fs::create_dir_all(output_dir).map_err(|error| format!("无法创建分卷目录：{error}"))?;
    let file = File::open(input).map_err(|error| format!("无法打开 EPUB：{error}"))?;
    let mut archive = ZipArchive::new(file).map_err(|error| format!("EPUB 不是有效压缩包：{error}"))?;

    let container = read_text(&mut archive, "META-INF/container.xml")?;
    let container_doc =
        parse_xml(&container).map_err(|error| format!("container.xml 解析失败：{error}"))?;
    let opf_path = container_doc
        .descendants()
        .find(|node| node.has_tag_name("rootfile"))
        .and_then(|node| node.attribute("full-path"))
        .unwrap_or("EPUB/content.opf")
        .to_string();
    let opf_dir = dir_of(&opf_path);
    let opf_text = read_text(&mut archive, &opf_path)?;
    let opf = parse_xml(&opf_text).map_err(|error| format!("OPF 解析失败：{error}"))?;
    let (manifest, spine, title, creator) = manifest_from_opf(&opf, &opf_dir);
    let base_title = if title.is_empty() {
        input
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("未命名书籍")
            .to_string()
    } else {
        title
    };

    let nav_item = manifest.values().find(|item| item.properties.contains("nav"));
    let ncx_item = manifest
        .values()
        .find(|item| item.media_type == "application/x-dtbncx+xml");
    let mut entries = Vec::new();
    if let Some(item) = nav_item {
        entries = nav_entries(&mut archive, &item.href)?;
    }
    if entries.is_empty() {
        if let Some(item) = ncx_item {
            entries = ncx_entries(&mut archive, &item.href)?;
        }
    }
    let groups = make_groups(&entries, &spine);
    if groups.len() < 2 {
        return Ok(Vec::new());
    }

    let base_name = input
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("wenku8")
        .to_string();
    let mut volumes = Vec::new();
    for (index, group) in groups.iter().enumerate() {
        let mut seen = HashSet::new();
        let chapters: Vec<NavEntry> = group
            .iter()
            .filter(|entry| seen.insert(entry.href.clone()))
            .cloned()
            .collect();
        if chapters.is_empty() {
            continue;
        }
        let assets = collect_assets(&mut archive, &chapters)?;
        let volume_title = format!(
            "{} 卷{:02} · {}",
            base_title,
            index + 1,
            chapters[0].label.chars().take(30).collect::<String>()
        );
        let volume_name = format!("{} 卷{:02}.epub", safe_name(&base_name), index + 1);
        let target = output_dir.join(&volume_name);
        let target_file = File::create(&target).map_err(|error| format!("无法创建分卷：{error}"))?;
        let mut writer = ZipWriter::new(target_file);
        write_entry(
            &mut writer,
            "mimetype",
            b"application/epub+zip",
            true,
        )?;
        write_entry(
            &mut writer,
            "META-INF/container.xml",
            b"<?xml version=\"1.0\" encoding=\"utf-8\"?><container xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\" version=\"1.0\"><rootfiles><rootfile media-type=\"application/oebps-package+xml\" full-path=\"EPUB/content.opf\"/></rootfiles></container>",
            false,
        )?;

        let mut manifest_xml = String::from(
            "<item id=\"nav\" href=\"nav.xhtml\" media-type=\"application/xhtml+xml\" properties=\"nav\"/>",
        );
        let mut spine_xml = String::new();
        for (item_index, entry) in chapters.iter().enumerate() {
            let relative = entry
                .href
                .strip_prefix(&format!("{opf_dir}/"))
                .unwrap_or(&entry.href);
            manifest_xml.push_str(&format!(
                "<item id=\"c{item_index}\" href=\"{}\" media-type=\"application/xhtml+xml\"/>",
                escape_xml(relative)
            ));
            spine_xml.push_str(&format!("<itemref idref=\"c{item_index}\"/>"));
            let bytes = read_bytes(&mut archive, &entry.href)?;
            write_entry(&mut writer, &format!("EPUB/{relative}"), &bytes, false)?;
        }
        for (asset_index, asset) in assets.iter().enumerate() {
            if chapters.iter().any(|entry| entry.href == *asset) {
                continue;
            }
            let relative = asset
                .strip_prefix(&format!("{opf_dir}/"))
                .unwrap_or(asset);
            manifest_xml.push_str(&format!(
                "<item id=\"a{asset_index}\" href=\"{}\" media-type=\"{}\"/>",
                escape_xml(relative),
                media_type_for(asset)
            ));
            if let Ok(bytes) = read_bytes(&mut archive, asset) {
                write_entry(&mut writer, &format!("EPUB/{relative}"), &bytes, false)?;
            }
        }
        let creator_xml = if creator.is_empty() {
            String::new()
        } else {
            format!("<dc:creator>{}</dc:creator>", escape_xml(&creator))
        };
        let opf_xml = format!(
            "<?xml version=\"1.0\" encoding=\"utf-8\"?><package xmlns=\"http://www.idpf.org/2007/opf\" version=\"3.0\" unique-identifier=\"id\"><metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\"><dc:identifier id=\"id\">moyue-split-{index}</dc:identifier><dc:title>{}</dc:title>{}<dc:language>zh-CN</dc:language></metadata><manifest>{}</manifest><spine>{}</spine></package>",
            escape_xml(&volume_title),
            creator_xml,
            manifest_xml,
            spine_xml
        );
        write_entry(&mut writer, "EPUB/content.opf", opf_xml.as_bytes(), false)?;
        let nav_xml = format!(
            "<?xml version=\"1.0\" encoding=\"utf-8\"?><html xmlns=\"http://www.w3.org/1999/xhtml\" xmlns:epub=\"http://www.idpf.org/2007/ops\"><head><title>目录</title></head><body><nav epub:type=\"toc\"><ol>{}</ol></nav></body></html>",
            chapters
                .iter()
                .map(|entry| {
                    let relative = entry
                        .href
                        .strip_prefix(&format!("{opf_dir}/"))
                        .unwrap_or(&entry.href);
                    format!(
                        "<li><a href=\"{}\">{}</a></li>",
                        escape_xml(relative),
                        escape_xml(&entry.label)
                    )
                })
                .collect::<String>()
        );
        write_entry(&mut writer, "EPUB/nav.xhtml", nav_xml.as_bytes(), false)?;
        writer
            .finish()
            .map_err(|error| format!("写入分卷失败：{error}"))?;
        let target_text = target.to_string_lossy();
        let target_text = target_text
            .trim_start_matches(|ch| ch == '\\' || ch == '?')
            .to_string();
        volumes.push(SplitVolumeInfo {
            name: volume_name,
            path: target_text,
        });
    }
    Ok(volumes)
}

fn escape_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
