import { Injectable, signal } from '@angular/core';

/**
 * Coordinates every <app-picker> so that **at most one dropdown is open at a
 * time**. Each picker registers a unique token; opening one sets it as the
 * single "open" token, which reactively closes all the others.
 *
 * Why this exists: the old picker closed itself with a per-instance
 * `document` click listener, but the trigger called `stopPropagation()`, so
 * opening picker B never reached the document and never closed picker A — the
 * dropdowns stacked and overlapped (the filter-bar "three menus open at once"
 * bug). A single shared open-token makes overlap structurally impossible.
 *
 * One global document listener (registered here, once) closes everything on an
 * outside click or Escape; pickers stop propagation on their own interior so
 * inside-clicks don't bubble up and self-close.
 */
@Injectable({ providedIn: 'root' })
export class PickerHubService {
  /** Token of the currently-open picker, or null when all are closed. */
  readonly openToken = signal<symbol | null>(null);

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('click', () => this.openToken.set(null));
      document.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Escape') this.openToken.set(null);
      });
    }
  }

  /** Toggle a picker: open it (closing any other), or close it if already open. */
  toggle(token: symbol): void {
    this.openToken.set(this.openToken() === token ? null : token);
  }

  close(): void {
    this.openToken.set(null);
  }
}
