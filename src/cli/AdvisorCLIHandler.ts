import { CLICommandError } from './CLIError.js';
import { AdvisorCatalog } from '../advisors/AdvisorCatalog.js';
import { ContextRouter } from '../advisors/ContextRouter.js';
import { createAdvisorId } from '../advisors/AdvisorIdentity.js';
import type { AdvisorId } from '../advisors/AdvisorIdentity.js';

/**
 * Frozen output for the `/advisors` command.
 */
export interface AdvisorsListOutput {
  readonly advisors: readonly AdvisorInfo[];
}

export interface AdvisorInfo {
  readonly id: string;
  readonly name: string;
  readonly specialty: string;
  readonly role: string;
}

/**
 * Frozen output for the `/route` command.
 */
export interface RouteQueryOutput {
  readonly query: string;
  readonly advisor: AdvisorInfo | undefined;
  readonly matchedBy: string | undefined;
  readonly confidence: number;
  readonly matchedKeywords: readonly string[];
}

/**
 * Frozen output for the `/switch` command.
 */
export interface SwitchAdvisorOutput {
  readonly advisorId: string | undefined;
  readonly message: string;
}

/**
 * CLI command outputs - all immutable.
 */
export type CLIAdvisorsOutput =
  | { readonly kind: 'advisors'; readonly value: AdvisorsListOutput }
  | { readonly kind: 'route'; readonly value: RouteQueryOutput }
  | { readonly kind: 'switch'; readonly value: SwitchAdvisorOutput };

/**
 * Handles advisor-specific CLI commands and automatic routing.
 */
export class AdvisorCLIHandler {
  private readonly catalog: AdvisorCatalog;
  private readonly router: ContextRouter;
  private currentAdvisorId: AdvisorId | undefined;

  constructor() {
    this.catalog = new AdvisorCatalog();
    this.router = new ContextRouter(this.catalog);
    this.currentAdvisorId = undefined;
  }

  /**
   * Returns the currently selected advisor id, or undefined.
   */
  public getActiveAdvisorId(): string | undefined {
    return this.currentAdvisorId;
  }

  /**
   * Routes user input through the ContextRouter if no advisor is explicitly selected.
   */
  public routeInput(input: string): RouteQueryOutput {
    const routingResult = this.router.route({
      input,
      preferredAdvisorId: this.currentAdvisorId,
    });

    const advisor = routingResult.advisor;

    return Object.freeze({
      query: input,
      advisor: advisor
        ? Object.freeze({
            id: String(advisor.id),
            name: advisor.profile.name,
            specialty: advisor.profile.specialty,
            role: advisor.profile.metadata.role,
          })
        : undefined,
      matchedBy: routingResult.matchedBy,
      confidence: routingResult.confidence,
      matchedKeywords: Object.freeze([...routingResult.matchedKeywords]),
    });
  }

  /**
   * Switches the active advisor for this CLI session.
   */
  public switchAdvisor(advisorId: string): SwitchAdvisorOutput {
    const id = advisorId.trim();
    const advisor = this.catalog.get(createAdvisorId(id));

    if (!advisor) {
      return Object.freeze({
        advisorId: undefined,
        message: `Advisor not found: "${id}". Use /advisors to list available advisors.`,
      });
    }

    this.currentAdvisorId = createAdvisorId(String(advisor.id));
    return Object.freeze({
      advisorId: this.currentAdvisorId,
      message: `Switched to advisor: ${advisor.profile.name} (${advisor.profile.specialty})`,
    });
  }

  /**
   * Lists all available advisors from the catalog.
   */
  public listAdvisors(): AdvisorsListOutput {
    const advisors = this.catalog.getAll().map((advisor) =>
      Object.freeze({
        id: String(advisor.id),
        name: advisor.profile.name,
        specialty: advisor.profile.specialty,
        role: advisor.profile.metadata.role,
      }),
    );

    return Object.freeze({
      advisors: Object.freeze(advisors),
    });
  }

  /**
   * Handles a raw advisor command input.
   */
  public handleCommand(input: string): CLIAdvisorsOutput | { readonly kind: 'unknown'; readonly command: string } {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) {
      throw new CLICommandError('Advisor command must start with "/".');
    }

    const parts = trimmed.split(' ');
    const command = parts[0].toLowerCase();

    switch (command) {
      case '/advisors': {
        const result = this.listAdvisors();
        return Object.freeze({ kind: 'advisors', value: result });
      }
      case '/route': {
        const query = parts.slice(1).join(' ').trim();
        if (!query) {
          throw new CLICommandError('Usage: /route <query>');
        }
        const result = this.routeInput(query);
        return Object.freeze({ kind: 'route', value: result });
      }
      case '/switch': {
        const advisorId = parts.slice(1).join(' ').trim();
        if (!advisorId) {
          throw new CLICommandError('Usage: /switch <advisorId>');
        }
        const result = this.switchAdvisor(advisorId);
        return Object.freeze({ kind: 'switch', value: result });
      }
      default:
        return Object.freeze({ kind: 'unknown', command });
    }
  }
}
