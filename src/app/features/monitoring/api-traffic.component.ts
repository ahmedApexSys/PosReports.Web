import {
  Component, inject, signal, computed, effect, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule, RefreshCw, Loader, Building2, Search, Server, Zap, Clock, Users, Info,
} from 'lucide-angular';
import { catchError, finalize, of } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService } from '../../core/filters/filter.service';
import { MonitoringApi } from '../../core/api/monitoring.api';
import { ApiTraffic } from '../../core/models/api-traffic.models';
import { ExportMenuComponent } from '../../shared/export-menu/export-menu.component';
import { apiEndpointExportColumns } from '../../core/export/monitoring-export-columns';

/**
 * API Traffic — what the API actually did in the window.
 *
 * <p>
 * The endpoints table is the point of the screen, and it is ordered by TOTAL
 * time consumed, not by average, because that is the figure worth acting on: an
 * endpoint averaging 40 ms called fifty thousand times costs the server far more
 * than one averaging four seconds called twice. So total time is the column that
 * carries the bar and the weight — the table says out loud why it is in the
 * order it is in.
 * </p>
 *
 * <p>
 * THE ONE THING THIS SCREEN MUST NOT OVERSTATE. The house convention returns
 * HTTP 200 with success=false for business failures, so the stored status is 200
 * for a great many real failures and every error count here is a floor. The
 * server says so with `errorRateIsALowerBound`, and while that is true the error
 * headers carry "حد أدنى" / "min" and a quiet note sits under every panel that
 * shows an error figure. Durations are untouched by the convention: the slow
 * findings are exact, the failing ones are a lower bound, and the screen never
 * blurs the difference.
 * </p>
 */
