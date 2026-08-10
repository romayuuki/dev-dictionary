import { Injectable, inject } from '@angular/core';
import { DictData, DictNode, uid } from '../models/dict.model';
import { DictionaryStore } from './dictionary.store';

const MAMMOTH_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';

interface ParsedNode extends DictNode {
  level?: number;
}

/**
 * ناتج تحليل ملف واحد — بلا أي تعديل فعلي على القاموس (SPEC-003 §3.4).
 * التطبيق الفعلي (الدمج أو الاستبدال) يحدث لاحقاً بعد موافقة المستخدم على المعاينة.
 */
export type ImportResult =
  | { kind: 'nodes'; fileName: string; nodes: DictNode[] }
  | { kind: 'restore'; fileName: string; data: DictData }
  | { kind: 'empty'; fileName: string };

/** الاستيراد من JSON / Markdown / Word، والتصدير إلى JSON */
@Injectable({ providedIn: 'root' })
export class TransferService {
  private readonly store = inject(DictionaryStore);
  private mammothLoader: Promise<void> | null = null;

  // ---------- التصدير ----------

  exportJson(): void {
    const blob = new Blob([this.store.toJson()], { type: 'application/json' });
    this.download(blob, `dictionary-backup-${new Date().toISOString().slice(0, 10)}.json`);
  }

  private download(blob: Blob, filename: string): void {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }

  // ---------- الاستيراد ----------

  /**
   * يحلّل ملفاً واحداً فقط — لا يعدّل القاموس إطلاقاً (SPEC-003 §3.4).
   * الجهة المستدعية (transfer-dialog) تجمع النتائج، تعرض معاينة دمج موحّدة،
   * ثم تطبّق فعلياً عبر store.mergeIntoCategory أو store.restoreFromJson بعد التأكيد.
   */
  async parseFile(file: File): Promise<ImportResult> {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (ext === 'json') {
      const data = JSON.parse(await file.text()) as DictData;
      return { kind: 'restore', fileName: file.name, data };
    }

    const nodes =
      ext === 'docx'
        ? await this.parseDocx(file)
        : this.parseMarkdown(await file.text());

    if (!nodes.length) return { kind: 'empty', fileName: file.name };
    return { kind: 'nodes', fileName: file.name, nodes };
  }

  /** Markdown / نص عادي → شجرة، بالاعتماد على مستويات العناوين # */
  private parseMarkdown(text: string): DictNode[] {
    const root: ParsedNode = { ...this.blank(), level: 0 };
    const stack: ParsedNode[] = [root];
    const current = () => stack[stack.length - 1];

    let inCode = false;
    let codeBuffer: string[] = [];
    let codeLang = '';

    for (const raw of String(text).split(/\r?\n/)) {
      const line = raw.replace(/\s+$/, '');

      const fence = line.match(/^```(\w*)/);
      if (fence) {
        if (inCode) {
          if (current() !== root) {
            current().examples.push({ title: 'مثال', lang: codeLang, code: codeBuffer.join('\n') });
          }
          inCode = false;
          codeBuffer = [];
        } else {
          inCode = true;
          codeLang = fence[1] ?? '';
        }
        continue;
      }

      if (inCode) {
        codeBuffer.push(raw);
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        const level = heading[1].length;
        const node: ParsedNode = { ...this.blank(), title: heading[2].trim(), level };
        while (stack.length > 1 && (current().level ?? 0) >= level) stack.pop();
        current().children.push(node);
        stack.push(node);
        continue;
      }

      if (line.trim() || (current() !== root && current().def)) {
        const n = current();
        if (n !== root) n.def = n.def ? `${n.def}\n${line}` : line;
      }
    }

    return this.strip(root.children as ParsedNode[]);
  }

  /** DOCX → شجرة عبر mammoth.js (يُحمَّل عند الحاجة فقط) */
  private async parseDocx(file: File): Promise<DictNode[]> {
    await this.loadMammoth();
    const { value: html } = await (window as any).mammoth.convertToHtml({
      arrayBuffer: await file.arrayBuffer(),
    });
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
    return this.htmlToTree(doc.body.firstElementChild!, file.name.replace(/\.docx$/i, ''));
  }

  private loadMammoth(): Promise<void> {
    if ((window as any).mammoth) return Promise.resolve();
    this.mammothLoader ??= new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = MAMMOTH_CDN;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('تعذّر تحميل مكتبة التحويل — تحقّق من الإنترنت'));
      document.head.appendChild(s);
    });
    return this.mammothLoader;
  }

  private htmlToTree(container: Element, fallbackTitle: string): DictNode[] {
    const root: ParsedNode = { ...this.blank(), level: 0 };
    const stack: ParsedNode[] = [root];
    const current = () => stack[stack.length - 1];

    const ensureNode = (): ParsedNode => {
      if (current() === root) {
        const n: ParsedNode = { ...this.blank(), title: fallbackTitle || 'مستورد', level: 1 };
        root.children.push(n);
        stack.push(n);
      }
      return current();
    };

    for (const el of Array.from(container.children)) {
      const tag = el.tagName.toLowerCase();
      const text = (el.textContent ?? '').replace(/ /g, ' ').trim();
      if (!text) continue;

      const heading = tag.match(/^h([1-6])$/);
      if (heading) {
        const level = +heading[1];
        const node: ParsedNode = { ...this.blank(), title: text, level };
        while (stack.length > 1 && (current().level ?? 0) >= level) stack.pop();
        current().children.push(node);
        stack.push(node);
        continue;
      }

      const n = ensureNode();
      if (tag === 'pre') {
        n.examples.push({ title: 'مثال', lang: '', code: el.textContent ?? '' });
      } else if (tag === 'ul' || tag === 'ol') {
        const items = Array.from(el.querySelectorAll('li'))
          .map((li) => `- ${li.textContent?.trim()}`)
          .join('\n');
        n.def = n.def ? `${n.def}\n\n${items}` : items;
      } else if (tag === 'table') {
        const rows = Array.from(el.querySelectorAll('tr'))
          .map((tr) => Array.from(tr.children).map((td) => td.textContent?.trim()).join(' | '))
          .join('\n');
        n.examples.push({ title: 'جدول', lang: '', code: rows });
      } else {
        n.def = n.def ? `${n.def}\n\n${text}` : text;
      }
    }

    return this.strip(root.children as ParsedNode[]);
  }

  private blank(): ParsedNode {
    return { id: uid(), title: '', def: '', tags: [], examples: [], children: [] };
  }

  /** يزيل حقل level المؤقت ويقلّم المسافات */
  private strip(nodes: ParsedNode[]): DictNode[] {
    return nodes.map(({ level, ...n }) => ({
      ...n,
      def: (n.def ?? '').trim(),
      children: this.strip((n.children ?? []) as ParsedNode[]),
    }));
  }
}
