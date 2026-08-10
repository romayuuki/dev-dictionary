import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  Category,
  DictData,
  DictNode,
  DEFAULT_CATEGORIES,
  emptyNode,
  uid,
} from '../models/dict.model';
import { SupabaseService } from './supabase.service';
// migrateToLatest تُشغّل سلسلة الترحيلات كاملة (v4→v5→v6) — لا تستدعِ ترحيلاً مفرداً
import { migrateToLatest } from './migrations/migrate-v4-to-v5.mjs';
import { planMerge, dedupeTree, MergeReport } from './merge.service';

const LS_DATA = 'dev-dictionary-v1';
const LS_UI = 'dev-dictionary-ui-v1';
/** نسخة قبل آخر دمج/تنظيف — تسمح بالتراجع خلال مهلة قصيرة (SPEC-003 §3.5) */
const LS_UNDO_IMPORT = 'dev-dictionary-v1-undo-import';
/** مهلة صلاحية التراجع بالمللي ثانية — بعدها يُتجاهل أي snapshot متبقٍّ */
const UNDO_WINDOW_MS = 60_000;

/** رقم الإصدار الحالي لبنية البيانات (SPEC-001 §4.3 / §6.2) — v6 يضيف محتوى React */
const DATA_VERSION = 6;
/** نسخة احتياطية تُكتب قبل أي ترحيل — لا يُكتب فوقها أبداً بعد ذلك */
const LS_BACKUP_V4 = 'dev-dictionary-v1-backup-v4';

interface UiState {
  theme: 'light' | 'dark';
  catId: string;
  open: string[];
}

/** أعلى/أسفل: تبادل مع شقيق. أدخِل: تصير ابناً للشقيق السابق. أخرِج: تصير شقيقاً لأبيها (SPEC-003 §4) */
export type MoveDir = 'up' | 'down' | 'in' | 'out';

export interface NodeLocation {
  node: DictNode;
  parent: DictNode | null;
  cat: Category;
  path: DictNode[];
  isCategory: boolean;
}

const deepClone = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

/**
 * مصدر الحقيقة الوحيد للقاموس. كل التعديلات تمرّ من هنا وتُحفظ فوراً
 * في localStorage، والواجهة تتفاعل عبر signals.
 */
@Injectable({ providedIn: 'root' })
export class DictionaryStore {
  private readonly supabase = inject(SupabaseService);
  private readonly http     = inject(HttpClient);
  private readonly _data = signal<DictData>(this.loadData());
  private readonly _ui = signal<UiState>(this.loadUi());
  private readonly _open = signal<Set<string>>(new Set());

  readonly data = this._data.asReadonly();
  readonly categories = computed(() => this._data().categories);
  readonly theme = computed(() => this._ui().theme);
  readonly openIds = this._open.asReadonly();

  readonly activeCategory = computed<Category | undefined>(() => {
    const cats = this.categories();
    return cats.find((c) => c.id === this._ui().catId) ?? cats[0];
  });

  /** يمنع صدى الحفظ عند استقبال تحديث من جهاز/نافذة أخرى عبر Realtime */
  private applyingRemoteUpdate = false;

  constructor() {
    this._open.set(new Set(this._ui().open));
    this.applyTheme();
    // عند غياب بيانات محلية: احمّل البذرة من assets قبل محاولة Supabase
    if (!localStorage.getItem(LS_DATA)) {
      void this.seedFromAssets().then(() => this.syncFromSupabase()).then(() => this.subscribeToRealtime());
    } else {
      // حاول التحديث من Supabase بشكل غير متزامن، ثم اشترك في التغييرات اللحظية
      this.syncFromSupabase().then(() => this.subscribeToRealtime());
    }
  }

