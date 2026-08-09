/**
 * SPEC-001 §4.3 / §5 / §6 — ترحيل بنية بيانات القاموس من v4 إلى v5.
 *
 * مصدر حقيقة واحد يُستورَد من مكانين:
 *  - التطبيق الحي: dictionary.store.ts (يُرحّل بيانات المستخدم في localStorage/Supabase)
 *  - أداة سطر الأوامر: tools/migrate-v4-to-v5.mjs (تُرحّل data.js الثابت)
 *
 * قواعد صارمة (REQ-4، مبدأ عدم الإضرار):
 *  - نقيّة (pure): لا تُعدّل مدخلها، تُعيد نسخة جديدة دائماً.
 *  - idempotent: استدعاؤها مرتين على نفس المُدخَل يُعطي نفس الناتج (REQ-4.4).
 *  - لا ترمي استثناءً أبداً بسبب بنية غير متوقّعة — تتخطّى بأمان بدل أن تُفسد البيانات.
 *  - لا فقد نصّي: كل نص قديم يظهر في عقدة واحدة على الأقل بعد التقسيم (REQ-4.1).
 */

/** خريطة تحويل المعرّفات القديمة → الجديدة (REQ-3.3) — تُستخدم لتصحيح روابط [[id|نص]] في كل مكان */
export const ID_MAP_V4_V5 = {
  'fe-vue': 'fe-fw-vue',
  'fe-vue-reactivity': 'fe-fw-vue-reactivity',
  'fe-vue-vdom': 'fe-fw-vue-vdom',
  'fe-vue-lifecycle': 'fe-fw-vue-lifecycle',
  'fe-vue-components': 'fe-fw-vue-components',
  'fe-vue-emit-provide': 'fe-fw-vue-communication',
  'fe-vue-directives': 'fe-fw-vue-vmodel',
  'fe-vue-special-elements': 'fe-fw-vue-special',
  'fe-vue-router': 'fe-fw-vue-router',
  'fe-vue-router-guards': 'fe-fw-vue-router-guards',
  'fe-vuex': 'fe-fw-vue-vuex',
  'fe-vuex-mutation-action': 'fe-fw-vue-vuex-mutation-action',
};

const deepClone = (o) => JSON.parse(JSON.stringify(o));

const group = (id, title, def, tags = [], children = []) => ({
  id, title, def, kind: 'group', tags, examples: [], children,
});

const term = (id, title, def, tags = [], examples = []) => ({
  id, title, def, kind: 'term', tags, examples, children: [],
});

function findAndRemove(children, id) {
  if (!Array.isArray(children)) return null;
  const idx = children.findIndex((n) => n?.id === id);
  if (idx === -1) return null;
  return children.splice(idx, 1)[0];
}

function findNode(nodes, id) {
  for (const n of nodes ?? []) {
    if (n?.id === id) return n;
    const hit = findNode(n?.children ?? [], id);
    if (hit) return hit;
  }
  return null;
}

/** يستبدل كل [[oldId|نص]] بـ [[newId|نص]] في كل def عبر الشجرة بالكامل — لا يفعل شيئاً إن لم توجد روابط */
function applyIdMapToRefs(dataOrNode, idMap) {
  const rewrite = (s) =>
    typeof s === 'string'
      ? s.replace(/\[\[([a-zA-Z0-9_-]+)(\|[^\]]*)?\]\]/g, (m, id, rest) =>
          idMap[id] ? `[[${idMap[id]}${rest ?? ''}]]` : m,
        )
      : s;
  const walk = (n) => {
    if (!n) return;
    if (typeof n.def === 'string') n.def = rewrite(n.def);
    for (const c of n.children ?? []) walk(c);
  };
  for (const cat of dataOrNode.categories ?? []) walk(cat);
}

