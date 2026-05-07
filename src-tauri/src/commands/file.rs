use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified_at: String,
    pub children: Option<Vec<FileEntry>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirectoryResult {
    pub path: String,
    pub name: String,
    pub children: Vec<FileEntry>,
}

fn is_text_file(name: &str) -> bool {
    let lower = name.to_lowercase();
    let exts = [".md", ".html", ".htm", ".txt"];
    exts.iter().any(|e| lower.ends_with(e))
}

fn read_dir_tree(path: &Path) -> std::io::Result<Vec<FileEntry>> {
    let mut entries = Vec::new();
    let mut dirs = Vec::new();
    let mut files = Vec::new();

    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files and directories
        if name.starts_with('.') {
            continue;
        }

        let metadata = entry.metadata()?;

        // Also check Windows hidden file attribute
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
            if metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0 {
                continue;
            }
        }

        let modified = metadata
            .modified()
            .ok()
            .map(|t| {
                let duration = t
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default();
                duration.as_secs().to_string()
            })
            .unwrap_or_default();

        if metadata.is_dir() {
            let children = read_dir_tree(&entry.path())
                .map_err(|e| { eprintln!("Warning: failed to read subdirectory {:?}: {}", entry.path(), e); e })
                .unwrap_or_default();
            dirs.push(FileEntry {
                path: entry.path().to_string_lossy().to_string(),
                name,
                is_dir: true,
                size: 0,
                modified_at: modified,
                children: Some(children),
            });
        } else if is_text_file(&name) {
            files.push(FileEntry {
                path: entry.path().to_string_lossy().to_string(),
                name,
                is_dir: false,
                size: metadata.len(),
                modified_at: modified,
                children: None,
            });
        }
    }

    dirs.sort_by(|a, b| a.name.cmp(&b.name));
    files.sort_by(|a, b| a.name.cmp(&b.name));
    entries.extend(dirs);
    entries.extend(files);

    Ok(entries)
}

#[tauri::command]
pub fn read_directory(path: String) -> Result<DirectoryResult, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("Directory not found: {}", path));
    }
    if !p.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    let name = p
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let children = read_dir_tree(&p).map_err(|e| format!("Failed to read directory: {}", e))?;

    Ok(DirectoryResult {
        path,
        name,
        children,
    })
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("File not found: {}", path));
    }
    if !p.is_file() {
        return Err(format!("Not a file: {}", path));
    }

    let meta = std::fs::metadata(&p).map_err(|e| format!("{}", e))?;
    if meta.len() > 10 * 1024 * 1024 {
        return Err(format!("文件过大 ({} MB)，无法打开", meta.len() / 1024 / 1024));
    }

    fs::read_to_string(&p).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    // Create parent directories if they don't exist
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
    }
    fs::write(&p, &content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub fn create_directory(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path).map_err(|e| format!("{}", e))
}

#[tauri::command]
pub fn create_file(path: String) -> Result<(), String> {
    let p = std::path::PathBuf::from(&path);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("{}", e))?;
    }
    std::fs::write(&p, "").map_err(|e| format!("{}", e))?;
    Ok(())
}

#[tauri::command]
pub fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    std::fs::rename(&old_path, &new_path).map_err(|e| format!("{}", e))?;
    Ok(())
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    let p = std::path::PathBuf::from(&path);
    if p.is_dir() {
        std::fs::remove_dir_all(&p).map_err(|e| format!("{}", e))?;
    } else {
        std::fs::remove_file(&p).map_err(|e| format!("{}", e))?;
    }
    Ok(())
}
