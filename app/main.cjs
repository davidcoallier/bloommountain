/**
 * BloomMountain desktop shell — the app IS the terminal.
 * Electron window hosting xterm.js, wired to the Ink TUI through a pty.
 */
const { app, BrowserWindow, ipcMain } = require("electron");
const { execSync } = require("node:child_process");
const path = require("node:path");
const pty = require("node-pty");

const SMOKE = process.argv.includes("--smoke");
// with asar disabled, packaged files live in Contents/Resources/app
const ROOT = app.isPackaged ? path.join(process.resourcesPath, "app") : path.join(__dirname, "..");

let win = null;
let shell = null;

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
  if (shell) return;
  shell = pty.spawn(
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
  shell.onData((data) => {
    win?.webContents.send("pty:data", data);
    if (SMOKE) {
      smokeBytes += data.length;
      if (smokeBytes > 2000) {
        console.log(`SMOKE-OK pty produced ${smokeBytes} bytes`);
        app.exit(0);
      }
    }
  });
  shell.onExit(() => {
    shell = null;
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
    shell?.kill();
    shell = null;
  });
}

ipcMain.on("pty:start", (_e, { cols, rows }) => startPty(cols, rows));
ipcMain.on("pty:input", (_e, data) => shell?.write(data));
ipcMain.on("pty:resize", (_e, { cols, rows }) => {
  try {
    shell?.resize(cols, rows);
  } catch {
    /* pty may be closing */
  }
});

app.whenReady().then(() => {
  createWindow();
  if (SMOKE) setTimeout(() => {
    console.log("SMOKE-FAIL no pty output");
    app.exit(1);
  }, 15000);
});
app.on("window-all-closed", () => app.quit());
