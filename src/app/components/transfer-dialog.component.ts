import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DictionaryStore } from '../core/dictionary.store';
import { ToastService } from '../core/toast.service';
import { TransferService } from '../core/transfer.service';

export type TransferMode = 'import' | 'export';

@Component({
  selector: 'app-transfer-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overlay open" (click)="onBackdrop($event)">
      <div class="modal" [class.wide]="mode() === 'import'">
        @if (mode() === 'export') {
          <div class="m-h">
            <h3>تصدير / نسخة احتياطية</h3>
            <button class="icon-btn" (click)="close.emit()">✕</button>
          </div>
          <div class="m-b">
            <div style="display:grid;gap:10px">
              <button class="btn primary" style="height:46px;justify-content:center"
                      (click)="exportJson()">
                ⬇ تنزيل نسخة JSON احتياطية
              </button>
              <button class="btn" style="height:46px;justify-content:center" (click)="printPage()">
                🖨 طباعة / حفظ كـ PDF
              </button>
            </div>
            <div class="note">
              <b>مهم:</b> تعديلاتك تُحفظ تلقائياً في هذا المتصفح. نزّل نسخة JSON بين حين وآخر
              كنسخة احتياطية على جهازك.
            </div>
          </div>
        } @else {
          <div class="m-h">
            <h3>استيراد محتوى</h3>
            <button class="icon-btn" (click)="close.emit()">✕</button>
          </div>
          <div class="m-b">
            <div class="field">
              <label>ضع المحتوى في القسم</label>
              <select class="inp" [(ngModel)]="targetCategoryId">
                @for (c of store.categories(); track c.id) {
                  <option [value]="c.id">{{ c.icon }} {{ c.title }}</option>
                }
              </select>
            </div>

            <div class="drop" [class.over]="dragOver()"
                 (click)="fileInput.click()"
                 (dragover)="$event.preventDefault(); dragOver.set(true)"
                 (dragleave)="dragOver.set(false)"
                 (drop)="onDrop($event)">
              <span class="e">📄</span>
              <b style="display:block;color:var(--fg);font-size:15px">
                اسحب ملفاتك هنا أو اضغط للاختيار
              </b>
              <span style="font-size:12.5px">.docx · .md · .txt · .json (استعادة نسخة كاملة)</span>
              <input #fileInput type="file" accept=".docx,.md,.txt,.json" multiple hidden
                     (change)="onFilesPicked($event)" />
            </div>

            @if (log().length) {
              <div style="margin-top:14px;font-size:12.5px;color:var(--fg-2)">
                @for (line of log(); track $index) { <div>{{ line }}</div> }
              </div>
            }

            <div class="note">
              <b>ملف Word:</b> تُحوَّل عناوين Word (Heading 1/2/3…) إلى أقسام متداخلة تلقائياً،
              والفقرات إلى تعريفات، وكتل الكود إلى أمثلة.
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class TransferDialogComponent {
  protected readonly store = inject(DictionaryStore);
  private readonly transfer = inject(TransferService);
  private readonly toast = inject(ToastService);

  readonly mode = input.required<TransferMode>();
  readonly close = output<void>();

  protected targetCategoryId = this.store.activeCategory()?.id ?? '';
  protected readonly dragOver = signal(false);
  protected readonly log = signal<string[]>([]);

  protected exportJson(): void {
    this.transfer.exportJson();
    this.close.emit();
  }

  protected printPage(): void {
    this.close.emit();
    setTimeout(() => print(), 200);
  }

  protected onBackdrop(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('overlay')) this.close.emit();
  }

  protected onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragOver.set(false);
    void this.handle(e.dataTransfer?.files);
  }

  protected onFilesPicked(e: Event): void {
    void this.handle((e.target as HTMLInputElement).files);
  }

  private async handle(files: FileList | null | undefined): Promise<void> {
    if (!files?.length) return;

    for (const file of Array.from(files)) {
      try {
        const message = await this.transfer.importFile(file, this.targetCategoryId);
        this.log.update((l) => [...l, message]);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.log.update((l) => [...l, `❌ ${file.name} — ${reason}`]);
      }
    }
    this.toast.show('انتهى الاستيراد');
  }
}
