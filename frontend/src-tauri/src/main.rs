use std::collections::HashMap;
use std::env;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::{Component, Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

use rusqlite::types::ValueRef;
use rusqlite::{params_from_iter, Connection};
use serde_json::{json, Value as JsonValue};
use tauri::Emitter;

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
fn pick_resource_file() -> Option<String> {
  rfd::FileDialog::new()
    .add_filter("Chess resources", &["pgn", "x2chess"])
    .set_title("Choose resource file (or cancel to pick a folder)")
    .pick_file()
    .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
fn load_text_file(file_path: String) -> Result<String, String> {
  fs::read_to_string(&file_path)
    .map_err(|error| format!("Unable to read file: {error}"))
}

#[tauri::command]
fn write_text_file(file_path: String, content: String) -> Result<(), String> {
  fs::write(&file_path, content).map_err(|error| format!("Unable to write file: {error}"))
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

#[tauri::command]
fn load_player_list(root_directory: String) -> Result<Option<String>, String> {
  let root_dir = canonicalize_dir(&root_directory)?;
  let players_path = root_dir.join("data").join("players.json");
  if !players_path.exists() {
    return Ok(None);
  }
  let content = fs::read_to_string(players_path).map_err(|error| format!("Unable to read player list: {error}"))?;
  Ok(Some(content))
}

#[tauri::command]
fn save_player_list(root_directory: String, content: String) -> Result<(), String> {
  let root_dir = canonicalize_dir(&root_directory)?;
  let data_dir = root_dir.join("data");
  fs::create_dir_all(&data_dir).map_err(|error| format!("Unable to create data directory: {error}"))?;
  let players_path = data_dir.join("players.json");
  fs::write(players_path, content).map_err(|error| format!("Unable to save player list: {error}"))
}

// ── SQLite state ──────────────────────────────────────────────────────────────

struct DbState {
  connections: Mutex<HashMap<String, Connection>>,
}

fn json_to_sqlite(v: &JsonValue) -> rusqlite::types::Value {
  match v {
    JsonValue::Null => rusqlite::types::Value::Null,
    JsonValue::Bool(b) => rusqlite::types::Value::Integer(*b as i64),
    JsonValue::Number(n) => {
      if let Some(i) = n.as_i64() {
        rusqlite::types::Value::Integer(i)
      } else {
        rusqlite::types::Value::Real(n.as_f64().unwrap_or(0.0))
      }
    }
    JsonValue::String(s) => rusqlite::types::Value::Text(s.clone()),
    _ => rusqlite::types::Value::Null,
  }
}

fn sqlite_to_json(v: ValueRef<'_>) -> JsonValue {
  match v {
    ValueRef::Null => JsonValue::Null,
    ValueRef::Integer(i) => json!(i),
    ValueRef::Real(f) => json!(f),
    ValueRef::Text(t) => JsonValue::String(String::from_utf8_lossy(t).to_string()),
    ValueRef::Blob(_) => JsonValue::Null,
  }
}

fn open_or_get<'a>(
  guard: &'a mut HashMap<String, Connection>,
  db_path: &str,
) -> Result<&'a Connection, String> {
  if !guard.contains_key(db_path) {
    let conn = Connection::open(db_path)
      .map_err(|e| format!("Failed to open database: {e}"))?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
      .map_err(|e| format!("Failed to set pragmas: {e}"))?;
    guard.insert(db_path.to_string(), conn);
  }
  Ok(guard.get(db_path).unwrap())
}

#[tauri::command]
fn query_db(
  state: tauri::State<DbState>,
  db_path: String,
  sql: String,
  params: Vec<JsonValue>,
) -> Result<Vec<JsonValue>, String> {
  let mut guard = state.connections.lock().map_err(|e| e.to_string())?;
  let conn = open_or_get(&mut guard, &db_path)?;
  let sqlite_params: Vec<rusqlite::types::Value> = params.iter().map(json_to_sqlite).collect();
  let mut stmt = conn.prepare(&sql).map_err(|e| format!("SQL prepare error: {e}"))?;
  let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
  let rows = stmt
    .query_map(params_from_iter(sqlite_params.iter()), |row| {
      let mut obj = serde_json::Map::new();
      for (i, col) in col_names.iter().enumerate() {
        let v = row.get_ref(i).unwrap_or(ValueRef::Null);
        obj.insert(col.clone(), sqlite_to_json(v));
      }
      Ok(JsonValue::Object(obj))
    })
    .map_err(|e| format!("SQL query error: {e}"))?;
  rows.collect::<Result<Vec<_>, _>>().map_err(|e| format!("Row error: {e}"))
}

#[tauri::command]
fn execute_db(
  state: tauri::State<DbState>,
  db_path: String,
  sql: String,
  params: Vec<JsonValue>,
) -> Result<(), String> {
  let mut guard = state.connections.lock().map_err(|e| e.to_string())?;
  let conn = open_or_get(&mut guard, &db_path)?;
  let sqlite_params: Vec<rusqlite::types::Value> = params.iter().map(json_to_sqlite).collect();
  conn
    .execute(&sql, params_from_iter(sqlite_params.iter()))
    .map_err(|e| format!("SQL execute error: {e}"))?;
  Ok(())
}

// ── Engine process management (G3) ───────────────────────────────────────────

struct EngineProcess {
  stdin: Mutex<Box<dyn Write + Send>>,
  /// Keep the Child handle alive so the process isn't orphaned.
  _child: Arc<Mutex<Child>>,
}

struct EngineState {
  engines: Mutex<HashMap<String, EngineProcess>>,
}

/// Spawn a UCI engine process and start streaming its output as Tauri events.
/// Each stdout line is emitted as `engine://output/{engine_id}` with payload `{ line: "..." }`.
#[tauri::command]
fn spawn_engine(
  app: tauri::AppHandle,
  state: tauri::State<EngineState>,
  engine_id: String,
  path: String,
) -> Result<(), String> {
  let mut child = Command::new(&path)
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::null())
    .spawn()
    .map_err(|e| format!("Failed to spawn engine at {path}: {e}"))?;

  let stdin: Box<dyn Write + Send> = Box::new(
    child.stdin.take().ok_or("Engine stdin not available")?
  );
  let stdout = child.stdout.take().ok_or("Engine stdout not available")?;

  let child_arc = Arc::new(Mutex::new(child));
  let app_handle = app.clone();
  let eid = engine_id.clone();

  // Background thread: read stdout line by line and emit Tauri events.
  thread::spawn(move || {
    let reader = BufReader::new(stdout);
    for line_result in reader.lines() {
      match line_result {
        Ok(line) => {
          let event = format!("engine://output/{eid}");
          let _ = app_handle.emit(&event, serde_json::json!({ "line": line }));
        }
        Err(_) => break,
      }
    }
    // Engine process ended — emit a sentinel event.
    let event = format!("engine://output/{eid}");
    let _ = app_handle.emit(&event, serde_json::json!({ "line": null }));
  });

  let proc = EngineProcess {
    stdin: Mutex::new(stdin),
    _child: child_arc,
  };

  state.engines
    .lock()
    .map_err(|e| e.to_string())?
    .insert(engine_id, proc);

  Ok(())
}

