import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CallCenterAgentsComponent } from './callcenter-agents.component';
import { SalesReportApi } from '../../core/api/sales-report.api';
import { FilterService } from '../../core/filters/filter.service';
import { ExportService } from '../../core/export/export.service';
import { CcReportData, ccSections, ccOrderExcelColumns, CC_ENDPOINT } from '../../core/reports/callcenter-agents.model';

const totals = {
  agentId: '', agentName: 'Total', agentNameAr: 'الإجمالي', orders: 3, netSales: 400, averageOrder: 133.33,
  totalSales: 400, services: 20, discounts: 5, tax: 0, cancelledOrders: 1, cancelledValue: 50, sharePercent: 100,
};
const DATA: CcReportData = {
  fromDate: '2026-11-08', toDate: '2026-11-08',
  totals,
  agents: [
    { ...totals, agentId: 'a', agentName: 'Sara', agentNameAr: 'سارة', orders: 2, netSales: 300, averageOrder: 150, cancelledOrders: 1, cancelledValue: 50, sharePercent: 75 },
    { ...totals, agentId: 'b', agentName: 'Omar', agentNameAr: 'عمر', orders: 1, netSales: 100, averageOrder: 100, cancelledOrders: 0, cancelledValue: 0, sharePercent: 25 },
  ],
  agentBranches: [
    { agentId: 'a', agentName: 'Sara', agentNameAr: 'سارة', branchId: 4, branchName: 'Maadi', branchNameAr: 'المعادي', orders: 2, netSales: 300, averageOrder: 150, cancelledOrders: 1, cancelledValue: 50, sharePercent: 75 },
  ],
  days: [{ date: '2026-11-08', agents: 2, orders: 3, netSales: 400, averageOrder: 133.33, cancelledOrders: 1, cancelledValue: 50, sharePercent: 100 }],
  agentDays: [{ date: '2026-11-08', agentId: 'a', agentName: 'Sara', agentNameAr: 'سارة', orders: 2, netSales: 300, averageOrder: 150, cancelledOrders: 1, cancelledValue: 50 }],
  orders: [
    { orderId: 11, orderNo: 7, receiptNumber: 9001, orderDate: '2026-11-08', orderTime: '13:05', branchId: 4, branchName: 'Maadi', branchNameAr: 'المعادي',
      agentId: 'a', agentName: 'Sara', agentNameAr: 'سارة', customerPhone: '0100', customerName: 'Ali', transactionId: 2, orderType: 'Delivery',
      totalSales: 150, discounts: 0, services: 10, tax: 0, net: 160, paymentMethod: 'Cash', status: 'Paid', isCancelled: false },
    { orderId: 12, orderNo: 8, receiptNumber: 9002, orderDate: '2026-11-08', orderTime: '14:10', branchId: 4, branchName: 'Maadi', branchNameAr: 'المعادي',
      agentId: 'a', agentName: 'Sara', agentNameAr: 'سارة', customerPhone: '', customerName: '', transactionId: 3, orderType: 'TakeAway',
      totalSales: 50, discounts: 0, services: 0, tax: 0, net: 50, paymentMethod: 'Visa', status: 'Cancelled', isCancelled: true },
  ],
  agentOptions: [{ id: 'a', nameEn: 'Sara', nameAr: 'سارة' }, { id: 'b', nameEn: 'Omar', nameAr: 'عمر' }],
  branchOptions: [{ id: '4', nameEn: 'Maadi', nameAr: 'المعادي' }],
};

