import { Component, Input, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule, ChevronDown, ArrowRight, User, Clock, Monitor,
  TriangleAlert, CheckCircle2, XCircle, ArrowLeftRight, Split, Receipt,
} from 'lucide-angular';
import { LanguageService } from '../../core/i18n/language.service';
import { OrderActionLogRow } from '../../core/models/monitoring.models';
import { actionLabel, txTypeLabel, orderActionDescription } from '../../core/i18n/monitoring-labels';

/**
 * Expandable card for a single OrderActionLog row — the atomic unit of the
 * Order Actions + Table Actions monitors. Header shows action / who / when /
 * money-delta at a glance; the body (toggled) reveals the full before→after
 * state, changed fields, transfer target, device + the raw JSON snapshots.
 */
@Component({
  selector: 'app-order-action-row',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-card ring-1 ring-slate-200 dark:ring-slate-800
                bg-white dark:bg-surface-dark-subtle overflow-hidden">
      <!-- Header (click to expand) -->
      <button type="button" (click)="expanded.set(!expanded())"
              class="w-full text-start px-3 md:px-4 py-3 flex items-start gap-3
                     hover:bg-slate-50 dark:hover:bg-surface-dark-muted transition-colors duration-150">
        <!-- Action badge -->
        <span class="shrink-0 mt-0.5 inline-flex items-center gap-1 px-2 py-1 rounded-card-sm text-xs font-semibold"
              [class]="toneClass()">
          {{ actLabel() }}
        </span>

        <div class="flex-1 min-w-0">
          <!-- Top line: ref + receipt + trx -->
          <div class="flex items-center gap-2 flex-wrap text-sm">
            <span class="font-semibold text-slate-900 dark:text-slate-50">
              {{ row.tableName
                  ? (lang.language() === 'ar' ? ('طاولة ' + row.tableName) : ('Table ' + row.tableName))
                  : (lang.language() === 'ar' ? ('أوردر #' + row.orderId) : ('Order #' + row.orderId)) }}
            </span>
            <span *ngIf="row.isTransfered && row.destinationTableName"
                  class="inline-flex items-center gap-1 text-xs text-info">
              <lucide-icon [img]="TransferIcon" class="h-3 w-3"></lucide-icon>
              {{ row.destinationTableName }}
            </span>
            <span *ngIf="row.isSplited" class="inline-flex items-center gap-1 text-xs text-info">
              <lucide-icon [img]="SplitIcon" class="h-3 w-3"></lucide-icon>
              {{ lang.language() === 'ar' ? 'تقسيم' : 'Split' }}
            </span>
            <span *ngIf="row.receiptNumber" class="inline-flex items-center gap-1 text-xs text-slate-400">
              <lucide-icon [img]="ReceiptIcon" class="h-3 w-3"></lucide-icon>{{ row.receiptNumber }}
            </span>
            <span *ngIf="row.transactionTypeName"
                  class="text-[10px] tracking-wide text-slate-400">{{ txLabel() }}</span>
          </div>

          <!-- Description (generated, bilingual) -->
          <p *ngIf="desc()" class="text-xs text-slate-600 dark:text-slate-300 mt-0.5 truncate">
            {{ desc() }}
          </p>

          <!-- Meta line: who / when -->
          <div class="flex items-center gap-3 flex-wrap mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span class="inline-flex items-center gap-1">
              <lucide-icon [img]="UserIcon" class="h-3 w-3"></lucide-icon>
              {{ row.userName || '—' }}<span *ngIf="row.userRole" class="text-slate-400"> · {{ row.userRole }}</span>
            </span>
            <span class="inline-flex items-center gap-1">
              <lucide-icon [img]="ClockIcon" class="h-3 w-3"></lucide-icon>
              {{ row.actionDate | date:'mediumDate' }} {{ row.actionTime }}
            </span>
            <span *ngIf="netChanged()" class="inline-flex items-center gap-1 font-medium"
                  [class.text-critical]="row.netDiff < 0" [class.text-good]="row.netDiff > 0">
              {{ money(row.netBefore) }} <lucide-icon [img]="ArrowIcon" class="h-3 w-3"></lucide-icon> {{ money(row.netAfter) }}
            </span>
          </div>
        </div>

        <!-- Success + chevron -->
        <span class="shrink-0 flex items-center gap-2">
          <lucide-icon [img]="row.success ? OkIcon : FailIcon" class="h-4 w-4"
                       [class.text-good]="row.success" [class.text-critical]="!row.success"></lucide-icon>
          <lucide-icon [img]="ChevronIcon" class="h-4 w-4 text-slate-400 transition-transform duration-200"
                       [class.rotate-180]="expanded()"></lucide-icon>
        </span>
      </button>

      <!-- Body -->
      <div *ngIf="expanded()" class="px-3 md:px-4 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800 space-y-3">
        <!-- Error -->
        <div *ngIf="!row.success && row.errorMessage"
             class="text-xs rounded-card-sm bg-critical-soft text-critical px-2 py-1.5">
          <lucide-icon [img]="WarnIcon" class="h-3 w-3 inline"></lucide-icon> {{ row.errorMessage }}
        </div>

        <!-- Before → After grid -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div class="metric"><span class="metric-k">{{ lang.language() === 'ar' ? 'صافي' : 'Net' }}</span>
            <span class="metric-v">{{ money(row.netBefore) }} → {{ money(row.netAfter) }}</span></div>
          <div class="metric"><span class="metric-k">{{ lang.language() === 'ar' ? 'الإجمالي' : 'Total' }}</span>
            <span class="metric-v">{{ money(row.totalBefore) }} → {{ money(row.totalAfter) }}</span></div>
          <div class="metric"><span class="metric-k">{{ lang.language() === 'ar' ? 'أصناف' : 'Items' }}</span>
            <span class="metric-v">{{ row.itemCountBefore }} → {{ row.itemCountAfter }}</span></div>
          <div class="metric"><span class="metric-k">{{ lang.language() === 'ar' ? 'ضيوف' : 'Guests' }}</span>
            <span class="metric-v">{{ row.guestCountBefore }} → {{ row.guestCountAfter }}</span></div>
        </div>

        <!-- Promo / discount -->
        <div *ngIf="row.discountName || row.promoCode" class="flex items-center gap-2 flex-wrap text-xs">
          <span *ngIf="row.discountName" class="pill-warning">{{ row.discountName }}</span>
          <span *ngIf="row.promoCode" class="pill-warning">{{ row.promoCode }}</span>
        </div>

        <!-- Changed fields -->
        <div *ngIf="changedList().length" class="flex items-center gap-1.5 flex-wrap">
          <span class="text-[11px] text-slate-400">{{ lang.language() === 'ar' ? 'تغيّر:' : 'Changed:' }}</span>
          <span *ngFor="let f of changedList()"
                class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-surface-dark-muted text-slate-600 dark:text-slate-300">
            {{ f }}
          </span>
        </div>

        <!-- Device + correlation -->
        <div class="flex items-center gap-3 flex-wrap text-[11px] text-slate-400">
          <span *ngIf="row.machineName || row.machineId" class="inline-flex items-center gap-1">
            <lucide-icon [img]="DeviceIcon" class="h-3 w-3"></lucide-icon>
            {{ row.machineName || row.machineId }}
          </span>
          <span *ngIf="row.ipAddress">IP {{ row.ipAddress }}</span>
          <span *ngIf="row.correlationId">cid {{ row.correlationId }}</span>
          <span *ngIf="row.durationMs">{{ row.durationMs }}ms</span>
        </div>

        <!-- Snapshots -->
        <div *ngIf="row.beforeSnapshot || row.afterSnapshot" class="grid md:grid-cols-2 gap-2">
          <div *ngIf="row.beforeSnapshot">
            <div class="text-[11px] text-slate-400 mb-1">{{ lang.language() === 'ar' ? 'قبل' : 'Before' }}</div>
            <pre class="snap">{{ pretty(row.beforeSnapshot) }}</pre>
          </div>
          <div *ngIf="row.afterSnapshot">
            <div class="text-[11px] text-slate-400 mb-1">{{ lang.language() === 'ar' ? 'بعد' : 'After' }}</div>
            <pre class="snap">{{ pretty(row.afterSnapshot) }}</pre>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .metric { @apply flex flex-col rounded-card-sm bg-slate-50 dark:bg-surface-dark-muted/40 px-2 py-1.5; }
    .metric-k { @apply text-[10px] uppercase tracking-wide text-slate-400; }
    .metric-v { @apply text-xs font-medium text-slate-700 dark:text-slate-200 tabular; }
    .snap { @apply text-[10px] leading-snug overflow-auto max-h-48
                   rounded-card-sm bg-slate-900/90 text-slate-100 p-2; }
  `],
})
export class OrderActionRowComponent {
  @Input({ required: true }) row!: OrderActionLogRow;

  readonly lang = inject(LanguageService);
  readonly expanded = signal(false);

  readonly ChevronIcon = ChevronDown;
  readonly ArrowIcon = ArrowRight;
  readonly UserIcon = User;
  readonly ClockIcon = Clock;
  readonly DeviceIcon = Monitor;
  readonly WarnIcon = TriangleAlert;
  readonly OkIcon = CheckCircle2;
  readonly FailIcon = XCircle;
  readonly TransferIcon = ArrowLeftRight;
  readonly SplitIcon = Split;
  readonly ReceiptIcon = Receipt;

  readonly toneClass = computed(() => {
    const n = (this.row?.actionTypeName || '').toLowerCase();
    if (/(void|cancel|delete|return|refund)/.test(n)) return 'bg-critical-soft text-critical';
    if (/(pay|checkout|complete|deliver|collect)/.test(n)) return 'bg-good-soft text-good';
    if (/(discount|promo|voucher)/.test(n)) return 'bg-warning-soft text-warning';
    if (/(transfer|split|move|merge)/.test(n)) return 'bg-info-soft text-info';
    return 'bg-slate-100 dark:bg-surface-dark-muted text-slate-600 dark:text-slate-300';
  });

  netChanged(): boolean {
    return Math.abs((this.row?.netBefore ?? 0) - (this.row?.netAfter ?? 0)) > 0.001;
  }

  actLabel(): string { return actionLabel(this.row?.actionTypeName, this.lang.language()); }
  txLabel(): string { return txTypeLabel(this.row?.transactionTypeName, this.row?.transactionType, this.lang.language()); }
  desc(): string {
    const l = this.lang.language();
    return l === 'ar' ? orderActionDescription(this.row, 'ar') : (this.row?.description || orderActionDescription(this.row, 'en'));
  }

  changedList(): string[] {
    const raw = this.row?.changedFields?.trim();
    if (!raw) return [];
    return raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 24);
  }

  money(n: number | null | undefined): string {
    return (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  pretty(json: string): string {
    if (!json) return '';
    try { return JSON.stringify(JSON.parse(json), null, 2); } catch { return json; }
  }
}