// ============================================================
// 5.1 – 5.2  Frontend › أطر العمل والمكتبات (استخراج من fe-vue القديمة)
// ============================================================
function buildFrameworksSection(oldVue) {
  const vueDefIntro =
    '**JS framework** يمكّن من إنشاء موقع تفاعلي بسهولة، ويقلّل الرجوع للسيرفر عند بعض الطلبات. يمكن استخدامه لكامل الموقع أو في جزء منه فقط (widget) إن كان الموقع منشأً مسبقاً.';

  const oldReactivity = findAndRemove(oldVue.children, 'fe-vue-reactivity');
  const oldVdom = findAndRemove(oldVue.children, 'fe-vue-vdom');
  const oldLifecycle = findAndRemove(oldVue.children, 'fe-vue-lifecycle');
  const oldComponents = findAndRemove(oldVue.children, 'fe-vue-components');
  const oldEmitProvide = findAndRemove(oldVue.children, 'fe-vue-emit-provide');
  const oldDirectives = findAndRemove(oldVue.children, 'fe-vue-directives');
  const oldSpecial = findAndRemove(oldVue.children, 'fe-vue-special-elements');
  const oldRouter = findAndRemove(oldVue.children, 'fe-vue-router');
  const oldVuex = findAndRemove(oldVue.children, 'fe-vuex');

  const propsExample = oldComponents?.examples?.[0]
    ? [oldComponents.examples[0]]
    : [];
  const vuexMutationExample = (() => {
    const child = oldVuex?.children?.find((c) => c.id === 'fe-vuex-mutation-action');
    return child?.examples ?? [];
  })();

  const optionsApi = term(
    'fe-fw-vue-options-api',
    'Options API',
    'أصبحت قديمة؛ في المشاريع الكبيرة يصعب التنقل بين `data` و`mutations` و`computed`… المتناثرة، وتتكرر الدوال بين components.',
    ['options api'],
    [{ title: 'شكل Options API', lang: 'js', code: "export default {\n  data() { return { count: 0 }; },\n  computed: { double() { return this.count * 2; } },\n  methods: { inc() { this.count++; } }\n}" }],
  );

  const compositionSetup = term(
    'fe-fw-vue-composition-setup',
    'setup()',
    'نقطة الدخول لمنطق Composition API داخل الكمبوننت. يُنفَّذ قبل بقية الخيارات، وما يُعاد منه (return) يصبح متاحاً في الـ template.',
    ['setup', 'composition api'],
    [{ title: 'استخدام setup', lang: 'js', code: "export default {\n  setup() {\n    const count = ref(0);\n    const inc = () => count.value++;\n    return { count, inc };\n  }\n}" }],
  );

  const compositionApi = group(
    'fe-fw-vue-composition-api',
    'Composition API',
    'الأفضل حالياً، عبر `setup()` بدلاً من التوزيع القديم.',
    ['composition api'],
    [compositionSetup],
  );

  const reactivityChildren = [
    term('fe-fw-vue-reactivity-ref', 'ref()',
      'لجعل متغيّر (خصوصاً string/number) قابلاً للتغيير والتتبّع في Composition API، ويُقرأ عبر `.value`.',
      ['ref', 'reactivity', 'composition api'],
      [{ title: 'عدّاد بسيط', lang: 'js', code: "import { ref } from 'vue';\nconst count = ref(0);\ncount.value++;        // داخل الـ script: .value\n// في الـ template:  {{ count }}   بلا .value" }]),
    term('fe-fw-vue-reactivity-reactive', 'reactive()',
      'نفس فكرة `ref` لكن مخصَّصة للـ **object**.',
      ['reactive', 'reactivity'],
      [{ title: 'object تفاعلي', lang: 'js', code: "import { reactive } from 'vue';\nconst state = reactive({ count: 0, name: 'ali' });\nstate.count++;   // بلا .value لأنه object" }]),
    term('fe-fw-vue-reactivity-toref', 'toRef()',
      'لتحويل خاصية من object إلى ref مستقل، فتُستخدم بدون كتابة `.value`، ويبقى الاثنان مرتبطين.',
      ['toref', 'reactivity'],
      [{ title: 'استخراج خاصية كـ ref', lang: 'js', code: "import { reactive, toRef } from 'vue';\nconst state = reactive({ count: 0 });\nconst count = toRef(state, 'count');\ncount.value++;   // يُحدّث state.count أيضاً" }]),
    term('fe-fw-vue-reactivity-computed', 'computed()',
      'لا تُستخدم لتغيير قيمة متغيّر، بل لإخراج قيمة جديدة مشتقّة من متغيّر موجود. غالباً تُستخدم لتحسين مظهر كود HTML — توضع فيها شروط `v-if` أو أي منطق كان سيُكتب مباشرة في القالب، وتُستخدم عادة مع `v-bind`.',
      ['computed', 'reactivity'],
      [{ title: 'قيمة مشتقّة', lang: 'js', code: "import { ref, computed } from 'vue';\nconst count = ref(2);\nconst double = computed(() => count.value * 2);\n// double.value يتحدّث تلقائياً مع كل تغيير في count" }]),
  ];
  const reactivity = group(
    'fe-fw-vue-reactivity',
    oldReactivity?.title ?? 'التفاعلية',
    'دوال Vue التي تجعل البيانات قابلة للتتبّع، بحيث يتحدّث العرض تلقائياً عند تغيّرها.',
    oldReactivity?.tags ?? ['reactivity'],
    reactivityChildren,
  );

  const vdom = term(
    'fe-fw-vue-vdom',
    oldVdom?.title ?? 'Virtual DOM',
    oldVdom?.def ?? '',
    oldVdom?.tags ?? ['virtual dom'],
    [{ title: 'فكرة المقارنة (توضيحي)', lang: 'js', code: "// عند تغيّر state، Vue يبني شجرة virtual DOM جديدة\n// ويقارنها بالقديمة (diff) ليحدّث الفرق فقط في الـ DOM الحقيقي\nconst newTree = render(state);\npatch(oldTree, newTree);   // تحديث الفروق فقط" }],
  );

  const lifecycle = term(
    'fe-fw-vue-lifecycle',
    oldLifecycle?.title ?? 'Lifecycle Hooks',
    `${oldLifecycle?.def ?? ''}\n\n\`beforeCreate()\` و \`created()\` تقريباً بنفس زمن \`setup()\`.`,
    oldLifecycle?.tags ?? ['lifecycle'],
    [{ title: 'استخدام mounted', lang: 'js', code: "export default {\n  mounted() {\n    console.log('العنصر أصبح في الـ DOM الآن');\n  }\n}" }],
  );

  const componentsChildren = [
    term('fe-fw-vue-components-component', 'Component',
      'جزء من الكود يمكن تكراره في أكثر من موضع دون تكرار الكود، بحيث يكون كل component مستقلاً بذاته.',
      ['component'],
      [{ title: 'استخدام كمبوننت', lang: 'html', code: "<template>\n  <UserCard :name=\"'Ali'\" />\n</template>" }]),
    term('fe-fw-vue-components-props', 'Props',
      'تصدّر بيانات من الأب إلى **الابن المباشر** فقط. البيانات المُرسَلة لا يمكن تغييرها في الابن مباشرة — يجب نسخها لمتغيّر جديد بداخله ثم تعديل النسخة.',
      ['props'],
      propsExample.length ? propsExample : [{ title: 'استقبال Props في الابن', lang: 'html', code: "<!-- Child.vue -->\n<script>\nexport default {\n  props: ['name', 'age']\n}\n</script>" }]),
    term('fe-fw-vue-components-refs', 'Refs (في Vue)',
      'توضع داخل أي عنصر HTML لإعطائنا قيمة منه، تُستخدم في أي مكان دون الحاجة لعمل متغيّر في `data`. غالباً تُخرج نصاً حتى لو كُتبت أرقام.',
      ['refs'],
      [{ title: 'الوصول لعنصر DOM', lang: 'html', code: "<input ref=\"nameInput\">\n<script>\nexport default {\n  mounted() { this.$refs.nameInput.focus(); }\n}\n</script>" }]),
    term('fe-fw-vue-components-scoped', '<style scoped>',
      'يجعل الـ style مقصوراً على الـ component الذي هو فيه فقط.',
      ['scoped', 'style'],
      [{ title: 'style مقصور', lang: 'html', code: "<style scoped>\n.title { color: red; } /* لا يؤثر على مكوّنات أخرى */\n</style>" }]),
    term('fe-fw-vue-components-slot', 'Slot',
      "لاستيراد كود HTML من الأب إلى الابن (child component) لعمل تنسيق خاص عليه. يمكن تسمية أكثر من slot عبر `name=''` واستدعاؤه بـ `<template v-slot:name>`. **Scoped slot**: تُستخدم لنقل داتا من child إلى parent (أو لمن هو في نفس المستوى).",
      ['slot', 'scoped slot'],
      [{ title: 'slot مسمّى', lang: 'html', code: "<!-- الأب -->\n<Card><template v-slot:header>عنوان</template></Card>\n\n<!-- Card.vue -->\n<slot name=\"header\"></slot>" }]),
  ];
  const components = group(
    'fe-fw-vue-components',
    oldComponents?.title ?? 'Components',
    'المفاهيم المرتبطة ببناء واستخدام component مستقل: تعريفه، تمرير بيانات له، والتحكم بنطاق الـ style.',
    oldComponents?.tags ?? ['component'],
    componentsChildren,
  );

  const communicationChildren = [
    term('fe-fw-vue-communication-emit', 'emit',
      'تُستخدم في الـ child component لتشغيل method أو function موجودة في الـ **parent** عند حدوث أمر في الابن — لنقل بيانات من الابن للأب. يشترط أن يكون الكومبوننت مستخدَماً في الأب.',
      ['emit'],
      [{ title: 'إرسال حدث للأب', lang: 'html', code: "<!-- Child -->\n<button @click=\"$emit('save', value)\">حفظ</button>\n\n<!-- Parent -->\n<Child @save=\"onSave\" />" }]),
    term('fe-fw-vue-communication-provide-inject', 'provide/inject',
      "تُستخدمان لتصدير الداتا من الأب إلى الأبناء **غير المباشرين** (الذين لم يُستدعوا مباشرة في الأب).\n\n⚠️ عند تعديل array كاملة صُدِّرت بـ `provide` (مثل حذف عنصر بـ `filter`)، لن يظهر التغيير في الواجهة لأنه لن يحدث render جديد — يجب بدلاً من ذلك إيجاد الـ index وحذفه بـ `splice` لتعديل الجزء المطلوب فقط لا الـ array كاملة.",
      ['provide', 'inject', 'splice'],
      [{ title: 'تمرير داتا عبر مستويات', lang: 'js', code: "// الجد\nprovide('theme', ref('dark'));\n\n// الحفيد (بلا props وسيطة)\nconst theme = inject('theme');" }]),
  ];
  const communication = group(
    'fe-fw-vue-communication',
    'التواصل بين المكوّنات',
    'طرق نقل البيانات بين component وآخر خارج نطاق props المباشرة.',
    oldEmitProvide?.tags ?? ['emit', 'provide', 'inject'],
    communicationChildren,
  );

  const vmodelChildren = [
    term('fe-fw-vue-vmodel-lazy', 'v-model.lazy', 'يُصدَّر ما يُكتب عند **الانتهاء** لا مع كل حرف.', ['v-model', 'lazy'],
      [{ title: 'تحديث عند فقدان التركيز فقط', lang: 'html', code: '<input v-model.lazy="name">' }]),
    term('fe-fw-vue-vmodel-number', 'v-model.number', 'يجبر الإخراج كأرقام.', ['v-model', 'number'],
      [{ title: 'إخراج رقمي', lang: 'html', code: '<input v-model.number="age" type="text">' }]),
    term('fe-fw-vue-vmodel-trim', 'v-model.trim', 'يحذف المسافات الزائدة.', ['v-model', 'trim'],
      [{ title: 'إزالة المسافات تلقائياً', lang: 'html', code: '<input v-model.trim="username">' }]),
    term('fe-fw-vue-vmodel-input', '@input',
      'تُستخدم لإخراج ما في الحقول (مثل v-model و ref) عادةً قبل حدوث submit، للتحقق من كل حقل.',
      ['@input'],
      [{ title: 'تحقق أثناء الكتابة', lang: 'html', code: '<input @input="validate($event.target.value)">' }]),
  ];
  const vmodel = group(
    'fe-fw-vue-vmodel',
    'v-model',
    "**v-model**: تُخرج نتائج الكتابة في `input`، وتُقابلها في الكمبوننت `props:['modelValue']` و `emit:['update:modelValue']`.",
    oldDirectives?.tags ?? ['v-model'],
    vmodelChildren,
  );

  const specialChildren = [
    term('fe-fw-vue-special-is', "<component :is=''>",
      "يُظهر أي component مستورَد بحسب الاسم الممرَّر في `is`، للتبديل السريع دون render جديد.",
      ['component dynamic', 'is'],
      [{ title: 'تبديل ديناميكي', lang: 'html', code: '<component :is="currentTab"></component>' }]),
    term('fe-fw-vue-special-keepalive', '<keep-alive>',
      'يُبقي الـ component محتفظاً بداتاه عند التنقل بينه وبين غيره.',
      ['keep-alive'],
      [{ title: 'حفظ حالة تبويب', lang: 'html', code: '<keep-alive>\n  <component :is="currentTab"></component>\n</keep-alive>' }]),
    term('fe-fw-vue-special-teleport', "<teleport to=''>",
      'ينقل ما بداخله لمكان محدَّد في الـ DOM (مفيد مع popups).',
      ['teleport'],
      [{ title: 'نافذة منبثقة خارج التسلسل', lang: 'html', code: '<teleport to="body">\n  <div class="modal">…</div>\n</teleport>' }]),
    term('fe-fw-vue-special-fragments', 'Fragments',
      'منذ Vue 3، يمكن وضع عدة عناصر مباشرة داخل `<template>` دون حاوية واحدة (`div`).',
      ['fragments'],
      [{ title: 'بلا حاوية زائدة', lang: 'html', code: '<template>\n  <h1>عنوان</h1>\n  <p>فقرة</p>\n</template>' }]),
  ];
  const special = group(
    'fe-fw-vue-special',
    oldSpecial?.title ?? 'العناصر الخاصة',
    'عناصر Vue المدمجة للتحكم في العرض والتنقّل بين components.',
    oldSpecial?.tags ?? ['special elements'],
    specialChildren,
  );

  const perfAsync = term(
    'fe-fw-vue-perf-async',
    'defineAsyncComponent',
    'يجعل الـ component يُحمَّل عند الحاجة فقط، لتحسين الـ performance.',
    ['defineAsyncComponent', 'lazy loading', 'أداء'],
    [{ title: 'تحميل كسول لكمبوننت', lang: 'js', code: "import { defineAsyncComponent } from 'vue';\nconst Heavy = defineAsyncComponent(() => import('./Heavy.vue'));" }],
  );
  const performance = group('fe-fw-vue-performance', 'الأداء', 'مفاهيم مرتبطة بتحسين سرعة تحميل الـ components.', ['performance', 'أداء'], [perfAsync]);

  // ---------- Vue Router (P1 من التقرير السابق — أُنجز الآن: تفكيك كامل بدل إعادة تسمية فقط) ----------
  const routerGuardsChildren = [
    term('fe-fw-vue-router-guards-scroll', 'scrollBehavior(to, from, savedPosition)',
      'التحكم بموضع التمرير عند التنقل.', ['scrollBehavior'],
      [{ title: 'العودة لأعلى الصفحة', lang: 'js', code: "const router = createRouter({\n  scrollBehavior() { return { top: 0 }; },\n});" }]),
    term('fe-fw-vue-router-guards-beforeeach', 'router.beforeEach(to, from, next)',
      'منع/إجبار الانتقال لرابط قبل الذهاب إليه (مثل حماية المسارات لغير المسجّلين).', ['beforeEach'],
      [{ title: 'حماية مسار', lang: 'js', code: "router.beforeEach((to, from, next) => {\n  if (to.meta.requiresAuth && !isLoggedIn()) next('/login');\n  else next();\n});" }]),
    term('fe-fw-vue-router-guards-beforeenter', 'beforeEnter(to, from, next)',
      'نفس فكرة `beforeEach` لكن مرتبطة بـ path محدَّد فقط.', ['beforeEnter'],
      [{ title: 'حارس على مسار واحد', lang: 'js', code: "{ path: '/admin', component: Admin, beforeEnter: (to, from, next) => next() }" }]),
    term('fe-fw-vue-router-guards-aftereach', 'router.afterEach(to, from)',
      'تعمل بعد الانتقال (لإرسال داتا تتبّع مثلاً).', ['afterEach'],
      [{ title: 'تتبّع تغيّر الصفحة', lang: 'js', code: "router.afterEach((to) => {\n  analytics.trackPageView(to.fullPath);\n});" }]),
    term('fe-fw-vue-router-guards-beforerouteleave', 'beforeRouteLeave(to, from, next)',
      'داخل الكمبوننت نفسه، للتحكم عند مغادرته (مثل تحذير عند وجود تعديلات غير محفوظة).', ['beforeRouteLeave'],
      [{ title: 'تحذير قبل المغادرة', lang: 'js', code: "beforeRouteLeave(to, from, next) {\n  if (this.unsaved && !confirm('مغادرة بلا حفظ؟')) next(false);\n  else next();\n}" }]),
    term('fe-fw-vue-router-guards-meta', "meta في الـ route",
      'بيانات تُستخدم في route guards (مثل منع الدخول لغير المسجّلين).', ['meta'],
      [{ title: 'وسم مسار محمي', lang: 'js', code: "{ path: '/admin', component: Admin, meta: { requiresAuth: true } }" }]),
    term('fe-fw-vue-router-guards-view', '<router-view>', 'الوسم الذي يعرض المسار الحالي.', ['router-view'],
      [{ title: 'مكان عرض الصفحات', lang: 'html', code: '<router-view></router-view>' }]),
    term('fe-fw-vue-router-guards-link', "<router-link to=''>", 'بديل وسم `a` مرتبط بالـ routes.', ['router-link'],
      [{ title: 'رابط تنقّل', lang: 'html', code: '<router-link to="/about">عن الموقع</router-link>' }]),
  ];
  const oldRouterGuards = oldRouter?.children?.find((c) => c.id === 'fe-vue-router-guards');
  const routerGuards = group(
    'fe-fw-vue-router-guards',
    oldRouterGuards?.title ?? 'Navigation Guards',
    'أدوات التحكم بالتنقّل بين المسارات ومتى يُسمح به.',
    oldRouterGuards?.tags ?? ['navigation guards'],
    routerGuardsChildren,
  );

  const routerChildren = [
    term('fe-fw-vue-router-routes', 'routes: [{}]', 'كل object فيها property باسم `path` و `component`.', ['routes'],
      [{ title: 'تعريف route', lang: 'js', code: "const routes = [\n  { path: '/team/:teamId', component: TeamView, props: true },\n];" }]),
    term('fe-fw-vue-router-alias', 'alias', 'رابطان مختلفان لنفس الكمبوننت.', ['alias'],
      [{ title: 'مسار بديل', lang: 'js', code: "{ path: '/home', alias: '/', component: Home }" }]),
    term('fe-fw-vue-router-redirect', 'redirect', 'تحويل رابط لآخر.', ['redirect'],
      [{ title: 'إعادة توجيه', lang: 'js', code: "{ path: '/old', redirect: '/new' }" }]),
    term('fe-fw-vue-router-props', 'props: true', 'تصدير قيمة الـ params مباشرة كـ props في الكمبوننت.', ['props'],
      [{ title: 'params كـ props', lang: 'js', code: "{ path: '/user/:id', component: User, props: true }" }]),
    term('fe-fw-vue-router-route-params', 'this.$route.params',
      "لجلب قيم مكتوبة بعد `:` في الـ path مثل `path:'/team/:teamId'`.", ['route.params'],
      [{ title: 'قراءة param', lang: 'js', code: 'const teamId = this.$route.params.teamId;' }]),
    term('fe-fw-vue-router-catchall', "path:'/:notFound(.*)'", 'صفحة اصطياد أي رابط غير موجود.', ['catch-all', '404'],
      [{ title: 'صفحة 404', lang: 'js', code: "{ path: '/:notFound(.*)', component: NotFound }" }]),
    term('fe-fw-vue-router-query', 'Query Parameter', 'إضافات على الرابط بعد `?`.', ['query'],
      [{ title: 'قراءة query', lang: 'js', code: '// /search?q=vue\nconst q = this.$route.query.q;' }]),
    routerGuards,
  ];
  const router = oldRouter
    ? group(
        'fe-fw-vue-router',
        oldRouter.title ?? 'Vue Router',
        'يتحكم في وجود أكثر من رابط متفرّع من الرابط الأساسي. بعد `install`، يُستدعى ويُخزَّن في متغيّر `router`، فيصبح متاحاً عبر `this.$router` في أي مكان.',
        oldRouter.tags ?? ['router'],
        routerChildren,
      )
    : null;

  // ---------- Vuex (P1 من التقرير السابق — أُنجز الآن: تفكيك كامل بدل إعادة تسمية فقط) ----------
  const vuexState = group(
    'fe-fw-vue-vuex-state',
    'State',
    'مكان تخزين البيانات المُدارة، بنوعين حسب النطاق.',
    ['state'],
    [
      term('fe-fw-vue-vuex-state-local', 'Local State', 'يُدار في كمبوننت واحد (أو أبنائه فقط).', ['local state'],
        [{ title: 'state محلي داخل module', lang: 'js', code: "const userModule = {\n  state: () => ({ profile: null }),\n};" }]),
      term('fe-fw-vue-vuex-state-global', 'Global State', 'يُدار عبر أكثر من كمبوننت.', ['global state'],
        [{ title: 'state عام في الجذر', lang: 'js', code: 'const store = createStore({\n  state: () => ({ theme: "dark" }),\n});' }]),
    ],
  );
  const vuexModules = term(
    'fe-fw-vue-vuex-modules', 'Modules',
    'object يحوي `state` و `mutation` و `getter` و `action` خاصة به لتقليل التكرار وزيادة التنظيم؛ يُستدعى في `createStore` الرئيسي، ويكون الـ state بداخله **local**.',
    ['modules'],
    [{ title: 'تسجيل module', lang: 'js', code: "const store = createStore({\n  modules: { user: userModule },\n});" }],
  );
  const vuexNamespaced = term(
    'fe-fw-vue-vuex-namespaced', 'Namespaced',
    'يجعل الـ module يعمل كـ mainStore منفصل، لتجنّب تعارض الأسماء بين module محلي وآخر عام.',
    ['namespaced'],
    [{ title: 'تفعيل namespaced', lang: 'js', code: "const userModule = {\n  namespaced: true,\n  state: () => ({ profile: null }),\n};" }],
  );

  const vuexMutationActionChildren = [
    term('fe-fw-vue-vuex-mutation', 'Mutation', 'methods تُستخدم في أكثر من كمبوننت، تُستدعى عبر `commit`.', ['mutation', 'commit'],
      [{ title: 'استدعاء mutation', lang: 'js', code: "this.$store.commit('increment');" }]),
    term('fe-fw-vue-vuex-payload', 'Payload', 'argument يُمرَّر للـ mutation عند الاستدعاء.', ['payload'],
      [{ title: 'commit مع payload', lang: 'js', code: "this.$store.commit('setUser', { name: 'Ali' });" }]),
    term('fe-fw-vue-vuex-action', 'Action',
      'تأخذ methods من الـ Mutation وتُنفَّذها **بعد مهلة** (تُستخدم لطلبات http غير المتزامنة) عبر `context`، وتحوي `context` أيضاً: `getters`، `dispatch`، `state`، `rootGetter`/`rootState` (للربط بين modules مختلفة).',
      ['action', 'dispatch'],
      [{ title: 'action غير متزامن', lang: 'js', code: "actions: {\n  async fetchUser(context) {\n    const res = await api.getUser();\n    context.commit('setUser', res.data);\n  }\n}\n// من الكمبوننت:\nthis.$store.dispatch('fetchUser');" }]),
    term('fe-fw-vue-vuex-getters', 'Getters',
      'لا تُغيّر قيمة، بل تُخرج قيمة جديدة معتمدة على الـ state — لتُستخدم في أكثر من component دون تكرار المنطق.',
      ['getters'],
      [{ title: 'getter بسيط', lang: 'js', code: "getters: {\n  doneTodos(state) { return state.todos.filter(t => t.done); }\n}" }]),
    term('fe-fw-vue-vuex-map-helpers', 'Map Helpers',
      'اختصارات (`mapActions`, `mapGetters`, `mapMutations`…) بدل كتابة `this.$store.commit/dispatch/getter` بالكامل في كل مرة.',
      ['map helpers', 'mapActions', 'mapGetters', 'mapMutations'],
      vuexMutationExample.length ? vuexMutationExample : [{ title: 'استخدام mapActions', lang: 'js', code: "import { mapActions } from 'vuex';\n\nexport default {\n  methods: {\n    ...mapActions({ nicName: 'action method name' })\n  }\n}" }]),
  ];
  const vuexMutationAction = group(
    'fe-fw-vue-vuex-mutation-action',
    'Mutation و Action و Getters',
    'آلية تعديل الحالة في Vuex وقراءتها منها.',
    ['mutation', 'action', 'getters'],
    vuexMutationActionChildren,
  );

  const vuex = oldVuex
    ? group(
        'fe-fw-vue-vuex',
        oldVuex.title ?? 'Vuex — إدارة الحالة',
        'مكتبة لإدارة المحتوى التفاعلي في Vue.',
        oldVuex.tags ?? ['vuex'],
        [vuexState, vuexModules, vuexNamespaced, vuexMutationAction],
      )
    : null;

  const vue = group(
    'fe-fw-vue',
    'Vue',
    vueDefIntro,
    ['vue', 'framework'],
    [optionsApi, compositionApi, reactivity, vdom, lifecycle, components, communication, vmodel, special, performance, router, vuex].filter(Boolean),
  );

  const what = term(
    'fe-fw-what',
    'ما هو الـ Framework؟',
    'مكتبة أو قواعد أنشأها آخرون — دوال وقواعد معيّنة، بعد تعلّمها ترشدك لبناء التطبيق بسهولة أكبر.',
    ['framework', 'فريموورك'],
    [{ title: 'استدعاء إطار عمل بدل بناء المنطق يدوياً', lang: 'js', code: "// بدون framework: تكتب منطق التحديث بنفسك\ndocument.querySelector('#count').textContent = state.count;\n\n// مع framework (Vue): يكفي وصف الحالة، والتحديث يحدث تلقائياً\nconst count = ref(0);\n// {{ count }} في الـ template تتحدّث وحدها عند count.value++" }],
  );

  const vsLibrary = term(
    'fe-fw-vs-library',
    'Framework مقابل Library',
    'الفرق الجوهري هو **من يتحكم في تدفّق التنفيذ (control)**: عند استخدام **Library** أنت تستدعيها من كودك وقتما تريد. عند استخدام **Framework** هو من يستدعي كودك (Inversion of Control) — تكتب الأجزاء التي يطلبها هو، وهو من يقرر متى ينفّذها.',
    ['framework', 'library', 'inversion of control', 'مكتبة'],
    [{ title: 'من يستدعي مَن', lang: 'js', code: "// Library: أنت تستدعيها\nimport { debounce } from 'lodash';\ndebounce(fn, 300)();\n\n// Framework: هو يستدعي كودك\nexport default {\n  mounted() { /* Vue تستدعيها هي وقتما تحتاجها */ }\n}" }],
  );

  const react = group('fe-fw-react', 'React',
    'جاهزة للإضافة — راجع [[fe-fw-what|ما هو الـ Framework؟]] و [[fe-fw-vs-library|Framework مقابل Library]] كنقطة بداية.',
    ['react'], []);
  const angular = group('fe-fw-angular', 'Angular',
    'جاهزة للإضافة — راجع [[fe-fw-what|ما هو الـ Framework؟]] و [[fe-fw-vs-library|Framework مقابل Library]] كنقطة بداية.',
    ['angular'], []);

  return group(
    'fe-fw',
    'أطر العمل والمكتبات',
    'تجمع كل إطار عمل مستقل (Vue، React، Angular…) كابن مباشر، بدل دفنه داخل غيره.',
    ['framework', 'library', 'أطر عمل', 'مكتبات'],
    [what, vsLibrary, vue, react, angular],
  );
}

