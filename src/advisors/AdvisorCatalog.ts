import type { AdvisorId, AdvisorProfile } from './AdvisorIdentity.js';
import { createAdvisorId, createAdvisorCapability } from './AdvisorIdentity.js';
import type { IAdvisor } from './IAdvisor.js';
import { Advisor } from './Advisor.js';
import { AdvisorRoles } from './AdvisorRole.js';
import {
  chiefAiArchitectPrompt,
  softwareEngineerPrompt,
  frontendEngineerPrompt,
  backendEngineerPrompt,
  uiDesignerPrompt,
  uxDesignerPrompt,
  devopsEngineerPrompt,
  securityAdvisorPrompt,
  databaseArchitectPrompt,
  qaEngineerPrompt,
  documentationWriterPrompt,
} from './prompts/index.js';

/**
 * Predefined capability identifiers.
 */
export const AdvisorCapabilities = {
  ARCHITECTURE: 'architecture',
  FRONTEND: 'frontend',
  BACKEND: 'backend',
  UI: 'ui',
  UX: 'ux',
  DEVOPS: 'devops',
  SECURITY: 'security',
  DATABASE: 'database',
  QA: 'qa',
  DOCUMENTATION: 'documentation',
  CODE_REVIEW: 'code-review',
  TESTING: 'testing',
  PERFORMANCE: 'performance',
  ACCESSIBILITY: 'accessibility',
  CLOUD: 'cloud',
} as const;

/**
 * Catalog of immutable predefined Advisor personas.
 *
 * This is a pure static registry — no routing, no workflow execution,
 * no AI calls, and no speculative logic.
 */
export class AdvisorCatalog {
  private readonly advisors: ReadonlyMap<string, IAdvisor>;

  constructor() {
    const list: readonly IAdvisor[] = [
      this.chiefAiArchitect(),
      this.softwareEngineer(),
      this.frontendEngineer(),
      this.backendEngineer(),
      this.uiDesigner(),
      this.uxDesigner(),
      this.devopsEngineer(),
      this.securityAdvisor(),
      this.databaseArchitect(),
      this.qaEngineer(),
      this.documentationWriter(),
    ];
    const map = new Map<string, IAdvisor>();
    for (const advisor of list) {
      map.set(String(advisor.id), advisor);
    }
    this.advisors = map;
  }

  /**
   * Returns the advisor for the given id, or undefined if not found.
   */
  public get(id: AdvisorId): IAdvisor | undefined {
    return this.advisors.get(String(id));
  }

  /**
   * Returns true if an advisor with the given id exists.
   */
  public has(id: AdvisorId): boolean {
    return this.advisors.has(String(id));
  }

  /**
   * Returns all advisors as an immutable snapshot.
   */
  public getAll(): readonly IAdvisor[] {
    return Object.freeze(Array.from(this.advisors.values()));
  }

  /**
   * Returns the number of advisors in the catalog.
   */
  public count(): number {
    return this.advisors.size;
  }

  private build(id: string, profile: AdvisorProfile): IAdvisor {
    const frozenProfile: AdvisorProfile = Object.freeze({
      name: profile.name,
      description: profile.description,
      specialty: profile.specialty,
      responsibilities: Object.freeze([...profile.responsibilities]),
      systemPrompt: profile.systemPrompt,
      capabilities: Object.freeze([...profile.capabilities]),
      allowedTools: Object.freeze([...profile.allowedTools]),
      metadata: Object.freeze({ ...profile.metadata }),
      ...(profile.routingKeywords ? { routingKeywords: Object.freeze([...profile.routingKeywords]) } : {}),
    });
    return new Advisor(createAdvisorId(id), frozenProfile);
  }

  private chiefAiArchitect(): IAdvisor {
    return this.build(AdvisorRoles.CHIEF_AI_ARCHITECT, {
      name: 'Chief AI Architect',
      description:
        'Leads the overall system architecture, ensuring AI-native design, scalability, and maintainability across the entire codebase.',
      specialty: 'AI system architecture and platform design',
      responsibilities: [
        'Define and own the overall system architecture and technical vision',
        'Ensure AI integration patterns are clean, modular, and provider-agnostic',
        'Enforce clean architecture, SOLID principles, and separation of concerns',
        'Review architectural decisions and propose evolution paths',
      ],
      systemPrompt: chiefAiArchitectPrompt,
      capabilities: [
        createAdvisorCapability(AdvisorCapabilities.ARCHITECTURE),
        createAdvisorCapability(AdvisorCapabilities.CODE_REVIEW),
        createAdvisorCapability(AdvisorCapabilities.PERFORMANCE),
      ],
      allowedTools: ['read_file', 'list_directory', 'search_workspace'],
      metadata: Object.freeze({ role: AdvisorRoles.CHIEF_AI_ARCHITECT, level: 'principal' }),
      routingKeywords: Object.freeze([
        'architecture', 'architect', 'system design', 'scalability', 'technical vision', 'tech stack', 'monolith', 'microservice',
        'معمارية', 'بنية', 'تصميم نظام', 'قابلية التوسع', 'رؤية تقنية',
      ]),
    });
  }

