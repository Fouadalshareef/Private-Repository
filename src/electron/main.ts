import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DesktopApplication } from './DesktopApplication.js';
import { DesktopChannels } from './DesktopBridge.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const desktopApplication = new DesktopApplication();

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#10151f',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(currentDirectory, 'preload.js'),
    },
  });

  void window.loadFile(path.join(currentDirectory, '../../src/ui/index.html'));
  return window;
}

app.whenReady().then(() => {
  ipcMain.handle(DesktopChannels.getWorkspace, () => desktopApplication.getWorkspaceInfo());
  ipcMain.handle(DesktopChannels.sendChatMessage, (_event, content: string) => desktopApplication.sendMessage(content));
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