@Component({
  selector: 'app-api-traffic',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, ExportMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5">
      <!-- Header -->
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
            {{ ar() ? 'حركة الـ API' : 'API Traffic' }}
          </h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {{ ar()
                ? 'السيرفر بيشتغل في إيه — كل نقطة، وكام طلب، والوقت اللي أكلته.'
                : 'Where the server spends itself — every endpoint, its calls, and the time it costs.' }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <app-export-menu *ngIf="endpointRows().length"
            [rows]="data()!.endpoints" [columns]="exportCols"
            titleEn="API Traffic — endpoints by total time"
            titleAr="حركة الـ API — النقاط بإجمالي الوقت"
            [subtitleEn]="lowerBound() ? 'Error counts are a minimum: failures returning HTTP 200 are not counted.' : ''"
            [subtitleAr]="lowerBound() ? 'أعداد الأخطاء حد أدنى: الفشل اللي بيرجع 200 مش محسوب فيها.' : ''"
            [fromDate]="filter.fromDate()" [toDate]="filter.toDate()"
            fileBase="api-traffic"></app-export-menu>
          <button (click)="load()" class="btn-ghost text-sm" [disabled]="loading() || !filter.canFetch()">
            <lucide-icon [img]="loading() ? LoaderIcon : RefreshIcon" class="h-4 w-4" [class.animate-spin]="loading()"></lucide-icon>
            {{ ar() ? 'تحديث' : 'Refresh' }}
          </button>
        </div>
      </div>

      <!-- Gate — branch + a valid window, same as every report screen -->
      <div *ngIf="!filter.canFetch()" class="card-padded text-center py-12 space-y-3">
        <div class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-warning-soft text-warning">
          <lucide-icon [img]="BuildingIcon" class="h-6 w-6"></lucide-icon>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400">{{ filter.validateBilingual(lang.language()) }}</p>
      </div>

      <ng-container *ngIf="filter.canFetch()">
        <div *ngIf="error()" class="card-padded ring-1 ring-critical/30 bg-critical-soft text-critical text-sm">
          <strong>{{ ar() ? 'خطأ:' : 'Error:' }}</strong> {{ error() }}
        </div>

        <div *ngIf="loading() && !data()" class="space-y-3">
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div *ngFor="let i of [1,2,3,4]" class="card-padded animate-pulse h-20"></div>
          </div>
          <div class="card-padded animate-pulse h-72"></div>
        </div>

        <!--
          Nothing to report. The server said why in its own words, so the page
          says exactly that and stops — an empty table would imply zero traffic,
          which is a different claim from "this log has never been written here".
        -->
        <div *ngIf="unavailableMsg()" class="card-padded text-center py-12 space-y-3">
          <div class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-surface-dark-muted text-slate-400">
            <lucide-icon [img]="ServerIcon" class="h-6 w-6"></lucide-icon>
          </div>
          <p class="text-sm text-slate-600 dark:text-slate-300">{{ unavailableMsg() }}</p>
        </div>

        <ng-container *ngIf="d() && !unavailableMsg()">
          <!-- ── Summary ─────────────────────────────────────────── -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div class="card-padded">
              <div class="text-[11px] uppercase tracking-wide text-slate-400">{{ ar() ? 'إجمالي الطلبات' : 'Total calls' }}</div>
              <div class="text-2xl font-bold text-slate-900 dark:text-slate-50 tabular mt-1"><bdi>{{ num(d()!.totalCalls) }}</bdi></div>
            </div>
            <div class="card-padded">
              <div class="text-[11px] uppercase tracking-wide text-slate-400">{{ ar() ? 'متوسط الزمن' : 'Average duration' }}</div>
              <div class="text-2xl font-bold text-slate-900 dark:text-slate-50 tabular mt-1"><bdi>{{ dur(d()!.avgMs) }}</bdi></div>
            </div>
            <div class="card-padded">
              <div class="text-[11px] uppercase tracking-wide text-slate-400">{{ ar() ? 'مستخدمين' : 'Distinct users' }}</div>
              <div class="text-2xl font-bold text-slate-900 dark:text-slate-50 tabular mt-1"><bdi>{{ num(d()!.distinctUsers) }}</bdi></div>
            </div>
            <div class="card-padded">
              <div class="text-[11px] uppercase tracking-wide text-slate-400">{{ ar() ? 'نقاط مختلفة' : 'Distinct endpoints' }}</div>
              <div class="text-2xl font-bold text-slate-900 dark:text-slate-50 tabular mt-1"><bdi>{{ num(d()!.distinctEndpoints) }}</bdi></div>
            </div>
          </div>

          <!-- Errors sit apart from the four counts above, because unlike them
               this one is not a total. -->
          <div class="card-padded !py-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span class="text-[11px] uppercase tracking-wide text-slate-400">{{ errCountHeader() }}</span>
            <bdi class="text-lg font-bold tabular" [class.text-critical]="d()!.errorCalls > 0"
                 [class.text-slate-400]="!d()!.errorCalls">{{ num(d()!.errorCalls) }}</bdi>
            <span class="text-xs text-slate-400">{{ ar() ? 'من' : 'of' }} <bdi>{{ num(d()!.totalCalls) }}</bdi></span>
            <ng-container *ngIf="lowerBound()"><ng-container *ngTemplateOutlet="minNote"></ng-container></ng-container>
          </div>

          <!-- Empty window — real, and different from "unavailable" -->
          <div *ngIf="!d()!.totalCalls" class="card-padded text-center py-10 text-sm text-slate-500">
            {{ ar() ? 'مفيش طلبات اتسجلت في الفترة دي.' : 'No requests were logged in this window.' }}
          </div>

          <ng-container *ngIf="d()!.totalCalls">
            <!-- ── Endpoints — the centrepiece ───────────────────── -->
            <div class="card-padded space-y-3">
              <div class="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 class="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-50">
                    <lucide-icon [img]="ServerIcon" class="h-4 w-4 text-brand-600"></lucide-icon>
                    {{ ar() ? 'النقاط — مرتبة بإجمالي الوقت' : 'Endpoints — by total time' }}
                  </h2>
                  <p *ngIf="ar(); else whyEn" class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                    الترتيب بإجمالي الوقت اللي كل نقطة أخدته من السيرفر، مش بالمتوسط: نقطة متوسطها
                    <bdi>40 ms</bdi> واتنادت <bdi>50,000</bdi> مرة بتكلّف السيرفر أكتر من واحدة
                    متوسطها <bdi>4</bdi> ثواني واتنادت مرتين — والأولى دي اللي تستاهل تتصلّح.
                  </p>
                  <ng-template #whyEn>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                      Ordered by the total time each endpoint took off the server, not by its average:
                      one averaging <bdi>40 ms</bdi> called <bdi>50,000</bdi> times costs more than one
                      averaging <bdi>4 s</bdi> called twice — and the first is the one worth fixing.
                    </p>
                  </ng-template>
                </div>
                <!-- Scope controls -->
                <div class="flex items-center gap-2">
                  <div class="relative">
                    <lucide-icon [img]="SearchIcon" class="absolute start-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"></lucide-icon>
                    <input type="text" dir="ltr" [ngModel]="pathDraft()" (ngModelChange)="pathDraft.set($event)"
                           (keyup.enter)="applyPath()" (blur)="applyPath()"
                           class="w-44 ps-8 pe-2 py-1.5 text-sm rounded-card-sm bg-slate-50 dark:bg-surface-dark-muted border-0 focus:ring-2 focus:ring-brand-500/30"
                           [placeholder]="ar() ? 'فلتر بالمسار…' : 'Filter by path…'"/>
                  </div>
                  <select [ngModel]="top()" (ngModelChange)="top.set(+$event)"
                          class="bg-white dark:bg-surface-dark-subtle border border-slate-300 dark:border-slate-700 rounded-card-sm px-2 py-1.5 text-sm">
                    <option *ngFor="let t of topOptions" [value]="t">{{ ar() ? 'أعلى' : 'Top' }} {{ t }}</option>
                  </select>
                </div>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-sm min-w-[880px]">
                  <thead>
                    <tr>
                      <th class="th text-start w-8">#</th>
                      <th class="th text-start">{{ ar() ? 'النقطة' : 'Endpoint' }}</th>
                      <th class="th text-start w-56">{{ ar() ? 'إجمالي الوقت' : 'Total time' }}</th>
                      <th class="th text-end">{{ ar() ? 'الطلبات' : 'Calls' }}</th>
                      <th class="th text-end">{{ ar() ? 'المتوسط' : 'Avg' }}</th>
                      <th class="th text-end">P95</th>
                      <th class="th text-end">{{ ar() ? 'الأقصى' : 'Max' }}</th>
                      <th class="th text-end">{{ errHeader() }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let r of endpointRows()" class="border-b border-slate-100 dark:border-slate-800 last:border-0 align-top">
                      <td class="py-2 text-xs text-slate-300 dark:text-slate-600 tabular"><bdi>{{ r.rank }}</bdi></td>
                      <td class="py-2 pe-3">
                        <bdi class="path" dir="ltr">{{ r.e.path }}</bdi>
                        <span class="pill bg-slate-100 dark:bg-surface-dark-muted text-[10px] ms-1.5 align-middle"><bdi>{{ r.e.httpMethod }}</bdi></span>
                      </td>
                      <!-- The column the sort is about, so it carries the weight and the bar. -->
                      <td class="py-2 pe-4">
                        <bdi class="block text-base font-bold tabular text-slate-900 dark:text-slate-50">{{ dur(r.e.totalMs) }}</bdi>
                        <div class="bar"><span [style.width.%]="r.barPct"></span></div>
                        <div class="text-[10px] text-slate-400 mt-0.5">
                          <bdi>{{ share(r.sharePct) }}</bdi> {{ ar() ? 'من وقت النقاط المعروضة' : 'of the listed endpoints’ time' }}
                        </div>
                      </td>
                      <td class="py-2 text-end tabular font-medium text-slate-700 dark:text-slate-200"><bdi>{{ num(r.e.calls) }}</bdi></td>
                      <td class="py-2 text-end tabular text-slate-500"><bdi>{{ dur(r.e.avgMs) }}</bdi></td>
                      <td class="py-2 text-end tabular text-slate-500"><bdi>{{ dur(r.e.p95Ms) }}</bdi></td>
                      <td class="py-2 text-end tabular text-slate-500"><bdi>{{ dur(r.e.maxMs) }}</bdi></td>
                      <td class="py-2 text-end tabular" [class.text-critical]="r.e.errorCalls > 0" [class.text-slate-300]="!r.e.errorCalls">
                        <bdi>{{ share(r.e.errorRate) }}</bdi>
                        <span *ngIf="r.e.errorCalls" class="block text-[10px] text-slate-400"><bdi>{{ num(r.e.errorCalls) }}</bdi></span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <ng-container *ngIf="lowerBound()"><ng-container *ngTemplateOutlet="minNote"></ng-container></ng-container>
            </div>

            <!-- ── Load by hour ──────────────────────────────────── -->
            <div class="card-padded space-y-3">
              <div class="flex items-baseline justify-between gap-3 flex-wrap">
                <h2 class="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-50">
                  <lucide-icon [img]="ClockIcon" class="h-4 w-4 text-brand-600"></lucide-icon>
                  {{ ar() ? 'الضغط على مدار اليوم' : 'Load by hour' }}
                </h2>
                <p *ngIf="peak()" class="text-xs text-slate-500 dark:text-slate-400">
                  {{ ar() ? 'أعلى ضغط الساعة' : 'Busiest hour' }}
                  <bdi class="font-semibold text-slate-700 dark:text-slate-200">{{ hourLabel(peak()!.hour) }}</bdi>
                  — <bdi>{{ num(peak()!.calls) }}</bdi> {{ ar() ? 'طلب' : 'calls' }}
                </p>
              </div>
              <!-- A 24-hour axis reads 0 → 23 in both languages; forcing LTR
                   here stops the chart mirroring itself in Arabic. -->
              <div dir="ltr" class="flex items-end gap-[3px] h-24">
                <div *ngFor="let h of hours()" class="flex-1 h-full flex items-end"
                     [title]="hourTitle(h.hour, h.calls, h.avgMs)">
                  <div class="hbar" [class.peak]="h.isPeak" [style.height.%]="h.pct"></div>
                </div>
              </div>
              <div dir="ltr" class="flex gap-[3px]">
                <div *ngFor="let h of hours()" class="flex-1 text-center text-[9px] tabular"
                     [class.text-brand-600]="h.isPeak" [class.font-bold]="h.isPeak"
                     [class.text-slate-400]="!h.isPeak">
                  <bdi>{{ h.hour }}</bdi>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <!-- ── Slowest individual calls ────────────────────── -->
              <div class="card-padded space-y-3">
                <div>
                  <h2 class="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-50">
                    <lucide-icon [img]="ZapIcon" class="h-4 w-4 text-brand-600"></lucide-icon>
                    {{ ar() ? 'أبطأ الطلبات' : 'Slowest individual calls' }}
                  </h2>
                  <p *ngIf="ar(); else slowWhyEn" class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    المتوسط بيخبّي الطلب اللي أخد <bdi>11</bdi> ثانية وحد واقف على الكاشير مستنّي.
                  </p>
                  <ng-template #slowWhyEn>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      An average hides the one request that took eleven seconds while somebody stood
                      at the till waiting.
                    </p>
                  </ng-template>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full text-sm min-w-[560px]">
                    <thead>
                      <tr>
                        <th class="th text-start">{{ ar() ? 'النقطة' : 'Endpoint' }}</th>
                        <th class="th text-end">{{ ar() ? 'الزمن' : 'Duration' }}</th>
                        <th class="th text-end">{{ ar() ? 'الحالة' : 'Status' }}</th>
                        <th class="th text-start ps-3">{{ ar() ? 'المستخدم' : 'User' }}</th>
                        <th class="th text-start">{{ ar() ? 'الجهاز' : 'Machine' }}</th>
                        <th class="th text-end">{{ ar() ? 'الوقت' : 'At' }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let c of d()!.slowestCalls" class="border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <td class="py-2 pe-2"><bdi class="path" dir="ltr">{{ c.httpMethod }} {{ c.path }}</bdi></td>
                        <td class="py-2 text-end tabular font-bold" [class]="durTone(c.durationMs)"><bdi>{{ dur(c.durationMs) }}</bdi></td>
                        <td class="py-2 text-end tabular" [class.text-critical]="c.responseStatus >= 400" [class.text-slate-500]="c.responseStatus < 400">
                          <bdi>{{ c.responseStatus }}</bdi>
                        </td>
                        <td class="py-2 ps-3 text-slate-600 dark:text-slate-300"><bdi>{{ c.userName || '—' }}</bdi></td>
                        <td class="py-2 text-slate-500"><bdi>{{ c.machineName || '—' }}</bdi></td>
                        <td class="py-2 text-end text-xs text-slate-400"><bdi>{{ c.at || '—' }}</bdi></td>
                      </tr>
                      <tr *ngIf="!d()!.slowestCalls.length">
                        <td colspan="6" class="py-6 text-center text-slate-400 text-sm">{{ ar() ? 'مفيش طلبات بطيئة اتسجلت.' : 'No slow calls recorded.' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p class="note" *ngIf="lowerBound() && d()!.slowestCalls.length">
                  <lucide-icon [img]="InfoIcon" class="h-3.5 w-3.5 shrink-0 mt-px"></lucide-icon>
                  <span *ngIf="ar(); else statusNoteEn">
                    الحالة دي اللي اتخزنت وقت الطلب — الـ <bdi>200</bdi> هنا ممكن يكون فشل رجع
                    بـ <bdi>success=false</bdi>.
                  </span>
                  <ng-template #statusNoteEn>
                    <span>The status is the one stored with the request — a <bdi>200</bdi> here may
                      still have been a failure returned with <bdi>success=false</bdi>.</span>
                  </ng-template>
                </p>
              </div>

              <!-- ── Top users by call volume ────────────────────── -->
              <div class="card-padded space-y-3">
                <h2 class="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-50">
                  <lucide-icon [img]="UsersIcon" class="h-4 w-4 text-brand-600"></lucide-icon>
                  {{ ar() ? 'أكتر المستخدمين طلبات' : 'Top users by call volume' }}
                </h2>
                <div class="overflow-x-auto">
                  <table class="w-full text-sm min-w-[520px]">
                    <thead>
                      <tr>
                        <th class="th text-start">{{ ar() ? 'المستخدم' : 'User' }}</th>
                        <th class="th text-end">{{ ar() ? 'الطلبات' : 'Calls' }}</th>
                        <th class="th text-end">{{ ar() ? 'المتوسط' : 'Avg' }}</th>
                        <th class="th text-end">{{ ar() ? 'نقاط' : 'Paths' }}</th>
                        <th class="th text-end">{{ errCountHeader() }}</th>
                        <th class="th text-end">{{ ar() ? 'آخر ظهور' : 'Last seen' }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let u of d()!.users" class="border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <td class="py-2 text-slate-700 dark:text-slate-200"><bdi>{{ u.userName || u.userId || '—' }}</bdi></td>
                        <td class="py-2 text-end tabular font-medium text-slate-900 dark:text-slate-50"><bdi>{{ num(u.calls) }}</bdi></td>
                        <td class="py-2 text-end tabular text-slate-500"><bdi>{{ dur(u.avgMs) }}</bdi></td>
                        <td class="py-2 text-end tabular text-slate-500"><bdi>{{ num(u.distinctPaths) }}</bdi></td>
                        <td class="py-2 text-end tabular" [class.text-critical]="u.errorCalls > 0" [class.text-slate-300]="!u.errorCalls">
                          <bdi>{{ num(u.errorCalls) }}</bdi>
                        </td>
                        <td class="py-2 text-end text-xs text-slate-400"><bdi>{{ u.lastSeen || '—' }}</bdi></td>
                      </tr>
                      <tr *ngIf="!d()!.users.length">
                        <td colspan="6" class="py-6 text-center text-slate-400 text-sm">{{ ar() ? 'مفيش مستخدمين متسجلين على الطلبات.' : 'No calls carried a signed-in user.' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <ng-container *ngIf="lowerBound() && d()!.users.length"><ng-container *ngTemplateOutlet="minNote"></ng-container></ng-container>
              </div>
            </div>
          </ng-container>
        </ng-container>
      </ng-container>
    </div>

    <!-- One sentence, one place. Rendered beside every error figure on the page. -->
    <ng-template #minNote>
      <p class="note">
        <lucide-icon [img]="InfoIcon" class="h-3.5 w-3.5 shrink-0 mt-px"></lucide-icon>
        <span *ngIf="ar(); else minNoteEn">
          نسبة الأخطاء دي حد أدنى — الفشل اللي بيرجع <bdi>200</bdi> مش محسوب فيها.
        </span>
        <ng-template #minNoteEn>
          <span>This error figure is a minimum, not a total — failures that return
            <bdi>HTTP 200</bdi> are not counted.</span>
        </ng-template>
      </p>
    </ng-template>
  `,
  styles: [`
    :host { display: block; }
    .th { @apply text-[10px] uppercase tracking-wide text-slate-400 font-medium pb-2; }
    .path { @apply font-mono text-[12px] text-slate-700 dark:text-slate-200 break-all; }
    .bar { @apply block h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-1; }
    .bar > span { @apply block h-full rounded-full bg-brand-500; }
    .hbar { @apply w-full rounded-t-sm bg-brand-500/35 min-h-[2px]; }
    .hbar.peak { @apply bg-brand-600; }
    .note { @apply flex items-start gap-1.5 text-[11px] leading-snug text-slate-400 dark:text-slate-500; }
  `],
})
export class ApiTrafficComponent {
  readonly lang = inject(LanguageService);
  readonly filter = inject(FilterService);
  private readonly api = inject(MonitoringApi);

  readonly data = signal<ApiTraffic | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  /** What the user is typing. Deliberately NOT read by the reload effect. */
  readonly pathDraft = signal('');
  /** What was actually asked for — changing this is what refetches. */
  private readonly appliedPath = signal('');
  readonly top = signal(20);
  readonly topOptions = [10, 20, 50, 100];

  readonly exportCols = apiEndpointExportColumns();

  readonly RefreshIcon = RefreshCw;
  readonly LoaderIcon = Loader;
  readonly BuildingIcon = Building2;
  readonly SearchIcon = Search;
  readonly ServerIcon = Server;
  readonly ZapIcon = Zap;
  readonly ClockIcon = Clock;
  readonly UsersIcon = Users;
  readonly InfoIcon = Info;

  readonly ar = computed(() => this.lang.language() === 'ar');
  /** Alias so the template reads `d()!.x` instead of repeating `data()`. */
  readonly d = this.data;

  /** True while a business failure can still be logged as HTTP 200. */
  readonly lowerBound = computed(() => !!this.data()?.errorRateIsALowerBound);

  /**
   * The server explains its own silence, in its own language. Empty string
   * means there is a report to draw.
   */
  readonly unavailableMsg = computed(() => {
    const d = this.data();
    if (!d) return '';
    const ar = (d.unavailableReasonAr ?? '').trim();
    const en = (d.unavailableReasonEn ?? '').trim();
    return this.ar() ? (ar || en) : (en || ar);
  });

  /**
   * Endpoint rows with the two figures the table is really about: the bar,
   * scaled to the heaviest endpoint, and each row's share of the time the
   * LISTED endpoints consumed — not of all traffic, which the top-N cannot see.
   */
  readonly endpointRows = computed(() => {
    const list = this.data()?.endpoints ?? [];
    const max = list.reduce((m, e) => Math.max(m, e.totalMs), 0) || 1;
    const sum = list.reduce((s, e) => s + e.totalMs, 0);
    return list.map((e, i) => ({
      e,
      rank: i + 1,
      barPct: Math.max(2, (e.totalMs / max) * 100),
      sharePct: sum > 0 ? (e.totalMs / sum) * 100 : 0,
    }));
  });

  /** All 24 hours, including the silent ones — a gap in the day is information. */
  readonly hours = computed(() => {
    const byHour = this.data()?.byHour ?? [];
    const calls = new Array<number>(24).fill(0);
    const avg = new Array<number>(24).fill(0);
    for (const h of byHour) {
      if (h.hour >= 0 && h.hour < 24) { calls[h.hour] = h.calls; avg[h.hour] = h.avgMs; }
    }
    const max = calls.reduce((m, c) => Math.max(m, c), 0);
    return calls.map((c, hour) => ({
      hour,
      calls: c,
      avgMs: avg[hour],
      pct: max > 0 && c > 0 ? Math.max(3, (c / max) * 100) : 0,
      isPeak: max > 0 && c === max,
    }));
  });

  /** The busiest hour — the first one holding the maximum, or null on a silent day. */
  readonly peak = computed(() => this.hours().find((h) => h.isPeak && h.calls > 0) ?? null);

  constructor() {
    effect(() => {
      const ok = this.filter.canFetch();
      // Read every input the request is built from, so any of them refetches.
      this.filter.branchId(); this.filter.fromDate(); this.filter.toDate();
      this.top(); this.appliedPath();
      if (ok) this.load();
      else { this.data.set(null); this.error.set(''); }
    });
  }

  load(): void {
    if (!this.filter.canFetch()) return;
    this.loading.set(true);
    this.error.set('');
    this.api.apiTraffic({
      fromDate: this.filter.fromDate(),
      toDate: this.filter.toDate(),
      branchId: this.filter.branchId(),
      path: this.appliedPath() || null,
      top: this.top(),
    }).pipe(
      catchError((e) => { this.error.set(e?.message || 'Failed to load API traffic.'); return of(null); }),
      finalize(() => this.loading.set(false)),
    ).subscribe((res) => { if (res) this.data.set(res); });
  }

  applyPath(): void {
    const next = this.pathDraft().trim();
    if (next !== this.appliedPath()) this.appliedPath.set(next);
  }

  // ── Formatting ───────────────────────────────────────────────────
  num(n: number | null | undefined): string {
    return n == null || !isFinite(n) ? '—' : n.toLocaleString('en-US');
  }

  /** Milliseconds, in seconds once they stop being readable as milliseconds. */
  dur(ms: number | null | undefined): string {
    if (ms == null || !isFinite(ms)) return '—';
    if (ms < 1000) return `${Math.round(ms)} ms`;
    const s = ms / 1000;
    if (s < 10) return `${s.toFixed(2)} s`;
    if (s < 100) return `${s.toFixed(1)} s`;
    return `${Math.round(s).toLocaleString('en-US')} s`;
  }

  share(pct: number): string {
    if (!isFinite(pct)) return '—';
    return `${pct >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10}%`;
  }

  hourLabel(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00`;
  }

  hourTitle(hour: number, calls: number, avgMs: number): string {
    const head = `${this.hourLabel(hour)} — ${this.num(calls)} ${this.ar() ? 'طلب' : 'calls'}`;
    return calls ? `${head} · ${this.ar() ? 'متوسط' : 'avg'} ${this.dur(avgMs)}` : head;
  }

  /** Slow enough to notice, slow enough to have been felt at the till. */
  durTone(ms: number): string {
    if (ms >= 3000) return 'text-critical';
    if (ms >= 1000) return 'text-high';
    return 'text-slate-700 dark:text-slate-200';
  }

  errHeader(): string {
    const base = this.ar() ? 'نسبة الأخطاء' : 'Error rate';
    if (!this.lowerBound()) return base;
    return this.ar() ? `${base} (حد أدنى)` : `${base} (min)`;
  }

  errCountHeader(): string {
    const base = this.ar() ? 'أخطاء' : 'Errors';
    if (!this.lowerBound()) return base;
    return this.ar() ? `${base} (حد أدنى)` : `${base} (min)`;
  }
}