  private softwareEngineer(): IAdvisor {
    return this.build(AdvisorRoles.SOFTWARE_ENGINEER, {
      name: 'Software Engineer',
      description:
        'General-purpose software engineer capable of designing, implementing, and maintaining application code across the stack.',
      specialty: 'Full-stack software development and implementation',
      responsibilities: [
        'Design and implement application features and services',
        'Write clean, testable, and maintainable code',
        'Refactor legacy code and improve code quality',
        'Collaborate with other engineers to deliver cohesive solutions',
      ],
      systemPrompt: softwareEngineerPrompt,
      capabilities: [
        createAdvisorCapability(AdvisorCapabilities.BACKEND),
        createAdvisorCapability(AdvisorCapabilities.FRONTEND),
        createAdvisorCapability(AdvisorCapabilities.CODE_REVIEW),
        createAdvisorCapability(AdvisorCapabilities.TESTING),
      ],
      allowedTools: ['read_file', 'write_file', 'list_directory', 'search_workspace', 'execute_command'],
      metadata: Object.freeze({ role: AdvisorRoles.SOFTWARE_ENGINEER, level: 'senior' }),
      routingKeywords: Object.freeze([
        'implement', 'implementation', 'feature', 'code', 'coding', 'refactor', 'bug fix', 'develop',
        'تنفيذ', 'برمجة', 'كود', 'تطوير', 'إصلاح',
      ]),
    });
  }

  private frontendEngineer(): IAdvisor {
    return this.build(AdvisorRoles.FRONTEND_ENGINEER, {
      name: 'Frontend Engineer',
      description:
        'Specialist in web frontend development including UI frameworks, state management, styling, and browser performance.',
      specialty: 'Web frontend development and browser performance',
      responsibilities: [
        'Implement responsive and accessible user interfaces',
        'Manage component state and data flow in frontend applications',
        'Optimize frontend performance and bundle size',
        'Ensure cross-browser compatibility and accessibility (a11y)',
      ],
      systemPrompt: frontendEngineerPrompt,
      capabilities: [
        createAdvisorCapability(AdvisorCapabilities.FRONTEND),
        createAdvisorCapability(AdvisorCapabilities.UI),
        createAdvisorCapability(AdvisorCapabilities.ACCESSIBILITY),
        createAdvisorCapability(AdvisorCapabilities.PERFORMANCE),
      ],
      allowedTools: ['read_file', 'write_file', 'list_directory', 'search_workspace'],
      metadata: Object.freeze({ role: AdvisorRoles.FRONTEND_ENGINEER, level: 'senior' }),
      routingKeywords: Object.freeze([
        'frontend', 'front-end', 'react', 'vue', 'angular', 'css', 'html', 'ui component', 'state management', 'responsive',
        'واجهة أمامية', 'رياكت', 'vue', 'أنجولار', 'مكونات',
      ]),
    });
  }

  private backendEngineer(): IAdvisor {
    return this.build(AdvisorRoles.BACKEND_ENGINEER, {
      name: 'Backend Engineer',
      description:
        'Specialist in server-side development including APIs, services, data processing, and system integration.',
      specialty: 'Server-side development and API design',
      responsibilities: [
        'Design and implement REST/GraphQL APIs and services',
        'Ensure data integrity, consistency, and transactional safety',
        'Implement authentication, authorization, and business logic',
        'Integrate with external services and systems',
      ],
      systemPrompt: backendEngineerPrompt,
      capabilities: [
        createAdvisorCapability(AdvisorCapabilities.BACKEND),
        createAdvisorCapability(AdvisorCapabilities.ARCHITECTURE),
        createAdvisorCapability(AdvisorCapabilities.DATABASE),
        createAdvisorCapability(AdvisorCapabilities.SECURITY),
      ],
      allowedTools: ['read_file', 'write_file', 'list_directory', 'search_workspace', 'execute_command'],
      metadata: Object.freeze({ role: AdvisorRoles.BACKEND_ENGINEER, level: 'senior' }),
      routingKeywords: Object.freeze([
        'backend', 'back-end', 'api', 'rest', 'graphql', 'server', 'endpoint', 'middleware', 'authentication', 'authorization',
        'خادم', 'واجهة برمجة', 'api', 'middeware', 'مصادقة',
      ]),
    });
  }

