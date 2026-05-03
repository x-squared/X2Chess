use std::collections::HashMap;
use std::env;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::{Component, Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread;

use rusqlite::types::ValueRef;
use rusqlite::{params_from_iter, Connection};
use serde_json::{json, Value as JsonValue};
use std::sync::atomic::{AtomicU64, Ordering};
use log::{info, warn};
use tauri::{Emitter, Listener, Manager};

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
    // Recover any WAL frames left by a crash or force-quit in the previous session.
    let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
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

/// Open a file-picker dialog for selecting a chess engine executable.
///
/// On macOS, `rfd` must open the sheet on the **application main thread**; Tauri
/// invokes commands on a worker thread, so we schedule the dialog with
/// [`tauri::AppHandle::run_on_main_thread`] and return the path through a channel.
/// Returns the chosen path, or `None` when the user cancels.
#[tauri::command]
fn pick_engine_executable(app: tauri::AppHandle) -> Option<String> {
  info!("pick_engine_executable: schedule native dialog on main thread");
  let (tx, rx) = mpsc::sync_channel::<Option<String>>(1);
  let app_for_dialog: tauri::AppHandle = app.clone();
  if let Err(e) = app.run_on_main_thread(move || {
    info!("pick_engine_executable: main thread — building FileDialog");
    let mut dialog: rfd::FileDialog = rfd::FileDialog::new().set_title("Choose chess engine executable");
    if let Some(window) = app_for_dialog.get_webview_window("main") {
      dialog = dialog.set_parent(&window);
    }
    let picked: Option<String> = dialog
      .pick_file()
      .map(|path| path.to_string_lossy().to_string());
    if picked.is_some() {
      info!("pick_engine_executable: user chose an executable");
    } else {
      info!("pick_engine_executable: dialog closed without selection");
    }
    if tx.send(picked).is_err() {
      warn!("pick_engine_executable: result channel closed before send");
    }
  }) {
    warn!("pick_engine_executable: run_on_main_thread failed: {}", e);
    return None;
  }
  match rx.recv() {
    Ok(path) => path,
    Err(e) => {
      warn!("pick_engine_executable: channel recv failed: {}", e);
      None
    }
  }
}

/// Return the path to a named file in the app config directory (`~/.x2chess/config/`).
/// Creates the directory if it does not exist.
#[tauri::command]
fn get_app_config_path(file_name: String) -> Result<String, String> {
  let home = env::var("HOME")
    .map(PathBuf::from)
    .unwrap_or_else(|_| PathBuf::from("/tmp"));
  let config_dir = home.join(".x2chess").join("config");
  fs::create_dir_all(&config_dir)
    .map_err(|e| format!("Cannot create config directory: {e}"))?;
  Ok(config_dir.join(&file_name).to_string_lossy().to_string())
}

/// Logical CPU count and total installed RAM for engine Hash / Threads tooltip hints (desktop shell).
#[tauri::command]
fn host_hardware_summary() -> JsonValue {
  let logical_processors: u32 = std::thread::available_parallelism()
    .map(|n| n.get() as u32)
    .unwrap_or(1);

  let mut sys = sysinfo::System::new();
  sys.refresh_memory();
  let total_memory_bytes: u64 = sys.total_memory();
  let total_memory_megabytes: u64 = total_memory_bytes / (1024 * 1024);

  json!({
    "logicalProcessors": logical_processors,
    "totalMemoryMegabytes": total_memory_megabytes,
  })
}

/// Write the engines.json configuration file to `~/.x2chess/config/engines.json`.
#[tauri::command]
fn save_engines_config(content: String) -> Result<(), String> {
  let home = env::var("HOME")
    .map(PathBuf::from)
    .unwrap_or_else(|_| PathBuf::from("/tmp"));
  let config_dir = home.join(".x2chess").join("config");
  fs::create_dir_all(&config_dir)
    .map_err(|e| format!("Cannot create config directory: {e}"))?;
  fs::write(config_dir.join("engines.json"), content)
    .map_err(|e| format!("Unable to save engines config: {e}"))
}

/// Reveal a file path in the system file manager (Finder on macOS, Explorer on Windows).
#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
  #[cfg(target_os = "macos")]
  let result = std::process::Command::new("open").args(["-R", &path]).spawn();
  #[cfg(target_os = "windows")]
  let result = std::process::Command::new("explorer")
    .args(["/select,", &path])
    .spawn();
  #[cfg(not(any(target_os = "macos", target_os = "windows")))]
  let result = {
    let parent = Path::new(&path).parent().unwrap_or(Path::new("/"));
    std::process::Command::new("xdg-open").arg(parent).spawn()
  };
  result.map(|_| ()).map_err(|e| format!("Failed to reveal in file manager: {e}"))
}

