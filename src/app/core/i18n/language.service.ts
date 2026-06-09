import { Injectable, signal, effect } from '@angular/core';
import { environment } from '../../../environments/environment';
import { biTextLabel } from './monitoring-labels';

export type Language = 'en' | 'ar';

const STORAGE_KEY = 'pos-reports.language';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly language = signal<Language>(this.readStored());

  constructor() {
    effect(() => {
      const lang = this.language();
      const html = document.documentElement;
      html.lang = lang;
      html.dir = lang === 'ar' ? 'rtl' : 'ltr';
      try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* noop */ }
    });
  }

  setLanguage(lang: Language): void {
    this.language.set(lang);
  }

  toggle(): void {
    this.setLanguage(this.language() === 'en' ? 'ar' : 'en');
  }

  /**
   * Pick the right side of a bilingual `BiText` based on the CURRENT client
   * language. We deliberately prefer the explicit `ar`/`en` side over the
   * server's `picked` field: some endpoints (the `/Insights` controllers)
   * return `picked` resolved to English regardless of the request's language,
   * which left whole reports in English. Preferring the client side fixes that
   * centrally AND makes the language toggle instant (no refetch). `picked` is
   * kept only as a last-resort fallback when a side is missing.
   */
  pick(text: { en?: string; ar?: string; picked?: string } | null | undefined): string {
    if (!text) return '';
    const ar = (text.ar ?? '').trim();
    const en = (text.en ?? '').trim();
    return this.language() === 'ar'
      ? biTextLabel(ar || en || (text.picked ?? ''), 'ar')
      : (en || ar || (text.picked ?? ''));
  }

  private readStored(): Language {
    try {
      const v = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (v === 'en' || v === 'ar') return v;
    } catch { /* noop */ }
    return environment.defaultLanguage;
  }
}
