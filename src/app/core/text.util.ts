/**
 * أدوات نصية مشتركة: التطبيع العربي، مرادفات النطق العربي للمصطلحات الإنجليزية،
 * وتنسيق التعريفات المبسّط (**عريض** / `كود` / قوائم بـ -).
 */

export const escapeHtml = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** توحيد الألف/الياء/التاء المربوطة وإزالة التشكيل حتى لا تفشل المطابقة بسببها */
export const norm = (s: unknown): string =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[ً-ٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * كتابة عربية صوتية → المصطلح الإنجليزي المقابل.
 * على مستوى المقطع/الكلمة (لا العبارة الكاملة) ليتسامح مع اختلاف المسافات والصياغات.
 */
const RAW_FRAGMENTS: ReadonlyArray<readonly [string, string]> = [
  ['جافاسكريبت', 'javascript'], ['جافاسكربت', 'javascript'], ['جافا', 'java'],
  ['اسكريبت', 'script'], ['اسكربت', 'script'], ['سكريبت', 'script'], ['سكربت', 'script'],
  ['تايبسكريبت', 'typescript'], ['تايبسكربت', 'typescript'], ['تايب', 'type'],
  ['انجولار', 'angular'], ['انغولار', 'angular'],
  ['فيوكس', 'vuex'], ['فيو جي اس', 'vue'], ['فيو', 'vue'],
  ['رياكت جي اس', 'react'], ['رياكت', 'react'],
  ['نود جي اس', 'node'], ['نودجي اس', 'node'], ['نود', 'node'],
  ['ان بي ام', 'npm'], ['ويب باك', 'webpack'],
  ['دوكرفايل', 'dockerfile'], ['دوكر فايل', 'dockerfile'], ['دوكر', 'docker'],
  ['جيتهب', 'github'], ['جيت هب', 'github'], ['جيت', 'git'],
  ['اتش تي ام ال', 'html'], ['هتمل', 'html'],
  ['سي اس اس', 'css'], ['جيسون', 'json'], ['ايه بي اي', 'api'],
  ['قاعده بيانات', 'database'], ['داتا بيز', 'database'],
  ['اس كيو ال', 'sql'], ['سيكوال', 'sql'], ['مونجو دي بي', 'mongodb'],
  ['دوم', 'dom'], ['بوم', 'bom'], ['اجاكس', 'ajax'],
  ['اواث', 'oauth'], ['جي دبليو تي', 'jwt'],
  ['اس اس اتش', 'ssh'], ['اس اس ال', 'ssl'], ['تي ال اس', 'tls'],
  ['كلاودفلير', 'cloudflare'], ['سي اي سي دي', 'cicd'], ['سيو', 'seo'],
  ['اوب', 'oop'], ['فرونتاند', 'frontend'], ['فرونت اند', 'frontend'],
  ['باكاند', 'backend'], ['باك اند', 'backend'], ['ديف اوبس', 'devops'],
  ['يو اي', 'ui'], ['يو اكس', 'ux'],
  ['مارجن كولابس', 'margin collapse'], ['مارجن', 'margin'], ['كولابس', 'collapse'],
  ['بادينج', 'padding'], ['فليكس', 'flex'], ['جريد', 'grid'], ['بوزيشن', 'position'],
  ['هوفر', 'hover'], ['ترانزيشن', 'transition'], ['انيميشن', 'animation'],
  ['ريسبونسف', 'responsive'], ['اوفرفلو', 'overflow'], ['بوردر', 'border'],
  ['شادو', 'shadow'], ['سيلكتور', 'selector'], ['كلاس', 'class'],
  ['بروبس', 'props'], ['ستيت', 'state'], ['هوك', 'hook'], ['ايفنت', 'event'],
  ['لووب', 'loop'], ['اراي', 'array'], ['اوبجكت', 'object'], ['فنكشن', 'function'],
  ['كولباك', 'callback'], ['بروميس', 'promise'], ['اسينك', 'async'], ['اويت', 'await'],
  ['كلوجر', 'closure'], ['بروتوتايب', 'prototype'], ['بريك بوينت', 'breakpoint'],
  ['فيرتشوال دوم', 'virtual dom'], ['فيرتشوال', 'virtual'],
  ['كومبوننت', 'component'], ['كومبونينت', 'component'],
  ['لايف سايكل', 'lifecycle'], ['ميدلوير', 'middleware'],
  ['روتينج', 'routing'], ['راوتر', 'router'], ['ريديوسر', 'reducer'],
  ['ستور', 'store'], ['ديسباتش', 'dispatch'], ['ريدكس', 'redux'],
  ['موك', 'mock'], ['يونت تيست', 'unit test'], ['ديبندنسي', 'dependency'],
  ['انجكشن', 'injection'], ['سيرفس', 'service'], ['دايركتيف', 'directive'],
  ['بايبلاين', 'pipeline'], ['كونتينر', 'container'], ['اوركسترايشن', 'orchestration'],
  ['كلاستر', 'cluster'], ['لود بالانسر', 'load balancer'], ['كاش', 'cache'],
  ['كاشينج', 'caching'], ['لوجينج', 'logging'], ['مونيتورينج', 'monitoring'],
  ['سكيلابيليتي', 'scalability'], ['لاتنسي', 'latency'],

  // ---- مصطلحات إضافية (مستخرجة من محتوى القاموس نفسه) ----
  ['هويستنج', 'hoisting'], ['شادوينج', 'shadowing'],
  ['كونستركتور', 'constructor'], ['انهيرتانس', 'inheritance'],
  ['اوفرلودينج', 'overloading'], ['اوفررايدنج', 'overriding'],
  ['ايتراتور', 'iterator'], ['جينيراتور', 'generator'], ['يلد', 'yield'],
  ['انترفيس', 'interface'], ['يونين', 'union'], ['جينيريكس', 'generics'],
  ['اند بوينت', 'endpoint'], ['اندبوينت', 'endpoint'],
  ['فيربس', 'verbs'], ['كرود', 'crud'],
  ['ديباجينج', 'debugging'], ['ديباج', 'debug'], ['تيستينج', 'testing'],
  ['كوكيز', 'cookies'], ['كوكي', 'cookie'],
  ['ريجولار اكسبريشن', 'regular expression'], ['ريجكس', 'regex'],
  ['سلوتس', 'slots'], ['سلوت', 'slot'],
  ['جارد', 'guard'], ['نافيجيشن', 'navigation'],
  ['ميوتيشن', 'mutation'], ['جيترز', 'getters'], ['جيتر', 'getter'],
  ['فيرجننج', 'versioning'],
  ['فايتالز', 'vitals'], ['بروجريسف', 'progressive'],
  ['انترناشيوناليزيشن', 'internationalization'],
  ['بابلينج', 'bubbling'], ['كابتشرينج', 'capturing'],
  ['كوردينتس', 'coordinates'], ['تارجت', 'target'],
  ['سبريد', 'spread'], ['ثرو', 'throw'],
  ['فاكتوري', 'factory'], ['استاتيك', 'static'],
  ['اكستندز', 'extends'], ['سوبر', 'super'],
  ['ويندو', 'window'], ['هيستوري', 'history'], ['لوكيشن', 'location'],
  ['دوكيومنت', 'document'], ['رول', 'role'],
  ['اسينكرونس', 'asynchronous'], ['سينكرونس', 'synchronous'],
  ['بروفايدر', 'provider'], ['انجكت', 'inject'], ['بروفايد', 'provide'],
  ['اميت', 'emit'], ['بروبرتي', 'property'], ['ميثود', 'method'],
  ['باراميتر', 'parameter'], ['ارجيومنت', 'argument'],
  ['ريكيرشن', 'recursion'], ['ريكيرسف', 'recursive'],
  ['ديستركتشرينج', 'destructuring'], ['سبريد اوبريتور', 'spread operator'],
  ['تمبليت', 'template'], ['ستايلشيت', 'stylesheet'],
  ['فاليديشن', 'validation'], ['فورم', 'form'], ['انبوت', 'input'],
  ['اوثنتيكيشن', 'authentication'], ['اوثورايزيشن', 'authorization'],
  ['توكن', 'token'], ['سيشن', 'session'], ['كوكي', 'cookie'],
  ['انكريبشن', 'encryption'], ['هاشينج', 'hashing'],
  ['ديبلويمنت', 'deployment'], ['بيلد', 'build'], ['رنتايم', 'runtime'],
  ['كومباتيبيليتي', 'compatibility'], ['بروتوكول', 'protocol'],
  ['سيرفر', 'server'], ['كلاينت', 'client'], ['هوست', 'host'],
  ['دومين', 'domain'], ['بروكسي', 'proxy'], ['فايروول', 'firewall'],
];

const FRAGMENTS = RAW_FRAGMENTS.map(([ar, en]) => [norm(ar), en] as const).sort(
  (a, b) => b[0].length - a[0].length,
);
const SINGLE_WORD = FRAGMENTS.filter(([ar]) => !ar.includes(' '));

/** مسافة ليفنشتاين — لالتقاط الأخطاء الإملائية/النطقية القريبة */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[n];
}

