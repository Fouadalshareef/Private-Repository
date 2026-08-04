/**
 * Defines the supported programming languages for parsing.
 *
 * - `typescript`: TypeScript files (`.ts`, `.tsx`).
 * - `javascript`: JavaScript files (`.js`, `.jsx`, `.mjs`, `.cjs`).
 * - `python`: Python files (`.py`).
 * - `html`: HTML files (`.html`, `.htm`).
 * - `css`: CSS files (`.css`).
 * - `json`: JSON files (`.json`).
 * - `unknown`: Files that do not match any known language.
 */
export enum LanguageType {
  TYPESCRIPT = 'typescript',
  JAVASCRIPT = 'javascript',
  PYTHON = 'python',
  HTML = 'html',
  CSS = 'css',
  JSON = 'json',
  UNKNOWN = 'unknown',
}