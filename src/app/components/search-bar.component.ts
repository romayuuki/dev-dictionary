import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SearchHit } from '../models/dict.model';
import { DictionaryStore } from '../core/dictionary.store';
import { SearchService } from '../core/search.service';
import { ToastService } from '../core/toast.service';
import { VoiceService } from '../core/voice.service';

/** تأجيل البحث أثناء الكلام غير النهائي لتخفيف الحمل */
const INTERIM_DEBOUNCE_MS = 150;
/** مهلة قصيرة قبل الانتقال التلقائي حتى يرى المستخدم ما التُقط */
const AUTO_JUMP_MS = 350;

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="search-wrap">
      <div class="search-box">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.2" stroke-linecap="round" style="color:var(--fg-3);flex:none">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>

        <input #queryInput type="search" autocomplete="off" spellcheck="false"
               [placeholder]="placeholder()"
               (input)="onInput($any($event.target).value)"
               (focus)="onFocus()"
               (keydown)="onKeydown($event)" />

        <kbd>Ctrl K</kbd>

        <button class="icon-btn mic" [class.rec]="voice.listening()"
                [title]="micTitle()" aria-label="بحث بالصوت" (click)="toggleMic()">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round">
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v4" />
          </svg>
        </button>
      </div>

      @if (open()) {
        <div class="results open">
          @if (hits().length) {
            <div class="res-head">{{ hits().length }} نتيجة — استخدم ↑ ↓ ثم Enter</div>
            @for (hit of hits(); track hit.node.id; let i = $index) {
              <button class="res" [class.sel]="i === selected()" (click)="pick(i)">
                <div class="res-t" [innerHTML]="titleHtml(hit)"></div>
                <div class="res-p">
                  <span>{{ hit.cat.icon }} {{ hit.cat.title }}</span>
                  @for (p of hit.path; track p.id) {
                    <i>›</i><span>{{ p.title }}</span>
                  }
                </div>
                <div class="res-s" [innerHTML]="snippetHtml(hit)"></div>
              </button>
            }
          } @else {
            <div class="empty-res">لا توجد نتائج لـ «{{ query() }}»</div>
          }
        </div>
      }
    </div>
  `,
})
export class SearchBarComponent {
  private readonly store = inject(DictionaryStore);
  private readonly search = inject(SearchService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly voice = inject(VoiceService);

  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('queryInput');

  protected readonly query = signal('');
  protected readonly hits = signal<SearchHit[]>([]);
  protected readonly selected = signal(-1);
  protected readonly open = signal(false);

  private interimTimer?: ReturnType<typeof setTimeout>;

  protected placeholder(): string {
    return this.voice.listening() ? '🎙 تكلّم الآن…' : 'ابحث عن أي مصطلح…  (Ctrl + K)';
  }

  protected micTitle(): string {
    if (!this.voice.supported) return 'المتصفح لا يدعم البحث الصوتي — جرّب Chrome أو Edge';
    if (this.voice.insecureOrigin) return 'شغّل المشروع عبر ng serve ليُحفظ إذن الميكروفون';
    return 'بحث بالصوت (Ctrl + M)';
  }

  // ---------- البحث النصي ----------

  protected onInput(value: string): void {
    this.query.set(value);
    this.runSearch(value);
  }

  protected onFocus(): void {
    if (this.query().trim()) this.runSearch(this.query());
  }

  private runSearch(value: string): void {
    if (!value.trim()) {
      this.hits.set([]);
      this.open.set(false);
      return;
    }
    const results = this.search.search(value);
    this.hits.set(results);
    this.selected.set(results.length ? 0 : -1);
    this.open.set(true);
  }

  protected pick(index: number): void {
    const hit = this.hits()[index];
    if (!hit) return;
    this.open.set(false);
    this.input().nativeElement.blur();
    this.store.revealNode(hit.node.id);
  }

  protected onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.query.set('');
      this.hits.set([]);
      this.open.set(false);
      this.input().nativeElement.value = '';
      this.input().nativeElement.blur();
      return;
    }
    if (!this.hits().length || !this.open()) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const len = this.hits().length;
      this.selected.set((this.selected() + delta + len) % len);
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      this.pick(Math.max(0, this.selected()));
    }
  }

  // ---------- البحث الصوتي ----------

  protected async toggleMic(): Promise<void> {
    if (this.voice.listening()) {
      this.voice.stop();
      return;
    }

    this.query.set('');
    this.hits.set([]);
    this.open.set(false);

    await this.voice.start(
      ({ transcript, isFinal }) => {
        this.query.set(transcript);
        this.input().nativeElement.value = transcript;

        clearTimeout(this.interimTimer);
        if (!isFinal) {
          this.interimTimer = setTimeout(() => this.runSearch(transcript), INTERIM_DEBOUNCE_MS);
          return;
        }

        this.runSearch(transcript);
        const results = this.hits();
        if (!results.length) {
          this.toast.show(`لا نتائج لـ «${transcript}»`);
          return;
        }
        // ننتقل تلقائياً فقط عند نتيجة واضحة التفوق، وإلا نترك الاختيار للمستخدم
        if (this.search.isUnambiguous(results)) {
          setTimeout(() => this.pick(0), AUTO_JUMP_MS);
        } else {
          this.toast.show('أكثر من نتيجة محتملة — اختر منها بالأسفل');
        }
      },
      (message) => this.toast.show(message),
    );
  }

  // ---------- اختصارات عامة ----------

  @HostListener('document:keydown', ['$event'])
  protected onGlobalKeydown(e: KeyboardEvent): void {
    if (!(e.ctrlKey || e.metaKey)) return;

    // ندعم الحرف العربي أيضاً حتى يعمل الاختصار مع لوحة المفاتيح العربية
    if (e.code === 'KeyK' || e.key.toLowerCase() === 'k' || e.key === 'ن') {
      e.preventDefault();
      this.input().nativeElement.focus();
      this.input().nativeElement.select();
    }
    if (e.code === 'KeyM' || e.key.toLowerCase() === 'm' || e.key === 'ص') {
      e.preventDefault();
      void this.toggleMic();
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(e: MouseEvent): void {
    if (!(e.target as HTMLElement).closest('app-search-bar')) this.open.set(false);
  }

  // ---------- عرض ----------

  protected titleHtml(hit: SearchHit): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(
      this.search.highlightTitle(hit.node.title, this.query()),
    );
  }

  protected snippetHtml(hit: SearchHit): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.search.snippet(hit, this.query()));
  }
}
