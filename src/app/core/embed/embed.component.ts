import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { LanguageService } from '../i18n/language.service';
import { ThemeService } from '../theme/theme.service';
import { FilterService } from '../filters/filter.service';
import { EMBED_AUTH, EMBED_READY } from './embed';

/**
 * `/embed?to=/sales/period` - where the till's frame lands.
 *
 * It asks the parent for a sign-in, takes the till's own token (the same API
 * issued it, so it is valid here as it is), and goes on to the report. The
 * token arrives by postMessage, never in the URL, where it would sit in the
 * history; and only from an origin in `environment.embedOrigins`.
 */
@Component({
  selector: 'app-embed',
  standalone: true,
  template: `<div class="min-h-screen flex items-center justify-center text-slate-500">…</div>`,
})
export class EmbedComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly theme = inject(ThemeService);
  private readonly lang = inject(LanguageService);
  private readonly filter = inject(FilterService);

  private readonly onMessage = (event: MessageEvent): void => {
    const data = event.data;
    if (!data || data.type !== EMBED_AUTH || typeof data.token !== 'string' || !data.token) {
      return;
    }
    if (!environment.embedOrigins.includes(event.origin)) {
      return;
    }
    this.auth.adopt(data.token, data.refreshToken ?? undefined, data.profile ?? null);
    // Look like the till around it: its light or dark, its language.
    if (data.theme === 'light' || data.theme === 'dark') {
      this.theme.setMode(data.theme);
    }
    if (data.language === 'ar' || data.language === 'en') {
      this.lang.setLanguage(data.language);
    }
    // Open on the till's own branch; a call-centre user (branch 0) picks one.
    const branchId = Number(data.profile?.branchId);
    if (branchId > 0) {
      this.filter.setBranch(branchId);
    }
    // replaceUrl: Back from the first report must not land on this page.
    this.router.navigateByUrl(
      EmbedComponent.safeTarget(this.route.snapshot.queryParamMap.get('to')), { replaceUrl: true });
  };

  ngOnInit(): void {
    window.addEventListener('message', this.onMessage);
    // Nothing secret in this one - it only says "send the sign-in now".
    window.parent?.postMessage({ type: EMBED_READY }, '*');
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.onMessage);
  }

  /** An in-app path only: "/x", never "//host" or "https://...". */
  static safeTarget(to: string | null): string {
    return to && to.startsWith('/') && !to.startsWith('//') ? to : '/';
  }
}
