import { describe, it, expect } from 'vitest';
import {
  AdvisorCatalog,
  AdvisorRoles,
  AdvisorCapabilities,
  createAdvisorId,
  createAdvisorCapability,
  createAdvisorProfile,
  Advisor,
  AdvisorFactory,
} from '../../src/advisors/index.js';
import type { AdvisorProfile } from '../../src/advisors/AdvisorIdentity.js';

function createTestProfile(): AdvisorProfile {
  return {
    name: 'Test Advisor',
    description: 'A test advisor',
    specialty: 'Testing',
    responsibilities: ['Write tests', 'Review code'],
    systemPrompt: 'You are a test advisor.',
    capabilities: [createAdvisorCapability(AdvisorCapabilities.TESTING)],
    allowedTools: ['read_file', 'write_file'],
    metadata: { role: 'tester' },
  };
}

describe('AdvisorIdentity', () => {
  it('should create an AdvisorId from a string', () => {
    const id = createAdvisorId('advisor-1');
    expect(String(id)).toBe('advisor-1');
  });

  it('should create an AdvisorCapability from a string', () => {
    const cap = createAdvisorCapability('testing');
    expect(String(cap)).toBe('testing');
  });

  it('should create a frozen AdvisorProfile copy', () => {
    const profile = createTestProfile();
    const copy = createAdvisorProfile(profile);
    expect(copy.name).toBe('Test Advisor');
    expect(Object.isFrozen(copy)).toBe(true);
    expect(Object.isFrozen(copy.responsibilities)).toBe(true);
    expect(Object.isFrozen(copy.capabilities)).toBe(true);
    expect(Object.isFrozen(copy.allowedTools)).toBe(true);
    expect(Object.isFrozen(copy.metadata)).toBe(true);
  });
});

describe('AdvisorRoles', () => {
  it('should have all 11 predefined role constants', () => {
    expect(AdvisorRoles.CHIEF_AI_ARCHITECT).toBe('chief-ai-architect');
    expect(AdvisorRoles.SOFTWARE_ENGINEER).toBe('software-engineer');
    expect(AdvisorRoles.FRONTEND_ENGINEER).toBe('frontend-engineer');
    expect(AdvisorRoles.BACKEND_ENGINEER).toBe('backend-engineer');
    expect(AdvisorRoles.UI_DESIGNER).toBe('ui-designer');
    expect(AdvisorRoles.UX_DESIGNER).toBe('ux-designer');
    expect(AdvisorRoles.DEVOPS_ENGINEER).toBe('devops-engineer');
    expect(AdvisorRoles.SECURITY_ADVISOR).toBe('security-advisor');
    expect(AdvisorRoles.DATABASE_ARCHITECT).toBe('database-architect');
    expect(AdvisorRoles.QA_ENGINEER).toBe('qa-engineer');
    expect(AdvisorRoles.DOCUMENTATION_WRITER).toBe('documentation-writer');
  });
});

describe('AdvisorCapabilities', () => {
  it('should have correct capability constants', () => {
    expect(AdvisorCapabilities.ARCHITECTURE).toBe('architecture');
    expect(AdvisorCapabilities.FRONTEND).toBe('frontend');
    expect(AdvisorCapabilities.BACKEND).toBe('backend');
    expect(AdvisorCapabilities.UI).toBe('ui');
    expect(AdvisorCapabilities.UX).toBe('ux');
    expect(AdvisorCapabilities.DEVOPS).toBe('devops');
    expect(AdvisorCapabilities.SECURITY).toBe('security');
    expect(AdvisorCapabilities.DATABASE).toBe('database');
    expect(AdvisorCapabilities.QA).toBe('qa');
    expect(AdvisorCapabilities.DOCUMENTATION).toBe('documentation');
  });
});

describe('Advisor (immutability)', () => {
  it('should be frozen', () => {
    const advisor = new Advisor(createAdvisorId('a1'), createTestProfile());
    expect(Object.isFrozen(advisor)).toBe(true);
  });

  it('should have frozen profile', () => {
    const advisor = new Advisor(createAdvisorId('a1'), createTestProfile());
    expect(Object.isFrozen(advisor.profile)).toBe(true);
  });

  it('should have frozen responsibilities array', () => {
    const advisor = new Advisor(createAdvisorId('a1'), createTestProfile());
    expect(Object.isFrozen(advisor.profile.responsibilities)).toBe(true);
  });

  it('should have frozen capabilities array', () => {
    const advisor = new Advisor(createAdvisorId('a1'), createTestProfile());
    expect(Object.isFrozen(advisor.profile.capabilities)).toBe(true);
  });

  it('should have frozen allowedTools array', () => {
    const advisor = new Advisor(createAdvisorId('a1'), createTestProfile());
    expect(Object.isFrozen(advisor.profile.allowedTools)).toBe(true);
  });

  it('should have frozen metadata', () => {
    const advisor = new Advisor(createAdvisorId('a1'), createTestProfile());
    expect(Object.isFrozen(advisor.profile.metadata)).toBe(true);
  });
});

