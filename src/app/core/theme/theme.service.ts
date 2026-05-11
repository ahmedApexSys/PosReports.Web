import { Injectable, signal, effect } from '@angular/core';
import { environment } from '../../../environments/environment';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'pos-reports.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** User preference: light / dark / system. */
  readonly mode = signal<ThemeMode>(this.readStoredMode());

  /** Actually applied theme (resolves "system" to light or dark). */
  readonly resolved = signal<ResolvedTheme>('light');

  constructor() {
    // Watch system preference if mode = "system".
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => this.applyMode(this.mode());
    mediaQuery.addEventListener('change', apply);

    // React to mode changes — apply class + persist.
    effect(() => {
      const m = this.mode();
      this.applyMode(m);
      try { localStorage.setItem(STORAGE_KEY, m); } catch { /* noop */ }
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  cycle(): void {
    const current = this.mode();
    const next: ThemeMode =
      current === 'light' ? 'dark' :
      current === 'dark' ? 'system' : 'light';
    this.setMode(next);
  }

  private applyMode(mode: ThemeMode): void {
    const dark = mode === 'dark' ||
      (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const html = document.documentElement;
    html.classList.toggle('dark', dark);
    this.resolved.set(dark ? 'dark' : 'light');
  }

  private readStoredMode(): ThemeMode {
    try {
      const v = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (v === 'light' || v === 'dark' || v === 'system') return v;
    } catch { /* noop */ }
    return environment.defaultTheme;
  }
}
