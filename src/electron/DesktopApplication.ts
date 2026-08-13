import { Bootstrap } from '../bootstrap/Bootstrap.js';
import { createCLIConfig, type CLIConfig } from '../cli/CLIConfig.js';
import { LogLevel } from '../logging/LogLevel.js';
import { ProjectScanner } from '../project/ProjectScanner.js';
import type { DesktopChatResponse, DesktopWorkspaceInfo } from './DesktopBridge.js';

/**
 * Application-layer adapter for the desktop shell.
 * It owns no backend implementation; it only reuses the existing runtime wiring.
 */
export class DesktopApplication {
  private readonly config: CLIConfig;
  private readonly chatSessionId = 'desktop-session';

  constructor(config?: CLIConfig) {
    this.config = config ?? DesktopApplication.createConfig();
  }

  public getWorkspaceInfo(): DesktopWorkspaceInfo {
    const workspace = this.config.workspace;
    const scan = new ProjectScanner(this.config.fileSystem).scan(workspace);
    const workspaceInfo = workspace.getInfo();

    return Object.freeze({
      name: workspaceInfo.name,
      root: workspace.getRoot(),
      fileCount: scan.files.length,
    });
  }

  public async sendMessage(content: string): Promise<DesktopChatResponse> {
    const prompt = content.trim();
    if (prompt.length === 0) {
      throw new Error('Message cannot be empty.');
    }

    if (!this.config.memory.getSession(this.chatSessionId)) {
      this.config.memory.createSession(this.chatSessionId);
    }
    if (!this.config.sessionManager.getSession(this.chatSessionId)) {
      this.config.sessionManager.createSession({ id: this.chatSessionId, label: 'Desktop Session' });
    }

    const result = await this.config.agentExecutor.execute({
      sessionId: this.chatSessionId,
      prompt,
    });

    return Object.freeze({ content: result.response.content });
  }

  private static createConfig(): CLIConfig {
    const bootstrapResult = new Bootstrap({ options: { logLevel: LogLevel.WARN } }).initialize();
    return createCLIConfig({
      configuration: bootstrapResult.configuration,
      logger: bootstrapResult.logger,
      eventBus: bootstrapResult.eventBus,
      container: bootstrapResult.container,
    });
  }
}
