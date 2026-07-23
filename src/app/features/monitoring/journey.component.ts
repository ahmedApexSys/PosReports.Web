import {
  Component, inject, signal, computed, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule, Search, Loader, RefreshCw, ChevronDown } from 'lucide-angular';
import { catchError, finalize, of } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService } from '../../core/filters/filter.service';
import { MonitoringApi } from '../../core/api/monitoring.api';
import {
  OrderJourney, JourneyStep, JourneyDelivery, JourneyMovement, JourneyClipItem, JourneyChip,
} from '../../core/models/journey.models';

type SearchBy = 'receipt' | 'order';

/** One column of the three-panel clip, already resolved into the reading language. */
interface ClipPanel {
  title: string;
  items: JourneyClipItem[];
  total: number;
  /** The emphasised middle panel — what this event actually moved. */
  moved: boolean;
  /** This panel's list was folded from earlier events rather than read from a snapshot. */
  derived: boolean;
}

/** The whole clip for one movement: a note to state, the panels to draw, the facts. */
interface ClipView {
  note: string;
  panels: ClipPanel[];
  chips: JourneyChip[];
}

/**
 * Order Journey — the money story of ONE order, for an owner.
 *
 * Two halves: a RECEIPT (items, discount, service, tax, minimum charge, addition, net) and a
 * business TIMELINE (who did what, when, and the money before -> after). Covers dine-in
 * (open / send / transfer / split / checkout / void / min-charge / addition / change waiter),
 * take-away (pay / pay-edit / void) and delivery (assign + change pilot / delivered / collect money).
 *
 * Every movement row opens into a CLIP: the items on the table before, the items the event
 * moved, and the items left after. That is the whole point of the page — "−120.00" tells an
 * owner a table got cheaper; the clip tells them which two dishes walked off it.
 *
 * Deliberately NOT shown: raw developer log text, and internal repricing ("Calculate") events —
 * those sit behind a counted toggle. A money delta renders only when the server marks it
 * trustworthy, because most log rows leave the "before" side at zero.
 *
 * Styling note: the page carries its own warm palette as custom properties (see `styles`).
 * Anything that does not depend on a token stays in Tailwind — the component-style budget is
 * 8 kB, and CSS spent on padding is CSS not available for colour.
 */
