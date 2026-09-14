#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::{Emitter, Manager, State, WindowEvent};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Fixed port shared with the web client default (`http://localhost:4096`).
const SIDECAR_PORT: &str = "4096";

/// Args must match the `shell:allow-spawn` scope in
/// `capabilities/default.json` EXACTLY (order included).
fn sidecar_args() -> Vec<&'static str> {
    vec![
        "serve",
        "--port",
        SIDECAR_PORT,
        "--hostname",
        "127.0.0.1",
        "--cors",
        "tauri://localhost",
        "--cors",
        "http://tauri.localhost",
        "--cors",
        "http://localhost:5173",
    ]
}

struct SidecarState(Mutex<Option<CommandChild>>);
/// Folder path or `rudra://` URL from the first-launch CLI args, consumed
/// by the frontend once its listeners are attached.
struct StartupState(Mutex<Option<String>>);

fn kill_sidecar(state: &State<SidecarState>) {
    if let Some(child) = state.0.lock().expect("sidecar mutex poisoned").take() {
        if let Err(err) = child.kill() {
            eprintln!("[rudra] failed to kill opencode sidecar: {err}");
        }
    }
}

fn is_folder_arg(arg: &str) -> bool {
    !arg.starts_with("rudra://") && std::path::Path::new(arg).is_dir()
}

/// First interesting CLI arg: a `rudra://` URL (protocol/second launch) or
/// an existing folder ("Open with RUDRA" / terminal launch).
fn startup_open_target() -> Option<String> {
    std::env::args()
        .skip(1)
        .find(|a| a.starts_with("rudra://") || is_folder_arg(a))
}

// ---------------------------------------------------------------------------
// Tauri commands (the only IPC surface the frontend uses; all plugin calls
// stay Rust-side, so no extra capability entries are required).
// ---------------------------------------------------------------------------

/// Native folder picker (Phase 5.1). Returns None on cancel.
#[tauri::command]
async fn pick_workspace_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_title("Open folder in RUDRA")
        .pick_folder(move |picked| {
            let _ = tx.send(picked);
        });
    let picked = rx.await.map_err(|err| err.to_string())?;
    Ok(picked.map(|p| p.to_string()))
}

/// Native OS notification for a finished long turn (Phase 5.3).
#[tauri::command]
fn notify_turn_complete(app: tauri::AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|err| err.to_string())
}

#[derive(serde::Serialize)]
struct UpdateStatus {
    state: String,
    version: Option<String>,
    detail: Option<String>,
}

/// Check the updater feed, download+install when available (Phase 5.4).
/// The frontend formats `state` via its own i18n strings.
#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> UpdateStatus {
    use tauri_plugin_updater::UpdaterExt;
    let fail = |detail: String| UpdateStatus {
        state: "error".to_string(),
        version: None,
        detail: Some(detail),
    };
    let updater = match app.updater() {
        Ok(u) => u,
        Err(err) => return fail(format!("updater unavailable: {err}")),
    };
    match updater.check().await {
        Err(err) => fail(format!("update check failed: {err}")),
        Ok(None) => UpdateStatus {
            state: "uptodate".to_string(),
            version: Some(app.package_info().version.to_string()),
            detail: None,
        },
        Ok(Some(update)) => {
            let version = update.version.clone();
            match update.download_and_install(|_, _| {}, || {}).await {
                Err(err) => fail(format!("download failed: {err}")),
                Ok(_) => {
                    let _ = app.emit("rudra-update-installed", &version);
                    UpdateStatus {
                        state: "downloaded".to_string(),
                        version: Some(version),
                        detail: None,
                    }
                }
            }
        }
    }
}

/// One-shot handoff of the first-launch open target (Phase 5.6).
#[tauri::command]
fn take_startup_path(state: State<StartupState>) -> Option<String> {
    state.0.lock().expect("startup mutex poisoned").take()
}

