import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DictionaryStore } from '../core/dictionary.store';
import { sanitizeHtml } from '../core/sanitize.util';
import { ARROW_CHARS, TEXT_SIZE_TOKENS, escapeHtml, formatDefinition, htmlToMarkup } from '../core/text.util';

/**
 * محرر مرئي (WYSIWYG) لحقل التعريف — SPEC-003 REQ-4 / مبدأ P3 في STORY-003:
 * التنسيق يظهر فوراً في مكانه (لون فعلي، سهم حقيقي، كتلة كود منسَّقة)، بلا أي
 * رمز نصّي ظاهر أثناء الكتابة مثل {color:#..} أو ```lang```.
 *
 * المصدر الوحيد أثناء التحرير هو DOM نفسه (contenteditable) — لا رندر متكرر
 * من نص إلى HTML أثناء الكتابة، تجنّباً لقفز المؤشر. الهيدرات (نص → HTML) تحدث
 * مرة واحدة فقط عند فتح المحرر (تغيّر resetKey)، والتسلسل العكسي (HTML → نص)
 * يحدث عند الطلب فقط عبر getMarkup() — نمط "غير متحكَّم فيه" بعد أول هيدرات.
 */
@Component({
  selector: 'app-rich-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fmt-toolbar">
      <span class="fmt-group" title="تنسيق النص">
        <button type="button" class="btn sm ghost" (mousedown)="keepFocus($event)" (click)="wrapTag('strong')">B</button>
        <button type="button" class="btn sm ghost" (mousedown)="keepFocus($event)" (click)="wrapTag('em')" style="font-style:italic">I</button>
        <button type="button" class="btn sm ghost" (mousedown)="keepFocus($event)" (click)="wrapTag('code')" title="كود مضمَّن">&lt;/&gt;</button>
      </span>

      <span class="fmt-sep"></span>

      <span class="fmt-group" title="لوّن النص المحدَّد">
        <label class="color-swatch" [style.background]="lastColor">
          <input type="color" [(ngModel)]="lastColor" [ngModelOptions]="{standalone:true}"
                 (mousedown)="keepFocus($event)" (change)="applyColor(lastColor)" />
        </label>
      </span>

      <span class="fmt-group" title="حجم النص المحدَّد">
        @for (s of sizeOptions; track s.key) {
          <button type="button" class="btn sm ghost" (mousedown)="keepFocus($event)" (click)="applySize(s.key)">{{ s.label }}</button>
        }
      </span>

      <span class="fmt-sep"></span>

      <span class="fmt-group" title="قوائم">
        <button type="button" class="btn sm ghost" (mousedown)="keepFocus($event)" (click)="insertList('ul')">• قائمة</button>
        <button type="button" class="btn sm ghost" (mousedown)="keepFocus($event)" (click)="insertList('ol')">1. ترقيم</button>
      </span>

      <span class="fmt-sep"></span>

      <span class="fmt-group arrow-picker">
        <button type="button" class="btn sm ghost" (mousedown)="keepFocus($event)" (click)="arrowMenuOpen.set(!arrowMenuOpen())">
          ⟶ سهم
        </button>
        @if (arrowMenuOpen()) {
          <div class="arrow-menu">
            @for (a of arrows; track a) {
              <button type="button" (mousedown)="keepFocus($event)" (click)="insertArrow(a)">{{ a }}</button>
            }
          </div>
        }
      </span>

      <button type="button" class="btn sm ghost" (mousedown)="keepFocus($event)" (click)="toggleLinkPicker()">
        🔗 إشارة إلى شرح موجود
      </button>

      <button type="button" class="btn sm ghost" (mousedown)="keepFocus($event)" (click)="insertCodeBlock()">
        🧱 كتلة كود
      </button>

      <button type="button" class="btn sm ghost" (mousedown)="keepFocus($event)" (click)="insertMermaid()">
        📊 مخطط
      </button>
    </div>

    @if (linkPickerOpen()) {
      <div class="link-picker">
        <input class="inp" [(ngModel)]="linkQuery" placeholder="ابحث عن العنصر المراد الإشارة إليه…" />
        <div class="link-results">
          @for (n of linkMatches(); track n.id) {
            <button type="button" class="link-result" (click)="insertLink(n)">{{ n.title }}</button>
          } @empty {
            <div class="link-empty">لا نتائج</div>
          }
        </div>
      </div>
    }

    <div #editorEl class="rich-editor inp" contenteditable="true" spellcheck="false"
         (paste)="onPaste($event)" (keydown)="onKeydown($event)"></div>
  `,
})
export class RichEditorComponent {
  private readonly store = inject(DictionaryStore);

  /** أي قيمة جديدة (مرجعياً) تُعيد بناء محتوى المحرر من الصفر — تُستخدم عند فتح نافذة تعديل جديدة */
  readonly resetKey = input<unknown>(null);
  readonly initialMarkup = input<string>('');
  /** عقدة تُستبعد من نتائج البحث (العقدة قيد التعديل نفسها) */
  readonly excludeId = input<string | null>(null);

  private readonly editorEl = viewChild.required<ElementRef<HTMLDivElement>>('editorEl');

  protected lastColor = '#e11d48';
  protected readonly sizeOptions: { key: keyof typeof TEXT_SIZE_TOKENS; label: string }[] = [
    { key: 'sm', label: 'A صغير' },
    { key: 'lg', label: 'A كبير' },
    { key: 'xl', label: 'A أكبر' },
  ];
  protected readonly arrows = ARROW_CHARS;
  protected readonly arrowMenuOpen = signal(false);
  protected readonly linkPickerOpen = signal(false);
  protected linkQuery = '';

  /** آخر Range فعّال داخل المحرر — يُحفَظ عند كل تغيّر تحديد حتى لا يضيع عند الضغط على أزرار شريط الأدوات */
  private savedRange: Range | null = null;

  constructor() {
    // إعادة الهيدرات فقط عند تغيّر مرجع resetKey (فتح نافذة جديدة) — لا عند كل حرف يُكتب
    effect(() => {
      this.resetKey();
      queueMicrotask(() => this.hydrate(this.initialMarkup()));
    });

    document.addEventListener('selectionchange', this.onSelectionChange);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('selectionchange', this.onSelectionChange));
  }

  private readonly onSelectionChange = (): void => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (this.isInsideEditor(range.commonAncestorContainer)) this.savedRange = range.cloneRange();
  };

  private hydrate(markup: string): void {
    const el = this.editorEl().nativeElement;
    el.innerHTML = formatDefinition(markup) || '<p><br></p>';
    this.normalizeForEditing(el);
    this.savedRange = null;
  }

  /** يحوّل كتل الكود والمخططات المعروضة (للقراءة) إلى صيغتها القابلة للتحرير المباشر */
  private normalizeForEditing(container: HTMLElement): void {
    (Array.from(container.querySelectorAll('.code-block')) as HTMLElement[]).forEach((el) => {
      const lang = el.getAttribute('data-lang') || 'text';
      const codeText = el.querySelector('code')?.textContent ?? '';
      el.contentEditable = 'false';
      el.innerHTML =
        '<div class="code-block-h"><span class="lang-tag" contenteditable="true">' + escapeHtml(lang) + '</span></div>' +
        '<pre><code contenteditable="true">' + escapeHtml(codeText) + '</code></pre>';
    });
    (Array.from(container.querySelectorAll('.mermaid-figure')) as HTMLElement[]).forEach((el) => {
      const codeText = el.querySelector('.mermaid-src')?.textContent ?? el.getAttribute('data-mermaid') ?? '';
      el.contentEditable = 'false';
      el.removeAttribute('data-mermaid');
      el.innerHTML = '<pre class="mermaid-src" contenteditable="true">' + escapeHtml(codeText) + '</pre>';
    });
  }

  /** يُقرأ من الأب (node-editor) عند الحفظ — نقطة السحب الوحيدة لتحويل DOM إلى نصّ مُعلَّم */
  getMarkup(): string {
    return htmlToMarkup(this.editorEl().nativeElement);
  }

  /** يُعيد بناء محتوى المحرر بالكامل من نصّ مُعلَّم جديد — تُستخدم بعد عملية تُعدّل def خارجياً (مثل تقسيم إلى عقد) */
  setMarkup(markup: string): void {
    this.hydrate(markup);
  }

  /** يُدرج نصّاً عادياً عند موضع المؤشر — تُستخدم من نافذة الإدراج بعد OCR */
  insertPlainText(text: string): void {
    this.focusEditor();
    const range = this.currentRangeOrEnd();
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    this.applyRange(range);
  }

  // ---------- أدوات التحديد ----------

  protected keepFocus(e: MouseEvent): void {
    // يمنع فقدان تحديد النص عند الضغط على زر شريط الأدوات (mousedown يسبق blur)
    e.preventDefault();
  }

  private isInsideEditor(node: Node | null): boolean {
    const el = this.editorEl()?.nativeElement;
    return !!el && !!node && el.contains(node);
  }

  private currentRangeOrEnd(): Range {
    if (this.savedRange && this.isInsideEditor(this.savedRange.commonAncestorContainer)) {
      return this.savedRange.cloneRange();
    }
    const el = this.editorEl().nativeElement;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    return range;
  }

  private applyRange(range: Range): void {
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
    this.savedRange = range.cloneRange();
  }

  private focusEditor(): void {
    this.editorEl().nativeElement.focus();
  }

  // ---------- تنسيق مضمَّن: عريض / مائل / كود ----------

  protected wrapTag(tag: 'strong' | 'em' | 'code'): void {
    const range = this.currentRangeOrEnd();
    if (range.collapsed || !this.isInsideEditor(range.commonAncestorContainer)) {
      this.toastHint();
      return;
    }
    const el = document.createElement(tag);
    el.appendChild(range.extractContents());
    range.insertNode(el);

    const after = document.createRange();
    after.selectNodeContents(el);
    this.applyRange(after);
    this.focusEditor();
  }

  private wrapStyle(style: string): void {
    const range = this.currentRangeOrEnd();
    if (range.collapsed || !this.isInsideEditor(range.commonAncestorContainer)) {
      this.toastHint();
      return;
    }
    const span = document.createElement('span');
    span.setAttribute('style', style);
    span.appendChild(range.extractContents());
    range.insertNode(span);

    const after = document.createRange();
    after.selectNodeContents(span);
    this.applyRange(after);
    this.focusEditor();
  }

  protected applyColor(hex: string): void {
    if (!/^#[0-9a-fA-F]{3,8}$/.test(hex)) return;
    this.wrapStyle('color:' + hex);
  }

  protected applySize(key: keyof typeof TEXT_SIZE_TOKENS): void {
    this.wrapStyle('font-size:' + TEXT_SIZE_TOKENS[key]);
  }

  /** تلميح بسيط داخل نفس العنصر بدل الاعتماد على toast خارجي (المحرر مستقل بذاته) */
  private toastHint(): void {
    this.focusEditor();
  }

  // ---------- قوائم ----------

  protected insertList(kind: 'ul' | 'ol'): void {
    const range = this.currentRangeOrEnd();
    if (!this.isInsideEditor(range.commonAncestorContainer)) return;

    const text = range.toString();
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const list = document.createElement(kind);
    for (const line of lines.length ? lines : ['']) {
      const li = document.createElement('li');
      li.textContent = line;
      list.appendChild(li);
    }

    range.deleteContents();
    range.insertNode(list);

    const lastLi = list.lastElementChild;
    if (lastLi) {
      const after = document.createRange();
      after.selectNodeContents(lastLi);
      after.collapse(false);
      this.applyRange(after);
    }
    this.focusEditor();
  }

  // ---------- أسهم ----------

  protected insertArrow(char: string): void {
    this.arrowMenuOpen.set(false);
    const range = this.currentRangeOrEnd();
    const span = document.createElement('span');
    span.className = 'arrow';
    span.textContent = char;
    range.deleteContents();
    range.insertNode(span);
    range.setStartAfter(span);
    range.collapse(true);
    this.applyRange(range);
    this.focusEditor();
  }

  // ---------- كتلة كود ----------

  protected insertCodeBlock(): void {
    const range = this.currentRangeOrEnd();
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block';
    wrapper.contentEditable = 'false';
    wrapper.innerHTML =
      '<div class="code-block-h"><span class="lang-tag" contenteditable="true">js</span></div>' +
      '<pre><code contenteditable="true">// اكتب الكود هنا</code></pre>';

    range.deleteContents();
    range.insertNode(wrapper);
    const after = document.createElement('p');
    after.innerHTML = '<br>';
    wrapper.after(after);

    const codeEl = wrapper.querySelector('code');
    if (codeEl) {
      const sel = document.createRange();
      sel.selectNodeContents(codeEl);
      this.applyRange(sel);
      (codeEl as HTMLElement).focus();
    }
  }

  // ---------- مخطط Mermaid ----------

  protected insertMermaid(): void {
    const range = this.currentRangeOrEnd();
    const figure = document.createElement('figure');
    figure.className = 'mermaid-figure';
    figure.contentEditable = 'false';
    figure.innerHTML = '<pre class="mermaid-src" contenteditable="true">graph TD\n  A[البداية] --&gt; B[النهاية]</pre>';

    range.deleteContents();
    range.insertNode(figure);
    const after = document.createElement('p');
    after.innerHTML = '<br>';
    figure.after(after);

    const pre = figure.querySelector('.mermaid-src');
    if (pre) {
      const sel = document.createRange();
      sel.selectNodeContents(pre);
      this.applyRange(sel);
      (pre as HTMLElement).focus();
    }
  }

  // ---------- روابط داخلية ----------

  protected toggleLinkPicker(): void {
    this.linkQuery = '';
    this.linkPickerOpen.update((v) => !v);
  }

  protected linkMatches(): { id: string; title: string }[] {
    const q = this.linkQuery.trim().toLowerCase();
    const currentId = this.excludeId();
    const results: { id: string; title: string }[] = [];
    for (const cat of this.store.categories()) {
      this.store.walk(cat.children, (n) => {
        if (n.id === currentId) return;
        if (!q || n.title.toLowerCase().includes(q)) results.push({ id: n.id, title: n.title });
      });
    }
    return results.slice(0, 30);
  }

  protected insertLink(n: { id: string; title: string }): void {
    const range = this.currentRangeOrEnd();
    const a = document.createElement('a');
    a.className = 'ref-link';
    a.setAttribute('data-ref-id', n.id);
    a.textContent = n.title;
    range.deleteContents();
    range.insertNode(a);
    range.setStartAfter(a);
    range.collapse(true);
    this.applyRange(range);

    this.linkPickerOpen.set(false);
    this.linkQuery = '';
    this.focusEditor();
  }

  // ---------- لصق آمن ----------

  /** يمنع لصق HTML خام من Word/الويب — يُنقّى بقائمة سماح مغلقة أولاً (NFR-5) */
  protected onPaste(e: ClipboardEvent): void {
    e.preventDefault();
    const html = e.clipboardData?.getData('text/html');
    const range = this.currentRangeOrEnd();
    range.deleteContents();

    if (html) {
      const clean = sanitizeHtml(html);
      const frag = document.createRange().createContextualFragment(clean);
      range.insertNode(frag);
    } else {
      const text = e.clipboardData?.getData('text/plain') ?? '';
      range.insertNode(document.createTextNode(text));
    }
    range.collapse(false);
    this.applyRange(range);
  }

  protected onKeydown(e: KeyboardEvent): void {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key.toLowerCase() === 'b') {
      e.preventDefault();
      this.wrapTag('strong');
    } else if (e.key.toLowerCase() === 'i') {
      e.preventDefault();
      this.wrapTag('em');
    }
  }
}