  private uiDesigner(): IAdvisor {
    return this.build(AdvisorRoles.UI_DESIGNER, {
      name: 'UI Designer',
      description:
        'Designer focused on visual interface quality including layout, color, typography, and visual consistency.',
      specialty: 'Visual interface design and design systems',
      responsibilities: [
        'Define and maintain visual design systems and component libraries',
        'Ensure visual consistency, hierarchy, and readability',
        'Design accessible color palettes and typography scales',
        'Review UI implementation against design specifications',
      ],
      systemPrompt: uiDesignerPrompt,
      capabilities: [
        createAdvisorCapability(AdvisorCapabilities.UI),
        createAdvisorCapability(AdvisorCapabilities.ACCESSIBILITY),
        createAdvisorCapability(AdvisorCapabilities.FRONTEND),
      ],
      allowedTools: ['read_file', 'list_directory', 'search_workspace'],
      metadata: Object.freeze({ role: AdvisorRoles.UI_DESIGNER, level: 'senior' }),
      routingKeywords: Object.freeze([
        'ui', 'user interface', 'visual', 'color', 'typography', 'layout', 'design system', 'component library', 'spacing', 'style',
        'تصميم واجهة', 'ألوان', 'خطوط', 'تخطيط', 'تصميم',
      ]),
    });
  }

  private uxDesigner(): IAdvisor {
    return this.build(AdvisorRoles.UX_DESIGNER, {
      name: 'UX Designer',
      description:
        'Designer focused on user experience including flows, information architecture, usability, and interaction patterns.',
      specialty: 'User experience design and usability engineering',
      responsibilities: [
        'Map user journeys and information architecture',
        'Design intuitive interaction flows and navigation patterns',
        'Conduct usability heuristics reviews',
        'Ensure the experience is user-centered and accessible',
      ],
      systemPrompt: uxDesignerPrompt,
      capabilities: [
        createAdvisorCapability(AdvisorCapabilities.UX),
        createAdvisorCapability(AdvisorCapabilities.ACCESSIBILITY),
        createAdvisorCapability(AdvisorCapabilities.UI),
      ],
      allowedTools: ['read_file', 'list_directory', 'search_workspace'],
      metadata: Object.freeze({ role: AdvisorRoles.UX_DESIGNER, level: 'senior' }),
      routingKeywords: Object.freeze([
        'ux', 'user experience', 'usability', 'user flow', 'journey', 'information architecture', 'interaction', 'onboarding', 'navigation',
        'تجربة المستخدم', 'استخدام', 'تدفق', 'تنقل', 'بنية معلومات',
      ]),
    });
  }

  private devopsEngineer(): IAdvisor {
    return this.build(AdvisorRoles.DEVOPS_ENGINEER, {
      name: 'DevOps Engineer',
      description:
        'Specialist in CI/CD pipelines, infrastructure as code, cloud provisioning, and operational reliability.',
      specialty: 'CI/CD, infrastructure, and reliability engineering',
      responsibilities: [
        'Design and maintain CI/CD pipelines and release processes',
        'Define infrastructure as code and cloud provisioning',
        'Configure monitoring, alerting, and logging infrastructure',
        'Ensure deployment reliability, rollback, and disaster recovery plans',
      ],
      systemPrompt: devopsEngineerPrompt,
      capabilities: [
        createAdvisorCapability(AdvisorCapabilities.DEVOPS),
        createAdvisorCapability(AdvisorCapabilities.CLOUD),
        createAdvisorCapability(AdvisorCapabilities.PERFORMANCE),
      ],
      allowedTools: ['read_file', 'write_file', 'list_directory', 'search_workspace', 'execute_command'],
      metadata: Object.freeze({ role: AdvisorRoles.DEVOPS_ENGINEER, level: 'senior' }),
      routingKeywords: Object.freeze([
        'devops', 'ci/cd', 'pipeline', 'deploy', 'deployment', 'infrastructure', 'docker', 'kubernetes', 'terraform', 'monitoring', 'cloud',
        'docker', 'kubernetes', 'نشر', 'بنية تحتية', 'سحابة',
      ]),
    });
  }

