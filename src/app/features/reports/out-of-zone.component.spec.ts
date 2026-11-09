import { outOfZoneColumns, OutOfZoneZone } from './out-of-zone.component';

/** Out of zone requests (owner, 2026-11-09): the columns the table and the exports share. */
describe('outOfZoneColumns', () => {
  const zone: OutOfZoneZone = {
    zoonId: 40, zoonName: 'Zahraa El Maadi', cityName: 'Cairo', requests: 3,
    lastAt: '2026-11-09T13:05:00', askedBranches: 'Maadi, Nasr City',
  };

  it('names each column in both languages, the count numeric', () => {
    const cols = outOfZoneColumns(false);
    expect(cols.map((c) => c.headerEn)).toEqual(['Zone', 'City', 'Requests', 'Last request', 'Asked branches']);
    expect(cols.map((c) => c.headerAr)).toEqual(['المنطقة', 'المدينة', 'عدد الطلبات', 'آخر طلب', 'الفروع اللي اتطلب منها']);
    expect(cols.filter((c) => c.numeric).map((c) => c.headerEn)).toEqual(['Requests']);
  });

  it('reads a row, the time to the minute', () => {
    const values = outOfZoneColumns(false).map((c) => c.value(zone, 'en'));
    expect(values).toEqual(['Zahraa El Maadi', 'Cairo', 3, '2026-11-09 13:05', 'Maadi, Nasr City']);
  });

  it('a zone with no name still says which one it is', () => {
    const value = outOfZoneColumns(true)[0].value({ ...zone, zoonName: null }, 'ar');
    expect(value).toBe('غير مسماة #40');
  });
});
