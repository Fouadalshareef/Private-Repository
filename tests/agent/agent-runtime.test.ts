import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BaseAgent } from '../../src/agent/base-agent.js';
import { AgentRuntime } from '../../src/agent/agent-runtime.js';
import { AgentExecutionContext } from '../../src/agent/agent-context.js';
import {
  AgentRuntimeStatus,
  AgentLifecycleError,
  InvalidAgentStateError,
  AgentRuntimeNotFoundError,
} from '../../src/agent/types.js';
import { ShortTermMemory } from '../../src/memory/short-term-memory.js';
import { LongTermMemory } from '../../src/memory/long-term-memory.js';
import { ProjectContextStore } from '../../src/memory/project-context-store.js';
import type { MemoryBundle } from '../../src/memory/types.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'cupaw-agent-')); // memo
}

describe('Agent Lifecycle (unit)', () => {
  it('starts in Idle status', () => {
    const agent = new BaseAgent({ agentId: 'a1' });
    expect(agent.getState().status).toBe(AgentRuntimeStatus.Idle);
    expect(agent.getState().cycleCount).toBe(0);
  });

  it('transitions Idle -> Running -> Idle on execute and increments cycles', async () => {
    const agent = new BaseAgent({ agentId: 'a1', handler: async (input) => ({ output: `ran:${input}` }) });
    const result = await agent.execute('go');
    expect(result.output).toBe('ran:go');
    expect(agent.getState().status).toBe(AgentRuntimeStatus.Idle);
    expect(agent.getState().cycleCount).toBe(1);
  });

  it('can execute from Paused (resume)', async () => {
    let release: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const agent = new BaseAgent({
      agentId: 'a1',
      handler: async () => {
        await waiting;
        return { output: 1 };
      },
    });

    const execution = agent.execute('x');
    await new Promise((resolve) => setImmediate(resolve));
    expect(agent.getState().status).toBe(AgentRuntimeStatus.Running);
    agent.pause();
    expect(agent.getState().status).toBe(AgentRuntimeStatus.Paused);
    agent.resume();
    release!();
    const result = await execution;
    expect(result.output).toBe(1);
    expect(agent.getState().status).toBe(AgentRuntimeStatus.Idle);
  });

  it('moves to Failed on handler error and captures lastError', async () => {
    const agent = new BaseAgent({
      agentId: 'a1',
      handler: async () => {
        throw new Error('boom');
      },
    });
    await expect(agent.execute('x')).rejects.toBeInstanceOf(AgentLifecycleError);
    const state = agent.getState();
    expect(state.status).toBe(AgentRuntimeStatus.Failed);
    expect(state.lastError).toBe('boom');
  });

  it('rejects execute when not Idle/Paused (e.g. Terminated)', async () => {
    const agent = new BaseAgent({ agentId: 'a1', handler: async () => ({ output: 1 }) });
    agent.terminate();
    expect(agent.getState().status).toBe(AgentRuntimeStatus.Terminated);
    await expect(agent.execute('x')).rejects.toBeInstanceOf(InvalidAgentStateError);
  });

  it('pause only valid from Running', async () => {
    let release: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const agent = new BaseAgent({
      agentId: 'a1',
      handler: async () => {
        await waiting;
        return { output: 1 };
      },
    });

    const execution = agent.execute('x');
    await new Promise((resolve) => setImmediate(resolve));
    expect(agent.getState().status).toBe(AgentRuntimeStatus.Running);
    agent.pause();
    expect(agent.getState().status).toBe(AgentRuntimeStatus.Paused);
    release!();
    await execution;
  });

  it('evaluate valid from Idle/Running, invalid from Terminated', async () => {
    const agent = new BaseAgent({ agentId: 'a1', handler: async () => ({ output: 1 }) });
    expect(() => agent.evaluate({ output: 1 })).not.toThrow();
    await agent.execute('x');
    expect(() => agent.evaluate({ output: 2 })).not.toThrow();
    agent.terminate();
    expect(() => agent.evaluate({ output: 3 })).toThrow(InvalidAgentStateError);
  });

  it('reset recovers a Failed agent but not a Terminated one', async () => {
    const failAgent = new BaseAgent({ agentId: 'a1', handler: async () => { throw new Error('e'); } });
    await expect(failAgent.execute('x')).rejects.toThrow();
    failAgent.reset();
    expect(failAgent.getState().status).toBe(AgentRuntimeStatus.Idle);

    const termAgent = new BaseAgent({ agentId: 'a2' });
    termAgent.terminate();
    expect(() => termAgent.reset()).toThrow(InvalidAgentStateError);
  });

  it('default handler echoes input (provider-agnostic)', async () => {
    const agent = new BaseAgent({ agentId: 'a1' });
    const result = await agent.execute('hello');
    expect(result.output).toBe('hello');
  });

  it('returns a frozen, independent state snapshot', () => {
    const agent = new BaseAgent({ agentId: 'a1' });
    const s1 = agent.getState();
    expect(Object.isFrozen(s1)).toBe(true);
    agent.terminate();
    const s2 = agent.getState();
    expect(s2.status).toBe(AgentRuntimeStatus.Terminated);
    expect(s1.status).toBe(AgentRuntimeStatus.Idle);
  });

  it('executeAgent result is frozen', async () => {
    const agent = new BaseAgent({ agentId: 'a1', handler: async () => ({ output: { a: 1 }, metadata: { step: 1 } }) });
    const result = await agent.execute('x');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.metadata)).toBe(true);
  });
});

