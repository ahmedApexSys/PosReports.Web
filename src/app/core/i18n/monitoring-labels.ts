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

/**
 * Arabic for a BI category-slice / data-derived label (payment method,
 * transaction type, payment status). Some BI endpoints translate these
 * server-side and some don't (e.g. "Delivery" → "ديليفري" but "TakeAWay"
 * and "LEDGE" come back raw). We only override when the text the server
 * gave us still looks English (contains Latin letters); anything already
 * Arabic passes through untouched, so we never clobber a good server value.
 * Keyed off the slice `key` (stable) with the label text as a fallback.
 */
const DATA_VALUE_AR: Record<string, string> = {
  takeaway: 'تيك أواي', takeout: 'تيك أواي',
  dinein: 'صالة', dine: 'صالة', hall: 'صالة',
  delivery: 'دليفري', deliver: 'دليفري',
  cash: 'كاش',
  visa: 'فيزا / كارت', visacard: 'فيزا / كارت', card: 'كارت',
  ledge: 'آجل', leadge: 'آجل',
  hosbitality: 'ضيافة', hospitality: 'ضيافة',
  officer: 'أوفيسر',
  fawry: 'فوري', instapay: 'إنستاباي', wallet: 'محفظة', visamada: 'فيزا / مدى',
  paid: 'مدفوع', unpaid: 'غير مدفوع',
};
export function dataValueLabel(text: string | null | undefined, keyHint: string | null | undefined, lang: Lang): string {
  const s = (text || '').trim();
  if (lang !== 'ar') return s;
  if (s && !/[A-Za-z]/.test(s)) return s; // already Arabic from the server
  const k = key(keyHint || s);
  return DATA_VALUE_AR[k] || s;
}

/**
 * Arabic for the finite, structural BI text the `/Insights` controllers
 * (ServiceSpeed / ItemRanking / HighlySales / LowSales) return English-only:
 * those endpoints fill `BiText.picked` with English regardless of the request
 * language and leave `.en` / `.ar` empty, so there is no Arabic to fall back to.
 * We map the known KPI labels, chart titles, and SLA buckets here. Dynamic
 * conclusions (e.g. "15 deliveries · avg total 608 min …") are NOT mapped —
 * they vary by data; those stay English until the API gains real bilingual text.
 * Exact match on a normalised key; anything unknown (item names, etc.) is kept.
 */
const BI_TEXT_AR: Record<string, string> = {
  'active pilots': 'الطيارون النشطون',
  'avg pickup time': 'متوسط وقت الاستلام',
  'avg total time (order→back)': 'متوسط الوقت الكلي (من الأوردر للرجوع)',
  'items pareto (by quantity)': 'باريتو الأصناف (بالكمية)',
  'pilots ranked by avg total time (fastest first)': 'ترتيب الطيارين بمتوسط الوقت الكلي (الأسرع أولاً)',
  'quantity': 'الكمية',
  'revenue': 'الإيراد',
  'sla buckets (total delivery time)': 'فترات SLA (إجمالي وقت التوصيل)',
  'slow movers (by revenue)': 'الأبطأ مبيعًا (بالإيراد)',
  'top 10 share': 'نصيب أعلى 10',
  'top sellers (by revenue)': 'الأعلى مبيعًا (بالإيراد)',
  'total deliveries': 'إجمالي التوصيلات',
  'total items': 'إجمالي الأصناف',
  'total quantity': 'إجمالي الكمية',
  // SLA delivery-time buckets (category slice labels on the Service Speed page)
  '0-30 min': '0-30 دقيقة',
  '30-45 min': '30-45 دقيقة',
  '45-60 min': '45-60 دقيقة',
  '60+ min': '60+ دقيقة',
};
function biKey(s: string): string {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}
/**
 * Map an English BI label to Arabic when we know it. Only touches strings that
 * still contain Latin letters (so server-provided Arabic passes through), and
 * only those present in BI_TEXT_AR — everything else is returned unchanged.
 */
export function biTextLabel(text: string | null | undefined, lang: Lang): string {
  const s = (text || '').trim();
  if (lang !== 'ar' || !s) return s;
  if (!/[A-Za-z]/.test(s)) return s;
  return BI_TEXT_AR[biKey(s)] || s;
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
