mod commands;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .manage(commands::watcher::WatcherState::default())
        .manage(commands::watcher::SkipSet::default())
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
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
            commands::export::capture_region_png,
            commands::watcher::start_watcher,
            commands::watcher::skip_next_event,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