  /**
   * يُحمَّل ملف assets/data-seed.json (مُولَّد بواسطة tools/migrate-v4-to-v5.mjs)
   * كبيانات أولية لأي جهاز/متصفح جديد لا يحتوي بيانات محلية بعد.
   * البذر ليس تعديل مستخدم → يُحفَظ في localStorage فقط، لا يُرسَل لـ Supabase.
   */
  private async seedFromAssets(): Promise<void> {
    try {
      const raw = await firstValueFrom(
        this.http.get<DictData>('/assets/data-seed.json'),
      );
      if (!raw?.categories?.length) return;
      const seeded = (raw.version ?? 0) >= DATA_VERSION ? raw : migrateToLatest(raw);
      this._data.set(seeded);
      localStorage.setItem(LS_DATA, JSON.stringify(seeded));
    } catch {
      /* لا ملف seed — يبدأ فارغاً، المستخدم يُضيف محتوى يدوياً */
    }
  }

  /** يبقي اللوكل ونسخة الموقع المنشور متزامنين لحظياً في كلا الاتجاهين */
  private subscribeToRealtime(): void {
    this.supabase.subscribeToChanges((remoteData) => {
      if (!remoteData || !Array.isArray(remoteData.categories)) return;
      const next = (remoteData.version ?? 0) < DATA_VERSION ? migrateToLatest(remoteData) : remoteData;
      if (JSON.stringify(next) === JSON.stringify(this._data())) return;

      this.applyingRemoteUpdate = true;
      this._data.set(next);
      try {
        localStorage.setItem(LS_DATA, JSON.stringify(next));
      } catch {
        /* تجاهل — التحديث اللحظي أهم من نجاح الكاش المحلي */
      }
      this.applyingRemoteUpdate = false;
    });
  }

  // ---------- التخزين ----------

  /**
   * يقرأ بيانات المستخدم، ويُرحّلها تلقائياً إن كانت أقدم من DATA_VERSION (SPEC-001 REQ-4.3).
   * قبل الترحيل تُكتب نسخة احتياطية خام لا تُستبدَل لاحقاً (§6.2) — للتراجع الكامل عند الحاجة.
   */
  private loadData(): DictData {
    try {
      const raw = localStorage.getItem(LS_DATA);
      if (raw) {
        const parsed = JSON.parse(raw) as DictData;
        if (Array.isArray(parsed?.categories)) {
          if ((parsed.version ?? 0) >= DATA_VERSION) return parsed;

          try {
            if (!localStorage.getItem(LS_BACKUP_V4)) {
              localStorage.setItem(LS_BACKUP_V4, raw);
            }
          } catch {
            /* فشل الحفظ الاحتياطي لا يوقف الترحيل — لكنه يُسجَّل */
            console.warn('تعذّر حفظ نسخة احتياطية قبل الترحيل');
          }

          const migrated = migrateToLatest(parsed);
          try {
            localStorage.setItem(LS_DATA, JSON.stringify(migrated));
          } catch {
            /* لا حرج — persist() اللاحق سيعيد المحاولة */
          }
          return migrated;
        }
      }
    } catch {
      /* بيانات تالفة — نتجاهلها ونبدأ من الافتراضي */
    }
    return { version: DATA_VERSION, updatedAt: '', categories: deepClone(DEFAULT_CATEGORIES) };
  }

  private loadUi(): UiState {
    const fallback: UiState = {
      theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      catId: '',
      open: [],
    };
    try {
      return { ...fallback, ...JSON.parse(localStorage.getItem(LS_UI) ?? '{}') };
    } catch {
      return fallback;
    }
  }

  /** يُستدعى بعد كل تعديل على الشجرة */
  private persist(): void {
    this._data.update((d) => ({ ...d, updatedAt: new Date().toISOString().slice(0, 10) }));
    try {
      localStorage.setItem(LS_DATA, JSON.stringify(this._data()));
    } catch {
      throw new Error('تعذّر الحفظ المحلي — المساحة ممتلئة');
    }
    // لا تعيد الحفظ في Supabase إن كان هذا التحديث قادماً من هناك أصلاً
    if (!this.applyingRemoteUpdate) this.persistToSupabase();
  }