describe('Context Isolation (unit)', () => {
  it('isolates context between two agents using internal storage', () => {
    const a = new BaseAgent({ agentId: 'agent-a' });
    const b = new BaseAgent({ agentId: 'agent-b' });

    a.getContext().remember('secret', 'AAA');
    b.getContext().remember('secret', 'BBB');

    expect(a.getContext().recall('secret')).toBe('AAA');
    expect(b.getContext().recall('secret')).toBe('BBB');
    expect(a.getContext().recall('missing')).toBeUndefined();
  });

  it('isolates context between two agents backed by a shared memory store', async () => {
    const dir = await makeTempDir();
    const bundle: MemoryBundle = {
      shortTerm: new ShortTermMemory(),
      longTerm: new LongTermMemory({ baseDir: dir }),
      projectContext: new ProjectContextStore({ baseDir: dir }),
    };

    const a = new BaseAgent({ agentId: 'agent-a', memory: bundle });
    const b = new BaseAgent({ agentId: 'agent-b', memory: bundle });

    a.getContext().remember('goal', 'build API');
    b.getContext().remember('goal', 'design DB');

    // Same underlying store, scoped by agentId -> no cross-contamination.
    expect(a.getContext().recall('goal')).toBe('build API');
    expect(b.getContext().recall('goal')).toBe('design DB');
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('project context lookup uses the memory bundle', async () => {
    const dir = await makeTempDir();
    const bundle: MemoryBundle = {
      shortTerm: new ShortTermMemory(),
      projectContext: new ProjectContextStore({ baseDir: dir }),
    };
    const agent = new BaseAgent({ agentId: 'agent-a', memory: bundle });
    agent.getContext().setProjectId('proj-x');
    await bundle.projectContext!.addNote('proj-x', 'architecture', 'use events');
    const ctx = (await agent.getContext().getProjectContext()) as { notes: unknown[] } | undefined;
    expect(ctx?.notes).toHaveLength(1);
    await fs.rm(dir, { recursive: true, force: true });
  });
});

describe('AgentRuntime (integration with memory)', () => {
  it('creates, tracks, executes, and terminates agents via a unified runtime', async () => {
    const dir = await makeTempDir();
    const bundle: MemoryBundle = {
      shortTerm: new ShortTermMemory(),
      longTerm: new LongTermMemory({ baseDir: dir }),
      projectContext: new ProjectContextStore({ baseDir: dir }),
    };
    const runtime = new AgentRuntime({ memory: bundle });

    const agent = runtime.createAgent({
      agentId: 'agent-1',
      handler: async (input, ctx) => {
        ctx.remember('lastInput', input);
        return { output: `done:${String(input)}` };
      },
    });

    expect(runtime.getAgent('agent-1')).toBe(agent);
    expect(runtime.listAgents()).toHaveLength(1);
    expect(Object.isFrozen(runtime.listAgents())).toBe(true);

    const result = await runtime.executeAgent('agent-1', 'work');
    expect(result.output).toBe('done:work');
    // Handler wrote into the shared memory store, scoped to this agent.
    expect(agent.getContext().recall('lastInput')).toBe('work');

    await runtime.terminateAgent('agent-1');
    expect(runtime.getAgent('agent-1')!.getState().status).toBe(AgentRuntimeStatus.Terminated);

    await fs.rm(dir, { recursive: true, force: true });
  });

  it('throws AgentRuntimeNotFoundError for unknown agents', () => {
    const runtime = new AgentRuntime();
    expect(() => runtime.requireAgent('ghost')).toThrow(AgentRuntimeNotFoundError);
    expect(() => runtime.createAgent({ agentId: 'ghost' })).not.toThrow();
    expect(() => runtime.createAgent({ agentId: 'ghost' })).toThrow();
  });

  it('binds runtime memory to created agents automatically', async () => {
    const dir = await makeTempDir();
    const bundle: MemoryBundle = {
      shortTerm: new ShortTermMemory(),
      longTerm: new LongTermMemory({ baseDir: dir }),
    };
    const runtime = new AgentRuntime({ memory: bundle });
    const agent = runtime.createAgent({ agentId: 'a1', handler: async () => ({ output: 1 }) });
    // Agent should use the runtime's memory bundle.
    agent.getContext().remember('k', 'v');
    expect(bundle.shortTerm.get('a1', 'k')?.value).toBe('v');
    await fs.rm(dir, { recursive: true, force: true });
  });
});

describe('AgentExecutionContext (unit)', () => {
  it('returns frozen recalled values (immutability)', () => {
    const ctx = new AgentExecutionContext('a1');
    const original = { nested: { a: 1 } };
    ctx.remember('obj', original);
    original.nested.a = 999; // mutate caller copy; stored copy must be isolated
    const recalled = ctx.recall('obj') as { nested: { a: number } };
    expect(Object.isFrozen(recalled)).toBe(true);
    expect(recalled.nested.a).toBe(1);
  });
});
