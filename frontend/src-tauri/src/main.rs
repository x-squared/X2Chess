use std::env;
use std::fs;
use std::path::{Component, Path, PathBuf};

fn is_simple_file_name(file_name: &str) -> bool {
  let path = Path::new(file_name);
  let mut count = 0usize;
  for component in path.components() {
    match component {
      Component::Normal(_) => count += 1,
      _ => return false,
    }
  }
  count == 1
}

fn canonicalize_dir(path: &str) -> Result<PathBuf, String> {
  let canonical = fs::canonicalize(path).map_err(|error| format!("Invalid directory: {error}"))?;
  if !canonical.is_dir() {
    return Err("Path is not a directory.".to_string());
  }
  Ok(canonical)
}

fn discover_default_games_dir() -> Option<PathBuf> {
  let cwd = env::current_dir().ok()?;
  let mut candidates = Vec::new();
  candidates.push(cwd.clone());
  if let Some(parent) = cwd.parent() {
    candidates.push(parent.to_path_buf());
    if let Some(grand_parent) = parent.parent() {
      candidates.push(grand_parent.to_path_buf());
      if let Some(great_grand_parent) = grand_parent.parent() {
        candidates.push(great_grand_parent.to_path_buf());
      }
    }
  }

  for base in candidates {
    let games_dir = base.join("run").join("DEV").join("games");
    if games_dir.is_dir() {
      return Some(games_dir);
    }
  }
  None
}

#[tauri::command]
fn detect_default_games_directory() -> Option<String> {
  discover_default_games_dir().map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
fn pick_games_directory() -> Option<String> {
  rfd::FileDialog::new()
    .set_title("Choose X2Chess game folder")
    .pick_folder()
    .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
fn list_pgn_files(games_directory: String) -> Result<Vec<String>, String> {
  let games_dir = canonicalize_dir(&games_directory)?;
  let mut names = Vec::new();
  let entries = fs::read_dir(games_dir).map_err(|error| format!("Unable to read folder: {error}"))?;
  for entry in entries {
    let entry = entry.map_err(|error| format!("Unable to read directory entry: {error}"))?;
    let path = entry.path();
    if !path.is_file() {
      continue;
    }
    let is_pgn = path
      .extension()
      .and_then(|ext| ext.to_str())
      .map(|ext| ext.eq_ignore_ascii_case("pgn"))
      .unwrap_or(false);
    if !is_pgn {
      continue;
    }
    if let Some(name) = path.file_name().and_then(|name| name.to_str()) {
      names.push(name.to_string());
    }
  }
  names.sort_unstable();
  Ok(names)
}

#[tauri::command]
fn load_game_file(games_directory: String, file_name: String) -> Result<String, String> {
  if !is_simple_file_name(&file_name) {
    return Err("Invalid file name.".to_string());
  }
  let games_dir = canonicalize_dir(&games_directory)?;
  let target = games_dir.join(file_name);
  fs::read_to_string(target).map_err(|error| format!("Unable to read game file: {error}"))
}

#[tauri::command]
fn save_game_file(games_directory: String, file_name: String, content: String) -> Result<(), String> {
  if !is_simple_file_name(&file_name) {
    return Err("Invalid file name.".to_string());
  }
  let games_dir = canonicalize_dir(&games_directory)?;
  let target = games_dir.join(file_name);
  fs::write(target, content).map_err(|error| format!("Unable to save game file: {error}"))
}

#[tauri::command]
fn load_user_config(root_directory: String) -> Result<Option<String>, String> {
  let root_dir = canonicalize_dir(&root_directory)?;
  let config_path = root_dir.join("config").join("user-config.json");
  if !config_path.exists() {
    return Ok(None);
  }
  let content = fs::read_to_string(config_path).map_err(|error| format!("Unable to read user config: {error}"))?;
  Ok(Some(content))
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      detect_default_games_directory,
      pick_games_directory,
      list_pgn_files,
      load_game_file,
      save_game_file,
      load_user_config,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
