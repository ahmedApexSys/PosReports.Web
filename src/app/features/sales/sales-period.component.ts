import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabularReportPageComponent } from '../../shared/tabular-report-page/tabular-report-page.component';
import { ReportDef } from '../../core/models/sales-report.models';

/**
 * Sales Period — the flagship "Daily Sales" report (POST SalePeriod/GetPeriodSalesByOrderDate),
 * grouped by day + transaction with a full money breakdown and a totals footer.
 * Rendered entirely by the generic TabularReportPage from this column config.
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
    titleEn: 'Sales Period',
    titleAr: 'مبيعات الفترة',
    subtitleEn: 'Daily sales grouped by day + transaction, with full money breakdown',
    subtitleAr: 'مبيعات يومية مجمّعة حسب اليوم ونوع المعاملة، بتفصيل كامل للمبالغ',
    endpoint: 'SalePeriod/GetPeriodSalesByOrderDate',
    defaultOrdersFilter: 'Paid',
    columns: [
      { key: 'orderDate',               labelEn: 'Date',           labelAr: 'التاريخ',        type: 'text' },
      { key: 'orderTime',               labelEn: 'Time',           labelAr: 'الوقت',          type: 'text' },
      { key: 'transactionName',         labelEn: 'Transaction',    labelAr: 'المعاملة',       type: 'text' },
      { key: 'branchName',              labelEn: 'Branch',         labelAr: 'الفرع',          type: 'text', defaultHidden: true },
      { key: 'shiftOrderId',            labelEn: 'Order #',        labelAr: 'رقم الأوردر',    type: 'int' },
      { key: 'guestNo',                 labelEn: 'Guests',         labelAr: 'ضيوف',           type: 'int',   totalKey: 'ordersCout' },
      { key: 'printNo',                 labelEn: 'Prints',         labelAr: 'طباعات',         type: 'int',   totalKey: 'printNo' },
      { key: 'totalSales',              labelEn: 'Total Sales',    labelAr: 'إجمالي المبيعات', type: 'money', totalKey: 'totalSales' },
      { key: 'services',                labelEn: 'Service',        labelAr: 'خدمة',           type: 'money', totalKey: 'services' },
      { key: 'totalTax',                labelEn: 'Tax',            labelAr: 'ضريبة',          type: 'money', totalKey: 'totalTax' },
      { key: 'totalItemDiscount',       labelEn: 'Item Discount',  labelAr: 'خصم أصناف',      type: 'money', totalKey: 'totalItemDiscount' },
      { key: 'totalCommercialDiscount', labelEn: 'Commercial Disc',labelAr: 'خصم تجاري',      type: 'money', totalKey: 'totalCommercialDiscount' },
      { key: 'extraDiscount',           labelEn: 'Extra Discount', labelAr: 'خصم إضافي',      type: 'money', totalKey: 'extraDiscount' },
      { key: 'promoCodeValue',          labelEn: 'Promo Value',    labelAr: 'قيمة البرومو',   type: 'money', totalKey: 'promoCode' },
      { key: 'voucherAmount',           labelEn: 'Voucher',        labelAr: 'قسيمة',          type: 'money', totalKey: 'voucher' },
      { key: 'minimumChargeValue',      labelEn: 'Min Charge',     labelAr: 'حد أدنى',        type: 'money', defaultHidden: true },
      { key: 'additionValue',           labelEn: 'Addition',       labelAr: 'إضافة',          type: 'money', defaultHidden: true },
      { key: 'net',                     labelEn: 'Net',            labelAr: 'صافي',           type: 'money', totalKey: 'net' },
      { key: 'cash',                    labelEn: 'Cash',           labelAr: 'كاش',            type: 'money', totalKey: 'cash' },
      { key: 'visa',                    labelEn: 'Visa',           labelAr: 'فيزا',           type: 'money', totalKey: 'visa' },
      { key: 'cL',                      labelEn: 'Ledge',          labelAr: 'آجل',            type: 'money', totalKey: 'cL' },
      { key: 'otherPayment',            labelEn: 'Other Pay',      labelAr: 'دفع آخر',        type: 'money', totalKey: 'otherPayment' },
      { key: 'paymentStatus',           labelEn: 'Pay Way',        labelAr: 'طريقة الدفع',    type: 'text' },
      { key: 'promoCode',               labelEn: 'Promo Code',     labelAr: 'كود البرومو',    type: 'text', defaultHidden: true },
      { key: 'voucherName',             labelEn: 'Voucher Code',   labelAr: 'كود القسيمة',    type: 'text', defaultHidden: true },
      { key: 'discountName',            labelEn: 'Discount',       labelAr: 'الخصم',          type: 'text', defaultHidden: true },
      { key: 'waiterName',              labelEn: 'Waiter',         labelAr: 'الويتر',         type: 'text', defaultHidden: true },
      { key: 'orderedBy',               labelEn: 'Ordered By',     labelAr: 'بواسطة',         type: 'text', defaultHidden: true },
      { key: 'poiltName',               labelEn: 'Pilot',          labelAr: 'الطيار',         type: 'text', defaultHidden: true },
      { key: 'onlineAppName',           labelEn: 'Online App',     labelAr: 'تطبيق أونلاين',  type: 'text', defaultHidden: true },
      { key: 'tableName',               labelEn: 'Table',          labelAr: 'الطاولة',        type: 'text', defaultHidden: true },
      { key: 'mobilePhone',             labelEn: 'Mobile',         labelAr: 'موبايل',         type: 'text', defaultHidden: true },
      { key: 'remarks',                 labelEn: 'Remarks',        labelAr: 'ملاحظات',        type: 'text', defaultHidden: true },
    ],
  };
}
