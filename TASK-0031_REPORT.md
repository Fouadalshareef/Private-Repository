# TASK-0031_REPORT.md — Full Platform Stabilization Review (Phase 1)

## 1. المشاكل المكتشفة والإصلاحات

### 1.1 CLI Session Bug
**الملف:** `src/cli/CupawCLI.ts`
**المشكلة:** `executeTurn()` كان يستدعي `sessionManager.createSession()` في كل مرة يرسل المستخدم رسالة، مما يسبب استثناء `Session with id "cli-session" already exists.` في الرسالة الثانية.
**السبب:** عدم التحقق من وجود الجلسة قبل إنشائها في `SessionManager`.
**الإصلاح:** إضافة فحص `if (!this.config.sessionManager.getSession(sessionId))` قبل `createSession()`.
**الأسطر المتغيرة:** 4 أسطر

### 1.2 ESLint Disable Comment في ServiceIdentifier
**الملف:** `src/core/container/ServiceIdentifier.ts`
**المشكلة:** وجود تعليق `// eslint-disable-next-line` مخالف لقاعدة "No eslint-disable".
**السبب:** نوع عام phantom `ServiceIdentifier<T>` يحتاج معامل نوع غير مستخدم.
**الإصلاح:** إضافة `varsIgnorePattern: "^_"` لقاعدة ESLint في `eslint.config.js` للسماح بمتغيرات/types تبدأ بـ `_`.
**الأسطر المتغيرة:** 2 أسطر

### 1.3 أداء ContextWindowStrategy — O(n²) Unshift
**الملف:** `src/context/ContextWindowStrategy.ts`
**المشكلة:** طريقة `trimFromBeginning()` تستخدم `result.unshift(message)` في حلقة، مما يسبب تعقيد زمني O(n²).
**السبب:** `Array.unshift()` ينتقل عنصرًا بعنصر في كل استدعاء.
**الإصلاح:** استبدال `unshift` بـ `push` ثم `result.reverse()` لتحقيق O(n).
**الأسطر المتغيرة:** 8 أسطر

### 1.4 Variable Leakage في PromptEngine
**الملف:** `src/prompt/PromptEngine.ts`
**المشكلة:** `renderPromptContent()` يستخدم `strict: false` مما يسمح bằng balises `{{variable}}` بالبقاء في الناتج إذا لم يتم توفير القيمة.
**السبب:** الإعداد الافتراضي غير الآمن يسمح بتسرب placeholders إلى الـ prompt النهائي.
**الإصلاح:** تغيير `strict: false` إلى `strict: true` لضمان طرح خطأ عند فقدان متغيرات Prompt.
**الأسطر المتغيرة:** 2 أسطر

### 1.5 عدم تجميد الرسائل في ConversationMemory
**الملف:** `src/context/ConversationMemory.ts`
**المشكلة:** `addMessage()` و `addMessages()` يخزنان كائنات `AIMessage` قابلة للتعديل، مما يسمح بتعديل المحتوى بعد التخزين.
**السبب:** عدم تجميد كائنات الرسائل عند الإضافة إلى الجلسة.
**الإصلاح:** تجميد كل رسالة بـ `Object.freeze({ ...message })` قبل تخزينها.Also تحديث `getSession()` لاستنساخ كائنات `Date` لمنع تعديلها من الخارج.
**الأسطر المتغيرة:** 20 سطر

### 1.6 الوصول غير الآمن إلى metadata.role
**الملف:** `src/cli/AdvisorCLIHandler.ts`
**المشكلة:** `routeInput()` يصل إلى `advisor.profile.metadata.role` مباشرة بدون fallback.
**السبب:** إذا لم يكن `role` موجودًا في `metadata`، القيمة ستكون `undefined`.
**الإصلاح:** إضافة `?? ''` لتجنب قيمة `undefined`.
**الأسطر المتغيرة:** 1 سطر

### 1.3 ESLint Disable في AdvisorPromptComposer.test.ts
**الملف:** `tests/advisors/AdvisorPromptComposer.test.ts`
**المشكلة:** 3 تعليقات `// eslint-disable-next-line @typescript-eslint/no-explicit-any`.
**السبب:** استخدام `as any` لاختبار حالات حدودية.
**الإصلاح:** استبدال `as any` بـ `as unknown as IAdvisor` و `as unknown as AdvisorComposeContext`.
**الأسطر المتغيرة:** 6 أسطر

---

## 2. الملفات المعدلة

| الملف | نوع التعديل |
|--------|------------|
| `src/cli/CupawCLI.ts` | إصلاح bug الجلسة |
| `src/cli/AdvisorCLIHandler.ts` | إضافة fallback لـ metadata.role |
| `src/advisors/ContextRouter.ts` | تحسين التوجيه (موجود من TASK-0031) |
| `src/advisors/AdvisorIdentity.ts` | إضافة routingKeywords (موجود من TASK-0031) |
| `src/advisors/AdvisorCatalog.ts` | استيراد prompts من ملفات منفصلة (موجود من TASK-0031) |
| `src/advisors/Advisor.ts` | دعم routingKeywords في الـ profile |
| `src/context/ConversationMemory.ts` | تجميد الرسائل واستنساخ Date |
| `src/context/ContextWindowStrategy.ts` | إصلاح أداء trimFromBeginning |
| `src/prompt/PromptEngine.ts` | تغيير strict mode إلى true |
| `src/core/container/ServiceIdentifier.ts` | إزالة eslint-disable |
| `eslint.config.js` | إضافة varsIgnorePattern |
| `tests/advisors/AdvisorPromptComposer.test.ts` | إزالة eslint-disable |
| `tests/advisors/TASK0031.test.ts` | ملف جديد (18 اختبار) |