/// Open a folder (or a file's parent) in the OS file manager:
/// Explorer on Windows, Finder on macOS, xdg-open on Linux.
/// Used by "Reveal in file manager" / "Open folder" actions.
#[tauri::command]
fn open_path_in_file_manager(path: String) -> Result<(), String> {
    use std::process::Command;
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("empty path".to_string());
    }
    let target = std::path::Path::new(trimmed);
    // If given a file, reveal its parent; otherwise open the dir itself.
    let dir: &std::path::Path = if target.is_file() {
        target.parent().unwrap_or(target)
    } else {
        target
    };
    #[cfg(target_os = "windows")]
    {
        // `explorer /select,<file>` highlights the file; for dirs just open.
        if target.is_file() {
            Command::new("explorer")
                .arg(format!("/select,{}", target.display()))
                .spawn()
                .map_err(|err| err.to_string())?;
        } else {
            Command::new("explorer")
                .arg(dir)
                .spawn()
                .map_err(|err| err.to_string())?;
        }
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        let mut cmd = Command::new("open");
        if target.is_file() {
            cmd.arg("-R").arg(target);
        } else {
            cmd.arg(dir);
        }
        cmd.spawn().map_err(|err| err.to_string())?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(dir)
            .spawn()
            .map_err(|err| err.to_string())?;
        return Ok(());
    }
}

// ---------------------------------------------------------------------------
// Tray (Phase 5.2)
// ---------------------------------------------------------------------------

fn build_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    let new_session = MenuItem::with_id(app, "tray-new-session", "New Session", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "tray-quit", "Quit RUDRA", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&new_session, &quit])?;
    let icon = app
        .default_window_icon()
        .cloned()
        .expect("main window icon missing");

    TrayIconBuilder::with_id("main")
        .icon(icon)
        .tooltip("RUDRA AI — The storm that writes code.")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "tray-new-session" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("tray-new-session", ());
                }
            }
            "tray-quit" => {
                kill_sidecar(&app.state::<SidecarState>());
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(true) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // Second launch (protocol URL, folder arg, or plain re-open):
            // focus the running window and forward open-targets.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
                if let Some(target) = args
                    .iter()
                    .skip(1)
                    .find(|a| a.starts_with("rudra://") || is_folder_arg(a))
                {
                    if target.starts_with("rudra://") {
                        let _ = window.emit("rudra-open-url", target);
                    } else {
                        let _ = window.emit("rudra-open-path", target);
                    }
                }
            }
        }))
        .manage(SidecarState(Mutex::new(None)))
        .manage(StartupState(Mutex::new(startup_open_target())))
        .invoke_handler(tauri::generate_handler![
            pick_workspace_folder,
            notify_turn_complete,
            check_for_updates,
            take_startup_path,
            open_path_in_file_manager
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                if let Err(err) = app.deep_link().register("rudra") {
                    eprintln!("[rudra] deep-link registration failed: {err}");
                }
            }
            if let Err(err) = build_tray(app.handle()) {
                eprintln!("[rudra] tray setup failed: {err}");
            }
            let args: Vec<String> = sidecar_args().iter().map(|s| s.to_string()).collect();
            match app.shell().sidecar("opencode") {
                Ok(cmd) => match cmd.args(args).spawn() {
                    Ok((mut rx, child)) => {
                        *app
                            .state::<SidecarState>()
                            .0
                            .lock()
                            .expect("sidecar mutex poisoned") = Some(child);
                        // Drain sidecar stdout/stderr so a blocked pipe can
                        // never stall it; surface output in the Rust log.
                        tauri::async_runtime::spawn(async move {
                            while let Some(event) = rx.recv().await {
                                match event {
                                    CommandEvent::Stdout(line) => {
                                        eprintln!("[opencode] {}", String::from_utf8_lossy(&line));
                                    }
                                    CommandEvent::Stderr(line) => {
                                        eprintln!("[opencode:err] {}", String::from_utf8_lossy(&line));
                                    }
                                    _ => {}
                                }
                            }
                        });
                        eprintln!("[rudra] opencode sidecar spawned on 127.0.0.1:{SIDECAR_PORT}");
                    }
                    Err(err) => {
                        eprintln!(
                            "[rudra] could not spawn opencode sidecar (is another server on :{SIDECAR_PORT}?): {err}"
                        );
                    }
                },
                Err(err) => {
                    eprintln!("[rudra] sidecar binary 'opencode' not found in bundle: {err}");
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                kill_sidecar(&window.state::<SidecarState>());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
