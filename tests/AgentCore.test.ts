import { describe, it, expect, beforeEach } from 'vitest';
import {
  AgentPriorities,
  AgentStatus,
  createAgentId,
  createAgentProfile,
  createAgentMetadata,
  AgentCapabilities,
  createCapability,
  AgentRoles,
  createRole,
  AgentState,
  AgentRegistryError,
  AgentAlreadyExistsError,
  AgentNotFoundError,
  InvalidAgentError,
  AgentStateError,
  AgentCapabilityMatcher,
  AgentFactory,
  AgentRegistry,
  AgentManager,
  AgentEvents,
} from '../src/agents/index.js';
import { EventBus } from '../src/events/EventBus.js';
import type { IAgent } from '../src/agents/IAgent.js';
import type {
  AgentRegisteredPayload,
  AgentRemovedPayload,
  AgentEnabledPayload,
  AgentDisabledPayload,
  AgentActivatedPayload,
  AgentDeactivatedPayload,
  AgentStatusChangedPayload,
  AgentHeartbeatPayload,
} from '../src/agents/AgentEvents.js';

function createTestAgent(id: string = 'agent-1', role: string = AgentRoles.SOFTWARE_ENGINEER): IAgent {
  const factory = new AgentFactory();
  return factory.create({
    id: createAgentId(id),
    profile: {
      name: 'Test Agent',
      title: 'Test Engineer',
      description: 'A test agent',
      avatar: 'avatar.png',
    },
    role: createRole(role),
    capabilities: [createCapability(AgentCapabilities.CODING), createCapability(AgentCapabilities.TESTING)],
    priority: AgentPriorities.MEDIUM,
    status: AgentStatus.Idle,
    version: '1.0.0',
    author: 'test-author',
    tags: ['test', 'agent'],
    metadata: { team: 'core' },
    supportedTasks: ['code', 'test'],
  });
}

describe('AgentIdentity', () => {
  it('should create an AgentId from a string', () => {
    const id = createAgentId('agent-1');
    expect(String(id)).toBe('agent-1');
  });

  it('should create a frozen AgentProfile copy', () => {
    const profile = createAgentProfile({ name: 'A', title: 'T', description: 'D', avatar: 'av' });
    expect(profile.name).toBe('A');
    expect(Object.isFrozen(profile)).toBe(true);
  });

  it('should create a frozen AgentMetadata copy', () => {
    const metadata = createAgentMetadata({ key: 'value' });
    expect(metadata.key).toBe('value');
    expect(Object.isFrozen(metadata)).toBe(true);
  });

  it('should have correct priority constants', () => {
    expect(AgentPriorities.LOWEST).toBe(0);
    expect(AgentPriorities.LOW).toBe(25);
    expect(AgentPriorities.MEDIUM).toBe(50);
    expect(AgentPriorities.HIGH).toBe(75);
    expect(AgentPriorities.CRITICAL).toBe(100);
  });

  it('should have correct status enum values', () => {
    expect(AgentStatus.Idle).toBe('idle');
    expect(AgentStatus.Busy).toBe('busy');
    expect(AgentStatus.Thinking).toBe('thinking');
    expect(AgentStatus.Waiting).toBe('waiting');
    expect(AgentStatus.Offline).toBe('offline');
    expect(AgentStatus.Disabled).toBe('disabled');
    expect(AgentStatus.Error).toBe('error');
  });
});

describe('AgentCapabilities', () => {
  it('should have correct capability constants', () => {
    expect(AgentCapabilities.ARCHITECTURE).toBe('architecture');
    expect(AgentCapabilities.CODING).toBe('coding');
    expect(AgentCapabilities.REVIEW).toBe('review');
    expect(AgentCapabilities.TESTING).toBe('testing');
    expect(AgentCapabilities.SECURITY).toBe('security');
    expect(AgentCapabilities.PLANNING).toBe('planning');
    expect(AgentCapabilities.RESEARCH).toBe('research');
    expect(AgentCapabilities.TRANSLATION).toBe('translation');
    expect(AgentCapabilities.DESIGN).toBe('design');
    expect(AgentCapabilities.DEBUGGING).toBe('debugging');
    expect(AgentCapabilities.DOCUMENTATION).toBe('documentation');
  });

  it('should create a capability from a string', () => {
    expect(String(createCapability('custom-cap'))).toBe('custom-cap');
  });
});

