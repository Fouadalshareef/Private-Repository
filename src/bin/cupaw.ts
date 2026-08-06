import { Bootstrap } from '../bootstrap/Bootstrap.js';
import { LogLevel } from '../logging/LogLevel.js';
import { createCLIConfig } from '../cli/CLIConfig.js';
import { CupawCLI } from '../cli/CupawCLI.js';

/**
 * Cupaw AI Platform - CLI Entry Point
 *
 * Bootstraps the core foundation, wires all modules together,
 * and starts the interactive REPL shell.
 */
async function main(): Promise<void> {
  try {
    // 1. Bootstrap core foundation services
    const bootstrap = new Bootstrap({
      options: { logLevel: LogLevel.INFO },
    });
    const bootstrapResult = bootstrap.initialize();

    // 2. Wire all modules together via CLI config
    const config = createCLIConfig({
      configuration: bootstrapResult.configuration,
      logger: bootstrapResult.logger,
      eventBus: bootstrapResult.eventBus,
      container: bootstrapResult.container,
    });

    // 3. Start the interactive CLI
    const cli = new CupawCLI(config);
    cli.start();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to start Cupaw CLI: ${message}`);
    process.exit(1);
  }
}

main();
