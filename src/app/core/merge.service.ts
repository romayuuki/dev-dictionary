/**
 * SPEC-003 §3 — الدمج الذكي عند الاستيراد.
 *
 * قواعد صارمة (نفس روح migrate-v4-to-v5.mjs):
 *  - نقيّة (pure): planMerge/dedupeTree لا تُعدّلان مدخلهما، تُعيدان نسخة جديدة دائماً.
 *  - idempotent: تشغيل planMerge مرتين بنفس المُدخل الثاني يُعطي نفس الناتج بلا نمو إضافي.
 *  - لا حذف صامت أبداً — report.deleted ثابتة على 0 دائماً (ضمانة نوعية P1 في STORY-003).
 */

import { DictNode, uid } from '../models/dict.model';
import { norm } from './text.util';

export interface MergeEntry {
  /** المسار الظاهر للمستخدم، مثال: 'React › Component' */
  path: string;
  action: 'add' | 'merge';
  /** وصف مختصر لما تغيّر، مثال: '+2 مثال · +1 وسم' */
  detail: string;
}

export interface MergeReport {
  added: number;
  merged: number;
  /** ثابتة على 0 دائماً — لا تُحذف عقدة أبداً أثناء الدمج (مبدأ P1) */
  deleted: 0;
  entries: MergeEntry[];
}

const deepClone = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

/**
 * مفتاح تطابق العناوين — عنوانان "متساويان" إن تطابقا بعد التطبيع العربي
 * (نفس أداة التطبيع المستخدَمة في البحث) وحذف كل ما ليس حرفاً أو رقماً أو فراغاً.
 */
