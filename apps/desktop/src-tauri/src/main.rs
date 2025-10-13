#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{AppHandle, Manager};

fn ensure_sqlite(app: &AppHandle) -> anyhow::Result<()> {
  let app_dir = app.path_resolver().app_data_dir().ok_or_else(|| anyhow::anyhow!("app data dir not found"))?;
  std::fs::create_dir_all(&app_dir)?;
  let db_path = app_dir.join("app.db");
  if !db_path.exists() {
    std::fs::File::create(&db_path)?;
  }
  Ok(())
}

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      ensure_sqlite(app)?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
