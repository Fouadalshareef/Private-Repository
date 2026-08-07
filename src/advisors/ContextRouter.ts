import type { IContextRouter, RoutingOptions, RoutingResult, RoutingRule, RoutingMatchType } from './IContextRouter.js';
import { createAdvisorId } from './AdvisorIdentity.js';
import type { IAdvisor } from './IAdvisor.js';
import type { AdvisorCatalog } from './AdvisorCatalog.js';
import { AdvisorRoles } from './AdvisorRole.js';

/**
 * Creates the default routing rule set based on the 11 core advisor personas.
 * Includes multilingual keywords (English/Arabic) for improved routing accuracy.
 */
function createDefaultRules(): readonly RoutingRule[] {
  return Object.freeze([
    Object.freeze({
      id: 'rule-architecture',
      advisorId: createAdvisorId(AdvisorRoles.CHIEF_AI_ARCHITECT),
      keywords: Object.freeze([
        'architecture', 'architect', 'system design', 'scalability', 'technical vision', 'tech stack', 'monolith', 'microservice',
        'معمارية', 'بنية', 'تصميم نظام', 'قابلية التوسع', 'رؤية تقنية', 'هيكلية', 'بنية برمجية', 'مكونات',
      ]),
      priority: 30,
    }),
    Object.freeze({
      id: 'rule-software',
      advisorId: createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER),
      keywords: Object.freeze([
        'implement', 'implementation', 'feature', 'code', 'coding', 'refactor', 'bug fix', 'develop', 'application',
        'تنفيذ', 'برمجة', 'كود', 'تطوير', 'إصلاح', 'ميزة', 'وظيفة', 'تطبيق', 'هيكلة', 'إعادة هيكلة',
      ]),
      priority: 10,
    }),
    Object.freeze({
      id: 'rule-frontend',
      advisorId: createAdvisorId(AdvisorRoles.FRONTEND_ENGINEER),
      keywords: Object.freeze([
        'frontend', 'front-end', 'react', 'vue', 'angular', 'css', 'html', 'ui component', 'state management', 'responsive', 'browser', 'web',
        'واجهة أمامية', 'رياكت', 'vue', 'أنجولار', 'مكونات', 'تصميم متجاوب', 'متصفح', 'موقع ويب', 'تطبيق ويب',
      ]),
      priority: 20,
    }),
    Object.freeze({
      id: 'rule-backend',
      advisorId: createAdvisorId(AdvisorRoles.BACKEND_ENGINEER),
      keywords: Object.freeze([
        'backend', 'back-end', 'api', 'rest', 'graphql', 'server', 'endpoint', 'middleware', 'authentication', 'authorization',
        'خادم', 'واجهة برمجة', 'api', 'middeware', 'مصادقة', 'ترخيص', 'خدمة', 'مخدم', 'واجهات برمجة',
      ]),
      priority: 20,
    }),
    Object.freeze({
      id: 'rule-ui',
      advisorId: createAdvisorId(AdvisorRoles.UI_DESIGNER),
      keywords: Object.freeze([
        'ui', 'user interface', 'visual', 'color', 'typography', 'layout', 'design system', 'component library', 'spacing', 'style', 'interface', 'appearance',
        'تصميم واجهة', 'ألوان', 'خطوط', 'تخطيط', 'تصميم', 'واجهة مستخدم', 'مظهر', 'نظام تصميم', 'مكتبة مكونات', 'مسافات',
      ]),
      priority: 20,
    }),
    Object.freeze({
      id: 'rule-ux',
      advisorId: createAdvisorId(AdvisorRoles.UX_DESIGNER),
      keywords: Object.freeze([
        'ux', 'user experience', 'usability', 'user flow', 'journey', 'information architecture', 'interaction', 'onboarding', 'navigation', 'accessibility',
        'تجربة المستخدم', 'استخدام', 'تدفق', 'تنقل', 'بنية معلومات', 'تفاعل', 'سهولة الاستخدام', 'إرشاد',
      ]),
      priority: 20,
    }),
    Object.freeze({
      id: 'rule-devops',
      advisorId: createAdvisorId(AdvisorRoles.DEVOPS_ENGINEER),
      keywords: Object.freeze([
        'devops', 'ci/cd', 'pipeline', 'deploy', 'deployment', 'infrastructure', 'docker', 'kubernetes', 'terraform', 'monitoring', 'cloud',
        'docker', 'kubernetes', 'نشر', 'بنية تحتية', 'سحابة', 'عمليات', 'إصدار', 'مراقبة', 'حاويات',
      ]),
      priority: 25,
    }),
    Object.freeze({
      id: 'rule-security',
      advisorId: createAdvisorId(AdvisorRoles.SECURITY_ADVISOR),
      keywords: Object.freeze([
        'security', 'vulnerability', 'threat', 'owasp', 'xss', 'sql injection', 'csrf', 'encryption', 'hashing', 'secure', 'penetration', 'audit', 'attack', 'authentication',
        'أمن', 'ثغرات', 'تهديد', 'اختراق', 'تشفير', 'حماية', 'فجوة أمنية', 'هجوم', 'مصادقة آمنة', 'تدقيق أمني',
      ]),
      priority: 30,
    }),
    Object.freeze({
      id: 'rule-database',
      advisorId: createAdvisorId(AdvisorRoles.DATABASE_ARCHITECT),
      keywords: Object.freeze([
        'database', 'schema', 'sql', 'query', 'index', 'indexing', 'data model', 'migration', 'mongodb', 'postgres', 'mysql', 'redis', 'normalization',
        'قاعدة بيانات', 'استعلام', 'فهرس', 'مخطط', ' sql', 'جداول', 'علاقات', 'قواعد بيانات', 'نموذج بيانات',
      ]),
      priority: 20,
    }),
    Object.freeze({
      id: 'rule-qa',
      advisorId: createAdvisorId(AdvisorRoles.QA_ENGINEER),
      keywords: Object.freeze([
        'test', 'testing', 'qa', 'quality', 'coverage', 'test plan', 'unit test', 'e2e', 'defect', 'bug', 'automation', 'validation',
        'اختبار', 'جودة', 'تغطية', 'أخطاء', ' QA', 'أتمتة', 'تحقق', 'عيب', 'اختبارات',
      ]),
      priority: 20,
    }),
    Object.freeze({
      id: 'rule-documentation',
      advisorId: createAdvisorId(AdvisorRoles.DOCUMENTATION_WRITER),
      keywords: Object.freeze([
        'document', 'documentation', 'readme', 'guide', 'tutorial', 'api reference', 'manual', 'wiki', 'changelog',
        'توثيق', 'دليل', 'كتابة', 'مرجع', 'تعليمات', 'كتاب', 'مقال', 'توثيق تقني',
      ]),
      priority: 15,
    }),
  ]);
}

