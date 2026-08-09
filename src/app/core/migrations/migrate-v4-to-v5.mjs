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
// 5.0b  Frontend › أطر العمل › React — محتوى اليوم الثامن
// ============================================================
/**
 * يبني شجرة محتوى React كاملة (اليوم 8) مقارناً بـ Vue.
 * idempotent: يُستدعى فقط داخل buildFrameworksSection ولا يُعدّل بيانات موجودة.
 */
function buildReactSection() {
  // 1. المكوّن
  const component = term(
    'fe-fw-react-component',
    'المكوّن (Component)',
    'في Vue المكوّن ملف `.vue` فيه 3 أقسام منفصلة. في React المكوّن **دالة JavaScript عادية** تعمل `return` لشكل الواجهة.\n\n**المنطق** في أعلى الدالة — **الشكل (JSX)** في الـ `return`.\n\n⚠️ اسم المكوّن لازم يبدأ بحرف **كبير** — وإلا React تظنّه وسم HTML عادي.',
    ['component', 'مكوّن', 'jsx', 'function'],
    [{ title: 'مكوّن بسيط', lang: 'jsx',
       code: '// Hello.jsx\nfunction Hello() {\n  // المنطق هنا\n\n  return <h3>أهلاً!</h3>;\n}\n\nexport default Hello;' }],
  );

  // 2. JSX
  const jsxRules = term(
    'fe-fw-react-jsx-rules',
    'قواعد JSX الأربع',
    '1. **قوس واحد بدل اتنين**: `{name}` بدل `{{ name }}`\n2. **class تبقى className** — لأن `class` كلمة محجوزة في JavaScript\n3. **عنصر أب واحد** — لو عندك أكثر من عنصر لفّهم بـ `<>...</>` (Fragment)\n4. **كل وسم يُغلق**: `<br />` و `<img />`\n\n💡 أي شيء داخل `{ }` في JSX هو **JavaScript** — `{2 + 2}` يطبع 4، `{user.name}` يطبع الاسم.',
    ['jsx', 'classname', 'fragment', 'قواعد'],
    [{ title: 'Vue مقابل JSX', lang: 'jsx',
       code: '// Vue\n<div class="box">\n  <p>{{ name }}</p>\n  <br>\n</div>\n\n// React (JSX)\n<div className="box">\n  <p>{name}</p>\n  <br />\n</div>' }],
  );
  const jsx = group(
    'fe-fw-react-jsx',
    'JSX — الـ HTML جوّه JavaScript',
    'JSX يسمح بكتابة HTML مباشرةً داخل JavaScript. 4 قواعد فقط تختلف عن HTML العادي.',
    ['jsx', 'template', 'syntax'],
    [jsxRules],
  );

  // 3. Props
  const props = term(
    'fe-fw-react-props',
    'Props — تمرير بيانات للابن',
    'الاستدعاء **متطابق** بين Vue و React: `<Card title="مرحبا" />`.\n\nالفرق فقط في **الاستقبال**: بدل `defineProps` تفكّ الكائن في معاملات الدالة.\n\n**قاعدة مشتركة**: props للقراءة فقط — الابن لا يعدّلها أبداً.',
    ['props', 'properties'],
    [{ title: 'Vue مقابل React', lang: 'jsx',
       code: "// Vue — الابن\n// defineProps(['title'])\n// {{ title }}\n\n// React — الابن\nfunction Card({ title }) {\n  return <h4>{title}</h4>;\n}\n\n// الأب — متطابق في الاتنين\n<Card title=\"مرحبا\" />" }],
  );

  // 4. useState
  const useState = term(
    'fe-fw-react-usestate',
    'useState — إدارة الحالة',
    '`useState` تُعيد زوجاً: **القيمة الحالية** و**setter (دالة للتغيير)**.\n\n```\nconst [count, setCount] = useState(0);\n//     ↑قيمة   ↑setter       ↑ابتدائية\n```\n\n**أهم فرق مع Vue**: في Vue `count.value++` مباشر ✅. في React `count++` ممنوع — لن يُحدّث الشاشة. لازم `setCount(count + 1)` لأن الـ setter هو من **يُخبر React بإعادة الرسم**.',
    ['usestate', 'state', 'hook', 'setter', 'حالة'],
    [
      { title: 'useState مقابل ref', lang: 'jsx',
        code: '// Vue\nconst count = ref(0)\ncount.value++  // مباشر ✅\n\n// React\nconst [count, setCount] = useState(0)\ncount++              // ❌ الشاشة لن تتغير\nsetCount(count + 1)  // ✅ يُعيد الرسم' },
      { title: 'تحديث مصفوفة', lang: 'jsx',
        code: '// ❌ خطأ — push لا تُخبر React\nitems.push(newItem)\n\n// ✅ صح — نسخة جديدة\nsetItems([...items, newItem])\nsetItems(items.filter(i => i.id !== id)) // حذف' },
    ],
  );

  // 5. الشرط
  const conditional = term(
    'fe-fw-react-cond',
    'الشرط — بدل v-if',
    'React **لا تحتوي** `v-if`. بدلاً منها JavaScript عادي داخل `{ }`:\n\n- **`{cond && <Element />}`** — اعرض فقط لو الشرط صحيح\n- **`{cond ? <A /> : <B />}`** — اعرض A أو B',
    ['conditional', 'v-if', 'ternary', 'شرط'],
    [{ title: 'الشرط في JSX', lang: 'jsx',
       code: "// Vue\n// <p v-if=\"isLoggedIn\">أهلاً</p>\n// <p v-if=\"ok\">نعم</p><p v-else>لا</p>\n\n// React\n{isLoggedIn && <p>أهلاً</p>}\n{ok ? <p>نعم</p> : <p>لا</p>}" }],
  );

  // 6. القوائم
  const lists = term(
    'fe-fw-react-lists',
    'القوائم — بدل v-for',
    'بدل `v-for` تستخدم `.map()` — تدخل قائمة عناصر، تخرج قائمة JSX.\n\n**`key` إجبارية** في الاتنين — هي "الرقم القومي" لكل عنصر حتى React تعرف مَن تغيّر بدل إعادة رسم القائمة كاملة.',
    ['v-for', 'map', 'list', 'key', 'قوائم'],
    [{ title: '.map() بدل v-for', lang: 'jsx',
       code: "// Vue\n// <li v-for=\"u in users\" :key=\"u.id\">{{ u.name }}</li>\n\n// React\n{users.map(u => (\n  <li key={u.id}>{u.name}</li>\n))}" }],
  );

  // 7. useEffect
  const useEffect = term(
    'fe-fw-react-useeffect',
    'useEffect — التأثيرات الجانبية',
    '`useEffect(fn, deps)` تنفّذ `fn` عند تغيّر أي قيمة في مصفوفة `deps`.\n\n| الشكل | يشتغل إمتى؟ | يقابل في Vue |\n|---|---|---|\n| `useEffect(fn, [])` | مرة واحدة عند الظهور | `onMounted` |\n| `useEffect(fn, [id])` | كل ما `id` تتغيّر | `watch(id, ...)` |\n\n⚠️ **أكبر خطأ للمبتدئين**: نسيان المصفوفة `[]` يُشغّل الـ effect بعد **كل رسمة** ← حلقة لا نهائية.',
    ['useeffect', 'hook', 'onmounted', 'watch', 'side effect'],
    [
      { title: 'جلب بيانات عند الظهور', lang: 'jsx',
        code: "// Vue: onMounted(async () => { data.value = await fetch(...) })\n\n// React\nuseEffect(() => {\n  fetch('/api/items')\n    .then(r => r.json())\n    .then(d => setItems(d));\n}, []); // ← [] = مرة واحدة فقط" },
      { title: 'تنظيف عند الإزالة (كـ onUnmounted)', lang: 'jsx',
        code: 'useEffect(() => {\n  const timer = setTimeout(() => setDone(true), 3000);\n  return () => clearTimeout(timer); // تنظيف\n}, []);' },
    ],
  );

  // 8. جدول الترجمة Vue → React
  const translation = term(
    'fe-fw-react-translation',
    'جدول الترجمة — Vue → React',
    '| Vue 3 | React | ملاحظة |\n|---|---|---|\n| `ref(0)` | `useState(0)` | التغيير بالـ setter فقط |\n| `computed(...)` | متغيّر عادي في الدالة | يُحسب تلقائياً كل رسمة |\n| `onMounted` | `useEffect(fn, [])` | — |\n| `watch(x, fn)` | `useEffect(fn, [x])` | — |\n| `v-if` | `{cond && ...}` | JavaScript عادي |\n| `v-for` | `.map()` | `key` إجبارية |\n| `v-model` | `value` + `onChange` | يدوي في React |\n| `@click` | `onClick` | camelCase |\n| `:class` | `className={...}` | — |\n| `defineProps` | `function C({ x })` | — |\n| `emit(\'save\')` | تمرير دالة كـ prop | `<C onSave={fn} />` |\n| `<slot />` | `props.children` | — |\n| Pinia | `useContext` / Zustand | Context يكفي في البداية |\n| composable | Custom Hook | نفس الفكرة تماماً |',
    ['vue react comparison', 'translation', 'cheatsheet', 'ترجمة', 'مقارنة'],
    [],
  );

  // 9. أخطاء شائعة
  const commonErrors = term(
    'fe-fw-react-errors',
    'أخطاء شائعة في React',
    '1. **`count++` بدل `setCount(count + 1)`** → الشاشة لن تتغيّر\n2. **نسيان `[]` في `useEffect`** → حلقة لا نهائية\n3. **`class` بدل `className`** → التنسيق لن يعمل\n4. **`onClick={fn()}`** (بأقواس) → تُستدعى فوراً لحظة الرسم! الصح: `onClick={fn}` أو `onClick={() => fn(id)}`\n5. **تعديل مصفوفة بـ `push`** → React لن تلاحظ. الصح: `setItems([...items, newItem])`\n6. **اسم مكوّن بحرف صغير** `function card()` → React تظنّه وسم HTML. لازم `Card`',
    ['errors', 'mistakes', 'أخطاء', 'gotchas'],
    [],
  );

  return group(
    'fe-fw-react',
    'React',
    'مكتبة UI من Meta — نفس فكرة Vue (رسم الشاشة عند تغيّر البيانات) بطريقة مختلفة: **دوال تُعيد JSX** بدل ملفات `.vue`.\n\n**القاعدة الذهبية**: React = دوال تُعيد JSX · تغيير الحالة عبر الـ setter فقط · `{ }` تعني JavaScript هنا.',
    ['react', 'jsx', 'hooks', 'مكتبة'],
    [component, jsx, props, useState, conditional, lists, useEffect, translation, commonErrors],
  );
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

  // React — اليوم الثامن: محتوى كامل بدل الـ placeholder
  const react = buildReactSection();
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

// ============================================================
// P2.1  Backend › HTTP — فصل البروتوكول عن رموز الحالة (§5.6)
// ============================================================
/**
 * يحوّل be-http من term يخلط تعريف HTTP/HTTPS مع رموز الحالة
 * إلى group بعقدتين مستقلتين: be-http-protocol و be-http-status.
 * الدالة idempotent: إن وجدت children بالفعل لا تفعل شيئاً.
 */
function splitBeHttp(backendNode) {
  const http = findNode(backendNode.children ?? [], 'be-http');
  if (!http || (http.children?.length ?? 0) > 0) return; // idempotent

  const protocol = term(
    'be-http-protocol',
    'HTTP و HTTPS',
    '**HTTP** — *HyperText Transfer Protocol*\n\n- **Hyper text**: لغة ترميز خاصة (HTML) توفّر معياراً موحّداً بين المتصفح والسيرفر\n- **Transfer**: نقل الداتا من كمبيوتر لآخر — نص أو صورة أو غيرها\n- **Protocol**: بروتوكول معروف عالمياً بين الدول\n\n**HTTPS** — *HTTP Secure* — يضيف طبقة تشفير **TLS** فوق HTTP، مما يحمي البيانات من الاعتراض أثناء النقل. ضروري لبوابات الدفع وأي بيانات حساسة.',
    ['http', 'https', 'protocol', 'بروتوكول'],
    [],
  );

  const status = term(
    'be-http-status',
    'HTTP Status Codes',
    'كود رقمي يُرسله السيرفر مع كل رد ليوضّح حالة الطلب:\n\n- **2xx** — نجاح: `200 OK`، `201 Created`، `204 No Content`\n- **3xx** — توجيه: `301 Moved Permanently`، `302 Found`\n- **4xx** — خطأ من **العميل**: `400 Bad Request`، `401 Unauthorized`، `403 Forbidden`، `404 Not Found`\n- **5xx** — خطأ من **السيرفر**: `500 Internal Server Error`، `503 Service Unavailable`',
    ['status code', '200', '404', '500', 'http status'],
    [
      {
        title: 'أشهر رموز الحالة',
        lang: 'text',
        code: '200 OK              — نجاح\n201 Created         — أُنشئ مورد جديد\n204 No Content      — نجاح بلا محتوى (مثل حذف)\n400 Bad Request     — طلب مكسور من العميل\n401 Unauthorized    — يجب تسجيل الدخول\n403 Forbidden       — مسموح بالدخول لكن ممنوع من هذا المورد\n404 Not Found       — المورد غير موجود\n500 Server Error    — خطأ داخلي في السيرفر\n503 Unavailable     — السيرفر مشغول أو في صيانة',
      },
    ],
  );

  http.def = 'بروتوكول نقل النصوص الفائقة، ورموز الحالة التي يُرجعها السيرفر للتعبير عن نتيجة الطلب.';
  http.kind = 'group';
  http.tags = ['http', 'https', 'status code', 'protocol'];
  http.examples = [];
  http.children = [protocol, status];
}

// ============================================================
// P2.2  UI-UX › SEO — فصل مفهوم SEO عن آليات Crawl/Index/Serve (§5.7)
// ============================================================
/**
 * يُضيف ux-seo-concept و ux-seo-pipeline كأوّل أبناء لـ ux-seo،
 * ويُبقي الأبناء الموجودين (performance/tools/core-vitals) كما هم.
 * الدالة idempotent: تتحقق من وجود ux-seo-concept قبل الإضافة.
 */
function splitUxSeo(uiuxNode) {
  const seo = findNode(uiuxNode.children ?? [], 'ux-seo');
  if (!seo) return;
  // idempotent: ux-seo له أبناء أصلاً (performance/tools/vitals) — نتحقق من وجود concept تحديداً
  if ((seo.children ?? []).find((c) => c.id === 'ux-seo-concept')) return;

  const concept = term(
    'ux-seo-concept',
    'ما هو SEO؟',
    '**SEO — Search Engine Optimization**: مدى قابلية ظهور موقعك ضمن نتائج البحث في Google، عبر بوتات/عناكب تقرأ محتوى الموقع (خاصةً الـ `meta`) وتصنّفه وفق الصلة بمصطلحات البحث.',
    ['seo', 'search engine', 'google', 'تحسين'],
    [],
  );

  const pipeline = term(
    'ux-seo-pipeline',
    'كيف يعمل محرك البحث؟ (Crawl → Index → Serve)',
    '**Crawling (الزحف)**: بوتات محرك البحث تجوب الإنترنت عبر الروابط، تكتشف الصفحات الجديدة وتستخرج محتواها.\n\n**Indexing (الفهرسة)**: تُصنَّف الصفحات المكتشفة في فهرس ضخم مُنظَّم حسب الموضوع — مثل مكتبة إلكترونية.\n\n**Serving (التقديم)**: عند بحث المستخدم، يُعالج المحرك الاستعلام ويُقدّم قائمة مرتّبة من النتائج الأكثر صلة.',
    ['crawl', 'index', 'serving', 'google', 'زحف', 'فهرسة'],
    [],
  );

  const existingChildren = seo.children ?? [];
  seo.def = 'تحسين ظهور موقعك في محركات البحث — من المفهوم إلى آلية عمل الزحف والفهرسة والتقديم.';
  seo.kind = 'group';
  seo.examples = [];
  // نُضيف concept و pipeline في البداية ونُبقي باقي الأبناء
  seo.children = [concept, pipeline, ...existingChildren];
}

// ============================================================
// P2.3  UI-UX › PWA — فصل اشتراطات PWA عن Service Worker (§5.8)
// ============================================================
/**
 * يحوّل ux-pwa من term يخلط اشتراطات PWA مع شرح Service Worker
 * إلى group بعقدتين: ux-pwa-requirements و ux-pwa-service-worker.
 * الدالة idempotent: إن وجدت children بالفعل لا تفعل شيئاً.
 */
function splitUxPwa(uiuxNode) {
  const pwa = findNode(uiuxNode.children ?? [], 'ux-pwa');
  if (!pwa || (pwa.children?.length ?? 0) > 0) return; // idempotent

  const requirements = term(
    'ux-pwa-requirements',
    'اشتراطات PWA',
    'لكي يُعامَل تطبيق الويب كـ **Progressive Web App** يجب توفّر أربعة شروط:\n\n1. التطبيق **Responsive** — يتأقلم مع كل أحجام الشاشات\n2. السيرفر يعمل على **HTTPS**\n3. يمكن تنزيله كتطبيق مستقل (**Standalone Application**)\n4. يوجد فيه **Service Worker**',
    ['pwa', 'progressive web app', 'responsive', 'https', 'standalone'],
    [],
  );

  const serviceWorker = term(
    'ux-pwa-service-worker',
    'Service Worker',
    '**Service Worker**: سكريبت يعمل في الخلفية (**background thread**) مستقلاً عن الصفحة الرئيسية، ويمكّن من:\n\n- **Push Notifications** — إرسال إشعارات للمستخدم حتى وهو خارج الموقع (مثل تويتر)\n- **Offline caching** — حفظ الأصول محلياً للعمل بلا إنترنت\n- **Background sync** — تأجيل إرسال البيانات حتى عودة الاتصال',
    ['service worker', 'push notification', 'offline', 'cache', 'background'],
    [
      {
        title: 'تسجيل Service Worker',
        lang: 'js',
        code: "if ('serviceWorker' in navigator) {\n  navigator.serviceWorker.register('/sw.js')\n    .then(reg => console.log('SW registered:', reg.scope))\n    .catch(err => console.error('SW error:', err));\n}",
      },
    ],
  );

  pwa.def = 'مجموعة شروط تحوّل تطبيق الويب إلى تجربة تشبه التطبيقات النصية — قابلة للتنزيل وتعمل بلا إنترنت.';
  pwa.kind = 'group';
  pwa.examples = [];
  pwa.children = [requirements, serviceWorker];
}

// ============================================================
// P2.4  DevOps › Docker — فصل مفهوم Docker عن Docker Image (§5.9)
// ============================================================
/**
 * يحوّل do-docker من term يخلط مفهوم Docker مع شرح Image
 * إلى group بعقدتين: do-docker-concept و do-docker-image.
 * الدالة idempotent: إن وجدت children بالفعل لا تفعل شيئاً.
 */
function splitDoDocker(devopsNode) {
  const docker = findNode(devopsNode.children ?? [], 'do-docker');
  if (!docker || (docker.children?.length ?? 0) > 0) return; // idempotent

  const concept = term(
    'do-docker-concept',
    'ما هو Docker؟',
    'برنامج يُنشئ **بيئات عمل معزولة (containers)** لكل مشروع، تحتوي على جميع مكوّناته (Node، البيئة، الاعتماديات) بغض النظر عما هو مثبّت على جهازك.\n\n**المشكلة التي يحلّها**: مشروع يحتاج Node 18 وآخر يحتاج Node 20 — بدون Docker تتعارض. مع Docker كل مشروع في container مستقل لا يؤثر في غيره.',
    ['docker', 'container', 'عزل', 'بيئة عمل', 'isolation'],
    [],
  );

  const image = term(
    'do-docker-image',
    'Docker Image',
    '**Image**: قالب جاهز للقراءة فقط (**read-only template**) يصف كل ما يحتاجه المشروع — نظام التشغيل، إصدار Node، البيئة، الأوامر. يُنشئ Docker منه **Container** يعمل فعلياً.\n\n- **Image** = الوصفة (Blueprint) — ثابتة لا تتغير\n- **Container** = النسخة الحية منها (Instance) — تُنشأ وتُحذف\n\nكل مشروع يصف Image خاصة به في ملف `Dockerfile`.',
    ['docker image', 'image', 'container', 'dockerfile', 'template'],
    [
      {
        title: 'Dockerfile بسيط لتطبيق Node',
        lang: 'dockerfile',
        code: 'FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\nCOPY . .\nCMD ["node", "server.js"]',
      },
    ],
  );

  docker.def = 'أداة تعزل كل مشروع في بيئته المستقلة — مفهوم Container والـ Image الذي يصف هذه البيئة.';
  docker.kind = 'group';
  docker.examples = [];
  docker.children = [concept, image];
}

// ============================================================
// P3.1  Backend › Auth — توسيع العقدة الشحيحة وفصل Authn عن Authz (§5.10)
// ============================================================
/**
 * يوسّع be-auth من جملة واحدة إلى group بفرعين:
 *   be-auth-authn — Session/Cookie + JWT + OAuth 2.0/SSO
 *   be-auth-authz — Roles/Permissions + RBAC
 * الدالة idempotent: إن وجدت children بالفعل لا تفعل شيئاً.
 */
function expandBeAuth(backendNode) {
  const auth = findNode(backendNode.children ?? [], 'be-auth');
  if (!auth || (auth.children?.length ?? 0) > 0) return; // idempotent

  const session = term(
    'be-auth-session',
    'Session و Cookie',
    'بعد تسجيل الدخول يحفظ السيرفر **session** بمعرّف فريد (`session_id`) ويُرسله للمتصفح في **cookie**. في كل طلب لاحق يُرسل المتصفح الـ cookie فيتعرّف السيرفر على المستخدم دون طلب بيانات مجدداً.',
    ['session', 'cookie', 'session_id'],
    [{ title: 'تتابع Session', lang: 'text', code: '1. POST /login {email, password}\n2. السيرفر يُنشئ session → Set-Cookie: sid=abc123\n3. GET /profile → Cookie: sid=abc123 → يُعرَّف المستخدم تلقائياً' }],
  );

  const jwt = term(
    'be-auth-jwt',
    'JWT — JSON Web Token',
    'رمز **موقَّع** يحمل بيانات المستخدم (claims) مشفَّرة بـ Base64. يُرسَل في header كل طلب ويتحقق السيرفر من توقيعه دون الرجوع لقاعدة بيانات.\n\n**التركيب**: `Header . Payload . Signature`\n- **Header**: خوارزمية التوقيع (`HS256`…)\n- **Payload**: البيانات (`userId`, `role`, `exp`)\n- **Signature**: توقيع بسر خاص يمنع التزوير\n\n**مقارنة**: JWT **stateless** (السيرفر لا يخزّن شيئاً) ↔ Session **stateful** (يحتاج DB أو Redis).',
    ['jwt', 'token', 'json web token', 'bearer', 'claims'],
    [{ title: 'إرسال JWT في header', lang: 'http', code: 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiI0MiIsInJvbGUiOiJ1c2VyIn0.abc123' }],
  );

  const oauth = term(
    'be-auth-oauth',
    'OAuth 2.0 و SSO',
    '**OAuth 2.0**: بروتوكول تفويض يسمح لتطبيقك بالوصول لبيانات المستخدم من خدمة خارجية (Google، GitHub…) **بإذنه** دون معرفة كلمة مروره.\n\n**SSO (Single Sign-On)**: تسجيل الدخول مرة واحدة للوصول لتطبيقات متعددة — مثلاً تسجيل Google يمنحك دخول Gmail وYouTube وآلاف التطبيقات دفعةً واحدة.',
    ['oauth', 'oauth2', 'sso', 'single sign-on', 'google login', 'github'],
    [],
  );

  const authn = group(
    'be-auth-authn',
    'المصادقة (Authentication)',
    '**من أنت؟** — التحقق من هوية المستخدم وآليات تسجيل الدخول.',
    ['authentication', 'authn', 'مصادقة', 'login'],
    [session, jwt, oauth],
  );

  const roles = term(
    'be-auth-roles',
    'Roles و Permissions',
    '**Role**: دور يُعطى للمستخدم (`admin`, `editor`, `viewer`…).\n**Permission**: إجراء محدد مسموح به (`read:posts`, `delete:users`…).\n\n**RBAC** (Role-Based Access Control): ربط الصلاحيات بالأدوار لا بالأفراد — تُعطي المستخدم دوراً ويرث صلاحياته تلقائياً، مما يبسّط الإدارة ويقلّل الأخطاء.',
    ['rbac', 'role', 'permission', 'access control'],
    [{ title: 'نموذج RBAC', lang: 'text', code: 'admin  → read + write + delete\neditor → read + write\nviewer → read فقط\n\nأحمد (editor) → read + write ✅ | delete ❌' }],
  );

  const authz = group(
    'be-auth-authz',
    'التحقق من الصلاحيات (Authorization)',
    '**ماذا يحق لك؟** — بعد التحقق من الهوية، يُقرَّر ما يمكن للمستخدم فعله.',
    ['authorization', 'authz', 'صلاحيات', 'rbac'],
    [roles],
  );

  auth.def = 'مفهومان مختلفان: التحقق من هوية المستخدم، ثم تحديد ما يُسمح له به.';
  auth.kind = 'group';
  auth.examples = [];
  auth.children = [authn, authz];
}

// ============================================================
// P3.2  UI-UX › Accessibility — فصل المفهوم عن قواعد WCAG (§5.11)
// ============================================================
/**
 * يحوّل ux-a11y من term يخلط تعريف Accessibility مع 5 قواعد WCAG
 * إلى group بعقدتين: ux-a11y-concept و ux-a11y-wcag.
 * الدالة idempotent: إن وجدت children بالفعل لا تفعل شيئاً.
 */
function splitUxA11y(uiuxNode) {
  const a11y = findNode(uiuxNode.children ?? [], 'ux-a11y');
  if (!a11y || (a11y.children?.length ?? 0) > 0) return; // idempotent

  const concept = term(
    'ux-a11y-concept',
    'ما هي إتاحة الوصول؟',
    'كل ما يجعل الموقع قابلاً للاستخدام من ذوي الإعاقات (بصرية، حركية، معرفية…).\n\n**Screen Readers**: برامج تقرأ المحتوى بصوت عالٍ لفاقدي البصر أو ضعافه — تعتمد على الوسوم الدلالية (`<strong>`، `<em>`، `alt`) لفهم المعنى وتشديد النطق.',
    ['accessibility', 'a11y', 'screen reader', 'إتاحة', 'wcag'],
    [],
  );

  const rules = term(
    'ux-a11y-wcag',
    'القواعد العملية (WCAG AA)',
    '**WCAG** — Web Content Accessibility Guidelines — المعيار الدولي. الحد الأدنى المطلوب (مستوى AA):\n\n1. **تباين الألوان** لا يقل عن **4.5:1** للنص العادي (3:1 للنص الكبير أو الـ UI)\n2. **لوحة المفاتيح** — كل وظيفة قابلة للوصول بلا ماوس\n3. **مساحة اللمس** — لا تقل عن **44 × 44 px** لكل هدف تفاعلي\n4. **نص بديل** — `alt` واضح لكل صورة ذات معنى، فارغ للزخرفية\n5. **لا لوحيدة اللون** — لا تعتمد على اللون وحده لنقل معلومة — أضف أيقونة أو نصاً',
    ['wcag', 'contrast', 'keyboard', 'alt', 'aria', 'touch target', '44px'],
    [],
  );

  a11y.def = 'جعل الموقع مفتوحاً للجميع — المفهوم والمعايير العملية التي يقيسها WCAG.';
  a11y.kind = 'group';
  a11y.examples = [];
  a11y.children = [concept, rules];
}

// ============================================================
// P3.3  Backend › REST API — فصل التعريف العملي عن المعايير الستة (§5.12)
// ============================================================
/**
 * يُضيف be-api-rest-concept و be-api-rest-restful كأول أبناء لـ be-api-rest،
 * ويُبقي الأبناء الموجودين (verbs, versioning, endpoint) كما هم.
 * الدالة idempotent: تتحقق من وجود be-api-rest-concept.
 */
function splitBeApiRest(backendNode) {
  const api = findNode(backendNode.children ?? [], 'be-api');
  if (!api) return;
  const rest = findNode(api.children ?? [], 'be-api-rest');
  if (!rest) return;
  // idempotent: be-api-rest له أبناء أصلاً — نتحقق من concept تحديداً
  if ((rest.children ?? []).find((c) => c.id === 'be-api-rest-concept')) return;

  const concept = term(
    'be-api-rest-concept',
    'ما هو REST API؟',
    'عنوان URL يُستخدم للربط بين تطبيق والسيرفر — يُرسِل ويستقبل البيانات عبر HTTP methods ويُستخدم عادةً مع `fetch`.\n\n**Pagination مع الداتا الكبيرة**: أضف `limit` و `offset` لتجنّب جلب آلاف السجلات دفعةً واحدة.',
    ['rest', 'rest api', 'fetch', 'limit', 'offset', 'pagination'],
    [{ title: 'Pagination بـ limit/offset', lang: 'js', code: "const res = await fetch('/api/posts?limit=20&offset=40');\n// الصفحة الثالثة: 20 مقالاً بدءاً من السجل رقم 40" }],
  );

  const restful = term(
    'be-api-rest-restful',
    'RESTful API — المعايير الستة',
    'الـ **RESTful API** هي REST API تلتزم بستة مبادئ معمارية:\n\n1. **Uniform Interface** — واجهة موحّدة: URLs ثابتة + HTTP verbs\n2. **Client-Server** — الفرونت والباك مستقلان تماماً، لكل منهما مسؤوليته\n3. **Stateless** — كل طلب يحمل معلوماته كاملةً، السيرفر لا يتذكر طلباً سابقاً\n4. **Cacheable** — الردود تُصرّح بصلاحيتها للتخزين المؤقت\n5. **Layered System** — يمكن وضع Load Balancer أو CDN وسطاً بشفافية تامة\n6. **Code on Demand** (اختياري) — يمكن إرسال كود قابل للتنفيذ كـ JavaScript',
    ['restful', 'stateless', 'uniform interface', 'cacheable', 'layered', 'معايير'],
    [],
  );

  const existingChildren = rest.children ?? [];
  rest.def = 'نمط معماري لبناء API عبر HTTP — من الاستخدام العملي إلى المعايير الستة.';
  rest.kind = 'group';
  rest.examples = [];
  // concept + restful أولاً، ثم الأبناء الموجودين (verbs, versioning, endpoint)
  rest.children = [concept, restful, ...existingChildren];
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
  const backend  = next.categories.find((c) => c?.id === 'backend');
  const devops   = next.categories.find((c) => c?.id === 'devops');
  const uiux     = next.categories.find((c) => c?.id === 'ui-ux');

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

  // P2 — §5.6–5.9: HTTP Status Codes + SEO Pipeline + PWA + Docker
  if (backend && Array.isArray(backend.children)) splitBeHttp(backend);
  if (uiux    && Array.isArray(uiux.children))    splitUxSeo(uiux);
  if (uiux    && Array.isArray(uiux.children))    splitUxPwa(uiux);
  if (devops  && Array.isArray(devops.children))  splitDoDocker(devops);

  // P3 — §5.10–5.12: Auth expansion + A11y split + REST split
  if (backend && Array.isArray(backend.children)) {
    expandBeAuth(backend);
    splitBeApiRest(backend);
  }
  if (uiux && Array.isArray(uiux.children)) splitUxA11y(uiux);

  applyIdMapToRefs(next, ID_MAP_V4_V5);
  next.version = 5;
  return next;
}

// ============================================================
// v5 → v6  —  حقن محتوى React (اليوم الثامن) في بيانات موجودة
// ============================================================
/**
 * السبب: migrateV4ToV5 تبني React فقط عند وجود عقدة `fe-vue` القديمة،
 * وهي غير موجودة في بيانات وصلت v5 بالفعل — فالمحتوى لم يكن يصل للمستخدم.
 * هذه الدالة تعالج ذلك بحقن fe-fw-react مباشرةً في fe-fw الموجودة.
 *
 * idempotent: إن كانت العقدة تحوي أبناءً بالفعل لا تفعل شيئاً (REQ-4.4).
 * لا فقد: لا تحذف أي عقدة — تستبدل الـ placeholder الفارغ فقط.
 */
function ensureReactSection(frontend) {
  const fw = findNode(frontend.children ?? [], 'fe-fw');
  if (!fw || !Array.isArray(fw.children)) return;

  const existing = fw.children.find((c) => c?.id === 'fe-fw-react');
  const built = buildReactSection();

  // العقدة موجودة لكنها placeholder فارغ → املأها مع الحفاظ على مكانها
  if (existing) {
    if ((existing.children?.length ?? 0) > 0) return; // محتوى فعلي — لا تلمسه
    existing.title    = built.title;
    existing.def      = built.def;
    existing.kind     = 'group';
    existing.tags     = built.tags;
    existing.examples = [];
    existing.children = built.children;
    return;
  }

  // غير موجودة أصلاً → أضفها بعد Vue مباشرةً (أو في النهاية)
  const vueIdx = fw.children.findIndex((c) => c?.id === 'fe-fw-vue');
  if (vueIdx === -1) fw.children.push(built);
  else fw.children.splice(vueIdx + 1, 0, built);
}

/**
 * ترحيل v5 → v6. يُطبَّق على أي بيانات وصلت v5، بما فيها بيانات
 * المستخدم الحالية على الموقع المنشور.
 */
export function migrateV5ToV6(data) {
  if (!data || !Array.isArray(data.categories)) return data;
  if ((data.version ?? 0) >= 6) return data; // idempotent
  if ((data.version ?? 0) < 5) return data;  // v4 يجب أن تمرّ بـ v4→v5 أولاً

  const next = deepClone(data);
  const frontend = next.categories.find((c) => c?.id === 'frontend');
  if (frontend && Array.isArray(frontend.children)) ensureReactSection(frontend);

  next.version = 6;
  return next;
}

/**
 * نقطة الدخول الموحَّدة — تُشغّل سلسلة الترحيلات بالترتيب حتى أحدث نسخة.
 * استخدمها بدل استدعاء كل ترحيل على حدة، حتى لا يُنسى أي منها مستقبلاً.
 */
export function migrateToLatest(data) {
  return migrateV5ToV6(migrateV4ToV5(data));
}
