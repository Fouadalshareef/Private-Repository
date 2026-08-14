const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const desktopApplicationPath = path.join(__dirname, 'DesktopApplication.js');
const desktopBridgePath = path.join(__dirname, 'DesktopBridge.js');

if (process.env.CUPAW_SMOKE === '1') {
  app.commandLine.appendSwitch('remote-debugging-port', '9333');
}

async function startDesktopApplication() {
  const { DesktopApplication } = await import(pathToFileURL(desktopApplicationPath).href);
  const { registerDesktopIpcHandlers } = await import(pathToFileURL(desktopBridgePath).href);
  const desktopApplication = new DesktopApplication();

  registerDesktopIpcHandlers(ipcMain, desktopApplication);

  const createWindow = () => {
    const window = new BrowserWindow({
      width: 1200,
      height: 760,
      minWidth: 900,
      minHeight: 600,
      backgroundColor: '#10151f',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload.cjs'),
      },
    });

    void window.loadFile(path.join(__dirname, '../../src/ui/index.html'));
    return window;
  };

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}

app.whenReady().then(startDesktopApplication).catch((error) => {
  console.error('Failed to start Cupaw Desktop:', error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