  private securityAdvisor(): IAdvisor {
    return this.build(AdvisorRoles.SECURITY_ADVISOR, {
      name: 'Security Advisor',
      description:
        'Expert in application and platform security including threat modeling, vulnerability assessment, and secure coding.',
      specialty: 'Application security and secure coding practices',
      responsibilities: [
        'Perform threat modeling and security risk assessments',
        'Review code for security vulnerabilities (OWASP Top 10)',
        'Define secure coding standards and security requirements',
        'Recommend security controls, authentication, and authorization strategies',
      ],
      systemPrompt: securityAdvisorPrompt,
      capabilities: [
        createAdvisorCapability(AdvisorCapabilities.SECURITY),
        createAdvisorCapability(AdvisorCapabilities.CODE_REVIEW),
        createAdvisorCapability(AdvisorCapabilities.ARCHITECTURE),
      ],
      allowedTools: ['read_file', 'list_directory', 'search_workspace'],
      metadata: Object.freeze({ role: AdvisorRoles.SECURITY_ADVISOR, level: 'principal' }),
      routingKeywords: Object.freeze([
        'security', 'vulnerability', 'threat', 'owasp', 'xss', 'sql injection', 'csrf', 'encryption', 'hashing', 'secure', 'penetration', 'audit',
        'أمن', 'ثغرات', 'تهديد', 'اختراق', 'تشفير',
      ]),
    });
  }

  private databaseArchitect(): IAdvisor {
    return this.build(AdvisorRoles.DATABASE_ARCHITECT, {
      name: 'Database Architect',
      description:
        'Specialist in data modeling, schema design, query optimization, and data storage architecture.',
      specialty: 'Data modeling and database performance',
      responsibilities: [
        'Design logical and physical data models and schemas',
        'Optimize queries for performance and scalability',
        'Define indexing, partitioning, and data retention strategies',
        'Ensure data integrity, consistency, and migration safety',
      ],
      systemPrompt: databaseArchitectPrompt,
      capabilities: [
        createAdvisorCapability(AdvisorCapabilities.DATABASE),
        createAdvisorCapability(AdvisorCapabilities.ARCHITECTURE),
        createAdvisorCapability(AdvisorCapabilities.PERFORMANCE),
      ],
      allowedTools: ['read_file', 'list_directory', 'search_workspace'],
      metadata: Object.freeze({ role: AdvisorRoles.DATABASE_ARCHITECT, level: 'senior' }),
      routingKeywords: Object.freeze([
        'database', 'schema', 'sql', 'query', 'index', 'indexing', 'data model', 'migration', 'mongodb', 'postgres', 'mysql', 'redis', 'normalization',
        'قاعدة بيانات', 'استعلام', 'فهرس', 'مخطط', ' sql',
      ]),
    });
  }

  private qaEngineer(): IAdvisor {
    return this.build(AdvisorRoles.QA_ENGINEER, {
      name: 'QA Engineer',
      description:
        'Specialist in quality assurance including test strategy, test coverage, test automation, and defect analysis.',
      specialty: 'Test strategy and quality assurance',
      responsibilities: [
        'Define test strategies, plans, and quality gates',
        'Design unit, integration, and end-to-end test suites',
        'Evaluate test coverage and identify gaps',
        'Analyze defects and propose prevention measures',
      ],
      systemPrompt: qaEngineerPrompt,
      capabilities: [
        createAdvisorCapability(AdvisorCapabilities.QA),
        createAdvisorCapability(AdvisorCapabilities.TESTING),
        createAdvisorCapability(AdvisorCapabilities.CODE_REVIEW),
      ],
      allowedTools: ['read_file', 'list_directory', 'search_workspace', 'execute_command'],
      metadata: Object.freeze({ role: AdvisorRoles.QA_ENGINEER, level: 'senior' }),
      routingKeywords: Object.freeze([
        'test', 'testing', 'qa', 'quality', 'coverage', 'test plan', 'unit test', 'e2e', 'defect', 'bug',
        'اختبار', 'جودة', 'تغطية', 'أخطاء', ' QA',
      ]),
    });
  }

  private documentationWriter(): IAdvisor {
    return this.build(AdvisorRoles.DOCUMENTATION_WRITER, {
      name: 'Documentation Writer',
      description:
        'Specialist in technical documentation including API references, guides, READMEs, and knowledge base articles.',
      specialty: 'Technical writing and documentation',
      responsibilities: [
        'Write and maintain accurate technical documentation',
        'Create clear API references, guides, and tutorials',
        'Ensure documentation consistency and discoverability',
        'Document architecture decisions and onboarding materials',
      ],
      systemPrompt: documentationWriterPrompt,
      capabilities: [
        createAdvisorCapability(AdvisorCapabilities.DOCUMENTATION),
        createAdvisorCapability(AdvisorCapabilities.CODE_REVIEW),
      ],
      allowedTools: ['read_file', 'write_file', 'list_directory', 'search_workspace'],
      metadata: Object.freeze({ role: AdvisorRoles.DOCUMENTATION_WRITER, level: 'senior' }),
      routingKeywords: Object.freeze([
        'document', 'documentation', 'readme', 'guide', 'tutorial', 'api reference', 'manual', 'wiki', 'changelog',
        'توثيق', 'دليل', 'كتابة', 'مرجع',
      ]),
    });
  }
}