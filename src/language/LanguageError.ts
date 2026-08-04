/**
 * Base error thrown by the language services.
 */
export class LanguageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LanguageError';
    Object.setPrototypeOf(this, LanguageError.prototype);
  }
}

/**
 * Thrown when a file extension does not map to a known language.
 */
export class UnsupportedLanguageError extends LanguageError {
  constructor(extension: string) {
    super(`Unsupported language for extension: "${extension}"`);
    this.name = 'UnsupportedLanguageError';
    Object.setPrototypeOf(this, UnsupportedLanguageError.prototype);
  }
}

/**
 * Thrown when parsing fails due to invalid content.
 */
export class ParseError extends LanguageError {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
    Object.setPrototypeOf(this, ParseError.prototype);
  }
}