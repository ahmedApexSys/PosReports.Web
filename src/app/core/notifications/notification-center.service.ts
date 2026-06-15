import { Injectable, signal, computed, effect } from '@angular/core';

/**
 * Local notification center.
 *
 * The POS reporting API exposes no server-push / notifications endpoint, so
 * this is a CLIENT-SIDE store: app-generated notices (welcome, tips, filter
 * advisories, "preferences saved", etc.) persisted to localStorage. It's
 * structured so a future server feed can simply `push()` into the same store.
 */

export type NotificationKind = 'info' | 'good' | 'warning' | 'critical';

export interface AppNotification {
  id: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  kind: NotificationKind;
  /** Epoch milliseconds. */
  createdAt: number;
  read: boolean;
  /** Optional in-app route the notification deep-links to. */
  route?: string;
}

const STORAGE_KEY = 'pos-reports.notifications';
const SEEDED_KEY = 'pos-reports.notifications.seeded';
const MAX_ITEMS = 100;

@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
  private readonly _items = signal<AppNotification[]>(this.readStored());
  private seq = 0;

  /** All notifications, newest first. */
  readonly items = computed(() =>
    [...this._items()].sort((a, b) => b.createdAt - a.createdAt));

  readonly unreadCount = computed(() => this._items().filter(n => !n.read).length);
  readonly hasAny = computed(() => this._items().length > 0);

  constructor() {
    // One-time seed so the page isn't empty on first run.
    this.seedOnce();
    // Persist on every change.
    effect(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._items())); } catch { /* noop */ }
    });
  }

  /** Add a notification to the top of the store. Returns its id. */
  push(n: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { read?: boolean }): string {
    const id = `n_${Date.now().toString(36)}_${(this.seq++).toString(36)}`;
    const item: AppNotification = {
      id,
      createdAt: Date.now(),
      read: n.read ?? false,
      titleEn: n.titleEn,
      titleAr: n.titleAr,
      bodyEn: n.bodyEn,
      bodyAr: n.bodyAr,
      kind: n.kind,
      route: n.route,
    };
    this._items.update(list => [item, ...list].slice(0, MAX_ITEMS));
    return id;
  }

  markRead(id: string): void {
    this._items.update(list => list.map(n => n.id === id ? { ...n, read: true } : n));
  }

  markAllRead(): void {
    this._items.update(list => list.map(n => n.read ? n : { ...n, read: true }));
  }

  remove(id: string): void {
    this._items.update(list => list.filter(n => n.id !== id));
  }

  clear(): void {
    this._items.set([]);
  }

  private seedOnce(): void {
    let seeded = false;
    try { seeded = localStorage.getItem(SEEDED_KEY) === '1'; } catch { /* noop */ }
    if (seeded || this._items().length > 0) return;

    const now = Date.now();
    this._items.set([
      {
        id: 'seed_welcome',
        titleEn: 'Welcome to Apex Reports',
        titleAr: 'مرحباً بك في تقارير أبكس',
        bodyEn: 'Pick a branch and a date range in the header, then open any report from the sidebar.',
        bodyAr: 'اختر فرعاً وفترة زمنية من الأعلى، ثم افتح أي تقرير من القائمة الجانبية.',
        kind: 'good',
        createdAt: now,
        read: false,
        route: '/dashboard',
      },
      {
        id: 'seed_tip_export',
        titleEn: 'Tip: export any report',
        titleAr: 'نصيحة: صدّر أي تقرير',
        bodyEn: 'Most reports can be exported to Excel, PDF or CSV from the export menu in the page header.',
        bodyAr: 'يمكن تصدير معظم التقارير إلى Excel أو PDF أو CSV من قائمة التصدير أعلى الصفحة.',
        kind: 'info',
        createdAt: now - 60_000,
        read: false,
      },
    ]);
    try { localStorage.setItem(SEEDED_KEY, '1'); } catch { /* noop */ }
  }

  private readStored(): AppNotification[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as AppNotification[];
      }
    } catch { /* noop */ }
    return [];
  }
}