  /** احفظ البيانات في Supabase بدون انتظار */
  private persistToSupabase(): void {
    this.supabase.saveData(this._data()).catch((err) => {
      console.warn('تعذّر الحفظ البعيد:', err);
    });
  }

  /** حمّل البيانات من Supabase عند بدء التطبيق */
  private async syncFromSupabase(): Promise<void> {
    const { data, error } = await this.supabase.loadData();
    if (error) {
      console.warn('تعذّرت مزامنة Supabase:', error);
      return;
    }
    if (!data || !Array.isArray(data?.categories)) return;

    const needsMigration = (data.version ?? 0) < DATA_VERSION;
    const next = needsMigration ? migrateToLatest(data) : data;
    this._data.set(next);

    // البيانات البعيدة كانت أقدم → ثبّت النتيجة محلياً وبعيداً حتى لا يتكرر
    // الترحيل في كل تحميل، وحتى تصل النسخة الجديدة لبقية الأجهزة.
    if (needsMigration) {
      try {
        localStorage.setItem(LS_DATA, JSON.stringify(next));
      } catch {
        /* الكاش المحلي ليس حرجاً */
      }
      this.persistToSupabase();
    }
  }

  private persistUi(): void {
    const ui: UiState = {
      ...this._ui(),
      catId: this.activeCategory()?.id ?? '',
      open: [...this._open()],
    };
    this._ui.set(ui);
    try {
      localStorage.setItem(LS_UI, JSON.stringify(ui));
    } catch {
      /* تفضيلات العرض ليست حرجة */
    }
  }

  /** إعادة إسناد المرجع حتى تلتقط الـ signals التغيير العميق */
  private touch(): void {
    this._data.update((d) => ({ ...d, categories: [...d.categories] }));
    this.persist();
  }

  // ---------- المظهر والتنقّل ----------

  toggleTheme(): void {
    this._ui.update((u) => ({ ...u, theme: u.theme === 'dark' ? 'light' : 'dark' }));
    this.applyTheme();
    this.persistUi();
  }

  private applyTheme(): void {
    document.documentElement.dataset['theme'] = this._ui().theme;
  }

  selectCategory(id: string): void {
    this._ui.update((u) => ({ ...u, catId: id }));
    this.persistUi();
  }

  isOpen(id: string): boolean {
    return this._open().has(id);
  }

  toggleOpen(id: string): void {
    this._open.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    this.persistUi();
  }

  /** يفتح العقدة وكل آبائها — يُستخدم بعد اختيار نتيجة بحث */
  revealNode(id: string): void {
    const loc = this.find(id);
    if (!loc) return;
    this.selectCategory(loc.cat.id);
    this._open.update((set) => {
      const next = new Set(set);
      loc.path.forEach((p) => next.add(p.id));
      next.add(id);
      return next;
    });
    this.persistUi();
  }

  setAllOpen(open: boolean): void {
    const next = new Set<string>();
    if (open) {
      const cat = this.activeCategory();
      if (cat) this.walk(cat.children, (n) => next.add(n.id));
    }
    this._open.set(next);
    this.persistUi();
  }

  // ---------- الاستعلام ----------

  walk(nodes: DictNode[], fn: (n: DictNode, path: DictNode[]) => void, path: DictNode[] = []): void {
    for (const n of nodes ?? []) {
      fn(n, path);
      this.walk(n.children ?? [], fn, [...path, n]);
    }
  }

  countDescendants(node: DictNode): number {
    let c = 0;
    this.walk(node.children ?? [], () => c++);
    return c;
  }

  find(id: string): NodeLocation | null {
    for (const cat of this.categories()) {
      if (cat.id === id) {
        return { node: cat, parent: null, cat, path: [], isCategory: true };
      }
      const dig = (arr: DictNode[], parent: DictNode, path: DictNode[]): NodeLocation | null => {
        for (const n of arr ?? []) {
          if (n.id === id) return { node: n, parent, cat, path, isCategory: false };
          const hit = dig(n.children ?? [], n, [...path, n]);
          if (hit) return hit;
        }
        return null;
      };
      const hit = dig(cat.children ?? [], cat, []);
      if (hit) return hit;
    }
    return null;
  }