/**
 * Deterministic, rule-based Context Router.
 *
 * Routes user inputs/contexts to the most suitable Advisor Persona.
 * Routing decision logic is pure TypeScript — no external AI calls.
 */
export class ContextRouter implements IContextRouter {
  private readonly catalog: AdvisorCatalog;
  private readonly rules: Map<string, RoutingRule>;

  constructor(catalog: AdvisorCatalog) {
    this.catalog = catalog;
    this.rules = new Map<string, RoutingRule>();
    for (const rule of createDefaultRules()) {
      this.rules.set(rule.id, rule);
    }
  }

  public route(options: RoutingOptions): RoutingResult {
    // 1. Direct routing by preferredAdvisorId
    if (options.preferredAdvisorId) {
      const advisor = this.catalog.get(options.preferredAdvisorId);
      if (advisor) {
        return this.result(advisor, 'direct', 1.0, []);
      }
    }

    // 2. Custom rules (highest priority first)
    const customRules = Array.from(this.rules.values())
      .filter((r) => !r.id.startsWith('rule-'))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    // 3. Metadata matching against advisors
    if (options.metadata) {
      for (const rule of customRules) {
        if (rule.metadata && this.metadataMatches(rule.metadata, options.metadata)) {
          const advisor = this.catalog.get(rule.advisorId);
          if (advisor) {
            return this.result(advisor, 'metadata', 0.95, []);
          }
        }
      }

      // Match metadata keys against advisor capabilities and specialties
      const metaAdvisor = this.matchByMetadata(options.metadata);
      if (metaAdvisor) {
        return this.result(metaAdvisor, 'metadata', 0.9, []);
      }
    }

    // 4. Keyword analysis on input
    const lowerInput = options.input.toLowerCase();
    const ruleMatches: { rule: RoutingRule; matched: string[]; weightedScore: number }[] = [];

    // Evaluate default rules by priority
    const defaultRules = Array.from(this.rules.values())
      .filter((r) => r.id.startsWith('rule-'))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    for (const rule of defaultRules) {
      const matched = rule.keywords.filter((kw) => lowerInput.includes(kw.toLowerCase()));
      if (matched.length > 0) {
        const weightedScore = matched.reduce((sum, kw) => sum + kw.length, 0);
        ruleMatches.push({ rule, matched, weightedScore });
      }
    }

    // Evaluate custom rules with keyword matching
    for (const rule of customRules) {
      const matched = rule.keywords.filter((kw) => lowerInput.includes(kw.toLowerCase()));
      if (matched.length > 0) {
        const weightedScore = matched.reduce((sum, kw) => sum + kw.length, 0);
        ruleMatches.push({ rule, matched, weightedScore });
      }
    }

    if (ruleMatches.length > 0) {
      // Sort by: priority desc, matched keyword count desc, weighted score desc
      ruleMatches.sort((a, b) => {
        const priorityDiff = (b.rule.priority ?? 0) - (a.rule.priority ?? 0);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        const countDiff = b.matched.length - a.matched.length;
        if (countDiff !== 0) {
          return countDiff;
        }
        return b.weightedScore - a.weightedScore;
      });
      const best = ruleMatches[0];
      const advisor = this.catalog.get(best.rule.advisorId);
      if (advisor) {
        const confidence = Math.min(0.95, 0.5 + best.matched.length * 0.15 + best.weightedScore * 0.005);
        return this.result(advisor, best.rule.id.startsWith('rule-') ? 'keyword' : 'rule', confidence, best.matched);
      }
    }

    // 5. Capability/specialty-based matching on input
    const capabilityAdvisor = this.matchByInput(lowerInput);
    if (capabilityAdvisor) {
      return this.result(capabilityAdvisor, 'keyword', 0.7, []);
    }

    // 6. Fallback: preferred fallback or Chief AI Architect, then Software Engineer
    const fallbackId = options.fallbackAdvisorId ?? createAdvisorId(AdvisorRoles.CHIEF_AI_ARCHITECT);
    const fallback = this.catalog.get(fallbackId) ?? this.catalog.get(createAdvisorId(AdvisorRoles.SOFTWARE_ENGINEER));
    if (fallback) {
      return this.result(fallback, 'fallback', 0.3, []);
    }

    throw new Error('No advisor available for routing.');
  }

