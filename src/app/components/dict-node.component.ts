import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DictNode } from '../models/dict.model';
import { DictionaryStore } from '../core/dictionary.store';
import { ToastService } from '../core/toast.service';
import { formatDefinition } from '../core/text.util';

/** عقدة قابلة للطي تعرض نفسها وأبناءها بشكل تعاودي بأي عمق */
@Component({
  selector: 'app-dict-node',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="node" [class.open]="isOpen()" [attr.id]="'node-' + node().id"
         [attr.data-depth]="depth()">
      <button class="node-head" (click)="store.toggleOpen(node().id)">
        <span class="chev">
          @if (hasBody()) {
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="m9 6 6 6-6 6" />
            </svg>
          } @else {
            <span style="opacity:.35">•</span>
          }
        </span>

        <span class="node-title">{{ node().title }}</span>

        <span class="node-meta">
          @if (node().examples.length) {
            <span class="pill ex">{{ node().examples.length }} مثال</span>
          }
          @if (node().children.length) {
            <span class="pill">{{ node().children.length }}</span>
          }
          <span class="row-acts">
            <span class="mini" role="button" tabindex="0" title="إضافة قسم بداخله"
                  (click)="add.emit(node().id); $event.stopPropagation()">＋</span>
            <span class="mini" role="button" tabindex="0" title="تعديل"
                  (click)="edit.emit(node().id); $event.stopPropagation()">✎</span>
            <span class="mini del" role="button" tabindex="0" title="حذف"
                  (click)="remove.emit(node().id); $event.stopPropagation()">🗑</span>
          </span>
        </span>
      </button>

      @if (isOpen()) {
        <div class="node-body">
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
              <app-dict-node [node]="child" [depth]="depth() + 1"
                             (add)="add.emit($event)"
                             (edit)="edit.emit($event)"
                             (remove)="remove.emit($event)"
                             (goto)="goto.emit($event)" />
            }
            <button class="add-here" (click)="add.emit(node().id)">
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

  readonly node = input.required<DictNode>();
  readonly depth = input<number>(0);

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
