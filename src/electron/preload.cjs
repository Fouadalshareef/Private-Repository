const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cupaw', Object.freeze({
  getWorkspace: () => ipcRenderer.invoke('cupaw:get-workspace'),
  sendMessage: (content) => ipcRenderer.invoke('cupaw:send-chat-message', content),
}));