describe('AdvisorFactory', () => {
  it('should create an advisor with full profile', () => {
    const factory = new AdvisorFactory();
    const advisor = factory.create({
      id: createAdvisorId('custom'),
      profile: createTestProfile(),
    });
    expect(advisor.id).toBe('custom');
    expect(advisor.profile.name).toBe('Test Advisor');
    expect(advisor.profile.specialty).toBe('Testing');
    expect(advisor.profile.responsibilities.length).toBe(2);
    expect(advisor.profile.systemPrompt).toContain('test advisor');
    expect(advisor.profile.capabilities.length).toBe(1);
    expect(advisor.profile.allowedTools.length).toBe(2);
    expect(advisor.profile.metadata.role).toBe('tester');
  });

  it('should throw for empty id', () => {
    const factory = new AdvisorFactory();
    expect(() =>
      factory.create({ id: createAdvisorId(''), profile: createTestProfile() }),
    ).toThrow('Advisor id is required');
  });

  it('should throw for empty name', () => {
    const factory = new AdvisorFactory();
    const profile = { ...createTestProfile(), name: '  ' };
    expect(() => factory.create({ id: createAdvisorId('a1'), profile })).toThrow(
      'Advisor profile name is required',
    );
  });

  it('should throw for empty systemPrompt', () => {
    const factory = new AdvisorFactory();
    const profile = { ...createTestProfile(), systemPrompt: '  ' };
    expect(() => factory.create({ id: createAdvisorId('a1'), profile })).toThrow(
      'Advisor systemPrompt is required',
    );
  });

  it('should trim name and systemPrompt', () => {
    const factory = new AdvisorFactory();
    const profile = {
      ...createTestProfile(),
      name: '  Spaced Name  ',
      systemPrompt: '  Prompt  ',
    };
    const advisor = factory.create({ id: createAdvisorId('a1'), profile });
    expect(advisor.profile.name).toBe('Spaced Name');
    expect(advisor.profile.systemPrompt).toBe('Prompt');
  });

  it('should create frozen advisor', () => {
    const factory = new AdvisorFactory();
    const advisor = factory.create({
      id: createAdvisorId('a1'),
      profile: createTestProfile(),
    });
    expect(Object.isFrozen(advisor)).toBe(true);
    expect(Object.isFrozen(advisor.profile)).toBe(true);
  });
});

describe('AdvisorCatalog', () => {
  it('should contain exactly 11 advisors', () => {
    const catalog = new AdvisorCatalog();
    expect(catalog.count()).toBe(11);
  });

  it('should get an advisor by id', () => {
    const catalog = new AdvisorCatalog();
    const advisor = catalog.get(createAdvisorId(AdvisorRoles.CHIEF_AI_ARCHITECT));
    expect(advisor).toBeDefined();
    expect(advisor?.profile.name).toBe('Chief AI Architect');
  });

  it('should return undefined for missing advisor', () => {
    const catalog = new AdvisorCatalog();
    expect(catalog.get(createAdvisorId('missing'))).toBeUndefined();
  });

  it('should check advisor existence', () => {
    const catalog = new AdvisorCatalog();
    expect(catalog.has(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER))).toBe(true);
    expect(catalog.has(createAdvisorId('missing'))).toBe(false);
  });

  it('should return all advisors as frozen snapshot', () => {
    const catalog = new AdvisorCatalog();
    const all = catalog.getAll();
    expect(all.length).toBe(11);
    expect(Object.isFrozen(all)).toBe(true);
  });

  it('should have all 11 predefined roles', () => {
    const catalog = new AdvisorCatalog();
    const ids = catalog.getAll().map((a) => String(a.id));
    expect(ids).toContain(AdvisorRoles.CHIEF_AI_ARCHITECT);
    expect(ids).toContain(AdvisorRoles.SOFTWARE_ENGINEER);
    expect(ids).toContain(AdvisorRoles.FRONTEND_ENGINEER);
    expect(ids).toContain(AdvisorRoles.BACKEND_ENGINEER);
    expect(ids).toContain(AdvisorRoles.UI_DESIGNER);
    expect(ids).toContain(AdvisorRoles.UX_DESIGNER);
    expect(ids).toContain(AdvisorRoles.DEVOPS_ENGINEER);
    expect(ids).toContain(AdvisorRoles.SECURITY_ADVISOR);
    expect(ids).toContain(AdvisorRoles.DATABASE_ARCHITECT);
    expect(ids).toContain(AdvisorRoles.QA_ENGINEER);
    expect(ids).toContain(AdvisorRoles.DOCUMENTATION_WRITER);
  });
});

