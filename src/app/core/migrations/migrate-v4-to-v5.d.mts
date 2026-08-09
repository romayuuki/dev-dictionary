import type { DictData } from '../../models/dict.model';

/** خريطة تحويل المعرّفات القديمة → الجديدة (SPEC-001 REQ-3.3) */
export declare const ID_MAP_V4_V5: Record<string, string>;

/**
 * يُرحّل بيانات v4 إلى v5 (SPEC-001). نقيّة، idempotent، لا ترمي استثناءً.
 * تُعيد `data` كما هي إن كانت v5 بالفعل أو لم تحتوِ العُقَد المتوقَّعة.
 */
export declare function migrateV4ToV5(data: DictData): DictData;