// ============================================================
// 5.3  Frontend › HTML › الوسوم — تفكيك العقد المتضخّمة
// ============================================================
function splitHtmlTags(htmlTagsNode) {
  const struct = findNode(htmlTagsNode.children ?? [], 'fe-html-tags-struct');
  if (struct) {
    struct.def = 'الوسوم التي تُشكّل هيكل أي صفحة HTML أساسية. للوسوم الدلالية الإضافية انظر [[fe-html-semantic|الوسوم الدلالية]].';
    struct.kind = 'group';
    struct.children = [
      term('fe-html-tags-struct-html', '<html>', 'جذر المستند.', ['html'],
        [{ title: 'وسم الجذر', lang: 'html', code: '<html lang="ar" dir="rtl">\n  …\n</html>' }]),
      term('fe-html-tags-struct-head', '<head>', 'بيانات تقنية عن الموقع لا تظهر فيه لكنه يحتاجها للـ SEO والـ meta.', ['head'],
        [{ title: 'رأس بسيط', lang: 'html', code: '<head>\n  <meta charset="UTF-8">\n  <title>صفحتي</title>\n</head>' }]),
      term('fe-html-tags-struct-title', '<title>', 'عنوان الصفحة.', ['title'],
        [{ title: 'عنوان الصفحة في التبويب', lang: 'html', code: '<title>Gardening</title>' }]),
      term('fe-html-tags-struct-meta', '<meta>', 'بيانات وصفية (keywords, description, charset…).', ['meta'],
        [{ title: 'وسوم meta شائعة', lang: 'html', code: '<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="description" content="وصف الصفحة">\n<meta name="keywords" content="apple, tree">' }]),
      term('fe-html-tags-struct-body', '<body>', 'وسم حاوٍ يُستخدم كجزء رئيسي لإظهار كل محتوى الصفحة.', ['body'],
        [{ title: 'هيكل أدنى', lang: 'html', code: '<body>\n  <h1>مرحباً</h1>\n</body>' }]),
      term('fe-html-tags-struct-div', '<div>', 'حاوية block عامة.', ['div'],
        [{ title: 'حاوية عامة', lang: 'html', code: '<div class="box">محتوى</div>' }]),
    ];
  }

  const text = findNode(htmlTagsNode.children ?? [], 'fe-html-tags-text');
  if (text) {
    text.def = 'وسوم عرض النصوص وتنسيقها الأساسي.';
    text.kind = 'group';
    text.children = [
      term('fe-html-tags-text-headings', '<h1> – <h6>', 'عناوين بمستويات.', ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'headings'],
        [{ title: 'تسلسل العناوين', lang: 'html', code: '<h1>عنوان رئيسي</h1>\n<h2>عنوان فرعي</h2>' }]),
      term('fe-html-tags-text-p', '<p>', 'فقرة.', ['p'],
        [{ title: 'فقرة نصية', lang: 'html', code: '<p>هذه فقرة نصية.</p>' }]),
      term('fe-html-tags-text-b-strong', '<b> مقابل <strong>',
        'يجعل `<b>` النص **bold** بصرياً فقط. `<strong>` يُظهر النص كمهم دلالياً — ويُستخدم مع ضعاف البصر وصعوبة التعلم لجعل الموقع أكثر قابلية للاستخدام، وقارئ الشاشة يشدّد عليه.',
        ['b', 'strong', 'bold'],
        [{ title: 'الفرق بينهما', lang: 'html', code: '<b>عريض بصرياً فقط</b>\n<strong>عريض ومهم دلالياً</strong>' }]),
      term('fe-html-tags-text-i-em', '<i> مقابل <em>',
        'يجعل `<i>` النص *italic* مائلاً بصرياً فقط. `<em>` يُظهر النص كمؤكَّد ويظهر مائلاً، لكن قارئ الشاشة **يشدّد عليه** عند نطقه.',
        ['i', 'em', 'italic'],
        [{ title: 'الفرق بينهما', lang: 'html', code: '<i>مائل بصرياً فقط</i>\n<em>مائل ومؤكَّد دلالياً</em>' }]),
      term('fe-html-tags-text-u', '<u>', 'وسم حاوٍ يضع خطاً تحت النص.', ['u'],
        [{ title: 'خط تحت النص', lang: 'html', code: '<u>نص تحته خط</u>' }]),
      term('fe-html-tags-text-small', '<small>', 'نص أصغر.', ['small'],
        [{ title: 'نص ثانوي', lang: 'html', code: '<small>حقوق النشر © 2026</small>' }]),
      term('fe-html-tags-text-list', '<ul><li>', 'قائمة غير مرتّبة.', ['ul', 'li', 'list'],
        [{ title: 'قائمة نقطية', lang: 'html', code: '<ul>\n  <li>عنصر أول</li>\n  <li>عنصر ثانٍ</li>\n</ul>' }]),
      term('fe-html-tags-text-br-hr', '<br> و <hr>', 'يضع `<br>` سطراً جديداً. `<hr>` خط فاصل.', ['br', 'hr'],
        [{ title: 'فاصل وسطر جديد', lang: 'html', code: 'سطر أول<br>سطر ثانٍ\n<hr>' }]),
      term('fe-html-tags-text-blockquote', '<blockquote>', "اقتباس، عبر `cite=''` لمصدره.", ['blockquote'],
        [{ title: 'اقتباس بمصدر', lang: 'html', code: '<blockquote cite="https://example.com">نص مقتبس</blockquote>' }]),
    ];
  }

  const media = findNode(htmlTagsNode.children ?? [], 'fe-html-tags-media');
  if (media) {
    const originalExample = media.examples?.[0] ?? null;
    media.def = 'وسوم عرض الصور والفيديو والصوت.';
    media.kind = 'group';
    media.children = [
      term('fe-html-tags-media-img', '<img>',
        "وسم يُظهر الصور الموجودة مسبقاً على السيرفر المرتبط بالموقع. `src` يوضع فيه رابط الصورة، و `alt` نص بديل (مهم للـ SEO وقارئ الشاشة).",
        ['img', 'alt'],
        [{ title: 'صورة مع alt', lang: 'html', code: '<img src="cat.jpg" alt="قطة نائمة">' }]),
      term('fe-html-tags-media-video-audio', '<video> و <audio>',
        "يوضع مسار الملف في `src`. أهم الـ attributes:\n- `autoplay` تشغيل تلقائي بمجرد تحميل الصفحة\n- `controls` أدوات تحكم: تشغيل/إيقاف، الصوت، ملء الشاشة\n- `poster=''` صورة تظهر على الفيديو قبل التشغيل",
        ['video', 'audio', 'autoplay', 'controls'],
        originalExample ? [originalExample] : []),
      term('fe-html-tags-media-source', '<source>',
        'توضع داخل الفيديو أو الصوت، ويمكن وضع أكثر من واحدة: إن لم يدعم المتصفح الصيغة الأولى انتقل للتالية. و `type` توضّح صيغة الملف.',
        ['source'],
        [{ title: 'مصدر بديل', lang: 'html', code: '<source src="clip.ogg" type="audio/ogg">' }]),
      term('fe-html-tags-media-figure', '<figure> و <figcaption>',
        'يجمع `<figure>` مجموعة صور ليفهم المتصفح أنها مرتبطة معاً. `<figcaption>` وصف أو تعليق يوضع تحت الصورة.',
        ['figure', 'figcaption'],
        [{ title: 'صورة بتعليق', lang: 'html', code: '<figure>\n  <img src="cat.jpg" alt="قطة">\n  <figcaption>قطة في الحديقة</figcaption>\n</figure>' }]),
    ];
  }

  const form = findNode(htmlTagsNode.children ?? [], 'fe-html-tags-form');
  if (form) {
    form.def = 'وسوم بناء النماذج وإدخال البيانات.';
    form.kind = 'group';
    form.children = [
      term('fe-html-tags-form-form', '<form>', "الحاوية، عبر `action=''` لوجهة الإرسال.", ['form'],
        [{ title: 'نموذج بسيط', lang: 'html', code: '<form action="/submit">…</form>' }]),
      term('fe-html-tags-form-label', '<label>', "تسمية الحقل، عبر `for=''` تربطه بمعرّف الحقل.", ['label'],
        [{ title: 'تسمية مرتبطة بحقل', lang: 'html', code: '<label for="email">البريد</label>\n<input id="email">' }]),
      term('fe-html-tags-form-input', '<input>',
        "حقل إدخال، عبر `type=''` `id=''` `value=''` `placeholder=''` `name=''` `required`. خاصية `autofocus` تجعل مؤشر الكتابة يقف فيه تلقائياً بعد تحميل الصفحة.",
        ['input', 'autofocus'],
        [{ title: 'حقل نصي إلزامي', lang: 'html', code: '<input type="text" name="username" placeholder="اسم المستخدم" required autofocus>' }]),
      term('fe-html-tags-form-select', '<select>', "قائمة منسدلة، تحوي `<option value=''>`.", ['select', 'option'],
        [{ title: 'قائمة اختيار', lang: 'html', code: '<select name="city">\n  <option value="cairo">القاهرة</option>\n</select>' }]),
      term('fe-html-tags-form-textarea', '<textarea>', "صندوق نص متعدد الأسطر، عبر `name=''` `id=''` `cols=''` `placeholder=''`.", ['textarea'],
        [{ title: 'صندوق نص', lang: 'html', code: '<textarea name="msg" cols="30" placeholder="رسالتك"></textarea>' }]),
      term('fe-html-tags-form-fieldset', '<fieldset> و <legend>',
        'يضع `<fieldset>` حدوداً حول مجموعة من الـ inputs. `<legend>` عنوان يوضع بمحاذاة خط الـ border في الـ fieldset.',
        ['fieldset', 'legend'],
        [{ title: 'تجميع حقول', lang: 'html', code: '<fieldset>\n  <legend>بيانات الاتصال</legend>\n  <input type="email">\n</fieldset>' }]),
      term('fe-html-tags-form-details', '<details> و <summary>', 'يصنع سهماً يُظهر ويُخفي المحتوى بداخله.', ['details', 'summary'],
        [{ title: 'محتوى قابل للطي', lang: 'html', code: '<details>\n  <summary>عرض المزيد</summary>\n  <p>محتوى إضافي.</p>\n</details>' }]),
    ];
  }

  const table = findNode(htmlTagsNode.children ?? [], 'fe-html-tags-table');
  if (table) {
    const originalExample = table.examples?.[0] ?? null;
    table.def = 'وسوم بناء الجداول.';
    table.kind = 'group';
    table.children = [
      term('fe-html-tags-table-structure', '<table> · <thead> · <tbody> · <tfoot>',
        'الحاوية الرئيسية للجدول، ومناطقه الثلاث: الرأس، الجسم، والتذييل.',
        ['table', 'thead', 'tbody', 'tfoot'],
        originalExample ? [originalExample] : []),
      term('fe-html-tags-table-row-cell', '<tr> · <th> · <td>', 'يمثّل `<tr>` صفاً. `<th>` خلية عنوان. `<td>` خلية بيانات.', ['tr', 'th', 'td'],
        [{ title: 'صف وخلايا', lang: 'html', code: '<tr>\n  <th>الاسم</th>\n  <td>أحمد</td>\n</tr>' }]),
      term('fe-html-tags-table-spacing', 'Cell padding و Cell spacing',
        '**Cell padding**: المسافة من الكلام المكتوب في الخلية إلى حوافها. **Cell spacing**: المسافة بين الخلايا وبعضها.',
        ['cellpadding', 'cellspacing'],
        [{ title: 'تباعد الخلايا', lang: 'css', code: 'table { border-spacing: 8px; }\ntd { padding: 6px; }' }]),
      term('fe-html-tags-table-colspan', 'colspan / rowspan', '`colspan` لدمج أعمدة. `rowspan` لدمج صفوف بنفس المبدأ.', ['colspan', 'rowspan'],
        [{ title: 'دمج أعمدة', lang: 'html', code: '<tr><td colspan="3">الإجمالي</td></tr>' }]),
    ];
  }
}

