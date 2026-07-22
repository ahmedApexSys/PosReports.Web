import { ExportColumn } from './export.service';
import {
  actionLabel, sourceLabel, entityNameLabel, txTypeLabel, orderActionDescription,
} from '../i18n/monitoring-labels';
import { UnifiedAuditLog, OrderActionLogRow } from '../models/monitoring.models';
import { ApiEndpointStat } from '../models/api-traffic.models';

/** Pull the numeric Net out of a "Sales:.. Net:.. Total:.." snapshot string. */
function parseNet(s: string | null | undefined): number | string {
  const m = /Net:\s*([\d.]+)/i.exec(s || '');
  return m ? +m[1] : '';
}

function statusTone(success: boolean): 'good' | 'bad' { return success ? 'good' : 'bad'; }
function statusText(success: boolean, l: 'en' | 'ar'): string {
  return success ? (l === 'ar' ? 'ناجح' : 'Success') : (l === 'ar' ? 'فشل' : 'Failed');
}

/** Columns for the unified activity feed (AuditReport/Timeline rows). */
export function unifiedAuditExportColumns(): ExportColumn<UnifiedAuditLog>[] {
  return [
    { headerEn: 'Date', headerAr: 'التاريخ', width: 12, value: r => (r.actionDate || '').slice(0, 10) },
    { headerEn: 'Time', headerAr: 'الوقت', width: 11, value: r => r.actionTime },
    { headerEn: 'Source', headerAr: 'المصدر', width: 12, value: (r, l) => sourceLabel(r.logSource, l) },
    { headerEn: 'Action', headerAr: 'الإجراء', width: 16, value: (r, l) => actionLabel(r.actionType, l) },
    { headerEn: 'Action (EN)', headerAr: 'الإجراء (EN)', width: 14, value: r => r.actionType },
    { headerEn: 'Entity', headerAr: 'العنصر', width: 22, value: (r, l) => entityNameLabel(r.entityName, l) },
    { headerEn: 'User', headerAr: 'المستخدم', width: 16, value: r => r.userName },
    { headerEn: 'Role', headerAr: 'الوظيفة', width: 12, value: r => r.userRole },
    { headerEn: 'Branch', headerAr: 'الفرع', width: 18, value: r => r.branchName },
    { headerEn: 'Net', headerAr: 'الصافي', width: 11, numeric: true, value: r => parseNet(r.newValue) },
    { headerEn: 'Description', headerAr: 'الوصف', width: 46, value: r => r.description },
    { headerEn: 'Status', headerAr: 'الحالة', width: 10, value: (r, l) => statusText(r.success, l), tone: r => statusTone(r.success) },
  ];
}

/** Columns for raw order/table action logs (OrderActionLog rows). */
export function orderActionExportColumns(): ExportColumn<OrderActionLogRow>[] {
  return [
    { headerEn: 'Date', headerAr: 'التاريخ', width: 12, value: r => (r.actionDate || '').slice(0, 10) },
    { headerEn: 'Time', headerAr: 'الوقت', width: 11, value: r => r.actionTime },
    { headerEn: 'Action', headerAr: 'الإجراء', width: 16, value: (r, l) => actionLabel(r.actionTypeName, l) },
    { headerEn: 'Type', headerAr: 'النوع', width: 11, value: (r, l) => txTypeLabel(r.transactionTypeName, r.transactionType, l) },
    { headerEn: 'Order #', headerAr: 'رقم الأوردر', width: 11, numeric: true, value: r => r.orderId || '' },
    { headerEn: 'Receipt', headerAr: 'الإيصال', width: 11, numeric: true, value: r => r.receiptNumber || '' },
    { headerEn: 'Table', headerAr: 'الطاولة', width: 12, value: r => r.tableName },
    { headerEn: 'User', headerAr: 'المستخدم', width: 16, value: r => r.userName },
    { headerEn: 'Waiter', headerAr: 'الويتر', width: 14, value: r => r.waiterName },
    { headerEn: 'Cashier', headerAr: 'الكاشير', width: 14, value: r => r.cashierName },
    { headerEn: 'Items', headerAr: 'الأصناف', width: 9, numeric: true, value: r => r.itemCountAfter || '' },
    { headerEn: 'Net', headerAr: 'الصافي', width: 11, numeric: true, value: r => r.netAfter || r.netBefore || '' },
    { headerEn: 'Discount', headerAr: 'الخصم', width: 14, value: r => r.discountName },
    { headerEn: 'Branch', headerAr: 'الفرع', width: 18, value: r => r.branchName },
    { headerEn: 'Status', headerAr: 'الحالة', width: 10, value: (r, l) => statusText(r.success, l), tone: r => statusTone(r.success) },
    { headerEn: 'Description', headerAr: 'الوصف', width: 40, value: (r, l) => orderActionDescription(r, l) },
  ];
}

/**
 * Columns for the API-traffic endpoints table. Total time comes before the
 * averages because it is the reason the rows are in this order.
 *
 * The error columns say "min" in their headers: the stored status is 200 for
 * every business failure that follows the house convention, so the count is a
 * floor. A spreadsheet loses the note under the table, so the header carries it.
 */
export function apiEndpointExportColumns(): ExportColumn<ApiEndpointStat>[] {
  return [
    { headerEn: 'Endpoint', headerAr: 'النقطة', width: 44, value: r => r.path },
    { headerEn: 'Method', headerAr: 'النوع', width: 9, value: r => r.httpMethod },
    { headerEn: 'Calls', headerAr: 'الطلبات', width: 11, numeric: true, value: r => r.calls },
    { headerEn: 'Total time (ms)', headerAr: 'إجمالي الوقت (ms)', width: 16, numeric: true, value: r => Math.round(r.totalMs) },
    { headerEn: 'Avg (ms)', headerAr: 'المتوسط (ms)', width: 12, numeric: true, value: r => Math.round(r.avgMs) },
    { headerEn: 'P95 (ms)', headerAr: 'P95 (ms)', width: 12, numeric: true, value: r => Math.round(r.p95Ms) },
    { headerEn: 'Max (ms)', headerAr: 'الأقصى (ms)', width: 12, numeric: true, value: r => r.maxMs },
    { headerEn: 'Errors (min)', headerAr: 'أخطاء (حد أدنى)', width: 13, numeric: true, value: r => r.errorCalls },
    { headerEn: 'Error rate (min)', headerAr: 'نسبة الأخطاء (حد أدنى)', width: 16, value: r => `${r.errorRate}%`, tone: r => (r.errorCalls ? 'bad' : 'muted') },
  ];
}
