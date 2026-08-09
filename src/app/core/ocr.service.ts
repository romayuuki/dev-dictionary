import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

export interface OcrProgress {
  status: string;
  progress: number; // 0..1
}

/**
 * تحويل صورة (ورقة مصوَّرة بالكاميرا) إلى نص عربي/إنجليزي قابل للتعديل.
 *
 * استراتيجية هجينة حسب طلب المستخدم:
 *  - إن كان الجهاز متصلاً بالإنترنت **و** تم ضبط `environment.ocr.cloudEndpoint`: نجرّب
 *    الخدمة السحابية أولاً (أدق مع الخط اليدوي).
 *  - غير ذلك (بلا اتصال، أو بلا endpoint مضبوط، أو فشلت المحاولة السحابية): نسقط تلقائياً
 *    إلى Tesseract.js المحلي — يعمل بالكامل داخل المتصفح بلا مفتاح API وبلا سيرفر.
 *
 * Tesseract.js **لا يُحمَّل إلا عند أول استخدام فعلي** (dynamic import) حتى لا يزيد حجم
 * التحميل الأولي للتطبيق — يحترم حاجز الأداء نفسه المُتّبع في SPEC-002 REQ-4.
 */
@Injectable({ providedIn: 'root' })
export class OcrService {
  readonly busy = signal(false);
  readonly progress = signal<OcrProgress | null>(null);

  private tesseractWorkerPromise: Promise<any> | null = null;

  async recognize(image: Blob): Promise<string> {
    this.busy.set(true);
    this.progress.set({ status: 'بدء المعالجة', progress: 0 });
    try {
      if (navigator.onLine && environment.ocr?.cloudEndpoint) {
        try {
          return await this.recognizeCloud(image);
        } catch {
          // سقوط صامت للمحرّك المحلي — لا نزعج المستخدم بتفاصيل الشبكة
        }
      }
      return await this.recognizeLocal(image);
    } finally {
      this.busy.set(false);
      this.progress.set(null);
    }
  }

  private async recognizeCloud(image: Blob): Promise<string> {
    const base64 = await this.blobToBase64(image);
    const res = await fetch(environment.ocr.cloudEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64 }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`cloud OCR HTTP ${res.status}`);
    const data = (await res.json()) as { text?: string };
    if (!data.text?.trim()) throw new Error('cloud OCR: empty text');
    return data.text.trim();
  }

  private async recognizeLocal(image: Blob): Promise<string> {
    const Tesseract = await import('tesseract.js');
    const worker = await Tesseract.createWorker('ara+eng', undefined, {
      logger: (m: { status: string; progress: number }) =>
        this.progress.set({ status: m.status, progress: m.progress }),
    });
    try {
      const {
        data: { text },
      } = await worker.recognize(image);
      return text.trim();
    } finally {
      await worker.terminate();
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
