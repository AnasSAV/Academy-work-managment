"use strict";
/**
 * Desktop shell. It starts the app's own Next.js server on a private local port, opens it in a
 * window, and stops it again on quit. Your data lives in the user profile, never in the install
 * folder, so upgrading or reinstalling never touches it.
 */
const { app, BrowserWindow, Menu, dialog, nativeTheme, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { describeSource, importData, rollbackImport } = require("./data-import.cjs");

const APP_NAME = "Academy Work Management";
const PROJECT_URL = "https://github.com/AnasSAV/Academy-work-managment";
// Unusual on purpose; only used if free.
const PREFERRED_PORT = Number(process.env.ACADEMY_PORT) || 43127;
const EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "onenote:"]);

app.setName(APP_NAME);
app.setAppUserModelId("com.anassav.academyworkmanagement");
// ACADEMY_USER_DATA / ACADEMY_DATA_DIR let tests (and portable setups) keep everything elsewhere.
const userData = process.env.ACADEMY_USER_DATA || path.join(app.getPath("appData"), APP_NAME);
app.setPath("userData", userData);
const dataDir = process.env.ACADEMY_DATA_DIR || path.join(userData, "data");
const logDir = path.join(userData, "logs");
const serverDir = app.isPackaged
  ? path.join(process.resourcesPath, "server")
  : path.join(__dirname, "..", "server");
const iconPath = path.join(__dirname, "icon.png");

/** @type {import("electron").BrowserWindow | null} */
let win = null;
/** @type {{ child: import("node:child_process").ChildProcess, url: string, exited: Promise<unknown> } | null} */
let server = null;
let stopping = false;

// ---------------------------------------------------------------- server

/**
 * Try the preferred port first, so the address (and with it the saved theme, which the browser
 * keeps per address) is the same every time. If something else has it, any free port will do.
 */
function freePort(preferred) {
  const listenOn = (port) =>
    new Promise((resolve, reject) => {
      const probe = net.createServer();
      probe.once("error", reject);
      probe.listen(port, "127.0.0.1", () => {
        const { port: got } = probe.address();
        probe.close(() => resolve(got));
      });
    });
  return listenOn(preferred).catch(() => listenOn(0));
}

function ping(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(url, exited, timeoutMs = 45000) {
  let code = null;
  exited.then((c) => (code = c ?? -1));
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (code !== null) throw new Error(`The app's server stopped while starting (code ${code}).`);
    if (await ping(url)) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("The app's server did not start in time.");
}

async function startServer() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });
  const port = await freePort(PREFERRED_PORT);
  const url = `http://127.0.0.1:${port}`;
  const log = fs.createWriteStream(path.join(logDir, "server.log"), { flags: "a" });
  log.write(`\n--- ${new Date().toISOString()} starting on ${url}\n`);

  // Electron's own runtime doubles as Node here, so nothing else needs installing.
  const child = spawn(process.execPath, [path.join(serverDir, "desktop-entry.cjs")], {
    cwd: serverDir,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      PORT: String(port),
      HOSTNAME: "127.0.0.1", // this computer only, never the network
      DATABASE_PATH: path.join(dataDir, "app.db"),
      UPLOADS_DIR: path.join(dataDir, "uploads"),
    },
  });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  const exited = new Promise((resolve) => child.once("exit", resolve));

  const started = { child, url, exited };
  try {
    await waitForServer(url, exited);
  } catch (error) {
    child.kill();
    throw error;
  }
  // If it dies later on its own, say so instead of leaving a dead window.
  exited.then(() => {
    if (!stopping && server === started) {
      dialog.showErrorBoxSync(
        APP_NAME,
        `The app's server stopped unexpectedly.\n\nDetails are in ${path.join(logDir, "server.log")}`,
      );
      app.quit();
    }
  });
  server = started;
  return started;
}

async function stopServer() {
  const current = server;
  server = null;
  if (!current) return;
  stopping = true;
  try {
    current.child.kill();
    const timeout = new Promise((r) => setTimeout(() => r("timeout"), 5000));
    if ((await Promise.race([current.exited, timeout])) === "timeout")
      current.child.kill("SIGKILL");
    await current.exited;
  } finally {
    stopping = false;
  }
}

// ---------------------------------------------------------------- window

function sameOrigin(url) {
  try {
    return server !== null && new URL(url).origin === new URL(server.url).origin;
  } catch {
    return false;
  }
}