// ============================================================
// 5.4  Frontend › CSS › وحدات القياس — تفكيك الـ God Node
// ============================================================
/**
 * يحوّل fe-css-units من عقدة term تسرد ٦ وحدات في الـ def
 * إلى group بستة أبناء مستقلين (em / rem / px / vh / vw / %).
 * الدالة idempotent: إن وجدت children أصلاً لا تفعل شيئاً.
 */
function splitCssUnits(frontendNode) {
  const units = findNode(frontendNode.children ?? [], 'fe-css-units');
  if (!units || (units.children?.length ?? 0) > 0) return; // idempotent

  units.def =
    'الوحدات الأكثر استخداماً في CSS — مرجع كل وحدة مختلف عن الأخرى.';
  units.kind = 'group';
  units.examples = [];
  units.tags = ['em', 'rem', 'px', 'vh', 'vw', '%', 'وحدات', 'units'];
  units.children = [
    term(
      'fe-css-units-em',
      'em',
      'نسبية إلى حجم الخط في الـ **parent**. إن كان الأب `font-size: 20px` فإن `1em = 20px`. تتضاعف عند التداخل.',
      ['em', 'relative', 'وحدات'],
      [{ title: 'em نسبي للأب', lang: 'css', code: '.parent { font-size: 20px; }\n.child  { font-size: 1.5em; } /* = 30px */' }],
    ),
    term(
      'fe-css-units-rem',
      'rem',
      'نسبية إلى جذر المستند `html`، لا إلى الـ parent — لا تتضاعف عند التداخل وهذا يجعلها أكثر قابلية للتنبؤ.',
      ['rem', 'root', 'وحدات'],
      [{ title: 'rem نسبي لـ html', lang: 'css', code: 'html { font-size: 16px; }\n.box  { font-size: 1.5rem; } /* = 24px دائماً مهما تداخل */' }],
    ),
    term(
      'fe-css-units-px',
      'px',
      'قيمة ثابتة مطلقة لا تُنسب إلى أي عنصر — تبقى كما هي بغض النظر عن الـ parent أو حجم نافذة المتصفح.',
      ['px', 'pixel', 'ثابت', 'وحدات'],
      [{ title: 'حجم ثابت', lang: 'css', code: '.icon { width: 24px; height: 24px; }' }],
    ),
    term(
      'fe-css-units-vh',
      'vh',
      '**Viewport Height** — نسبة من ارتفاع نافذة المتصفح مباشرةً، **بغض النظر عن الـ parent**. `100vh` = ارتفاع النافذة كاملاً.',
      ['vh', 'viewport height', 'وحدات'],
      [{ title: 'قسم يملأ الشاشة طولاً', lang: 'css', code: '.hero { height: 100vh; } /* ارتفاع النافذة كاملاً */' }],
    ),
    term(
      'fe-css-units-vw',
      'vw',
      '**Viewport Width** — نسبة من عرض نافذة المتصفح مباشرةً، **بغض النظر عن الـ parent**. `50vw` = نصف عرض النافذة.',
      ['vw', 'viewport width', 'وحدات'],
      [{ title: 'عرض نسبة من النافذة', lang: 'css', code: '.sidebar { width: 30vw; }' }],
    ),
    term(
      'fe-css-units-percent',
      '%',
      'نسبة مئوية من الـ **parent** — تُحسب من عرضه عند استخدامها في `width`، ومن ارتفاعه في `height`.',
      ['%', 'percent', 'نسبة', 'وحدات'],
      [{ title: 'نصف عرض الأب', lang: 'css', code: '.child { width: 50%; } /* = نصف عرض الـ parent */' }],
    ),
  ];
}

