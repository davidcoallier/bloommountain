const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bloom", {
  start: (cols, rows) => ipcRenderer.send("pty:start", { cols, rows }),
  input: (data) => ipcRenderer.send("pty:input", data),
  resize: (cols, rows) => ipcRenderer.send("pty:resize", { cols, rows }),
  onData: (cb) => ipcRenderer.on("pty:data", (_e, data) => cb(data)),
});
