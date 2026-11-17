const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  
  listDevices: () => ipcRenderer.invoke('device:list'),
  captureScreenshot: (deviceId) => ipcRenderer.invoke('device:screenshot', deviceId),
  getScreenSources: () => ipcRenderer.invoke('screen:getSources'),

  startRecording: (options) => ipcRenderer.invoke('record:start', options),
  pauseRecording: () => ipcRenderer.invoke('record:pause'),
  resumeRecording: () => ipcRenderer.invoke('record:resume'),
  stopRecording: () => ipcRenderer.invoke('record:stop'),
  saveRecording: (payload) => ipcRenderer.invoke('record:save', payload),
  discardRecording: (payload) => ipcRenderer.invoke('record:discard', payload),
  getVideoUrl: (filePath) => ipcRenderer.invoke('video:getDataUrl', filePath),

  selectDirectory: (defaultPath) => ipcRenderer.invoke('dialog:selectDirectory', defaultPath),
  openFolder: (targetPath) => ipcRenderer.invoke('system:openFolder', targetPath)
});
