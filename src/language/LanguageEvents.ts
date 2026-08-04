/**
 * Event type names for language service lifecycle events.
 *
 * These are definitions only — events are not published yet. They are
 * reserved for future integration with the Event Bus.
 */
export const LanguageEvents = {
  /** Published when a file is parsed. */
  FILE_PARSED: 'language.file.parsed',

  /** Published when symbol extraction completes. */
  SYMBOLS_EXTRACTED: 'language.symbols.extracted',

  /** Published when imports are extracted. */
  IMPORTS_EXTRACTED: 'language.imports.extracted',

  /** Published when a parse error occurs. */
  PARSE_FAILED: 'language.parse.failed',
} as const;

/**
 * Represents the type of language service lifecycle events.
 */
export type LanguageEventType =
  (typeof LanguageEvents)[keyof typeof LanguageEvents];