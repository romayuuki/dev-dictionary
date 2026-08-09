/** مثال كود مرفق بعقدة */
export interface Example {
  title: string;
  lang: string;
  code: string;
}

/** عقدة في الشجرة — قد تكون عنواناً رئيسياً أو قسماً بداخله، بأي عمق */
export interface DictNode {
  id: string;
  title: string;
  def: string;
  tags: string[];
  examples: Example[];
  children: DictNode[];
}

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