describe('CallCenterAgentsComponent', () => {
  let fixture: ComponentFixture<CallCenterAgentsComponent>;
  let raw: jasmine.Spy;
  let el: HTMLElement;

  beforeEach(async () => {
    localStorage.removeItem('pos-reports.filters');
    await TestBed.configureTestingModule({
      imports: [CallCenterAgentsComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
    raw = spyOn(TestBed.inject(SalesReportApi), 'raw').and.returnValue(of(DATA) as never);
    TestBed.inject(FilterService).setDateRange('2026-11-08T00:00:00', '2026-11-08T23:59:59');
    fixture = TestBed.createComponent(CallCenterAgentsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it('asks the report endpoint for date-only days, every branch, agent and type by default', () => {
    expect(raw).toHaveBeenCalledWith(CC_ENDPOINT, {
      fromDate: '2026-11-08', toDate: '2026-11-08', branchId: null, agentId: null, transactionId: null,
    });
  });

  it('does not need the header branch: the call centre routes to every branch', () => {
    expect(TestBed.inject(FilterService).hasBranch()).toBeFalse();
    expect(el.querySelector('[data-test="section-agents"]')).not.toBeNull();
  });

  it('has no branch select of its own: the header picker is the one branch filter', () => {
    expect(el.querySelector('[data-test="branch"]')).toBeNull();
    expect(el.querySelector('[data-test="agent"]')).not.toBeNull();
    expect(el.querySelector('[data-test="type"]')).not.toBeNull();
  });

  it('refetches with the branch picked in the header', () => {
    TestBed.inject(FilterService).setBranch(4);
    fixture.detectChanges();
    expect(raw.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ branchId: 4 }));
  });

  it('refetches every branch when "All branches" is picked in the header', () => {
    const f = TestBed.inject(FilterService);
    f.setBranch(4);
    fixture.detectChanges();
    f.pickAllBranches();
    fixture.detectChanges();
    expect(raw.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ branchId: null }));
    expect(f.branchId()).toBe(4); // other reports keep their branch
  });

  it('offers "All branches" only while open', () => {
    const f = TestBed.inject(FilterService);
    expect(f.allBranchesOffered()).toBeTrue();
    f.setBranch(4);
    f.pickAllBranches();
    fixture.destroy();
    expect(f.allBranchesOffered()).toBeFalse();
    expect(f.allBranchesActive()).toBeFalse();
    expect(f.scopedBranchId()).toBe(4);
  });

  it('exports and prints for the header branch', () => {
    TestBed.inject(FilterService).setBranch(4);
    fixture.detectChanges();
    const pdf = spyOn(TestBed.inject(ExportService), 'pdf');
    fixture.componentInstance.printRoll('pos80');
    const meta = pdf.calls.mostRecent().args[2];
    expect(['Maadi', 'المعادي']).toContain(meta.appliedFilters![0].value);
  });

  it('renders the per-agent summary with a total row, and every breakdown', () => {
    const agents = el.querySelector('[data-test="section-agents"]')!;
    expect(agents.querySelectorAll('tbody tr').length).toBe(2);
    expect(agents.querySelector('tfoot')!.textContent).toContain('400.00');
    for (const key of ['agentBranches', 'days', 'agentDays', 'orders']) {
      expect(el.querySelector(`[data-test="section-${key}"]`)).withContext(key).not.toBeNull();
    }
  });

  it('marks a cancelled order in the list', () => {
    const rows = el.querySelectorAll('[data-test="section-orders"] tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[1].className).toContain('text-rose-600');
  });

  it('refetches with the picked agent', () => {
    fixture.componentInstance.setAgent('b');
    expect(raw.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ agentId: 'b' }));
  });

  it('prints only the agent summary on the roll', () => {
    const pdf = spyOn(TestBed.inject(ExportService), 'pdf');
    fixture.componentInstance.printRoll('pos80');
    const [rows, cols, meta] = pdf.calls.mostRecent().args;
    expect(rows.length).toBe(2);
    expect(cols.map((c) => c.headerEn)).toEqual(['Agent', 'Orders', 'Net', '%']);
    expect(meta.paper).toBe('pos80');
  });

  it('exports every section to Excel, the order list with all its columns', () => {
    const sections = spyOn(TestBed.inject(ExportService), 'sections');
    fixture.componentInstance.exportExcel();
    const [secs, , mode] = sections.calls.mostRecent().args;
    expect(mode).toBe('excel');
    expect(secs.length).toBe(5);
    expect(secs[4].cols.length).toBe(ccOrderExcelColumns(false).length);
    expect(secs[4].cols.map((c) => c.headerEn)).toContain('Customer Name');
  });

  it('reads in Arabic', () => {
    const s = ccSections(DATA, true);
    expect(s[0].titleAr).toBe('المبيعات حسب الموظف');
    expect(s[0].columns[0].value(DATA.agents![0], true)).toBe('سارة');
    expect(s[0].footer![0]).toBe('الإجمالي');
  });
});
