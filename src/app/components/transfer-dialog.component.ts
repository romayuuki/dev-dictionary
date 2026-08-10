import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DictionaryStore } from '../core/dictionary.store';
import { ToastService } from '../core/toast.service';
import { TransferService } from '../core/transfer.service';
import { DictData, DictNode } from '../models/dict.model';
import { MergeReport } from '../core/merge.service';
import { MergePreviewComponent } from './merge-preview.component';

export type TransferMode = 'import' | 'export';

@Component({
  selector: 'app-transfer-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MergePreviewComponent],
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
              <b>الدمج آمن دائماً:</b> قبل أي إضافة تظهر معاينة تفصيلية للموافقة عليها،
              ولن يُحذف أو يُستبدل أي محتوى موجود لديك — يُضاف الجديد ويُثرى المتشابه فقط.
            </div>
          </div>
        }
      </div>
    </div>

    @if (pendingRestore(); as restore) {
      <div class="overlay open" (click)="cancelRestore($event)">
        <div class="modal">
          <div class="m-h">
            <h3>استعادة نسخة كاملة</h3>
            <button class="icon-btn" (click)="pendingRestore.set(null)">✕</button>
          </div>
          <div class="m-b">
            <p style="margin:0">
              ملف <b>«{{ restore.fileName }}»</b> نسخة JSON كاملة — استيراده
              <b>يستبدل كامل قاموسك الحالي</b> بمحتوى هذا الملف.
            </p>
            <div class="note">💡 يمكنك التراجع خلال دقيقة من زر «تراجع» في الإشعار بعد الاستيراد.</div>
          </div>
          <div class="m-f">
            <button class="btn ghost" (click)="pendingRestore.set(null)">إلغاء</button>
            <button class="btn danger" (click)="confirmRestore(restore)">نعم، استبدل الكل</button>
          </div>
        </div>
      </div>
    }

    @if (pendingMerge(); as pending) {
      <app-merge-preview
        [title]="'معاينة الاستيراد — ' + pending.catTitle"
        [report]="pending.report"
        (confirm)="confirmMerge(pending)"
        (cancel)="pendingMerge.set(null)" />
    }
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

  protected readonly pendingRestore = signal<{ fileName: string; data: DictData } | null>(null);
  protected readonly pendingMerge = signal<{
    catTitle: string;
    catId: string;
    nodes: DictNode[];
    report: MergeReport;
  } | null>(null);

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

  /**
   * يحلّل الملفات فقط (بلا أي تعديل على القاموس)، ثم يبني معاينة موحّدة.
   * ملفات JSON (استعادة كاملة) تُعرض كتأكيد منفصل لأنها عملية استبدال شامل، لا دمج.
   */
  private async handle(files: FileList | null | undefined): Promise<void> {
    if (!files?.length) return;

    const combinedNodes: DictNode[] = [];

    for (const file of Array.from(files)) {
      try {
        const result = await this.transfer.parseFile(file);
        if (result.kind === 'empty') {
          this.log.update((l) => [...l, `⚠️ ${result.fileName} — لم أجد عناوين. تأكّد من استخدام أنماط Heading.`]);
        } else if (result.kind === 'restore') {
          this.pendingRestore.set({ fileName: result.fileName, data: result.data });
        } else {
          combinedNodes.push(...result.nodes);
          this.log.update((l) => [...l, `📄 ${result.fileName} — جاهز للمعاينة`]);
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.log.update((l) => [...l, `❌ ${file.name} — ${reason}`]);
      }
    }

    if (combinedNodes.length) {
      const cat = this.store.categories().find((c) => c.id === this.targetCategoryId);
      if (cat) {
        const report = this.store.previewMerge(this.targetCategoryId, combinedNodes);
        this.pendingMerge.set({ catTitle: cat.title, catId: this.targetCategoryId, nodes: combinedNodes, report });
      }
    }
  }

  protected cancelRestore(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('overlay')) this.pendingRestore.set(null);
  }

  protected confirmRestore(restore: { fileName: string; data: DictData }): void {
    this.store.restoreFromJson(restore.data);
    this.pendingRestore.set(null);
    this.close.emit();
    this.toast.showWithAction(`✅ استُعيدت النسخة الكاملة من «${restore.fileName}»`, {
      label: 'تراجع',
      run: () => {
        if (this.store.undoLastImport()) this.toast.show('تم التراجع');
      },
    });
  }

  protected confirmMerge(pending: { catTitle: string; catId: string; nodes: DictNode[] }): void {
    const report = this.store.mergeIntoCategory(pending.catId, pending.nodes);
    this.pendingMerge.set(null);
    this.close.emit();
    const summary = `✅ «${pending.catTitle}» — ${report.added} جديدة · ${report.merged} مدموجة`;
    this.toast.showWithAction(summary, {
      label: 'تراجع',
      run: () => {
        if (this.store.undoLastImport()) this.toast.show('تم التراجع');
      },
    });
  }
}
