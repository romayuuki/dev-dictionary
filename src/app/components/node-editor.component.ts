import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Category, Example, NodeKind } from '../models/dict.model';
import { TEXT_SIZE_TOKENS } from '../core/text.util';
import { DictionaryStore } from '../core/dictionary.store';
import { ToastService } from '../core/toast.service';
import { CameraOcrDialogComponent } from './camera-ocr-dialog.component';

export interface EditorRequest {
  /** معرّف العقدة المراد تعديلها، أو null عند الإضافة */
  nodeId: string | null;
  /** الأب الذي ستُضاف بداخله العقدة الجديدة */
  parentId?: string;
}

@Component({
  selector: 'app-node-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, CameraOcrDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overlay open" (click)="onBackdrop($event)">
      <div class="modal wide">
        <div class="m-h">
          <h3>{{ isNew() ? 'إضافة قسم جديد' : 'تعديل «' + title() + '»' }}</h3>
          <button class="icon-btn" (click)="close.emit()">✕</button>
        </div>

        <div class="m-b">
          <div class="field">
            <label>العنوان *</label>
            <input class="inp" [(ngModel)]="titleValue" placeholder="مثال: Flexbox" />
          </div>

          @if (!isCategory()) {
            <div class="field">
              <label>
                النوع
                <span class="hint">— مجموعة تفسّر لماذا اجتمع أبناؤها، مصطلح ذرّة قابلة للبحث بمفردها</span>
              </label>
              <div style="display:flex;gap:8px">
                <button type="button" class="btn sm" [class.primary]="kindValue === 'term'"
                        (click)="kindValue = 'term'">▪ مصطلح (term)</button>
                <button type="button" class="btn sm" [class.primary]="kindValue === 'group'"
                        (click)="kindValue = 'group'">› مجموعة (group)</button>
              </div>
            </div>
          }

          @if (kindValue === 'term' && !examples().length) {
            <div class="note">💡 هذا المصطلح بلا مثال — أضِف واحداً؟ (إرشادي، لا يمنع الحفظ)</div>
          }
          @if (looksLikeMultiConcept()) {
            <div class="note">💡 يبدو أن هنا أكثر من مفهوم — هل تُقسّمها إلى عقد مستقلة؟ (إرشادي، لا يمنع الحفظ)</div>
          }

          @if (isCategory()) {
            <div style="display:flex;gap:12px">
              <div class="field" style="flex:1">
                <label>وصف مختصر</label>
                <input class="inp" [(ngModel)]="subtitleValue" />
              </div>
              <div class="field" style="width:90px">
                <label>أيقونة</label>
                <input class="inp" [(ngModel)]="iconValue" />
              </div>
              <div class="field" style="width:110px">
                <label>اللون</label>
                <input class="inp" type="color" [(ngModel)]="colorValue"
                       style="padding:4px;height:42px" />
              </div>
            </div>
          }

          <div class="field">
            <label>
              التعريف
              <span class="hint">— يدعم **عريض** و \`كود\` و - للقوائم، و 🔗 روابط لعناصر أخرى، ولون/حجم لنص محدَّد</span>
            </label>
            <div style="position:relative">
              <textarea #defTextarea class="inp" [(ngModel)]="defValue"
                        placeholder="اشرح المصطلح هنا…"
                        (select)="rememberCursor()" (click)="rememberCursor()"
                        (keyup)="rememberCursor()"></textarea>

              <div class="fmt-toolbar">
                <button type="button" class="btn sm ghost" (click)="toggleLinkPicker()">
                  🔗 إشارة إلى شرح موجود
                </button>

                <button type="button" class="btn sm ghost" (click)="cameraOpen.set(true)">
                  📷 مسح من الكاميرا (OCR)
                </button>

                <span class="fmt-sep"></span>

                <span class="fmt-group" title="لوّن النص المحدَّد">
                  <label class="color-swatch" [style.background]="lastColor">
                    <input type="color" [(ngModel)]="lastColor" [ngModelOptions]="{standalone:true}"
                           (change)="applyColor(lastColor)" />
                  </label>
                  @if (hasSelection()) {
                    <button type="button" class="btn sm ghost" (click)="clearColor()">✕ إزالة اللون</button>
                  }
                </span>

                <span class="fmt-group" title="حجم النص المحدَّد">
                  @for (s of sizeOptions; track s.key) {
                    <button type="button" class="btn sm ghost" (click)="applySize(s.key)">{{ s.label }}</button>
                  }
                </span>
              </div>

              @if (linkPickerOpen()) {
                <div class="link-picker">
                  <input class="inp" [(ngModel)]="linkQuery" placeholder="ابحث عن العنصر المراد الإشارة إليه…" />
                  <div class="link-results">
                    @for (n of linkMatches(); track n.id) {
                      <button type="button" class="link-result" (click)="insertLink(n)">
                        {{ n.title }}
                      </button>
                    } @empty {
                      <div class="link-empty">لا نتائج</div>
                    }
                  </div>
                </div>
              }
            </div>
          </div>

          <div class="field">
            <label>
              كلمات مفتاحية
              <span class="hint">— مفصولة بفاصلة، تُحسّن نتائج البحث</span>
            </label>
            <input class="inp" [(ngModel)]="tagsValue" placeholder="flexbox، تخطيط، layout" />
          </div>

          <div class="field">
            <label>الأمثلة</label>
            @for (ex of examples(); track $index) {
              <div class="ex-edit">
                <div class="ex-edit-h">
                  <input class="inp" [(ngModel)]="ex.title" placeholder="وصف المثال" />
                  <input class="inp lang" [(ngModel)]="ex.lang" placeholder="js / css / sql" />
                  <button class="btn sm danger" (click)="removeExample($index)">حذف</button>
                </div>
                <textarea class="inp code-inp" [(ngModel)]="ex.code"
                          placeholder="الكود هنا…" spellcheck="false"></textarea>
              </div>
            } @empty {
              <div style="color:var(--fg-3);font-size:12.5px;padding:6px 2px">لا أمثلة بعد.</div>
            }
            <button class="btn sm" style="margin-top:8px" (click)="addExample()">
              ＋ إضافة مثال
            </button>
          </div>
        </div>

        <div class="m-f">
          <button class="btn ghost" (click)="close.emit()">إلغاء</button>
          <button class="btn primary" (click)="save()">حفظ</button>
        </div>
      </div>
    </div>

    @if (cameraOpen()) {
      <app-camera-ocr-dialog (insert)="onOcrInsert($event)" (cancel)="cameraOpen.set(false)" />
    }
  `,
})
export class NodeEditorComponent {
  private readonly store = inject(DictionaryStore);
  private readonly toast = inject(ToastService);

