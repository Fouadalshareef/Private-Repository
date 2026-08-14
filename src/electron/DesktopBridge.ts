/** IPC channel names exposed to the Cupaw renderer. */
export const DesktopChannels = {
  getWorkspace: 'cupaw:get-workspace',
  sendChatMessage: 'cupaw:send-chat-message',
} as const;

/** Minimal workspace data safe to expose to the renderer. */
export interface DesktopWorkspaceInfo {
  readonly name: string;
  readonly root: string;
  readonly fileCount: number;
}

/** A chat result returned by the existing application runtime. */
export interface DesktopChatResponse {
  readonly content: string;
}

/** Narrow IPC contract used by the preload bridge. */
export interface DesktopInvoker {
  invoke<T>(channel: string, ...args: readonly unknown[]): Promise<T>;
}

/** Main-process surface required to register the two renderer IPC handlers. */
export interface DesktopIpcHandlerRegistrar {
  handle(channel: string, listener: (_event: unknown, ...args: readonly unknown[]) => unknown): void;
}

/** Existing desktop runtime operations invoked by the IPC handlers. */
export interface DesktopRuntime {
  getWorkspaceInfo(): DesktopWorkspaceInfo;
  sendMessage(content: string): Promise<DesktopChatResponse>;
}

/** Safe renderer API. No Node or filesystem APIs are exposed. */
export interface CupawDesktopBridge {
  getWorkspace(): Promise<DesktopWorkspaceInfo>;
  sendMessage(content: string): Promise<DesktopChatResponse>;
}

/**
 * Creates the narrow renderer bridge from Electron's IPC invoker.
 * Exported separately so the bridge contract can be tested without Electron.
 */
export function createDesktopBridge(invoker: DesktopInvoker): CupawDesktopBridge {
  return Object.freeze({
    getWorkspace: () => invoker.invoke<DesktopWorkspaceInfo>(DesktopChannels.getWorkspace),
    sendMessage: (content: string) => invoker.invoke<DesktopChatResponse>(DesktopChannels.sendChatMessage, content),
  });
}

/**
 * Registers the only IPC routes available to the renderer bridge.
 * Keeping the mapping here prevents the preload, main process, and tests from
 * silently drifting to different channel names.
 */
export function registerDesktopIpcHandlers(
  registrar: DesktopIpcHandlerRegistrar,
  runtime: DesktopRuntime,
): void {
  registrar.handle(DesktopChannels.getWorkspace, () => runtime.getWorkspaceInfo());
  registrar.handle(DesktopChannels.sendChatMessage, (_event, content) => runtime.sendMessage(String(content)));
}
