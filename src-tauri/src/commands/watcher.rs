use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use notify::{Event, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Default)]
pub struct WatcherState(pub Mutex<Option<notify::RecommendedWatcher>>);

#[derive(Clone, serde::Serialize)]
struct FileChangedPayload {
    paths: Vec<String>,
    kind: String,
}

/// Paths to skip for a short grace period (set by frontend before saving).
/// Uses time-based expiry so that multiple notify events from a single
/// `fs::write` (e.g. content modification + metadata/timestamp change on
/// Windows) are all suppressed.
#[derive(Default)]
pub struct SkipSet(pub Mutex<HashMap<PathBuf, Instant>>);

#[tauri::command]
pub fn start_watcher(app: AppHandle, path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.is_dir() {
        return Err("Not a directory".into());
    }

    let app_handle = app.clone();

    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        if let Ok(event) = res {
            let app = app_handle.clone();
            let skip = app.state::<SkipSet>();
            let mut guard = skip.0.lock().unwrap_or_else(|e| e.into_inner());

            // Prune expired entries before checking
            let now = Instant::now();
            guard.retain(|_, expiry| *expiry > now);

            let paths: Vec<String> = event
                .paths
                .iter()
                .filter(|p| {
                    // Skip if the path is in the skip set (self-save).
                    // Do NOT remove the entry — let it expire naturally so that
                    // subsequent notify events from the same write are also skipped.
                    !guard.contains_key(*p)
                })
                .map(|p| p.to_string_lossy().to_string())
                .collect();

            if !paths.is_empty() {
                let payload = FileChangedPayload {
                    paths,
                    kind: format!("{:?}", event.kind),
                };
                let _ = app_handle.emit("file-changed", payload);
            }
        }
    })
    .map_err(|e| format!("{}", e))?;

    watcher
        .watch(&p, RecursiveMode::Recursive)
        .map_err(|e| format!("{}", e))?;

    let state = app.state::<WatcherState>();
    *state.0.lock().unwrap_or_else(|e| e.into_inner()) = Some(watcher);

    Ok(())
}

#[tauri::command]
pub fn skip_next_event(path: String, state: tauri::State<'_, SkipSet>) -> Result<(), String> {
    state
        .0
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .insert(PathBuf::from(path), Instant::now() + Duration::from_secs(1));
    Ok(())
}
