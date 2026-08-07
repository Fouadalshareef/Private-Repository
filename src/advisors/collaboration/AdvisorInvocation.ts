import type { AdvisorId } from '../AdvisorIdentity.js';

/**
 * Status of an invocation.
 */
export enum InvocationStatus {
  SENT = 'sent',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled',
}

/**
 * Immutable record of advisor-to-advisor invocation.
 */
export interface AdvisorInvocation {
  readonly invocationId: string;
  readonly callerAdvisor: AdvisorId;
  readonly targetAdvisor: AdvisorId;
  readonly reason: string;
  readonly timestamp: number;
  readonly status: InvocationStatus;
  readonly response?: string;
}

/**
 * Creates a frozen AdvisorInvocation instance.
 */
export function createAdvisorInvocation(invocation: AdvisorInvocation): AdvisorInvocation {
  return Object.freeze({
    ...invocation,
    callerAdvisor: invocation.callerAdvisor,
    targetAdvisor: invocation.targetAdvisor,
  });
}
