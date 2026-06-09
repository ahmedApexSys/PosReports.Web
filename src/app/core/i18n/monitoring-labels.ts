/**
 * Human-friendly bilingual labels for the raw action-log enum values the POS
 * API returns (ActionType, EntityType, LogSource, Category, TransactionType).
 *
 * The Monitoring screens show these values directly; without translation an
 * Arabic-reading manager sees cryptic English like "CalculateOrder" / "VoidItem".
 * These pure helpers map the server strings to clear EN/AR labels. Unknown
 * values fall back to a prettified (space-split) version of the raw name, so a
 * new action type still reads reasonably instead of breaking.
 */
export type Lang = 'en' | 'ar';

/** "EditPay" -> "Edit Pay", "VoidItem" -> "Void Item". */
function prettifyEn(name: string): string {
  return (name || '')
    .replace(/[_\-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalise a server enum to a lookup key: lowercase, letters only. */
function key(name: string | null | undefined): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ── Order / system / menu ACTION types ──────────────────────────────
const ACTION_AR: Record<string, string> = {
  calculate: 'حساب الأوردر',
  recalc: 'إعادة حساب',
  pay: 'دفع',
  editpay: 'تعديل الدفع',
  checkout: 'تشيك آوت',
  voiditem: 'إلغاء صنف',
  void: 'إلغاء صنف',
  send: 'إرسال للمطبخ',
  assign: 'إسناد لطيار',
  ordercompleted: 'اكتمال الأوردر',
  orderdelivered: 'تم التوصيل',
  orderpickedup: 'تم الاستلام',
  closeday: 'تقفيل اليومية',
  openday: 'فتح اليومية',
  closeshift: 'تقفيل الشيفت',
  openshift: 'فتح الشيفت',
  cancel: 'إلغاء الأوردر',
  cancelorder: 'إلغاء الأوردر',
  approvecancelorder: 'اعتماد الإلغاء',
  transfer: 'نقل طاولة',
  split: 'تقسيم طاولة',
  merge: 'دمج طاولة',
  followorder: 'متابعة الأوردر',
  return: 'مرتجع',
  collectmoney: 'تحصيل نقدية',
  discount: 'خصم',
  promocode: 'كود خصم',
  voucher: 'قسيمة',
  create: 'إضافة',
  update: 'تعديل',
  delete: 'حذف',
  activate: 'تفعيل',
  deactivate: 'إيقاف',
  stopitem: 'إيقاف صنف',
  unstopitem: 'إعادة صنف',
  pricechange: 'تغيير سعر',
  login: 'تسجيل دخول',
  logout: 'تسجيل خروج',
  ratelimit: 'حظر محاولات دخول',
  settlement: 'تسوية',
  opentable: 'فتح طاولة',
};

export function actionLabel(name: string | null | undefined, lang: Lang): string {
  const k = key(name);
  if (lang === 'ar' && ACTION_AR[k]) return ACTION_AR[k];
  return prettifyEn(name || '') || (lang === 'ar' ? 'إجراء' : 'Action');
}

// ── ENTITY types ────────────────────────────────────────────────────
const ENTITY_AR: Record<string, string> = {
  order: 'أوردر',
  orderheader: 'أوردر',
  customer: 'عميل',
  item: 'صنف',
  itempricing: 'تسعير صنف',
  user: 'مستخدم',
  role: 'صلاحية',
  permission: 'صلاحية',
  branch: 'فرع',
  discount: 'خصم',
  promocode: 'كود خصم',
  menu: 'منيو',
  category: 'قسم',
  subcategory: 'قسم فرعي',
  service: 'خدمة',
  voucher: 'قسيمة',
  variant: 'متغير',
  modifiersgroup: 'مجموعة إضافات',
  pricing: 'تسعير',
  shift: 'شيفت',
  day: 'يومية',
  table: 'طاولة',
  ratelimit: 'حظر دخول',
  branchoptionssetting: 'إعداد فرع',
  closedday: 'يومية مقفولة',
  settlement: 'تسوية',
  taxpayer: 'ممول ضريبي',
  paymentmethod: 'طريقة دفع',
};

export function entityLabel(name: string | null | undefined, lang: Lang): string {
  const k = key(name);
  if (!k) return '';
  if (lang === 'ar' && ENTITY_AR[k]) return ENTITY_AR[k];
  return prettifyEn(name || '');
}

// ── LOG SOURCE (Order / System / Menu) ──────────────────────────────
const SOURCE_AR: Record<string, string> = {
  order: 'أوردرات',
  system: 'النظام',
  menu: 'المنيو',
};
export function sourceLabel(name: string | null | undefined, lang: Lang): string {
  const k = key(name);
  if (lang === 'ar' && SOURCE_AR[k]) return SOURCE_AR[k];
  return name || '';
}

// ── CATEGORY ────────────────────────────────────────────────────────
const CATEGORY_AR: Record<string, string> = {
  orderaction: 'حركة أوردر',
  identity: 'مستخدمين',
  possession: 'جلسة كاشير',
  integration: 'تكامل',
  customer: 'عملاء',
  menucrud: 'تعديل منيو',
};
export function categoryLabel(name: string | null | undefined, lang: Lang): string {
  const k = key(name);
  if (lang === 'ar' && CATEGORY_AR[k]) return CATEGORY_AR[k];
  return prettifyEn(name || '');
}

// ── TRANSACTION TYPE (DineIn=1 / Delivery=2 / TakeAway=3) ────────────
export function txTypeLabel(name: string | null | undefined, txId: number | null | undefined, lang: Lang): string {
  const id = txId ?? 0;
  if (id === 1) return lang === 'ar' ? 'صالة' : 'Dine-In';
  if (id === 2) return lang === 'ar' ? 'دليفري' : 'Delivery';
  if (id === 3) return lang === 'ar' ? 'تيك أواي' : 'Take-Away';
  const n = key(name);
  if (n.includes('dine') || n.includes('table') || n.includes('hall')) return lang === 'ar' ? 'صالة' : 'Dine-In';
  if (n.includes('deliver')) return lang === 'ar' ? 'دليفري' : 'Delivery';
  if (n.includes('take')) return lang === 'ar' ? 'تيك أواي' : 'Take-Away';
  return name || '';
}

// ── Generated, structured descriptions (replace the server's English free-text) ──
function fmtMoney(n: number): string {
  return (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Translate the English entity-name prefixes the API emits (Order #, Table:). */
export function entityNameLabel(name: string | null | undefined, lang: Lang): string {
  const s = (name || '').trim();
  if (!s || lang !== 'ar') return s;
  return s
    .replace(/^Order\s*#?\s*/i, 'أوردر #')
    .replace(/^Table:\s*/i, 'طاولة ')
    .replace(/^Table\s+/i, 'طاولة ');
}

/** Shape needed to build an order-action description (subset of OrderActionLogRow). */
export interface OrderActionLike {
  actionTypeName?: string | null;
  orderId?: number;
  tableName?: string | null;
  destinationTableName?: string | null;
  transactionTypeName?: string | null;
  transactionType?: number;
  netBefore?: number;
  netAfter?: number;
  itemCountAfter?: number;
  discountName?: string | null;
  promoCode?: string | null;
  isTransfered?: boolean;
}

/** A clean, consistent one-line description built from the structured fields. */
export function orderActionDescription(r: OrderActionLike, lang: Lang): string {
  const ar = lang === 'ar';
  const act = actionLabel(r.actionTypeName, lang);
  const ref = r.tableName
    ? (ar ? `طاولة ${r.tableName}` : `Table ${r.tableName}`)
    : (ar ? `أوردر #${r.orderId}` : `Order #${r.orderId}`);
  const tx = txTypeLabel(r.transactionTypeName, r.transactionType, lang);
  const segs: string[] = [tx ? `${act} · ${ref} (${tx})` : `${act} · ${ref}`];
  if (r.isTransfered && r.destinationTableName) {
    segs.push(ar ? `→ طاولة ${r.destinationTableName}` : `→ Table ${r.destinationTableName}`);
  }
  if (r.itemCountAfter) segs.push(ar ? `${r.itemCountAfter} صنف` : `${r.itemCountAfter} items`);
  const net = r.netAfter || r.netBefore || 0;
  if (net) segs.push(ar ? `صافي ${fmtMoney(net)}` : `net ${fmtMoney(net)}`);
  if (r.discountName) segs.push(ar ? `خصم: ${r.discountName}` : `disc: ${r.discountName}`);
  if (r.promoCode) segs.push(`${r.promoCode}`);
  return segs.join(' · ');
}

/** Build a feed-row description from a unified-log row (action + entity + parsed net). */
export function unifiedDescription(
  r: { actionType?: string | null; entityName?: string | null; newValue?: string | null; logSource?: string | null },
  lang: Lang,
): string {
  const ar = lang === 'ar';
  const act = actionLabel(r.actionType, lang);
  const ent = entityNameLabel(r.entityName, lang);
  const segs: string[] = [ent ? `${act} · ${ent}` : act];
  const m = /Net:\s*([\d.]+)/i.exec(r.newValue || '');
  if (m && +m[1] > 0) segs.push(ar ? `صافي ${fmtMoney(+m[1])}` : `net ${fmtMoney(+m[1])}`);
  return segs.join(' · ');
}