describe('AgentRoles', () => {
  it('should have correct role constants', () => {
    expect(AgentRoles.CHIEF_AI_ARCHITECT).toBe('chief-ai-architect');
    expect(AgentRoles.SOFTWARE_ENGINEER).toBe('software-engineer');
    expect(AgentRoles.SENIOR_DEVELOPER).toBe('senior-developer');
    expect(AgentRoles.REVIEWER).toBe('reviewer');
    expect(AgentRoles.DESIGNER).toBe('designer');
    expect(AgentRoles.RESEARCHER).toBe('researcher');
    expect(AgentRoles.TESTER).toBe('tester');
    expect(AgentRoles.DEBUGGER).toBe('debugger');
    expect(AgentRoles.SECURITY_EXPERT).toBe('security-expert');
    expect(AgentRoles.PERFORMANCE_ENGINEER).toBe('performance-engineer');
    expect(AgentRoles.PLANNER).toBe('planner');
    expect(AgentRoles.DOCUMENTATION_WRITER).toBe('documentation-writer');
  });

  it('should create a role from a string', () => {
    expect(String(createRole('custom-role'))).toBe('custom-role');
  });
});

describe('AgentState', () => {
  it('should have correct state enum values', () => {
    expect(AgentState.Idle).toBe('idle');
    expect(AgentState.Busy).toBe('busy');
    expect(AgentState.Thinking).toBe('thinking');
    expect(AgentState.Waiting).toBe('waiting');
    expect(AgentState.Offline).toBe('offline');
    expect(AgentState.Disabled).toBe('disabled');
    expect(AgentState.Error).toBe('error');
  });
});

describe('AgentCapabilityMatcher', () => {
  it('should support a capability', () => {
    const matcher = new AgentCapabilityMatcher([createCapability(AgentCapabilities.CODING)]);
    expect(matcher.supports(createCapability(AgentCapabilities.CODING))).toBe(true);
    expect(matcher.supports(createCapability(AgentCapabilities.DESIGN))).toBe(false);
  });

  it('should support all capabilities', () => {
    const matcher = new AgentCapabilityMatcher([
      createCapability(AgentCapabilities.CODING),
      createCapability(AgentCapabilities.TESTING),
    ]);
    expect(
      matcher.supportsAll([
        createCapability(AgentCapabilities.CODING),
        createCapability(AgentCapabilities.TESTING),
      ]),
    ).toBe(true);
    expect(
      matcher.supportsAll([
        createCapability(AgentCapabilities.CODING),
        createCapability(AgentCapabilities.DESIGN),
      ]),
    ).toBe(false);
  });

  it('should support any capability', () => {
    const matcher = new AgentCapabilityMatcher([createCapability(AgentCapabilities.CODING)]);
    expect(
      matcher.supportsAny([
        createCapability(AgentCapabilities.DESIGN),
        createCapability(AgentCapabilities.CODING),
      ]),
    ).toBe(true);
    expect(
      matcher.supportsAny([
        createCapability(AgentCapabilities.DESIGN),
        createCapability(AgentCapabilities.SECURITY),
      ]),
    ).toBe(false);
  });

  it('should return a frozen snapshot', () => {
    const matcher = new AgentCapabilityMatcher([createCapability(AgentCapabilities.CODING)]);
    const snapshot = matcher.snapshot();
    expect(snapshot.length).toBe(1);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });
});