/** يحوّل النطق العربي إلى مصطلحات إنجليزية قبل البحث */
export function expandSynonyms(normalizedQuery: string): string {
  let out = ` ${normalizedQuery} `;

  // 1) استبدال العبارات/الكلمات المطابقة تماماً (الأطول أولاً)
  for (const [ar, en] of FRAGMENTS) {
    if (out.includes(ar)) out = out.split(ar).join(` ${en} `);
  }
  out = out.replace(/\s+/g, ' ').trim();

  // 2) كتابة غير مكتملة أو تقارب في النطق
  out = out
    .split(' ')
    .map((word) => {
      if (!word || word.length < 2 || /[a-z0-9]/.test(word)) return word;

      // أ) الكلمة بداية مقطع أطول معروف
      let prefixMatch: readonly [string, string] | null = null;
      for (const frag of SINGLE_WORD) {
        if (frag[0].length > word.length && frag[0].startsWith(word)) {
          if (!prefixMatch || frag[0].length < prefixMatch[0].length) prefixMatch = frag;
        }
      }
      if (prefixMatch) return prefixMatch[1];

      // ب) أقرب مقطع بمسافة تحرير صغيرة نسبةً لطول الكلمة
      let bestDist = Infinity;
      let bestEn: string | null = null;
      for (const [ar, en] of SINGLE_WORD) {
        if (Math.abs(ar.length - word.length) > 2) continue;
        const d = levenshtein(word, ar);
        const allowed = word.length <= 3 ? 1 : word.length <= 5 ? 2 : 3;
        if (d <= allowed && d < bestDist) {
          bestDist = d;
          bestEn = en;
        }
      }
      return bestEn ?? word;
    })
    .join(' ');

  // 3) دمج التركيبات الشائعة بعد الاستبدال
  return out
    .replace(/\bjava\s+script\b/g, 'javascript')
    .replace(/\btype\s+script\b/g, 'typescript')
    .replace(/\bvue\s+js\b/g, 'vue')
    .replace(/\breact\s+js\b/g, 'react')
    .replace(/\bnode\s+js\b/g, 'node');
}

