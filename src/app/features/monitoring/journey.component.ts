import {
  Component, inject, signal, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule, Search, Loader, RefreshCw } from 'lucide-angular';
import { catchError, finalize, of } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { MonitoringApi } from '../../core/api/monitoring.api';
import { OrderJourney, JourneyStep } from '../../core/models/journey.models';

type SearchBy = 'receipt' | 'order';

/**
 * Order Journey — the full money story of ONE order, from open to pay.
 *
 * Every action (open, send, transfer, split, void, change min-charge, pay…) as
 * a vertical timeline: who did it, when, on which table/hall, the money
 * before→after→Δ, and the real item lines involved (sent / voided) with name,
 * quantity and price. Works for dine-in (halls + other tables) and take-away.
 *
 * Reads `POST /api/activity-log/order-timeline` (server: OrderTimelineDto),
 * which now returns real itemized data (VoidItemDetails + OrderDetails).
 */
@Component({
  selector: 'app-journey',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="space-y-5" dir="rtl">
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
          {{ ar() ? 'رحلة الأوردر' : 'Order Journey' }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {{ ar()
            ? 'من فتح الترابيزة لحد الدفع — مين عمل إيه، وعلى إيه، والفلوس اتحركت إزاي.'
            : 'From opening the table to paying — who did what, and how the money moved.' }}
        </p>
      </div>
    </div>

    <div class="flex gap-2 flex-wrap items-center">
      <div class="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <button type="button" (click)="by.set('receipt')"
          class="px-3 py-2 text-sm"
          [class.bg-slate-900]="by() === 'receipt'" [class.text-white]="by() === 'receipt'"
          [class.text-slate-600]="by() !== 'receipt'">
          {{ ar() ? 'رقم الإيصال' : 'Receipt #' }}
        </button>
        <button type="button" (click)="by.set('order')"
          class="px-3 py-2 text-sm border-r border-slate-200 dark:border-slate-700"
          [class.bg-slate-900]="by() === 'order'" [class.text-white]="by() === 'order'"
          [class.text-slate-600]="by() !== 'order'">
          {{ ar() ? 'رقم الأوردر' : 'Order #' }}
        </button>
      </div>
      <div class="relative flex-1 min-w-[200px] max-w-sm">
        <lucide-icon [img]="Search" class="absolute right-3 top-2.5 w-4 h-4 text-slate-400"></lucide-icon>
        <input type="text" [(ngModel)]="term" (keyup.enter)="load()"
          [placeholder]="by() === 'receipt' ? (ar() ? 'اكتب رقم الإيصال' : 'Receipt number') : (ar() ? 'اكتب رقم الأوردر' : 'Order id')"
          class="w-full pr-9 pl-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
      </div>
      <button type="button" (click)="load()"
        class="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white inline-flex items-center gap-2">
        <lucide-icon [img]="loading() ? Loader : RefreshCw" class="w-4 h-4" [class.animate-spin]="loading()"></lucide-icon>
        {{ ar() ? 'عرض الرحلة' : 'Load journey' }}
      </button>
    </div>

    <p *ngIf="error()" class="text-sm text-red-600 dark:text-red-400">{{ error() }}</p>

    <div *ngIf="!data() && !loading() && !error()"
      class="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">
      {{ ar() ? 'اكتب رقم إيصال أو أوردر واضغط عرض الرحلة.' : 'Enter a receipt or order number and load the journey.' }}
    </div>

    <ng-container *ngIf="data() as d">
      <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 md:p-5">
        <div class="flex justify-between items-start flex-wrap gap-3">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-lg font-semibold text-slate-900 dark:text-slate-50">
                {{ d.tableName || (ar() ? 'أوردر' : 'Order') }}
              </span>
              <span class="text-xs px-2.5 py-1 rounded-full"
                [ngClass]="statusClass(d.status)">{{ ar() ? d.statusAr : d.status }}</span>
              <span class="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {{ ar() ? d.transactionTypeAr : d.transactionType }}
              </span>
            </div>
            <div class="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {{ ar() ? 'إيصال' : 'Receipt' }} #{{ d.receiptNumber }}
              <span *ngIf="d.guestCount"> · {{ d.guestCount }} {{ ar() ? 'ضيف' : 'guests' }}</span>
              <span *ngIf="d.waiterName"> · {{ ar() ? 'النادل' : 'Waiter' }}: {{ d.waiterName }}</span>
              <span *ngIf="d.cashierName"> · {{ ar() ? 'الكاشير' : 'Cashier' }}: {{ d.cashierName }}</span>
            </div>
          </div>
          <div class="text-left">
            <div class="text-xs text-slate-500 dark:text-slate-400">{{ ar() ? 'الصافي' : 'Net' }}</div>
            <div class="text-2xl font-semibold text-slate-900 dark:text-slate-50">{{ money(d.net) }}</div>
            <div class="text-xs text-slate-400 dark:text-slate-500">
              {{ d.createdAt }}<span *ngIf="d.completedAt"> ← {{ d.completedAt }}</span>
              <span *ngIf="d.duration"> · {{ d.duration }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="relative pr-6">
        <div class="absolute right-2 top-1 bottom-1 w-0.5 bg-slate-200 dark:bg-slate-700"></div>

        <div *ngFor="let s of d.timeline" class="relative mb-4">
          <span class="absolute -right-[26px] top-1 w-4 h-4 rounded-full bg-white dark:bg-slate-950 border-2"
            [style.borderColor]="stepColor(s.action)"></span>

          <div class="flex justify-between gap-2 flex-wrap">
            <span class="font-medium text-slate-900 dark:text-slate-100">{{ ar() ? s.actionAr : s.action }}</span>
            <span class="text-xs text-slate-400 dark:text-slate-500">
              <span *ngIf="s.userName">{{ s.userName }} · </span>{{ s.time || s.date }}
            </span>
          </div>
          <div *ngIf="s.description" class="text-sm text-slate-500 dark:text-slate-400">{{ s.description }}</div>

          <div *ngIf="delta(s) as dl"
            class="text-sm mt-1">
            <span class="text-slate-500 dark:text-slate-400">{{ ar() ? 'الصافي' : 'Net' }}:</span>
            {{ money(dl.before) }} ←
            <span class="font-medium"
              [class.text-emerald-600]="dl.diff > 0" [class.text-red-600]="dl.diff < 0">
              {{ money(dl.after) }}
              <span *ngIf="dl.diff !== 0">{{ dl.diff > 0 ? '▲' : '▼' }} {{ money(absv(dl.diff)) }}</span>
            </span>
          </div>
        </div>
      </div>

      <div *ngIf="d.items.length" class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <div class="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">{{ ar() ? 'أصناف الأوردر' : 'Order items' }}</div>
        <div *ngFor="let it of d.items" class="flex justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
          <span class="text-slate-700 dark:text-slate-200">
            {{ round(it.quantity) }} × {{ it.itemName }}<span *ngIf="it.variantName" class="text-slate-400"> ({{ it.variantName }})</span>
          </span>
          <span class="text-slate-500 dark:text-slate-400">{{ money(it.lineTotal) }}</span>
        </div>
      </div>

      <div *ngIf="d.voidedItems.length" class="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20 p-4">
        <div class="text-sm font-medium text-red-700 dark:text-red-300 mb-2">{{ ar() ? 'أصناف ملغية' : 'Voided items' }}</div>
        <div *ngFor="let v of d.voidedItems" class="text-sm py-1 border-b border-red-100 dark:border-red-900/40 last:border-0">
          <div class="flex justify-between">
            <span class="text-red-700 dark:text-red-300">{{ round(v.quantity) }} × {{ v.itemName }}</span>
            <span class="text-red-700 dark:text-red-300">− {{ money(v.price) }}</span>
          </div>
          <div class="text-xs text-red-500 dark:text-red-400/80">
            <span *ngIf="v.stageAr || v.stage">{{ ar() ? v.stageAr : v.stage }}</span>
            <span *ngIf="v.reason"> · {{ v.reason }}</span>
            <span *ngIf="v.voidedBy"> · {{ v.voidedBy }}</span>
          </div>
        </div>
      </div>

      <div *ngIf="d.discounts.length" class="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-4">
        <div class="text-sm font-medium text-amber-700 dark:text-amber-300 mb-2">{{ ar() ? 'خصومات' : 'Discounts' }}</div>
        <div *ngFor="let g of d.discounts" class="flex justify-between text-sm py-1">
          <span class="text-amber-700 dark:text-amber-300">{{ g.discountName }}<span *ngIf="g.isPromoCode"> · {{ ar() ? 'برومو' : 'promo' }}</span></span>
          <span class="text-amber-700 dark:text-amber-300">− {{ money(g.amount) }}</span>
        </div>
      </div>
    </ng-container>
  </div>
  `,
})
export class JourneyComponent {
  protected readonly Search = Search;
  protected readonly Loader = Loader;
  protected readonly RefreshCw = RefreshCw;

  private readonly api = inject(MonitoringApi);
  private readonly route = inject(ActivatedRoute);
  protected readonly lang = inject(LanguageService);

  protected readonly by = signal<SearchBy>('receipt');
  protected term = '';
  protected readonly data = signal<OrderJourney | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    const p = this.route.snapshot.queryParamMap;
    const rcpt = p.get('receipt');
    const oid = p.get('orderId');
    if (oid) { this.by.set('order'); this.term = oid; this.load(); }
    else if (rcpt) { this.by.set('receipt'); this.term = rcpt; this.load(); }
  }

  protected ar(): boolean { return this.lang.language() === 'ar'; }

  protected load(): void {
    const t = (this.term || '').trim();
    if (!t) { return; }
    this.loading.set(true);
    this.error.set(null);
    const req = this.by() === 'order' ? { orderId: Number(t) } : { receiptNumber: t };
    this.api.orderJourney(req).pipe(
      catchError((e: Error) => { this.error.set(e?.message || 'Failed to load'); return of(null); }),
      finalize(() => this.loading.set(false)),
    ).subscribe((res) => this.data.set(res));
  }

  protected delta(s: JourneyStep): { before: number; after: number; diff: number } | null {
    const d = s.details;
    if (!d) { return null; }
    const before = d.netBefore ?? d.totalSalesBefore ?? 0;
    const after = d.netAfter ?? d.totalSalesAfter ?? 0;
    if (before === 0 && after === 0) { return null; }
    return { before, after, diff: Math.round((after - before) * 100) / 100 };
  }

  protected stepColor(action: string): string {
    const a = (action || '').toLowerCase();
    if (a.includes('open')) { return '#888780'; }
    if (a.includes('sent') || a.includes('send')) { return '#185FA5'; }
    if (a.includes('transfer')) { return '#534AB7'; }
    if (a.includes('split')) { return '#534AB7'; }
    if (a.includes('void') || a.includes('cancel')) { return '#A32D2D'; }
    if (a.includes('checked') || a.includes('checkout')) { return '#0F6E56'; }
    if (a.includes('paid') || a.includes('collect') || a.includes('closed table')) { return '#0F6E56'; }
    if (a.includes('discount') || a.includes('promo')) { return '#BA7517'; }
    if (a.includes('change')) { return '#BA7517'; }
    return '#888780';
  }

  protected statusClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (s.includes('complete') || s.includes('paid')) { return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'; }
    if (s.includes('cancel')) { return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'; }
    return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  }

  protected money(n: number | null | undefined): string {
    const v = Math.round((n ?? 0) * 100) / 100;
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  protected round(n: number | null | undefined): number { return Math.round((n ?? 0) * 100) / 100; }
  protected absv(n: number): number { return Math.abs(n); }
}