@Component({
  selector: 'app-journey',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="space-y-5" dir="rtl">
    <div>
      <h1 class="text-xl md:text-2xl font-bold jr-ink">
        {{ ar() ? 'رحلة الأوردر' : 'Order Journey' }}
      </h1>
      <p class="text-sm jr-muted mt-0.5">
        {{ ar()
          ? 'الأوردر ده اتعمل فيه إيه بالظبط — مين، وإمتى، والفلوس راحت فين.'
          : 'Exactly what happened to this order — who, when, and where the money went.' }}
      </p>
    </div>

    <div class="flex gap-2 flex-wrap items-center">
      <div class="jr-seg inline-flex rounded-lg overflow-hidden">
        <button type="button" (click)="by.set('receipt')" class="jr-seg-btn px-3 py-2 text-sm"
          [class.is-on]="by() === 'receipt'">{{ ar() ? 'رقم الإيصال' : 'Receipt #' }}</button>
        <button type="button" (click)="by.set('order')" class="jr-seg-btn jr-seg-split px-3 py-2 text-sm"
          [class.is-on]="by() === 'order'">{{ ar() ? 'رقم الأوردر' : 'Order #' }}</button>
      </div>
      <div class="relative flex-1 min-w-[200px] max-w-sm">
        <lucide-icon [img]="Search" class="absolute end-3 top-2.5 w-4 h-4 jr-faint"></lucide-icon>
        <input type="text" [(ngModel)]="term" (keyup.enter)="load()"
          [placeholder]="ar() ? 'اكتب الرقم واضغط Enter' : 'Type the number and press Enter'"
          class="jr-input w-full pe-9 ps-3 py-2 text-sm rounded-lg" />
      </div>
      <button type="button" (click)="load()"
        class="jr-go px-4 py-2 text-sm rounded-lg inline-flex items-center gap-2">
        <lucide-icon [img]="loading() ? Loader : RefreshCw" class="w-4 h-4" [class.animate-spin]="loading()"></lucide-icon>
        {{ ar() ? 'عرض' : 'Load' }}
      </button>
    </div>

    <p *ngIf="error()" class="jr-neg text-sm">{{ error() }}</p>

    <div *ngIf="notFound()" class="jr-warnbox rounded-xl p-4 text-sm">
      {{ ar() ? 'مفيش أوردر بالرقم ده.' : 'No order found for that number.' }}
    </div>

    <div *ngIf="!data() && !loading() && !error() && !notFound()" class="text-center py-16 jr-faint text-sm">
      {{ ar() ? 'اكتب رقم إيصال أو أوردر عشان تشوف رحلته.' : 'Enter a receipt or order number.' }}
    </div>

    <ng-container *ngIf="data() as d">
      <!-- ── Identity + headline ─────────────────────────────── -->
      <div class="jr-card p-4 md:p-5">
        <div class="flex justify-between items-start flex-wrap gap-3">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-lg font-semibold jr-ink">
                {{ d.receiptNumber ? (ar() ? 'إيصال #' : 'Receipt #') + d.receiptNumber
                                   : (ar() ? 'أوردر #' : 'Order #') + d.orderId }}
              </span>
              <span class="jr-badge quiet">{{ ar() ? d.transactionTypeAr : d.transactionType }}</span>
              <span class="jr-badge" [ngClass]="statusTone(d.status)">{{ ar() ? d.statusAr : d.status }}</span>
              <span *ngIf="d.paymentMethod" class="jr-badge" [ngClass]="d.isPaidOrder ? 'good' : 'warn'">
                {{ payAr(d.paymentMethod) }}<span *ngIf="!d.isPaidOrder"> · {{ ar() ? 'غير محصّل' : 'unpaid' }}</span>
              </span>
            </div>
            <div class="text-sm jr-muted mt-1.5 leading-7">
              <span *ngIf="d.tableName">{{ ar() ? 'ترابيزة' : 'Table' }} {{ d.tableName }} · </span>
              <span *ngIf="d.guestCount">{{ d.guestCount }} {{ ar() ? 'ضيف' : 'guests' }} · </span>
              <span *ngIf="d.waiterName">{{ ar() ? 'النادل' : 'Waiter' }}: {{ d.waiterName }} · </span>
              <span *ngIf="d.cashierName">{{ ar() ? 'الكاشير' : 'Cashier' }}: {{ d.cashierName }}</span>
              <span *ngIf="d.pilotName"> · {{ ar() ? 'الطيّار' : 'Pilot' }}: <b class="jr-ink">{{ d.pilotName }}</b></span>
            </div>
            <!-- pay-way change: the thing an owner wants flagged -->
            <div *ngIf="d.previousPaymentMethod"
              class="jr-warnbox mt-2 inline-flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-[10px]">
              {{ ar() ? 'اتغيرت طريقة الدفع:' : 'Payment method changed:' }}
              <bdi>{{ payAr(d.previousPaymentMethod) }} ← {{ payAr(d.paymentMethod) }}</bdi>
            </div>
          </div>
          <div class="text-start">
            <div class="text-xs jr-muted">{{ ar() ? 'الصافي' : 'Net' }}</div>
            <div class="text-2xl font-semibold jr-ink tabular-nums"><bdi>{{ money(d.money.net) }}</bdi></div>
            <div class="text-xs jr-faint mt-0.5">
              <bdi>{{ d.createdAt }}<span *ngIf="d.completedAt"> ← {{ d.completedAt }}</span></bdi>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Who carries this ──────────────────────────────────────────
           Only drawn when the order is not a plain paid sale. It keeps the two people apart
           an owner needs to tell apart: the officer who benefits, and the cashier who moved
           it there. -->
      <div *ngIf="d.accountability as acc" class="jr-card p-4 md:p-5"
           style="border-color:var(--warn-ring);background:var(--warn-soft)">
        <div class="font-medium jr-ink mb-3">{{ ar() ? 'مين يتحمّلها' : 'Who carries this' }}</div>
        <div class="flex flex-wrap gap-2">

          <!-- The pay-way move — to, and by whom. The FROM method is not stored reliably, so it is
               never shown: "changed to Officer", not a fabricated "Cash → Officer". -->
          <div *ngIf="acc.payWayTo" class="jr-inset flex-1 min-w-[180px] px-[11px] py-[9px]">
            <div class="text-[11px] jr-muted">{{ ar() ? 'اتغيرت طريقة الدفع لـ' : 'Payment changed to' }}</div>
            <div class="text-sm jr-ink mt-0.5"><bdi>{{ payAr(acc.payWayTo) }}</bdi></div>
            <div *ngIf="acc.changedBy" class="text-[11px] jr-faint mt-1">
              {{ ar() ? 'بواسطة' : 'by' }} <bdi class="jr-ink">{{ acc.changedBy }}</bdi>
              <bdi *ngIf="acc.changedAt"> · {{ acc.changedAt }}</bdi>
            </div>
          </div>

          <!-- The officer who benefits. -->
          <div *ngIf="acc.officerName" class="jr-inset flex-1 min-w-[160px] px-[11px] py-[9px]">
            <div class="text-[11px] jr-muted">{{ ar() ? 'على حساب الضابط' : 'On officer account' }}</div>
            <div class="text-sm jr-ink mt-0.5"><bdi>{{ acc.officerName }}</bdi></div>
            <div *ngIf="acc.paymentStatusExplanation" class="text-[11px] jr-faint mt-1">
              <bdi>{{ acc.paymentStatusExplanation }}</bdi>
            </div>
          </div>

          <!-- Booked as waste — made and charged but never served. -->
          <div *ngIf="acc.isOfficerWasted" class="jr-inset flex-1 min-w-[160px] px-[11px] py-[9px]"
               style="border-color:var(--bad-ring)">
            <div class="text-[11px] jr-warn-text">{{ ar() ? 'اتسجّل كهدر' : 'Booked as waste' }}</div>
            <div class="text-sm jr-ink mt-0.5">
              <bdi>{{ acc.wastedOfficerName || (ar() ? 'ضابط غير مسمّى' : 'unnamed officer') }}</bdi>
            </div>
            <div class="text-[11px] jr-faint mt-1">{{ ar() ? 'اتعمل واتحاسب من غير ما يتقدّم' : 'made and charged, never served' }}</div>
          </div>

          <!-- The bill requested more than once. -->
          <div *ngIf="acc.checkoutCount > 1" class="jr-inset flex-1 min-w-[140px] px-[11px] py-[9px]">
            <div class="text-[11px] jr-muted">{{ ar() ? 'طلب الحساب' : 'Bill requested' }}</div>
            <div class="text-sm jr-ink mt-0.5 tabular-nums">
              <bdi>{{ acc.checkoutCount }} {{ ar() ? 'مرّات' : 'times' }}</bdi>
            </div>
          </div>

          <!-- The full pay-way change SEQUENCE, when it changed more than once. Only the time and
               destination are shown — the per-change actor is not stored, so it is not claimed. -->
          <div *ngIf="acc.payWayChanges && acc.payWayChanges.length > 1" class="jr-inset w-full px-[11px] py-[9px]">
            <div class="text-[11px] jr-muted">
              {{ ar() ? 'طريقة الدفع اتغيرت' : 'Payment way changed' }} {{ acc.payWayChanges.length }} {{ ar() ? 'مرّات' : 'times' }}
            </div>
            <ol class="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
              <li *ngFor="let c of acc.payWayChanges; let i = index" class="flex items-center gap-1">
                <span *ngIf="i > 0" class="jr-faint">→</span>
                <span class="jr-ink"><bdi>{{ c.to ? payAr(c.to) : (ar() ? 'تغيير' : 'change') }}</bdi></span>
                <span class="jr-faint"><bdi>{{ c.at }}</bdi></span>
              </li>
            </ol>
          </div>
        </div>
      </div>

      <!-- ── Money path — how the bill got from the items to the net ──
           A running total per step, so the owner reads a chain rather than a
           column of numbers they have to add up themselves. -->
      <div class="jr-card p-4 md:p-5">
        <div class="flex items-baseline justify-between gap-3 flex-wrap mb-3">
          <div class="font-medium jr-ink">{{ ar() ? 'مسار المال' : 'Money path' }}</div>
          <div *ngIf="voidNote()" class="text-xs jr-muted">{{ voidNote() }}</div>
        </div>

        <div class="flex flex-wrap gap-2">
          <div *ngFor="let s of moneyFlow()" class="jr-inset flex-1 min-w-[118px] px-[11px] py-[9px]"
            [class.is-final]="s.final">
            <div class="text-[11px] jr-muted">
              <span *ngIf="s.sign" [ngClass]="s.sign === '−' ? 'jr-neg' : 'jr-pos'">{{ s.sign }}</span>
              {{ ar() ? s.labelAr : s.labelEn }}
            </div>
            <div class="text-base font-medium tabular-nums mt-0.5 jr-ink"><bdi>{{ money(s.running) }}</bdi></div>
            <div *ngIf="s.delta" class="text-[11px] tabular-nums mt-0.5"
              [ngClass]="s.delta < 0 ? 'jr-neg' : 'jr-pos'">
              <bdi>{{ s.delta > 0 ? '+' : '−' }}{{ money(abs(s.delta)) }}</bdi>
            </div>
          </div>
        </div>

        <!-- If the chain does not land on the stored net, say so rather than papering over it. -->
        <p *ngIf="flowMismatch() as gap" class="mt-3 text-xs jr-warn-text">
          {{ ar() ? 'الصافي المخزَّن يختلف عن مجموع الخطوات بفرق' : 'The stored net differs from the chain by' }}
          <bdi>{{ money(gap) }}</bdi>{{ ar() ? '. المعروض هو الصافي المخزَّن.' : '. The stored net is what is shown.' }}
        </p>

        <div class="text-sm mt-4 pt-3 jr-rule-t">
          <div class="flex justify-between py-1"><span class="jr-muted">{{ ar() ? 'قيمة الأصناف' : 'Items' }}</span><span class="tabular-nums jr-ink"><bdi>{{ money(d.money.itemsTotal) }}</bdi></span></div>
          <div class="flex justify-between py-1" *ngIf="d.money.discount"><span class="jr-muted">{{ ar() ? 'الخصم' : 'Discount' }}</span><span class="tabular-nums jr-neg"><bdi>− {{ money(d.money.discount) }}</bdi></span></div>
          <!-- Service is a dine-in concept. Printing it as 0.00 on a counter or courier
               receipt is noise, so it only appears where it can be non-zero. -->
          <div class="flex justify-between py-1" *ngIf="isDineIn() || d.money.service">
            <span class="jr-muted">{{ ar() ? 'الخدمة' : 'Service' }}</span>
            <span class="tabular-nums jr-ink"><bdi>{{ money(d.money.service) }}</bdi></span>
          </div>
          <div class="flex justify-between py-1">
            <span class="jr-muted">
              {{ ar() ? 'الضريبة' : 'Tax' }}<span *ngIf="d.money.taxRatio"> {{ num(d.money.taxRatio) }}%</span>
              <span class="text-xs jr-faint"> ({{ ar() ? 'أصناف' : 'items' }} {{ money(d.money.itemTax) }} + {{ ar() ? 'خدمة' : 'service' }} {{ money(d.money.serviceTax) }})</span>
            </span>
            <span class="tabular-nums jr-ink"><bdi>{{ money(d.money.totalTax) }}</bdi></span>
          </div>
          <!-- Minimum charge, shown as the comparison it actually is: the rate, what that
               came to for this many guests, and the top-up that reached the bill. A top-up
               of zero is a real answer ("the table spent enough"), so it is shown too. -->
          <ng-container *ngIf="d.money.minimumChargePerGuest">
            <div class="flex justify-between py-1">
              <span class="jr-muted">{{ ar() ? 'الحد الأدنى للضيف' : 'Minimum charge / guest' }}</span>
              <span class="tabular-nums jr-muted"><bdi>{{ money(d.money.minimumChargePerGuest) }}</bdi></span>
            </div>
            <div class="flex justify-between py-1" *ngIf="d.guestCount">
              <span class="jr-muted">
                {{ ar() ? 'المطلوب' : 'Required' }}
                <span class="text-xs jr-faint">({{ d.guestCount }} {{ ar() ? 'ضيف' : 'guests' }})</span>
              </span>
              <span class="tabular-nums jr-muted"><bdi>{{ money(minimumRequired()) }}</bdi></span>
            </div>
            <div class="flex justify-between py-1">
              <span class="jr-muted">{{ ar() ? 'الفرق المضاف' : 'Top-up added' }}</span>
              <span class="tabular-nums" [ngClass]="d.money.minimumChargeDifference ? 'jr-ink' : 'jr-faint'">
                <bdi>{{ money(d.money.minimumChargeDifference) }}</bdi>
              </span>
            </div>
            <!-- Which rule the comparison used. Without it the three numbers above are
                 unreadable: the same spend clears the minimum under one setting and
                 falls short under the other. -->
            <p *ngIf="d.money.minimumChargeIncludesTaxAndService !== null && d.money.minimumChargeIncludesTaxAndService !== undefined"
              class="text-xs jr-muted pb-1">
              {{ d.money.minimumChargeIncludesTaxAndService
                  ? (ar() ? 'الحد الأدنى يشمل الضريبة والخدمة — المقارنة تمت على الإجمالي شامل الضريبة والخدمة.'
                          : 'The minimum includes tax and service — compared against the all-in total.')
                  : (ar() ? 'الحد الأدنى لا يشمل الضريبة والخدمة — المقارنة تمت على قيمة الأصناف بعد الخصم.'
                          : 'The minimum excludes tax and service — compared against items after discount.') }}
            </p>
            <p *ngIf="!d.money.minimumChargeDifference" class="text-xs jr-faint pb-1">
              {{ ar() ? 'الطاولة صرفت أكتر من الحد الأدنى، فمفيش فرق اتضاف.'
                      : 'The table spent above the minimum, so nothing was added.' }}
            </p>
          </ng-container>
          <div class="flex justify-between py-1" *ngIf="d.money.addition"><span class="jr-muted">{{ ar() ? 'إضافات' : 'Addition' }}</span><span class="tabular-nums jr-ink"><bdi>{{ money(d.money.addition) }}</bdi></span></div>
          <div class="flex justify-between pt-2.5 mt-2 jr-rule-strong font-semibold text-base jr-ink">
            <span>{{ ar() ? 'الصافي' : 'Net' }}</span><span class="tabular-nums"><bdi>{{ money(d.money.net) }}</bdi></span>
          </div>
        </div>
      </div>

      <!-- ── The delivery leg — courier orders only ──────────── -->
      <div *ngIf="d.delivery as dv" class="jr-card p-4 md:p-5">
        <div class="font-medium jr-ink mb-3">{{ ar() ? 'التوصيل' : 'Delivery' }}</div>

        <div class="text-sm jr-muted leading-7">
          <span *ngIf="dv.customerName">{{ ar() ? 'العميل' : 'Customer' }}: <b class="jr-ink">{{ dv.customerName }}</b></span>
          <span *ngIf="dv.mobilePhone"> · <bdi>{{ dv.mobilePhone }}</bdi></span>
          <span *ngIf="dv.address"> · {{ dv.address }}</span>
          <span *ngIf="dv.onlineAppName"> · {{ ar() ? 'تطبيق' : 'App' }}: {{ dv.onlineAppName }}</span>
        </div>
        <div class="text-sm jr-muted mt-1" *ngIf="dv.pilotName">
          {{ ar() ? 'الطيّار' : 'Pilot' }}: <b class="jr-ink">{{ dv.pilotName }}</b>
        </div>

        <!-- Derived durations, only the ones the data can actually answer. Time on the road is
             absent by design: the pick-up stamp is never written, so it cannot be computed. -->
        <div class="flex flex-wrap gap-2 mt-3" *ngIf="dv.kitchenMinutes != null || dv.roundTripMinutes != null">
          <div *ngIf="dv.kitchenMinutes != null" class="jr-inset px-[11px] py-[9px] min-w-[120px]">
            <div class="text-[11px] jr-muted">{{ ar() ? 'في المطبخ' : 'In kitchen' }}</div>
            <div class="text-sm jr-ink mt-0.5 tabular-nums"><bdi>{{ num(dv.kitchenMinutes) }} {{ ar() ? 'دقيقة' : 'min' }}</bdi></div>
          </div>
          <div *ngIf="dv.roundTripMinutes != null" class="jr-inset px-[11px] py-[9px] min-w-[120px]">
            <div class="text-[11px] jr-muted">{{ ar() ? 'الرحلة كاملة' : 'Round trip' }}</div>
            <div class="text-sm jr-ink mt-0.5 tabular-nums"><bdi>{{ num(dv.roundTripMinutes) }} {{ ar() ? 'دقيقة' : 'min' }}</bdi></div>
          </div>
        </div>

        <!-- The four stamps the courier flow writes. A missing one is stated, not hidden:
             "no pick-up time" is exactly what an owner chasing a late order needs to see. -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 jr-rule-t">
          <div *ngFor="let st of deliveryStamps(dv)">
            <div class="text-xs jr-faint">{{ ar() ? st.labelAr : st.labelEn }}</div>
            <div class="text-sm mt-0.5" [ngClass]="st.value ? 'jr-ink' : 'jr-faint'">
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
        <div class="jr-card p-4">
          <div class="flex items-baseline justify-between gap-2 mb-2">
            <span class="text-sm font-medium jr-ink">
              {{ d.voidedItems.length ? (ar() ? 'الأصناف قبل الحذف' : 'Items before voids')
                                      : (ar() ? 'الأصناف' : 'Items') }}
            </span>
            <span class="text-[11px] jr-faint">{{ ar() ? 'كمية × سعر الوحدة' : 'qty × unit price' }}</span>
          </div>

          <div class="jr-list">
            <div *ngFor="let v of d.voidedItems" class="jr-hair flex justify-between gap-3 text-sm py-1.5">
              <span class="jr-void">
                {{ v.itemName }} <bdi>×{{ num(v.quantity) }}</bdi>
                <bdi *ngIf="v.quantity"> &#64; {{ money(v.price / v.quantity) }}</bdi>
              </span>
              <span class="jr-void tabular-nums"><bdi>{{ money(v.price) }}</bdi></span>
            </div>

            <div *ngFor="let it of d.items" class="jr-hair flex justify-between gap-3 text-sm py-1.5">
              <span class="jr-ink">
                {{ it.itemName }}<span *ngIf="it.variantName" class="jr-faint"> ({{ it.variantName }})</span>
                <bdi>×{{ num(it.quantity) }}</bdi><bdi class="jr-faint"> &#64; {{ money(it.unitPrice) }}</bdi>
              </span>
              <span class="tabular-nums jr-muted"><bdi>{{ money(it.lineTotal) }}</bdi></span>
            </div>
          </div>

          <p *ngIf="!d.items.length && !d.voidedItems.length" class="text-sm jr-faint py-3">
            {{ ar() ? 'مفيش أصناف مسجّلة على الأوردر ده.' : 'No item lines recorded for this order.' }}
          </p>
        </div>

        <div *ngIf="d.voidedItems.length" class="jr-card p-4">
          <div class="flex items-baseline justify-between gap-2 mb-2">
            <span class="text-sm font-medium jr-pos">{{ ar() ? 'الأصناف بعد الحذف' : 'Items after voids' }}</span>
            <span class="text-[11px] jr-faint">{{ ar() ? 'كمية × سعر الوحدة' : 'qty × unit price' }}</span>
          </div>
          <div class="jr-list">
            <div *ngFor="let it of d.items" class="jr-hair flex justify-between gap-3 text-sm py-1.5">
              <span class="jr-ink">
                {{ it.itemName }}<span *ngIf="it.variantName" class="jr-faint"> ({{ it.variantName }})</span>
                <bdi>×{{ num(it.quantity) }}</bdi><bdi class="jr-faint"> &#64; {{ money(it.unitPrice) }}</bdi>
              </span>
              <span class="tabular-nums jr-muted"><bdi>{{ money(it.lineTotal) }}</bdi></span>
            </div>
          </div>
          <div class="mt-2 pt-2 jr-rule-t">
            <div *ngFor="let v of d.voidedItems" class="text-xs jr-muted pt-1">
              {{ ar() ? 'اتشال' : 'Removed' }}: {{ v.itemName }}
              <span *ngIf="v.stageAr || v.stage">· {{ ar() ? v.stageAr : v.stage }}</span>
              <span *ngIf="v.voidedBy">· {{ v.voidedBy }}</span>
              <span *ngIf="v.reason">· {{ v.reason }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Every movement on the order ──────────────────────
           A row per action, each carrying its own effect on the money. The pill is
           the point when scanning: an owner reads the column and the expensive
           moments announce themselves. Opening a row answers the next question —
           WHICH items moved, and what the table looked like either side of it. -->
      <div class="jr-card p-4 md:p-5">
        <div class="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div class="font-medium jr-ink">{{ ar() ? 'كل حركات الأوردر' : 'Every movement on the order' }}</div>
          <button *ngIf="noiseCount() > 0" type="button" (click)="showNoise.set(!showNoise())"
            class="jr-toggle inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border"
            [class.is-on]="!showNoise()">
            <span class="jr-dot w-1.5 h-1.5 rounded-full"></span>
            {{ showNoise() ? (ar() ? 'كل الأحداث' : 'All events')
                           : (ar() ? 'أحداث المال فقط' : 'Money events only') }}
            <span class="opacity-60">({{ showNoise() ? visibleSteps().length : moneyStepCount() }})</span>
          </button>
        </div>

        <div *ngFor="let s of visibleSteps()" class="jr-ev rounded-xl overflow-hidden mb-2.5 last:mb-0"
          [ngClass]="toneClass(s)" [class.is-open]="isOpen(s.step)">

          <!-- Collapsed, the row says what it always said. The clip is one click away,
               never in the way of scanning the column. -->
          <button type="button" class="jr-ev-head flex items-start gap-3 w-full p-3 text-start"
            (click)="toggle(s.step)" [attr.aria-expanded]="isOpen(s.step)">

            <!-- The mark. Colour carries the kind of movement, so the eye groups sends,
                 removals and settlements without reading a word. -->
            <span class="jr-glyph shrink-0 w-8 h-8 rounded-[10px] grid place-items-center text-sm font-semibold">{{ stepGlyph(s) }}</span>

            <span class="flex-1 min-w-0">
              <span class="flex items-baseline gap-2 flex-wrap">
                <span class="text-sm font-semibold jr-ink">{{ ar() ? s.actionAr : s.action }}</span>
                <bdi class="text-[11.5px] jr-faint">{{ s.time || s.date }}</bdi>
                <span *ngIf="s.stage === 'Table'" class="jr-tag text-[11px] px-1.5 py-0.5 rounded">{{ ar() ? 'على الترابيزة' : 'table session' }}</span>
              </span>
              <span *ngIf="hasSub(s)" class="block mt-0.5 text-[13px] leading-[1.6] jr-muted">
                {{ detail(s) }}
                <bdi *ngIf="s.destinationName" class="jr-dest">→ {{ s.destinationName }}</bdi>
              </span>
            </span>

            <!-- What it did to the bill. "No change" is stated rather than left blank,
                 because a blank reads as missing data instead of as a real answer. -->
            <span class="jr-pill shrink-0 mt-1 rounded-full px-[11px] py-[3px] text-[11.5px] font-bold tabular-nums whitespace-nowrap"
              [ngClass]="deltaTone(s)"><bdi>{{ deltaLabel(s) }}</bdi></span>
            <lucide-icon [img]="ChevronDown" class="jr-chev shrink-0 mt-1.5 w-4 h-4"></lucide-icon>
          </button>

          <div class="jr-ev-body grid gap-3 px-3 pb-3" *ngIf="isOpen(s.step)">
            <p class="jr-inset text-[13px] leading-[1.85] jr-ink px-[11px] py-[9px]">{{ sentence(s) }}</p>

            <!-- ── The clip: the table before / what moved / what was left ── -->
            <ng-container *ngIf="clip(s) as c">
              <p *ngIf="c.note" class="jr-note text-[12.5px] leading-[1.7] jr-muted rounded-[10px] px-[11px] py-[9px]">{{ c.note }}</p>

              <div *ngIf="c.panels.length" class="jr-clip" [class.is-solo]="c.panels.length === 1">
                <div *ngFor="let p of c.panels" class="jr-panel jr-inset p-2.5" [class.is-moved]="p.moved">
                  <div class="jr-rule-b flex items-baseline justify-between gap-2 pb-[7px]">
                    <span class="jr-panel-title text-xs font-bold">{{ p.title }}</span>
                    <span class="text-[11px] jr-faint tabular-nums"><bdi>{{ p.items.length }}</bdi></span>
                  </div>

                  <div class="jr-line flex items-start justify-between gap-2.5 py-1.5" *ngFor="let it of p.items">
                    <span class="min-w-0 text-[12.5px] leading-normal jr-ink">
                      {{ it.itemName }}<span *ngIf="it.variantName" class="jr-faint"> ({{ it.variantName }})</span>
                      <bdi class="block mt-px text-[11px] jr-muted tabular-nums">×{{ num(it.quantity) }} &#64; {{ money(it.unitPrice) }}</bdi>
                    </span>
                    <bdi class="shrink-0 text-[12.5px] font-semibold jr-ink tabular-nums">{{ money(it.lineTotal) }}</bdi>
                  </div>

                  <p *ngIf="!p.items.length" class="py-2 text-xs jr-faint">
                    {{ ar() ? 'مفيش أصناف هنا.' : 'Nothing here.' }}
                  </p>

                  <div class="jr-rule-strong flex justify-between gap-2.5 mt-2 pt-[7px] text-xs font-bold jr-ink tabular-nums">
                    <span>{{ ar() ? 'الإجمالي' : 'Total' }}</span>
                    <bdi>{{ cash(p.total) }}</bdi>
                  </div>

                  <!-- Said out loud rather than hidden: these two sides were reconstructed,
                       so a figure that disagrees with the kitchen stays explainable. -->
                  <p *ngIf="p.derived" class="mt-1.5 text-[10.5px] leading-normal jr-faint">
                    {{ ar() ? 'محسوبة من الحركات السابقة' : 'derived from earlier events' }}
                  </p>
                </div>
              </div>

              <div *ngIf="c.chips.length" class="flex flex-wrap gap-2">
                <div class="jr-inset min-w-[104px] px-2.5 py-1.5" *ngFor="let ch of c.chips">
                  <div class="text-[11px] jr-muted">{{ ar() ? ch.labelAr : ch.labelEn }}</div>
                  <div class="mt-px text-[13px] font-semibold jr-ink"><bdi>{{ ch.value }}</bdi></div>
                </div>
              </div>
            </ng-container>

            <!-- ── before → after → difference ── -->
            <div *ngIf="hasStrip(s); else noStrip" class="grid grid-cols-3 gap-2">
              <div class="jr-inset px-2.5 py-[7px]">
                <div class="text-[11px] jr-muted">{{ ar() ? 'قبل' : 'Before' }}</div>
                <div class="mt-px text-[13px] font-bold jr-ink tabular-nums"><bdi>{{ cash(stripBefore(s)) }}</bdi></div>
              </div>
              <div class="jr-inset px-2.5 py-[7px]">
                <div class="text-[11px] jr-muted">{{ ar() ? 'بعد' : 'After' }}</div>
                <div class="mt-px text-[13px] font-bold jr-ink tabular-nums"><bdi>{{ cash(stripAfter(s)) }}</bdi></div>
              </div>
              <div class="jr-inset px-2.5 py-[7px]">
                <div class="text-[11px] jr-muted">{{ ar() ? 'الفرق' : 'Difference' }}</div>
                <div class="jr-diff mt-px text-[13px] font-bold tabular-nums" [ngClass]="deltaTone(s)"><bdi>{{ diffLabel(s) }}</bdi></div>
              </div>
            </div>
            <ng-template #noStrip>
              <p class="jr-note text-[12.5px] leading-[1.7] jr-muted rounded-[10px] px-[11px] py-[9px]">
                {{ ar() ? 'الحركة دي مفيش عليها أرقام صافي متسجّلة، فمش هنخمّن.'
                        : 'No trustworthy net figures were recorded for this movement, so none are shown.' }}
              </p>
            </ng-template>

            <details *ngIf="s.description" class="jr-inset">
              <summary class="jr-summary cursor-pointer px-[11px] py-[7px] text-xs jr-muted">{{ ar() ? 'تفاصيل تقنية' : 'Technical detail' }}</summary>
              <div class="px-[11px] py-[9px] text-[11.5px] leading-[1.7] jr-muted font-mono break-words">
                <bdi>{{ s.description }}</bdi>
              </div>
            </details>
          </div>
        </div>
      </div>
    </ng-container>
  </div>
  `,
  styles: [`
    /* The page's warm palette lives in src/styles.css, scoped to app-journey. Component
       styles are budgeted per component and a two-mode token set is page theming, not
       component styling — keeping it here spent the budget without owning anything. */
    :host{display:block}

    .jr-card{background:var(--card);border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow)}
    /* Every quiet inset box on the page shares one recipe. */
    .jr-inset{border:1px solid var(--border);border-radius:10px;background:var(--card-2)}
    .jr-inset.is-final{border-color:var(--brand-ring);background:var(--brand-soft)}
    .jr-note{background:var(--bg-2);border:1px dashed var(--border-strong)}
    .jr-rule-t{border-top:1px solid var(--border)}
    .jr-rule-b{border-bottom:1px solid var(--border)}
    .jr-rule-strong{border-top:1px solid var(--border-strong)}
    /* Hairline between rows, never under the last one. Tailwind's last:border-0 loses
       here: component styles are injected after the global sheet. */
    .jr-hair{border-bottom:1px solid var(--border)}
    .jr-list>.jr-hair:last-child{border-bottom:0}
    .jr-void{color:var(--bad);opacity:.78;text-decoration:line-through}

    .jr-badge{font-size:11.5px;font-weight:600;padding:3px 9px;border-radius:999px;white-space:nowrap}
    .jr-badge.quiet{color:var(--muted);background:var(--bg-2)}
    .jr-badge.good{color:var(--good);background:var(--good-soft)}
    .jr-badge.warn{color:var(--warn);background:var(--warn-soft)}
    .jr-badge.bad{color:var(--bad);background:var(--bad-soft)}
    .jr-tag{background:var(--bg-2);color:var(--muted)}
    .jr-warnbox{color:var(--warn);background:var(--warn-soft);border:1px solid var(--warn-ring)}

    .jr-seg{border:1px solid var(--border);background:var(--card)}
    .jr-seg-btn{color:var(--muted)}
    .jr-seg-btn.is-on{background:var(--ink);color:var(--card)}
    .jr-seg-split{border-inline-end:1px solid var(--border)}
    .jr-input{border:1px solid var(--border);background:var(--card);color:var(--ink)}
    .jr-input::placeholder{color:var(--faint)}
    .jr-input:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-ring)}
    .jr-go{background:var(--ink);color:var(--card)} .jr-go:hover{opacity:.9}
    .jr-toggle{border-color:var(--border-strong);background:var(--card-2);color:var(--muted);
      transition:color .18s ease-out,background-color .18s ease-out,border-color .18s ease-out}
    .jr-toggle.is-on{border-color:var(--good-ring);background:var(--good-soft);color:var(--good)}
    .jr-dot{background:var(--faint)} .jr-toggle.is-on .jr-dot{background:var(--good)}

    .jr-ev{border:1px solid var(--border);background:var(--card);
      transition:border-color .18s ease-out,box-shadow .18s ease-out}
    .jr-ev.is-open{border-color:var(--tone-ring);box-shadow:0 12px 28px -20px rgba(30,27,20,.55)}
    .jr-ev-head{cursor:pointer;transition:background-color .18s ease-out}
    .jr-ev-head:hover{background:var(--card-2)}
    .jr-ev-head:focus-visible{outline:2px solid var(--tone-ring);outline-offset:-3px}
    .jr-glyph{color:var(--tone);background:var(--tone-soft)}
    .jr-dest{color:var(--tone);font-weight:600;white-space:nowrap}
    .jr-chev{display:inline-flex;color:var(--faint);transition:transform .18s ease-out}
    .jr-ev.is-open .jr-chev{transform:rotate(180deg)}

    /* Revealed content rises into place. Opacity and transform only — animating the
       height of a list this long janks on the tablets these reports run on. */
    @keyframes posrise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    .jr-ev-body{animation:posrise .22s cubic-bezier(.22,.61,.36,1) both}

    .jr-clip{display:grid;gap:10px;grid-template-columns:minmax(0,1fr)}
    @media (min-width:900px){.jr-clip{grid-template-columns:repeat(3,minmax(0,1fr))}}
    /* Two classes beat the media query's one, so a solo panel stays single-column at
       every width without depending on rule order. */
    .jr-clip.is-solo{grid-template-columns:minmax(0,1fr)}
    .jr-clip.is-solo .jr-panel{max-width:640px}
    .jr-panel-title{color:var(--muted)}
    .jr-line+.jr-line{border-top:1px solid var(--border)}
    .jr-panel.is-moved{border-color:var(--tone-ring);background:var(--tone-soft)}
    .jr-panel.is-moved .jr-panel-title{color:var(--tone)}
    .jr-panel.is-moved .jr-rule-b{border-bottom-color:var(--tone-ring)}
    .jr-panel.is-moved .jr-rule-strong,.jr-panel.is-moved .jr-line+.jr-line{border-top-color:var(--tone-ring)}

    .jr-pill.up,.jr-diff.up{color:var(--good)} .jr-pill.up{background:var(--good-soft)}
    .jr-pill.down,.jr-diff.down{color:var(--bad)} .jr-pill.down{background:var(--bad-soft)}
    .jr-pill.flat,.jr-diff.flat{color:var(--faint)} .jr-pill.flat{background:var(--bg-2)}
    .jr-summary+div{border-top:1px solid var(--border)}

    @media (prefers-reduced-motion:reduce){
      .jr-ev-body{animation:none}
      .jr-chev,.jr-ev,.jr-ev-head,.jr-toggle{transition:none}}
  `],
})
export class JourneyComponent {
  protected readonly Search = Search;
  protected readonly Loader = Loader;
  protected readonly RefreshCw = RefreshCw;
  protected readonly ChevronDown = ChevronDown;

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

  /** Which rows are open, keyed by step number. Replaced (never mutated) so OnPush sees it. */
  private readonly expanded = signal<ReadonlySet<number>>(new Set<number>());

  protected readonly noiseCount = computed(() => (this.data()?.timeline ?? []).filter(s => s.isNoise).length);
  protected readonly visibleSteps = computed(() => {
    const steps = this.data()?.timeline ?? [];
    return this.showNoise() ? steps : steps.filter(s => !s.isNoise);
  });

  /**
   * Clips built once per payload (and per language) rather than per change-detection
   * pass. Building them inline would hand *ngFor a fresh array on every tick, which
   * tears down and re-creates the item rows — and restarts the reveal animation.
   */
  private readonly clips = computed<ReadonlyMap<number, ClipView>>(() => {
    const ar = this.lang.language() === 'ar';
    const map = new Map<number, ClipView>();
    for (const s of this.data()?.timeline ?? []) {
      if (s.movement) { map.set(s.step, this.buildClip(s.movement, ar)); }
    }
    return map;
  });

  constructor() {
    const p = this.route.snapshot.queryParamMap;
    const rcpt = p.get('receipt');
    const oid = p.get('orderId');
    if (oid) { this.by.set('order'); this.term = oid; this.load(); }
    else if (rcpt) { this.by.set('receipt'); this.term = rcpt; this.load(); }
  }

  protected ar(): boolean { return this.lang.language() === 'ar'; }

  // ── Expansion ──────────────────────────────────────────────────────

  protected isOpen(step: number): boolean { return this.expanded().has(step); }

  protected toggle(step: number): void {
    const next = new Set(this.expanded());
    if (!next.delete(step)) { next.add(step); }
    this.expanded.set(next);
  }

  // ── The clip ───────────────────────────────────────────────────────

  protected clip(s: JourneyStep): ClipView | null {
    return this.clips().get(s.step) ?? null;
  }

  /**
   * Turn a movement into the panels worth drawing. Three boxes are only honest when
   * there was a before and an after to compare; anything less says so in words.
   */
  private buildClip(m: JourneyMovement, ar: boolean): ClipView {
    const before = m.before ?? [];
    const moved = m.moved ?? [];
    const after = m.after ?? [];
    const chips = m.chips ?? [];
    const reason = (ar ? m.unavailableReasonAr : (m.unavailableReasonEn || m.unavailableReasonAr)) || '';

    // Nothing was logged. An empty table would read as "this movement touched no
    // items", which is a different — and wrong — claim than "we do not know".
    if (!before.length && !moved.length && !after.length) {
      return {
        note: reason || (ar
          ? 'مفيش تفاصيل أصناف اتسجلت للحركة دي.'
          : 'No item detail was recorded for this movement.'),
        panels: [],
        chips,
      };
    }

    const movedPanel: ClipPanel = {
      title: ar ? m.movedHeadingAr : (m.movedHeadingEn || m.movedHeadingAr),
      items: moved,
      total: this.num(m.movedTotal),
      moved: true,
      derived: false,
    };

    // A first send has no "before" and leaves nothing behind. Framing it with two
    // empty boxes invents a comparison the data never made.
    if (!before.length && !after.length) {
      return { note: reason, panels: [movedPanel], chips };
    }

    return {
      note: reason,
      panels: [
        {
          title: ar ? 'الترابيزة كانت فيها' : 'The table had',
          items: before, total: this.num(m.beforeTotal), moved: false, derived: !!m.beforeAfterDerived,
        },
        movedPanel,
        {
          title: ar ? 'اللي فضل' : 'What was left',
          items: after, total: this.num(m.afterTotal), moved: false, derived: !!m.beforeAfterDerived,
        },
      ],
      chips,
    };
  }

  // ── Money on one step ──────────────────────────────────────────────

  /** Whether the before/after/difference strip has anything trustworthy to show. */
  protected hasStrip(s: JourneyStep): boolean { return s.hasMoneyDelta && !!s.details; }

  protected stripBefore(s: JourneyStep): number { return this.delta(s)?.before ?? 0; }
  protected stripAfter(s: JourneyStep): number { return this.delta(s)?.after ?? 0; }

  protected diffLabel(s: JourneyStep): string {
    const d = this.deltaOf(s);
    if (!d) { return this.ar() ? 'من غير تغيير' : 'No change'; }
    return `${d > 0 ? '+' : '−'}${this.money(this.abs(d))} ج.م`;
  }

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

  /** The pill's tone. Green up, red down, quiet for a step that moved nothing. */
  protected deltaTone(s: JourneyStep): string {
    const d = this.deltaOf(s);
    if (d > 0) { return 'up'; }
    if (d < 0) { return 'down'; }
    return 'flat';
  }

  /** The pill's text. "No change" is a real answer and is said, not left blank. */
  protected deltaLabel(s: JourneyStep): string {
    const d = this.deltaOf(s);
    if (!d) { return this.ar() ? 'من غير تغيير' : 'No change'; }
    const sign = d > 0 ? '+' : '−';
    return this.ar() ? `${sign}${this.money(this.abs(d))} ج.م` : `${sign}${this.money(this.abs(d))}`;
  }

  /** Whether the collapsed row has a second line at all. */
  protected hasSub(s: JourneyStep): boolean { return !!this.detail(s) || !!s.destinationName; }

  /** The row's second line: who did it and what it touched, without repeating the title. */
  protected detail(s: JourneyStep): string {
    const parts: string[] = [];
    const what = this.summary(s);
    if (what) { parts.push(what); }
    if (s.userName) { parts.push(s.userName); }
    // The waiter a movement belongs to is often not the user who pressed the button —
    // a cashier can send for someone else's table. Naming both keeps the row answerable.
    const waiter = (s.waiterName || '').trim();
    if (waiter && waiter !== (s.userName || '').trim()) {
      parts.push(this.ar() ? `النادل: ${waiter}` : `waiter: ${waiter}`);
    }
    return parts.join(' · ');
  }

  /**
   * What the event is, as the server classified it. `movement.kind` is the deliberate
   * answer ('Send', 'VoidItem', 'Transfer', …); the log action is a fallback for the
   * rows that move no items and therefore carry no movement at all.
   */
  private kindOf(s: JourneyStep): string { return (s.movement?.kind || '').trim() || s.action; }

  /**
   * A single character standing in for the kind of movement. Deliberately not an icon
   * font: these render identically in a printed receipt and an exported PDF, which the
   * report pages are routinely turned into.
   */
  protected stepGlyph(s: JourneyStep): string {
    const a = this.kindOf(s).toLowerCase();
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

  /**
   * The event's tone. Indigo is kept for the workhorse send, orange for the structural
   * moves (transfer / split) that relocate money rather than change it, green for money
   * landing, red for money leaving, amber for a changed term.
   */
  protected tone(action: string): 'neutral' | 'brand' | 'good' | 'warn' | 'high' | 'bad' {
    const a = (action || '').toLowerCase();
    if (a.includes('sent') || a.includes('send')) { return 'brand'; }
    if (a.includes('transfer') || a.includes('split')) { return 'high'; }
    if (a.includes('void') || a.includes('cancel')) { return 'bad'; }
    if (a.includes('checked') || a.includes('checkout')) { return 'good'; }
    if (a.includes('paid') || a.includes('collect') || a.includes('closed table')) { return 'good'; }
    if (a.includes('pilot') || a.includes('driver') || a.includes('assign')) { return 'brand'; }
    if (a.includes('discount') || a.includes('promo') || a.includes('change')) { return 'warn'; }
    return 'neutral';
  }

  protected toneClass(s: JourneyStep): string { return `tone-${this.tone(this.kindOf(s))}`; }

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
    // A new order is a new set of rows — carrying the open ones over would open
    // arbitrary steps on the next order that happen to share a step number.
    this.expanded.set(new Set<number>());
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

  protected statusTone(status: string): string {
    const s = (status || '').toLowerCase();
    if (s.includes('complete') || s.includes('paid') || s.includes('deliver')) { return 'good'; }
    if (s.includes('cancel')) { return 'bad'; }
    return 'quiet';
  }

  /** Western digits, 2dp, in both languages — money must align and export cleanly. */
  protected money(n: number | null | undefined): string {
    const v = Math.round((n ?? 0) * 100) / 100;
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  /** Money that carries its unit — used inside the clip, where a bare number is ambiguous. */
  protected cash(n: number | null | undefined): string { return `${this.money(n)} ج.م`; }
  protected num(n: number | null | undefined): number { return Math.round((n ?? 0) * 100) / 100; }
  protected abs(n: number): number { return Math.abs(n); }
}