/// PATH merged with common install locations. GUI apps on macOS often omit Homebrew/MacPorts.
fn merged_path_for_engine_probe() -> String {
  #[cfg(target_os = "windows")]
  {
    let mut segments: Vec<String> = Vec::new();
    if let Ok(profile) = env::var("USERPROFILE") {
      segments.push(format!(r"{profile}\scoop\shims"));
      segments.push(format!(r"{profile}\.local\bin"));
    }
    if let Ok(existing) = env::var("PATH") {
      segments.push(existing);
    }
    segments.join(";")
  }
  #[cfg(not(target_os = "windows"))]
  {
    let mut segments: Vec<String> = Vec::new();
    for p in [
      "/opt/homebrew/bin",
      "/usr/local/bin",
      "/opt/local/bin",
      "/usr/bin",
      "/bin",
    ] {
      segments.push(p.to_string());
    }
    if let Ok(home) = env::var("HOME") {
      segments.push(format!("{home}/.local/bin"));
      segments.push(format!("{home}/bin"));
    }
    if let Ok(existing) = env::var("PATH") {
      segments.push(existing);
    }
    segments.join(":")
  }
}

#[cfg(target_family = "unix")]
fn resolve_exe_via_which(cmd: &str) -> Option<String> {
  let path_env: String = merged_path_for_engine_probe();
  let output = Command::new("/bin/sh")
    .env("PATH", &path_env)
    .arg("-c")
    .arg(format!("command -v {cmd}"))
    .output()
    .ok()?;
  if !output.status.success() {
    return None;
  }
  let resolved: String = String::from_utf8_lossy(&output.stdout).trim().to_string();
  if resolved.is_empty() {
    return None;
  }
  if Path::new(&resolved).is_file() {
    return Some(resolved);
  }
  None
}

#[cfg(target_os = "windows")]
fn resolve_exe_via_which(cmd: &str) -> Option<String> {
  let path_env: String = merged_path_for_engine_probe();
  let output = Command::new("where.exe")
    .env("PATH", &path_env)
    .arg(cmd)
    .output()
    .ok()?;
  if !output.status.success() {
    return None;
  }
  let line: Option<&str> = String::from_utf8_lossy(&output.stdout).lines().next();
  let resolved: String = line?.trim().to_string();
  if resolved.is_empty() {
    return None;
  }
  if Path::new(&resolved).is_file() {
    return Some(resolved);
  }
  None
}

