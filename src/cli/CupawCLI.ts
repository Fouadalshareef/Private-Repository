import type { AgentExecuteOptions } from '../agent/IAgentExecutor.js';
import type { CLIConfig } from './CLIConfig.js';
import { CLICommandError } from './CLIError.js';
import { AdvisorCLIHandler, CLIAdvisorsOutput } from './AdvisorCLIHandler.js';
import { AdvisorCLIController, type CLIControllerOutput } from './handlers/AdvisorCLIController.js';
import { createInterface } from 'node:readline';

/**
 * Creates an interactive Node.js readline interface.
 */
function createReadlineInterface(): ReturnType<typeof createInterface> {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'cupaw> ',
  });
}

/**
 * Result of executing a user turn through the agent.
 */
export interface CLITurnResult {
  /** The session ID used for this turn. */
  readonly sessionId: string;
  /** The final AI response content. */
  readonly response: string;
  /** Whether the response was streamed token-by-token. */
  readonly streamed: boolean;
}

/**
 * Cupaw interactive CLI shell.
 *
 * Wires together all core modules and provides an interactive REPL
 * for chatting with the AI agent, managing sessions, and inspecting
 * the system state.
 */
export class CupawCLI {
  private readonly config: CLIConfig;
  private readonly rl: ReturnType<typeof createInterface>;
  private readonly currentSessionId: string;
  private readonly advisorHandler: AdvisorCLIHandler;
  private readonly controller: AdvisorCLIController;
  private running = false;

  constructor(config: CLIConfig) {
    this.config = config;
    this.rl = createReadlineInterface();
    this.currentSessionId = 'cli-session';
    this.advisorHandler = new AdvisorCLIHandler();
    this.controller = new AdvisorCLIController(config.conversationRuntime);
  }

  /**
   * Starts the interactive REPL loop.
   */
  public start(): void {
    this.running = true;
    this.config.logger.info('Cupaw CLI started. Type /help for available commands.');

    this.rl.prompt();

    this.rl.on('line', async (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) {
        this.rl.prompt();
        return;
      }

      try {
        await this.handleInput(trimmed);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.config.logger.error(`CLI error: ${message}`);
        console.error(`Error: ${message}`);
      }

      if (this.running) {
        this.rl.prompt();
      }
    });

