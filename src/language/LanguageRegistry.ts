import { LanguageType } from './LanguageType.js';

/**
 * Maps file extensions to their corresponding {@link LanguageType}.
 *
 * This registry is used by the {@link LanguageService} to detect the
 * language of a file based on its extension.
 */
export class LanguageRegistry {
  private readonly extensionMap: Map<string, LanguageType>;

  constructor() {
    this.extensionMap = new Map<string, LanguageType>();
    this.registerDefaults();
  }

  /**
   * Registers a file extension to a language type.
   * @param extension The file extension (including leading dot, e.g., `.ts`).
   * @param language The language type.
   */
  public register(extension: string, language: LanguageType): void {
    this.extensionMap.set(extension.toLowerCase(), language);
  }

  /**
   * Returns the language type for the given extension.
   * @param extension The file extension (including leading dot).
   * @returns The language type, or `LanguageType.UNKNOWN` if not registered.
   */
  public getLanguage(extension: string): LanguageType {
    return this.extensionMap.get(extension.toLowerCase()) ?? LanguageType.UNKNOWN;
  }

  /**
   * Returns whether the given extension is registered.
   * @param extension The file extension.
   * @returns `true` if registered, `false` otherwise.
   */
  public has(extension: string): boolean {
    return this.extensionMap.has(extension.toLowerCase());
  }

  /**
   * Registers the default extension-to-language mappings.
   */
  private registerDefaults(): void {
    // TypeScript
    this.register('.ts', LanguageType.TYPESCRIPT);
    this.register('.tsx', LanguageType.TYPESCRIPT);

    // JavaScript
    this.register('.js', LanguageType.JAVASCRIPT);
    this.register('.jsx', LanguageType.JAVASCRIPT);
    this.register('.mjs', LanguageType.JAVASCRIPT);
    this.register('.cjs', LanguageType.JAVASCRIPT);

    // Python
    this.register('.py', LanguageType.PYTHON);

    // HTML
    this.register('.html', LanguageType.HTML);
    this.register('.htm', LanguageType.HTML);

    // CSS
    this.register('.css', LanguageType.CSS);

    // JSON
    this.register('.json', LanguageType.JSON);
  }
}