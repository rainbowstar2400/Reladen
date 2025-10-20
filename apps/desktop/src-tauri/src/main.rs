#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::AppHandle; // Manager は使っていないので外すと警告も消えます

fn ensure_local_store(handle: &AppHandle) -> anyhow::Result<()> {
    let app_dir = handle
        .path_resolver()
        .app_data_dir()
        .ok_or_else(|| anyhow::anyhow!("app data dir not found"))?;
    std::fs::create_dir_all(&app_dir)?;
    let db_path = app_dir.join("app.db");
    if !db_path.exists() {
        // 初期内容は空JSONにしておく（必要なら変更OK）
        std::fs::write(&db_path, b"{}")?;
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // &mut App から AppHandle を取り出して参照渡し
            let handle = app.handle();
            ensure_local_store(&handle)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