export function mergeKey(title: string): string {
  return norm(title)
    .replace(/[^\p{L}\p{N} ]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** بصمة مثال — نفس الكود لا يتكرر ولو اختلف عنوانه أو لغته المكتوبة بصيغة مختلفة */
const exampleKey = (code: string): string => norm(code).replace(/\s+/g, ' ').trim();

function mergeDef(existingDef: string, incomingDef: string): { def: string; changed: boolean } {
  const a = (existingDef ?? '').trim();
  const b = (incomingDef ?? '').trim();
  if (!b) return { def: a, changed: false };
  if (!a) return { def: b, changed: true };
  if (norm(a) === norm(b)) return { def: a, changed: false }; // نفس المحتوى فعلياً
  // لا يُستبدَل نصّ المستخدم أبداً — يُلحَق الوارد بعد فاصل واضح
  return { def: `${a}\n\n---\n\n${b}`, changed: true };
}

function mergeTags(existing: string[], incoming: string[]): { tags: string[]; added: number } {
  const seen = new Set((existing ?? []).map((t) => norm(t)));
  const out = [...(existing ?? [])];
  let added = 0;
  for (const t of incoming ?? []) {
    const k = norm(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    added++;
  }
  return { tags: out, added };
}

function mergeExamples(
  existing: DictNode['examples'],
  incoming: DictNode['examples'],
): { examples: DictNode['examples']; added: number } {
  const seen = new Set((existing ?? []).map((e) => exampleKey(e.code)));
  const out = [...(existing ?? [])];
  let added = 0;
  for (const ex of incoming ?? []) {
    const k = exampleKey(ex.code);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(ex);
    added++;
  }
  return { examples: out, added };
}

/** يبني نسخة جديدة من العقدة الواردة (معرّف جديد) — تُستخدم عند عدم وجود تطابق */
function cloneAsNew(node: DictNode): DictNode {
  const cloned = deepClone(node);
  const assignFreshIds = (n: DictNode): DictNode => ({
    ...n,
    id: uid(),
    children: (n.children ?? []).map(assignFreshIds),
  });
  return assignFreshIds(cloned);
}

/**
 * القلب النقي للدمج: يدمج incoming داخل existing تعاودياً حسب mergeKey(title).
 * يُعيد شجرة جديدة + تقرير. لا يُعدّل أياً من المدخلين.
 */
function mergeLevel(
  existing: DictNode[],
  incoming: DictNode[],
  parentPath: string,
  entries: MergeEntry[],
  counters: { added: number; merged: number },
): DictNode[] {
  const result = deepClone(existing ?? []);
  const byKey = new Map<string, DictNode>();
  for (const n of result) byKey.set(mergeKey(n.title), n);

  for (const incomingNode of incoming ?? []) {
    const key = mergeKey(incomingNode.title);
    const path = parentPath ? `${parentPath} › ${incomingNode.title}` : incomingNode.title;
    const match = key ? byKey.get(key) : undefined;

    if (!match) {
      const fresh = cloneAsNew(incomingNode);
      result.push(fresh);
      byKey.set(key, fresh);
      counters.added++;
      const kids = countAll(fresh.children ?? []);
      entries.push({
        path,
        action: 'add',
        detail: kids ? `${kids} عنصر فرعي` : 'عقدة جديدة',
      });
      continue;
    }

    // ── دمج في الموجود — معرّف match يبقى كما هو حتى لا تنكسر روابط [[id|نص]] ──
    const { def, changed: defChanged } = mergeDef(match.def, incomingNode.def);
    const { tags, added: tagsAdded } = mergeTags(match.tags, incomingNode.tags);
    const { examples, added: exAdded } = mergeExamples(match.examples, incomingNode.examples);

    match.def = def;
    match.tags = tags;
    match.examples = examples;
    match.children = mergeLevel(match.children ?? [], incomingNode.children ?? [], path, entries, counters);
    if ((match.children?.length ?? 0) > 0) match.kind = 'group';

    const parts: string[] = [];
    if (defChanged) parts.push('تعريف مُثرى');
    if (tagsAdded) parts.push(`+${tagsAdded} وسم`);
    if (exAdded) parts.push(`+${exAdded} مثال`);
    if (parts.length) {
      counters.merged++;
      entries.push({ path, action: 'merge', detail: parts.join(' · ') });
    }
  }

  return result;
}

function countAll(nodes: DictNode[]): number {
  let c = 0;
  for (const n of nodes ?? []) c += 1 + countAll(n.children ?? []);
  return c;
}

/**
 * نقطة الدخول — نقيّة تماماً، آمنة للاستدعاء لأجل معاينة فقط دون تطبيق.
 * idempotent: planMerge(result, incoming) بعد تطبيق مرة أولى لا يُنتج أي إضافة جديدة،
 * لأن العناوين نفسها ستُطابَق وتُدمَج بلا تغيير (mergeDef تكتشف التطابق النصّي فلا تُكرّر).
 */
export function planMerge(
  existing: DictNode[],
  incoming: DictNode[],
): { result: DictNode[]; report: MergeReport } {
  const entries: MergeEntry[] = [];
  const counters = { added: 0, merged: 0 };
  const result = mergeLevel(existing, incoming, '', entries, counters);
  return {
    result,
    report: { added: counters.added, merged: counters.merged, deleted: 0, entries },
  };
}

/**
 * يزيل التكرار من شجرة قائمة بدمج الأشقاء متطابقي العنوان مع بعضهم، تعاودياً بأي عمق.
 * يُستخدم لإصلاح تكرار وقع سابقاً (قبل تفعيل الدمج الذكي) — مثال: قسمان اسمهما "React".
 * نقيّة، idempotent: تشغيلها مرتين على نفس الشجرة يُعطي نفس النتيجة دون تغيير إضافي.
 */
export function dedupeTree(nodes: DictNode[]): { result: DictNode[]; report: MergeReport } {
  const entries: MergeEntry[] = [];
  const counters = { added: 0, merged: 0 };

  const dedupeLevel = (level: DictNode[], parentPath: string): DictNode[] => {
    const ordered: DictNode[] = [];
    const byKey = new Map<string, DictNode>();

    for (const raw of level ?? []) {
      const key = mergeKey(raw.title);
      const existingMatch = key ? byKey.get(key) : undefined;
      const path = parentPath ? `${parentPath} › ${raw.title}` : raw.title;

      if (!existingMatch) {
        const copy = deepClone(raw);
        ordered.push(copy);
        if (key) byKey.set(key, copy);
        continue;
      }

      // ادمج raw داخل existingMatch (الذي بقي في مكانه الأول ضمن ordered)
      const { def, changed: defChanged } = mergeDef(existingMatch.def, raw.def);
      const { tags, added: tagsAdded } = mergeTags(existingMatch.tags, raw.tags);
      const { examples, added: exAdded } = mergeExamples(existingMatch.examples, raw.examples);
      existingMatch.def = def;
      existingMatch.tags = tags;
      existingMatch.examples = examples;
      existingMatch.children = mergeLevel(
        existingMatch.children ?? [],
        raw.children ?? [],
        path,
        entries,
        counters,
      );
      if ((existingMatch.children?.length ?? 0) > 0) existingMatch.kind = 'group';

      counters.merged++;
      const parts = ['قسم مكرّر دُمج'];
      if (defChanged) parts.push('تعريف مُثرى');
      if (tagsAdded) parts.push(`+${tagsAdded} وسم`);
      if (exAdded) parts.push(`+${exAdded} مثال`);
      entries.push({ path, action: 'merge', detail: parts.join(' · ') });
    }

    for (const n of ordered) n.children = dedupeLevel(n.children ?? [], parentPath ? `${parentPath} › ${n.title}` : n.title);
    return ordered;
  };

  const result = dedupeLevel(nodes ?? [], '');
  return {
    result,
    report: { added: counters.added, merged: counters.merged, deleted: 0, entries },
  };
}
