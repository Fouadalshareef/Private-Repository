export interface IPromptTemplate {
  readonly id: string;
  readonly template: string;
  readonly description?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface PromptRenderOptions {
  readonly variables: Readonly<Record<string, unknown>>;
  readonly strict?: boolean;
}

export interface PromptRenderResult {
  readonly content: string;
  readonly usedVariables: Readonly<Record<string, unknown>>;
  readonly missingVariables: readonly string[];
}
