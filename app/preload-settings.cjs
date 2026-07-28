const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bloomSettings", {
  load: () => ipcRenderer.invoke("config:load"),
  save: (cfg) => ipcRenderer.invoke("config:save", cfg),
});
