const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('avdBrowser', {
  onFrame: (cb) => ipcRenderer.on('browser:frame', (_e, buf) => cb(buf)),
  onCursor: (cb) => ipcRenderer.on('browser:cursor', (_e, type) => cb(type)),
  input: (ev) => ipcRenderer.send('browser:input', ev),
  nav: (cmd) => ipcRenderer.invoke('browser:nav', cmd)
});
