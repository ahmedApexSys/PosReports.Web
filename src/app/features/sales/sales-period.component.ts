import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabularReportPageComponent } from '../../shared/tabular-report-page/tabular-report-page.component';
import { ReportDef } from '../../core/models/sales-report.models';

/**
 * Daily Sales — the flagship per-order sales report (POST
 * DailySalesController/getDailySalesReport). This is the same report as the
 * legacy "Daily Sales Reports": one row per order with the full money + timing
 * breakdown and a server-computed Totals footer, so Paid/Unpaid/All row counts
 * are additive and correct (the old grouped SalePeriod endpoint merged paid &
 * unpaid rows on the same day, which made counts look wrong).
 *
 * Rendered entirely by the generic TabularReportPage from this column config —
 * with the full filter bar, drag-to-reorder columns (saved per user), and the
 * print (A4 / POS) + export (Excel / PDF / CSV) + Flash report toolbar.
 */
@Component({
  selector: 'app-sales-period',
  standalone: true,
  imports: [CommonModule, TabularReportPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-tabular-report-page [def]="def"></app-tabular-report-page>`,
})
export class SalesPeriodComponent {
  readonly def: ReportDef = {
    id: 'sales-daily',
    titleEn: 'Daily Sales',
    titleAr: 'المبيعات اليومية',
    subtitleEn: 'One row per order — full money & timing breakdown with totals',
    subtitleAr: 'صف لكل أوردر — تفصيل كامل للمبالغ والأوقات مع الإجماليات',
    endpoint: 'DailySalesController/getDailySalesReport',
    defaultOrdersFilter: 'Paid',
    // Each row IS one order, so clicking it opens that order's full journey.
    drilldown: {
      route: '/journey', param: 'orderId', rowKey: 'orderId',
      titleEn: 'Open this order — items, money and full timeline',
      titleAr: 'افتح تفاصيل الأوردر — الأصناف والمبالغ والرحلة كاملة',
    },
    filters: ['payment', 'transaction', 'shift', 'discount', 'promo', 'voucher', 'onlineApp', 'user', 'waiter', 'pilot'],
    columns: [
      { key: 'orderId',                 labelEn: 'Order #',         labelAr: 'رقم الأوردر',    type: 'id',    width: 9 },
      { key: 'branchName',              labelEn: 'Branch',          labelAr: 'الفرع',          type: 'text',  defaultHidden: true, width: 16 },
      { key: 'transaction',             labelEn: 'Transaction',     labelAr: 'المعاملة',       type: 'text',  width: 12 },
      { key: 'orderDate',               labelEn: 'Date',            labelAr: 'التاريخ',        type: 'text',  width: 12 },
      { key: 'orderTime',               labelEn: 'Time',            labelAr: 'الوقت',          type: 'text',  width: 11 },
      { key: 'guestNo',                 labelEn: 'Guests',          labelAr: 'ضيوف',           type: 'int',   totalKey: 'guestNo', width: 8 },
      { key: 'printNo',                 labelEn: 'Prints',          labelAr: 'طباعات',         type: 'int',   totalKey: 'printNo', width: 8 },
      { key: 'prepareTime',             labelEn: 'Prepare Time',    labelAr: 'وقت التحضير',    type: 'text',  defaultHidden: true, width: 11 },
      { key: 'pickUpTime',              labelEn: 'Pick Up Time',    labelAr: 'وقت الاستلام',   type: 'text',  defaultHidden: true, width: 11 },
      { key: 'assignTime',              labelEn: 'Assign Time',     labelAr: 'وقت الإسناد',    type: 'text',  defaultHidden: true, width: 11 },
      { key: 'returnTime',              labelEn: 'Return Time',     labelAr: 'وقت العودة',     type: 'text',  defaultHidden: true, width: 11 },
      { key: 'totalSales',              labelEn: 'Sub Total',       labelAr: 'الإجمالي الفرعي', type: 'money', totalKey: 'totalSales', width: 12 },
      { key: 'totalCommercialDiscount', labelEn: 'Commercial Disc', labelAr: 'خصم تجاري',      type: 'money', totalKey: 'totalCommercialDiscount', width: 12 },
      { key: 'services',                labelEn: 'Service',         labelAr: 'خدمة',           type: 'money', totalKey: 'services', width: 10 },
      { key: 'totalTax',                labelEn: 'Tax',             labelAr: 'ضريبة',          type: 'money', totalKey: 'totalTax', width: 10 },
      { key: 'totalItemDiscount',       labelEn: 'Item Discount',   labelAr: 'خصم أصناف',      type: 'money', totalKey: 'totalItemDiscount', width: 12 },
      { key: 'extraDiscount',           labelEn: 'Extra Discount',  labelAr: 'خصم إضافي',      type: 'money', totalKey: 'extraDiscount', width: 12 },
      { key: 'minimumChargeValue',      labelEn: 'Min Charge',      labelAr: 'حد أدنى',        type: 'money', defaultHidden: true, width: 10 },
      { key: 'additionValue',           labelEn: 'Addition',        labelAr: 'إضافة',          type: 'money', defaultHidden: true, width: 10 },
      { key: 'promoCodeValue',          labelEn: 'Promo Value',     labelAr: 'قيمة البرومو',   type: 'money', totalKey: 'promoCodeAmount', width: 11 },
      { key: 'voucherAmount',           labelEn: 'Voucher',         labelAr: 'قسيمة',          type: 'money', totalKey: 'voucher', width: 10 },
      { key: 'total',                   labelEn: 'Total',           labelAr: 'الإجمالي',       type: 'money', width: 12 },
      { key: 'net',                     labelEn: 'Net',             labelAr: 'صافي',           type: 'money', totalKey: 'net', width: 12 },
      { key: 'cash',                    labelEn: 'Cash',            labelAr: 'كاش',            type: 'money', totalKey: 'cash', width: 11 },
      { key: 'visa',                    labelEn: 'Visa',            labelAr: 'فيزا',           type: 'money', totalKey: 'visa', width: 11 },
      // The server DTO property is CL, which the camelCase resolver puts on the wire as "cl" — the
      // same key the payload actually carries (verified: no [JsonProperty] override). This column
      // read "cL", which matches nothing, so آجل and its footer total were blank on every order.
      { key: 'cl',                      labelEn: 'Ledge',           labelAr: 'آجل',            type: 'money', totalKey: 'cl', width: 11 },
      { key: 'otherPayment',            labelEn: 'Other Pay',       labelAr: 'دفع آخر',        type: 'money', totalKey: 'otherPayment', width: 11 },
      { key: 'paymentStatus',           labelEn: 'Pay Way',         labelAr: 'طريقة الدفع',    type: 'text',  width: 11 },
      { key: 'promoCode',               labelEn: 'Promo Code',      labelAr: 'كود البرومو',    type: 'text',  defaultHidden: true, width: 11 },
      { key: 'promoCodeName',           labelEn: 'Promo Name',      labelAr: 'اسم البرومو',    type: 'text',  defaultHidden: true, width: 11 },
      { key: 'voucherName',             labelEn: 'Voucher Code',    labelAr: 'كود القسيمة',    type: 'text',  defaultHidden: true, width: 11 },
      { key: 'discountName',            labelEn: 'Discount',        labelAr: 'الخصم',          type: 'text',  defaultHidden: true, width: 12 },
      { key: 'waiterName',              labelEn: 'Waiter',          labelAr: 'الويتر',         type: 'text',  defaultHidden: true, width: 12 },
      { key: 'orderedBy',               labelEn: 'Ordered By',      labelAr: 'بواسطة',         type: 'text',  defaultHidden: true, width: 12 },
      { key: 'poiltName',               labelEn: 'Pilot',           labelAr: 'الطيار',         type: 'text',  defaultHidden: true, width: 12 },
      { key: 'onlineAppName',           labelEn: 'Online App',      labelAr: 'تطبيق أونلاين',  type: 'text',  defaultHidden: true, width: 12 },
      { key: 'tableName',               labelEn: 'Table',           labelAr: 'الطاولة',        type: 'text',  defaultHidden: true, width: 10 },
    ],
  };
}
