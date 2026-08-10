import { Injectable, signal } from '@angular/core';

/**
 * يتتبّع معرّف العقدة قيد السحب حالياً — مشترك بين كل نُسخ dict-node.component
 * المتداخلة (الشجرة تعاودية بأي عمق)، حتى تعرف كل عقدة هل هي وجهة إفلات صالحة
 * دون تمرير الحالة يدوياً عبر كل مستوى (SPEC-003 §4.3).
 */
@Injectable({ providedIn: 'root' })
export class DragService {
  readonly draggedId = signal<string | null>(null);

  start(id: string): void {
    this.draggedId.set(id);
  }

  end(): void {
    this.draggedId.set(null);
  }
}
