import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService } from '../../core/filters/filter.service';
import { MonitoringApi } from '../../core/api/monitoring.api';
import { TableDay, TableSitting } from '../../core/models/day-journeys.models';

/**
 * Table Day — one table across a whole business day, as a sequence of SITTINGS: it opened, this
 * happened, it closed; then it opened again, to the end of the day. Its own shape (breadth over one
 * table), not the order journey's depth over one bill — any sitting opens into that journey.
 */
@Component({
  selector: 'app-table-day',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5" [attr.dir]="lang.language() === 'ar' ? 'rtl' : 'ltr'">
      <header class="space-y-1">
        <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
          {{ lang.language() === 'ar' ? 'يوم الترابيزة' : 'Table Day' }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ lang.language() === 'ar'
              ? 'كل جلسات الترابيزة على مدار اليوم — افتحت، حصل عليها كذا، اتقفلت، وهكذا.'
              : 'Every sitting on one table across the day — opened, what happened, how it closed.' }}
        </p>
      </header>

      <!-- Controls -->
      <div class="flex flex-wrap items-end gap-3 rounded-2xl bg-white/60 dark:bg-slate-900/40 p-4 ring-1 ring-slate-200/70 dark:ring-slate-800">
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-slate-500 dark:text-slate-400">{{ lang.language() === 'ar' ? 'اسم الترابيزة' : 'Table name' }}</span>
          <input [(ngModel)]="tableText" (keyup.enter)="run()"
                 class="w-40 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
                 placeholder="e.g. 12" />
        </label>
        <button (click)="run()" [disabled]="loading()"
                class="rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white">
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
        <!-- Day roll-up -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 p-4 ring-1 ring-amber-200/50">
            <div class="text-2xl font-bold text-amber-800 dark:text-amber-200">{{ d.sittingCount }}</div>
            <div class="text-xs text-slate-500">{{ lang.language() === 'ar' ? 'جلسات' : 'sittings' }}</div>
          </div>
          <div class="rounded-2xl bg-white/70 dark:bg-slate-900/40 p-4 ring-1 ring-slate-200/60">
            <div class="text-2xl font-bold">{{ d.totalGuests }}</div>
            <div class="text-xs text-slate-500">{{ lang.language() === 'ar' ? 'ضيوف' : 'guests' }}</div>
          </div>
          <div class="rounded-2xl bg-white/70 dark:bg-slate-900/40 p-4 ring-1 ring-slate-200/60">
            <div class="text-2xl font-bold">{{ d.totalNet | number:'1.0-2' }}</div>
            <div class="text-xs text-slate-500">{{ lang.language() === 'ar' ? 'صافي' : 'net' }}</div>
          </div>
          <div class="rounded-2xl bg-white/70 dark:bg-slate-900/40 p-4 ring-1 ring-slate-200/60">
            <div class="text-2xl font-bold">{{ d.totalOccupiedMinutes != null ? (d.totalOccupiedMinutes | number:'1.0-0') : '—' }}</div>
            <div class="text-xs text-slate-500">{{ lang.language() === 'ar' ? 'دقائق إشغال' : 'occupied min' }}</div>
          </div>
        </div>

        <div *ngIf="d.emptyReasonEn" class="rounded-xl bg-slate-50 dark:bg-slate-900/40 px-4 py-8 text-center text-sm text-slate-500">
          {{ lang.language() === 'ar' ? d.emptyReasonAr : d.emptyReasonEn }}
        </div>

        <!-- Sittings, in order -->
        <ol class="relative space-y-3 ps-4 border-s-2 border-amber-200/60 dark:border-amber-900/40">
          <li *ngFor="let s of d.sittings; let i = index"
              (click)="open(s)"
              class="group relative cursor-pointer rounded-2xl bg-white/80 dark:bg-slate-900/50 p-4 ring-1 ring-slate-200/70 dark:ring-slate-800 hover:ring-amber-400 transition">
            <span class="absolute -start-[1.4rem] top-5 h-3 w-3 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-950"></span>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="font-semibold">{{ s.openedAt || '—' }}</span>
                <span class="text-slate-400">→</span>
                <span class="font-semibold">{{ s.closedAt || (lang.language() === 'ar' ? 'مفتوحة' : 'open') }}</span>
                <span *ngIf="s.durationMinutes != null" class="text-xs rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5">
                  {{ s.durationMinutes | number:'1.0-0' }} {{ lang.language() === 'ar' ? 'د' : 'min' }}
                </span>
                <span *ngIf="s.sittingTableName && s.sittingTableName !== d.tableName"
                      class="text-xs rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5">
                  {{ s.sittingTableName }}
                </span>
              </div>
              <div class="text-lg font-bold text-amber-800 dark:text-amber-200">{{ s.net | number:'1.0-2' }}</div>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span>{{ lang.language() === 'ar' ? 'ضيوف' : 'Guests' }}: {{ s.guests }}</span>
              <span *ngIf="s.waiterName">{{ lang.language() === 'ar' ? 'ويتر' : 'Waiter' }}: {{ s.waiterName }}</span>
              <span *ngIf="s.cashierName">{{ lang.language() === 'ar' ? 'كاشير' : 'Cashier' }}: {{ s.cashierName }}</span>
              <span>{{ lang.language() === 'ar' ? s.transactionTypeAr : s.transactionType }}</span>
              <span *ngIf="s.paymentMethod" class="rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-1.5">{{ s.paymentMethod }}</span>
              <span *ngIf="s.closedWithoutPayment" class="rounded bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 px-1.5">
                {{ lang.language() === 'ar' ? 'اتقفلت بدون دفع' : 'closed unpaid' }}
              </span>
            </div>
            <!-- counts strip -->
            <div class="mt-2 flex flex-wrap gap-1.5 text-[11px]">
              <span *ngIf="s.sends" class="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5">{{ s.sends }} {{ lang.language() === 'ar' ? 'إرسال' : 'send' }}</span>
              <span *ngIf="s.voids" class="rounded bg-rose-100 dark:bg-rose-950/40 text-rose-600 px-1.5 py-0.5">{{ s.voids }} {{ lang.language() === 'ar' ? 'إلغاء' : 'void' }}</span>
              <span *ngIf="s.transfers" class="rounded bg-sky-100 dark:bg-sky-950/40 text-sky-600 px-1.5 py-0.5">{{ s.transfers }} {{ lang.language() === 'ar' ? 'نقل' : 'transfer' }}</span>
              <span *ngIf="s.splits" class="rounded bg-violet-100 dark:bg-violet-950/40 text-violet-600 px-1.5 py-0.5">{{ s.splits }} {{ lang.language() === 'ar' ? 'تقسيم' : 'split' }}</span>
              <span *ngIf="s.discounts" class="rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 px-1.5 py-0.5">{{ s.discounts }} {{ lang.language() === 'ar' ? 'خصم' : 'disc' }}</span>
            </div>
            <div class="mt-1 text-[11px] text-amber-600 opacity-0 group-hover:opacity-100 transition">
              {{ lang.language() === 'ar' ? 'افتح رحلة الأوردر ←' : '→ open order journey' }}
            </div>
          </li>
        </ol>
      </ng-container>
    </div>
  `,
})
export class TableDayComponent {
  readonly lang = inject(LanguageService);
  readonly filter = inject(FilterService);
  private readonly api = inject(MonitoringApi);
  private readonly router = inject(Router);

  readonly data = signal<TableDay | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  tableText = '';

  run(): void {
    const table = this.tableText.trim();
    if (!table || !this.filter.hasBranch()) return;
    this.loading.set(true);
    this.error.set('');
    this.api.tableDay({ tableName: table, branchId: this.filter.branchId(), date: this.filter.fromDate() })
      .pipe(
        catchError((e) => { this.error.set(e?.message || 'Failed to load.'); return of(null); }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe((res) => this.data.set(res));
  }

  open(s: TableSitting): void {
    if (s.orderId > 0) this.router.navigate(['/journey'], { queryParams: { orderId: s.orderId } });
  }
}