  readonly request = input.required<EditorRequest>();
  readonly close = output<void>();
  readonly saved = output<string>();

  protected titleValue = '';
  protected defValue = '';
  protected tagsValue = '';
  protected subtitleValue = '';
  protected iconValue = '📁';
  protected colorValue = '#5b5bd6';
  protected readonly examples = signal<Example[]>([]);
  /** SPEC-002 REQ-6.1 — بقيمة مقترحة تلقائياً: term لعقدة جديدة، أو النوع الفعلي عند التعديل */
  protected kindValue: NodeKind = 'term';

  private readonly defTextarea = viewChild<ElementRef<HTMLTextAreaElement>>('defTextarea');
  protected readonly linkPickerOpen = signal(false);
  protected readonly cameraOpen = signal(false);
  protected linkQuery = '';
  private cursorPos = 0;
  private selEnd = 0;
  protected readonly hasSelection = signal(false);

  /** تنسيق نص محدَّد (لون/حجم) */
  protected lastColor = '#e11d48';
  protected readonly sizeOptions: { key: keyof typeof TEXT_SIZE_TOKENS; label: string }[] = [
    { key: 'sm', label: 'A صغير' },
    { key: 'lg', label: 'A كبير' },
    { key: 'xl', label: 'A أكبر' },
  ];

  private loadedFor: EditorRequest | null = null;

