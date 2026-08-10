/**
 * أدوات نصية مشتركة: التطبيع العربي، مرادفات النطق العربي للمصطلحات الإنجليزية،
 * وتنسيق التعريفات المبسّط (**عريض** / `كود` / قوائم بـ -).
 */

import { parseCanvasModel, renderCanvasSvg } from './canvas-block.util';

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

/** يستبدل روابط `[[id|نص]]` بنصها الظاهر فقط — لعرض نظيف في المقتطفات ونحوها */
export const stripRefLinks = (s: string): string =>
  String(s ?? '').replace(/\[\[[a-zA-Z0-9_-]+\|([^\]]+)\]\]/g, '$1');

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

/** أحجام النص المسموحة لتنسيق نص محدَّد — مجموعة ثابتة تحافظ على إيقاع التصميم بدل px حرّة */
export const TEXT_SIZE_TOKENS: Record<string, string> = {
  sm: '12.5px',
  lg: '19px',
  xl: '24px',
};

/** الأسهم المدعومة في المحرر (SPEC-003 REQ-4) — تُلفّ بـ span.arrow لضبط الحجم والاتجاه بمعزل عن النص العربي المحيط */
export const ARROW_CHARS: readonly string[] = ['⟶', '⇒', '⤳', '↳', '⟷'];
const ARROW_RE = new RegExp('[' + ARROW_CHARS.join('') + ']', 'g');

/**
 * روابط داخلية بين المصطلحات: `[[node-id|النص الظاهر]]` تتحول لرابط قابل للنقر
 * يأخذ المستخدم لشرح تلك النقطة مباشرة (عبر حدث نقر يُعالج في dict-node.component).
 *
 * تنسيق نص محدَّد (لون/حجم): `{color:#RRGGBB}نص{/color}` و `{size:sm|lg|xl}نص{/size}`.
 * القيم تُدقَّق بصرامة (hex 3/6/8 خانات، أو أحد رموز الحجم الثابتة) قبل التحويل لـ style —
 * أي قيمة لا تُطابق تبقى نصاً عادياً بلا تنسيق، فلا خطر من إدخال CSS تعسّفي.
 */
