import { Component, Input, inject, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Plus, Minus, ArrowRight, Pencil, Code2, ChevronDown } from 'lucide-angular';
import { LanguageService } from '../../core/i18n/language.service';
import { parseSnapshot, diffItems, summarize, ItemDiff, DiffKind } from '../../core/monitoring/snapshot-diff';

/**
 * Renders a human-readable before→after diff of two order snapshots, replacing
 * the raw-JSON dump. Shows which items were added / removed / had qty or price
 * changed, with localized names and per-line money. The raw JSON is kept behind
 * a collapsed "show raw" toggle so nothing is lost for power users.
 */
@Component({
  selector: 'app-order-snapshot-diff',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-2">
      <!-- Summary chips -->
      <div *ngIf="summary().hasChanges" class="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span *ngIf="summary().added"        class="chip chip-add">+{{ summary().added }} {{ ar() ? 'صنف' : 'added' }}</span>
        <span *ngIf="summary().removed"      class="chip chip-rem">−{{ summary().removed }} {{ ar() ? 'محذوف' : 'removed' }}</span>
        <span *ngIf="summary().qtyChanged"   class="chip chip-qty">{{ summary().qtyChanged }} {{ ar() ? 'كمية' : 'qty' }}</span>
        <span *ngIf="summary().priceChanged" class="chip chip-price">{{ summary().priceChanged }} {{ ar() ? 'سعر' : 'price' }}</span>
      </div>

      <!-- Item diff list -->
      <ul *ngIf="changed().length" class="rounded-card-sm ring-1 ring-slate-200 dark:ring-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        <li *ngFor="let d of changed()" class="flex items-center gap-2.5 px-2.5 py-1.5 text-xs"
            [ngClass]="rowBg(d.kind)">
          <span class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md" [ngClass]="badge(d.kind)">
            <lucide-icon [img]="icon(d.kind)" class="h-3 w-3"></lucide-icon>
          </span>
          <span class="min-w-0 flex-1 font-medium text-slate-800 dark:text-slate-100 truncate">{{ itemName(d) }}</span>

          <!-- qty change -->
          <span *ngIf="d.kind === 'qty'" class="tabular text-slate-500 dark:text-slate-400 shrink-0">
            {{ d.qtyBefore }} <lucide-icon [img]="Arrow" class="inline h-3 w-3"></lucide-icon> {{ d.qtyAfter }}
            <span class="text-slate-400">×</span>
          </span>
          <span *ngIf="d.kind !== 'qty'" class="tabular text-slate-500 dark:text-slate-400 shrink-0">×{{ d.kind === 'removed' ? d.qtyBefore : d.qtyAfter }}</span>

          <!-- price -->
          <span *ngIf="d.kind === 'price'" class="tabular text-slate-500 dark:text-slate-400 shrink-0">
            {{ money(d.priceBefore) }} <lucide-icon [img]="Arrow" class="inline h-3 w-3"></lucide-icon> {{ money(d.priceAfter) }}
          </span>
          <span *ngIf="d.kind !== 'price'" class="tabular text-slate-500 dark:text-slate-400 shrink-0">&#64; {{ money(d.kind === 'removed' ? d.priceBefore : d.priceAfter) }}</span>

          <!-- line total -->
          <span class="tabular font-semibold w-20 text-end shrink-0" [ngClass]="amtColor(d.kind)">
            {{ money(d.kind === 'removed' ? d.lineBefore : d.lineAfter) }}
          </span>
        </li>
      </ul>

      <!-- No item-level change (e.g. pay / checkout with same items) -->
      <p *ngIf="parsedOk() && !changed().length" class="text-[11px] text-slate-400 dark:text-slate-500">
        {{ ar() ? 'الأصناف لم تتغير في هذه الحركة.' : 'No item changes in this action.' }}
      </p>

      <!-- Raw fallback (always available, collapsed) -->
      <details class="group">
        <summary class="inline-flex items-center gap-1.5 cursor-pointer list-none text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          <lucide-icon [img]="Code" class="h-3 w-3"></lucide-icon>
          {{ ar() ? 'عرض البيانات الخام' : 'Show raw data' }}
          <lucide-icon [img]="Chevron" class="h-3 w-3 transition-transform group-open:rotate-180"></lucide-icon>
        </summary>
        <div class="grid md:grid-cols-2 gap-2 mt-2">
          <div *ngIf="beforeSnapshot">
            <div class="text-[10px] text-slate-400 mb-1">{{ ar() ? 'قبل' : 'Before' }}</div>
            <pre class="snap">{{ pretty(beforeSnapshot) }}</pre>
          </div>
          <div *ngIf="afterSnapshot">
            <div class="text-[10px] text-slate-400 mb-1">{{ ar() ? 'بعد' : 'After' }}</div>
            <pre class="snap">{{ pretty(afterSnapshot) }}</pre>
          </div>
        </div>
      </details>
    </div>
  `,
  styles: [`
    .chip { @apply inline-flex items-center gap-1 px-1.5 py-0.5 rounded-pill font-semibold; }
    .chip-add   { @apply bg-good-soft text-good; }
    .chip-rem   { @apply bg-critical-soft text-critical; }
    .chip-qty   { @apply bg-info-soft text-info; }
    .chip-price { @apply bg-warning-soft text-warning; }
    .snap { @apply text-[10px] leading-snug overflow-auto max-h-48 rounded-card-sm bg-slate-900/90 text-slate-100 p-2; }
  `],
})
export class OrderSnapshotDiffComponent {
  @Input() beforeSnapshot: string | null | undefined;
  @Input() afterSnapshot: string | null | undefined;

  readonly lang = inject(LanguageService);
  readonly Arrow = ArrowRight;
  readonly Code = Code2;
  readonly Chevron = ChevronDown;

  readonly ar = computed(() => this.lang.language() === 'ar');

  private readonly before = computed(() => parseSnapshot(this.beforeSnapshot));
  private readonly after = computed(() => parseSnapshot(this.afterSnapshot));
  readonly parsedOk = computed(() => this.before().ok || this.after().ok);

  private readonly diffs = computed(() => diffItems(this.before(), this.after()));
  readonly changed = computed(() => this.diffs().filter(d => d.kind !== 'unchanged'));
  readonly summary = computed(() => summarize(this.diffs()));

  itemName(d: ItemDiff): string {
    const n = this.ar() ? (d.nameAr || d.name) : (d.name || d.nameAr);
    if (n) return n;
    return d.itemId != null ? (this.ar() ? `صنف #${d.itemId}` : `Item #${d.itemId}`) : (this.ar() ? 'صنف' : 'Item');
  }

  icon(k: DiffKind) { return k === 'added' ? Plus : k === 'removed' ? Minus : Pencil; }

  badge(k: DiffKind): string {
    if (k === 'added') return 'bg-good-soft text-good';
    if (k === 'removed') return 'bg-critical-soft text-critical';
    if (k === 'qty') return 'bg-info-soft text-info';
    return 'bg-warning-soft text-warning';
  }
  rowBg(k: DiffKind): string {
    if (k === 'added') return 'bg-good-soft/30';
    if (k === 'removed') return 'bg-critical-soft/30';
    return '';
  }
  amtColor(k: DiffKind): string {
    if (k === 'added') return 'text-good';
    if (k === 'removed') return 'text-critical';
    return 'text-slate-700 dark:text-slate-200';
  }

  money(n: number | null | undefined): string {
    return (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  pretty(json: string | null | undefined): string {
    if (!json) return '';
    try { return JSON.stringify(JSON.parse(json), null, 2); } catch { return json; }
  }
}
