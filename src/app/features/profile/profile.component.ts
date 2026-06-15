import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Settings, Bell, CircleHelp, LogOut, AtSign, Building2, IdCard, ShieldCheck, UserRound, Info } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';

/**
 * Profile — read-only identity card for the signed-in reporting user.
 * PosReports.Web is a read-only console (no user-CRUD API), so account /
 * password changes are handled in the Apex POS desktop app. This page shows
 * who you are, your branch and role, and links to preferences + sign-out.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-4xl mx-auto space-y-6">
      <header>
        <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
          {{ ar() ? 'الملف الشخصي' : 'Profile' }}
        </h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {{ ar() ? 'بيانات حسابك في تقارير أبكس.' : 'Your account details in Apex Reports.' }}
        </p>
      </header>

      <!-- Identity header -->
      <div class="card-padded flex flex-col sm:flex-row sm:items-center gap-5">
        <div class="h-20 w-20 shrink-0 rounded-2xl bg-brand-700 text-white grid place-items-center
                    text-2xl font-bold shadow-card">
          {{ initials() }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-lg font-bold text-slate-900 dark:text-slate-50 truncate">
            {{ displayName() }}
          </div>
          <div *ngIf="secondaryName()" class="text-sm text-slate-500 dark:text-slate-400 truncate">
            {{ secondaryName() }}
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <span [class]="isOwner() ? 'pill-good' : 'pill-info'">
              <lucide-icon [img]="isOwner() ? ShieldCheck : UserRound" class="h-3.5 w-3.5"></lucide-icon>
              {{ isOwner() ? (ar() ? 'مالك' : 'Owner') : (ar() ? 'مستخدم' : 'User') }}
            </span>
            <span *ngIf="userName()" class="text-xs text-slate-500 dark:text-slate-400 font-mono">
              &#64;{{ userName() }}
            </span>
          </div>
        </div>
      </div>

      <!-- Details -->
      <div class="card overflow-hidden">
        <dl class="divide-y divide-slate-100 dark:divide-slate-800">
          <div *ngFor="let row of rows()" class="flex items-center gap-4 px-4 md:px-6 py-3.5">
            <dt class="flex items-center gap-2.5 w-44 shrink-0 text-sm text-slate-500 dark:text-slate-400">
              <lucide-icon [img]="row.icon" class="h-4 w-4 shrink-0 text-slate-400"></lucide-icon>
              {{ row.label }}
            </dt>
            <dd class="min-w-0 flex-1 text-sm font-medium text-slate-900 dark:text-slate-100 truncate"
                [class.font-mono]="row.mono"
                [class.text-slate-400]="!row.value">
              {{ row.value || (ar() ? 'غير متوفر' : 'Not set') }}
            </dd>
          </div>
        </dl>
      </div>

      <!-- Managed-elsewhere note -->
      <div class="card-padded flex items-start gap-3 bg-info-soft/60 dark:bg-info/10">
        <lucide-icon [img]="Info" class="h-5 w-5 shrink-0 text-info mt-0.5"></lucide-icon>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          {{ ar()
              ? 'هذه لوحة تقارير للقراءة فقط. تغيير كلمة المرور وبيانات الحساب يتم من تطبيق نقاط البيع (POS) على سطح المكتب.'
              : 'This is a read-only reporting console. Password and account changes are managed in the Apex POS desktop app.' }}
        </p>
      </div>

      <!-- Quick actions -->
      <div class="flex flex-wrap items-center gap-3">
        <a routerLink="/settings" class="btn-ghost ring-1 ring-slate-200 dark:ring-slate-700">
          <lucide-icon [img]="Settings" class="h-4 w-4"></lucide-icon>
          {{ ar() ? 'الإعدادات' : 'Settings' }}
        </a>
        <a routerLink="/notifications" class="btn-ghost ring-1 ring-slate-200 dark:ring-slate-700">
          <lucide-icon [img]="Bell" class="h-4 w-4"></lucide-icon>
          {{ ar() ? 'الإشعارات' : 'Notifications' }}
        </a>
        <a routerLink="/help" class="btn-ghost ring-1 ring-slate-200 dark:ring-slate-700">
          <lucide-icon [img]="CircleHelp" class="h-4 w-4"></lucide-icon>
          {{ ar() ? 'المساعدة' : 'Help' }}
        </a>
        <button (click)="auth.logout()" class="btn-ghost text-critical ms-auto">
          <lucide-icon [img]="LogOut" class="h-4 w-4"></lucide-icon>
          {{ ar() ? 'تسجيل خروج' : 'Sign out' }}
        </button>
      </div>
    </div>
  `,
})
export class ProfileComponent {
  readonly auth = inject(AuthService);
  readonly lang = inject(LanguageService);

  readonly Settings = Settings;
  readonly Bell = Bell;
  readonly CircleHelp = CircleHelp;
  readonly LogOut = LogOut;
  readonly ShieldCheck = ShieldCheck;
  readonly UserRound = UserRound;
  readonly Info = Info;

  readonly ar = computed(() => this.lang.language() === 'ar');

  private readonly p = computed(() => this.auth.profile());
  readonly isOwner = computed(() => !!this.p()?.isOwner);
  readonly userName = computed(() => this.p()?.userName ?? '');

  readonly displayName = computed(() => {
    const p = this.p();
    if (!p) return this.ar() ? 'مستخدم' : 'User';
    return (this.ar() ? p.name_Ar || p.name_En : p.name_En || p.name_Ar)
      || p.userName || (this.ar() ? 'مستخدم' : 'User');
  });

  /** The "other" language name, shown small under the primary one. */
  readonly secondaryName = computed(() => {
    const p = this.p();
    if (!p) return '';
    const other = this.ar() ? p.name_En : p.name_Ar;
    return other && other !== this.displayName() ? other : '';
  });

  readonly initials = computed(() => {
    const base = this.p()?.name_En || this.p()?.userName || 'U';
    const parts = base.trim().split(/\s+/);
    const txt = parts.length >= 2 ? parts[0][0] + parts[1][0] : base.slice(0, 2);
    return txt.toUpperCase();
  });

  readonly rows = computed(() => {
    const p = this.p();
    const a = this.ar();
    return [
      { label: a ? 'الاسم (إنجليزي)' : 'Name (English)', value: p?.name_En ?? '', icon: UserRound, mono: false },
      { label: a ? 'الاسم (عربي)' : 'Name (Arabic)', value: p?.name_Ar ?? '', icon: UserRound, mono: false },
      { label: a ? 'اسم المستخدم' : 'Username', value: p?.userName ?? '', icon: IdCard, mono: true },
      { label: a ? 'البريد الإلكتروني' : 'Email', value: p?.email ?? '', icon: AtSign, mono: false },
      { label: a ? 'الفرع' : 'Branch', value: p?.branchName ?? '', icon: Building2, mono: false },
      { label: a ? 'الدور' : 'Role', value: p ? (p.isOwner ? (a ? 'مالك' : 'Owner') : (a ? 'مستخدم' : 'User')) : '', icon: ShieldCheck, mono: false },
    ];
  });
}
