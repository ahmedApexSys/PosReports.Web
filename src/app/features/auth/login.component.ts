import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { LucideAngularModule, ShieldCheck, Eye, EyeOff, Globe, Loader } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ThemeService } from '../../core/theme/theme.service';

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

        <!-- Language + Theme toggles -->
        <div class="flex justify-end gap-2 mb-6">
          <button (click)="lang.toggle()" class="btn-ghost text-xs">
            <lucide-icon [img]="Globe" class="h-4 w-4"></lucide-icon>
            {{ lang.language() === 'ar' ? 'EN' : 'ع' }}
          </button>
          <button (click)="theme.cycle()" class="btn-ghost text-xs">
            {{ theme.mode() === 'dark' ? '☀' : theme.mode() === 'light' ? '🌙' : '🖥' }}
          </button>
        </div>

        <!-- Logo / brand -->
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

        <!-- Form -->
        <form (ngSubmit)="submit()" class="card-padded space-y-4">
          <div>
            <label class="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              {{ lang.language() === 'ar' ? 'كلمة المرور / PIN' : 'Password / PIN' }}
            </label>
            <div class="relative">
              <input
                [type]="showPassword() ? 'text' : 'password'"
                [(ngModel)]="password"
                name="password"
                autocomplete="current-password"
                required
                class="w-full rounded-card-sm border border-slate-300 dark:border-slate-700
                       bg-white dark:bg-surface-dark-muted
                       px-3 py-2 pe-10 text-sm
                       focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30
                       placeholder:text-slate-400"
                [placeholder]="lang.language() === 'ar' ? 'اكتب كلمة المرور' : 'Enter password'"
              />
              <button type="button" (click)="showPassword.set(!showPassword())"
                      class="absolute end-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'">
                <lucide-icon [img]="showPassword() ? EyeOff : Eye" class="h-4 w-4"></lucide-icon>
              </button>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <input type="checkbox" id="isPIN" [(ngModel)]="isPIN" name="isPIN"
                   class="rounded border-slate-300 dark:border-slate-700 text-brand-700 focus:ring-brand-500"/>
            <label for="isPIN" class="text-sm text-slate-600 dark:text-slate-300">
              {{ lang.language() === 'ar' ? 'الدخول بـ PIN' : 'Sign in with PIN' }}
            </label>
          </div>

          <div *ngIf="error()" class="pill-critical text-sm w-full justify-start py-2">
            {{ error() }}
          </div>

          <button type="submit"
                  [disabled]="loading()"
                  class="btn-primary w-full justify-center">
            <lucide-icon *ngIf="loading()" [img]="Loader" class="h-4 w-4 animate-spin"></lucide-icon>
            <span>{{ lang.language() === 'ar' ? 'تسجيل الدخول' : 'Sign in' }}</span>
          </button>
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
  isPIN = true;
  readonly showPassword = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly ShieldIcon = ShieldCheck;
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;
  readonly Globe = Globe;
  readonly Loader = Loader;

  submit(): void {
    if (!this.password) {
      this.error.set(this.lang.language() === 'ar'
        ? 'اكتب كلمة المرور.'
        : 'Enter your password.');
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