describe('AgentFactory', () => {
  let factory: AgentFactory;

  beforeEach(() => {
    factory = new AgentFactory();
  });

  it('should create an agent with defaults', () => {
    const agent = factory.create({
      id: createAgentId('a1'),
      role: createRole(AgentRoles.PLANNER),
    });
    expect(agent.id).toBe('a1');
    expect(agent.profile.name).toBe('unnamed-agent');
    expect(agent.profile.title).toBe('Untitled Agent');
    expect(agent.priority).toBe(50);
    expect(agent.status).toBe(AgentStatus.Idle);
    expect(agent.version).toBe('1.0.0');
    expect(agent.author).toBe('');
    expect(agent.tags).toEqual([]);
    expect(agent.metadata).toEqual({});
    expect(agent.supportedTasks).toEqual([]);
  });

  it('should create an agent with full definition', () => {
    const agent = factory.create({
      id: createAgentId('a2'),
      profile: { name: 'Arch', title: 'Architect', description: 'Designs', avatar: 'a.png' },
      role: createRole(AgentRoles.CHIEF_AI_ARCHITECT),
      capabilities: [createCapability(AgentCapabilities.ARCHITECTURE)],
      priority: AgentPriorities.HIGH,
      status: AgentStatus.Busy,
      version: '2.0.0',
      author: 'me',
      tags: ['arch'],
      metadata: { level: 'senior' },
      supportedTasks: ['design'],
    });
    expect(agent.profile.name).toBe('Arch');
    expect(agent.role).toBe(AgentRoles.CHIEF_AI_ARCHITECT);
    expect(agent.priority).toBe(75);
    expect(agent.status).toBe(AgentStatus.Busy);
    expect(agent.version).toBe('2.0.0');
    expect(agent.author).toBe('me');
    expect(agent.tags).toEqual(['arch']);
    expect(agent.metadata.level).toBe('senior');
    expect(agent.supportedTasks).toEqual(['design']);
  });

  it('should throw InvalidAgentError for empty id', () => {
    expect(() =>
      factory.create({ id: createAgentId(''), role: createRole(AgentRoles.PLANNER) }),
    ).toThrow(InvalidAgentError);
  });

  it('should throw InvalidAgentError for empty role', () => {
    expect(() =>
      factory.create({ id: createAgentId('a1'), role: createRole('') }),
    ).toThrow(InvalidAgentError);
  });

  it('should throw InvalidAgentError for non-finite priority', () => {
    expect(() =>
      factory.create({
        id: createAgentId('a1'),
        role: createRole(AgentRoles.PLANNER),
        priority: Number.NaN,
      }),
    ).toThrow(InvalidAgentError);
  });

  it('should deduplicate capabilities', () => {
    const agent = factory.create({
      id: createAgentId('a1'),
      role: createRole(AgentRoles.PLANNER),
      capabilities: [
        createCapability(AgentCapabilities.CODING),
        createCapability(AgentCapabilities.CODING),
      ],
    });
    expect(agent.capabilities.length).toBe(1);
  });

  it('should trim profile fields', () => {
    const agent = factory.create({
      id: createAgentId('a1'),
      role: createRole(AgentRoles.PLANNER),
      profile: { name: '  Spaced  ', title: '  T  ', description: '  D  ', avatar: '  av  ' },
    });
    expect(agent.profile.name).toBe('Spaced');
    expect(agent.profile.title).toBe('T');
    expect(agent.profile.description).toBe('D');
  });
});