  constructor() {
    // نملأ الحقول عند أول عرض للطلب الحالي
    queueMicrotask(() => this.hydrate());
  }

  private hydrate(): void {
    const req = this.request();
    if (this.loadedFor === req) return;
    this.loadedFor = req;

    if (!req.nodeId) {
      this.examples.set([]);
      this.kindValue = 'term';
      return;
    }

    const loc = this.store.find(req.nodeId);
    if (!loc) return;

    const n = loc.node;
    this.titleValue = n.title;
    this.defValue = n.def;
    this.tagsValue = (n.tags ?? []).join('، ');
    this.examples.set(structuredClone(n.examples ?? []));
    this.kindValue = n.kind ?? ((n.children?.length ?? 0) > 0 ? 'group' : 'term');

    if (loc.isCategory) {
      const cat = n as Category;
      this.subtitleValue = cat.subtitle ?? '';
      this.iconValue = cat.icon ?? '📁';
      this.colorValue = cat.color ?? '#5b5bd6';
    }
  }

  protected isNew(): boolean {
    return !this.request().nodeId;
  }

  protected title(): string {
    return this.titleValue;
  }

  protected isCategory(): boolean {
    const id = this.request().nodeId;
    return !!id && !!this.store.find(id)?.isCategory;
  }

  protected addExample(): void {
    this.examples.update((list) => [...list, { title: '', lang: '', code: '' }]);
  }

  protected removeExample(index: number): void {
    this.examples.update((list) => list.filter((_, i) => i !== index));
  }