// ============================================================
// 5.5  Frontend › JS › AJAX و JSON — فصل مفهومين مختلطين
// ============================================================
/**
 * يحوّل fe-js-ajax من term يخلط AJAX/XHR مع JSON
 * إلى group بعقدتين مستقلتين: fe-js-ajax-core و fe-js-json.
 * الدالة idempotent: إن وجدت children أصلاً لا تفعل شيئاً.
 */
function splitJsAjax(frontendNode) {
  const ajax = findNode(frontendNode.children ?? [], 'fe-js-ajax');
  if (!ajax || (ajax.children?.length ?? 0) > 0) return; // idempotent

  // نحفظ الأمثلة الأصلية ونُوزّعها على العقدتين الجديدتين
  const xhrExample = ajax.examples?.[0] ?? null;
  const jsonExample = ajax.examples?.[1] ?? null;

  const ajaxCore = term(
    'fe-js-ajax-core',
    'AJAX و XHR',
    '**AJAX** — *Asynchronous JavaScript and XML* — تقنية تتيح إرسال واستقبال البيانات مع السيرفر **دون إعادة تحميل الصفحة**.\n\n- **Synchronous**: لا يُرسَل طلب جديد إلا بعد الرد على السابق\n- **Asynchronous**: يمكن إرسال أكثر من طلب في نفس الوقت، والرد يأتي بأي ترتيب\n\n**XHR (XMLHttpRequest)** — الـ API القديم لعمل AJAX، له properties منها `readyState` (0 uninitialized → 4 complete) و `status` (200s نجاح، 400s خطأ عميل، 500s خطأ سيرفر)، ومethods مثل `.open()` و `.send()`.',
    ['ajax', 'xhr', 'xmlhttprequest', 'synchronous', 'asynchronous'],
    xhrExample ? [xhrExample] : [],
  );

  const json = term(
    'fe-js-json',
    'JSON',
    '**JSON** — *JavaScript Object Notation* — تنسيق نصي خفيف الوزن لنقل البيانات وتخزينها، حلّ محلّ XML لأنه أسهل هيكلةً وتوليداً في JavaScript.\n\n- **`JSON.parse(text)`** — يحوّل النص (string) إلى كائن JavaScript قابل للتعامل\n- **`JSON.stringify(obj)`** — يحوّل كائن JavaScript إلى نص لإرساله أو حفظه',
    ['json', 'parse', 'stringify', 'json.parse', 'json.stringify'],
    jsonExample ? [jsonExample] : [],
  );

  ajax.def = 'إرسال واستقبال البيانات دون إعادة تحميل الصفحة (AJAX/XHR)، ومعيار JSON لتبادلها وتخزينها.';
  ajax.kind = 'group';
  ajax.examples = [];
  ajax.tags = ['ajax', 'json', 'xhr', 'asynchronous'];
  ajax.children = [ajaxCore, json];
}