function inlineFormat(s: string): string {
  return escapeHtml(s)
    .replace(
      /\[\[([a-zA-Z0-9_-]+)\|([^\]]+)\]\]/g,
      '<a href="#" class="ref-link" data-ref-id="$1">$2</a>',
    )
    .replace(/\{color:(#[0-9a-fA-F]{3,8})\}([\s\S]*?)\{\/color\}/g, '<span style="color:$1">$2</span>')
    .replace(/\{size:(sm|lg|xl)\}([\s\S]*?)\{\/size\}/g, (_m, key: string, inner: string) =>
      '<span style="font-size:' + TEXT_SIZE_TOKENS[key] + '">' + inner + '</span>',
    )
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(ARROW_RE, '<span class="arrow">$&</span>');
}

/** كتلة كود بلغة معلَّمة — رأس فيه اسم اللغة وزر نسخ، وجسم بخط أحادي المسافة (SPEC-003 REQ-3) */
function renderCodeBlock(lang: string, rawCode: string): string {
  const code = rawCode.replace(/\n$/, '');
  const label = (lang || 'text').trim();
  if (label === 'mermaid') {
    // مخطط Mermaid — النص الخام يبقى في data-mermaid ليقرأه diagram.service عند التحميل الكسول (SPEC-003 REQ-5)
    return '<figure class="mermaid-figure" data-mermaid="' + escapeHtml(code) + '">' +
      '<pre class="mermaid-src">' + escapeHtml(code) + '</pre></figure>';
  }
  if (label === 'canvas') {
    // لوحة رسم تفاعلية (أشكال + أسهم + ألوان، على طراز Obsidian) — رسم SVG فوري بلا مكتبة خارجية
    const model = parseCanvasModel(code);
    const svg = model ? renderCanvasSvg(model) : '<p style="color:var(--danger)">تعذّر قراءة لوحة الرسم</p>';
    return '<figure class="canvas-figure" data-canvas="' + escapeHtml(code) + '">' + svg + '</figure>';
  }
  return '<div class="code-block" data-lang="' + escapeHtml(label) + '">' +
    '<div class="code-block-h"><span>' + escapeHtml(label) + '</span>' +
    '<button type="button" class="code-copy" data-copy-code="' + escapeHtml(code) + '">نسخ</button></div>' +
    '<pre><code>' + escapeHtml(code) + '</code></pre></div>';
}

/** رمز نائب داخلي لا يتعارض مع محتوى حقيقي — يحمي كتل الكود من تقسيم الفقرات والتنسيق الداخلي */
function codeToken(i: number): string {
  return 'CODEBLOCKTOKEN' + i;
}
const CODE_TOKEN_RE = /^CODEBLOCKTOKEN(\d+)$/;

/** تنسيق مبسّط للتعريف إلى HTML آمن — يدعم عريض/كود مضمّن، قوائم نقطية ومرقّمة، كتل كود، وأسهماً */
export function formatDefinition(text: string): string {
  if (!text) return '';

  // 1) استخراج كتل الكود أولاً (قد تحوي أسطراً فارغة تتعارض مع تقسيم الفقرات لاحقاً)
  const codeBlocks: string[] = [];
  const withTokens = String(text).replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, lang: string, code: string) => {
    const idx = codeBlocks.length;
    codeBlocks.push(renderCodeBlock(lang, code));
    return '\n\n' + codeToken(idx) + '\n\n';
  });

  const isBullet = (l: string) => /^\s*[-*•]\s+/.test(l);
  const isNumbered = (l: string) => /^\s*\d+[.)]\s+/.test(l);
  const stripBullet = (l: string) => l.replace(/^\s*[-*•]\s+/, '');
  const stripNumbered = (l: string) => l.replace(/^\s*\d+[.)]\s+/, '');

  const blocks = withTokens.split(/\n{2,}/).map((block) => {
    const trimmedBlock = block.trim();
    const tokenMatch = trimmedBlock.match(CODE_TOKEN_RE);
    if (tokenMatch) return codeBlocks[+tokenMatch[1]] ?? '';

    const lines = block.split('\n');

    // فقرة كلها نقاط، أو كلها ترقيم — قائمة واحدة نظيفة
    if (lines.every((l) => isBullet(l) || !l.trim())) {
      const items = lines.filter((l) => l.trim()).map((l) => '<li>' + inlineFormat(stripBullet(l)) + '</li>').join('');
      return '<ul>' + items + '</ul>';
    }
    if (lines.every((l) => isNumbered(l) || !l.trim())) {
      const items = lines.filter((l) => l.trim()).map((l) => '<li>' + inlineFormat(stripNumbered(l)) + '</li>').join('');
      return '<ol>' + items + '</ol>';
    }

    // فقرة مختلطة (نص وقوائم متداخلة) — نبني تسلسلاً من فقرات وقوائم حسب كل سطر
    if (lines.some((l) => isBullet(l) || isNumbered(l))) {
      let out = '';
      let buf: string[] = [];
      let bufTag: 'ul' | 'ol' | null = null;
      const flush = () => {
        if (buf.length && bufTag) out += '<' + bufTag + '>' + buf.join('') + '</' + bufTag + '>';
        buf = [];
        bufTag = null;
      };
      for (const l of lines) {
        if (isBullet(l)) {
          if (bufTag !== 'ul') flush();
          bufTag = 'ul';
          buf.push('<li>' + inlineFormat(stripBullet(l)) + '</li>');
        } else if (isNumbered(l)) {
          if (bufTag !== 'ol') flush();
          bufTag = 'ol';
          buf.push('<li>' + inlineFormat(stripNumbered(l)) + '</li>');
        } else {
          flush();
          if (l.trim()) out += '<p>' + inlineFormat(l) + '</p>';
        }
      }
      flush();
      return out;
    }

    return '<p>' + inlineFormat(block).replace(/\n/g, '<br>') + '</p>';
  });

  return blocks.join('');
}