  // ---------- التعديل ----------

  addChild(parentId: string, payload: Partial<DictNode>): DictNode | null {
    const target = this.find(parentId);
    if (!target) return null;

    const node: DictNode = { ...emptyNode(), ...payload, id: uid(), children: [] };
    target.node.children = [...(target.node.children ?? []), node];

    this._open.update((set) => new Set(set).add(parentId).add(node.id));
    this.clearUndoSnapshot();
    this.touch();
    this.persistUi();
    return node;
  }

  updateNode(id: string, payload: Partial<DictNode | Category>): void {
    const loc = this.find(id);
    if (!loc) return;
    Object.assign(loc.node, payload);
    this.clearUndoSnapshot();
    this.touch();
  }

  deleteNode(id: string): void {
    const loc = this.find(id);
    if (!loc) return;
    this.clearUndoSnapshot();

    if (loc.isCategory) {
      this._data.update((d) => ({ ...d, categories: d.categories.filter((c) => c.id !== id) }));
      this.selectCategory(this.categories()[0]?.id ?? '');
    } else if (loc.parent) {
      loc.parent.children = loc.parent.children.filter((n) => n.id !== id);
    }

    this._open.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
    this.touch();
  }

  // ---------- إعادة الترتيب (SPEC-003 §4) ----------

  /** معلومات الموضع الحالي لعقدة — بلا أي تعديل، تُستخدم داخلياً وللتحقق من إمكانية الحركة */
  private locateForMove(
    id: string,
  ): { siblings: DictNode[]; idx: number; parentNode: DictNode; grandparent: DictNode | null } | null {
    const loc = this.find(id);
    if (!loc || loc.isCategory || !loc.parent) return null;
    const siblings = loc.parent.children ?? [];
    const idx = siblings.findIndex((n) => n.id === id);
    if (idx === -1) return null;

    // path يتضمّن الأب نفسه عندما العمق ≥ 1 (انظر بناء dig() في find()) —
    // فالجدّ هو ما قبل الأخير في path، أو القسم نفسه عندما العمق = 1، أو لا جدّ عند العمق = 0
    const grandparent =
      loc.path.length >= 2 ? loc.path[loc.path.length - 2] : loc.path.length === 1 ? loc.cat : null;

    return { siblings, idx, parentNode: loc.parent, grandparent };
  }

  /** هل عملية الحركة ممكنة الآن؟ — لتعطيل الأزرار بصرياً (SPEC-003 AC-2.3) */
  canMove(id: string, dir: MoveDir): boolean {
    const info = this.locateForMove(id);
    if (!info) return false;
    switch (dir) {
      case 'up':
        return info.idx > 0;
      case 'down':
        return info.idx < info.siblings.length - 1;
      case 'in':
        return info.idx > 0;
      case 'out':
        return info.grandparent !== null;
      default:
        return false;
    }
  }

  /**
   * ينفّذ حركة واحدة بسيطة على عقدة. لا يحذف ولا يفقد أي ابن — العقدة تنتقل بكامل شجرتها.
   * يُعيد false بأمان إن كانت الحركة غير ممكنة، دون أي تعديل (SPEC-003 AC-2.1/2.2).
   */
  moveNode(id: string, dir: MoveDir): boolean {
    if (!this.canMove(id, dir)) return false;
    const info = this.locateForMove(id);
    if (!info) return false;
    const { siblings, idx, parentNode, grandparent } = info;

    if (dir === 'up') {
      [siblings[idx - 1], siblings[idx]] = [siblings[idx], siblings[idx - 1]];
    } else if (dir === 'down') {
      [siblings[idx + 1], siblings[idx]] = [siblings[idx], siblings[idx + 1]];
    } else if (dir === 'in') {
      const newParent = siblings[idx - 1];
      const [node] = siblings.splice(idx, 1);
      newParent.children = [...(newParent.children ?? []), node];
      newParent.kind = 'group';
      this._open.update((set) => new Set(set).add(newParent.id));
    } else if (dir === 'out') {
      const [node] = siblings.splice(idx, 1);
      const gp = grandparent!;
      gp.children = gp.children ?? [];
      const parentIdxInGp = gp.children.findIndex((n) => n.id === parentNode.id);
      gp.children.splice(parentIdxInGp + 1, 0, node);
    }

    this.clearUndoSnapshot();
    this.touch();
    return true;
  }

