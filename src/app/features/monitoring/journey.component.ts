import {
  Component, inject, signal, computed, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule, Search, Loader, RefreshCw } from 'lucide-angular';
import { catchError, finalize, of } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService } from '../../core/filters/filter.service';
import { MonitoringApi } from '../../core/api/monitoring.api';
import { OrderJourney, JourneyStep, JourneyDelivery } from '../../core/models/journey.models';

type SearchBy = 'receipt' | 'order';

/**
 * Order Journey — the money story of ONE order, for an owner.
 *
 * Two halves: a RECEIPT (items, discount, service, tax, minimum charge, addition, net) and a
 * business TIMELINE (who did what, when, and the money before -> after). Covers dine-in
 * (open / send / transfer / split / checkout / void / min-charge / addition / change waiter),
 * take-away (pay / pay-edit / void) and delivery (assign + change pilot / delivered / collect money).
 *
 * Deliberately NOT shown: raw developer log text, and internal repricing ("Calculate") events —
 * those sit behind a counted toggle. A money delta renders only when the server marks it
 * trustworthy, because most log rows leave the "before" side at zero.
 */
@Component({
  selector: 'app-journey',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="space-y-5" dir="rtl">
    <div>
      <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
        {{ ar() ? 'رحلة الأوردر' : 'Order Journey' }}
      </h1>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
        {{ ar()
          ? 'الأوردر ده اتعمل فيه إيه بالظبط — مين، وإمتى، والفلوس راحت فين.'
          : 'Exactly what happened to this order — who, when, and where the money went.' }}
      </p>
    </div>

    <div class="flex gap-2 flex-wrap items-center">
      <div class="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <button type="button" (click)="by.set('receipt')" class="px-3 py-2 text-sm"
          [class.bg-slate-900]="by() === 'receipt'" [class.text-white]="by() === 'receipt'"
          [class.text-slate-600]="by() !== 'receipt'">{{ ar() ? 'رقم الإيصال' : 'Receipt #' }}</button>
        <button type="button" (click)="by.set('order')"
          class="px-3 py-2 text-sm border-e border-slate-200 dark:border-slate-700"
          [class.bg-slate-900]="by() === 'order'" [class.text-white]="by() === 'order'"
          [class.text-slate-600]="by() !== 'order'">{{ ar() ? 'رقم الأوردر' : 'Order #' }}</button>
      </div>
      <div class="relative flex-1 min-w-[200px] max-w-sm">
        <lucide-icon [img]="Search" class="absolute end-3 top-2.5 w-4 h-4 text-slate-400"></lucide-icon>
        <input type="text" [(ngModel)]="term" (keyup.enter)="load()"
          [placeholder]="ar() ? 'اكتب الرقم واضغط Enter' : 'Type the number and press Enter'"
          class="w-full pe-9 ps-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
      </div>
      <button type="button" (click)="load()"
        class="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white inline-flex items-center gap-2">
        <lucide-icon [img]="loading() ? Loader : RefreshCw" class="w-4 h-4" [class.animate-spin]="loading()"></lucide-icon>
        {{ ar() ? 'عرض' : 'Load' }}
      </button>
    </div>

    <p *ngIf="error()" class="text-sm text-red-600 dark:text-red-400">{{ error() }}</p>

    <div *ngIf="notFound()" class="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-4 text-sm text-amber-800 dark:text-amber-300">
      {{ ar() ? 'مفيش أوردر بالرقم ده.' : 'No order found for that number.' }}
    </div>

    <div *ngIf="!data() && !loading() && !error() && !notFound()"
      class="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">
      {{ ar() ? 'اكتب رقم إيصال أو أوردر عشان تشوف رحلته.' : 'Enter a receipt or order number.' }}
    </div>

    <ng-container *ngIf="data() as d">
      <!-- ── Identity + headline ─────────────────────────────── -->
      <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 md:p-5">
        <div class="flex justify-between items-start flex-wrap gap-3">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-lg font-semibold text-slate-900 dark:text-slate-50">
                {{ d.receiptNumber ? (ar() ? 'إيصال #' : 'Receipt #') + d.receiptNumber
                                   : (ar() ? 'أوردر #' : 'Order #') + d.orderId }}
              </span>
              <span class="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {{ ar() ? d.transactionTypeAr : d.transactionType }}
              </span>
              <span class="text-xs px-2.5 py-1 rounded-full" [ngClass]="statusClass(d.status)">
                {{ ar() ? d.statusAr : d.status }}
              </span>
              <span *ngIf="d.paymentMethod" class="text-xs px-2.5 py-1 rounded-full"
                [ngClass]="d.isPaidOrder ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                         : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'">
                {{ payAr(d.paymentMethod) }}<span *ngIf="!d.isPaidOrder"> · {{ ar() ? 'غير محصّل' : 'unpaid' }}</span>
              </span>
            </div>
            <div class="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-7">
              <span *ngIf="d.tableName">{{ ar() ? 'ترابيزة' : 'Table' }} {{ d.tableName }} · </span>
              <span *ngIf="d.guestCount">{{ d.guestCount }} {{ ar() ? 'ضيف' : 'guests' }} · </span>
              <span *ngIf="d.waiterName">{{ ar() ? 'النادل' : 'Waiter' }}: {{ d.waiterName }} · </span>
              <span *ngIf="d.cashierName">{{ ar() ? 'الكاشير' : 'Cashier' }}: {{ d.cashierName }}</span>
              <span *ngIf="d.pilotName"> · {{ ar() ? 'الطيّار' : 'Pilot' }}: <b class="text-slate-700 dark:text-slate-200">{{ d.pilotName }}</b></span>
            </div>
            <!-- pay-way change: the thing an owner wants flagged -->
            <div *ngIf="d.previousPaymentMethod"
              class="mt-2 inline-flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
              {{ ar() ? 'اتغيرت طريقة الدفع:' : 'Payment method changed:' }}
              <bdi>{{ payAr(d.previousPaymentMethod) }} ← {{ payAr(d.paymentMethod) }}</bdi>
            </div>
          </div>
          <div class="text-start">
            <div class="text-xs text-slate-500 dark:text-slate-400">{{ ar() ? 'الصافي' : 'Net' }}</div>
            <div class="text-2xl font-semibold text-slate-900 dark:text-slate-50"><bdi>{{ money(d.money.net) }}</bdi></div>
            <div class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              <bdi>{{ d.createdAt }}<span *ngIf="d.completedAt"> ← {{ d.completedAt }}</span></bdi>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Money path — how the bill got from the items to the net ──
           A running total per step, so the owner reads a chain rather than a
           column of numbers they have to add up themselves. -->
      <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 md:p-5">
        <div class="flex items-baseline justify-between gap-3 flex-wrap mb-3">
          <div class="font-medium text-slate-900 dark:text-slate-100">{{ ar() ? 'مسار المال' : 'Money path' }}</div>
          <div *ngIf="voidNote()" class="text-xs text-slate-500 dark:text-slate-400">{{ voidNote() }}</div>
        </div>

        <div class="flex flex-wrap gap-2">
          <div *ngFor="let s of moneyFlow()"
            class="flex-1 min-w-[118px] rounded-lg px-3 py-2.5 border"
            [ngClass]="s.final
              ? 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-900/50 dark:bg-indigo-950/25'
              : 'border-slate-200 dark:border-slate-700'">
            <div class="text-[11px] text-slate-500 dark:text-slate-400">
              <span *ngIf="s.sign" [class.text-red-600]="s.sign === '−'" [class.text-emerald-700]="s.sign === '+'">{{ s.sign }}</span>
              {{ ar() ? s.labelAr : s.labelEn }}
            </div>
            <div class="text-base font-medium tabular-nums mt-0.5 text-slate-900 dark:text-slate-50">
              <bdi>{{ money(s.running) }}</bdi>
            </div>
            <div *ngIf="s.delta" class="text-[11px] tabular-nums mt-0.5"
              [class.text-red-600]="s.delta < 0" [class.text-emerald-700]="s.delta > 0">
              <bdi>{{ s.delta > 0 ? '+' : '−' }}{{ money(abs(s.delta)) }}</bdi>
            </div>
          </div>
        </div>

        <!-- If the chain does not land on the stored net, say so rather than papering over it. -->
        <p *ngIf="flowMismatch() as gap" class="mt-3 text-xs text-amber-700 dark:text-amber-400">
          {{ ar() ? 'الصافي المخزَّن يختلف عن مجموع الخطوات بفرق' : 'The stored net differs from the chain by' }}
          <bdi>{{ money(gap) }}</bdi>{{ ar() ? '. المعروض هو الصافي المخزَّن.' : '. The stored net is what is shown.' }}
        </p>

        <div class="text-sm mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div class="flex justify-between py-1"><span class="text-slate-500 dark:text-slate-400">{{ ar() ? 'قيمة الأصناف' : 'Items' }}</span><span class="tabular-nums"><bdi>{{ money(d.money.itemsTotal) }}</bdi></span></div>
          <div class="flex justify-between py-1" *ngIf="d.money.discount"><span class="text-slate-500 dark:text-slate-400">{{ ar() ? 'الخصم' : 'Discount' }}</span><span class="tabular-nums text-red-600"><bdi>− {{ money(d.money.discount) }}</bdi></span></div>
          <!-- Service is a dine-in concept. Printing it as 0.00 on a counter or courier
               receipt is noise, so it only appears where it can be non-zero. -->
          <div class="flex justify-between py-1" *ngIf="isDineIn() || d.money.service">
            <span class="text-slate-500 dark:text-slate-400">{{ ar() ? 'الخدمة' : 'Service' }}</span>
            <span class="tabular-nums"><bdi>{{ money(d.money.service) }}</bdi></span>
          </div>
          <div class="flex justify-between py-1">
            <span class="text-slate-500 dark:text-slate-400">
              {{ ar() ? 'الضريبة' : 'Tax' }}<span *ngIf="d.money.taxRatio"> {{ num(d.money.taxRatio) }}%</span>
              <span class="text-xs text-slate-400"> ({{ ar() ? 'أصناف' : 'items' }} {{ money(d.money.itemTax) }} + {{ ar() ? 'خدمة' : 'service' }} {{ money(d.money.serviceTax) }})</span>
            </span>
            <span class="tabular-nums"><bdi>{{ money(d.money.totalTax) }}</bdi></span>
          </div>
          <!-- Minimum charge, shown as the comparison it actually is: the rate, what that
               came to for this many guests, and the top-up that reached the bill. A top-up
               of zero is a real answer ("the table spent enough"), so it is shown too. -->
          <ng-container *ngIf="d.money.minimumChargePerGuest">
            <div class="flex justify-between py-1">
              <span class="text-slate-500 dark:text-slate-400">{{ ar() ? 'الحد الأدنى للضيف' : 'Minimum charge / guest' }}</span>
              <span class="tabular-nums text-slate-500 dark:text-slate-400"><bdi>{{ money(d.money.minimumChargePerGuest) }}</bdi></span>
            </div>
            <div class="flex justify-between py-1" *ngIf="d.guestCount">
              <span class="text-slate-500 dark:text-slate-400">
                {{ ar() ? 'المطلوب' : 'Required' }}
                <span class="text-xs text-slate-400">({{ d.guestCount }} {{ ar() ? 'ضيف' : 'guests' }})</span>
              </span>
              <span class="tabular-nums text-slate-500 dark:text-slate-400"><bdi>{{ money(minimumRequired()) }}</bdi></span>
            </div>
            <div class="flex justify-between py-1">
              <span class="text-slate-500 dark:text-slate-400">{{ ar() ? 'الفرق المضاف' : 'Top-up added' }}</span>
              <span class="tabular-nums" [class.text-slate-400]="!d.money.minimumChargeDifference">
                <bdi>{{ money(d.money.minimumChargeDifference) }}</bdi>
              </span>
            </div>
            <!-- Which rule the comparison used. Without it the three numbers above are
                 unreadable: the same spend clears the minimum under one setting and
                 falls short under the other. -->
            <p *ngIf="d.money.minimumChargeIncludesTaxAndService !== null && d.money.minimumChargeIncludesTaxAndService !== undefined"
              class="text-xs text-slate-500 dark:text-slate-400 pb-1">
              {{ d.money.minimumChargeIncludesTaxAndService
                  ? (ar() ? 'الحد الأدنى يشمل الضريبة والخدمة — المقارنة تمت على الإجمالي شامل الضريبة والخدمة.'
                          : 'The minimum includes tax and service — compared against the all-in total.')
                  : (ar() ? 'الحد الأدنى لا يشمل الضريبة والخدمة — المقارنة تمت على قيمة الأصناف بعد الخصم.'
                          : 'The minimum excludes tax and service — compared against items after discount.') }}
            </p>
            <p *ngIf="!d.money.minimumChargeDifference" class="text-xs text-slate-400 dark:text-slate-500 pb-1">
              {{ ar() ? 'الطاولة صرفت أكتر من الحد الأدنى، فمفيش فرق اتضاف.'
                      : 'The table spent above the minimum, so nothing was added.' }}
            </p>
          </ng-container>
          <div class="flex justify-between py-1" *ngIf="d.money.addition"><span class="text-slate-500 dark:text-slate-400">{{ ar() ? 'إضافات' : 'Addition' }}</span><span class="tabular-nums"><bdi>{{ money(d.money.addition) }}</bdi></span></div>
          <div class="flex justify-between pt-2.5 mt-2 border-t border-slate-300 dark:border-slate-600 font-semibold text-base">
            <span>{{ ar() ? 'الصافي' : 'Net' }}</span><span class="tabular-nums"><bdi>{{ money(d.money.net) }}</bdi></span>
          </div>
        </div>
      </div>

      <!-- ── The delivery leg — courier orders only ──────────── -->
      <div *ngIf="d.delivery as dv"
        class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 md:p-5">
        <div class="font-medium text-slate-900 dark:text-slate-100 mb-3">{{ ar() ? 'التوصيل' : 'Delivery' }}</div>

        <div class="text-sm text-slate-600 dark:text-slate-300 leading-7">
          <span *ngIf="dv.customerName">{{ ar() ? 'العميل' : 'Customer' }}: <b class="text-slate-800 dark:text-slate-100">{{ dv.customerName }}</b></span>
          <span *ngIf="dv.mobilePhone"> · <bdi>{{ dv.mobilePhone }}</bdi></span>
          <span *ngIf="dv.address"> · {{ dv.address }}</span>
          <span *ngIf="dv.onlineAppName"> · {{ ar() ? 'تطبيق' : 'App' }}: {{ dv.onlineAppName }}</span>
        </div>
        <div class="text-sm text-slate-600 dark:text-slate-300 mt-1" *ngIf="dv.pilotName">
          {{ ar() ? 'الطيّار' : 'Pilot' }}: <b class="text-slate-800 dark:text-slate-100">{{ dv.pilotName }}</b>
          <span *ngIf="dv.roundTripMinutes" class="text-slate-400"> · {{ ar() ? 'الرحلة' : 'round trip' }} <bdi>{{ num(dv.roundTripMinutes) }}</bdi> {{ ar() ? 'دقيقة' : 'min' }}</span>
        </div>

        <!-- The four stamps the courier flow writes. A missing one is stated, not hidden:
             "no pick-up time" is exactly what an owner chasing a late order needs to see. -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div *ngFor="let st of deliveryStamps(dv)">
            <div class="text-xs text-slate-400 dark:text-slate-500">{{ ar() ? st.labelAr : st.labelEn }}</div>
            <div class="text-sm mt-0.5" [class.text-slate-400]="!st.value" [class.dark:text-slate-600]="!st.value">
              <bdi>{{ st.value || (ar() ? 'لم يحدث' : 'not recorded') }}</bdi>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Items, before and after the voids ────────────────
           Side by side so the removal is legible as a change, not as two
           unrelated lists. With no voids there is nothing to compare, so a
           single list is shown instead. -->
      <div class="grid gap-4" [class.md:grid-cols-2]="d.voidedItems.length">
        <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <div class="flex items-baseline justify-between gap-2 mb-2">
            <span class="text-sm font-medium text-slate-900 dark:text-slate-100">
              {{ d.voidedItems.length ? (ar() ? 'الأصناف قبل الحذف' : 'Items before voids')
                                      : (ar() ? 'الأصناف' : 'Items') }}
            </span>
            <span class="text-[11px] text-slate-400">{{ ar() ? 'كمية × سعر الوحدة' : 'qty × unit price' }}</span>
          </div>

          <div *ngFor="let v of d.voidedItems"
            class="flex justify-between gap-3 text-sm py-1.5 border-b border-slate-100 dark:border-slate-800">
            <span class="text-red-600/70 dark:text-red-400/70 line-through">
              {{ v.itemName }} <bdi>×{{ num(v.quantity) }}</bdi>
              <bdi class="text-slate-400" *ngIf="v.quantity"> @ {{ money(v.price / v.quantity) }}</bdi>
            </span>
            <span class="tabular-nums text-red-600/70 dark:text-red-400/70"><bdi>{{ money(v.price) }}</bdi></span>
          </div>

          <div *ngFor="let it of d.items"
            class="flex justify-between gap-3 text-sm py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <span class="text-slate-700 dark:text-slate-200">
              {{ it.itemName }}<span *ngIf="it.variantName" class="text-slate-400"> ({{ it.variantName }})</span>
              <bdi>×{{ num(it.quantity) }}</bdi><bdi class="text-slate-400"> @ {{ money(it.unitPrice) }}</bdi>
            </span>
            <span class="tabular-nums text-slate-600 dark:text-slate-300"><bdi>{{ money(it.lineTotal) }}</bdi></span>
          </div>

          <p *ngIf="!d.items.length && !d.voidedItems.length" class="text-sm text-slate-400 py-3">
            {{ ar() ? 'مفيش أصناف مسجّلة على الأوردر ده.' : 'No item lines recorded for this order.' }}
          </p>
        </div>

        <div *ngIf="d.voidedItems.length"
          class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <div class="flex items-baseline justify-between gap-2 mb-2">
            <span class="text-sm font-medium text-emerald-700 dark:text-emerald-400">{{ ar() ? 'الأصناف بعد الحذف' : 'Items after voids' }}</span>
            <span class="text-[11px] text-slate-400">{{ ar() ? 'كمية × سعر الوحدة' : 'qty × unit price' }}</span>
          </div>
          <div *ngFor="let it of d.items"
            class="flex justify-between gap-3 text-sm py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <span class="text-slate-700 dark:text-slate-200">
              {{ it.itemName }}<span *ngIf="it.variantName" class="text-slate-400"> ({{ it.variantName }})</span>
              <bdi>×{{ num(it.quantity) }}</bdi><bdi class="text-slate-400"> @ {{ money(it.unitPrice) }}</bdi>
            </span>
            <span class="tabular-nums text-slate-600 dark:text-slate-300"><bdi>{{ money(it.lineTotal) }}</bdi></span>
          </div>
          <div *ngFor="let v of d.voidedItems" class="text-xs text-slate-500 dark:text-slate-400 pt-2 first-of-type:mt-2 first-of-type:border-t first-of-type:border-slate-100 dark:first-of-type:border-slate-800">
            {{ ar() ? 'اتشال' : 'Removed' }}: {{ v.itemName }}
            <span *ngIf="v.stageAr || v.stage">· {{ ar() ? v.stageAr : v.stage }}</span>
            <span *ngIf="v.voidedBy">· {{ v.voidedBy }}</span>
            <span *ngIf="v.reason">· {{ v.reason }}</span>
          </div>
        </div>
      </div>

      <!-- ── Every movement on the order ──────────────────────
           A row per action, each carrying its own effect on the money. The badge is
           the point: an owner scans the column of badges and the expensive moments
           announce themselves without any row being opened. -->
      <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 md:p-5">
        <div class="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div class="font-medium text-slate-900 dark:text-slate-100">
            {{ ar() ? 'كل حركات الأوردر' : 'Every movement on the order' }}
          </div>
          <button *ngIf="noiseCount() > 0" type="button" (click)="showNoise.set(!showNoise())"
            class="text-xs inline-flex items-center gap-2 rounded-full px-3 py-1.5 border transition-colors"
            [ngClass]="showNoise()
              ? 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400'">
            <span class="w-1.5 h-1.5 rounded-full"
              [ngClass]="showNoise() ? 'bg-slate-400' : 'bg-emerald-500'"></span>
            {{ showNoise() ? (ar() ? 'كل الأحداث' : 'All events')
                           : (ar() ? 'أحداث المال فقط' : 'Money events only') }}
            <span class="opacity-60">({{ showNoise() ? visibleSteps().length : moneyStepCount() }})</span>
          </button>
        </div>

        <div *ngFor="let s of visibleSteps()"
          class="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 mb-2.5 last:mb-0">

          <!-- The mark. Colour carries the kind of movement, so the eye groups sends,
               removals and settlements without reading a word. -->
          <span class="shrink-0 w-8 h-8 rounded-lg grid place-items-center text-sm font-medium"
            [style.color]="stepColor(s.action)"
            [style.backgroundColor]="stepTint(s.action)">{{ stepGlyph(s.action) }}</span>

          <div class="flex-1 min-w-0">
            <div class="flex items-baseline gap-2 flex-wrap">
              <span class="font-medium text-slate-900 dark:text-slate-100">{{ ar() ? s.actionAr : s.action }}</span>
              <bdi class="text-xs text-slate-400 dark:text-slate-500">{{ s.time || s.date }}</bdi>
              <span *ngIf="s.stage === 'Table'"
                class="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                {{ ar() ? 'على الترابيزة' : 'table session' }}
              </span>
            </div>
            <div class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{{ detail(s) }}</div>
          </div>

          <!-- What it did to the bill. "No change" is stated rather than left blank,
               because a blank reads as missing data instead of as a real answer. -->
          <span class="shrink-0 text-xs rounded-full px-2.5 py-1 tabular-nums" [ngClass]="deltaClass(s)">
            <bdi>{{ deltaLabel(s) }}</bdi>
          </span>
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
  private readonly filter = inject(FilterService);
  protected readonly lang = inject(LanguageService);

  protected readonly by = signal<SearchBy>('receipt');
  protected term = '';
  protected readonly data = signal<OrderJourney | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notFound = signal(false);
  protected readonly showNoise = signal(false);

  protected readonly noiseCount = computed(() => (this.data()?.timeline ?? []).filter(s => s.isNoise).length);
  protected readonly visibleSteps = computed(() => {
    const steps = this.data()?.timeline ?? [];
    return this.showNoise() ? steps : steps.filter(s => !s.isNoise);
  });

  constructor() {
    const p = this.route.snapshot.queryParamMap;
    const rcpt = p.get('receipt');
    const oid = p.get('orderId');
    if (oid) { this.by.set('order'); this.term = oid; this.load(); }
    else if (rcpt) { this.by.set('receipt'); this.term = rcpt; this.load(); }
  }

  protected ar(): boolean { return this.lang.language() === 'ar'; }

  /**
   * Which of the three layouts to draw. The server now derives the type from the
   * order header rather than the action log, so this is reliable even for an order
   * whose log rows were pruned.
   */
  protected readonly isDineIn = computed(() => {
    const t = (this.data()?.transactionType ?? '').replace(/\s/g, '').toLowerCase();
    return t === 'dinein' || t === 'reservation' || t === 'hospitality';
  });

  /** The minimum the table had to reach: the per-guest rate × the guests on the bill. */
  protected minimumRequired(): number {
    const d = this.data();
    if (!d) { return 0; }
    return this.num(d.money.minimumChargePerGuest * d.guestCount);
  }

  /**
   * The bill as a chain: start at the items, apply each adjustment, land on the
   * stored net. Steps that are zero are dropped — a row reading 0.00 costs a line
   * of attention and answers nothing.
   */
  protected moneyFlow(): ReadonlyArray<{
    labelAr: string; labelEn: string; running: number; delta: number; sign: string; final: boolean;
  }> {
    const d = this.data();
    if (!d) { return []; }
    const m = d.money;
    const out: Array<{ labelAr: string; labelEn: string; running: number; delta: number; sign: string; final: boolean }> = [];

    let run = this.num(m.itemsTotal);
    out.push({ labelAr: 'قيمة الأصناف', labelEn: 'Items', running: run, delta: 0, sign: '', final: false });

    const add = (labelAr: string, labelEn: string, delta: number) => {
      if (!delta) { return; }
      run = this.num(run + delta);
      out.push({ labelAr, labelEn, running: run, delta, sign: delta < 0 ? '−' : '+', final: false });
    };

    add('الخصم', 'Discount', -this.num(m.discount));
    add('فرق الحد الأدنى', 'Minimum top-up', this.num(m.minimumChargeDifference));
    add('الخدمة', 'Service', this.num(m.service));
    add('الضريبة', 'Tax', this.num(m.totalTax));
    add('الإضافة', 'Addition', this.num(m.addition));

    out.push({ labelAr: 'الصافي', labelEn: 'Net', running: this.num(m.net), delta: 0, sign: '', final: true });
    return out;
  }

  /**
   * Gap between the chain and the stored net, or null when they agree. Surfaced
   * rather than hidden: a mismatch means a figure this page cannot see moved the
   * bill, and pretending otherwise would make the page quietly wrong.
   */
  protected flowMismatch(): number | null {
    const f = this.moneyFlow();
    if (f.length < 2) { return null; }
    const chain = f[f.length - 2].running;
    const net = f[f.length - 1].running;
    const gap = this.num(net - chain);
    return Math.abs(gap) > 0.004 ? gap : null;
  }

  /** Short line above the money path when items were removed. */
  protected voidNote(): string {
    const d = this.data();
    if (!d?.voidedItems.length) { return ''; }
    const names = d.voidedItems.map(v => `«${v.itemName} ×${this.num(v.quantity)}»`).join('، ');
    return this.ar() ? `بعد حذف ${names}` : `after voiding ${names}`;
  }

  /** How many steps actually moved money — the count on the filter pill. */
  protected moneyStepCount(): number {
    return (this.data()?.timeline ?? []).filter(s => !s.isNoise && this.deltaOf(s) !== 0).length;
  }

  /** The signed change this step made to the net, or 0 when it moved nothing. */
  protected deltaOf(s: JourneyStep): number {
    if (!s.hasMoneyDelta) { return 0; }
    return this.delta(s)?.diff ?? 0;
  }

  /** The badge's colours. Green up, red down, grey for a step that moved nothing. */
  protected deltaClass(s: JourneyStep): string {
    const d = this.deltaOf(s);
    if (d > 0) { return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'; }
    if (d < 0) { return 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'; }
    return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
  }

  /** The badge's text. "No change" is a real answer and is said, not left blank. */
  protected deltaLabel(s: JourneyStep): string {
    const d = this.deltaOf(s);
    if (!d) { return this.ar() ? 'من غير تغيير' : 'no change'; }
    const sign = d > 0 ? '+' : '−';
    return this.ar() ? `${sign}${this.money(this.abs(d))} ج.م` : `${sign}${this.money(this.abs(d))}`;
  }

  /** The row's second line: who did it and what it touched, without repeating the title. */
  protected detail(s: JourneyStep): string {
    const what = this.summary(s);
    const who = s.userName;
    if (what && who) { return `${what} · ${who}`; }
    return what || who || '';
  }

  /**
   * A single character standing in for the kind of movement. Deliberately not an icon
   * font: these render identically in a printed receipt and an exported PDF, which the
   * report pages are routinely turned into.
   */
  protected stepGlyph(action: string): string {
    const a = (action || '').toLowerCase();
    if (a.includes('open')) { return '+'; }
    if (a.includes('send') || a.includes('sent')) { return '↑'; }
    if (a.includes('transfer')) { return '⇄'; }
    if (a.includes('split')) { return '⑂'; }
    if (a.includes('void') || a.includes('cancel')) { return '✕'; }
    if (a.includes('discount') || a.includes('promo')) { return '%'; }
    if (a.includes('paid') || a.includes('pay')) { return '✓'; }
    if (a.includes('end') || a.includes('closed table')) { return '■'; }
    return '≡';
  }

  /** A wash of the step's own colour, so the mark reads as a chip rather than a dot. */
  protected stepTint(action: string): string {
    return `color-mix(in srgb, ${this.stepColor(action)} 12%, transparent)`;
  }

  /** Who did what, when, and what it did to the money — as one sentence. */
  protected sentence(s: JourneyStep): string {
    const who = s.userName || (this.ar() ? 'مستخدم غير معروف' : 'unknown user');
    const what = this.summary(s) || (this.ar() ? s.actionAr : s.action);
    const when = s.time || s.date;
    const dl = s.hasMoneyDelta ? this.delta(s) : null;

    if (this.ar()) {
      const head = `${who} — ${what}${when ? ` الساعة ${when}` : ''}`;
      if (!dl) { return `${head}.`; }
      if (!dl.diff) { return `${head}، والصافي فضل زي ما هو ${this.money(dl.after)}.`; }
      const dir = dl.diff > 0 ? 'زاد' : 'نزل';
      return `${head}، والصافي ${dir} من ${this.money(dl.before)} لـ ${this.money(dl.after)} (${dl.diff > 0 ? '+' : '−'}${this.money(this.abs(dl.diff))}).`;
    }

    const head = `${who} — ${what}${when ? ` at ${when}` : ''}`;
    if (!dl) { return `${head}.`; }
    if (!dl.diff) { return `${head}; the net stayed at ${this.money(dl.after)}.`; }
    const dir = dl.diff > 0 ? 'rose' : 'fell';
    return `${head}; the net ${dir} from ${this.money(dl.before)} to ${this.money(dl.after)} (${dl.diff > 0 ? '+' : '−'}${this.money(this.abs(dl.diff))}).`;
  }

  /** The four courier stamps in the order they happen, missing ones included. */
  protected deliveryStamps(dv: JourneyDelivery): ReadonlyArray<{ labelAr: string; labelEn: string; value?: string | null }> {
    return [
      { labelAr: 'التحضير', labelEn: 'Prepared', value: dv.prepareTime },
      { labelAr: 'إسناد الطيّار', labelEn: 'Assigned', value: dv.assignTime },
      { labelAr: 'الاستلام', labelEn: 'Picked up', value: dv.pickUpTime },
      { labelAr: 'العودة', labelEn: 'Returned', value: dv.returnTime },
    ];
  }

  protected load(): void {
    const t = (this.term || '').trim();
    if (!t) { return; }
    this.loading.set(true);
    this.error.set(null);
    this.notFound.set(false);
    // Branch scopes the lookup: receipt numbers are a per-branch sequence.
    const branchId = this.filter.branchId() ?? undefined;
    const req = this.by() === 'order'
      ? { orderId: Number(t), branchId }
      : { receiptNumber: t, branchId };
    this.api.orderJourney(req).pipe(
      catchError((e: Error) => { this.error.set(e?.message || 'Failed to load'); return of(null); }),
      finalize(() => this.loading.set(false)),
    ).subscribe((res) => {
      this.data.set(res);
      this.notFound.set(!res && !this.error());
    });
  }

  protected summary(s: JourneyStep): string {
    const v = this.ar() ? (s.summaryAr || '') : (s.summaryEn || s.summaryAr || '');
    return v.trim();
  }

  protected delta(s: JourneyStep): { before: number; after: number; diff: number } | null {
    const d = s.details;
    if (!d) { return null; }
    const before = d.netBefore ?? 0;
    const after = d.netAfter ?? 0;
    return { before, after, diff: Math.round((after - before) * 100) / 100 };
  }

  /** Arabic label for a stored payment method. Never shows the raw enum key. */
  protected payAr(m?: string | null): string {
    const k = (m || '').trim().toLowerCase();
    if (!this.ar()) { return (m || '').trim() || '—'; }
    switch (k) {
      case 'cash': return 'كاش';
      case 'visa': return 'فيزا';
      case 'ledge': case 'leadge': return 'آجل';
      case 'officer': return 'ضيافة ضابط';
      case 'hospitality': return 'ضيافة';
      case 'paytabs': case 'paytap': return 'PayTabs';
      default: return (m || '').trim() || 'غير معروف';
    }
  }

  protected stepColor(action: string): string {
    const a = (action || '').toLowerCase();
    if (a.includes('open')) { return '#888780'; }
    if (a.includes('sent') || a.includes('send')) { return '#185FA5'; }
    if (a.includes('transfer') || a.includes('split')) { return '#534AB7'; }
    if (a.includes('void') || a.includes('cancel')) { return '#A32D2D'; }
    if (a.includes('checked') || a.includes('checkout')) { return '#0F6E56'; }
    if (a.includes('paid') || a.includes('collect') || a.includes('closed table')) { return '#0F6E56'; }
    if (a.includes('pilot') || a.includes('driver') || a.includes('assign')) { return '#534AB7'; }
    if (a.includes('discount') || a.includes('promo') || a.includes('change')) { return '#BA7517'; }
    return '#888780';
  }

  protected statusClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (s.includes('complete') || s.includes('paid') || s.includes('deliver')) {
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    }
    if (s.includes('cancel')) { return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'; }
    return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  }

  /** Western digits, 2dp, in both languages — money must align and export cleanly. */
  protected money(n: number | null | undefined): string {
    const v = Math.round((n ?? 0) * 100) / 100;
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  protected num(n: number | null | undefined): number { return Math.round((n ?? 0) * 100) / 100; }
  protected abs(n: number): number { return Math.abs(n); }
}
