import { Injectable } from '@angular/core';

const MERMAID_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js';

/**
 * يحمّل Mermaid من CDN عند وجود مخطط فعلي في الصفحة فقط (SPEC-003 REQ-5 / NFR-2) —
 * صفحة بلا مخططات لا تُحمّل هذه المكتبة إطلاقاً (AC-5.1). فشل الشبكة أو خطأ صياغة
 * يتدهوران برشاقة إلى إبقاء النص الخام ظاهراً بدل انهيار الصفحة (AC-5.2).
 */
@Injectable({ providedIn: 'root' })
export class DiagramService {
  private loader: Promise<void> | null = null;
  private seq = 0;

  private load(): Promise<void> {
    if ((window as unknown as { mermaid?: unknown }).mermaid) return Promise.resolve();
    this.loader ??= new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = MERMAID_CDN;
      s.onload = () => {
        try {
          // ألوان المخطط من متغيّرات الثيم الحالية (SPEC-003 AC-5.4) — تُقرأ مرة عند أول تحميل
          const cs = getComputedStyle(document.documentElement);
          const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
          (window as any).mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            themeVariables: {
              primaryColor: v('--bg-2', '#ffffff'),
              primaryTextColor: v('--fg', '#111111'),
              primaryBorderColor: v('--line-2', '#cccccc'),
              lineColor: v('--fg-3', '#888888'),
              textColor: v('--fg', '#111111'),
              fontFamily: 'inherit',
            },
          });
          resolve();
        } catch (e) {
          reject(e as Error);
        }
      };
      s.onerror = () => reject(new Error('تعذّر تحميل مكتبة المخططات'));
      document.head.appendChild(s);
    });
    return this.loader;
  }

  /** يرسم مخططاً واحداً بداخل عنصر <figure data-mermaid="..."> — آمن الاستدعاء المتكرر */
  async renderInto(figure: HTMLElement): Promise<void> {
    if (figure.classList.contains('rendered') || figure.classList.contains('rendering')) return;
    const src = figure.dataset['mermaid'] ?? '';
    if (!src.trim()) return;

    figure.classList.add('rendering');
    try {
      await this.load();
      const id = 'mmd-' + this.seq++ + '-' + Date.now().toString(36);
      const { svg } = await (window as any).mermaid.render(id, src);
      figure.innerHTML = svg;
      figure.classList.add('rendered');
    } catch {
      // تدهور رشيق — النص الخام (.mermaid-src) يبقى ظاهراً داخل figure كما وُلِّد أصلاً
      figure.classList.add('render-failed');
    } finally {
      figure.classList.remove('rendering');
    }
  }
}