/** يلوّن موضع المطابقة داخل النص */
export function highlight(text: string, query: string): string {
  const t = String(text ?? '');
  if (!query) return escapeHtml(t);

  const nt = norm(t);
  const nq = norm(query);
  const i = nt.indexOf(nq);

  // التطبيع قد يغيّر الأطوال، فنقع على المطابقة الحرفية عندها
  if (i < 0 || nt.length !== t.length) {
    const j = t.toLowerCase().indexOf(query.toLowerCase());
    if (j < 0) return escapeHtml(t);
    return (
      escapeHtml(t.slice(0, j)) +
      '<mark>' + escapeHtml(t.slice(j, j + query.length)) + '</mark>' +
      escapeHtml(t.slice(j + query.length))
    );
  }
  return (
    escapeHtml(t.slice(0, i)) +
    '<mark>' + escapeHtml(t.slice(i, i + nq.length)) + '</mark>' +
    escapeHtml(t.slice(i + nq.length))
  );
}

const inlineFormat = (s: string): string =>
  escapeHtml(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

/** تنسيق مبسّط للتعريف إلى HTML آمن */
export function formatDefinition(text: string): string {
  if (!text) return '';
  const isBullet = (l: string) => /^\s*[-*•]\s+/.test(l);
  const stripBullet = (l: string) => l.replace(/^\s*[-*•]\s+/, '');

  return String(text)
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n');

      if (lines.every((l) => isBullet(l) || !l.trim())) {
        const items = lines
          .filter((l) => l.trim())
          .map((l) => `<li>${inlineFormat(stripBullet(l))}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }

      if (lines.some(isBullet)) {
        let out = '';
        let buf: string[] = [];
        const flush = () => {
          if (buf.length) {
            out += `<ul>${buf.join('')}</ul>`;
            buf = [];
          }
        };
        for (const l of lines) {
          if (isBullet(l)) buf.push(`<li>${inlineFormat(stripBullet(l))}</li>`);
          else {
            flush();
            if (l.trim()) out += `<p>${inlineFormat(l)}</p>`;
          }
        }
        flush();
        return out;
      }

      return `<p>${inlineFormat(block).replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
}
