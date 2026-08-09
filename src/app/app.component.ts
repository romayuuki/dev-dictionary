import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DictionaryStore } from './core/dictionary.store';
import { ToastService } from './core/toast.service';
import { SearchBarComponent } from './components/search-bar.component';
import { DictNodeComponent } from './components/dict-node.component';
import { EditorRequest, NodeEditorComponent } from './components/node-editor.component';
import { TransferDialogComponent, TransferMode } from './components/transfer-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    SearchBarComponent,
    DictNodeComponent,
    NodeEditorComponent,
    TransferDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <div class="brand">
        <span class="dot">📚</span>
        <span class="t">القاموس التقني<small>مرجعك الشخصي</small></span>
      </div>

      <app-search-bar />

      <div class="hdr-actions">
        <button class="icon-btn" title="استيراد ملف Word أو JSON" (click)="transfer.set('import')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="M12 3v13" /><path d="m7 11 5 5 5-5" />
          </svg>
        </button>
        <button class="icon-btn" title="تصدير نسخة احتياطية" (click)="transfer.set('export')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="M12 16V3" /><path d="m7 8 5-5 5 5" />
          </svg>
        </button>
        <button class="icon-btn" title="تبديل المظهر" (click)="store.toggleTheme()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        </button>
      </div>
    </header>

    <div class="shell">
      <aside>
        <div class="cat-list">
          @for (cat of store.categories(); track cat.id) {
            <button class="cat" [class.on]="cat.id === store.activeCategory()?.id"
                    [style.--c]="cat.color" (click)="store.selectCategory(cat.id)">
              <span class="em">{{ cat.icon }}</span>
              <span style="min-width:0;flex:1">
                <b>{{ cat.title }}</b>
                <span>{{ cat.subtitle }}</span>
              </span>
              <span class="n">{{ store.countDescendants(cat) }}</span>
            </button>
          }
          <button class="cat" style="--c:var(--fg-3)" (click)="addCategory()">
            <span class="em">＋</span>
            <span style="flex:1">
              <b style="font-weight:600;color:var(--fg-2)">قسم رئيسي جديد</b>
            </span>
          </button>
        </div>

        <div class="side-h">محتويات القسم</div>
        <nav class="outline">
          @for (n of store.activeCategory()?.children ?? []; track n.id) {
            <a href="#" (click)="jump($event, n.id)">{{ n.title }}</a>
            @for (k of n.children; track k.id) {
              <a class="d1" href="#" (click)="jump($event, k.id)">{{ k.title }}</a>
            }
          } @empty {
            <div style="padding:8px 12px;color:var(--fg-3);font-size:12.5px">لا عناصر بعد</div>
          }
        </nav>
      </aside>

      <main>
        @if (store.activeCategory(); as cat) {
          <div class="cat-head">
            <div class="big" [style.--c]="cat.color">{{ cat.icon }}</div>
            <div style="min-width:0">
              <h1>{{ cat.title }}</h1>
              <p>{{ cat.subtitle }} · {{ store.countDescendants(cat) }} عنصر</p>
            </div>
            <div class="sp"></div>
            <div class="toolbar">
              <button class="btn primary" (click)="openEditor({ nodeId: null, parentId: cat.id })">
                ＋ عنوان رئيسي
              </button>
              <button class="btn sm ghost" (click)="store.setAllOpen(true)">فتح الكل</button>
              <button class="btn sm ghost" (click)="store.setAllOpen(false)">طي الكل</button>
              <button class="btn sm ghost" title="تعديل القسم"
                      (click)="openEditor({ nodeId: cat.id })">✎</button>
            </div>
          </div>

          <div [style.--c]="cat.color">
            @for (node of cat.children; track node.id) {
              <app-dict-node [node]="node" [depth]="0"
                             (add)="openEditor({ nodeId: null, parentId: $event })"
                             (edit)="openEditor({ nodeId: $event })"
                             (remove)="confirmDelete($event)" />
            } @empty {
              <div class="empty">
                <span class="e">{{ cat.icon }}</span>
                <b>«{{ cat.title }}» فارغ</b>
                ابدأ بإضافة عنوان رئيسي، أو استورد ملف Word / نسخة JSON من الأعلى
                <div style="margin-top:16px">
                  <button class="btn primary"
                          (click)="openEditor({ nodeId: null, parentId: cat.id })">
                    ＋ عنوان رئيسي
                  </button>
                </div>
              </div>
            }

            @if (cat.children.length) {
              <button class="add-here" style="margin-top:10px;padding:12px"
                      (click)="openEditor({ nodeId: null, parentId: cat.id })">
                ＋ إضافة عنوان رئيسي في «{{ cat.title }}»
              </button>
            }
          </div>
        } @else {
          <div class="empty">
            <span class="e">📁</span>
            <b>لا توجد أقسام</b>
            أضف قسماً رئيسياً من القائمة الجانبية
          </div>
        }
      </main>
    </div>

    @if (editor(); as req) {
      <app-node-editor [request]="req" (close)="editor.set(null)" (saved)="afterSave($event)" />
    }

    @if (transfer(); as mode) {
      <app-transfer-dialog [mode]="mode" (close)="transfer.set(null)" />
    }

    @if (pendingDelete(); as id) {
      <div class="overlay open" (click)="cancelDelete($event)">
        <div class="modal">
          <div class="m-h">
            <h3>تأكيد الحذف</h3>
            <button class="icon-btn" (click)="pendingDelete.set(null)">✕</button>
          </div>
          <div class="m-b">
            <p style="margin:0">
              سيتم حذف <b>«{{ deleteTitle() }}»</b>
              @if (deleteCount()) { مع <b>{{ deleteCount() }}</b> عنصراً بداخله }
              نهائياً.
            </p>
            <div class="note">💡 لا يمكن التراجع. إن كنت غير متأكد، صدّر نسخة احتياطية أولاً.</div>
          </div>
          <div class="m-f">
            <button class="btn ghost" (click)="pendingDelete.set(null)">إلغاء</button>
            <button class="btn danger" (click)="doDelete(id)">نعم، احذف</button>
          </div>
        </div>
      </div>
    }

    <div class="toast" [class.show]="!!toast.message()">{{ toast.message() }}</div>
  `,
})
export class AppComponent {
  protected readonly store = inject(DictionaryStore);
  protected readonly toast = inject(ToastService);

  protected readonly editor = signal<EditorRequest | null>(null);
  protected readonly transfer = signal<TransferMode | null>(null);
  protected readonly pendingDelete = signal<string | null>(null);

  protected openEditor(req: EditorRequest): void {
    this.editor.set(req);
  }

  protected addCategory(): void {
    const cat = this.store.addCategory();
    this.openEditor({ nodeId: cat.id });
  }

  protected afterSave(nodeId: string): void {
    this.editor.set(null);
    this.scrollToNode(nodeId);
  }

  protected jump(e: Event, id: string): void {
    e.preventDefault();
    this.store.revealNode(id);
    this.scrollToNode(id);
  }

  /** ننتظر إعادة الرسم قبل القياس، ثم نُبرز العقدة لحظياً */
  private scrollToNode(id: string): void {
    requestAnimationFrame(() => {
      const el = document.getElementById(`node-${id}`);
      if (!el) return;
      scrollTo({ top: el.getBoundingClientRect().top + scrollY - 88, behavior: 'smooth' });
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1700);
    });
  }

  // ---------- الحذف ----------

  protected confirmDelete(id: string): void {
    this.pendingDelete.set(id);
  }

  protected deleteTitle(): string {
    const id = this.pendingDelete();
    return id ? this.store.find(id)?.node.title ?? '' : '';
  }

  protected deleteCount(): number {
    const id = this.pendingDelete();
    const node = id ? this.store.find(id)?.node : null;
    return node ? this.store.countDescendants(node) : 0;
  }

  protected cancelDelete(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('overlay')) this.pendingDelete.set(null);
  }

  protected doDelete(id: string): void {
    this.store.deleteNode(id);
    this.pendingDelete.set(null);
    this.toast.show('تم الحذف');
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.editor.set(null);
    this.transfer.set(null);
    this.pendingDelete.set(null);
  }
}
