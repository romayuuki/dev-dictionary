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
import { Category, Example } from '../models/dict.model';
import { DictionaryStore } from '../core/dictionary.store';
import { ToastService } from '../core/toast.service';

export interface EditorRequest {
  /** معرّف العقدة المراد تعديلها، أو null عند الإضافة */
  nodeId: string | null;
  /** الأب الذي ستُضاف بداخله العقدة الجديدة */
  parentId?: string;
}

@Component({
  selector: 'app-node-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
              <span class="hint">— يدعم **عريض** و \`كود\` و - للقوائم، و 🔗 روابط لعناصر أخرى</span>
            </label>
            <div style="position:relative">
              <textarea #defTextarea class="inp" [(ngModel)]="defValue"
                        placeholder="اشرح المصطلح هنا…"
                        (select)="rememberCursor()" (click)="rememberCursor()"
                        (keyup)="rememberCursor()"></textarea>

              <button type="button" class="btn sm ghost" style="margin-top:6px"
                      (click)="toggleLinkPicker()">
                🔗 إشارة إلى شرح موجود
              </button>

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

  private readonly defTextarea = viewChild<ElementRef<HTMLTextAreaElement>>('defTextarea');
  protected readonly linkPickerOpen = signal(false);
  protected linkQuery = '';
  private cursorPos = 0;

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
      return;
    }

    const loc = this.store.find(req.nodeId);
    if (!loc) return;

    const n = loc.node;
    this.titleValue = n.title;
    this.defValue = n.def;
    this.tagsValue = (n.tags ?? []).join('، ');
    this.examples.set(structuredClone(n.examples ?? []));

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

  // ---------- روابط داخلية بين المصطلحات ----------

  /** يحفظ موضع المؤشر داخل حقل التعريف لإدراج الرابط في المكان الصحيح */
  protected rememberCursor(): void {
    const el = this.defTextarea()?.nativeElement;
    if (el) this.cursorPos = el.selectionStart ?? this.defValue.length;
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
