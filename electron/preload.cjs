const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getAppInfo: () => ipcRenderer.invoke("app:getInfo"),
  pickDirectory: () => ipcRenderer.invoke("dialog:pickDirectory"),
  saveFile: (filePath, data) => ipcRenderer.invoke("file:save", filePath, data),
  readFile: (filePath) => ipcRenderer.invoke("file:read", filePath),
  folderExists: (filePath) => ipcRenderer.invoke("file:exists", filePath),
});