/// Send a UCI command line to a running engine (appends `\n` automatically).
#[tauri::command]
fn send_to_engine(
  state: tauri::State<EngineState>,
  engine_id: String,
  line: String,
) -> Result<(), String> {
  let engines = state.engines.lock().map_err(|e| e.to_string())?;
  let proc = engines.get(&engine_id).ok_or("Engine not found")?;
  let mut stdin = proc.stdin.lock().map_err(|e| e.to_string())?;
  stdin.write_all(line.as_bytes()).map_err(|e| e.to_string())?;
  stdin.write_all(b"\n").map_err(|e| e.to_string())?;
  stdin.flush().map_err(|e| e.to_string())?;
  Ok(())
}

/// Kill a running engine process and remove it from the registry.
#[tauri::command]
fn kill_engine(
  state: tauri::State<EngineState>,
  engine_id: String,
) -> Result<(), String> {
  let mut engines = state.engines.lock().map_err(|e| e.to_string())?;
  if let Some(proc) = engines.remove(&engine_id) {
    if let Ok(mut child) = proc._child.lock() {
      let _ = child.kill();
    }
  }
  Ok(())
}

#[tauri::command]
fn pick_x2chess_file() -> Option<String> {
  rfd::FileDialog::new()
    .add_filter("X2Chess database", &["x2chess"])
    .set_title("Open X2Chess database")
    .pick_file()
    .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
fn create_x2chess_file(suggested_name: String) -> Option<String> {
  let name = if suggested_name.is_empty() {
    "games.x2chess".to_string()
  } else if suggested_name.ends_with(".x2chess") {
    suggested_name
  } else {
    format!("{}.x2chess", suggested_name)
  };
  rfd::FileDialog::new()
    .add_filter("X2Chess database", &["x2chess"])
    .set_file_name(&name)
    .set_title("Create X2Chess database")
    .save_file()
    .map(|path| path.to_string_lossy().to_string())
}

fn main() {
  tauri::Builder::default()
    .manage(DbState { connections: Mutex::new(HashMap::new()) })
    .manage(EngineState { engines: Mutex::new(HashMap::new()) })
    .invoke_handler(tauri::generate_handler![
      detect_default_games_directory,
      pick_games_directory,
      pick_resource_file,
      load_text_file,
      write_text_file,
      list_pgn_files,
      load_game_file,
      save_game_file,
      load_user_config,
      load_player_list,
      save_player_list,
      query_db,
      execute_db,
      pick_x2chess_file,
      create_x2chess_file,
      spawn_engine,
      send_to_engine,
      kill_engine,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
