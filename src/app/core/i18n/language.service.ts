import { Injectable, signal, effect } from '@angular/core';
import { environment } from '../../../environments/environment';

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

  /** Pick the right side of a bilingual `BiText` based on current language. */
  pick(text: { en?: string; ar?: string; picked?: string } | null | undefined): string {
    if (!text) return '';
    if (text.picked) return text.picked;
    return this.language() === 'ar' ? (text.ar ?? text.en ?? '') : (text.en ?? text.ar ?? '');
  }

  private readStored(): Language {
    try {
      const v = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (v === 'en' || v === 'ar') return v;
    } catch { /* noop */ }
    return environment.defaultLanguage;
  }
}