  /**
   * SPEC-001 §4.2 اختبار قابلية التقسيم (تبسيط REQ-6.3) — تنبيه إرشادي فقط، لا يمنع الحفظ.
   * يُشير إلى أن `def` يحوي ٣ بنود نقطية أو أكثر تبدأ برمز بين backticks، ما يعني على الأرجح
   * أكثر من مفهوم مدفون في عقدة واحدة (نفس نمط God Node الموصوف في storytelling).
   */
  protected looksLikeMultiConcept(): boolean {
    const bulletsWithCode = this.defValue
      .split('\n')
      .filter((l) => /^\s*[-*•]\s+`/.test(l));
    return bulletsWithCode.length >= 3;
  }

  // ---------- روابط داخلية بين المصطلحات ----------

  /** يحفظ موضع المؤشر (وحدود التحديد) داخل حقل التعريف لإدراج الرابط أو التنسيق في المكان الصحيح */
  protected rememberCursor(): void {
    const el = this.defTextarea()?.nativeElement;
    if (!el) return;
    this.cursorPos = el.selectionStart ?? this.defValue.length;
    this.selEnd = el.selectionEnd ?? this.cursorPos;
    this.hasSelection.set(this.selEnd > this.cursorPos);
  }

  // ---------- تنسيق نص محدَّد: لون وحجم ----------

  /** يلفّ النص المحدَّد حالياً بوسمَي فتح/إغلاق، أو يُدرجهما فارغين عند المؤشر إن لم يوجد تحديد */
  private wrapSelection(open: string, close: string): void {
    const el = this.defTextarea()?.nativeElement;
    const start = Math.min(this.cursorPos, this.selEnd);
    const end = Math.max(this.cursorPos, this.selEnd);
    const selected = this.defValue.slice(start, end);

    this.defValue = this.defValue.slice(0, start) + open + selected + close + this.defValue.slice(end);
    const newStart = start + open.length;
    const newEnd = newStart + selected.length;

    queueMicrotask(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(newStart, newEnd);
      this.cursorPos = newStart;
      this.selEnd = newEnd;
    });
  }

  protected applyColor(hex: string): void {
    if (!/^#[0-9a-fA-F]{3,8}$/.test(hex)) return;
    this.wrapSelection(`{color:${hex}}`, '{/color}');
  }

  protected clearColor(): void {
    // يحذف أي وسمَي color تحيط تماماً بالتحديد الحالي (تبسيط: يحذف أقرب وسم مطابق فقط)
    const start = Math.min(this.cursorPos, this.selEnd);
    const end = Math.max(this.cursorPos, this.selEnd);
    const before = this.defValue.slice(0, start);
    const openMatch = before.match(/\{color:#[0-9a-fA-F]{3,8}\}$/);
    const after = this.defValue.slice(end);
    const closeMatch = after.match(/^\{\/color\}/);
    if (openMatch && closeMatch) {
      this.defValue =
        before.slice(0, before.length - openMatch[0].length) +
        this.defValue.slice(start, end) +
        after.slice(closeMatch[0].length);
    }
  }

  protected applySize(key: keyof typeof TEXT_SIZE_TOKENS): void {
    this.wrapSelection(`{size:${key}}`, '{/size}');
  }

  protected toggleLinkPicker(): void {
    this.rememberCursor();
    this.linkQuery = '';
    this.linkPickerOpen.update((v) => !v);
  }

  /** يبحث في كل عناصر القاموس (عدا العنصر الحالي) لاختيار هدف الرابط */
  protected linkMatches(): { id: string; title: string }[] {
    const q = this.linkQuery.trim().toLowerCase();
    const currentId = this.request().nodeId;
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
    const markup = `[[${n.id}|${n.title}]]`;
    this.defValue = this.defValue.slice(0, this.cursorPos) + markup + this.defValue.slice(this.cursorPos);
    this.cursorPos += markup.length;
    this.linkPickerOpen.set(false);
    this.linkQuery = '';

    queueMicrotask(() => {
      const el = this.defTextarea()?.nativeElement;
      if (el) {
        el.focus();
        el.setSelectionRange(this.cursorPos, this.cursorPos);
      }
    });
  }

  // ---------- تصوير ورقة وتحويلها لنص (OCR) ----------

  /**
   * يُدرج النص المستخرَج (بعد مراجعة المستخدم له داخل حوار الكاميرا) في حقل التعريف
   * مكان المؤشر المحفوظ — يستبدل التحديد الحالي إن وُجد، أو يُدرَج عنده مباشرة.
   * يبقى قابلاً للتعديل الكامل فور الإدراج، ولا يُحفظ إلا بضغط «حفظ» صراحةً.
   */
  protected onOcrInsert(text: string): void {
    this.cameraOpen.set(false);
    const clean = text.trim();
    if (!clean) return;

    const start = Math.min(this.cursorPos, this.selEnd);
    const end = Math.max(this.cursorPos, this.selEnd);
    this.defValue = this.defValue.slice(0, start) + clean + this.defValue.slice(end);
    const newPos = start + clean.length;
    this.cursorPos = newPos;
    this.selEnd = newPos;

    queueMicrotask(() => {
      const el = this.defTextarea()?.nativeElement;
      if (el) {
        el.focus();
        el.setSelectionRange(newPos, newPos);
      }
    });
    this.toast.show('تم إدراج النص — راجعه وعدّل ما تحتاج');
  }

  protected onBackdrop(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('overlay')) this.close.emit();
  }

  protected save(): void {
    const title = this.titleValue.trim();
    if (!title) {
      this.toast.show('العنوان مطلوب');
      return;
    }

    const payload: Record<string, unknown> = {
      title,
      def: this.defValue,
      tags: this.tagsValue.split(/[،,]/).map((s) => s.trim()).filter(Boolean),
      examples: this.examples().filter((e) => e.code.trim() || e.title.trim()),
    };

    if (this.isCategory()) {
      payload['subtitle'] = this.subtitleValue.trim();
      payload['icon'] = this.iconValue.trim() || '📁';
      payload['color'] = this.colorValue;
    } else {
      payload['kind'] = this.kindValue;
    }

    const req = this.request();
    if (req.nodeId) {
      this.store.updateNode(req.nodeId, payload);
      this.toast.show('تم الحفظ');
      this.saved.emit(req.nodeId);
    } else if (req.parentId) {
      const node = this.store.addChild(req.parentId, payload);
      if (!node) {
        this.toast.show('تعذّر تحديد المكان');
        return;
      }
      this.toast.show('تمت الإضافة');
      this.saved.emit(node.id);
    }
    this.close.emit();
  }
}