  public addRule(rule: RoutingRule): void {
    this.rules.set(rule.id, rule);
  }

  public removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  public listRules(): readonly RoutingRule[] {
    return Object.freeze(Array.from(this.rules.values()));
  }

  private result(
    advisor: IAdvisor,
    matchedBy: RoutingMatchType,
    confidence: number,
    matchedKeywords: readonly string[],
  ): RoutingResult {
    return Object.freeze({
      advisor,
      matchedBy,
      confidence,
      matchedKeywords: Object.freeze([...matchedKeywords]),
      timestamp: Date.now(),
    });
  }

  private metadataMatches(
    ruleMeta: Readonly<Record<string, string>>,
    inputMeta: Readonly<Record<string, string>>,
  ): boolean {
    return Object.entries(ruleMeta).every(([key, value]) => inputMeta[key] === value);
  }

  private matchByMetadata(meta: Readonly<Record<string, string>>): IAdvisor | undefined {
    const role = meta['role'] ?? meta['domain'] ?? meta['specialty'];
    if (!role) {
      return undefined;
    }
    const lowerRole = role.toLowerCase();
    for (const advisor of this.catalog.getAll()) {
      const name = advisor.profile.name.toLowerCase();
      const specialty = advisor.profile.specialty.toLowerCase();
      if (
        name.includes(lowerRole) ||
        lowerRole.includes(name) ||
        specialty.includes(lowerRole) ||
        lowerRole.includes(specialty)
      ) {
        return advisor;
      }
    }
    return undefined;
  }

  private matchByInput(lowerInput: string): IAdvisor | undefined {
    let best: IAdvisor | undefined;
    let bestScore = 0;
    for (const advisor of this.catalog.getAll()) {
      let score = 0;
      const specialty = advisor.profile.specialty.toLowerCase();
      if (lowerInput.includes(specialty)) {
        score += 2;
      }
      for (const cap of advisor.profile.capabilities) {
        const capName = String(cap).toLowerCase();
        if (lowerInput.includes(capName)) {
          score += 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = advisor;
      }
    }
    return bestScore > 0 ? best : undefined;
  }
}