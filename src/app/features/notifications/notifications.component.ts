import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LucideAngularModule, Bell, BellOff, CheckCheck, Trash2, X, Info, CircleCheck, TriangleAlert, CircleAlert } from 'lucide-angular';
import { LanguageService } from '../../core/i18n/language.service';
import { NotificationCenterService, AppNotification, NotificationKind } from '../../core/notifications/notification-center.service';

/**
 * Notifications — the in-app notification center. The reporting API has no
 * push endpoint, so entries come from the client-side NotificationCenterService
 * (welcome, tips, "preferences saved", advisories). Supports mark-read,
 * clear, and deep-linking into the report a notification refers to.
 */
@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-3xl mx-auto space-y-5">
      <header class="flex items-center gap-3">
        <div class="min-w-0 flex-1">
          <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2.5">
            {{ ar() ? 'الإشعارات' : 'Notifications' }}
            <span *ngIf="center.unreadCount() > 0" class="pill-info">{{ center.unreadCount() }}</span>
          </h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {{ ar() ? 'تنبيهات ونصائح داخل التطبيق.' : 'In-app alerts and tips.' }}
          </p>
        </div>
        <div *ngIf="center.hasAny()" class="flex items-center gap-2 shrink-0">
          <button (click)="center.markAllRead()"
                  [disabled]="center.unreadCount() === 0"
                  class="btn-ghost text-sm disabled:opacity-40 disabled:pointer-events-none">
            <lucide-icon [img]="CheckCheck" class="h-4 w-4"></lucide-icon>
            <span class="hidden sm:inline">{{ ar() ? 'تعليم الكل كمقروء' : 'Mark all read' }}</span>
          </button>
          <button (click)="clearAll()" class="btn-ghost text-sm text-critical">
            <lucide-icon [img]="Trash2" class="h-4 w-4"></lucide-icon>
            <span class="hidden sm:inline">{{ ar() ? 'مسح الكل' : 'Clear all' }}</span>
          </button>
        </div>
      </header>

      <!-- Empty state -->
      <div *ngIf="!center.hasAny()" class="card-padded text-center py-14 space-y-3">
        <div class="inline-flex h-14 w-14 items-center justify-center rounded-2xl
                    bg-surface-muted dark:bg-surface-dark-muted text-slate-400">
          <lucide-icon [img]="BellOff" class="h-7 w-7"></lucide-icon>
        </div>
        <h2 class="text-base font-semibold text-slate-700 dark:text-slate-200">
          {{ ar() ? 'لا توجد إشعارات' : 'You\\'re all caught up' }}
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          {{ ar() ? 'هتظهر هنا التنبيهات والنصائح عند توفرها.' : 'New alerts and tips will show up here.' }}
        </p>
      </div>

      <!-- List -->
      <div *ngIf="center.hasAny()" class="card overflow-hidden">
        <ul class="divide-y divide-slate-100 dark:divide-slate-800">
          <li *ngFor="let n of center.items()"
              class="group flex items-start gap-3.5 px-4 md:px-5 py-4 transition-colors
                     hover:bg-slate-50 dark:hover:bg-surface-dark-muted/60"
              [class.cursor-pointer]="!!n.route"
              [class.bg-brand-50]="!n.read"
              [class.dark:bg-brand-900]="false"
              (click)="open(n)">
            <!-- kind icon -->
            <div class="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1"
                 [ngClass]="iconWrap(n.kind)">
              <lucide-icon [img]="iconFor(n.kind)" class="h-4.5 w-4.5"></lucide-icon>
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span *ngIf="!n.read" class="h-1.5 w-1.5 rounded-full bg-brand-600 shrink-0"></span>
                <p class="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {{ ar() ? n.titleAr : n.titleEn }}
                </p>
              </div>
              <p class="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                {{ ar() ? n.bodyAr : n.bodyEn }}
              </p>
              <p class="mt-1 text-xs text-slate-400 dark:text-slate-500">{{ relTime(n.createdAt) }}</p>
            </div>

            <!-- remove -->
            <button (click)="remove($event, n.id)"
                    class="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity
                           text-slate-400 hover:text-critical p-1 -m-1 shrink-0"
                    [attr.aria-label]="ar() ? 'حذف' : 'Remove'">
              <lucide-icon [img]="X" class="h-4 w-4"></lucide-icon>
            </button>
          </li>
        </ul>
      </div>
    </div>
  `,
})
export class NotificationsComponent {
  readonly center = inject(NotificationCenterService);
  readonly lang = inject(LanguageService);
  private readonly router = inject(Router);

  readonly Bell = Bell;
  readonly BellOff = BellOff;
  readonly CheckCheck = CheckCheck;
  readonly Trash2 = Trash2;
  readonly X = X;

  readonly ar = computed(() => this.lang.language() === 'ar');

  iconFor(kind: NotificationKind): typeof Info {
    switch (kind) {
      case 'good':     return CircleCheck;
      case 'warning':  return TriangleAlert;
      case 'critical': return CircleAlert;
      default:         return Info;
    }
  }

  iconWrap(kind: NotificationKind): string {
    switch (kind) {
      case 'good':     return 'bg-good-soft text-good ring-good/30 dark:bg-good/20 dark:text-good-ring';
      case 'warning':  return 'bg-warning-soft text-warning ring-warning/30 dark:bg-warning/20 dark:text-warning-ring';
      case 'critical': return 'bg-critical-soft text-critical ring-critical/30 dark:bg-critical/20 dark:text-critical-ring';
      default:         return 'bg-info-soft text-info ring-info/30 dark:bg-info/20 dark:text-info-ring';
    }
  }

  open(n: AppNotification): void {
    if (!n.read) this.center.markRead(n.id);
    if (n.route) this.router.navigateByUrl(n.route);
  }

  remove(ev: Event, id: string): void {
    ev.stopPropagation();
    this.center.remove(id);
  }

  clearAll(): void {
    const msg = this.ar() ? 'مسح كل الإشعارات؟' : 'Clear all notifications?';
    if (window.confirm(msg)) this.center.clear();
  }

  relTime(ts: number): string {
    const a = this.ar();
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60_000);
    if (min < 1) return a ? 'الآن' : 'just now';
    if (min < 60) return a ? `منذ ${min} دقيقة` : `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return a ? `منذ ${hr} ساعة` : `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return a ? `منذ ${day} يوم` : `${day}d ago`;
    try {
      return new Date(ts).toLocaleDateString(a ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return new Date(ts).toDateString();
    }
  }
}