/// Probe well-known locations for UCI chess engines and return any found.
/// Runs `which` with an enriched PATH (GUI apps on macOS often lack `/opt/homebrew/bin`).
#[tauri::command]
fn detect_engines() -> Vec<serde_json::Value> {
  let mut found: Vec<serde_json::Value> = Vec::new();

  // PATH lookups (same basename may appear under Homebrew / MacPorts / user ~/bin).
  for (cmd, name) in [("stockfish", "Stockfish"), ("lc0", "Leela Chess Zero")] {
    if let Some(path) = resolve_exe_via_which(cmd) {
      let already = found.iter().any(|e| e["path"].as_str() == Some(path.as_str()));
      if !already {
        found.push(serde_json::json!({ "path": path, "name": name }));
      }
    }
  }

  // Hard-coded fallbacks when `which` misses symlinks or unusual installs.
  let candidates = [
    ("/opt/homebrew/bin/stockfish", "Stockfish"),
    ("/usr/local/bin/stockfish", "Stockfish"),
    ("/opt/local/bin/stockfish", "Stockfish"),
    ("/usr/bin/stockfish", "Stockfish"),
    ("/opt/homebrew/bin/lc0", "Leela Chess Zero"),
    ("/usr/local/bin/lc0", "Leela Chess Zero"),
    ("/opt/local/bin/lc0", "Leela Chess Zero"),
  ];
  for (path, name) in &candidates {
    if Path::new(path).is_file() {
      let already = found.iter().any(|e| e["path"].as_str() == Some(path));
      if !already {
        found.push(serde_json::json!({ "path": path, "name": name }));
      }
    }
  }

  found
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

#[tauri::command]
fn create_pgn_file(suggested_name: String) -> Option<String> {
  let name = if suggested_name.is_empty() {
    "games.pgn".to_string()
  } else if suggested_name.ends_with(".pgn") {
    suggested_name
  } else {
    format!("{}.pgn", suggested_name)
  };
  rfd::FileDialog::new()
    .add_filter("PGN file", &["pgn"])
    .set_file_name(&name)
    .set_title("Create PGN file")
    .save_file()
    .map(|path| path.to_string_lossy().to_string())
}

// ── Webview storage export / import dialogs ───────────────────────────────────

/// Open a save-file dialog for the storage export JSON file.
///
/// Returns the chosen path, or `None` when the user cancels.
#[tauri::command]
fn pick_storage_export_file() -> Option<String> {
  rfd::FileDialog::new()
    .add_filter("JSON", &["json"])
    .set_file_name("x2chess-storage.json")
    .set_title("Export Webview Storage")
    .save_file()
    .map(|path| path.to_string_lossy().to_string())
}

/// Open an open-file dialog for importing a storage JSON file.
///
/// Returns the chosen path, or `None` when the user cancels.
#[tauri::command]
fn pick_storage_import_file() -> Option<String> {
  rfd::FileDialog::new()
    .add_filter("JSON", &["json"])
    .set_title("Import Webview Storage")
    .pick_file()
    .map(|path| path.to_string_lossy().to_string())
}

// ── Browser panel WebviewWindow (W4 — Tier 3 web import) ─────────────────────

const BROWSER_WINDOW_LABEL: &str = "browser";

/// Open a browser panel window navigating to the given URL.
///
/// If a browser window is already open, navigates it to the new URL instead of
/// creating a second window.  Returns an error if the URL is invalid or the
/// window cannot be created.
#[tauri::command]
fn open_browser_window(app: tauri::AppHandle, url: String) -> Result<(), String> {
  let parsed = tauri::Url::parse(&url).map_err(|e| format!("Invalid URL: {e}"))?;

  if let Some(existing) = app.get_webview_window(BROWSER_WINDOW_LABEL) {
    // Navigate the existing window to the new URL.
    existing
      .navigate(parsed)
      .map_err(|e| format!("Navigation failed: {e}"))
  } else {
    tauri::WebviewWindowBuilder::new(
      &app,
      BROWSER_WINDOW_LABEL,
      tauri::WebviewUrl::External(parsed),
    )
    .title("X2Chess — Browser")
    .inner_size(960.0, 740.0)
    .build()
    .map(|_| ())
    .map_err(|e| format!("Failed to open browser window: {e}"))
  }
}

/// Open the WebKit Web Inspector for the main window.
///
/// Active only in debug builds (or when the `devtools` feature is enabled).
/// No-op in release builds without that feature.
#[tauri::command]
fn open_devtools(app: tauri::AppHandle) {
  #[cfg(any(debug_assertions, feature = "devtools"))]
  if let Some(window) = app.get_webview_window("main") {
    window.open_devtools();
  }
}

/// Open a URL in the system default browser.
///
/// Validates that the URL is http/https before handing off to the OS launcher
/// so the caller cannot use this as an arbitrary command runner.
#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
  if !url.starts_with("http://") && !url.starts_with("https://") {
    return Err("Only http/https URLs are supported".to_string());
  }
  #[cfg(target_os = "macos")]
  let result = std::process::Command::new("open").arg(&url).spawn();
  #[cfg(target_os = "windows")]
  let result = std::process::Command::new("rundll32")
    .args(["url.dll,FileProtocolHandler", url.as_str()])
    .spawn();
  #[cfg(not(any(target_os = "macos", target_os = "windows")))]
  let result = std::process::Command::new("xdg-open").arg(&url).spawn();
  result.map(|_| ()).map_err(|e| format!("Failed to open URL: {e}"))
}

