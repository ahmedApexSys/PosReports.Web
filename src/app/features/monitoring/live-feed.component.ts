import {
  Component, OnDestroy, inject, signal, computed, effect, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  LucideAngularModule, RefreshCw, Loader, Building2, Search,
  Play, Pause, ChevronDown, ArrowRight,
} from 'lucide-angular';
import { catchError, finalize, of } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService } from '../../core/filters/filter.service';
import { MonitoringApi } from '../../core/api/monitoring.api';
import { UnifiedAuditLog } from '../../core/models/monitoring.models';
import {
  actionLabel, entityLabel, sourceLabel, entityNameLabel, unifiedDescription,
} from '../../core/i18n/monitoring-labels';
import { PagerComponent } from '../../shared/pager/pager.component';
import { ExportMenuComponent } from '../../shared/export-menu/export-menu.component';
import { unifiedAuditExportColumns } from '../../core/export/monitoring-export-columns';

type SourceTab = 'all' | 'Order' | 'System' | 'Menu';

/**
 * One thing that happened, with what it did to the bill already worked out.
 */
interface FeedEvent {
  row: UnifiedAuditLog;
  title: string;
  time: string;
  glyph: string;
  tone: string;
  /** netAfter − netBefore. Null when this action has no money to speak of. */
  delta: number | null;
  who: string;
}

/**
 * A run of events that belong together — one table's evening, one counter order, or the
 * system's own chatter.
 */
interface FeedSession {
  key: string;
  /** "Table Saeed" / "Order #1941" / "System" — what this run IS. */
  title: string;
  /** Dine-in · receipt · waiter, when the rows carry them. */
  subtitle: string;
  kind: 'order' | 'system' | 'menu';
  events: FeedEvent[];
  /** Latest net the run reached, or null when nothing in it touched money. */
  net: number | null;
  /** Sum of the deltas — what this run did to the bill overall. */
  moved: number;
  from: string;
  to: string;
  /** Order id, when there is one to link to the journey. */
  orderId: number | null;
  /** Newest event, for ordering the runs against each other. */
  at: number;
}

/** One calendar day of runs. */
interface FeedDay {
  key: string;
  label: string;
  sessions: FeedSession[];
}

/**
 * Live Activity Feed — the day's movements, read the way an owner reads them.
 *
 * <p>The first version was a flat list of one card per audit row, each printing its own
 * description twice and none of them saying what the action DID. Eight actions on one table came
 * out as eight unrelated lines, and the money — which the server had all along, formatted as
 * "Sales:.. Net:.. Total:.." — was hidden as noise. An owner could read the whole screen and
 * still not know whether the evening had gone well.</p>
 *
 * <p>So the rows are folded into RUNS: one table's evening, one counter order, the system's own
 * chatter. A run carries a headline — what it settled at and what it moved — and its events carry
 * a money pill each. Opening an event gives the before / after / difference strip, the same one
 * the Order Journey uses, because it is the same question asked from a day away instead of from
 * inside a single order.</p>
 *
 * <p>Deliberately the journey's visual language, down to the shared palette: these are two views
 * of one story and looking like two products would be the wrong answer.</p>
 */
