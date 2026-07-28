/**
 * BloomMountain desktop shell — the app IS the terminal.
 * Electron window hosting xterm.js, wired to the Ink TUI through a pty.
 */
const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, shell } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const { execSync } = require("node:child_process");
const path = require("node:path");
const pty = require("node-pty");

const SMOKE = process.argv.includes("--smoke");
// with asar disabled, packaged files live in Contents/Resources/app
const ROOT = app.isPackaged ? path.join(process.resourcesPath, "app") : path.join(__dirname, "..");

let win = null;
let ptyShell = null;
let tray = null;
let settingsWin = null;

const UPDATE_REPO = "davidcoallier/bloommountain";
const CFG_DIR = path.join(os.homedir(), ".config", "bloommountain");

/** GUI apps get a bare PATH — recover the login-shell one so claude/ant resolve. */
function loginPath() {
  const extras = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
  try {
    const p = execSync("/bin/zsh -ilc 'echo -n $PATH'", { timeout: 4000 }).toString().trim();
    return p ? `${p}:${extras}` : extras;
  } catch {
    return `${process.env.PATH ?? ""}:${extras}`;
  }
}

function startPty(cols, rows) {
  if (ptyShell) return;
  ptyShell = pty.spawn(
    process.execPath,
    [path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs"), path.join(ROOT, "src", "cli.tsx")],
    {
      name: "xterm-256color",
      cols,
      rows,
      cwd: ROOT,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        PATH: loginPath(),
        TERM: "xterm-256color",
        FORCE_COLOR: "3",
        COLORTERM: "truecolor",
      },
    },
  );
  let smokeBytes = 0;
  ptyShell.onData((data) => {
    win?.webContents.send("pty:data", data);
    if (SMOKE) {
      smokeBytes += data.length;
      if (smokeBytes > 2000) {
        console.log(`SMOKE-OK pty produced ${smokeBytes} bytes`);
        app.exit(0);
      }
    }
  });
  ptyShell.onExit(() => {
    ptyShell = null;
    if (!SMOKE) app.quit(); // user typed QUIT in the TUI
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: "#000000",
    title: "BloomMountain",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, "renderer.html"));
  win.on("closed", () => {
    win = null;
    ptyShell?.kill();
    ptyShell = null;
  });
}

ipcMain.on("pty:start", (_e, { cols, rows }) => startPty(cols, rows));
ipcMain.on("pty:input", (_e, data) => ptyShell?.write(data));
ipcMain.on("pty:resize", (_e, { cols, rows }) => {
  try {
    ptyShell?.resize(cols, rows);
  } catch {
    /* pty may be closing */
  }
});

/* ── settings window (tray → AI Settings…) ─────────────────────── */

function openSettings() {
  if (settingsWin) {
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 520,
    height: 620,
    resizable: false,
    backgroundColor: "#000000",
    title: "Bloom Settings",
    webPreferences: {
      preload: path.join(__dirname, "preload-settings.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWin.loadFile(path.join(__dirname, "settings.html"));
  settingsWin.on("closed", () => (settingsWin = null));
}

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(CFG_DIR, file), "utf8"));
  } catch {
    return null;
  }
}

ipcMain.handle("config:load", () => {
  const ai = readJSON("ai.json") ?? { provider: "claude-code" };
  return {
    provider: ai.provider,
    model: ai.model ?? "",
    baseUrl: ai.baseUrl ?? "",
    hasKey: !!(ai.apiKey || readJSON("credentials.json")?.apiKey),
  };
});

ipcMain.handle("config:save", (_e, cfg) => {
  try {
    fs.mkdirSync(CFG_DIR, { recursive: true });
    const prior = readJSON("ai.json") ?? {};
    const next = { provider: cfg.provider };
    if (cfg.model) next.model = cfg.model;
    if (cfg.baseUrl) next.baseUrl = cfg.baseUrl;
    // keep the saved key when the field is left blank
    const key = cfg.apiKey || (cfg.provider === prior.provider ? prior.apiKey : undefined);
    if (key && cfg.provider !== "claude-code") next.apiKey = key;
    fs.writeFileSync(path.join(CFG_DIR, "ai.json"), JSON.stringify(next, null, 2), { mode: 0o600 });
    if (cfg.provider === "anthropic" && key) {
      fs.writeFileSync(path.join(CFG_DIR, "credentials.json"), JSON.stringify({ apiKey: key }, null, 2), { mode: 0o600 });
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
});

/* ── updates: check GitHub releases, hand the user the right DMG ──
   Unsigned builds can't silent-install on macOS (Squirrel requires a
   code signature), so this is check → notify → download. */

function newerThan(latest, current) {
  const a = latest.split(".").map(Number);
  const b = current.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true;
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
  }
  return false;
}

async function checkForUpdates(interactive) {
  try {
    const res = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, {
      headers: { accept: "application/vnd.github+json", "user-agent": "bloommountain-app" },
    });
    if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
    const release = await res.json();
    const latest = String(release.tag_name || "").replace(/^v/, "");
    const current = app.getVersion();
    if (!latest || !newerThan(latest, current)) {
      if (interactive) {
        dialog.showMessageBox({ type: "info", message: `You're up to date`, detail: `BloomMountain v${current} is the latest version.` });
      }
      return;
    }
    const wanted = process.arch === "arm64" ? "arm64" : "x64";
    const asset = (release.assets || []).find((a) => a.name.includes(wanted) && a.name.endsWith(".dmg"));
    const { response } = await dialog.showMessageBox({
      type: "info",
      message: `BloomMountain v${latest} is available`,
      detail: `You have v${current}. Download the update? (It opens in your browser; drag the new app into Applications.)`,
      buttons: ["Download", "Later"],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) shell.openExternal(asset ? asset.browser_download_url : release.html_url);
  } catch (err) {
    if (interactive) {
      dialog.showMessageBox({ type: "warning", message: "Update check failed", detail: String(err.message || err) });
    }
  }
}

/* ── tray ───────────────────────────────────────────────────────── */

function createTray() {
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle("◆");
  tray.setToolTip("BloomMountain");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Open BloomMountain",
        click: () => {
          if (win) {
            win.show();
            win.focus();
          } else {
            createWindow();
          }
        },
      },
      { type: "separator" },
      { label: "AI Settings…", click: openSettings },
      { label: "Check for Updates…", click: () => checkForUpdates(true) },
      { type: "separator" },
      { label: `BloomMountain v${app.getVersion()}`, enabled: false },
      { label: "Quit", click: () => app.quit() },
    ]),
  );
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  if (SMOKE) {
    setTimeout(() => {
      console.log("SMOKE-FAIL no pty output");
      app.exit(1);
    }, 15000);
  } else {
    setTimeout(() => checkForUpdates(false), 6000);
  }
});
app.on("window-all-closed", () => app.quit());