/** يعكس أحجام النص الثابتة: من px مضبوط إلى مفتاحه (sm/lg/xl) — عكس TEXT_SIZE_TOKENS */
function sizeKeyFromPx(px: string): string | null {
  for (const [key, val] of Object.entries(TEXT_SIZE_TOKENS)) {
    if (val === px) return key;
  }
  return null;
}

/**
 * يحوّل DOM محرر WYSIWYG (rich-editor) إلى نصّ مُعلَّم قابل للتخزين والبحث —
 * عكس formatDefinition بالضبط، على نفس مفردات الوسوم التي نُولِّدها نحن فقط
 * (توليد مضبوط + تنقية عند اللصق SPEC-003 NFR-5)، فلا حاجة لتغطية HTML عشوائي.
 */
export function htmlToMarkup(root: HTMLElement): string {
  const inline = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    const tag = el.tagName;
    const childText = () => Array.from(el.childNodes).map(inline).join('');

    if (tag === 'BR') return '\n';
    if (tag === 'STRONG' || tag === 'B') return '**' + childText() + '**';
    if (tag === 'EM' || tag === 'I') return '*' + childText() + '*';
    if (tag === 'CODE') return '`' + childText() + '`';
    if (tag === 'A' && el.classList.contains('ref-link')) {
      const id = el.getAttribute('data-ref-id') ?? '';
      return '[[' + id + '|' + childText() + ']]';
    }
    if (tag === 'SPAN' && el.classList.contains('arrow')) return childText();
    if (tag === 'SPAN') {
      const style = el.getAttribute('style') ?? '';
      const colorMatch = style.match(/color:\s*(#[0-9a-fA-F]{3,8})/);
      if (colorMatch) return '{color:' + colorMatch[1] + '}' + childText() + '{/color}';
      const sizeMatch = style.match(/font-size:\s*([\d.]+px)/);
      if (sizeMatch) {
        const key = sizeKeyFromPx(sizeMatch[1]);
        if (key) return '{size:' + key + '}' + childText() + '{/size}';
      }
      return childText();
    }
    return childText();
  };

  const childrenInline = (el: HTMLElement): string => Array.from(el.childNodes).map(inline).join('');

  const block = (el: HTMLElement): string => {
    const tag = el.tagName;

    if (tag === 'DIV' && el.classList.contains('code-block')) {
      const lang = el.querySelector('.lang-tag')?.textContent?.trim() || el.getAttribute('data-lang') || '';
      const code = el.querySelector('code')?.textContent ?? '';
      return '```' + lang + '\n' + code.replace(/\n$/, '') + '\n```';
    }
    if (tag === 'FIGURE' && el.classList.contains('mermaid-figure')) {
      const code = el.querySelector('.mermaid-src')?.textContent ?? '';
      return '```mermaid\n' + code.replace(/\n$/, '') + '\n```';
    }
    if (tag === 'FIGURE' && el.classList.contains('canvas-figure')) {
      const json = el.getAttribute('data-canvas') ?? '';
      return '```canvas\n' + json + '\n```';
    }
    if (tag === 'UL') {
      return Array.from(el.children)
        .map((li) => '- ' + inline(li).trim())
        .join('\n');
    }
    if (tag === 'OL') {
      return Array.from(el.children)
        .map((li, i) => (i + 1) + '. ' + inline(li).trim())
        .join('\n');
    }
    if (tag === 'P' || tag === 'DIV') return childrenInline(el);

    return inline(el);
  };

  const topLevel = Array.from(root.children) as HTMLElement[];
  if (!topLevel.length) {
    return childrenInline(root).replace(/\n{3,}/g, '\n\n').trim();
  }

  const parts = topLevel.map((el) => block(el)).filter((t) => t.trim());
  return parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}