/// Close the browser panel window.  No-op if it is not open.
#[tauri::command]
fn close_browser_window(app: tauri::AppHandle) -> Result<(), String> {
  if let Some(window) = app.get_webview_window(BROWSER_WINDOW_LABEL) {
    window.close().map_err(|e| e.to_string())
  } else {
    Ok(())
  }
}

/// Navigate the browser window to a new URL.
#[tauri::command]
fn browser_window_navigate(app: tauri::AppHandle, url: String) -> Result<(), String> {
  let window = app
    .get_webview_window(BROWSER_WINDOW_LABEL)
    .ok_or_else(|| "Browser window is not open".to_string())?;
  let parsed = tauri::Url::parse(&url).map_err(|e| format!("Invalid URL: {e}"))?;
  window.navigate(parsed).map_err(|e| e.to_string())
}

/// Navigate back in the browser window's session history.
#[tauri::command]
fn browser_window_go_back(app: tauri::AppHandle) -> Result<(), String> {
  let window = app
    .get_webview_window(BROWSER_WINDOW_LABEL)
    .ok_or_else(|| "Browser window is not open".to_string())?;
  window.eval("history.back()").map_err(|e| e.to_string())
}

/// Navigate forward in the browser window's session history.
#[tauri::command]
fn browser_window_go_forward(app: tauri::AppHandle) -> Result<(), String> {
  let window = app
    .get_webview_window(BROWSER_WINDOW_LABEL)
    .ok_or_else(|| "Browser window is not open".to_string())?;
  window.eval("history.forward()").map_err(|e| e.to_string())
}

/// Reload the current page in the browser window.
#[tauri::command]
fn browser_window_reload(app: tauri::AppHandle) -> Result<(), String> {
  let window = app
    .get_webview_window(BROWSER_WINDOW_LABEL)
    .ok_or_else(|| "Browser window is not open".to_string())?;
  window.eval("location.reload()").map_err(|e| e.to_string())
}

