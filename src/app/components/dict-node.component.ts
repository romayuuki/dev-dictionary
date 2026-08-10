import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DictNode, NodeKind, nodeKind } from '../models/dict.model';
import { DictionaryStore, MoveDir } from '../core/dictionary.store';
import { ToastService } from '../core/toast.service';
import { DragService } from '../core/drag.service';
import { formatDefinition } from '../core/text.util';

/** عقدة قابلة للطي تعرض نفسها وأبناءها بشكل تعاودي بأي عمق */
@Component({
  selector: 'app-dict-node',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="drop-line" [class.active]="isDropLineTarget()"
         (dragover)="onDragOverLine($event)" (dragleave)="onDragLeaveLine()" (drop)="onDropLine($event)"></div>

    <div class="node" [class.open]="isOpen()" [class.drag-source]="isBeingDragged()"
         [class.drop-into]="isDropIntoTarget()"
         [attr.id]="'node-' + node().id"
         [attr.data-depth]="depth()" [attr.data-kind]="kind()"
         (dragover)="onDragOverInto($event)" (dragleave)="onDragLeaveInto()" (drop)="onDropInto($event)">
      <button type="button" class="node-head" [attr.aria-expanded]="hasBody() ? isOpen() : null"
              [attr.aria-controls]="hasBody() ? 'node-body-' + node().id : null"
              draggable="true"
              (dragstart)="onDragStart($event)" (dragend)="onDragEnd()"
              (keydown)="onKeydown($event)"
              (click)="store.toggleOpen(node().id)">
        <span class="chev" aria-hidden="true">
          @if (kind() === 'term') {
            <span class="dot-mark">▪</span>
          } @else if (hasBody()) {
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="m9 6 6 6-6 6" />
            </svg>
          } @else {
            <span style="opacity:.35">•</span>
          }
        </span>

        <span class="node-title" [class.code-title]="isCodeTitle()">{{ node().title }}</span>

        @if (kind() === 'term' && !node().examples.length) {
          <span class="pill no-ex" title="بلا مثال بعد">بلا مثال</span>
        }

        <span class="node-meta">
          @if (node().examples.length) {
            <span class="pill ex">{{ node().examples.length }} مثال</span>
          }
          @if (node().children.length) {
            <span class="pill">{{ node().children.length }}</span>
          }
          <span class="row-acts">
            <span class="move-acts">
              <button type="button" class="mini" title="تحريك لأعلى (Alt+↑)" aria-label="تحريك لأعلى"
                    [disabled]="!canMove('up')"
                    (click)="move('up'); $event.stopPropagation()">↑</button>
              <button type="button" class="mini" title="تحريك لأسفل (Alt+↓)" aria-label="تحريك لأسفل"
                    [disabled]="!canMove('down')"
                    (click)="move('down'); $event.stopPropagation()">↓</button>
              <button type="button" class="mini" title="أدخِلها في العنصر السابق (Alt+←)" aria-label="أدخل في العنصر السابق"
                    [disabled]="!canMove('in')"
                    (click)="move('in'); $event.stopPropagation()">⇤</button>
              <button type="button" class="mini" title="أخرِجها لمستوى أعلى (Alt+→)" aria-label="أخرج لمستوى أعلى"
                    [disabled]="!canMove('out')"
                    (click)="move('out'); $event.stopPropagation()">⇥</button>
            </span>
            <button type="button" class="mini" title="إضافة قسم بداخله" [attr.aria-label]="'إضافة قسم داخل ' + node().title"
                  (click)="add.emit(node().id); $event.stopPropagation()">＋</button>
            <button type="button" class="mini" title="تعديل" [attr.aria-label]="'تعديل ' + node().title"
                  (click)="edit.emit(node().id); $event.stopPropagation()">✎</button>
            <button type="button" class="mini del" title="حذف" [attr.aria-label]="'حذف ' + node().title"
                  (click)="remove.emit(node().id); $event.stopPropagation()">🗑</button>
          </span>
        </span>
      </button>

      @if (isOpen()) {
        <div class="node-body" [attr.id]="'node-body-' + node().id">
          @if (depth() >= 3 && trail().length) {
            <nav class="trail" aria-label="المسار">
              @for (t of trail(); track $index) {
                <span>{{ t }}</span><i aria-hidden="true">›</i>
              }
              <span class="here">{{ node().title }}</span>
            </nav>
          }

          @if (node().def.trim()) {
            <div class="def" [innerHTML]="definitionHtml()" (click)="onDefClick($event)"></div>
          }

          @for (ex of node().examples; track $index) {
            <div class="ex">
              <div class="ex-h">
                <b>{{ ex.title || 'مثال ' + ($index + 1) }}</b>
                @if (ex.lang) { <span class="ex-lang">{{ ex.lang }}</span> }
                <button class="btn sm ghost" (click)="copy(ex.code); $event.stopPropagation()">
                  نسخ
                </button>
              </div>
              <pre><code>{{ ex.code }}</code></pre>
            </div>
          }

          @if (node().tags.length) {
            <div class="tags">
              @for (tag of node().tags; track tag) { <span class="tag">{{ tag }}</span> }
            </div>
          }

          <div class="kids">
            @for (child of node().children; track child.id) {
              <app-dict-node [node]="child" [depth]="depth() + 1" [trail]="trail().concat(node().title)"
                             (add)="add.emit($event)"
                             (edit)="edit.emit($event)"
                             (remove)="remove.emit($event)"
                             (goto)="goto.emit($event)" />
            }
            <button type="button" class="add-here" (click)="add.emit(node().id)">
              ＋ إضافة قسم داخل «{{ node().title }}»
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class DictNodeComponent {
  protected readonly store = inject(DictionaryStore);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly dragSvc = inject(DragService);

  /** حالة تحويم محلية لهذه النسخة فقط أثناء السحب — كل عقدة تعرف حالتها بمعزل عن البقية */
  private readonly hoverLine = signal(false);
  private readonly hoverInto = signal(false);

  readonly node = input.required<DictNode>();
  readonly depth = input<number>(0);
  /**
   * عناوين الآباء من الجذر — تُمرَّر تنازلياً بدل بحث عكسي في الشجرة (SPEC-002 REQ-1.3):
   * O(1) لكل عقدة معروضة بدل O(n) لكل عقدة لو استخدمنا store.find().
   */
  readonly trail = input<string[]>([]);

  readonly add = output<string>();
  readonly edit = output<string>();
  readonly remove = output<string>();
  /** يُطلق عند النقر على رابط داخلي [[id|نص]] داخل التعريف */
  readonly goto = output<string>();

  protected isOpen(): boolean {
    return this.store.openIds().has(this.node().id);
  }

  protected hasBody(): boolean {
    const n = this.node();
    return !!(n.def.trim() || n.examples.length || n.children.length || n.tags.length);
  }

  /** SPEC-002 REQ-2.1 — group/term بصرياً؛ يُستنتج تلقائياً عند غياب kind */
  protected kind(): NodeKind {
    return nodeKind(this.node());
  }

  /** SPEC-002 REQ-2.3 — عنوان يشبه رمزاً برمجياً (`<meta>`, `ref()`, `v-model.lazy`) يُعرض بخط أحادي المسافة */
  protected isCodeTitle(): boolean {
    if (this.kind() !== 'term') return false;
    const t = this.node().title.trim();
    return /^</.test(t) || /\(\)$/.test(t) || /^[a-zA-Z@.-]+\.[a-zA-Z.]+$/.test(t);
  }

  // ---------- إعادة الترتيب: أزرار + اختصارات (SPEC-003 §4.3) ----------

  protected canMove(dir: MoveDir): boolean {
    return this.store.canMove(this.node().id, dir);
  }

  protected move(dir: MoveDir): void {
    if (!this.store.moveNode(this.node().id, dir)) this.toast.show('لا يمكن الحركة في هذا الاتجاه');
  }

  /** Alt+↑/↓/←/→ على عقدة مركَّز عليها — يعمل بلوحة المفاتيح بالكامل (AC-2.5) */
  protected onKeydown(e: KeyboardEvent): void {
    if (!e.altKey) return;
    const map: Partial<Record<string, MoveDir>> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'in',
      ArrowRight: 'out',
    };
    const dir = map[e.key];
    if (!dir) return;
    e.preventDefault();
    this.move(dir);
  }

  // ---------- إعادة الترتيب: سحب وإفلات (سطح المكتب — SPEC-003 §4.3) ----------

  protected isBeingDragged(): boolean {
    return this.dragSvc.draggedId() === this.node().id;
  }

  protected isDropLineTarget(): boolean {
    const id = this.dragSvc.draggedId();
    return this.hoverLine() && !!id && id !== this.node().id;
  }

  protected isDropIntoTarget(): boolean {
    const id = this.dragSvc.draggedId();
    return this.hoverInto() && !!id && id !== this.node().id;
  }

  protected onDragStart(e: DragEvent): void {
    e.dataTransfer?.setData('text/plain', this.node().id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    this.dragSvc.start(this.node().id);
  }

  protected onDragEnd(): void {
    this.dragSvc.end();
    this.hoverLine.set(false);
    this.hoverInto.set(false);
  }

  /** خط رفيع أعلى العقدة — الإفلات عليه يضع العنصر المسحوب شقيقاً قبلها مباشرة */
  protected onDragOverLine(e: DragEvent): void {
    const id = this.dragSvc.draggedId();
    if (!id || id === this.node().id) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    this.hoverLine.set(true);
  }

  protected onDragLeaveLine(): void {
    this.hoverLine.set(false);
  }

  protected onDropLine(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.hoverLine.set(false);
    const draggedId = this.dragSvc.draggedId();
    this.dragSvc.end();
    if (!draggedId || draggedId === this.node().id) return;
    if (!this.store.moveBefore(draggedId, this.node().id)) this.toast.show('تعذّر النقل هنا');
  }

  /** الإفلات على جسم العقدة نفسها يضع العنصر المسحوب ابناً بداخلها */
  protected onDragOverInto(e: DragEvent): void {
    const id = this.dragSvc.draggedId();
    if (!id || id === this.node().id) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    this.hoverInto.set(true);
  }

  protected onDragLeaveInto(): void {
    this.hoverInto.set(false);
  }

  protected onDropInto(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.hoverInto.set(false);
    const draggedId = this.dragSvc.draggedId();
    this.dragSvc.end();
    if (!draggedId || draggedId === this.node().id) return;
    if (!this.store.moveToParent(draggedId, this.node().id)) this.toast.show('لا يمكن نقل عنصر داخل نفسه');
  }

  protected definitionHtml(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(formatDefinition(this.node().def));
  }

  /** يلتقط النقر على أي رابط داخلي [[id|نص]] بداخل التعريف ويطلقه لأعلى */
  protected onDefClick(e: MouseEvent): void {
    const target = (e.target as HTMLElement).closest('a.ref-link') as HTMLElement | null;
    if (!target) return;
    e.preventDefault();
    const id = target.dataset['refId'];
    if (id) this.goto.emit(id);
  }

  protected async copy(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      this.toast.show('تم نسخ الكود');
    } catch {
      this.toast.show('تعذّر النسخ');
    }
  }
}
