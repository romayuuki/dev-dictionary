import type { DictData } from '../../models/dict.model';

/** خريطة تحويل المعرّفات القديمة → الجديدة (SPEC-001 REQ-3.3) */
export declare const ID_MAP_V4_V5: Record<string, string>;

/**
 * يُرحّل بيانات v4 إلى v5 (SPEC-001). نقيّة، idempotent، لا ترمي استثناءً.
 * تُعيد `data` كما هي إن كانت v5 بالفعل أو لم تحتوِ العُقَد المتوقَّعة.
 */
export declare function migrateV4ToV5(data: DictData): DictData;

/**
 * يُرحّل بيانات v5 إلى v6 — يحقن محتوى React (اليوم الثامن) في `fe-fw`.
 * نقيّة، idempotent؛ تُعيد `data` كما هي إن كانت v6 بالفعل أو أقدم من v5.
 */
export declare function migrateV5ToV6(data: DictData): DictData;

/**
 * نقطة الدخول الموحَّدة — تُشغّل سلسلة الترحيلات بالترتيب (v4→v5→v6).
 * استخدمها دائماً بدل استدعاء ترحيل مفرد.
 */
export declare function migrateToLatest(data: DictData): DictData;
