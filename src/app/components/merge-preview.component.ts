import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MergeReport } from '../core/merge.service';

/**
 * معاينة الدمج قبل التطبيق (SPEC-003 §3.4 / مبدأ P2 في STORY-003).
 * لا تُطبَّق أي عملية قبل ضغط «تأكيد» — النافذة تعرض ناتج planMerge/dedupeTree فقط.
 */
@Component({
  selector: 'app-merge-preview',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overlay open" (click)="onBackdrop($event)">
      <div class="modal">
        <div class="m-h">
          <h3>{{ title() }}</h3>
          <button class="icon-btn" (click)="cancel.emit()">✕</button>
        </div>

        <div class="m-b">
          @if (!report().entries.length) {
            <div class="empty" style="padding:24px 8px">
              <span class="e">✅</span>
              <b>لا جديد لدمجه</b>
              كل المحتوى موجود بالفعل بنفس العناوين والأمثلة.
            </div>
          } @else {
            <div class="merge-summary">
              <span class="chip add">⤵ {{ report().added }} جديدة</span>
              <span class="chip merge">⤿ {{ report().merged }} مدموجة</span>
              <span class="chip safe">⛔ {{ report().deleted }} محذوفة</span>
            </div>

            <div class="merge-list">
              @for (e of visibleEntries(); track $index) {
                <div class="merge-row" [class.is-add]="e.action === 'add'" [class.is-merge]="e.action === 'merge'">
                  <span class="merge-icon">{{ e.action === 'add' ? '⤵' : '⤿' }}</span>
                  <span class="merge-path">{{ e.path }}</span>
                  <span class="merge-detail">{{ e.detail }}</span>
                </div>
              }
              @if (report().entries.length > 50) {
                <div class="merge-more">و{{ report().entries.length - 50 }} عنصراً آخر…</div>
              }
            </div>
          }

          <div class="note">
            <b>💡 آمن دائماً:</b> لا يُحذف أي محتوى موجود. تعريفاتك المكتوبة تبقى كما هي
            ويُضاف إليها الجديد فقط. يمكنك التراجع خلال دقيقة من زر «تراجع» في الإشعار.
          </div>
        </div>

        <div class="m-f">
          <button class="btn ghost" (click)="cancel.emit()">إلغاء</button>
          <button class="btn primary" (click)="confirm.emit()">
            {{ report().entries.length ? 'تأكيد الدمج' : 'حسناً' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .merge-summary{ display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px }
    .chip{
      font-size:12.5px; font-weight:700; padding:5px 12px; border-radius:999px;
      background:var(--bg-2); border:1px solid var(--bd)
    }
    .chip.add{ color:#10b981 }
    .chip.merge{ color:#f59e0b }
    .chip.safe{ color:var(--fg-2) }

    .merge-list{
      max-height:320px; overflow-y:auto; border:1px solid var(--bd); border-radius:12px;
      display:flex; flex-direction:column
    }
    .merge-row{
      display:flex; align-items:center; gap:10px; padding:9px 12px;
      border-bottom:1px solid var(--bd); font-size:13px
    }
    .merge-row:last-child{ border-bottom:none }
    .merge-icon{ flex:none; font-size:14px }
    .merge-row.is-add .merge-icon{ color:#10b981 }
    .merge-row.is-merge .merge-icon{ color:#f59e0b }
    .merge-path{ flex:1; min-width:0; color:var(--fg); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
    .merge-detail{ flex:none; color:var(--fg-3); font-size:12px }
    .merge-more{ padding:10px 12px; text-align:center; color:var(--fg-3); font-size:12.5px }
  `],
})
export class MergePreviewComponent {
  readonly title = input<string>('معاينة الدمج');
  readonly report = input.required<MergeReport>();

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  protected visibleEntries() {
    return this.report().entries.slice(0, 50);
  }

  protected onBackdrop(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('overlay')) this.cancel.emit();
  }
}
