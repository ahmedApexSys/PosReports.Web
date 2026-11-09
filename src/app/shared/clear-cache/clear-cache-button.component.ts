import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, Injector, Input, ViewChild, afterNextRender, inject } from '@angular/core';
import { ClearSiteDataOptions, clearSiteData } from './clear-site-data';

/**
 * What survives "Clear cache" in Apex Reports: the id this browser signs in
 * with (`LoginComponent.resolveMachineId`). The server sees every sign-in from
 * this browser under that id; a new one would look like a new device.
 */
export const CLEAR_CACHE_KEEP: ClearSiteDataOptions = {
  keepLocalKeys: ['pos-reports.machineId'],
};

const WORDS = {
  en: {
    button: 'Clear cache',
    title: "Clear this app's data on this device?",
    body: 'Everything this app has saved in this browser goes - cached files, saved settings and screens, and any signed-in session - then the page reloads.',
    keep: "This browser keeps its device id, so it is still recognised as the same device.",
    cancel: 'Cancel',
    go: 'Clear and reload',
    busy: 'Clearing…',
  },
  ar: {
    button: 'مسح الذاكرة المؤقتة',
    title: 'مسح بيانات التطبيق على هذا الجهاز؟',
    body: 'سيُحذف كل ما حفظه التطبيق في هذا المتصفح - الملفات المؤقتة والإعدادات والشاشات المحفوظة وأي جلسة دخول - ثم يُعاد تحميل الصفحة.',
    keep: 'يحتفظ هذا المتصفح بمعرّف الجهاز، فيظل معروفاً كنفس الجهاز.',
    cancel: 'إلغاء',
    go: 'مسح وإعادة التحميل',
    busy: 'جارٍ المسح…',
  },
};

/**
 * Plan item 10.8: a small "Clear cache" button for the login screen, with a
 * confirmation that says what will happen. Self-contained (inline template and
 * styles, no icon font) so it looks the same in every app it is dropped into.
 */
@Component({
  selector: 'apex-clear-cache',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="cc-btn" (click)="open()" [attr.dir]="dir">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/>
      </svg>
      <span>{{ t.button }}</span>
    </button>

    @if (confirming) {
      <div class="cc-backdrop" (click)="close()">
        <div class="cc-card" role="alertdialog" aria-modal="true" aria-labelledby="cc-title" aria-describedby="cc-body"
             [attr.dir]="dir" (click)="$event.stopPropagation()">
          <h2 id="cc-title">{{ t.title }}</h2>
          <p id="cc-body">{{ t.body }}</p>
          <p class="cc-keep">{{ t.keep }}</p>
          <div class="cc-actions">
            <button #cancelBtn type="button" class="cc-ghost" (click)="close()" [disabled]="busy">{{ t.cancel }}</button>
            <button type="button" class="cc-go" (click)="clear()" [disabled]="busy">{{ busy ? t.busy : t.go }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: inline-block; }
    .cc-btn {
      display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 6px 12px;
      border: 1px solid currentColor; border-radius: 8px; background: transparent; color: inherit;
      font: inherit; font-size: 13px; line-height: 1.2; cursor: pointer; opacity: .8;
    }
    .cc-btn:hover, .cc-btn:focus-visible { opacity: 1; }
    .cc-backdrop {
      position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center;
      padding: 16px; background: rgba(28, 20, 16, .55);
    }
    .cc-card {
      width: min(420px, 100%); padding: 20px; border-radius: 14px; text-align: start;
      background: #FFFBF5; color: #2A1F1A; box-shadow: 0 18px 48px rgba(0, 0, 0, .3);
    }
    .cc-card h2 { margin: 0 0 8px; font-size: 17px; font-weight: 700; }
    .cc-card p { margin: 0 0 8px; font-size: 14px; line-height: 1.5; }
    .cc-keep { font-weight: 600; }
    .cc-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: 14px; }
    .cc-actions button {
      min-height: 40px; padding: 8px 16px; border-radius: 8px; font: inherit; font-size: 14px;
      font-weight: 600; cursor: pointer;
    }
    .cc-ghost { border: 1px solid #D9C9B5; background: transparent; color: inherit; }
    .cc-go { border: 0; background: #C62E26; color: #fff; }
    .cc-actions button:disabled { opacity: .6; cursor: default; }
    :host-context([data-theme="dark"]) .cc-card, :host-context(.dark) .cc-card { background: #2A1F1A; color: #F6EDE2; }
    :host-context([data-theme="dark"]) .cc-ghost, :host-context(.dark) .cc-ghost { border-color: #5A4A40; }
  `],
})
export class ClearCacheButtonComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject(ElementRef);
  private readonly injector = inject(Injector);

  /** 'ar' or 'en'. Unset: the page's own language (`<html lang>` / `dir`). */
  @Input() lang: string | null | undefined;

  @ViewChild('cancelBtn') cancelBtn?: ElementRef<HTMLButtonElement>;

  confirming = false;
  busy = false;

  /** Replaced in tests so the run does not reload the test page. */
  reload = () => location.reload();

  get isAr(): boolean {
    const lang = this.lang || document.documentElement.lang || '';
    return lang.toLowerCase().startsWith('ar') || (!this.lang && document.documentElement.dir === 'rtl');
  }

  get t() { return this.isAr ? WORDS.ar : WORDS.en; }

  get dir() { return this.isAr ? 'rtl' : 'ltr'; }

  open(): void {
    this.confirming = true;
    this.cdr.markForCheck();
    // After the dialog is drawn: with event coalescing that is a frame later.
    afterNextRender(() => this.cancelBtn?.nativeElement.focus(), { injector: this.injector });
  }

  close(): void {
    if (this.busy) return;
    this.confirming = false;
    this.cdr.markForCheck();
    (this.host.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.cc-btn')?.focus();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirming) this.close();
  }

  async clear(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.cdr.markForCheck();
    try {
      await clearSiteData(CLEAR_CACHE_KEEP);
    } finally {
      this.reload();
    }
  }
}
