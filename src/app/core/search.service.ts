import { Injectable, inject } from '@angular/core';
import { DictNode, MatchField, SearchHit, nodeKind } from '../models/dict.model';
import { DictionaryStore } from './dictionary.store';
import { escapeHtml, expandSynonyms, highlight, norm, stripRefLinks } from './text.util';

/** أوزان المطابقة — العنوان أهم من الوسوم، والوسوم أهم من التعريف */
const WEIGHTS: Record<MatchField | 'titlePrefix', number> = {
  titlePrefix: 100,
  title: 60,
  tags: 40,
  def: 20,
  code: 10,
};

/** أي مصطلح لا يطابق إطلاقاً يُسقط النتيجة بالكامل (بحث AND وليس OR) */
const MISS_PENALTY = 1000;
const MAX_RESULTS = 40;
/** ترجيح العقدة الطرفية (SPEC-002 REQ-3.1) — تجعل المصطلح الذرّي يتفوّق على أبيه المُجمِّع */
const LEAF_BOOST = 15;

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly store = inject(DictionaryStore);

  search(query: string): SearchHit[] {
    const normalized = norm(query);
    if (!normalized) return [];

    const terms = expandSynonyms(normalized).split(' ').filter(Boolean);
    const hits: SearchHit[] = [];

    for (const cat of this.store.categories()) {
      const dig = (nodes: DictNode[], path: DictNode[]): void => {
        for (const node of nodes ?? []) {
          const haystack = {
            title: norm(node.title),
            // REQ-3.5 — aka تُفهرَس بوزن tags نفسه ولا تُعرض في الواجهة
            tags: norm([...(node.tags ?? []), ...(node.aka ?? [])].join(' ')),
            def: norm(node.def ?? ''),
            code: norm((node.examples ?? []).map((e) => `${e.title} ${e.code}`).join(' ')),
          };

          let score = 0;
          let where: MatchField | '' = '';

          for (const term of terms) {
            if (haystack.title.startsWith(term)) {
              score += WEIGHTS.titlePrefix;
              where ||= 'title';
            } else if (haystack.title.includes(term)) {
              score += WEIGHTS.title;
              where ||= 'title';
            } else if (haystack.tags.includes(term)) {
              score += WEIGHTS.tags;
              where ||= 'tags';
            } else if (haystack.def.includes(term)) {
              score += WEIGHTS.def;
              where ||= 'def';
            } else if (haystack.code.includes(term)) {
              score += WEIGHTS.code;
              where ||= 'code';
            } else {
              score -= MISS_PENALTY;
            }
          }

          // REQ-3.1 — ترجيح العقدة الطرفية (term) على العقدة المُجمِّعة (group)
          if (score > 0 && where && nodeKind(node) === 'term') score += LEAF_BOOST;

          if (score > 0 && where) hits.push({ node, cat, path, score, where });
          dig(node.children ?? [], [...path, node]);
        }
      };
      dig(cat.children ?? [], []);
    }

    return this.suppressAncestors(hits)
      .sort((a, b) => b.score - a.score || a.path.length - b.path.length) // REQ-3.4
      .slice(0, MAX_RESULTS);
  }

  /**
   * REQ-3.2/REQ-3.3 — إن طابق أبٌ وأحد أبنائه معاً وكانت نقاط الابن أعلى، تُسقَط نتيجة الأب،
   * إلا إذا طابق الأب في العنوان بينما طابق الابن في مكان أضعف (def/code) فقط.
   */
  private suppressAncestors(hits: SearchHit[]): SearchHit[] {
    const byId = new Map(hits.map((h) => [h.node.id, h]));
    const beaten = new Set<string>();

    for (const hit of hits) {
      for (const ancestor of hit.path) {
        const a = byId.get(ancestor.id);
        if (a && a.score < hit.score && !(a.where === 'title' && hit.where !== 'title')) {
          beaten.add(ancestor.id);
        }
      }
    }
    return hits.filter((h) => !beaten.has(h.node.id));
  }

  /**
   * هل النتيجة الأولى متفوّقة بوضوح؟ يُستخدم في البحث الصوتي لتقرير
   * الانتقال التلقائي بدل إجبار المستخدم على الاختيار.
   */
  isUnambiguous(hits: SearchHit[]): boolean {
    if (hits.length === 1) return true;
    if (hits.length < 2) return false;
    return hits[0].score - hits[1].score >= 30;
  }

  /** مقتطف حول موضع المطابقة، مع تلوينه */
  snippet(hit: SearchHit, query: string): string {
    const { node, where } = hit;

    if (where === 'def' || where === 'code') {
      const source =
        where === 'def' ? node.def ?? '' : (node.examples ?? []).map((e) => e.code).join('\n');
      const plain = stripRefLinks(source).replace(/\s+/g, ' ');
      const i = norm(plain).indexOf(norm(query));
      if (i >= 0) {
        const start = Math.max(0, i - 45);
        return (
          (start > 0 ? '…' : '') +
          highlight(plain.slice(start, start + 150), query) +
          (plain.length > start + 150 ? '…' : '')
        );
      }
    }

    const def = stripRefLinks(node.def ?? '').replace(/\s+/g, ' ');
    return escapeHtml(def.slice(0, 130)) + (def.length > 130 ? '…' : '');
  }

  highlightTitle(title: string, query: string): string {
    return highlight(title, query);
  }
}
