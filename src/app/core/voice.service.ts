import { Injectable, signal } from '@angular/core';

const LS_MIC_GRANTED = 'micGranted';

export interface VoiceResult {
  transcript: string;
  isFinal: boolean;
}

type SpeechRecognitionCtor = new () => any;

/**
 * البحث الصوتي عبر Web Speech API.
 *
 * ملاحظة مهمة حول الإذن: المتصفح لا يحفظ إذن الميكروفون إلا على أصل آمن
 * (https أو http://localhost). عند فتح الصفحة بـ file:// سيُطلب الإذن في كل مرة
 * مهما فعلنا — هذا قيد في المتصفح نفسه لا يمكن تجاوزه برمجياً.
 *
 * على الأصل الآمن نطلب الإذن مرة واحدة عبر getUserMedia (الذي يجعل المتصفح
 * يحفظه للموقع) ثم نغلق المسار فوراً، ونتذكّر ذلك محلياً حتى لا نستدعيه مجدداً.
 */
@Injectable({ providedIn: 'root' })
export class VoiceService {
  private readonly Recognition: SpeechRecognitionCtor | undefined =
    (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

  private recognition: any = null;
  private granted = localStorage.getItem(LS_MIC_GRANTED) === '1';

  readonly listening = signal(false);
  readonly supported = !!this.Recognition;
  /** الأصل غير الآمن يمنع حفظ الإذن — تستخدمه الواجهة لعرض تنبيه */
  readonly insecureOrigin = location.protocol === 'file:';

  /** يطلب الإذن مرة واحدة فقط. يرجع false إن رُفض أو تعذّر. */
  async ensurePermission(): Promise<{ ok: boolean; reason?: string }> {
    if (this.granted) return { ok: true };

    try {
      const status = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
      if (status?.state === 'granted') {
        this.remember();
        return { ok: true };
      }
      if (status?.state === 'denied') {
        return { ok: false, reason: 'الميكروفون محظور — فعّله من أيقونة القفل بجوار العنوان' };
      }
    } catch {
      /* بعض المتصفحات لا تدعم استعلام microphone — نكمل للطلب المباشر */
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop()); // هدفنا الإذن فقط، لا التسجيل
      this.remember();
      return { ok: true };
    } catch {
      return {
        ok: false,
        reason: this.insecureOrigin
          ? 'الميكروفون لا يعمل عند فتح الملف مباشرة — شغّل المشروع عبر ng serve'
          : 'يجب السماح بالوصول للميكروفون لاستخدام البحث الصوتي',
      };
    }
  }

  private remember(): void {
    this.granted = true;
    localStorage.setItem(LS_MIC_GRANTED, '1');
  }

  /** إن سُحب الإذن لاحقاً نُلغي الحفظ ليُطلب من جديد */
  private forget(): void {
    this.granted = false;
    localStorage.removeItem(LS_MIC_GRANTED);
  }

  async start(
    onResult: (r: VoiceResult) => void,
    onError: (message: string) => void,
    lang = 'ar-EG',
  ): Promise<void> {
    if (!this.Recognition) {
      onError('المتصفح لا يدعم البحث الصوتي — جرّب Chrome أو Edge');
      return;
    }

    const permission = await this.ensurePermission();
    if (!permission.ok) {
      onError(permission.reason ?? 'تعذّر الوصول للميكروفون');
      return;
    }

    const rec = new this.Recognition();
    this.recognition = rec;
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => this.listening.set(true);
    rec.onend = () => this.listening.set(false);

    rec.onerror = (e: any) => {
      this.listening.set(false);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') this.forget();

      const messages: Record<string, string> = {
        'not-allowed': 'يجب السماح بالوصول للميكروفون',
        'no-speech': 'لم أسمع شيئاً — حاول مجدداً',
        'service-not-allowed': 'خدمة التعرف الصوتي محظورة في هذا المتصفح',
      };
      onError(messages[e.error] ?? `تعذّر التعرّف على الصوت: ${e.error}`);
    };

    rec.onresult = (e: any) => {
      let transcript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      onResult({
        transcript: transcript.trim(),
        isFinal: e.results[e.results.length - 1].isFinal,
      });
    };

    try {
      rec.start();
    } catch {
      onError('تعذّر بدء التسجيل');
    }
  }

  stop(): void {
    this.recognition?.stop();
  }
}