    this.rl.on('close', () => {
      this.running = false;
      this.config.logger.info('Cupaw CLI closed.');
      process.exit(0);
    });
  }

  /**
   * Stops the REPL loop and closes the readline interface.
   */
  public stop(): void {
    this.running = false;
    this.rl.close();
  }

  /**
   * Dispatches a raw input line to the appropriate handler.
   */
  private async handleInput(input: string): Promise<void> {
    if (input.startsWith('/')) {
      await this.handleCommand(input);
      return;
    }

    await this.handleChat(input);
  }

  /**
   * Handles slash commands.
   */
  private async handleCommand(input: string): Promise<void> {
    const advisorOutput = this.advisorHandler.handleCommand(input);

    if ((advisorOutput as { readonly kind: string }).kind !== 'unknown') {
      if ((advisorOutput as { kind: 'switch' }).kind === 'switch') {
        const switchOutput = advisorOutput as { kind: 'switch'; value: { advisorId: string | undefined } };
        if (switchOutput.value.advisorId) {
          this.controller.switchAdvisor(switchOutput.value.advisorId);
        }
      }
      this.printAdvisorsOutput(advisorOutput as CLIAdvisorsOutput);
      return;
    }

    const controllerOutput = this.controller.handleCommand(input);
    if ((controllerOutput as { readonly kind: string }).kind !== 'unknown') {
      this.printControllerOutput(controllerOutput as CLIControllerOutput);
      return;
    }

    const command = (advisorOutput as { readonly kind: 'unknown'; readonly command: string }).command.toLowerCase();

    switch (command) {
      case '/help':
        this.printHelp();
        break;
      case '/clear':
        this.config.memory.clearSession(this.currentSessionId);
        console.log('Session cleared.');
        break;
      case '/session':
        this.printSessionInfo();
        break;
      case '/tools':
        this.printTools();
        break;
      case '/exit':
      case '/quit':
        console.log('Goodbye!');
        this.stop();
        break;
      default:
        throw new CLICommandError(`Unknown command: ${command}. Type /help for available commands.`);
    }
  }

  /**
   * Handles a regular chat message by executing the agent.
   * Automatically routes through ContextRouter if no advisor is selected.
   */
  private async handleChat(input: string): Promise<void> {
    const activeAdvisorId = this.advisorHandler.getActiveAdvisorId();
    const prompt = input;

    if (!activeAdvisorId) {
      const routeResult = this.advisorHandler.routeInput(input);
      if (routeResult.advisor) {
        console.log(
          `[auto-routed] -> ${routeResult.advisor.name} (confidence: ${(routeResult.confidence * 100).toFixed(0)}%)`,
        );
      }
    }

    const result = await this.executeTurn(prompt);
    console.log(`\n${result.response}\n`);
  }

  /**
   * Executes a single agent turn for the given user prompt.
   */
  private async executeTurn(prompt: string): Promise<CLITurnResult> {
    const sessionId = this.currentSessionId;

    // Ensure the session exists in both conversation memory and session manager
    if (!this.config.memory.getSession(sessionId)) {
      this.config.memory.createSession(sessionId);
    }
    if (!this.config.sessionManager.getSession(sessionId)) {
      this.config.sessionManager.createSession({
        id: sessionId,
        label: 'CLI Session',
      });
    }

    const options: AgentExecuteOptions = {
      sessionId,
      prompt,
      onToken: (token: string) => {
        process.stdout.write(token);
      },
    };

    try {
      const result = await this.config.agentExecutor.execute(options);
      return {
        sessionId,
        response: result.response.content,
        streamed: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        sessionId,
        response: `[error] ${message}`,
        streamed: false,
      };
    }
  }

  /**
   * Prints controller-specific command output.
   */
  private printControllerOutput(output: CLIControllerOutput): void {
    switch (output.kind) {
      case 'active': {
        const { active, advisorId, workspaceId, sessionId } = output.value;
        console.log(`\nActive Advisor:`);
        console.log(`  Active: ${active}`);
        console.log(`  Advisor ID: ${advisorId ?? 'none'}`);
        console.log(`  Workspace ID: ${workspaceId ?? 'none'}`);
        console.log(`  Session ID: ${sessionId ?? 'none'}`);
        console.log('');
        break;
      }
      case 'session': {
        const { sessionId, advisorId, workspaceId, messageCount, status } = output.value;
        console.log(`\nSession Info:`);
        console.log(`  Session ID: ${sessionId}`);
        console.log(`  Advisor ID: ${advisorId}`);
        console.log(`  Workspace ID: ${workspaceId}`);
        console.log(`  Messages: ${messageCount}`);
        console.log(`  Status: ${status}`);
        console.log('');
        break;
      }
      case 'sessions': {
        const { sessions } = output.value;
        console.log(`\nSessions (${sessions.length}):`);
        for (const session of sessions) {
          console.log(`  [${session.sessionId}] advisor=${session.advisorId} messages=${session.messageCount} status=${session.status}`);
        }
        console.log('');
        break;
      }
      case 'collaboration': {
        const { pendingReviews, pendingQuestions, sharedNotes } = output.value;
        console.log(`\nCollaboration Status:`);
        console.log(`  Pending Reviews: ${pendingReviews}`);
        console.log(`  Pending Questions: ${pendingQuestions}`);
        console.log(`  Shared Notes: ${sharedNotes}`);
        console.log('');
        break;
      }
      case 'resume': {
        const { project, advisor, currentGoal, lastDecision, pendingTasks, summary } = output.value;
        console.log(`\nResume Info:`);
        console.log(`  Project: ${project}`);
        console.log(`  Advisor: ${advisor ?? 'none'}`);
        console.log(`  Current Goal: ${currentGoal ?? 'none'}`);
        console.log(`  Last Decision: ${lastDecision ?? 'none'}`);
        console.log(`  Pending Tasks: ${pendingTasks}`);
        console.log(`  Summary: ${summary ?? 'none'}`);
        console.log('');
        break;
      }
    }
  }

  /**
   * Prints advisor-specific command output.
   */
  private printAdvisorsOutput(output: CLIAdvisorsOutput): void {
    switch (output.kind) {
      case 'advisors': {
        const { advisors } = output.value;
        console.log(`\nAvailable Advisors (${advisors.length}):`);
        for (const advisor of advisors) {
          console.log(`  [${advisor.id}] ${advisor.name}`);
          console.log(`    Specialty: ${advisor.specialty}`);
          console.log(`    Role: ${advisor.role}`);
        }
        console.log('');
        break;
      }
      case 'route': {
        const { query, advisor, matchedBy, confidence, matchedKeywords } = output.value;
        console.log(`\nRouting query: "${query}"`);
        console.log(`Matched by: ${matchedBy}`);
        console.log(`Confidence: ${(confidence * 100).toFixed(0)}%`);
        if (advisor) {
          console.log(`Selected advisor: ${advisor.name} (${advisor.id})`);
          console.log(`Specialty: ${advisor.specialty}`);
        } else {
          console.log('No specific advisor matched. Using default agent.');
        }
        if (matchedKeywords.length > 0) {
          console.log(`Matched keywords: ${matchedKeywords.join(', ')}`);
        }
        console.log('');
        break;
      }
      case 'switch': {
        const { message } = output.value;
        console.log(`\n${message}\n`);
        break;
      }
    }
  }

  /**
   * Prints the help message with available commands.
   */
  private printHelp(): void {
    console.log(`
Cupaw AI Platform CLI

Available commands:
  /help        Show this help message
  /clear       Clear the current conversation session
  /session     Show current session information
  /tools       List all registered tools
  /advisors    List all available advisors
  /route <query>  Route a query to the best advisor
  /switch <advisorId>  Switch to a specific advisor
  /active      Show currently active advisor details
  /sessions    List all conversation sessions
  /collaboration  Show collaboration status
  /resume      Show resume information
  /exit, /quit Exit the CLI

Any other input will be sent to the AI agent as a chat message.
    `.trim());
  }

  /**
   * Prints information about the current session.
   */
  private printSessionInfo(): void {
    const session = this.config.memory.getSession(this.currentSessionId);
    const securitySession = this.config.sessionManager.getSession(this.currentSessionId);

    console.log(`\nSession ID: ${this.currentSessionId}`);
    console.log(`Conversation messages: ${session?.messages.length ?? 0}`);

    if (securitySession) {
      console.log(`Security status: ${securitySession.status}`);
      console.log(`Created at: ${new Date(securitySession.createdAt).toISOString()}`);
    }

    const activeAdvisorId = this.advisorHandler.getActiveAdvisorId();
    if (activeAdvisorId) {
      console.log(`Active advisor: ${activeAdvisorId}`);
    }

    const pendingApprovals = this.config.authorizationEngine.getPendingApprovals(this.currentSessionId);
    if (pendingApprovals.length > 0) {
      console.log(`Pending approvals: ${pendingApprovals.length}`);
    }

    console.log('');
  }

  /**
   * Prints all registered tools.
   */
  private printTools(): void {
    const tools = this.config.toolRegistry.getAllTools();
    console.log(`\nRegistered tools (${tools.length}):`);
    for (const tool of tools) {
      console.log(`  - ${tool.name}: ${tool.description}`);
    }
    console.log('');
  }
}
