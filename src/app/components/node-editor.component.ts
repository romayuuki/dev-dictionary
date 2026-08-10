import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Category, Example, NodeKind } from '../models/dict.model';
import { DictionaryStore } from '../core/dictionary.store';
import { ToastService } from '../core/toast.service';
import { CameraOcrDialogComponent } from './camera-ocr-dialog.component';
import { RichEditorComponent } from './rich-editor.component';

export interface EditorRequest {
  /** معرّف العقدة المراد تعديلها، أو null عند الإضافة */
  nodeId: string | null;
  /** الأب الذي ستُضاف بداخله العقدة الجديدة */
  parentId?: string;
}

@Component({
  selector: 'app-node-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, CameraOcrDialogComponent, RichEditorComponent],
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
          @if (looksLikeMultiConcept() && !splitPreview()) {
            <div class="note">
              💡 يبدو أن هنا أكثر من مفهوم — هل تُقسّمها إلى عقد مستقلة؟ (إرشادي، لا يمنع الحفظ)
              @if (!isNew()) {
                <div style="margin-top:6px">
                  <button type="button" class="btn sm" (click)="previewSplit()">✂️ تقسيم إلى عقد</button>
                </div>
              } @else {
                <div style="margin-top:4px;color:var(--fg-3)">احفظ العقدة أولاً قبل التقسيم.</div>
              }
            </div>
          }

          @if (splitPreview(); as items) {
            <div class="note split-preview">
              <b>معاينة التقسيم — {{ items.length }} عقدة ستُنشأ داخل «{{ titleValue }}»:</b>
              <ul>
                @for (it of items; track $index) {
                  <li><code>{{ it.title }}</code> — {{ it.def }}</li>
                }
              </ul>
              <div style="display:flex;gap:8px;margin-top:8px">
                <button type="button" class="btn sm ghost" (click)="cancelSplit()">إلغاء</button>
                <button type="button" class="btn sm primary" (click)="applySplit()">تطبيق التقسيم</button>
              </div>
            </div>
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
              <span class="hint">— محرر مرئي: التنسيق يظهر مباشرة، بلا رموز نصية ظاهرة</span>
            </label>
            <div style="position:relative">
              <app-rich-editor #richEditor
                                [resetKey]="request()"
                                [initialMarkup]="defValue"
                                [excludeId]="request().nodeId" />

              <div class="fmt-toolbar" style="margin-top:8px">
                <button type="button" class="btn sm ghost" (click)="cameraOpen.set(true)">
                  📷 مسح من الكاميرا (OCR)
                </button>
              </div>
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

  private readonly richEditor = viewChild.required(RichEditorComponent);
  protected readonly cameraOpen = signal(false);

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
    const bulletsWithCode = this.currentDef()
      .split('\n')
      .filter((l) => /^\s*[-*•]\s+`/.test(l));
    return bulletsWithCode.length >= 3;
  }

  /** القيمة الحيّة الحالية للتعريف من المحرر المرئي — لا defValue المجمّدة عند الفتح */
  private currentDef(): string {
    return this.richEditor().getMarkup();
  }

  // ---------- SPEC-002 REQ-6.4/6.5 — تقسيم إلى عقد (معاينة قابلة للتراجع قبل الحفظ) ----------

  protected readonly splitPreview = signal<{ line: string; title: string; def: string }[] | null>(null);
  private static readonly BULLET_RE = /^\s*[-*•]\s+(?:`([^`]+)`|\*\*([^*]+)\*\*)\s*(.*)$/;

  /** يستخرج بنود القائمة النقطية (رمز + وصف) من def دون تعديله بعد — للمعاينة فقط */
  protected previewSplit(): void {
    const items = this.currentDef()
      .split('\n')
      .map((line) => {
        const m = line.match(NodeEditorComponent.BULLET_RE);
        if (!m) return null;
        const title = (m[1] ?? m[2] ?? '').trim();
        const def = (m[3] ?? '').trim();
        return title ? { line, title, def: def || title } : null;
      })
      .filter((x): x is { line: string; title: string; def: string } => !!x);

    if (!items.length) {
      this.toast.show('لم أجد بنوداً بصيغة معروفة `رمز` أو **رمز** للتقسيم');
      return;
    }
    this.splitPreview.set(items);
  }

  protected cancelSplit(): void {
    this.splitPreview.set(null);
  }

  /** ينشئ عقدة ابن (term) لكل بند مُعايَن، ويحذف أسطره من def الأب — REQ-4.1 لا فقد: النص ينتقل، لا يُحذف */
  protected applySplit(): void {
    const items = this.splitPreview();
    const nodeId = this.request().nodeId;
    if (!items || !nodeId) return;

    for (const it of items) {
      this.store.addChild(nodeId, {
        title: it.title,
        def: it.def,
        kind: 'term',
        tags: [],
        examples: [],
      });
    }

    const removedLines = new Set(items.map((it) => it.line));
    this.defValue = this.currentDef()
      .split('\n')
      .filter((line) => !removedLines.has(line))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    // نُعيد بناء محتوى المحرر من القيمة المخفَّضة — التحرير الحيّ لا يتزامن تلقائياً مع defValue
    this.richEditor().setMarkup(this.defValue);

    this.splitPreview.set(null);
    this.toast.show(`تم إنشاء ${items.length} عقدة — لا تنسَ الضغط على «حفظ»`);
  }

  // ---------- تصوير ورقة وتحويلها لنص (OCR) ----------

  /**
   * يُدرج النص المستخرَج (بعد مراجعة المستخدم له داخل حوار الكاميرا) في المحرر المرئي
   * عند موضع المؤشر المحفوظ فيه. يبقى قابلاً للتعديل الكامل فور الإدراج،
   * ولا يُحفظ إلا بضغط «حفظ» صراحةً.
   */
  protected onOcrInsert(text: string): void {
    this.cameraOpen.set(false);
    const clean = text.trim();
    if (!clean) return;

    this.richEditor().insertPlainText(clean);
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
      def: this.currentDef(),
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
