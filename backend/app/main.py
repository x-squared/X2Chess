import json
import os
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="X2Chess")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5287",
        "http://127.0.0.1:5287",
        "tauri://localhost",
        "null",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_RUN_ROOT = REPO_ROOT / "run"
DEFAULT_SCENARIOS = ("DEV", "TEST")
KNOWN_SCENARIOS = (*DEFAULT_SCENARIOS, "PROD")
APP_NAME = "X2Chess"


def _resolve_run_root() -> Path:
    configured = os.getenv("X2CHESS_RUN_ROOT", "").strip()
    if not configured:
        return DEFAULT_RUN_ROOT
    root = Path(configured).expanduser()
    if not root.is_absolute():
        root = (REPO_ROOT / root).resolve()
    return root


def _resolve_run_scenario() -> str:
    scenario = os.getenv("X2CHESS_RUN_SCENARIO", "DEV").strip().upper()
    return scenario or "DEV"


RUN_SCENARIO = _resolve_run_scenario()
RUN_SCENARIO_RECOGNIZED = RUN_SCENARIO in KNOWN_SCENARIOS


def _resolve_production_data_root() -> Path:
    explicit = os.getenv("X2CHESS_PROD_DATA_ROOT", "").strip()
    if explicit:
        root = Path(explicit).expanduser()
        if not root.is_absolute():
            root = (REPO_ROOT / root).resolve()
        return root
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / APP_NAME
    if sys.platform.startswith("win"):
        app_data = os.getenv("APPDATA") or os.getenv("LOCALAPPDATA")
        if app_data:
            return Path(app_data) / APP_NAME
        return Path.home() / "AppData" / "Roaming" / APP_NAME
    xdg_data_home = os.getenv("XDG_DATA_HOME", "").strip()
    if xdg_data_home:
        return Path(xdg_data_home).expanduser() / APP_NAME
    return Path.home() / ".local" / "share" / APP_NAME


def _resolve_runtime_paths():
    if RUN_SCENARIO == "PROD":
        prod_root = _resolve_production_data_root()
        return prod_root, prod_root
    run_root = _resolve_run_root()
    return run_root, run_root / RUN_SCENARIO


RUN_ROOT, RUN_DIR = _resolve_runtime_paths()
RUN_DIR_MODE = "os-app-data" if RUN_SCENARIO == "PROD" else "repo-run-root"
GAMES_DIR = RUN_DIR / "games"
CONFIG_DIR = RUN_DIR / "config"
DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent / "default-config.json"
USER_CONFIG_PATH = CONFIG_DIR / "user-config.json"
BACKEND_FILE_IO_ENABLED = RUN_SCENARIO in DEFAULT_SCENARIOS


class GameWritePayload(BaseModel):
    content: str


def _resolve_game_path(game_name: str, *, must_exist: bool) -> Path:
    normalized = Path(game_name).name
    if normalized != game_name:
        raise HTTPException(status_code=400, detail="Invalid game file name.")
    safe_name = normalized if normalized.lower().endswith(".pgn") else f"{normalized}.pgn"
    game_path = (GAMES_DIR / safe_name).resolve()
    try:
        game_path.relative_to(GAMES_DIR.resolve())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid game file path.") from exc
    if must_exist and not game_path.exists():
        raise HTTPException(status_code=404, detail=f"Game not found: {safe_name}")
    return game_path


def _ensure_backend_file_io_enabled() -> None:
    if BACKEND_FILE_IO_ENABLED:
        return
    raise HTTPException(
        status_code=403,
        detail=(
            "Backend file I/O endpoints are disabled for this scenario. "
            "Use DEV/TEST for local development file access."
        ),
    )


def _load_json_file(path: Path) -> dict:
    try:
        content = path.read_text(encoding="utf-8")
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {path}: {exc}") from exc
    if not isinstance(parsed, dict):
        raise ValueError(f"JSON root must be an object in {path}")
    return parsed


