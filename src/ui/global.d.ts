import type { CupawDesktopBridge } from '../electron/DesktopBridge.js';

declare global {
  interface Window {
    readonly cupaw: CupawDesktopBridge;
  }
}

export {};