/// Evaluate a JS capture expression in the browser window and return the result.
///
/// `script` must be a short JS expression returning a FEN or PGN string, or
/// `null`/`undefined`.  The result is returned as a Rust `Option<String>`:
/// `Some(value)` on success, `None` if the script returned null/undefined.
///
/// Times out after 10 seconds if the script does not resolve.
#[tauri::command]
async fn browser_window_capture(
  app: tauri::AppHandle,
  script: String,
) -> Result<Option<String>, String> {
  let window = app
    .get_webview_window(BROWSER_WINDOW_LABEL)
    .ok_or_else(|| "Browser window is not open".to_string())?;

  // `evaluate_script_with_callback` is not yet exposed by Tauri 2 at the
  // WebviewWindow level.  Workaround: register a one-shot Rust event listener,
  // then eval a JS snippet that runs the capture expression and signals the
  // result back via `window.__TAURI_INTERNALS__.invoke("plugin:event|emit", …)`.
  // __TAURI_INTERNALS__ is injected into all webviews (including external ones).
  static CAPTURE_SEQ: AtomicU64 = AtomicU64::new(0);
  let seq = CAPTURE_SEQ.fetch_add(1, Ordering::Relaxed);
  let event_name = format!("x2chess://capture/{seq}");
  let event_name_json = serde_json::to_string(&event_name)
    .map_err(|e| format!("Event name serialisation failed: {e}"))?;

  let (tx, rx) = tokio::sync::oneshot::channel::<String>();
  let tx = Arc::new(Mutex::new(Some(tx)));

  let event_id = window.once(event_name.clone(), move |event| {
    if let Ok(mut guard) = tx.lock() {
      if let Some(sender) = guard.take() {
        let _ = sender.send(event.payload().to_string());
      }
    }
  });

  // Wrap the user-supplied expression so async expressions are supported and
  // errors are caught, always delivering a JSON-serialised string or null.
  let js = format!(
    "(async()=>{{ \
       try {{ \
         const r=await({script}); \
         const v=r!=null?JSON.stringify(String(r)):'null'; \
         window.__TAURI_INTERNALS__.invoke('plugin:event|emit',{{event:{event_name_json},payload:v}}); \
       }} catch(e) {{ \
         window.__TAURI_INTERNALS__.invoke('plugin:event|emit',{{event:{event_name_json},payload:'null'}}); \
       }} \
     }})()"
  );

  if let Err(e) = window.eval(&js) {
    window.unlisten(event_id);
    return Err(format!("Failed to evaluate capture script: {e}"));
  }

  let raw = match tokio::time::timeout(std::time::Duration::from_secs(10), rx).await {
    Ok(Ok(v)) => v,
    Ok(Err(_)) => return Err("Capture channel closed unexpectedly".to_string()),
    Err(_) => {
      window.unlisten(event_id);
      return Err("Capture script timed out after 10 seconds".to_string());
    }
  };

  // The event payload is a JSON-encoded string (or the literal "null").
  let value: serde_json::Value =
    serde_json::from_str(&raw).unwrap_or(serde_json::Value::Null);
  Ok(value.as_str().map(|s| s.to_string()))
}

// ── Native HTTP (Tier 2 web import) ──────────────────────────────────────────

/// Make an HTTP GET request from the OS network stack (no CORS restrictions).
///
/// Used by the Tier 2 web import path to fetch chess site HTML with a realistic
/// browser User-Agent, bypassing 403 errors that reject headless browser fetches.
///
/// Returns the raw response body as a UTF-8 string, or an error string.
#[tauri::command]
async fn native_http_get(
  url: String,
  headers: HashMap<String, String>,
) -> Result<String, String> {
  let client = reqwest::Client::builder()
    .build()
    .map_err(|e| format!("HTTP client error: {e}"))?;
  let mut request = client.get(&url);
  for (key, value) in &headers {
    request = request.header(key.as_str(), value.as_str());
  }
  let response = request
    .send()
    .await
    .map_err(|e| format!("HTTP request failed: {e}"))?;
  let status = response.status();
  if !status.is_success() {
    return Err(format!("HTTP {}", status.as_u16()));
  }
  response
    .text()
    .await
    .map_err(|e| format!("Failed to read response body: {e}"))
}

