import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { DesktopApplication } from '../../src/electron/DesktopApplication.js';
import {
  DesktopChannels,
  createDesktopBridge,
  registerDesktopIpcHandlers,
  type DesktopInvoker,
} from '../../src/electron/DesktopBridge.js';

describe('DesktopApplication', () => {
  it('constructs from the existing runtime and exposes workspace scan information', () => {
    const application = new DesktopApplication();

    expect(application.getWorkspaceInfo()).toEqual({
      name: 'Default Workspace',
      root: '/',
      fileCount: 0,
    });
  });

  it('routes chat through the existing agent executor', async () => {
    const application = new DesktopApplication();

    await expect(application.sendMessage('Hello Cupaw')).resolves.toEqual({
      content: 'Hello! This is a mock AI response.',
    });
  });
});

describe('Cupaw desktop preload bridge', () => {
  it('exposes only workspace and chat operations over IPC', async () => {
    const calls: Array<{ channel: string; args: readonly unknown[] }> = [];
    const invoker: DesktopInvoker = {
      invoke<T>(channel: string, ...args: readonly unknown[]): Promise<T> {
        calls.push({ channel, args });
        return Promise.resolve({} as T);
      },
    };
    const bridge = createDesktopBridge(invoker);

    await bridge.getWorkspace();
    await bridge.sendMessage('Hello');

    expect(Object.keys(bridge)).toEqual(['getWorkspace', 'sendMessage']);
    expect(calls).toEqual([
      { channel: DesktopChannels.getWorkspace, args: [] },
      { channel: DesktopChannels.sendChatMessage, args: ['Hello'] },
    ]);
  });

  it('registers workspace and chat IPC handlers with the existing desktop application', async () => {
    const handlers = new Map<string, (_event: unknown, ...args: readonly unknown[]) => unknown>();
    const application = new DesktopApplication();

    registerDesktopIpcHandlers({ handle: (channel, listener) => handlers.set(channel, listener) }, application);

    expect(handlers.get(DesktopChannels.getWorkspace)?.({})).toEqual(application.getWorkspaceInfo());
    await expect(handlers.get(DesktopChannels.sendChatMessage)?.({}, 'Hello Cupaw')).resolves.toEqual({
      content: 'Hello! This is a mock AI response.',
    });
  });

  it('exposes the narrow cupaw API from the CommonJS preload runtime', async () => {
    const calls: Array<{ channel: string; args: unknown[] }> = [];
    let exposedName = '';
    let exposedApi: { getWorkspace(): Promise<unknown>; sendMessage(content: string): Promise<unknown> } | undefined;
    const source = readFileSync(path.resolve('src/electron/preload.cjs'), 'utf8');

    vm.runInNewContext(source, {
      require: (moduleName: string) => {
        expect(moduleName).toBe('electron');
        return {
          contextBridge: {
            exposeInMainWorld: (name: string, api: typeof exposedApi) => {
              exposedName = name;
              exposedApi = api;
            },
          },
          ipcRenderer: {
            invoke: (channel: string, ...args: unknown[]) => {
              calls.push({ channel, args });
              return Promise.resolve({});
            },
          },
        };
      },
    });

    expect(exposedName).toBe('cupaw');
    expect(Object.keys(exposedApi!)).toEqual(['getWorkspace', 'sendMessage']);
    await exposedApi!.getWorkspace();
    await exposedApi!.sendMessage('Hello');
    expect(calls).toEqual([
      { channel: DesktopChannels.getWorkspace, args: [] },
      { channel: DesktopChannels.sendChatMessage, args: ['Hello'] },
    ]);
  });
});
