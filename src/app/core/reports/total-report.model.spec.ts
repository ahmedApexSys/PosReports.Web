import { buildTotalBlocks } from './total-report.model';

describe('buildTotalBlocks PayWay', () => {
  const payWay = { cash: 1407, visa: 440, onlineApps: 180, allPayment: 2027 };

  const rows = (ar: boolean) =>
    buildTotalBlocks({ payWay }, ar).find((b) => b.title === (ar ? 'طرق الدفع' : 'PayWay'))!.rows!;

  it('shows the online apps on their own line, right after Visa', () => {
    const labels = rows(false).map((r) => r.label);
    expect(labels.indexOf('Online Apps')).toBe(labels.indexOf('Visa') + 1);
  });

  it('reads the API figures: Visa is the terminal, online apps apart', () => {
    const byLabel = new Map(rows(false).map((r) => [r.label, r.value]));
    expect(byLabel.get('Visa')).toBe((440).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    expect(byLabel.get('Online Apps')).toBe((180).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  });

  it('has an Arabic label', () => {
    expect(rows(true).map((r) => r.label)).toContain('تطبيقات الأونلاين');
  });

  it('reads 0.00 from an API that does not send the line yet', () => {
    const old = buildTotalBlocks({ payWay: { visa: 620 } }, false).find((b) => b.title === 'PayWay')!.rows!;
    expect(old.find((r) => r.label === 'Online Apps')!.value).toBe((0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  });
});
