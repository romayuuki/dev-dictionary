import { Injectable, inject } from '@angular/core';
import { DictNode, MatchField, SearchHit } from '../models/dict.model';
import { DictionaryStore } from './dictionary.store';
import { escapeHtml, expandSynonyms, highlight, norm } from './text.util';

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
            tags: norm((node.tags ?? []).join(' ')),
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

          if (score > 0 && where) hits.push({ node, cat, path, score, where });
          dig(node.children ?? [], [...path, node]);
        }
      };
      dig(cat.children ?? [], []);
    }

    return hits.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
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
      const plain = source.replace(/\s+/g, ' ');
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

    const def = (node.def ?? '').replace(/\s+/g, ' ');
    return escapeHtml(def.slice(0, 130)) + (def.length > 130 ? '…' : '');
  }

  highlightTitle(title: string, query: string): string {
    return highlight(title, query);
  }
}
