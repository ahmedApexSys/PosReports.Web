import {
  Component, Input, inject, signal, ElementRef, HostListener, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule, Download, ChevronDown, Sheet, Printer,
} from 'lucide-angular';
import { LanguageService } from '../../core/i18n/language.service';
import { ExportService, ExportColumn, ExportMeta } from '../../core/export/export.service';

/**
 * Reusable Export dropdown (Excel / PDF) used across the monitoring screens.
 * Give it the rows, a bilingual column spec, and report metadata; it delegates
 * to ExportService. Language is taken live from LanguageService.
 */
@Component({
  selector: 'app-export-menu',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative inline-block">
      <button type="button" (click)="toggle($event)" class="btn-ghost text-sm"
              [disabled]="disabled || !rows.length">
        <lucide-icon [img]="DownloadIcon" class="h-4 w-4"></lucide-icon>
        {{ ar() ? 'تصدير' : 'Export' }}
        <lucide-icon [img]="ChevronIcon" class="h-3.5 w-3.5 opacity-70"></lucide-icon>
      </button>

      <div *ngIf="open()"
           class="absolute z-30 mt-1 end-0 min-w-[190px] rounded-card-sm ring-1 ring-slate-200 dark:ring-slate-700
                  bg-white dark:bg-surface-dark-subtle shadow-xl overflow-hidden">
        <button type="button" (click)="run('excel')" class="export-item">
          <lucide-icon [img]="ExcelIcon" class="h-4 w-4 text-good"></lucide-icon>
          <span class="flex-1 text-start">{{ ar() ? 'إكسل منسّق' : 'Excel' }}</span>
          <span class="text-[10px] text-slate-400">.xls</span>
        </button>
        <button type="button" (click)="run('pdf')" class="export-item">
          <lucide-icon [img]="PdfIcon" class="h-4 w-4 text-critical"></lucide-icon>
          <span class="flex-1 text-start">{{ ar() ? 'PDF (طباعة)' : 'PDF (print)' }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .export-item {
      display:flex; align-items:center; gap:.6rem; width:100%;
      padding:.55rem .8rem; font-size:.82rem; text-align:start;
      color:#334155;
    }
    :host-context(.dark) .export-item { color:#cbd5e1; }
    .export-item:hover { background:rgba(15,118,110,.08); }
  `],
})
export class ExportMenuComponent {
  // Loosely typed (any) so any screen can pass its own row shape + matching
  // column spec without function-variance errors under strictTemplates.
  @Input({ required: true }) rows: any[] = [];
  @Input({ required: true }) columns: ExportColumn<any>[] = [];
  @Input({ required: true }) titleEn = '';
  @Input({ required: true }) titleAr = '';
  @Input() subtitleEn?: string;
  @Input() subtitleAr?: string;
  @Input() branch?: string | null;
  @Input() fromDate?: string | null;
  @Input() toDate?: string | null;
  @Input() fileBase = 'report';
  @Input() disabled = false;

  private readonly lang = inject(LanguageService);
  private readonly exp = inject(ExportService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly open = signal(false);
  readonly DownloadIcon = Download;
  readonly ChevronIcon = ChevronDown;
  readonly ExcelIcon = Sheet;
  readonly PdfIcon = Printer;

  ar(): boolean { return this.lang.language() === 'ar'; }

  toggle(ev: Event): void { ev.stopPropagation(); this.open.update(v => !v); }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(ev.target as Node)) this.open.set(false);
  }

  run(fmt: 'excel' | 'pdf'): void {
    this.open.set(false);
    if (!this.rows.length) return;
    const meta: ExportMeta = {
      titleEn: this.titleEn, titleAr: this.titleAr,
      subtitleEn: this.subtitleEn, subtitleAr: this.subtitleAr,
      branch: this.branch, fromDate: this.fromDate, toDate: this.toDate,
      lang: this.lang.language(), fileBase: this.fileBase,
    };
    if (fmt === 'excel') this.exp.excel(this.rows, this.columns, meta);
    else this.exp.pdf(this.rows, this.columns, meta);
  }
}
