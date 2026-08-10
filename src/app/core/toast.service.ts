import { Injectable, signal } from '@angular/core';

const VISIBLE_MS = 2600;
/** مهلة أطول لتوست فيه زر إجراء (مثل «تراجع») — SPEC-003 §3.5 */
const VISIBLE_WITH_ACTION_MS = 10_000;

export interface ToastAction {
  label: string;
  run: () => void;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal<string | null>(null);
  readonly action = signal<ToastAction | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  /** توست عادي يختفي تلقائياً */
  show(message: string): void {
    this.message.set(message);
    this.action.set(null);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.dismiss(), VISIBLE_MS);
  }

  /** توست بزر إجراء واحد (مثل «تراجع») — يبقى ظاهراً مدة أطول */
  showWithAction(message: string, action: ToastAction): void {
    this.message.set(message);
    this.action.set(action);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.dismiss(), VISIBLE_WITH_ACTION_MS);
  }

  runAction(): void {
    this.action()?.run();
    this.dismiss();
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this.message.set(null);
    this.action.set(null);
  }
}
