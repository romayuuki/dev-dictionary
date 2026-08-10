/**
 * SPEC-003 NFR-5 — تنقية HTML بقائمة سماح مغلقة، تُستخدم عند اللصق داخل المحرر المرئي
 * (rich-editor.component.ts). أي وسم غير مسموح به يُفكّ (تبقى محتوياته، يُحذف هو فقط)؛
 * أي وسم خطر (script/style/iframe…) يُحذف بكامل محتواه. لا innerHTML من مصدر خارجي
 * يصل الصفحة دون المرور من هنا أولاً.
 */

const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'CODE', 'PRE',
  'UL', 'OL', 'LI',
  'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
  'SPAN', 'A', 'DIV', 'FIGURE',
]);

const ALLOWED_ATTRS = new Set([
  'class', 'style', 'href', 'data-lang', 'data-ref-id', 'data-mermaid', 'data-copy-code', 'contenteditable',
]);

/** وسوم تُحذف بكامل محتواها — لا تفكيك، لأن محتواها بحد ذاته خطر (كود قابل للتنفيذ) */
const STRIP_ENTIRELY = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'SVG', 'IMG']);

/** style مسموح جزئياً فقط: لون وحجم خط، لمنع أي CSS تعسّفي (position/behavior/إلخ) */
function sanitizeStyle(style: string): string {
  const out: string[] = [];
  const colorMatch = style.match(/color\s*:\s*(#[0-9a-fA-F]{3,8})/);
  if (colorMatch) out.push('color:' + colorMatch[1]);
  const sizeMatch = style.match(/font-size\s*:\s*([\d.]+px)/);
  if (sizeMatch) out.push('font-size:' + sizeMatch[1]);
  return out.join(';');
}

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const walk = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;

        if (STRIP_ENTIRELY.has(el.tagName)) {
          el.remove();
          continue;
        }

        // نقّي الفروع الداخلية أولاً بينما العنصر لا يزال متصلاً بالشجرة
        walk(el);

        if (!ALLOWED_TAGS.has(el.tagName)) {
          // فكّ الوسم: أبقِ أبناءه في مكانه، احذفه هو فقط
          while (el.firstChild) node.insertBefore(el.firstChild, el);
          el.remove();
          continue;
        }

        for (const attr of Array.from(el.attributes)) {
          if (!ALLOWED_ATTRS.has(attr.name)) {
            el.removeAttribute(attr.name);
            continue;
          }
          if (attr.name === 'style') {
            const cleaned = sanitizeStyle(attr.value);
            if (cleaned) el.setAttribute('style', cleaned);
            else el.removeAttribute('style');
          }
        }

        if (el.tagName === 'A') {
          const href = el.getAttribute('href') ?? '';
          if (!/^https:\/\//i.test(href)) el.removeAttribute('href');
        }
      } else if (child.nodeType !== Node.TEXT_NODE) {
        node.removeChild(child); // تعليقات وغيرها
      }
    }
  };

  walk(doc.body);
  return doc.body.innerHTML;
}