fn main() {
  tauri::Builder::default()
    .plugin(
      tauri_plugin_log::Builder::new()
        .level(if cfg!(debug_assertions) {
          log::LevelFilter::Debug
        } else {
          log::LevelFilter::Info
        })
        // Strip the JS call-site URL from webview log targets.
        // Raw target looks like "webview:info@http://localhost:5287/node_modules/...".
        // We keep only the part before the "@" (e.g. "webview:info").
        .format(|out, message, record| {
          let target = record.target();
          let short_target = target.split('@').next().unwrap_or(target);
          out.finish(format_args!(
            "[{}][{}][{}] {}",
            chrono::Local::now().format("%Y-%m-%d"),
            chrono::Local::now().format("%H:%M:%S"),
            short_target,
            message,
          ))
        })
        .build(),
    )
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .manage(DbState { connections: Mutex::new(HashMap::new()) })
    .manage(EngineState { engines: Mutex::new(HashMap::new()) })
    .setup(|app| {
      // Build the main window programmatically so we can optionally redirect all
      // webview storage (localStorage, IndexedDB, cache) to a user-defined path.
      //
      // Set X2CHESS_WEBVIEW_DATA to any directory path to isolate storage from
      // the OS default (~Library/WebKit/com.x2chess.app on macOS).  Useful for
      // keeping a separate DEV profile that does not pollute the PROD data store.
      //
      // Example (from npm script or shell):
      //   X2CHESS_WEBVIEW_DATA=../run/DEV/webview-data  tauri dev
      let mut builder = tauri::WebviewWindowBuilder::new(
        app,
        "main",
        tauri::WebviewUrl::App("index.html".into()),
      )
      .title("X2Chess")
      .inner_size(1400.0, 1060.0)
      .min_inner_size(980.0, 820.0)
      // Disable Tauri's built-in file-drop interception so the web layer handles
      // drop events directly (equivalent to dragDropEnabled: false in tauri.conf.json).
      .disable_drag_drop_handler();

      if let Ok(raw) = env::var("X2CHESS_WEBVIEW_DATA") {
        let data_dir = PathBuf::from(&raw);
        if let Err(e) = fs::create_dir_all(&data_dir) {
          warn!("Could not create X2CHESS_WEBVIEW_DATA directory {:?}: {}", raw, e);
        } else {
          // WebKit on macOS requires an *absolute* path; canonicalize resolves
          // relative segments (e.g. "../../run/DEV/webview-data") so storage is
          // actually redirected instead of silently falling back to the OS default.
          match fs::canonicalize(&data_dir) {
            Ok(abs_dir) => {
              info!("Webview data directory: {}", abs_dir.display());
              builder = builder.data_directory(abs_dir);
            }
            Err(e) => {
              warn!("Could not canonicalize X2CHESS_WEBVIEW_DATA {:?}: {}", raw, e);
            }
          }
        }
      }

      let window = builder.build()?;

      // Checkpoint all open SQLite databases when the main window is destroyed so
      // that the WAL and SHM sidecar files are eliminated on a clean exit.
      let checkpoint_handle = app.handle().clone();
      window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
          let state = checkpoint_handle.state::<DbState>();
          let Ok(guard) = state.connections.lock() else { return; };
          for (path, conn) in guard.iter() {
            // Switching to DELETE journal mode checkpoints the WAL and removes
            // both the -wal and -shm sidecar files.  We switch back to WAL on
            // the next open, so this only affects the on-disk journal-mode flag.
            if let Err(e) = conn.execute_batch("PRAGMA journal_mode=DELETE;") {
              warn!("WAL cleanup failed for {}: {}", path, e);
            } else {
              info!("WAL cleaned up for {}", path);
            }
          }
        }
      });

      // Open the WebKit inspector before any JS runs when X2CHESS_OPEN_DEVTOOLS is set.
      // Only active in debug builds.
      #[cfg(debug_assertions)]
      if env::var("X2CHESS_OPEN_DEVTOOLS").is_ok() {
        window.open_devtools();
      }
      Ok(())
    })
    // Custom commands: add each new `#[tauri::command]` to `permissions/app-commands.toml` (Tauri 2 ACL).
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
      query_db,
      execute_db,
      pick_x2chess_file,
      create_x2chess_file,
      create_pgn_file,
      pick_storage_export_file,
      pick_storage_import_file,
      spawn_engine,
      send_to_engine,
      kill_engine,
      pick_engine_executable,
      get_app_config_path,
      host_hardware_summary,
      save_engines_config,
      reveal_in_finder,
      detect_engines,
      native_http_get,
      open_external_url,
      open_devtools,
      open_browser_window,
      close_browser_window,
      browser_window_navigate,
      browser_window_go_back,
      browser_window_go_forward,
      browser_window_reload,
      browser_window_capture,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
