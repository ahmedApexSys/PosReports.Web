import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { LucideAngularModule, ShieldCheck, Eye, EyeOff, Globe, Loader, Sun, Moon, MonitorCog, KeySquare, LockKeyhole } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ThemeService } from '../../core/theme/theme.service';

type LucideIcon = typeof Sun;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br
                 from-brand-50 via-surface to-info-soft
                 dark:from-brand-900/20 dark:via-surface-dark dark:to-info/10">
      <div class="w-full max-w-md">

        <!-- ── Language + Theme toggles — clearly labelled ────────── -->
        <div class="flex justify-between items-center mb-6">
          <!-- Language toggle (left side in LTR / right in RTL) -->
          <button (click)="lang.toggle()"
                  type="button"
                  class="inline-flex items-center gap-2 rounded-card-sm
                         border border-slate-300 dark:border-slate-700
                         bg-white dark:bg-surface-dark-subtle
                         px-3 py-1.5 text-sm font-medium
                         text-slate-700 dark:text-slate-200
                         hover:bg-slate-50 dark:hover:bg-surface-dark-muted
                         transition-colors duration-180 shadow-card"
                  [attr.aria-label]="lang.language() === 'ar' ? 'Switch to English' : 'التبديل للعربية'">
            <lucide-icon [img]="Globe" class="h-4 w-4 text-brand-700"></lucide-icon>
            <span class="font-bold">{{ lang.language() === 'ar' ? 'English' : 'العربية' }}</span>
          </button>

          <!-- Theme toggle -->
          <button (click)="theme.cycle()"
                  type="button"
                  class="inline-flex items-center gap-2 rounded-card-sm
                         border border-slate-300 dark:border-slate-700
                         bg-white dark:bg-surface-dark-subtle
                         px-3 py-1.5 text-sm font-medium
                         text-slate-700 dark:text-slate-200
                         hover:bg-slate-50 dark:hover:bg-surface-dark-muted
                         transition-colors duration-180 shadow-card"
                  [attr.aria-label]="lang.language() === 'ar' ? 'تبديل الثيم' : 'Toggle theme'">
            <lucide-icon [img]="themeIcon()" class="h-4 w-4 text-brand-700"></lucide-icon>
            <span>{{ themeLabel() }}</span>
          </button>
        </div>

        <!-- ── Brand ──────────────────────────────────────────────── -->
        <div class="text-center mb-8">
          <div class="inline-flex h-14 w-14 items-center justify-center rounded-2xl
                      bg-brand-700 text-white shadow-card mb-3">
            <lucide-icon [img]="ShieldIcon" class="h-7 w-7"></lucide-icon>
          </div>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-50">
            {{ lang.language() === 'ar' ? 'تقارير Apex' : 'Apex Reports' }}
          </h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {{ lang.language() === 'ar' ? 'لوحة المالك للتقارير وذكاء الأعمال' : 'Owner dashboard for reports & insights' }}
          </p>
        </div>

        <!-- ── Form ───────────────────────────────────────────────── -->
        <form (ngSubmit)="submit()" class="card-padded space-y-4">

          <!-- Mode toggle — Password (default) vs PIN -->
          <div class="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-surface-dark-muted rounded-card-sm">
            <button type="button"
                    (click)="isPIN = false"
                    [class.bg-white]="!isPIN"
                    [class.dark:bg-surface-dark-subtle]="!isPIN"
                    [class.shadow-card]="!isPIN"
                    [class.text-brand-700]="!isPIN"
                    [class.dark:text-brand-300]="!isPIN"
                    class="inline-flex items-center justify-center gap-2 rounded-card-sm
                           px-3 py-1.5 text-sm font-medium
                           text-slate-600 dark:text-slate-400
                           transition-all duration-180">
              <lucide-icon [img]="LockKeyhole" class="h-4 w-4"></lucide-icon>
              {{ lang.language() === 'ar' ? 'كلمة المرور' : 'Password' }}
            </button>
            <button type="button"
                    (click)="isPIN = true"
                    [class.bg-white]="isPIN"
                    [class.dark:bg-surface-dark-subtle]="isPIN"
                    [class.shadow-card]="isPIN"
                    [class.text-brand-700]="isPIN"
                    [class.dark:text-brand-300]="isPIN"
                    class="inline-flex items-center justify-center gap-2 rounded-card-sm
                           px-3 py-1.5 text-sm font-medium
                           text-slate-600 dark:text-slate-400
                           transition-all duration-180">
              <lucide-icon [img]="KeySquare" class="h-4 w-4"></lucide-icon>
              PIN
            </button>
          </div>

          <!-- Password / PIN input -->
          <div>
            <label class="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              {{ isPIN
                  ? (lang.language() === 'ar' ? 'الـ PIN' : 'PIN')
                  : (lang.language() === 'ar' ? 'كلمة المرور' : 'Password') }}
            </label>
            <div class="relative">
              <input
                [type]="(showPassword() || isPIN) ? (isPIN ? 'tel' : 'text') : 'password'"
                [(ngModel)]="password"
                name="password"
                [attr.inputmode]="isPIN ? 'numeric' : 'text'"
                [attr.pattern]="isPIN ? '[0-9]*' : null"
                autocomplete="current-password"
                required
                class="w-full rounded-card-sm border border-slate-300 dark:border-slate-700
                       bg-white dark:bg-surface-dark-muted
                       px-3 py-2.5 pe-10 text-sm tabular
                       focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30
                       placeholder:text-slate-400"
                [placeholder]="isPIN
                    ? (lang.language() === 'ar' ? 'اكتب الـ PIN' : 'Enter PIN')
                    : (lang.language() === 'ar' ? 'اكتب كلمة المرور' : 'Enter password')"
              />
              <button type="button"
                      *ngIf="!isPIN"
                      (click)="showPassword.set(!showPassword())"
                      class="absolute end-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'">
                <lucide-icon [img]="showPassword() ? EyeOff : Eye" class="h-4 w-4"></lucide-icon>
              </button>
            </div>
          </div>

          <!-- Error -->
          <div *ngIf="error()" class="pill-critical text-sm w-full justify-start py-2">
            {{ error() }}
          </div>

          <!-- Submit -->
          <button type="submit"
                  [disabled]="loading()"
                  class="btn-primary w-full justify-center py-2.5">
            <lucide-icon *ngIf="loading()" [img]="Loader" class="h-4 w-4 animate-spin"></lucide-icon>
            <span>{{ lang.language() === 'ar' ? 'تسجيل الدخول' : 'Sign in' }}</span>
          </button>

          <!-- Security note -->
          <p class="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 justify-center pt-1">
            <lucide-icon [img]="ShieldIcon" class="h-3 w-3"></lucide-icon>
            {{ lang.language() === 'ar'
                ? 'كلمة المرور بتتشفّر بـ RSA قبل ما تتبعت.'
                : 'Password is RSA-encrypted before transit.' }}
          </p>
        </form>

        <p class="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          {{ lang.language() === 'ar'
              ? 'بتسجيل الدخول، أنت توافق على شروط الاستخدام والخصوصية.'
              : 'By signing in you agree to the terms & privacy policy.' }}
        </p>
      </div>
    </main>
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly lang = inject(LanguageService);
  readonly theme = inject(ThemeService);

  password = '';
  /** Default to Password mode (not PIN) per user requirement. */
  isPIN = false;
  readonly showPassword = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly ShieldIcon = ShieldCheck;
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;
  readonly Globe = Globe;
  readonly Loader = Loader;
  readonly LockKeyhole = LockKeyhole;
  readonly KeySquare = KeySquare;

  themeIcon(): LucideIcon {
    const m = this.theme.mode();
    if (m === 'light') return Sun;
    if (m === 'dark') return Moon;
    return MonitorCog;
  }

  themeLabel(): string {
    const m = this.theme.mode();
    const ar = m === 'light' ? 'فاتح' : m === 'dark' ? 'داكن' : 'تلقائي';
    const en = m === 'light' ? 'Light' : m === 'dark' ? 'Dark' : 'System';
    return this.lang.language() === 'ar' ? ar : en;
  }

  submit(): void {
    if (!this.password) {
      this.error.set(this.lang.language() === 'ar'
        ? (this.isPIN ? 'اكتب الـ PIN.' : 'اكتب كلمة المرور.')
        : (this.isPIN ? 'Enter your PIN.' : 'Enter your password.'));
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const machineId = this.resolveMachineId();
    this.auth.login({
      password: this.password,
      isDesktop: true,
      isPIN: this.isPIN,
      machineId,
    }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.ok) {
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
          this.router.navigateByUrl(returnUrl);
        } else {
          this.error.set(res.message || (this.lang.language() === 'ar' ? 'فشل تسجيل الدخول.' : 'Login failed.'));
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set(this.lang.language() === 'ar' ? 'مشكلة في الاتصال.' : 'Connection error.');
      },
    });
  }

  private resolveMachineId(): string {
    try {
      const key = 'pos-reports.machineId';
      let id = localStorage.getItem(key);
      if (!id) {
        id = `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem(key, id);
      }
      return id;
    } catch {
      return 'web-anon';
    }
  }
}