describe('AdvisorCatalog predefined personas', () => {
  it('Chief AI Architect has architecture capability', () => {
    const catalog = new AdvisorCatalog();
    const advisor = catalog.get(createAdvisorId(AdvisorRoles.CHIEF_AI_ARCHITECT));
    expect(advisor?.profile.capabilities.map((c) => String(c))).toContain(
      AdvisorCapabilities.ARCHITECTURE,
    );
  });

  it('Software Engineer has backend and frontend capabilities', () => {
    const catalog = new AdvisorCatalog();
    const advisor = catalog.get(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER));
    const caps = advisor?.profile.capabilities.map((c) => String(c)) ?? [];
    expect(caps).toContain(AdvisorCapabilities.BACKEND);
    expect(caps).toContain(AdvisorCapabilities.FRONTEND);
  });

  it('Frontend Engineer has frontend capability', () => {
    const catalog = new AdvisorCatalog();
    const advisor = catalog.get(createAdvisorId(AdvisorRoles.FRONTEND_ENGINEER));
    const caps = advisor?.profile.capabilities.map((c) => String(c)) ?? [];
    expect(caps).toContain(AdvisorCapabilities.FRONTEND);
  });

  it('Backend Engineer has backend capability', () => {
    const catalog = new AdvisorCatalog();
    const advisor = catalog.get(createAdvisorId(AdvisorRoles.BACKEND_ENGINEER));
    const caps = advisor?.profile.capabilities.map((c) => String(c)) ?? [];
    expect(caps).toContain(AdvisorCapabilities.BACKEND);
  });

  it('UI Designer has ui capability', () => {
    const catalog = new AdvisorCatalog();
    const advisor = catalog.get(createAdvisorId(AdvisorRoles.UI_DESIGNER));
    const caps = advisor?.profile.capabilities.map((c) => String(c)) ?? [];
    expect(caps).toContain(AdvisorCapabilities.UI);
  });

  it('UX Designer has ux capability', () => {
    const catalog = new AdvisorCatalog();
    const advisor = catalog.get(createAdvisorId(AdvisorRoles.UX_DESIGNER));
    const caps = advisor?.profile.capabilities.map((c) => String(c)) ?? [];
    expect(caps).toContain(AdvisorCapabilities.UX);
  });

  it('DevOps Engineer has devops capability', () => {
    const catalog = new AdvisorCatalog();
    const advisor = catalog.get(createAdvisorId(AdvisorRoles.DEVOPS_ENGINEER));
    const caps = advisor?.profile.capabilities.map((c) => String(c)) ?? [];
    expect(caps).toContain(AdvisorCapabilities.DEVOPS);
  });

  it('Security Advisor has security capability', () => {
    const catalog = new AdvisorCatalog();
    const advisor = catalog.get(createAdvisorId(AdvisorRoles.SECURITY_ADVISOR));
    const caps = advisor?.profile.capabilities.map((c) => String(c)) ?? [];
    expect(caps).toContain(AdvisorCapabilities.SECURITY);
  });

  it('Database Architect has database capability', () => {
    const catalog = new AdvisorCatalog();
    const advisor = catalog.get(createAdvisorId(AdvisorRoles.DATABASE_ARCHITECT));
    const caps = advisor?.profile.capabilities.map((c) => String(c)) ?? [];
    expect(caps).toContain(AdvisorCapabilities.DATABASE);
  });

  it('QA Engineer has qa capability', () => {
    const catalog = new AdvisorCatalog();
    const advisor = catalog.get(createAdvisorId(AdvisorRoles.QA_ENGINEER));
    const caps = advisor?.profile.capabilities.map((c) => String(c)) ?? [];
    expect(caps).toContain(AdvisorCapabilities.QA);
  });

  it('Documentation Writer has documentation capability', () => {
    const catalog = new AdvisorCatalog();
    const advisor = catalog.get(createAdvisorId(AdvisorRoles.DOCUMENTATION_WRITER));
    const caps = advisor?.profile.capabilities.map((c) => String(c)) ?? [];
    expect(caps).toContain(AdvisorCapabilities.DOCUMENTATION);
  });

  it('every advisor has id, name, description, specialty, responsibilities, systemPrompt, capabilities, allowedTools, metadata', () => {
    const catalog = new AdvisorCatalog();
    for (const advisor of catalog.getAll()) {
      expect(advisor.id).toBeDefined();
      expect(advisor.profile.name.length).toBeGreaterThan(0);
      expect(advisor.profile.description.length).toBeGreaterThan(0);
      expect(advisor.profile.specialty.length).toBeGreaterThan(0);
      expect(advisor.profile.responsibilities.length).toBeGreaterThan(0);
      expect(advisor.profile.systemPrompt.length).toBeGreaterThan(0);
      expect(advisor.profile.capabilities.length).toBeGreaterThan(0);
      expect(advisor.profile.allowedTools.length).toBeGreaterThan(0);
      expect(advisor.profile.metadata).toBeDefined();
    }
  });

  it('every advisor is immutable', () => {
    const catalog = new AdvisorCatalog();
    for (const advisor of catalog.getAll()) {
      expect(Object.isFrozen(advisor)).toBe(true);
      expect(Object.isFrozen(advisor.profile)).toBe(true);
      expect(Object.isFrozen(advisor.profile.responsibilities)).toBe(true);
      expect(Object.isFrozen(advisor.profile.capabilities)).toBe(true);
      expect(Object.isFrozen(advisor.profile.allowedTools)).toBe(true);
      expect(Object.isFrozen(advisor.profile.metadata)).toBe(true);
    }
  });
});