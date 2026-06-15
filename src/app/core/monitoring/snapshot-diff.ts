/**
 * Snapshot diffing for the Monitoring / Order-Journey views.
 *
 * Each OrderActionLog row carries `beforeSnapshot` / `afterSnapshot` as JSON
 * strings (an order object with an `items[]` array). The raw JSON is useless to
 * an owner — these helpers turn the two snapshots into a clear, human-readable
 * item-level diff: what was ADDED, REMOVED, had its QTY changed, or its PRICE
 * changed, plus the order-level money deltas. Everything is defensive: unknown /
 * malformed JSON degrades gracefully (the UI keeps a raw-JSON fallback).
 */

export interface SnapItem {
  itemId: number | null;
  name: string;      // English (may be empty in older snapshots)
  nameAr: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderSnapshot {
  ok: boolean;          // parsed into a usable shape
  items: SnapItem[];
  net: number | null;
  total: number | null;
  discount: number | null;
  guestCount: number | null;
  raw: unknown;
}

export type DiffKind = 'added' | 'removed' | 'qty' | 'price' | 'unchanged';

export interface ItemDiff {
  kind: DiffKind;
  itemId: number | null;
  name: string;
  nameAr: string;
  qtyBefore: number;
  qtyAfter: number;
  priceBefore: number;
  priceAfter: number;
  lineBefore: number;
  lineAfter: number;
}

export interface DiffSummary {
  added: number;
  removed: number;
  qtyChanged: number;
  priceChanged: number;
  unchanged: number;
  /** True when there is at least one real change to render. */
  hasChanges: boolean;
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

function pick<T = unknown>(o: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const k of keys) {
    if (o[k] !== undefined && o[k] !== null) return o[k] as T;
    // case-insensitive fallback
    const found = Object.keys(o).find(kk => kk.toLowerCase() === k.toLowerCase());
    if (found && o[found] !== undefined && o[found] !== null) return o[found] as T;
  }
  return undefined;
}

/** Find the items array inside an arbitrary snapshot object. */
function findItems(root: unknown): unknown[] {
  if (Array.isArray(root)) return root;
  if (!root || typeof root !== 'object') return [];
  const o = root as Record<string, unknown>;
  const direct = pick<unknown[]>(o, 'items', 'lines', 'orderDetails', 'details', 'cart', 'listCart');
  if (Array.isArray(direct)) return direct;
  // Fallback: first array whose elements look like line items.
  for (const v of Object.values(o)) {
    if (Array.isArray(v) && v.length && typeof v[0] === 'object' && v[0]) {
      const el = v[0] as Record<string, unknown>;
      if (pick(el, 'qty', 'quantity', 'count') !== undefined || pick(el, 'unitPrice', 'price') !== undefined) {
        return v;
      }
    }
  }
  return [];
}

function normItem(raw: unknown): SnapItem {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const qty = num(pick(o, 'qty', 'quantity', 'count', 'amount'));
  const unitPrice = num(pick(o, 'unitPrice', 'price', 'itemPrice', 'unit'));
  const lineTotal = pick(o, 'lineTotal', 'total', 'lineNet', 'net') !== undefined
    ? num(pick(o, 'lineTotal', 'total', 'lineNet', 'net'))
    : qty * unitPrice;
  const idRaw = pick(o, 'itemId', 'id', 'productId');
  return {
    itemId: idRaw !== undefined ? num(idRaw) : null,
    name: String(pick(o, 'name', 'itemName', 'nameEn', 'englishName') ?? '').trim(),
    nameAr: String(pick(o, 'nameAr', 'itemNameAr', 'arabicName', 'name_Ar') ?? '').trim(),
    qty,
    unitPrice,
    lineTotal,
  };
}

export function parseSnapshot(json: string | null | undefined): OrderSnapshot {
  const empty: OrderSnapshot = { ok: false, items: [], net: null, total: null, discount: null, guestCount: null, raw: null };
  if (!json || !json.trim()) return empty;
  let root: unknown;
  try { root = JSON.parse(json); } catch { return { ...empty, raw: json }; }

  const items = findItems(root).map(normItem);
  const o = (root && typeof root === 'object' && !Array.isArray(root) ? root : {}) as Record<string, unknown>;
  return {
    ok: true,
    items,
    net: pick(o, 'net', 'netTotal') !== undefined ? num(pick(o, 'net', 'netTotal')) : null,
    total: pick(o, 'total', 'grandTotal') !== undefined ? num(pick(o, 'total', 'grandTotal')) : null,
    discount: pick(o, 'discount', 'discountValue', 'totalDiscount') !== undefined ? num(pick(o, 'discount', 'discountValue', 'totalDiscount')) : null,
    guestCount: pick(o, 'guestCount', 'guests', 'numberOfGuests') !== undefined ? num(pick(o, 'guestCount', 'guests', 'numberOfGuests')) : null,
    raw: root,
  };
}

/** Aggregate items by itemId (so duplicate lines for the same item merge). */
function aggregate(items: SnapItem[]): Map<string, SnapItem> {
  const map = new Map<string, SnapItem>();
  items.forEach((it, idx) => {
    const k = it.itemId != null ? `id:${it.itemId}` : `nm:${(it.name || it.nameAr || 'x')}:${idx}`;
    const existing = map.get(k);
    if (existing) {
      existing.qty += it.qty;
      existing.lineTotal += it.lineTotal;
      if (!existing.unitPrice) existing.unitPrice = it.unitPrice;
      if (!existing.name) existing.name = it.name;
      if (!existing.nameAr) existing.nameAr = it.nameAr;
    } else {
      map.set(k, { ...it });
    }
  });
  return map;
}

const EPS = 0.005;
const diff = (a: number, b: number) => Math.abs(a - b) > EPS;

/** Compute the per-item diff between two snapshots. */
export function diffItems(before: OrderSnapshot, after: OrderSnapshot): ItemDiff[] {
  const b = aggregate(before.items);
  const a = aggregate(after.items);
  const keys = new Set<string>([...b.keys(), ...a.keys()]);
  const out: ItemDiff[] = [];

  for (const k of keys) {
    const bi = b.get(k);
    const ai = a.get(k);
    const ref = ai ?? bi!;
    const base: Omit<ItemDiff, 'kind'> = {
      itemId: ref.itemId,
      name: ref.name,
      nameAr: ref.nameAr,
      qtyBefore: bi?.qty ?? 0,
      qtyAfter: ai?.qty ?? 0,
      priceBefore: bi?.unitPrice ?? 0,
      priceAfter: ai?.unitPrice ?? 0,
      lineBefore: bi?.lineTotal ?? 0,
      lineAfter: ai?.lineTotal ?? 0,
    };
    let kind: DiffKind;
    if (!bi) kind = 'added';
    else if (!ai) kind = 'removed';
    else if (diff(bi.qty, ai.qty)) kind = 'qty';
    else if (diff(bi.unitPrice, ai.unitPrice) || diff(bi.lineTotal, ai.lineTotal)) kind = 'price';
    else kind = 'unchanged';
    out.push({ kind, ...base });
  }

  // Order: added, removed, qty, price, unchanged — then by name.
  const rank: Record<DiffKind, number> = { added: 0, removed: 1, qty: 2, price: 3, unchanged: 4 };
  return out.sort((x, y) => rank[x.kind] - rank[y.kind] || (x.name || '').localeCompare(y.name || ''));
}

export function summarize(diffs: ItemDiff[]): DiffSummary {
  const s: DiffSummary = { added: 0, removed: 0, qtyChanged: 0, priceChanged: 0, unchanged: 0, hasChanges: false };
  for (const d of diffs) {
    if (d.kind === 'added') s.added++;
    else if (d.kind === 'removed') s.removed++;
    else if (d.kind === 'qty') s.qtyChanged++;
    else if (d.kind === 'price') s.priceChanged++;
    else s.unchanged++;
  }
  s.hasChanges = s.added + s.removed + s.qtyChanged + s.priceChanged > 0;
  return s;
}
