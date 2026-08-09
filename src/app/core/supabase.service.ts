import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(environment.supabase.url, environment.supabase.anonKey);
  }

  /** احفظ البيانات في Supabase (insert أو update) */
  async saveData(data: any): Promise<{ success: boolean; error?: string }> {
    try {
      // نحاول القراءة أولاً للتحقق من وجود بيانات سابقة
      const { data: existing } = await this.client
        .from('dictionary')
        .select('id')
        .limit(1)
        .single();

      if (existing) {
        // إذا كانت موجودة، update
        const { error } = await this.client
          .from('dictionary')
          .update({ data, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        return { success: !error, error: error?.message };
      } else {
        // إذا لم تكن موجودة، insert
        const { error } = await this.client.from('dictionary').insert([{ data }]);
        return { success: !error, error: error?.message };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /** اقرأ البيانات من Supabase */
  async loadData(): Promise<{ data: any; error?: string }> {
    try {
      const { data, error } = await this.client
        .from('dictionary')
        .select('data')
        .limit(1)
        .maybeSingle();

      if (error) return { data: null, error: error.message };
      return { data: data?.data ?? null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }
}
