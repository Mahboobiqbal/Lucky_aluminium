const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");
const { pathToFileURL } = require("url");

let mainWindow = null;
let pythonProcess = null;
let nitroServer = null;

const isDev = !app.isPackaged;
const DEV_PORT = 5173;
const NITRO_PORT = 3000;

function getBackendPath() {
  const base = isDev
    ? path.join(__dirname, "..", "server", "dist", "udyana-server")
    : path.join(process.resourcesPath, "backend");
  const exe = path.join(base, "udyana-server.exe");
  return fs.existsSync(exe) ? exe : null;
}

function getNitroPath() {
  const base = isDev
    ? path.join(__dirname, "..", ".output", "server")
    : path.join(process.resourcesPath, "app", "server");
  return path.join(base, "index.mjs");
}

function startBackend() {
  const exe = getBackendPath();
  if (!exe) {
    console.log("Backend exe not found, skipping backend start");
    return;
  }

  // Read .env file and merge into process env for the backend
  const envVars = { ...process.env };
  const envPath = isDev
    ? path.join(__dirname, "..", "server", ".env")
    : path.join(process.resourcesPath, "server", ".env");
  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          envVars[key] = val;
        }
      }
    }
  } catch (err) {
    console.warn("Could not read .env file:", err.message);
  }

  const userDataPath = app.getPath("userData");
  envVars.UDYANA_DESKTOP = "1";
  envVars.UDYANA_HOST = "127.0.0.1";
  envVars.UDYANA_PORT = "8000";
  envVars.UDYANA_DB_DIR = userDataPath;

  pythonProcess = spawn(exe, [], { env: envVars, stdio: ["ignore", "pipe", "pipe"] });
  pythonProcess.stdout.on("data", (d) => process.stdout.write(`[backend] ${d}`));
  pythonProcess.stderr.on("data", (d) => process.stderr.write(`[backend] ${d}`));
  pythonProcess.on("exit", (code) => {
    console.log(`Backend exited with code ${code}`);
    pythonProcess = null;
  });
}

async function startNitroServer() {
  const indexPath = getNitroPath();
  if (!fs.existsSync(indexPath)) {
    console.log("Nitro server not found at", indexPath);
    return;
  }

  try {
    await import(pathToFileURL(indexPath).toString());
    nitroServer = { close: () => process.exit(0) };
    console.log(`Nitro SSR server started`);
  } catch (err) {
    console.error("Failed to start Nitro server:", err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${DEV_PORT}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(`http://localhost:${NITRO_PORT}`);
  }

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => { mainWindow = null; });
}

function cleanup() {
  if (pythonProcess) { pythonProcess.kill(); pythonProcess = null; }
  if (nitroServer && nitroServer.close) { nitroServer.close(); nitroServer = null; }
  if (mainWindow) { mainWindow.close(); mainWindow = null; }
}

ipcMain.handle("app:getInfo", () => ({
  version: app.getVersion(),
  userDataPath: app.getPath("userData"),
  isPackaged: app.isPackaged,
}));

ipcMain.handle("dialog:pickDirectory", async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("file:save", async (_event, filePath, data) => {
  try {
    let target = filePath;
    if (!path.isAbsolute(target)) {
      target = path.join(app.getPath("userData"), ".lucky-aluminium-backups", path.basename(target));
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, Buffer.from(data));
    return { ok: true, path: target };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
});

ipcMain.handle("file:exists", async (_event, filePath) => {
  try {
    return { ok: fs.existsSync(filePath) };
  } catch {
    return { ok: false };
  }
});

ipcMain.handle("file:read", async (_event, filePath) => {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath).buffer;
});

app.whenReady().then(async () => {
  startBackend();
  if (!isDev) { await startNitroServer(); }
  createWindow();
});

app.on("window-all-closed", () => { cleanup(); app.quit(); });
app.on("before-quit", () => { cleanup(); });