  /**
   * ينقل عقدة لتصبح ابناً لعقدة أخرى في أي مكان بالشجرة — يُستخدم من نافذة
   * «نقل إلى…» ومن السحب والإفلات. محميّ من الحلقات (SPEC-003 §4.2).
   */
  moveToParent(id: string, parentId: string, index?: number): boolean {
    if (id === parentId) return false;
    const nodeLoc = this.find(id);
    const targetLoc = this.find(parentId);
    if (!nodeLoc || nodeLoc.isCategory || !nodeLoc.parent || !targetLoc) return false;

    // حماية من الحلقات: الهدف يجب ألا يكون داخل ذرّية العقدة المنقولة أو العقدة نفسها
    let isCycle = false;
    this.walk(nodeLoc.node.children ?? [], (n) => {
      if (n.id === parentId) isCycle = true;
    });
    if (isCycle) return false;

    const oldSiblings = nodeLoc.parent.children ?? [];
    const oldIdx = oldSiblings.findIndex((n) => n.id === id);
    if (oldIdx === -1) return false;

    const [node] = oldSiblings.splice(oldIdx, 1);
    targetLoc.node.children = targetLoc.node.children ?? [];
    const newSiblings = targetLoc.node.children;
    const insertAt = index === undefined ? newSiblings.length : Math.max(0, Math.min(index, newSiblings.length));
    newSiblings.splice(insertAt, 0, node);
    if (newSiblings.length) targetLoc.node.kind = 'group';

    this.clearUndoSnapshot();
    this.touch();
    return true;
  }

  /**
   * يضع عقدة قبل beforeId مباشرة (كأخوين تحت نفس أب beforeId) — الأداة التي
   * يستخدمها السحب والإفلات لإعادة الترتيب البصري (SPEC-003 §4.3).
   */
  moveBefore(id: string, beforeId: string): boolean {
    if (id === beforeId) return false;
    const targetLoc = this.find(beforeId);
    if (!targetLoc || !targetLoc.parent) return false;
    const idx = targetLoc.parent.children.findIndex((n) => n.id === beforeId);
    if (idx === -1) return false;
    return this.moveToParent(id, targetLoc.parent.id, idx);
  }

  addCategory(): Category {
    const cat: Category = {
      ...emptyNode(),
      title: 'قسم جديد',
      subtitle: '',
      icon: '📁',
      color: '#5b5bd6',
    };
    this._data.update((d) => ({ ...d, categories: [...d.categories, cat] }));
    this.selectCategory(cat.id);
    this.persist();
    return cat;
  }

  // ---------- الاستيراد / التصدير ----------

  replaceAll(data: DictData): void {
    if (!Array.isArray(data?.categories)) throw new Error('ملف غير صالح');
    this._data.set(data);
    this._open.set(new Set());
    this.persist();
    this.persistUi();
  }

  /** @deprecated استخدم mergeIntoCategory — تُبقيها متاحة لأي كود قديم يستدعيها مباشرة */
  appendToCategory(catId: string, nodes: DictNode[]): number {
    const cat = this.categories().find((c) => c.id === catId);
    if (!cat) throw new Error('لم يُحدَّد قسم');
    cat.children = [...(cat.children ?? []), ...nodes];
    let count = 0;
    this.walk(nodes, () => count++);
    this.touch();
    return count;
  }

  // ---------- الدمج الذكي (SPEC-003 §3) ----------

