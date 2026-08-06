export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Simulates a safe, sandboxed terminal environment.
 *
 * No real shell is spawned. A fixed set of whitelisted commands is
 * executed in-memory to prevent arbitrary code execution.
 */
export class SimulatedTerminal {
  private readonly maxOutputLength: number;
  private readonly workingDirectory: string;

  constructor(options: { readonly maxOutputLength?: number; readonly workingDirectory?: string } = {}) {
    this.maxOutputLength = options.maxOutputLength ?? 4096;
    this.workingDirectory = options.workingDirectory ?? '/';
  }

  async execute(commandLine: string, timeoutMs: number): Promise<CommandResult> {
    const trimmed = commandLine.trim();
    if (trimmed.length === 0) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: 'Error: empty command.',
      };
    }

    const parts = this.parseCommand(trimmed);
    const command = parts[0] ?? '';
    const args = parts.slice(1);

    const timeoutPromise = new Promise<CommandResult>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Command timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
    });

    const executionPromise = (async (): Promise<CommandResult> => {
      try {
        const result = await this.dispatch(command, args);
        return {
          exitCode: 0,
          stdout: this.truncate(result),
          stderr: '',
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          exitCode: 1,
          stdout: '',
          stderr: this.truncate(message),
        };
      }
    })();

    return Promise.race([executionPromise, timeoutPromise]);
  }

  private parseCommand(commandLine: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < commandLine.length; i++) {
      const char = commandLine[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === ' ' && !inQuotes) {
        if (current.length > 0) {
          parts.push(current);
          current = '';
        }
        continue;
      }
      current += char;
    }

    if (current.length > 0) {
      parts.push(current);
    }

    return parts;
  }

  private async dispatch(command: string, args: string[]): Promise<string> {
    switch (command) {
      case 'echo':
        return args.join(' ') || '';
      case 'pwd':
        return this.workingDirectory;
      case 'ls':
        return `(simulated) ${args.join('  ')}`;
      case 'date':
        return new Date().toISOString();
      case 'whoami':
        return 'agent';
      case 'help':
        return 'Available commands: echo, pwd, ls, date, whoami, help, clear, env, sleep';
      case 'clear':
        return '';
      case 'env':
        return `NODE_ENV=simulated\nWORKSPACE=${this.workingDirectory}`;
      case 'sleep': {
        const ms = args[0] !== undefined ? Number(args[0]) : 0;
        if (!Number.isFinite(ms) || ms < 0) {
          throw new Error(`sleep: invalid duration "${args[0]}"`);
        }
        await new Promise((resolve) => setTimeout(resolve, ms));
        return '';
      }
      default:
        throw new Error(`Unknown command: "${command}". Type "help" for available commands.`);
    }
  }

  private truncate(text: string): string {
    if (text.length <= this.maxOutputLength) {
      return text;
    }
    return text.slice(0, this.maxOutputLength) + '\n... (output truncated)';
  }
}

export class ExecuteCommandTool {
  readonly name = 'terminal.execute';
  readonly description = 'Executes a sandboxed terminal command with timeout and output limits.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      command: {
        type: 'string' as const,
        description: 'The terminal command to execute (e.g., "echo Hello").',
      },
      timeoutMs: {
        type: 'integer' as const,
        description: 'Optional timeout in milliseconds. Defaults to 5000.',
      },
    },
    required: ['command'] as readonly string[],
  } as const;

  constructor(private readonly terminal: SimulatedTerminal) {}

  handler(args: Record<string, unknown>): Promise<string> {
    const command = String(args.command ?? '');
    const timeoutMs = args.timeoutMs !== undefined ? Number(args.timeoutMs) : 5000;

    if (command.trim().length === 0) {
      return Promise.resolve('Error: command must not be empty.');
    }

    return this.terminal.execute(command, timeoutMs).then((result) => {
      const parts: string[] = [];
      if (result.stdout.length > 0) {
        parts.push(result.stdout);
      }
      if (result.stderr.length > 0) {
        parts.push(`[stderr] ${result.stderr}`);
      }
      const output = parts.join('\n');
      return output || '(command executed successfully with no output)';
    }).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      return `[error] ${message}`;
    });
  }
}