describe('Agent (immutability)', () => {
  it('should be frozen', () => {
    const agent = createTestAgent();
    expect(Object.isFrozen(agent)).toBe(true);
  });

  it('should have frozen profile', () => {
    const agent = createTestAgent();
    expect(Object.isFrozen(agent.profile)).toBe(true);
  });

  it('should have frozen capabilities array', () => {
    const agent = createTestAgent();
    expect(Object.isFrozen(agent.capabilities)).toBe(true);
  });

  it('should have frozen tags array', () => {
    const agent = createTestAgent();
    expect(Object.isFrozen(agent.tags)).toBe(true);
  });

  it('should have frozen metadata', () => {
    const agent = createTestAgent();
    expect(Object.isFrozen(agent.metadata)).toBe(true);
  });

  it('should have frozen supportedTasks array', () => {
    const agent = createTestAgent();
    expect(Object.isFrozen(agent.supportedTasks)).toBe(true);
  });

  it('should support a task', () => {
    const agent = createTestAgent();
    expect(agent.supportsTask('code')).toBe(true);
    expect(agent.supportsTask('unknown')).toBe(false);
  });

  it('should return context entries', () => {
    const agent = createTestAgent();
    const context = agent.getContext();
    expect(context.get('team')).toBe('core');
    expect(context.get('missing')).toBeUndefined();
    expect(context.entries().team).toBe('core');
  });

  it('should return memory entries', () => {
    const agent = createTestAgent();
    const memory = agent.getMemory();
    expect(memory.get('anything')).toBeUndefined();
    expect(memory.entries()).toEqual({});
  });

  it('should return execution metadata', () => {
    const agent = createTestAgent();
    const meta = agent.getExecutionMetadata();
    expect(meta.id).toBe('agent-1');
    expect(meta.role).toBe(AgentRoles.SOFTWARE_ENGINEER);
    expect(meta.priority).toBe('50');
    expect(meta.status).toBe(AgentStatus.Idle);
    expect(meta.version).toBe('1.0.0');
    expect(meta.author).toBe('test-author');
    expect(Object.isFrozen(meta)).toBe(true);
  });
});

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  it('should register an agent', () => {
    const agent = createTestAgent();
    registry.register(agent);
    expect(registry.count()).toBe(1);
    expect(registry.exists(createAgentId('agent-1'))).toBe(true);
  });

  it('should throw AgentAlreadyExistsError on duplicate registration', () => {
    const agent = createTestAgent();
    registry.register(agent);
    expect(() => registry.register(createTestAgent())).toThrow(AgentAlreadyExistsError);
  });

  it('should throw InvalidAgentError for invalid agent', () => {
    expect(() => registry.register(undefined as unknown as IAgent)).toThrow(InvalidAgentError);
  });

  it('should find an agent by id', () => {
    const agent = createTestAgent();
    registry.register(agent);
    expect(registry.find(createAgentId('agent-1')).id).toBe('agent-1');
  });

  it('should throw AgentNotFoundError when finding missing agent', () => {
    expect(() => registry.find(createAgentId('missing'))).toThrow(AgentNotFoundError);
  });

  it('should unregister an agent', () => {
    const agent = createTestAgent();
    registry.register(agent);
    registry.unregister(createAgentId('agent-1'));
    expect(registry.count()).toBe(0);
    expect(registry.exists(createAgentId('agent-1'))).toBe(false);
  });

  it('should throw AgentNotFoundError when unregistering missing agent', () => {
    expect(() => registry.unregister(createAgentId('missing'))).toThrow(AgentNotFoundError);
  });

  it('should find by role', () => {
    registry.register(createTestAgent('a1', AgentRoles.SOFTWARE_ENGINEER));
    registry.register(createTestAgent('a2', AgentRoles.SOFTWARE_ENGINEER));
    registry.register(createTestAgent('a3', AgentRoles.DESIGNER));
    const engineers = registry.findByRole(createRole(AgentRoles.SOFTWARE_ENGINEER));
    expect(engineers.length).toBe(2);
    expect(Object.isFrozen(engineers)).toBe(true);
  });

  it('should find by capability', () => {
    registry.register(createTestAgent('a1'));
    registry.register(createTestAgent('a2'));
    const coders = registry.findByCapability(createCapability(AgentCapabilities.CODING));
    expect(coders.length).toBe(2);
    expect(Object.isFrozen(coders)).toBe(true);
  });

  it('should list all agents as frozen snapshot', () => {
    registry.register(createTestAgent('a1'));
    registry.register(createTestAgent('a2'));
    const all = registry.listAll();
    expect(all.length).toBe(2);
    expect(Object.isFrozen(all)).toBe(true);
  });

  it('should enable an agent', () => {
    const agent = createTestAgent();
    registry.register(agent);
    expect(() => registry.enable(createAgentId('agent-1'))).not.toThrow();
  });

  it('should throw AgentNotFoundError when enabling missing agent', () => {
    expect(() => registry.enable(createAgentId('missing'))).toThrow(AgentNotFoundError);
  });

  it('should disable an agent', () => {
    const agent = createTestAgent();
    registry.register(agent);
    expect(() => registry.disable(createAgentId('agent-1'))).not.toThrow();
  });

  it('should throw AgentNotFoundError when disabling missing agent', () => {
    expect(() => registry.disable(createAgentId('missing'))).toThrow(AgentNotFoundError);
  });

  it('should replace an existing agent', () => {
    registry.register(createTestAgent('a1'));
    const replacement = createTestAgent('a1');
    registry.replace(replacement);
    expect(registry.find(createAgentId('a1')).version).toBe('1.0.0');
  });

  it('should throw AgentNotFoundError when replacing missing agent', () => {
    expect(() => registry.replace(createTestAgent('missing'))).toThrow(AgentNotFoundError);
  });

  it('should count registered agents', () => {
    expect(registry.count()).toBe(0);
    registry.register(createTestAgent('a1'));
    registry.register(createTestAgent('a2'));
    expect(registry.count()).toBe(2);
  });
});