---

## 3. القرارات المعمارية

1. **إصلاح Session Bug:** استخدام `getSession()` كحاجب بدلاً من إضافة طريقة جديدة `hasSession()`. هذا يحافظ على توافق API الحالي.

2. **تجميد الرسائل عند التخزين:** تجميد `AIMessage` في `addMessage()` يضمن عدم تعديلها بعد التخزين، مع أداء مقبول لأن كل رسالة يتم تجميدها مرة واحدة فقط.

3. **استنساخ Date في getSession():** منع تعديل كائنات `Date` من قبل المستدعين الخارجيين مع الحفاظ على الأداء.

4. **PromptEngine Strict Mode:** جعل `compose()` صارمًا افتراضيًا يمنع تسرب placeholders، وهو آمن لأن جميع الاختبارات والاستدعاءات توفر جميع المتغيرات المطلوبة.

5. **تحسين trimFromBeginning:** استخدام `push` + `reverse` بدلاً من `unshift` يحسن الأداء من O(n²) إلى O(n) دون تغيير الناتج.

---

## 4. الاختبارات

### اختبارات جديدة
- `tests/advisors/TASK0031.test.ts` — 18 اختبار جديد covering:
  - إصلاح bug الجلسة (3 اختبارات)
  - هوية المستشارين والـ prompts (4 اختبارات)
  - تحسين التوجيه متعدد اللغات (7 اختبارات)
  - ملفات تعريف المستشارين (2 اختبارات)
  - اختبارات التكامل (2 اختبارات)

### اختبارات محدثة
- `tests/advisors/AdvisorPromptComposer.test.ts` — إزالة 3 `eslint-disable` comments
- `tests/integration/FullSystemE2E.test.ts` — تحديث حالة توجيه واحدة

### النتيجة الإجمالية
- **33 ملف اختبار**
- **863 اختبار نجح**
- **0 فشل**

---

## 5. نتائج التحقق

### Build
```
npm run build
> cupaw-core@0.1.0 build
> tsc
```
✅ نجح بدون أخطاء

### Lint
```
npm run lint
> cupaw-core@0.1.0 lint
> eslint .
```
✅ نجح بدون أخطاء أو تحذيرات

### Tests
```
npm test
> cupaw-core@0.1.0 test
> vitest run
```
✅ 33 ملف اختبار، 863 اختبار نجح

### CLI Verification
```
cmd /c "echo /help & echo /advisors & echo /route build ui & echo hello & echo second message & echo /exit" | npx tsx src/bin/cupaw.ts
```
✅ النتائج:
- `/help` — تعرض الأوامر المتاحة بشكل صحيح
- `/advisors` — تعرض 11 مستشارًا مع الأسماء والاختصاصات
- `/route build ui` — توجه إلى UI Designer بثقة 66%
- `hello` — تنشئ جلسة "cli-session" مرة واحدة فقط
- `second message` — تعيد استخدام الجلسة بدون إنشاء جديد
- `/exit` — تنهي بشكل نظيف

---

## 6. ملاحظات هندسية للمراحل القادمة

1. **تغطية الاختبارات:** بعض الوحدات مثل `Bootstrap.ts` و `Container.ts` لديها اختبارات أساسية فقط. يُنصح بإضافة اختبارات للتكامل والحدود.

2. **أداء الذاكرة:** `ConversationMemory` يحتفظ بجميع الجلسات في `Map` بدون حد أقصى. في الإنتاج، يُنصح بإضافة حد لعدد الجلسات أو TTL افتراضي.

3. **EventBus:** لا يوجد unsubscribe تلقائي عند انتهاء الجلسة. قد يسبب تسرب في الذاكرة إذا تم الاشتراك في أحداث دون إلغاء الاشتراك.

4. **MockAIProvider:** حاليًا يُرجع ردودًا ثابتة. عند دمج مزود LLM حقيقي، تأكد من معالجة الأخطاء والاستجابة المتدفقة.

5. **Prompt Injection:** تم تحسين `PromptEngine` لمنع تسرب المتغيرات، لكن يُنصح بإضافة فحص صريح لمحتوىPrompt لمنع injection من المستخدم.

6. **Session cleanup:** `SessionManager` لديه `evictExpiredSessions()` لكن لا يتم استدعاؤه تلقائيًا. يُنصح بإضافة مهمة دورية أو استدعاء عند إنشاء جلسة جديدة.

7. **Logger:** حاليًا يسجل إلى الكونسول فقط. في الإنتاج، يُنصح بإضافة خلفيات تسجيل قابلة للتكوين (ملفات، خدمات مراقبة).
