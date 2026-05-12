mod commands;

use std::sync::Mutex;
use tauri::Manager;

struct OpenedFile(Mutex<String>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // When a second instance is launched (e.g., file association), forward the file paths
            for arg in &args {
                if arg.ends_with(".md") || arg.ends_with(".txt") {
                    let _ = app.get_webview_window("main").map(|w| {
                        let _ = w.eval(&format!(
                            "window.__graphiteOpenFile && window.__graphiteOpenFile({})",
                            serde_json::to_string(arg).unwrap_or_default()
                        ));
                    });
                    break;
                }
            }
        }))
        .manage(commands::watcher::WatcherState::default())
        .manage(commands::watcher::SkipSet::default())
        .manage(OpenedFile(Mutex::new(String::new())))
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            // Store first-instance command-line args (file association when app wasn't running)
            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                let path = &args[1];
                if path.ends_with(".md") || path.ends_with(".txt") {
                    *app.state::<OpenedFile>().0.lock().unwrap() = path.clone();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::file::read_directory,
            commands::file::read_file,
            commands::file::write_file,
            commands::file::create_directory,
            commands::file::create_file,
            commands::file::rename_file,
            commands::file::delete_file,
            commands::export::export_pdf,
            commands::export::capture_html_png,
            commands::export::capture_region_png,
            commands::watcher::start_watcher,
            commands::watcher::skip_next_event,
            get_opened_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn get_opened_file(state: tauri::State<'_, OpenedFile>) -> String {
    state.0.lock().unwrap().clone()
}
