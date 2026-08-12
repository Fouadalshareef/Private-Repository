/**
 * MVP-EXEC-04: Real Workspace End-To-End Coding Flow
 *
 * This integration test proves the full vertical slice:
 * Real fixture project
 *  → Workspace
 *  → ProjectScanner
 *  → ProjectModel
 *  → SourceIndex
 *  → CLI /code
 *  → InteractiveCodingSession
 *  → CodingTaskPipeline
 *  → MockAIProvider
 *  → Diff
 *  → Validation
 *  → Patch
 *  → Actual file modification
 *  → Final validation
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InteractiveCodingSession } from '../../src/cli/InteractiveCodingSession.js';
import { CodingTaskStatus } from '../../src/agent/coding/CodingTask.js';
import { VirtualFileSystem } from '../../src/filesystem/VirtualFileSystem.js';
import { Workspace } from '../../src/workspace/Workspace.js';
import { MockAIProvider } from '../../src/ai/MockAIProvider.js';
import { createCLIConfig } from '../../src/cli/CLIConfig.js';
import { Bootstrap } from '../../src/bootstrap/Bootstrap.js';
import { LogLevel } from '../../src/logging/LogLevel.js';

describe('MVP-EXEC-04: Real Workspace End-To-End Coding Flow', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('proves the true vertical slice with actual file modification', async () => {
    // 1. Fixture project setup using the real VirtualFileSystem
    const fs = new VirtualFileSystem();
    
    // Create project structure
    fs.createDirectory('/fixture-project');
    fs.createDirectory('/fixture-project/src');
    
    const initialCartTs = [
      'export class Cart {',
      '  private items: number[] = [];',
      '',
      '  add(price: number): void {',
      '    this.items.push(price);',
      '  }',
      '}'
    ].join('\n');
    
    const initialIndexTs = 'export * from "./Cart";\n';
    
    fs.writeFile('/fixture-project/src/Cart.ts', initialCartTs);
    fs.writeFile('/fixture-project/src/index.ts', initialIndexTs);
    fs.writeFile('/fixture-project/package.json', '{"name":"fixture"}');
    fs.writeFile('/fixture-project/tsconfig.json', '{"compilerOptions":{"target":"es2020"}}');

    // 2. Real Workspace initialization
    const workspace = new Workspace();
    workspace.create('fixture', 'Fixture Project', '/fixture-project');
    workspace.open();

    // 3. Configure deterministic AI Provider proposing the required change
    const proposedCartTs = [
      'export class Cart {',
      '  private items: number[] = [];',
      '',
      '  add(price: number): void {',
      '    this.items.push(price);',
      '  }',
      '',
      '  calculateTotal(): number {',
      '    return this.items.reduce((total, price) => total + price, 0);',
      '  }',
      '}'
    ].join('\n');

    const provider = new MockAIProvider({
      defaultResponse: `FILE: src/Cart.ts\n\`\`\`typescript\n${proposedCartTs}\n\`\`\``
    });

    // 4. Initialize CLI config with the real services
    const bootstrap = new Bootstrap({ options: { logLevel: LogLevel.WARN } });
    const bootstrapResult = bootstrap.initialize();
    const config = createCLIConfig({
      configuration: bootstrapResult.configuration,
      logger: bootstrapResult.logger,
      eventBus: bootstrapResult.eventBus,
      container: bootstrapResult.container,
    });

    // Overwrite the config's fileSystem and workspace with our fixture versions
    // (In a real run, the CLI would point these to the real OS)
    Object.assign(config, {
      fileSystem: fs,
      workspace: workspace,
      aiProvider: provider,
    });

    // 5. Initialize the InteractiveCodingSession
    const session = new InteractiveCodingSession(config);

    // 6. Execute user request
    const result = await session.executeRequest({
      prompt: 'Add calculateTotal to Cart.ts',
    });

    // 7. Verify the result and flow
    expect(result.accepted).toBe(true);
    expect(result.taskResult).toBeDefined();
    expect(result.taskResult!.status).toBe(CodingTaskStatus.SUCCESS);

    // 8. Verify the actual file modification (No Fake Success)
    const finalCartTs = fs.readFile('/fixture-project/src/Cart.ts');
    expect(finalCartTs).toContain('calculateTotal(): number');
    expect(finalCartTs).toContain('return this.items.reduce');
    expect(finalCartTs).toEqual(proposedCartTs);

    // 9. Verify unrelated files are unchanged
    expect(fs.readFile('/fixture-project/src/index.ts')).toEqual(initialIndexTs);

    // 10. Verify diff and validation
    const diff = result.taskResult!.diffs.get('src/Cart.ts');
    expect(diff).toBeDefined();
    expect(diff!.addedLines).toBeGreaterThan(0);
    expect(diff!.isIdentical).toBe(false);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('✓ Task completed')
    );
  });

  describe('Focused Error Tests', () => {
    it('fails when no active workspace is available (CONTEXT_ERROR)', async () => {
      const fs = new VirtualFileSystem();
      const workspace = new Workspace();
      // Workspace is created but NOT opened
      workspace.create('fixture', 'Fixture Project', '/');
      
      const provider = new MockAIProvider();
      
      const bootstrap = new Bootstrap({ options: { logLevel: LogLevel.WARN } });
      const bootstrapResult = bootstrap.initialize();
      const config = createCLIConfig({
        configuration: bootstrapResult.configuration,
        logger: bootstrapResult.logger,
        eventBus: bootstrapResult.eventBus,
        container: bootstrapResult.container,
      });

      Object.assign(config, {
        fileSystem: fs,
        workspace: workspace,
        aiProvider: provider,
      });

      const session = new InteractiveCodingSession(config);

      const result = await session.executeRequest({
        prompt: 'Do something',
      });

      expect(result.accepted).toBe(false);
      expect(result.userError).toContain('No active workspace. Please open a project');
    });

    it('fails when the prompt targets a missing or completely unrelated file (CONTEXT_ERROR)', async () => {
      const fs = new VirtualFileSystem();
      fs.createDirectory('/proj');
      fs.writeFile('/proj/existing.ts', 'const x = 1;');

      const workspace = new Workspace();
      workspace.create('proj', 'Proj', '/proj');
      workspace.open();
      
      const provider = new MockAIProvider();
      
      const bootstrap = new Bootstrap({ options: { logLevel: LogLevel.WARN } });
      const bootstrapResult = bootstrap.initialize();
      const config = createCLIConfig({
        configuration: bootstrapResult.configuration,
        logger: bootstrapResult.logger,
        eventBus: bootstrapResult.eventBus,
        container: bootstrapResult.container,
      });

      Object.assign(config, {
        fileSystem: fs,
        workspace: workspace,
        aiProvider: provider,
      });

      const session = new InteractiveCodingSession(config);

      const result = await session.executeRequest({
        prompt: 'Fix missing.ts',
      });

      expect(result.accepted).toBe(true);
      expect(result.taskResult!.status).toBe(CodingTaskStatus.CONTEXT_ERROR);
    });

    it('propagates AI provider failure correctly', async () => {
      const fs = new VirtualFileSystem();
      fs.createDirectory('/proj');
      fs.writeFile('/proj/app.ts', 'const x = 1;');

      const workspace = new Workspace();
      workspace.create('proj', 'Proj', '/proj');
      workspace.open();
      
      const provider = new MockAIProvider();
      provider.setAvailable(false);
      
      const bootstrap = new Bootstrap({ options: { logLevel: LogLevel.WARN } });
      const bootstrapResult = bootstrap.initialize();
      const config = createCLIConfig({
        configuration: bootstrapResult.configuration,
        logger: bootstrapResult.logger,
        eventBus: bootstrapResult.eventBus,
        container: bootstrapResult.container,
      });

      Object.assign(config, {
        fileSystem: fs,
        workspace: workspace,
        aiProvider: provider,
      });

      const session = new InteractiveCodingSession(config);

      const result = await session.executeRequest({
        prompt: 'Fix app.ts',
      });

      expect(result.accepted).toBe(true);
      expect(result.taskResult!.status).toBe(CodingTaskStatus.AI_ERROR);
    });

    it('blocks patch application on validation failure', async () => {
      const fs = new VirtualFileSystem();
      fs.createDirectory('/proj');
      fs.writeFile('/proj/app.ts', 'export const x = 1;');

      const workspace = new Workspace();
      workspace.create('proj', 'Proj', '/proj');
      workspace.open();
      
      // Deliberately return invalid TypeScript syntax
      const provider = new MockAIProvider({
        defaultResponse: `FILE: /proj/app.ts\n\`\`\`typescript\nthis is invalid ::::::: code\n\`\`\``
      });
      
      const bootstrap = new Bootstrap({ options: { logLevel: LogLevel.WARN } });
      const bootstrapResult = bootstrap.initialize();
      const config = createCLIConfig({
        configuration: bootstrapResult.configuration,
        logger: bootstrapResult.logger,
        eventBus: bootstrapResult.eventBus,
        container: bootstrapResult.container,
      });

      Object.assign(config, {
        fileSystem: fs,
        workspace: workspace,
        aiProvider: provider,
      });

      const session = new InteractiveCodingSession(config);

      const result = await session.executeRequest({
        prompt: 'break app.ts',
      });

      expect(result.accepted).toBe(true);
      // It should either be VALIDATION_FAILED or AI_ERROR depending on how the pipeline treats syntax errors.
      expect([CodingTaskStatus.VALIDATION_FAILED, CodingTaskStatus.AI_ERROR]).toContain(result.taskResult!.status);
      
      // Verify file is UNCHANGED
      expect(fs.readFile('/proj/app.ts')).toBe('export const x = 1;');
    });

    it('isolates projects (does not read files from another project)', async () => {
      const fs = new VirtualFileSystem();
      fs.createDirectory('/projA');
      fs.writeFile('/projA/secret.ts', 'export const secret = "A";');
      
      fs.createDirectory('/projB');
      fs.writeFile('/projB/public.ts', 'export const pub = "B";');

      const workspaceB = new Workspace();
      workspaceB.create('projB', 'Proj B', '/projB');
      workspaceB.open();
      
      const provider = new MockAIProvider({ defaultResponse: 'NO_CHANGES_NEEDED' });
      
      const bootstrap = new Bootstrap({ options: { logLevel: LogLevel.WARN } });
      const bootstrapResult = bootstrap.initialize();
      const config = createCLIConfig({
        configuration: bootstrapResult.configuration,
        logger: bootstrapResult.logger,
        eventBus: bootstrapResult.eventBus,
        container: bootstrapResult.container,
      });

      Object.assign(config, {
        fileSystem: fs,
        workspace: workspaceB,
        aiProvider: provider,
      });

      const session = new InteractiveCodingSession(config);

      const result = await session.executeRequest({
        prompt: 'Check secret.ts',
      });

      expect(result.accepted).toBe(true);
      // Should fail to find context because secret.ts is in projA, not in workspaceB
      expect(result.taskResult!.status).toBe(CodingTaskStatus.CONTEXT_ERROR);
    });
  });
});
