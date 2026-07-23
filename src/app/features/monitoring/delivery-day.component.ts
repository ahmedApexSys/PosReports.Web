import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService } from '../../core/filters/filter.service';
import { MonitoringApi } from '../../core/api/monitoring.api';
import { DeliveryDay, DeliveryOrderRow } from '../../core/models/day-journeys.models';

/**
 * Delivery Day — a day of deliveries, one row per order with the milestone strip a delivery leaves
 * behind: created → paid → prepared → assigned → delivered → back. Its own shape (a horizontal run
 * of milestones), not the table-day's stack of sittings. Any order opens into its full journey.
 */
@Component({
  selector: 'app-delivery-day',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5" [attr.dir]="lang.language() === 'ar' ? 'rtl' : 'ltr'">
      <header class="space-y-1">
        <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
          {{ lang.language() === 'ar' ? 'يوم الدليفري' : 'Delivery Day' }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ lang.language() === 'ar'
              ? 'كل أوردرات الدليفري في اليوم — كل أوردر ومحطاته: اتعمل، اتدفع، اتجهّز، اتسند، اتسلّم، رجع.'
              : 'A day of deliveries — each order and its milestones: created, paid, prepared, assigned, delivered, back.' }}
        </p>
      </header>

      <div class="flex flex-wrap items-center gap-3">
        <button (click)="run()" [disabled]="loading() || !filter.hasBranch()"
                class="rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white">
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
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div class="rounded-2xl bg-teal-50/70 dark:bg-teal-950/20 p-4 ring-1 ring-teal-200/50">
            <div class="text-2xl font-bold text-teal-800 dark:text-teal-200">{{ d.orderCount }}</div>
            <div class="text-xs text-slate-500">{{ lang.language() === 'ar' ? 'أوردرات' : 'orders' }}</div>
          </div>
          <div class="rounded-2xl bg-white/70 dark:bg-slate-900/40 p-4 ring-1 ring-slate-200/60">
            <div class="text-2xl font-bold">{{ d.delivered }}</div>
            <div class="text-xs text-slate-500">{{ lang.language() === 'ar' ? 'اتسلّمت' : 'delivered' }}</div>
          </div>
          <div class="rounded-2xl bg-white/70 dark:bg-slate-900/40 p-4 ring-1 ring-slate-200/60">
            <div class="text-2xl font-bold">{{ d.totalNet | number:'1.0-2' }}</div>
            <div class="text-xs text-slate-500">{{ lang.language() === 'ar' ? 'صافي' : 'net' }}</div>
          </div>
          <div class="rounded-2xl bg-white/70 dark:bg-slate-900/40 p-4 ring-1 ring-slate-200/60">
            <div class="text-2xl font-bold">{{ d.avgKitchenMinutes != null ? (d.avgKitchenMinutes | number:'1.0-0') : '—' }}</div>
            <div class="text-xs text-slate-500">
              {{ lang.language() === 'ar' ? 'متوسط المطبخ (د)' : 'avg kitchen min' }}
              <span *ngIf="d.kitchenSampleSize" class="text-slate-400">· {{ lang.language() === 'ar' ? 'من' : 'of' }} {{ d.kitchenSampleSize }}</span>
            </div>
          </div>
          <div class="rounded-2xl bg-white/70 dark:bg-slate-900/40 p-4 ring-1 ring-slate-200/60">
            <div class="text-2xl font-bold">{{ d.avgDispatchToDoorMinutes != null ? (d.avgDispatchToDoorMinutes | number:'1.0-0') : '—' }}</div>
            <div class="text-xs text-slate-500">
              {{ lang.language() === 'ar' ? 'متوسط للباب (د)' : 'avg to-door min' }}
              <span *ngIf="d.dispatchToDoorSampleSize" class="text-slate-400">· {{ lang.language() === 'ar' ? 'من' : 'of' }} {{ d.dispatchToDoorSampleSize }}</span>
            </div>
          </div>
        </div>

        <div *ngIf="d.aggregatorCount" class="text-xs text-slate-500 dark:text-slate-400 -mt-1">
          {{ lang.language() === 'ar'
              ? 'منهم ' + d.aggregatorCount + ' أوردر من تطبيق خارجي — بيوصلوا بدون سجل محطات، فمش داخلين في المتوسطات.'
              : d.aggregatorCount + ' order(s) came from an aggregator — they arrive with no milestone log, so they are excluded from the averages.' }}
        </div>

        <div *ngIf="d.emptyReasonEn" class="rounded-xl bg-slate-50 dark:bg-slate-900/40 px-4 py-8 text-center text-sm text-slate-500">
          {{ lang.language() === 'ar' ? d.emptyReasonAr : d.emptyReasonEn }}
        </div>

        <div class="space-y-3">
          <article *ngFor="let o of d.orders" (click)="open(o)"
                   class="group cursor-pointer rounded-2xl bg-white/80 dark:bg-slate-900/50 p-4 ring-1 ring-slate-200/70 dark:ring-slate-800 hover:ring-teal-400 transition">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="font-semibold">#{{ o.receiptNumber || o.orderId }}</span>
                <span *ngIf="o.customerName" class="text-sm text-slate-500">{{ o.customerName }}</span>
                <span *ngIf="o.pilotName" class="text-xs rounded-full bg-teal-100 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 px-2 py-0.5">
                  {{ lang.language() === 'ar' ? 'طيار' : 'pilot' }}: {{ o.pilotName }}
                </span>
                <span *ngIf="o.isAggregator" class="text-xs rounded-full bg-fuchsia-100 dark:bg-fuchsia-950/50 text-fuchsia-700 dark:text-fuchsia-300 px-2 py-0.5">
                  {{ o.onlineAppName || (lang.language() === 'ar' ? 'تطبيق خارجي' : 'aggregator') }}
                </span>
              </div>
              <div class="text-lg font-bold text-teal-800 dark:text-teal-200">{{ o.net | number:'1.0-2' }}</div>
            </div>

            <!-- Milestone strip -->
            <div class="mt-3 flex flex-wrap items-stretch gap-1 text-[11px]">
              <div *ngFor="let m of milestones(o)" class="flex flex-col items-center min-w-[68px]">
                <div [class]="'h-2 w-2 rounded-full ' + (m.at ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700')"></div>
                <div class="mt-1 text-slate-500">{{ lang.language() === 'ar' ? m.ar : m.en }}</div>
                <div class="font-medium" [class.text-slate-300]="!m.at">{{ m.at ? timeOnly(m.at) : '—' }}</div>
              </div>
            </div>

            <!-- durations -->
            <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
              <span *ngIf="o.kitchenMinutes != null">{{ lang.language() === 'ar' ? 'مطبخ' : 'kitchen' }}: {{ o.kitchenMinutes | number:'1.0-0' }}{{ lang.language() === 'ar' ? 'د' : 'm' }}</span>
              <span *ngIf="o.dispatchWaitMinutes != null">{{ lang.language() === 'ar' ? 'انتظار إسناد' : 'dispatch wait' }}: {{ o.dispatchWaitMinutes | number:'1.0-0' }}{{ lang.language() === 'ar' ? 'د' : 'm' }}</span>
              <span *ngIf="o.dispatchToDoorMinutes != null">{{ lang.language() === 'ar' ? 'للباب' : 'to door' }}: {{ o.dispatchToDoorMinutes | number:'1.0-0' }}{{ lang.language() === 'ar' ? 'د' : 'm' }}</span>
              <span *ngIf="o.roundTripMinutes != null">{{ lang.language() === 'ar' ? 'رحلة كاملة' : 'round trip' }}: {{ o.roundTripMinutes | number:'1.0-0' }}{{ lang.language() === 'ar' ? 'د' : 'm' }}</span>
              <span *ngIf="o.paymentMethod" class="rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 px-1.5">{{ o.paymentMethod }}</span>
            </div>
          </article>
        </div>
      </ng-container>
    </div>
  `,
})
export class DeliveryDayComponent {
  readonly lang = inject(LanguageService);
  readonly filter = inject(FilterService);
  private readonly api = inject(MonitoringApi);
  private readonly router = inject(Router);

  readonly data = signal<DeliveryDay | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  run(): void {
    if (!this.filter.hasBranch()) return;
    this.loading.set(true);
    this.error.set('');
    this.api.deliveryDay({ branchId: this.filter.branchId(), date: this.filter.fromDate() })
      .pipe(
        catchError((e) => { this.error.set(e?.message || 'Failed to load.'); return of(null); }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe((res) => this.data.set(res));
  }

  milestones(o: DeliveryOrderRow): { en: string; ar: string; at?: string | null }[] {
    return [
      { en: 'created', ar: 'اتعمل', at: o.createdAt },
      { en: 'paid', ar: 'اتدفع', at: o.paidAt },
      { en: 'prepared', ar: 'اتجهّز', at: o.preparedAt },
      { en: 'assigned', ar: 'اتسند', at: o.assignedAt },
      { en: 'delivered', ar: 'اتسلّم', at: o.deliveredAt },
      { en: 'back', ar: 'رجع', at: o.returnedAt },
    ];
  }

  /** The stamps arrive as "dd/MM/yyyy HH:mm"; show just the clock in the compact strip. */
  timeOnly(stamp: string): string {
    const parts = stamp.split(' ');
    return parts.length > 1 ? parts[1] : stamp;
  }

  open(o: DeliveryOrderRow): void {
    if (o.orderId > 0) this.router.navigate(['/journey'], { queryParams: { orderId: o.orderId } });
  }
}