/**
 * نقطة الدخول الوحيدة. تُعيد نسخة جديدة من `data` بعد الترحيل، أو `data` كما هي
 * إن كانت بالفعل v5 أو لم تحتوِ العُقَد المتوقَّعة (idempotent + آمنة).
 * @param {{version:number, updatedAt:string, categories:any[]}} data
 */
export function migrateV4ToV5(data) {
  if (!data || !Array.isArray(data.categories)) return data;
  if ((data.version ?? 0) >= 5) return data; // REQ-4.4 — idempotent

  const next = deepClone(data);
  const frontend = next.categories.find((c) => c?.id === 'frontend');

  if (frontend && Array.isArray(frontend.children)) {
    // P0 — §5.1–5.3: أطر العمل + HTML Tags
    const oldVue = findAndRemove(frontend.children, 'fe-vue');
    if (oldVue) frontend.children.push(buildFrameworksSection(oldVue));

    const htmlTagsNode = findNode(frontend.children, 'fe-html-tags');
    if (htmlTagsNode) splitHtmlTags(htmlTagsNode);

    // P1 — §5.4–5.5: CSS Units + JS AJAX/JSON
    splitCssUnits(frontend);
    splitJsAjax(frontend);
  }

  applyIdMapToRefs(next, ID_MAP_V4_V5);
  next.version = 5;
  return next;
}
