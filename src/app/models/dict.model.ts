/** مثال كود مرفق بعقدة */
export interface Example {
  title: string;
  lang: string;
  code: string;
}

/**
 * نوع العقدة (SPEC-001 §4.3):
 * 'group' — عقدة مُجمِّعة، تفسّر سبب اجتماع أبنائها ولا تُعرّف أحدهم.
 * 'term'  — عقدة طرفية (ذرّة): مفهوم واحد قابل للبحث بالاسم، ومعه مثال.
 */
export type NodeKind = 'group' | 'term';

/** عقدة في الشجرة — قد تكون عنواناً رئيسياً أو قسماً بداخله، بأي عمق */
export interface DictNode {
  id: string;
  title: string;
  def: string;
  tags: string[];
  examples: Example[];
  children: DictNode[];
  /** اختياري — غيابه يُستنتج من children.length (SPEC-001 §4.3) */
  kind?: NodeKind;
  /** اختياري — أسماء/نطق بديلة تُفهرَس للبحث فقط، لا تُعرض في الواجهة (SPEC-001 §4.3) */
  aka?: string[];
}

/** يستنتج kind الفعلي لعقدة عند غيابه — منطق موحّد (SPEC-001 §4.3) */
export const nodeKind = (node: Pick<DictNode, 'kind' | 'children'>): NodeKind =>
  node.kind ?? ((node.children?.length ?? 0) > 0 ? 'group' : 'term');

/** قسم رئيسي (Frontend / Backend / DevOps / UI-UX …) */
export interface Category extends DictNode {
  subtitle: string;
  icon: string;
  color: string;
}

export interface DictData {
  version: number;
  updatedAt: string;
  categories: Category[];
}

/** أين طابقت كلمة البحث — يُستخدم لترتيب النتائج وبناء المقتطف */
export type MatchField = 'title' | 'tags' | 'def' | 'code';

export interface SearchHit {
  node: DictNode;
  cat: Category;
  path: DictNode[];
  score: number;
  where: MatchField;
}

export const uid = (): string =>
  'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const emptyNode = (): DictNode => ({
  id: uid(),
  title: '',
  def: '',
  tags: [],
  examples: [],
  children: [],
});

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'frontend', title: 'Frontend', subtitle: 'واجهة المستخدم', icon: '🎨', color: '#6366f1', def: '', tags: [], examples: [], children: [] },
  { id: 'backend',  title: 'Backend',  subtitle: 'الخادم والبيانات', icon: '⚙️', color: '#0ea5e9', def: '', tags: [], examples: [], children: [] },
  { id: 'devops',   title: 'DevOps',   subtitle: 'البناء والنشر',   icon: '🚀', color: '#10b981', def: '', tags: [], examples: [], children: [] },
  { id: 'ui-ux',    title: 'UI / UX',  subtitle: 'التصميم والتجربة', icon: '✨', color: '#f59e0b', def: '', tags: [], examples: [], children: [] },
];
