import { contextBridge, ipcRenderer } from 'electron';
import { createDesktopBridge } from './DesktopBridge.js';

contextBridge.exposeInMainWorld('cupaw', createDesktopBridge(ipcRenderer));