describe('AgentRegistry Events', () => {
  it('should publish AGENT_REGISTERED event', () => {
    const bus = new EventBus();
    const registry = new AgentRegistry(bus);
    let received: string | undefined;
    bus.subscribe<AgentRegisteredPayload>(AgentEvents.AGENT_REGISTERED, (event) => {
      received = event.payload.agentId;
    });
    registry.register(createTestAgent());
    expect(received).toBe('agent-1');
  });

  it('should publish AGENT_REMOVED event', () => {
    const bus = new EventBus();
    const registry = new AgentRegistry(bus);
    registry.register(createTestAgent());
    let received: string | undefined;
    bus.subscribe<AgentRemovedPayload>(AgentEvents.AGENT_REMOVED, (event) => {
      received = event.payload.agentId;
    });
    registry.unregister(createAgentId('agent-1'));
    expect(received).toBe('agent-1');
  });

  it('should publish AGENT_ENABLED event', () => {
    const bus = new EventBus();
    const registry = new AgentRegistry(bus);
    registry.register(createTestAgent());
    let received: string | undefined;
    bus.subscribe<AgentEnabledPayload>(AgentEvents.AGENT_ENABLED, (event) => {
      received = event.payload.agentId;
    });
    registry.enable(createAgentId('agent-1'));
    expect(received).toBe('agent-1');
  });

  it('should publish AGENT_DISABLED event', () => {
    const bus = new EventBus();
    const registry = new AgentRegistry(bus);
    registry.register(createTestAgent());
    let received: string | undefined;
    bus.subscribe<AgentDisabledPayload>(AgentEvents.AGENT_DISABLED, (event) => {
      received = event.payload.agentId;
    });
    registry.disable(createAgentId('agent-1'));
    expect(received).toBe('agent-1');
  });
});