@Component({
  selector: 'app-live-feed',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule, PagerComponent, ExportMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">

      <!-- ── Header ─────────────────────────────────────────── -->
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-xl md:text-2xl font-bold jr-ink">
            {{ ar() ? 'الحركة المباشرة' : 'Live Activity' }}
          </h1>
          <p class="text-sm jr-muted mt-0.5">
            {{ ar() ? 'كل حركة على الترابيزات والأوردرات، مجمّعة زي ما حصلت.'
                    : 'Every movement on tables and orders, grouped the way it happened.' }}
          </p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button (click)="toggleAuto()" type="button"
                  class="jr-toggle inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border"
                  [class.is-on]="autoRefresh()">
            <lucide-icon [img]="autoRefresh() ? PauseIcon : PlayIcon" class="h-3.5 w-3.5"></lucide-icon>
            {{ autoRefresh() ? (ar() ? 'إيقاف التحديث' : 'Stop auto') : (ar() ? 'تحديث تلقائي' : 'Auto-refresh') }}
          </button>
          <app-export-menu
            [rows]="data()" [columns]="exportCols"
            titleEn="Live Activity" titleAr="الحركة المباشرة"
            subtitleEn="Order, table, system & menu actions"
            subtitleAr="حركات الأوردرات والطاولات والنظام والمنيو"
            [branch]="data()[0]?.branchName"
            [fromDate]="filter.fromDate()" [toDate]="filter.toDate()"
            fileBase="activity-feed"></app-export-menu>
          <button (click)="reload()" type="button" class="jr-toggle inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border"
                  [disabled]="loading() || !filter.canFetch()">
            <lucide-icon [img]="loading() ? LoaderIcon : RefreshIcon" class="h-3.5 w-3.5"
                         [class.animate-spin]="loading()"></lucide-icon>
            {{ ar() ? 'تحديث' : 'Refresh' }}
          </button>
        </div>
      </div>

      <!-- ── The headline, before any scrolling ───────────────
           Six numbers that answer "how did it go" without reading a single row. Explicitly
           labelled as the LOADED rows, not the whole period: this list is paged, and a total
           that quietly described 50 of 900 rows would be worse than no total. -->
      <div *ngIf="data().length" class="jr-card p-3 md:p-4">
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <div class="jr-inset px-2.5 py-2">
            <div class="text-[11px] jr-muted">{{ ar() ? 'حركات معروضة' : 'Movements shown' }}</div>
            <div class="mt-px text-[15px] font-bold jr-ink tabular-nums"><bdi>{{ num(data().length) }}</bdi></div>
          </div>
          <div class="jr-inset px-2.5 py-2">
            <div class="text-[11px] jr-muted">{{ ar() ? 'ترابيزات وأوردرات' : 'Tables & orders' }}</div>
            <div class="mt-px text-[15px] font-bold jr-ink tabular-nums"><bdi>{{ num(orderSessionCount()) }}</bdi></div>
          </div>
          <div class="jr-inset px-2.5 py-2">
            <div class="text-[11px] jr-muted">{{ ar() ? 'فلوس اتحركت' : 'Money moved' }}</div>
            <div class="mt-px text-[15px] font-bold jr-ink tabular-nums"><bdi>{{ cash(movedTotal()) }}</bdi></div>
          </div>
          <div class="jr-inset px-2.5 py-2" [class.is-hot]="voidCount() > 0">
            <div class="text-[11px] jr-muted">{{ ar() ? 'إلغاء أصناف' : 'Item voids' }}</div>
            <div class="mt-px text-[15px] font-bold tabular-nums"
                 [class.jr-ink]="!voidCount()" [class.text-bad]="voidCount() > 0"><bdi>{{ num(voidCount()) }}</bdi></div>
          </div>
          <div class="jr-inset px-2.5 py-2">
            <div class="text-[11px] jr-muted">{{ ar() ? 'خصومات' : 'Discounts' }}</div>
            <div class="mt-px text-[15px] font-bold jr-ink tabular-nums"><bdi>{{ num(discountCount()) }}</bdi></div>
          </div>
          <div class="jr-inset px-2.5 py-2">
            <div class="text-[11px] jr-muted">{{ ar() ? 'حركات فشلت' : 'Failed' }}</div>
            <div class="mt-px text-[15px] font-bold tabular-nums"
                 [class.jr-ink]="!failCount()" [class.text-bad]="failCount() > 0"><bdi>{{ num(failCount()) }}</bdi></div>
          </div>
        </div>
        <p class="mt-2 text-[11px] jr-faint">
          {{ ar() ? 'الأرقام دي عن الحركات المعروضة في الصفحة دي، مش عن الفترة كلها.'
                  : 'These count the movements on this page, not the whole period.' }}
        </p>
      </div>

      <!-- ── Filters ─────────────────────────────────────────── -->
      <div class="jr-card p-3 flex flex-wrap items-center gap-2">
        <div class="jr-seg inline-flex rounded-full overflow-hidden">
          <button *ngFor="let t of tabs; let i = index" type="button" (click)="setSource(t.key)"
                  class="jr-seg-btn px-3 py-1.5 text-xs font-medium" [class.jr-seg-split]="i < tabs.length - 1"
                  [class.is-on]="source() === t.key">{{ ar() ? t.ar : t.en }}</button>
        </div>

        <div class="jr-seg inline-flex rounded-full overflow-hidden">
          <button *ngFor="let t of txTabs; let i = index" type="button" (click)="setTx(t.id)"
                  class="jr-seg-btn px-3 py-1.5 text-xs font-medium" [class.jr-seg-split]="i < txTabs.length - 1"
                  [class.is-on]="txType() === t.id">{{ ar() ? t.ar : t.en }}</button>
        </div>

        <div class="relative flex-1 min-w-[180px] max-w-xs">
          <lucide-icon [img]="SearchIcon" class="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 jr-faint"></lucide-icon>
          <input type="text" [(ngModel)]="searchText" (keyup.enter)="applySearch()"
                 class="jr-input w-full ps-8 pe-2 py-1.5 text-sm rounded-full"
                 [placeholder]="ar() ? 'بحث (Enter)…' : 'Search (Enter)…'"/>
        </div>

        <select [ngModel]="successFilter()" (ngModelChange)="setSuccess($event)"
                class="jr-input rounded-full px-3 py-1.5 text-xs">
          <option value="all">{{ ar() ? 'كل النتائج' : 'All results' }}</option>
          <option value="ok">{{ ar() ? 'ناجح فقط' : 'Success only' }}</option>
          <option value="fail">{{ ar() ? 'فشل فقط' : 'Failed only' }}</option>
        </select>

        <select [ngModel]="pageSize()" (ngModelChange)="setPageSize(+$event)"
                class="jr-input rounded-full px-3 py-1.5 text-xs">
          <option [ngValue]="25">25</option>
          <option [ngValue]="50">50</option>
          <option [ngValue]="100">100</option>
          <option [ngValue]="200">200</option>
        </select>
      </div>

      <!-- ── States ──────────────────────────────────────────── -->
      <div *ngIf="!filter.canFetch()" class="jr-card p-8 text-center space-y-3">
        <div class="inline-flex h-12 w-12 items-center justify-center rounded-2xl jr-inset">
          <lucide-icon [img]="BuildingIcon" class="h-6 w-6 jr-muted"></lucide-icon>
        </div>
        <p class="text-sm jr-muted">{{ filter.validateBilingual(lang.language()) }}</p>
      </div>

      <div *ngIf="filter.canFetch() && loading() && !data().length" class="space-y-2.5">
        <div *ngFor="let i of [1,2,3]" class="jr-card p-4 animate-pulse h-28"></div>
      </div>

      <div *ngIf="error()" class="jr-warnbox rounded-xl px-4 py-3 text-sm">
        <strong>{{ ar() ? 'خطأ:' : 'Error:' }}</strong> {{ error() }}
      </div>

      <ng-container *ngIf="filter.canFetch() && !error()">
        <div *ngIf="!loading() && !data().length" class="jr-card p-10 text-center text-sm jr-muted">
          {{ ar() ? 'مفيش نشاط في الفترة دي.' : 'No activity in this period.' }}
        </div>

        <!-- ── Day → run → event ────────────────────────────── -->
        <div *ngFor="let d of days()" class="space-y-2.5">

          <div class="flex items-center gap-3 pt-1">
            <span class="text-[13px] font-bold jr-ink whitespace-nowrap">{{ d.label }}</span>
            <span class="flex-1 jr-rule-b"></span>
          </div>

          <div *ngFor="let s of d.sessions" class="jr-card overflow-hidden" [ngClass]="sessionTone(s)">

            <!-- The run's own headline: what it is, and where its money ended up. -->
            <div class="jr-sess-head flex items-start gap-3 p-3 md:p-3.5">
              <span class="jr-glyph shrink-0 w-9 h-9 rounded-[11px] grid place-items-center text-base">{{ sessionGlyph(s) }}</span>

              <div class="flex-1 min-w-0">
                <div class="flex items-baseline gap-2 flex-wrap">
                  <span class="text-sm font-bold jr-ink">{{ s.title }}</span>
                  <a *ngIf="s.orderId" [routerLink]="['/monitoring/journey']" [queryParams]="{ order: s.orderId }"
                     class="jr-link text-[11.5px] font-semibold">{{ ar() ? 'افتح الرحلة ←' : 'Open journey →' }}</a>
                </div>
                <div *ngIf="s.subtitle" class="mt-0.5 text-[12.5px] jr-muted"><bdi>{{ s.subtitle }}</bdi></div>
                <div class="mt-1 text-[11.5px] jr-faint">
                  <bdi>{{ num(s.events.length) }} {{ ar() ? 'حركة' : 'movements' }}</bdi>
                  <span class="mx-1.5">·</span>
                  <bdi>{{ s.from }}<span *ngIf="s.to !== s.from"> → {{ s.to }}</span></bdi>
                </div>
              </div>

              <div class="shrink-0 text-end">
                <ng-container *ngIf="s.net !== null; else movedOnly">
                  <div class="text-[11px] jr-muted">{{ ar() ? 'استقرّ على' : 'Settled at' }}</div>
                  <div class="text-[15px] font-bold jr-ink tabular-nums"><bdi>{{ cash(s.net) }}</bdi></div>
                </ng-container>
                <ng-template #movedOnly>
                  <div class="text-[11px] jr-faint">{{ ar() ? 'مالهاش فلوس' : 'No money' }}</div>
                </ng-template>
                <div *ngIf="s.moved" class="jr-pill mt-1 inline-block rounded-full px-[10px] py-[2px] text-[11px] font-bold tabular-nums"
                     [ngClass]="tone(s.moved)"><bdi>{{ signed(s.moved) }}</bdi></div>
              </div>
            </div>

            <!-- Its events. -->
            <div class="jr-list border-t" style="border-color:var(--border)">
              <div *ngFor="let e of s.events" class="jr-hair" [ngClass]="e.tone">

                <button type="button" class="jr-ev-head w-full flex items-start gap-2.5 px-3 py-2 text-start"
                        (click)="toggle(e.row.id)" [attr.aria-expanded]="isOpen(e.row.id)">
                  <span class="jr-glyph shrink-0 w-7 h-7 rounded-[9px] grid place-items-center text-[13px] font-semibold">{{ e.glyph }}</span>

                  <span class="flex-1 min-w-0">
                    <span class="flex items-baseline gap-2 flex-wrap">
                      <span class="text-[13px] font-semibold jr-ink">{{ e.title }}</span>
                      <bdi class="text-[11px] jr-faint">{{ e.time }}</bdi>
                      <span *ngIf="!e.row.success" class="jr-badge bad">{{ ar() ? 'فشلت' : 'failed' }}</span>
                    </span>
                    <span *ngIf="detail(e)" class="block mt-0.5 text-[12px] leading-[1.6] jr-muted truncate">
                      {{ detail(e) }}
                      <bdi *ngIf="e.row.destinationTableName" class="jr-dest"> → {{ e.row.destinationTableName }}</bdi>
                    </span>
                  </span>

                  <span *ngIf="e.delta !== null"
                        class="jr-pill shrink-0 mt-0.5 rounded-full px-[10px] py-[2px] text-[11px] font-bold tabular-nums whitespace-nowrap"
                        [ngClass]="tone(e.delta)"><bdi>{{ deltaLabel(e.delta) }}</bdi></span>
                  <lucide-icon [img]="ChevronDown" class="jr-chev shrink-0 mt-1 w-4 h-4"></lucide-icon>
                </button>

                <div *ngIf="isOpen(e.row.id)" class="jr-ev-body grid gap-2.5 px-3 pb-3">

                  <!-- before → after → difference. Only when the row actually carries them:
                       a login has no net, and printing 0.00 would read as a zero bill. -->
                  <div *ngIf="hasMoney(e); else noMoney" class="grid grid-cols-3 gap-2">
                    <div class="jr-inset px-2.5 py-[7px]">
                      <div class="text-[11px] jr-muted">{{ ar() ? 'قبل' : 'Before' }}</div>
                      <div class="mt-px text-[13px] font-bold jr-ink tabular-nums"><bdi>{{ cash(e.row.netBefore!) }}</bdi></div>
                    </div>
                    <div class="jr-inset px-2.5 py-[7px]">
                      <div class="text-[11px] jr-muted">{{ ar() ? 'بعد' : 'After' }}</div>
                      <div class="mt-px text-[13px] font-bold jr-ink tabular-nums"><bdi>{{ cash(e.row.netAfter!) }}</bdi></div>
                    </div>
                    <div class="jr-inset px-2.5 py-[7px]">
                      <div class="text-[11px] jr-muted">{{ ar() ? 'الفرق' : 'Difference' }}</div>
                      <div class="jr-diff mt-px text-[13px] font-bold tabular-nums"
                           [ngClass]="tone(e.delta ?? 0)"><bdi>{{ deltaLabel(e.delta) }}</bdi></div>
                    </div>
                  </div>
                  <ng-template #noMoney>
                    <p class="jr-note text-[12px] leading-[1.7] jr-muted rounded-[10px] px-[11px] py-[8px]">
                      {{ ar() ? 'الحركة دي مش على فلوس، فمفيش أرقام تتعرض.'
                              : 'This movement is not about money, so there are no figures to show.' }}
                    </p>
                  </ng-template>

                  <!-- Counts, only the ones that actually moved. -->
                  <div *ngIf="factChips(e).length" class="flex flex-wrap gap-2">
                    <div class="jr-inset min-w-[96px] px-2.5 py-1.5" *ngFor="let f of factChips(e)">
                      <div class="text-[11px] jr-muted">{{ f.label }}</div>
                      <div class="mt-px text-[13px] font-semibold jr-ink"><bdi>{{ f.value }}</bdi></div>
                    </div>
                  </div>

                  <!-- Who, and from which machine. An owner chasing a number ends up here. -->
                  <div class="jr-inset px-[11px] py-2 text-[12px] jr-muted flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span><bdi>{{ ar() ? 'المستخدم' : 'User' }}: <span class="jr-ink font-semibold">{{ e.who }}</span></bdi></span>
                    <span *ngIf="e.row.waiterName"><bdi>{{ ar() ? 'الويتر' : 'Waiter' }}: {{ e.row.waiterName }}</bdi></span>
                    <span *ngIf="e.row.machineName"><bdi>{{ ar() ? 'الجهاز' : 'Device' }}: {{ e.row.machineName }}</bdi></span>
                    <span *ngIf="e.row.branchName"><bdi>{{ e.row.branchName }}</bdi></span>
                  </div>

                  <div *ngIf="!e.row.success && e.row.errorMessage" class="jr-warnbox rounded-[10px] px-[11px] py-2 text-[12px]">
                    <bdi>{{ e.row.errorMessage }}</bdi>
                  </div>

                  <details *ngIf="e.row.description" class="jr-inset">
                    <summary class="jr-summary cursor-pointer px-[11px] py-[7px] text-xs jr-muted">
                      {{ ar() ? 'تفاصيل تقنية' : 'Technical detail' }}
                    </summary>
                    <div class="px-[11px] py-2 text-[11.5px] leading-[1.7] jr-muted font-mono break-words">
                      <bdi>{{ e.row.description }}</bdi>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </div>
        </div>

        <app-pager [page]="page()" [pageSize]="pageSize()" [totalCount]="totalCount()"
                   (pageChange)="setPage($event)"></app-pager>
      </ng-container>
    </div>
  `,
  styles: [`
    :host{display:block}

    .jr-card{background:var(--card);border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow)}
    .jr-inset{border:1px solid var(--border);border-radius:10px;background:var(--card-2)}
    .jr-inset.is-hot{border-color:var(--bad-ring);background:var(--bad-soft)}
    .jr-note{background:var(--bg-2);border:1px dashed var(--border-strong)}
    .jr-rule-b{border-bottom:1px solid var(--border)}
    .jr-warnbox{color:var(--warn);background:var(--warn-soft);border:1px solid var(--warn-ring)}
    .text-bad{color:var(--bad)}

    .jr-badge{font-size:10.5px;font-weight:600;padding:2px 7px;border-radius:999px;white-space:nowrap}
    .jr-badge.bad{color:var(--bad);background:var(--bad-soft)}

    .jr-seg{border:1px solid var(--border);background:var(--card)}
    .jr-seg-btn{color:var(--muted)}
    .jr-seg-btn.is-on{background:var(--ink);color:var(--card)}
    .jr-seg-split{border-inline-end:1px solid var(--border)}
    .jr-input{border:1px solid var(--border);background:var(--card);color:var(--ink)}
    .jr-input::placeholder{color:var(--faint)}
    .jr-input:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-ring)}
    .jr-toggle{border-color:var(--border-strong);background:var(--card-2);color:var(--muted);
      transition:color .18s ease-out,background-color .18s ease-out,border-color .18s ease-out}
    .jr-toggle.is-on{border-color:var(--good-ring);background:var(--good-soft);color:var(--good)}
    .jr-toggle:disabled{opacity:.55;cursor:default}
    .jr-link{color:var(--brand)} .jr-link:hover{text-decoration:underline}

    /* The run's header takes the run's tone; its events keep their own. */
    .jr-sess-head{background:var(--tone-soft)}
    .jr-glyph{color:var(--tone);background:var(--tone-soft)}
    .jr-dest{color:var(--tone);font-weight:600;white-space:nowrap}

    .jr-ev-head{cursor:pointer;transition:background-color .18s ease-out}
    .jr-ev-head:hover{background:var(--card-2)}
    .jr-ev-head:focus-visible{outline:2px solid var(--tone-ring);outline-offset:-3px}
    .jr-chev{display:inline-flex;color:var(--faint);transition:transform .18s ease-out}
    [aria-expanded="true"] .jr-chev{transform:rotate(180deg)}

    /* Hairline between events, never under the last — component styles are injected after the
       global sheet, so Tailwind's last:border-0 loses here. */
    .jr-hair{border-bottom:1px solid var(--border)}
    .jr-list>.jr-hair:last-child{border-bottom:0}

    @keyframes posrise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    .jr-ev-body{animation:posrise .22s cubic-bezier(.22,.61,.36,1) both}

    .jr-pill.up,.jr-diff.up{color:var(--good)} .jr-pill.up{background:var(--good-soft)}
    .jr-pill.down,.jr-diff.down{color:var(--bad)} .jr-pill.down{background:var(--bad-soft)}
    .jr-pill.flat,.jr-diff.flat{color:var(--faint)} .jr-pill.flat{background:var(--bg-2)}

    .jr-summary::-webkit-details-marker{display:none}

    @media (prefers-reduced-motion:reduce){
      .jr-ev-body{animation:none}
      .jr-chev,.jr-toggle,.jr-ev-head{transition:none}
    }
  `],
})
export class LiveFeedComponent implements OnDestroy {
  readonly lang = inject(LanguageService);
  readonly filter = inject(FilterService);
  private readonly api = inject(MonitoringApi);

  readonly data = signal<UnifiedAuditLog[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly source = signal<SourceTab>('all');
  readonly successFilter = signal<'all' | 'ok' | 'fail'>('all');
  readonly searchTerm = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(50);
  readonly txType = signal<number | null>(null);

  readonly autoRefresh = signal(false);
  private timer: ReturnType<typeof setInterval> | null = null;

  private readonly open = signal<ReadonlySet<number>>(new Set());
  searchText = '';

  readonly ar = computed(() => this.lang.language() === 'ar');

  readonly tabs: { key: SourceTab; en: string; ar: string }[] = [
    { key: 'all', en: 'All', ar: 'الكل' },
    { key: 'Order', en: 'Orders', ar: 'أوردرات' },
    { key: 'System', en: 'System', ar: 'النظام' },
    { key: 'Menu', en: 'Menu', ar: 'المنيو' },
  ];
  readonly txTabs: { id: number | null; en: string; ar: string }[] = [
    { id: null, en: 'All types', ar: 'كل الأنواع' },
    { id: 1, en: 'Dine-In', ar: 'صالة' },
    { id: 2, en: 'Delivery', ar: 'دليفري' },
    { id: 3, en: 'Take-Away', ar: 'تيك أواي' },
  ];

  readonly RefreshIcon = RefreshCw;
  readonly LoaderIcon = Loader;
  readonly BuildingIcon = Building2;
  readonly SearchIcon = Search;
  readonly PlayIcon = Play;
  readonly PauseIcon = Pause;
  readonly ChevronDown = ChevronDown;
  readonly ArrowIcon = ArrowRight;
  readonly exportCols = unifiedAuditExportColumns();

  constructor() {
    effect(() => {
      const ok = this.filter.canFetch();
      this.page(); this.pageSize(); this.source(); this.successFilter(); this.searchTerm(); this.txType();
      if (ok) this.reload();
      else this.data.set([]);
    });
  }

  ngOnDestroy(): void { this.stopTimer(); }

  // ── Folding the rows into days and runs ───────────────────────────────────

  /**
   * Rows → days → runs.
   *
   * A run is keyed on the ORDER, falling back to the table. The server sends both as real fields
   * now; before it did not, and grouping on the display string ("Table: 6#") would have split a
   * run the moment the label changed.
   */
  readonly days = computed<FeedDay[]>(() => {
    const rows = this.data();
    const byDay = new Map<string, UnifiedAuditLog[]>();

    for (const r of rows) {
      const key = (r.actionDate || '').slice(0, 10);
      const bucket = byDay.get(key);
      if (bucket) bucket.push(r); else byDay.set(key, [r]);
    }

    const days: FeedDay[] = [];
    for (const [dayKey, dayRows] of byDay) {
      const bySession = new Map<string, UnifiedAuditLog[]>();
      for (const r of dayRows) {
        const k = this.sessionKey(r);
        const bucket = bySession.get(k);
        if (bucket) bucket.push(r); else bySession.set(k, [r]);
      }

      const sessions = [...bySession.entries()]
        .map(([k, rs]) => this.buildSession(k, rs))
        .sort((a, b) => b.at - a.at);

      days.push({ key: dayKey, label: this.dayLabel(dayKey), sessions });
    }

    return days.sort((a, b) => b.key.localeCompare(a.key));
  });

  private sessionKey(r: UnifiedAuditLog): string {
    if (r.logSource !== 'Order') return `src:${r.logSource}`;
    if (r.orderId) return `order:${r.orderId}`;
    if (r.tableName) return `table:${r.tableName}`;
    // No identity at all — keep it on its own rather than pooling unrelated rows into one run.
    return `row:${r.id}`;
  }

  private buildSession(key: string, rows: UnifiedAuditLog[]): FeedSession {
    const events = rows.map(r => this.buildEvent(r));
    // Newest first, matching the order the server sends and the way a feed is read.
    events.sort((a, b) => this.stamp(b.row) - this.stamp(a.row));

    const first = rows[0];
    const kind: FeedSession['kind'] =
      first.logSource === 'Order' ? 'order' : first.logSource === 'Menu' ? 'menu' : 'system';

    // The run's net is the newest one anybody recorded — the figure it ended on.
    let net: number | null = null;
    for (const e of events) {
      if (e.row.netAfter !== null && e.row.netAfter !== undefined) { net = e.row.netAfter; break; }
    }

    const moved = events.reduce((sum, e) => sum + (e.delta ?? 0), 0);
    const times = events.map(e => e.time).filter(Boolean);
    const orderId = first.orderId && first.orderId > 0 ? first.orderId : null;

    return {
      key,
      title: this.sessionTitle(key, first),
      subtitle: this.sessionSubtitle(first),
      kind,
      events,
      net,
      moved: Math.round(moved * 100) / 100,
      from: times.length ? times[times.length - 1] : '',
      to: times.length ? times[0] : '',
      orderId,
      at: Math.max(...rows.map(r => this.stamp(r))),
    };
  }

  private sessionTitle(key: string, r: UnifiedAuditLog): string {
    if (key.startsWith('src:')) {
      return sourceLabel(r.logSource, this.lang.language());
    }
    if (r.tableName) return (this.ar() ? 'ترابيزة ' : 'Table ') + r.tableName;
    if (r.orderId) return (this.ar() ? 'أوردر #' : 'Order #') + r.orderId;
    return entityNameLabel(r.entityName, this.lang.language()) || (this.ar() ? 'حركة' : 'Movement');
  }

  private sessionSubtitle(r: UnifiedAuditLog): string {
    const bits: string[] = [];
    if (r.transactionTypeName) bits.push(r.transactionTypeName);
    if (r.orderId && r.tableName) bits.push((this.ar() ? 'أوردر #' : 'Order #') + r.orderId);
    if (r.receiptNumber) bits.push((this.ar() ? 'إيصال ' : 'Receipt ') + r.receiptNumber);
    if (r.waiterName) bits.push((this.ar() ? 'الويتر ' : 'Waiter ') + r.waiterName);
    return bits.join(' · ');
  }

  private buildEvent(r: UnifiedAuditLog): FeedEvent {
    const before = r.netBefore ?? null;
    const after = r.netAfter ?? null;
    // A delta needs BOTH sides. One number alone is not a change, and treating a missing
    // "before" as zero would report the first send as the whole bill appearing from nothing.
    const delta = before !== null && after !== null ? Math.round((after - before) * 100) / 100 : null;

    return {
      row: r,
      title: actionLabel(r.actionType, this.lang.language()),
      time: (r.actionTime || '').trim(),
      glyph: this.glyphFor(r.actionType),
      tone: this.toneFor(r),
      delta,
      who: r.userName || '—',
    };
  }

  private stamp(r: UnifiedAuditLog): number {
    const t = Date.parse(r.actionDate);
    return Number.isNaN(t) ? 0 : t;
  }

  private dayLabel(key: string): string {
    if (!key) return '';
    const d = new Date(key + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return key;
    return d.toLocaleDateString(this.ar() ? 'ar-EG' : 'en-GB',
      { weekday: 'long', day: 'numeric', month: 'long' });
  }

  // ── The headline numbers ──────────────────────────────────────────────────

  readonly orderSessionCount = computed(() =>
    this.days().reduce((n, d) => n + d.sessions.filter(s => s.kind === 'order').length, 0));

  /** Absolute movement, so a +300 and a −300 read as 600 moved rather than as nothing happening. */
  readonly movedTotal = computed(() =>
    this.days().reduce((sum, d) =>
      sum + d.sessions.reduce((s2, s) =>
        s2 + s.events.reduce((s3, e) => s3 + Math.abs(e.delta ?? 0), 0), 0), 0));

  readonly voidCount = computed(() => this.data().filter(r => /void/i.test(r.actionType)).length);
  readonly discountCount = computed(() =>
    this.data().filter(r => /discount|promo/i.test(r.actionType)).length);
  readonly failCount = computed(() => this.data().filter(r => !r.success).length);

  // ── Presentation ──────────────────────────────────────────────────────────

  isOpen(id: number): boolean { return this.open().has(id); }
  toggle(id: number): void {
    const next = new Set(this.open());
    if (!next.delete(id)) next.add(id);
    this.open.set(next);
  }

  hasMoney(e: FeedEvent): boolean {
    return e.row.netBefore !== null && e.row.netBefore !== undefined
        && e.row.netAfter !== null && e.row.netAfter !== undefined;
  }

  /** Counts worth a chip — only the ones that actually moved. */
  factChips(e: FeedEvent): { label: string; value: string }[] {
    const out: { label: string; value: string }[] = [];
    const r = e.row;
    const a = this.ar();

    if (r.itemCountBefore != null && r.itemCountAfter != null && r.itemCountBefore !== r.itemCountAfter) {
      out.push({ label: a ? 'الأصناف' : 'Items', value: `${r.itemCountBefore} → ${r.itemCountAfter}` });
    }
    if (r.guestCountBefore != null && r.guestCountAfter != null && r.guestCountBefore !== r.guestCountAfter) {
      out.push({ label: a ? 'الضيوف' : 'Guests', value: `${r.guestCountBefore} → ${r.guestCountAfter}` });
    }
    if (r.totalSalesBefore != null && r.totalSalesAfter != null && r.totalSalesBefore !== r.totalSalesAfter) {
      out.push({ label: a ? 'المبيعات' : 'Sales', value: `${this.cash(r.totalSalesBefore)} → ${this.cash(r.totalSalesAfter)}` });
    }
    return out;
  }

  detail(e: FeedEvent): string {
    const l = this.lang.language();
    const d = l === 'ar' ? unifiedDescription(e.row, 'ar') : (e.row.description || unifiedDescription(e.row, 'en'));
    // The title already says the action. A description that only repeats it is the noise the
    // old screen printed under every single row.
    return d && d.trim() !== e.title.trim() ? d : (e.row.entityType ? entityLabel(e.row.entityType, l) : '');
  }

  sessionGlyph(s: FeedSession): string {
    if (s.kind === 'system') return '👤';
    if (s.kind === 'menu') return '📋';
    return '🍽';
  }

  /** A run takes the colour of the worst thing in it — a void anywhere makes it worth a look. */
  sessionTone(s: FeedSession): string {
    if (s.events.some(e => !e.row.success)) return 'tone-bad';
    if (s.events.some(e => /void/i.test(e.row.actionType))) return 'tone-high';
    if (s.events.some(e => /discount|promo/i.test(e.row.actionType))) return 'tone-warn';
    if (s.kind !== 'order') return 'tone-neutral';
    return 'tone-brand';
  }

  private toneFor(r: UnifiedAuditLog): string {
    if (!r.success) return 'tone-bad';
    const a = (r.actionType || '').toLowerCase();
    if (a.includes('void') || a.includes('cancel')) return 'tone-bad';
    if (a.includes('discount') || a.includes('promo')) return 'tone-warn';
    if (a.includes('transfer') || a.includes('split')) return 'tone-high';
    if (a.includes('pay') || a.includes('checkout') || a.includes('endtable')) return 'tone-good';
    if (a.includes('send')) return 'tone-brand';
    return 'tone-neutral';
  }

  private glyphFor(action: string): string {
    const a = (action || '').toLowerCase();
    if (a.includes('void') || a.includes('cancel')) return '✕';
    if (a.includes('transfer')) return '⇄';
    if (a.includes('split')) return '⑂';
    if (a.includes('discount') || a.includes('promo')) return '%';
    if (a.includes('checkout')) return '🧾';
    if (a.includes('pay') || a.includes('endtable')) return '✓';
    if (a.includes('send')) return '→';
    if (a.includes('login')) return '⇥';
    if (a.includes('logout')) return '⇤';
    if (a.includes('open')) return '＋';
    return '•';
  }

  tone(delta: number): string {
    if (delta > 0.004) return 'up';
    if (delta < -0.004) return 'down';
    return 'flat';
  }

  deltaLabel(delta: number | null): string {
    if (delta === null) return this.ar() ? 'مالهاش رقم' : 'no figure';
    if (Math.abs(delta) < 0.005) return this.ar() ? 'بدون تغيير' : 'no change';
    return this.signed(delta);
  }

  signed(v: number): string { return (v > 0 ? '+' : v < 0 ? '−' : '') + this.cash(Math.abs(v)); }

  cash(v: number | null | undefined): string {
    return (v ?? 0).toLocaleString(this.ar() ? 'ar-EG' : 'en-US',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  num(v: number): string { return v.toLocaleString(this.ar() ? 'ar-EG' : 'en-US'); }

  // ── Plumbing ──────────────────────────────────────────────────────────────

  setSource(s: SourceTab): void { this.page.set(1); this.source.set(s); }
  setTx(id: number | null): void { this.page.set(1); this.txType.set(id); }
  setSuccess(v: 'all' | 'ok' | 'fail'): void { this.page.set(1); this.successFilter.set(v); }
  setPageSize(n: number): void { this.page.set(1); this.pageSize.set(n); }
  setPage(p: number): void { this.page.set(p); }
  applySearch(): void { this.page.set(1); this.searchTerm.set(this.searchText.trim()); }

  toggleAuto(): void {
    this.autoRefresh.set(!this.autoRefresh());
    if (this.autoRefresh()) {
      this.timer = setInterval(() => { if (this.filter.canFetch() && !this.loading()) this.reload(); }, 20000);
    } else {
      this.stopTimer();
    }
  }
  private stopTimer(): void { if (this.timer) { clearInterval(this.timer); this.timer = null; } }

  reload(): void {
    if (!this.filter.canFetch()) return;
    this.loading.set(true);
    this.error.set('');
    this.api.timeline({
      fromDate: this.filter.fromDate(),
      toDate: this.filter.toDate(),
      branchId: this.filter.branchId(),
      logSource: this.source() === 'all' ? null : this.source(),
      successOnly: this.successFilter() === 'all' ? null : this.successFilter() === 'ok',
      searchText: this.searchTerm() || null,
      transactionType: this.txType(),
      page: this.page(),
      pageSize: this.pageSize(),
    }).pipe(
      catchError((err) => {
        this.error.set(err?.message || 'Failed to load activity.');
        return of(null);
      }),
      finalize(() => this.loading.set(false)),
    ).subscribe((res) => {
      if (res) { this.data.set(res.data ?? []); this.totalCount.set(res.totalCount ?? 0); }
    });
  }
}
