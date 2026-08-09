import { Injectable, computed, signal } from '@angular/core';
import {
  Category,
  DictData,
  DictNode,
  DEFAULT_CATEGORIES,
  emptyNode,
  uid,
} from '../models/dict.model';

const LS_DATA = 'dev-dictionary-v1';
const LS_UI = 'dev-dictionary-ui-v1';

interface UiState {
  theme: 'light' | 'dark';
  catId: string;
  open: string[];
}

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

  constructor() {
    this._open.set(new Set(this._ui().open));
    this.applyTheme();
  }

  // ---------- التخزين ----------

  private loadData(): DictData {
    try {
      const raw = localStorage.getItem(LS_DATA);
      if (raw) {
        const parsed = JSON.parse(raw) as DictData;
        if (Array.isArray(parsed?.categories)) return parsed;
      }
    } catch {
      /* بيانات تالفة — نتجاهلها ونبدأ من الافتراضي */
    }
    return { version: 1, updatedAt: '', categories: deepClone(DEFAULT_CATEGORIES) };
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
    this.touch();
    this.persistUi();
    return node;
  }

  updateNode(id: string, payload: Partial<DictNode | Category>): void {
    const loc = this.find(id);
    if (!loc) return;
    Object.assign(loc.node, payload);
    this.touch();
  }

  deleteNode(id: string): void {
    const loc = this.find(id);
    if (!loc) return;

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

  appendToCategory(catId: string, nodes: DictNode[]): number {
    const cat = this.categories().find((c) => c.id === catId);
    if (!cat) throw new Error('لم يُحدَّد قسم');
    cat.children = [...(cat.children ?? []), ...nodes];
    let count = 0;
    this.walk(nodes, () => count++);
    this.touch();
    return count;
  }

  toJson(): string {
    return JSON.stringify(this._data(), null, 2);
  }
}