describe('AgentManager', () => {
  let registry: AgentRegistry;
  let manager: AgentManager;

  beforeEach(() => {
    registry = new AgentRegistry();
    manager = new AgentManager(registry);
    registry.register(createTestAgent());
  });

  it('should activate an agent', () => {
    const state = manager.activate(createAgentId('agent-1'));
    expect(state.state).toBe(AgentState.Idle);
  });

  it('should deactivate an agent', () => {
    manager.activate(createAgentId('agent-1'));
    const state = manager.deactivate(createAgentId('agent-1'));
    expect(state.state).toBe(AgentState.Offline);
  });

  it('should suspend an agent', () => {
    manager.activate(createAgentId('agent-1'));
    const state = manager.suspend(createAgentId('agent-1'));
    expect(state.state).toBe(AgentState.Waiting);
  });

  it('should resume a suspended agent', () => {
    manager.activate(createAgentId('agent-1'));
    manager.suspend(createAgentId('agent-1'));
    const state = manager.resume(createAgentId('agent-1'));
    expect(state.state).toBe(AgentState.Idle);
  });

  it('should throw AgentStateError when resuming non-suspended agent', () => {
    manager.activate(createAgentId('agent-1'));
    expect(() => manager.resume(createAgentId('agent-1'))).toThrow(AgentStateError);
  });

  it('should throw AgentStateError when suspending offline agent', () => {
    manager.deactivate(createAgentId('agent-1'));
    expect(() => manager.suspend(createAgentId('agent-1'))).toThrow(AgentStateError);
  });

  it('should throw AgentNotFoundError for missing agent', () => {
    expect(() => manager.activate(createAgentId('missing'))).toThrow(AgentNotFoundError);
  });

  it('should record heartbeat', () => {
    const state = manager.heartbeat(createAgentId('agent-1'));
    expect(state.heartbeatAt).toBeGreaterThan(0);
  });

  it('should get state', () => {
    const state = manager.getState(createAgentId('agent-1'));
    expect(state.state).toBe(AgentState.Idle);
  });

  it('should check availability', () => {
    expect(manager.isAvailable(createAgentId('agent-1'))).toBe(true);
    manager.deactivate(createAgentId('agent-1'));
    expect(manager.isAvailable(createAgentId('agent-1'))).toBe(false);
  });

  it('should return false for missing agent availability', () => {
    expect(manager.isAvailable(createAgentId('missing'))).toBe(false);
  });

  it('should list states as frozen snapshot', () => {
    manager.activate(createAgentId('agent-1'));
    const states = manager.listStates();
    expect(Object.isFrozen(states)).toBe(true);
    expect(states['agent-1'].state).toBe(AgentState.Idle);
  });

  it('should return frozen runtime state', () => {
    const state = manager.getState(createAgentId('agent-1'));
    expect(Object.isFrozen(state)).toBe(true);
  });
});

describe('AgentManager Events', () => {
  it('should publish AGENT_ACTIVATED event', () => {
    const bus = new EventBus();
    const reg = new AgentRegistry(bus);
    const mgr = new AgentManager(reg, bus);
    reg.register(createTestAgent());
    let received: string | undefined;
    bus.subscribe<AgentActivatedPayload>(AgentEvents.AGENT_ACTIVATED, (event) => {
      received = event.payload.agentId;
    });
    mgr.activate(createAgentId('agent-1'));
    expect(received).toBe('agent-1');
  });

  it('should publish AGENT_DEACTIVATED event', () => {
    const bus = new EventBus();
    const reg = new AgentRegistry(bus);
    const mgr = new AgentManager(reg, bus);
    reg.register(createTestAgent());
    let received: string | undefined;
    bus.subscribe<AgentDeactivatedPayload>(AgentEvents.AGENT_DEACTIVATED, (event) => {
      received = event.payload.agentId;
    });
    mgr.deactivate(createAgentId('agent-1'));
    expect(received).toBe('agent-1');
  });

  it('should publish AGENT_STATUS_CHANGED event on suspend', () => {
    const bus = new EventBus();
    const reg = new AgentRegistry(bus);
    const mgr = new AgentManager(reg, bus);
    reg.register(createTestAgent());
    let received: string | undefined;
    bus.subscribe<AgentStatusChangedPayload>(AgentEvents.AGENT_STATUS_CHANGED, (event) => {
      received = event.payload.agentId;
    });
    mgr.suspend(createAgentId('agent-1'));
    expect(received).toBe('agent-1');
  });

  it('should publish AGENT_HEARTBEAT event', () => {
    const bus = new EventBus();
    const reg = new AgentRegistry(bus);
    const mgr = new AgentManager(reg, bus);
    reg.register(createTestAgent());
    let received: string | undefined;
    bus.subscribe<AgentHeartbeatPayload>(AgentEvents.AGENT_HEARTBEAT, (event) => {
      received = event.payload.agentId;
    });
    mgr.heartbeat(createAgentId('agent-1'));
    expect(received).toBe('agent-1');
  });
});

