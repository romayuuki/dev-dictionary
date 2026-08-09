import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OcrService } from '../core/ocr.service';

type Stage = 'camera' | 'preview' | 'recognizing' | 'review' | 'error';

/**
 * تصوير ورقة بالكاميرا وتحويل محتواها المكتوب إلى نص، ليُدرَج مكان التعريف ويظل قابلاً للتعديل.
 * لا يُدرَج أي نص تلقائياً بلا مراجعة المستخدم أولاً (مبدأ عدم الإضرار — لا فقد ولا مفاجآت).
 */
@Component({
  selector: 'app-camera-ocr-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overlay open" (click)="onBackdrop($event)">
      <div class="modal">
        <div class="m-h">
          <h3>📷 مسح نص من الورقة</h3>
          <button class="icon-btn" (click)="cancel.emit()">✕</button>
        </div>

        <div class="m-b">
          @switch (stage()) {
            @case ('camera') {
              <div class="cam-wrap">
                <video #video autoplay playsinline muted></video>
              </div>
              <p class="note">💡 وجّه الكاميرا نحو الورقة بإضاءة جيدة، وثبّتها قبل الالتقاط.</p>
            }
            @case ('preview') {
              <div class="cam-wrap">
                <img [src]="photoUrl()" alt="الصورة الملتقطة" />
              </div>
            }
            @case ('recognizing') {
              <div class="cam-wrap">
                <img [src]="photoUrl()" alt="الصورة الملتقطة" />
                <div class="cam-overlay">
                  <div class="spinner" aria-hidden="true"></div>
                  <div>{{ progressLabel() }}</div>
                </div>
              </div>
            }
            @case ('review') {
              <div class="field">
                <label>النص المستخرَج — راجعه وعدّله قبل الإدراج</label>
                <textarea class="inp" rows="8" [(ngModel)]="recognizedText" spellcheck="false"></textarea>
              </div>
            }
            @case ('error') {
              <div class="note" style="color:var(--danger)">{{ errorMessage() }}</div>
            }
          }
        </div>

        <div class="m-f">
          @switch (stage()) {
            @case ('camera') {
              <button class="btn ghost" (click)="cancel.emit()">إلغاء</button>
              <button class="btn primary" [disabled]="!streamReady()" (click)="capture()">📸 التقاط</button>
            }
            @case ('preview') {
              <button class="btn ghost" (click)="retake()">إعادة الالتقاط</button>
              <button class="btn primary" (click)="runOcr()">استخراج النص</button>
            }
            @case ('recognizing') {
              <button class="btn ghost" disabled>جارٍ المعالجة…</button>
            }
            @case ('review') {
              <button class="btn ghost" (click)="retake()">إعادة الالتقاط</button>
              <button class="btn primary" (click)="insert.emit(recognizedText)">إدراج النص</button>
            }
            @case ('error') {
              <button class="btn ghost" (click)="cancel.emit()">إغلاق</button>
              <button class="btn primary" (click)="retake()">حاول مجدداً</button>
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .cam-wrap{position:relative;border-radius:var(--r-m);overflow:hidden;background:#000;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center}
    .cam-wrap video,.cam-wrap img{width:100%;height:100%;object-fit:contain;display:block}
    .cam-overlay{position:absolute;inset:0;background:rgba(10,12,20,.55);display:flex;flex-direction:column;gap:10px;align-items:center;justify-content:center;color:#fff;font-size:13px}
    .spinner{width:28px;height:28px;border-radius:50%;border:3px solid rgba(255,255,255,.3);border-top-color:#fff;animation:spin .8s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    @media (prefers-reduced-motion:reduce){.spinner{animation-duration:2.4s}}
  `],
})
export class CameraOcrDialogComponent implements OnDestroy {
  private readonly ocr = inject(OcrService);

  /** يُطلق بالنص النهائي بعد موافقة المستخدم على مراجعته */
  readonly insert = output<string>();
  readonly cancel = output<void>();

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');

  protected readonly stage = signal<Stage>('camera');
  protected readonly streamReady = signal(false);
  protected readonly photoUrl = signal<string>('');
  protected readonly errorMessage = signal('');
  protected recognizedText = '';

  private stream: MediaStream | null = null;
  private photoBlob: Blob | null = null;

  constructor() {
    void this.openCamera();
  }

  private async openCamera(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.fail('المتصفح لا يدعم الوصول للكاميرا.');
      return;
    }
    if (location.protocol === 'file:') {
      this.fail('الكاميرا لا تعمل عند فتح الملف مباشرة — شغّل المشروع عبر npm start.');
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      queueMicrotask(() => {
        const el = this.video()?.nativeElement;
        if (el) {
          el.srcObject = this.stream;
          this.streamReady.set(true);
        }
      });
    } catch {
      this.fail('تعذّر الوصول إلى الكاميرا — تأكّد من السماح بالإذن من إعدادات المتصفح.');
    }
  }

  private fail(message: string): void {
    this.errorMessage.set(message);
    this.stage.set('error');
  }

  protected capture(): void {
    const el = this.video()?.nativeElement;
    if (!el) return;

    const canvas = document.createElement('canvas');
    canvas.width = el.videoWidth || 1280;
    canvas.height = el.videoHeight || 960;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(el, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      this.photoBlob = blob;
      this.photoUrl.set(URL.createObjectURL(blob));
      this.stopStream();
      this.stage.set('preview');
    }, 'image/jpeg', 0.92);
  }

  protected retake(): void {
    this.photoBlob = null;
    this.recognizedText = '';
    this.stage.set('camera');
    void this.openCamera();
  }

  protected async runOcr(): Promise<void> {
    if (!this.photoBlob) return;
    this.stage.set('recognizing');
    try {
      this.recognizedText = await this.ocr.recognize(this.photoBlob);
      this.stage.set('review');
    } catch {
      this.fail('تعذّر استخراج النص من الصورة — جرّب صورة أوضح.');
    }
  }

  protected progressLabel(): string {
    const p = this.ocr.progress();
    if (!p) return 'جارٍ التحضير…';
    const pct = Math.round(p.progress * 100);
    return `${p.status}… ${pct}%`;
  }

  protected onBackdrop(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('overlay')) this.cancel.emit();
  }

  private stopStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  ngOnDestroy(): void {
    this.stopStream();
    if (this.photoUrl()) URL.revokeObjectURL(this.photoUrl());
  }
}
