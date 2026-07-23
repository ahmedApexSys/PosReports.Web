import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService } from '../../core/filters/filter.service';
import { MonitoringApi } from '../../core/api/monitoring.api';
import { TakeAwayDay, TakeAwayOrderRow } from '../../core/models/day-journeys.models';

/**
 * Take-away Day — deliberately the shortest journey and NOT padded to match the others. Three real
 * moments: created · paid (= kitchen first sees it) · collected. A take-away made and never
 * collected shows two dots and says so, plainly. Any order opens into its full journey.
 */
@Component({
  selector: 'app-takeaway-day',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5" [attr.dir]="lang.language() === 'ar' ? 'rtl' : 'ltr'">
      <header class="space-y-1">
        <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
          {{ lang.language() === 'ar' ? 'يوم التيك أواي' : 'Take-away Day' }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ lang.language() === 'ar'
              ? 'أقصر رحلة — ثلاث خطوات بس: اتعمل، اتدفع (وقتها المطبخ يشوفه)، اتستلم. واللي ماتستلمش بيفضل خطوتين.'
              : 'The shortest journey — three steps only: created, paid (when the kitchen sees it), collected. Uncollected stays two.' }}
        </p>
      </header>

      <div class="flex flex-wrap items-center gap-3">
        <button (click)="run()" [disabled]="loading() || !filter.hasBranch()"
                class="rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white">
          {{ loading() ? (lang.language() === 'ar' ? 'بيحمّل…' : 'Loading…') : (lang.language() === 'ar' ? 'اعرض اليوم' : 'Show day') }}
        </button>
        <span *ngIf="!filter.hasBranch()" class="text-sm text-amber-600">
          {{ lang.language() === 'ar' ? 'اختر فرع أولاً.' : 'Select a branch first.' }}
        </span>
      </div>

      <div *ngIf="error()" class="rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-4 py-3 ring-1 ring-rose-200/60">
        <strong>{{ lang.language() === 'ar' ? 'خطأ:' : 'Error:' }}</strong> {{ error() }}
      </div>

      <ng-container *ngIf="data() as d">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="rounded-2xl bg-orange-50/70 dark:bg-orange-950/20 p-4 ring-1 ring-orange-200/50">
            <div class="text-2xl font-bold text-orange-800 dark:text-orange-200">{{ d.orderCount }}</div>
            <div class="text-xs text-slate-500">{{ lang.language() === 'ar' ? 'أوردرات' : 'orders' }}</div>
          </div>
          <div class="rounded-2xl bg-white/70 dark:bg-slate-900/40 p-4 ring-1 ring-slate-200/60">
            <div class="text-2xl font-bold">{{ d.collected }}</div>
            <div class="text-xs text-slate-500">{{ lang.language() === 'ar' ? 'اتستلمت' : 'collected' }}</div>
          </div>
          <div class="rounded-2xl bg-white/70 dark:bg-slate-900/40 p-4 ring-1 ring-slate-200/60">
            <div class="text-2xl font-bold" [class.text-rose-600]="d.uncollected > 0">{{ d.uncollected }}</div>
            <div class="text-xs text-slate-500">{{ lang.language() === 'ar' ? 'ماتستلمتش' : 'uncollected' }}</div>
          </div>
          <div class="rounded-2xl bg-white/70 dark:bg-slate-900/40 p-4 ring-1 ring-slate-200/60">
            <div class="text-2xl font-bold">{{ d.avgWaitMinutes != null ? (d.avgWaitMinutes | number:'1.0-0') : '—' }}</div>
            <div class="text-xs text-slate-500">{{ lang.language() === 'ar' ? 'متوسط الانتظار (د)' : 'avg wait min' }}</div>
          </div>
        </div>

        <div *ngIf="d.emptyReasonEn" class="rounded-xl bg-slate-50 dark:bg-slate-900/40 px-4 py-8 text-center text-sm text-slate-500">
          {{ lang.language() === 'ar' ? d.emptyReasonAr : d.emptyReasonEn }}
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <article *ngFor="let o of d.orders" (click)="open(o)"
                   class="group cursor-pointer rounded-2xl bg-white/80 dark:bg-slate-900/50 p-4 ring-1 ring-slate-200/70 dark:ring-slate-800 hover:ring-orange-400 transition">
            <div class="flex items-center justify-between gap-2">
              <span class="font-semibold">#{{ o.receiptNumber || o.orderId }}</span>
              <span class="text-lg font-bold text-orange-800 dark:text-orange-200">{{ o.net | number:'1.0-2' }}</span>
            </div>

            <!-- three-dot strip -->
            <div class="mt-3 flex items-center gap-2 text-[11px]">
              <div class="flex flex-col items-center">
                <div class="h-2.5 w-2.5 rounded-full bg-orange-500"></div>
                <span class="mt-1 text-slate-500">{{ lang.language() === 'ar' ? 'اتعمل' : 'created' }}</span>
                <span class="font-medium">{{ time(o.createdAt) }}</span>
              </div>
              <div class="h-px flex-1 bg-orange-200 dark:bg-orange-900/50"></div>
              <div class="flex flex-col items-center">
                <div class="h-2.5 w-2.5 rounded-full bg-orange-500"></div>
                <span class="mt-1 text-slate-500">{{ lang.language() === 'ar' ? 'اتدفع' : 'paid' }}</span>
                <span class="font-medium">{{ time(o.paidAt) }}</span>
              </div>
              <div class="h-px flex-1" [class]="o.collectedAt ? 'bg-orange-200 dark:bg-orange-900/50' : 'bg-slate-200 dark:bg-slate-800 border-dashed'"></div>
              <div class="flex flex-col items-center">
                <div [class]="'h-2.5 w-2.5 rounded-full ' + (o.collectedAt ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-700')"></div>
                <span class="mt-1 text-slate-500">{{ lang.language() === 'ar' ? 'اتستلم' : 'collected' }}</span>
                <span class="font-medium" [class.text-slate-300]="!o.collectedAt">{{ o.collectedAt ? time(o.collectedAt) : '—' }}</span>
              </div>
            </div>

            <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
              <span *ngIf="o.waitMinutes != null">{{ lang.language() === 'ar' ? 'انتظار' : 'wait' }}: {{ o.waitMinutes | number:'1.0-0' }}{{ lang.language() === 'ar' ? 'د' : 'm' }}</span>
              <span *ngIf="o.cashierName">{{ lang.language() === 'ar' ? 'كاشير' : 'cashier' }}: {{ o.cashierName }}</span>
              <span *ngIf="o.paymentMethod" class="rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 px-1.5">{{ o.paymentMethod }}</span>
              <span *ngIf="!o.collectedAt" class="rounded bg-rose-100 dark:bg-rose-950/40 text-rose-600 px-1.5">
                {{ lang.language() === 'ar' ? 'لسه ماتستلمش' : 'not collected' }}
              </span>
            </div>
          </article>
        </div>
      </ng-container>
    </div>
  `,
})
export class TakeawayDayComponent {
  readonly lang = inject(LanguageService);
  readonly filter = inject(FilterService);
  private readonly api = inject(MonitoringApi);
  private readonly router = inject(Router);

  readonly data = signal<TakeAwayDay | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  run(): void {
    if (!this.filter.hasBranch()) return;
    this.loading.set(true);
    this.error.set('');
    this.api.takeawayDay({ branchId: this.filter.branchId(), date: this.filter.fromDate() })
      .pipe(
        catchError((e) => { this.error.set(e?.message || 'Failed to load.'); return of(null); }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe((res) => this.data.set(res));
  }

  time(stamp?: string | null): string {
    if (!stamp) return '—';
    const parts = stamp.split(' ');
    return parts.length > 1 ? parts[1] : stamp;
  }

  open(o: TakeAwayOrderRow): void {
    if (o.orderId > 0) this.router.navigate(['/journey'], { queryParams: { orderId: o.orderId } });
  }
}