def _deep_merge_dict(base: dict, override: dict) -> dict:
    merged = dict(base)
    for key, value in override.items():
        if (
            key in merged
            and isinstance(merged[key], dict)
            and isinstance(value, dict)
        ):
            merged[key] = _deep_merge_dict(merged[key], value)
        else:
            merged[key] = value
    return merged


def _resolve_runtime_config():
    default_config = _load_json_file(DEFAULT_CONFIG_PATH)
    user_config_exists = USER_CONFIG_PATH.exists()
    user_config_error = None
    user_config = {}
    if user_config_exists:
        try:
            user_config = _load_json_file(USER_CONFIG_PATH)
        except ValueError as exc:
            user_config_error = str(exc)
            user_config = {}
    resolved = _deep_merge_dict(default_config, user_config)
    return {
        "default": default_config,
        "user": user_config,
        "resolved": resolved,
        "user_exists": user_config_exists,
        "user_error": user_config_error,
    }


@app.on_event("startup")
def ensure_run_directories() -> None:
    RUN_ROOT.mkdir(parents=True, exist_ok=True)
    if RUN_SCENARIO != "PROD":
        for scenario in DEFAULT_SCENARIOS:
            (RUN_ROOT / scenario).mkdir(parents=True, exist_ok=True)
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    GAMES_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    if not DEFAULT_CONFIG_PATH.exists():
        raise RuntimeError(f"Missing default config file: {DEFAULT_CONFIG_PATH}")
    scenario_kind = "recognized" if RUN_SCENARIO_RECOGNIZED else "custom"
    print(
        f"[X2Chess] Runtime data directory: {RUN_DIR} "
        f"(scenario={RUN_SCENARIO}, type={scenario_kind}, mode={RUN_DIR_MODE})"
    )


@app.get("/health")
def health():
    return {
        "ok": True,
        "app": "X2Chess",
        "run_root": str(RUN_ROOT),
        "run_scenario": RUN_SCENARIO,
        "run_dir": str(RUN_DIR),
        "run_scenario_recognized": RUN_SCENARIO_RECOGNIZED,
        "run_scenario_type": "recognized" if RUN_SCENARIO_RECOGNIZED else "custom",
        "run_dir_mode": RUN_DIR_MODE,
        "backend_file_io_enabled": BACKEND_FILE_IO_ENABLED,
        "games_dir": str(GAMES_DIR),
        "config_dir": str(CONFIG_DIR),
        "default_config_path": str(DEFAULT_CONFIG_PATH),
        "user_config_path": str(USER_CONFIG_PATH),
    }


@app.get("/games")
def list_games():
    _ensure_backend_file_io_enabled()
    games = sorted(
        [
            {"name": path.name, "size_bytes": path.stat().st_size}
            for path in GAMES_DIR.glob("*.pgn")
            if path.is_file()
        ],
        key=lambda item: item["name"].lower(),
    )
    return {
        "scenario": RUN_SCENARIO,
        "games_dir": str(GAMES_DIR),
        "games": games,
    }


@app.get("/games/{game_name}")
def read_game(game_name: str):
    _ensure_backend_file_io_enabled()
    game_path = _resolve_game_path(game_name, must_exist=True)
    return {
        "name": game_path.name,
        "content": game_path.read_text(encoding="utf-8"),
    }


@app.put("/games/{game_name}")
def write_game(game_name: str, payload: GameWritePayload):
    _ensure_backend_file_io_enabled()
    game_path = _resolve_game_path(game_name, must_exist=False)
    game_path.parent.mkdir(parents=True, exist_ok=True)
    game_path.write_text(payload.content, encoding="utf-8")
    return {
        "ok": True,
        "name": game_path.name,
        "bytes_written": len(payload.content.encode("utf-8")),
    }


@app.get("/config")
def get_config():
    _ensure_backend_file_io_enabled()
    resolved = _resolve_runtime_config()
    return {
        "scenario": RUN_SCENARIO,
        "default_config_path": str(DEFAULT_CONFIG_PATH),
        "user_config_path": str(USER_CONFIG_PATH),
        "user_config_exists": resolved["user_exists"],
        "user_config_error": resolved["user_error"],
        "config": resolved["resolved"],
    }