function openExternally(url) {
  try {
    if (EXTERNAL_PROTOCOLS.has(new URL(url).protocol)) shell.openExternal(url);
  } catch {
    // not a URL we understand: ignore
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 480,
    minHeight: 600,
    show: false,
    title: APP_NAME,
    icon: iconPath,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0a0a0a" : "#ffffff",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.once("ready-to-show", () => win && win.show());
  win.on("closed", () => {
    win = null;
  });

  // Keep the window on the app: anything else opens in the normal browser or program.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (sameOrigin(url)) return { action: "allow" };
    openExternally(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("data:") || sameOrigin(url)) return;
    event.preventDefault();
    openExternally(url);
  });

  win.loadFile(path.join(__dirname, "splash.html"));
}

function showWindowError(message) {
  dialog.showErrorBoxSync(APP_NAME, message);
}

// ---------------------------------------------------------------- import

function formatSize(bytes) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function importFlow() {
  if (!win) return;
  const intro = await dialog.showMessageBox(win, {
    type: "question",
    title: "Import data",
    message: "Bring in your existing data",
    detail:
      "Use this to move data from the development version (npm run dev) into this app.\n\n" +
      "Database file: a backup made with npm run db:backup, found in data/backups. This is the safest choice.\n\n" +
      "Data folder: the project's data folder (it holds app.db and uploads). Close npm run dev first.\n\n" +
      "What this app has now is kept in a backup folder, so nothing is lost.",
    buttons: ["Database file…", "Data folder…", "Cancel"],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
  });
  if (intro.response === 2) return;

  const picked = await dialog.showOpenDialog(win, {
    title: intro.response === 0 ? "Choose a database file" : "Choose the data folder",
    properties: [intro.response === 0 ? "openFile" : "openDirectory"],
    filters:
      intro.response === 0
        ? [{ name: "SQLite database", extensions: ["db", "sqlite", "sqlite3"] }]
        : undefined,
  });
  if (picked.canceled || picked.filePaths.length === 0) return;

  let info;
  try {
    info = describeSource(picked.filePaths[0]);
  } catch (error) {
    showWindowError(error.message);
    return;
  }

  const confirm = await dialog.showMessageBox(win, {
    type: "warning",
    title: "Import data",
    message: "Replace this app's data?",
    detail:
      `Database: ${info.db} (${formatSize(info.bytes)})\n` +
      (info.uploads
        ? `Uploaded files: ${info.uploadCount} from ${info.uploads}\n`
        : "Uploaded files: none found next to it\n") +
      `\nThe data in this app now will be moved to ${path.join(dataDir, "backups")}.`,
    buttons: ["Import", "Cancel"],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });
  if (confirm.response !== 0) return;

  await stopServer();
  let result = null;
  try {
    result = importData(picked.filePaths[0], dataDir);
    await launch();
    dialog.showMessageBox(win, {
      type: "info",
      title: "Import data",
      message: "Your data is imported",
      detail: `The previous data was kept in ${result.backupDir}.`,
    });
  } catch (error) {
    if (result) rollbackImport(dataDir, result.backupDir);
    showWindowError(`The import did not work, so nothing was changed.\n\n${error.message}`);
    await launch().catch((e) => {
      showWindowError(e.message);
      app.quit();
    });
  }
}

// ---------------------------------------------------------------- menu

function buildMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        { label: "Import data…", click: () => importFlow() },
        { label: "Open data folder", click: () => shell.openPath(dataDir) },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        ...(app.isPackaged ? [] : [{ type: "separator" }, { role: "toggleDevTools" }]),
      ],
    },
    { role: "windowMenu" },
    {
      label: "Help",
      submenu: [
        { label: "Project page", click: () => shell.openExternal(PROJECT_URL) },
        { label: "Open logs folder", click: () => shell.openPath(logDir) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------- lifecycle

/** Start the server and point the window at it. */
async function launch() {
  const started = await startServer();
  if (win) await win.loadURL(started.url);
}

if (!app.requestSingleInstanceLock()) {
  // The app is already open: the running copy comes to the front instead.
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(async () => {
    buildMenu();
    createWindow();
    try {
      await launch();
    } catch (error) {
      showWindowError(
        `${APP_NAME} could not start.\n\n${error.message}\n\nDetails are in ${path.join(logDir, "server.log")}`,
      );
      app.quit();
    }
  });

  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    if (server) {
      stopping = true;
      server.child.kill();
    }
  });
}