  /**
   * معاينة بلا أي تعديل فعلي — نقيّة تماماً، لبناء نافذة التأكيد قبل الاستيراد.
   * آمنة للاستدعاء من الواجهة في كل ضغطة زر دون أي أثر جانبي.
   */
  previewMerge(catId: string, nodes: DictNode[]): MergeReport {
    const cat = this.categories().find((c) => c.id === catId);
    if (!cat) throw new Error('لم يُحدَّد قسم');
    return planMerge(cat.children ?? [], nodes).report;
  }

  /**
   * يطبّق الدمج فعلياً بعد موافقة المستخدم على المعاينة (SPEC-003 §3.3).
   * لا يحذف عقدة أبداً — إمّا يُضيف عقدة جديدة أو يُثري عقدة مطابقة بالعنوان.
   */
  mergeIntoCategory(catId: string, nodes: DictNode[]): MergeReport {
    const cat = this.categories().find((c) => c.id === catId);
    if (!cat) throw new Error('لم يُحدَّد قسم');

    this.snapshotForUndo();
    const { result, report } = planMerge(cat.children ?? [], nodes);
    cat.children = result;
    this.touch();
    return report;
  }

  /**
   * استعادة نسخة JSON كاملة (تصدير سابق) — استبدال شامل، لذا يُحفَظ snapshot
   * للتراجع تماماً كما في الدمج. تُستخدم من واجهة الاستيراد بعد تأكيد صريح من المستخدم.
   */
  restoreFromJson(data: DictData): void {
    if (!Array.isArray(data?.categories)) throw new Error('ملف غير صالح');
    this.snapshotForUndo();
    this.replaceAll(data);
  }

  /**
   * يزيل تكراراً وقع سابقاً (قبل تفعيل الدمج الذكي) بدمج الأشقاء متطابقي العنوان
   * تعاودياً بأي عمق — مثال: قسمان اسمهما "React" تحت نفس الأب.
   */
  dedupeCategory(catId: string): MergeReport {
    const cat = this.categories().find((c) => c.id === catId);
    if (!cat) throw new Error('لم يُحدَّد قسم');

    this.snapshotForUndo();
    const { result, report } = dedupeTree(cat.children ?? []);
    cat.children = result;
    this.touch();
    return report;
  }

  private snapshotForUndo(): void {
    try {
      localStorage.setItem(LS_UNDO_IMPORT, JSON.stringify({ at: Date.now(), data: this._data() }));
    } catch {
      /* التراجع ميزة مساعدة — فشل حفظه لا يوقف عملية الدمج نفسها */
    }
  }

  /** أي تعديل يدوي بعد دمج/تنظيف يُبطل التراجع — تجنّباً لاستعادة تتجاهل تعديلاً لاحقاً */
  private clearUndoSnapshot(): void {
    try {
      localStorage.removeItem(LS_UNDO_IMPORT);
    } catch {
      /* غير حرج */
    }
  }

  /** هل توجد نسخة تراجع صالحة الآن؟ — تُستخدم لإظهار/إخفاء زر «تراجع» */
  canUndoImport(): boolean {
    try {
      const raw = localStorage.getItem(LS_UNDO_IMPORT);
      if (!raw) return false;
      const snap = JSON.parse(raw) as { at: number };
      return Date.now() - snap.at < UNDO_WINDOW_MS;
    } catch {
      return false;
    }
  }

  /** يستعيد الحالة كما كانت قبل آخر دمج/تنظيف، إن كانت النافذة الزمنية لم تنتهِ بعد */
  undoLastImport(): boolean {
    try {
      const raw = localStorage.getItem(LS_UNDO_IMPORT);
      if (!raw) return false;
      const snap = JSON.parse(raw) as { at: number; data: DictData };
      localStorage.removeItem(LS_UNDO_IMPORT);
      if (Date.now() - snap.at >= UNDO_WINDOW_MS) return false;
      this.replaceAll(snap.data);
      return true;
    } catch {
      return false;
    }
  }

  toJson(): string {
    return JSON.stringify(this._data(), null, 2);
  }
}
