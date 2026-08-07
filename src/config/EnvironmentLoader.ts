/**
 * Loads configuration values from environment variables and .env files.
 *
 * No keys are stored inside the project. All secrets come from the environment.
 */
export class EnvironmentLoader {
  private readonly env: Record<string, string | undefined>;

  constructor(env?: Record<string, string | undefined>) {
    this.env = env ?? process.env;
  }

  /**
   * Loads AI-related environment variables.
   *
   * @returns An object with AI configuration values.
   */
  loadAIEnv(): {
    readonly openaiApiKey: string | undefined;
    readonly geminiApiKey: string | undefined;
    readonly anthropicApiKey: string | undefined;
    readonly openrouterApiKey: string | undefined;
    readonly ollamaHost: string | undefined;
  } {
    return {
      openaiApiKey: this.env.OPENAI_API_KEY,
      geminiApiKey: this.env.GEMINI_API_KEY,
      anthropicApiKey: this.env.ANTHROPIC_API_KEY,
      openrouterApiKey: this.env.OPENROUTER_API_KEY,
      ollamaHost: this.env.OLLAMA_HOST,
    };
  }

  /**
   * Loads a simple .env file into the environment.
   *
   * @param filePath Path to the .env file.
   * @returns The parsed key-value pairs.
   */
  async loadEnvFile(filePath: string): Promise<Record<string, string>> {
    const fs = await import('fs');
    const path = await import('path');

    const resolvedPath = path.resolve(filePath);
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const result: Record<string, string> = {};

    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      result[key] = value;
    }

    return result;
  }
}