describe('AgentErrors', () => {
  it('should create AgentRegistryError', () => {
    const err = new AgentRegistryError('test');
    expect(err.name).toBe('AgentRegistryError');
    expect(err.message).toBe('test');
  });

  it('should create AgentAlreadyExistsError with agentId', () => {
    const err = new AgentAlreadyExistsError('agent-1');
    expect(err.name).toBe('AgentAlreadyExistsError');
    expect(err.agentId).toBe('agent-1');
    expect(err.message).toContain('agent-1');
  });

  it('should create AgentNotFoundError with agentId', () => {
    const err = new AgentNotFoundError('agent-1');
    expect(err.name).toBe('AgentNotFoundError');
    expect(err.agentId).toBe('agent-1');
    expect(err.message).toContain('agent-1');
  });

  it('should create InvalidAgentError', () => {
    const err = new InvalidAgentError('invalid');
    expect(err.name).toBe('InvalidAgentError');
    expect(err.message).toBe('invalid');
  });

  it('should create AgentStateError with details', () => {
    const err = new AgentStateError('agent-1', AgentState.Idle, AgentState.Offline);
    expect(err.name).toBe('AgentStateError');
    expect(err.agentId).toBe('agent-1');
    expect(err.currentState).toBe(AgentState.Idle);
    expect(err.attemptedState).toBe(AgentState.Offline);
  });

  it('should be instance of AgentRegistryError', () => {
    expect(new AgentAlreadyExistsError('a') instanceof AgentRegistryError).toBe(true);
    expect(new AgentNotFoundError('a') instanceof AgentRegistryError).toBe(true);
    expect(new InvalidAgentError('a') instanceof AgentRegistryError).toBe(true);
    expect(new AgentStateError('a', AgentState.Idle, AgentState.Offline) instanceof AgentRegistryError).toBe(true);
  });
});

describe('AgentEvents constants', () => {
  it('should have correct event name constants', () => {
    expect(AgentEvents.AGENT_REGISTERED).toBe('agents.registered');
    expect(AgentEvents.AGENT_REMOVED).toBe('agents.removed');
    expect(AgentEvents.AGENT_ENABLED).toBe('agents.enabled');
    expect(AgentEvents.AGENT_DISABLED).toBe('agents.disabled');
    expect(AgentEvents.AGENT_ACTIVATED).toBe('agents.activated');
    expect(AgentEvents.AGENT_DEACTIVATED).toBe('agents.deactivated');
    expect(AgentEvents.AGENT_STATUS_CHANGED).toBe('agents.status_changed');
    expect(AgentEvents.AGENT_HEARTBEAT).toBe('agents.heartbeat');
  });
});

describe('AgentRegistry Edge Cases', () => {
  it('should handle empty registry operations', () => {
    const reg = new AgentRegistry();
    expect(reg.count()).toBe(0);
    expect(reg.listAll()).toEqual([]);
    expect(reg.findByRole(createRole(AgentRoles.PLANNER))).toEqual([]);
    expect(reg.findByCapability(createCapability(AgentCapabilities.CODING))).toEqual([]);
  });

  it('should not throw when no event bus is provided', () => {
    const reg = new AgentRegistry();
    const agent = createTestAgent();
    expect(() => reg.register(agent)).not.toThrow();
    expect(() => reg.enable(createAgentId('agent-1'))).not.toThrow();
    expect(() => reg.disable(createAgentId('agent-1'))).not.toThrow();
    expect(() => reg.unregister(createAgentId('agent-1'))).not.toThrow();
  });

  it('should handle multiple registrations and removals', () => {
    const reg = new AgentRegistry();
    reg.register(createTestAgent('a1'));
    reg.register(createTestAgent('a2'));
    reg.register(createTestAgent('a3'));
    expect(reg.count()).toBe(3);
    reg.unregister(createAgentId('a2'));
    expect(reg.count()).toBe(2);
    expect(reg.exists(createAgentId('a2'))).toBe(false);
    expect(reg.exists(createAgentId('a1'))).toBe(true);
    expect(reg.exists(createAgentId('a3'))).toBe(true);
  });
});