import { describe, expect, it } from 'vitest';
import { DesktopApplication } from '../../src/electron/DesktopApplication.js';
import { DesktopChannels, createDesktopBridge, type DesktopInvoker } from '../../src/electron/DesktopBridge.js';

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
});
