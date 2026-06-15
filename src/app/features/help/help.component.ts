import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Building2, CalendarRange, FileText, LayoutDashboard, Activity, ChartBar, Soup, TrendingUp, Gauge, Download, ChevronDown, LifeBuoy, Mail } from 'lucide-angular';
import { LanguageService } from '../../core/i18n/language.service';

interface Step { en: string; ar: string; icon: typeof Building2; }
interface Area { en: string; ar: string; descEn: string; descAr: string; icon: typeof Building2; }
interface Faq { qEn: string; qAr: string; aEn: string; aAr: string; }

/**
 * Help — static, bilingual guidance: how to drive the reports, what each
 * sidebar area is for, FAQs (native <details> accordion), and support info.
 */
@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-3xl mx-auto space-y-8">
      <header>
        <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
          {{ ar() ? 'المساعدة' : 'Help' }}
        </h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {{ ar() ? 'دليل سريع لاستخدام تقارير أبكس.' : 'A quick guide to using Apex Reports.' }}
        </p>
      </header>

      <!-- Getting started -->
      <section class="space-y-3">
        <h2 class="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {{ ar() ? 'البداية' : 'Getting started' }}
        </h2>
        <div class="card-padded">
          <ol class="space-y-4">
            <li *ngFor="let s of steps; let i = index" class="flex items-start gap-3.5">
              <span class="inline-grid place-items-center h-7 w-7 shrink-0 rounded-full
                           bg-brand-700 text-white text-xs font-bold">{{ i + 1 }}</span>
              <div class="min-w-0 flex-1 pt-0.5">
                <div class="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                  <lucide-icon [img]="s.icon" class="h-4 w-4 text-slate-400"></lucide-icon>
                  {{ ar() ? s.ar : s.en }}
                </div>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <!-- Report areas -->
      <section class="space-y-3">
        <h2 class="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {{ ar() ? 'أقسام التقارير' : 'Report areas' }}
        </h2>
        <div class="card overflow-hidden">
          <dl class="divide-y divide-slate-100 dark:divide-slate-800">
            <div *ngFor="let a of areas" class="flex items-start gap-3.5 px-4 md:px-6 py-4">
              <div class="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                          bg-surface-muted dark:bg-surface-dark-muted text-slate-500 dark:text-slate-300">
                <lucide-icon [img]="a.icon" class="h-4 w-4"></lucide-icon>
              </div>
              <div class="min-w-0">
                <dt class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ ar() ? a.ar : a.en }}</dt>
                <dd class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{{ ar() ? a.descAr : a.descEn }}</dd>
              </div>
            </div>
          </dl>
        </div>
      </section>

      <!-- FAQ -->
      <section class="space-y-3">
        <h2 class="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {{ ar() ? 'أسئلة شائعة' : 'FAQ' }}
        </h2>
        <div class="card overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
          <details *ngFor="let f of faqs" class="group">
            <summary class="flex items-center justify-between gap-3 cursor-pointer list-none
                            px-4 md:px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100
                            hover:bg-slate-50 dark:hover:bg-surface-dark-muted/60 transition-colors">
              {{ ar() ? f.qAr : f.qEn }}
              <lucide-icon [img]="ChevronDown"
                           class="h-4 w-4 text-slate-400 transition-transform duration-200 group-open:rotate-180 shrink-0">
              </lucide-icon>
            </summary>
            <div class="px-4 md:px-6 pb-4 -mt-1 text-sm text-slate-600 dark:text-slate-300">
              {{ ar() ? f.aAr : f.aEn }}
            </div>
          </details>
        </div>
      </section>

      <!-- Support -->
      <section class="space-y-3">
        <h2 class="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {{ ar() ? 'الدعم' : 'Support' }}
        </h2>
        <div class="card-padded flex flex-col sm:flex-row sm:items-center gap-4">
          <div class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl
                      bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            <lucide-icon [img]="LifeBuoy" class="h-5.5 w-5.5"></lucide-icon>
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {{ ar() ? 'محتاج مساعدة؟' : 'Need a hand?' }}
            </div>
            <div class="text-sm text-slate-500 dark:text-slate-400">
              {{ ar() ? 'تواصل مع فريق دعم أبكس.' : 'Reach the Apex support team.' }}
            </div>
          </div>
          <a href="mailto:support@apex-systems.com" class="btn-primary shrink-0">
            <lucide-icon [img]="Mail" class="h-4 w-4"></lucide-icon>
            {{ ar() ? 'راسلنا' : 'Contact us' }}
          </a>
        </div>
        <p class="px-1 text-xs text-slate-400 dark:text-slate-500">
          {{ ar() ? 'تقارير أبكس — لوحة تقارير المالك.' : 'Apex Reports — owner reporting console.' }}
        </p>
      </section>
    </div>
  `,
})
export class HelpComponent {
  readonly lang = inject(LanguageService);
  readonly ChevronDown = ChevronDown;
  readonly LifeBuoy = LifeBuoy;
  readonly Mail = Mail;

  readonly ar = computed(() => this.lang.language() === 'ar');

  readonly steps: Step[] = [
    { en: 'Choose a branch from the header — every report needs one.', ar: 'اختر فرعاً من الأعلى — كل تقرير يحتاج فرعاً.', icon: Building2 },
    { en: 'Pick a date range (presets or custom, up to 92 days).', ar: 'حدّد الفترة الزمنية (جاهزة أو مخصصة، حتى 92 يوماً).', icon: CalendarRange },
    { en: 'Open any report from the sidebar — it loads for your branch and dates.', ar: 'افتح أي تقرير من القائمة الجانبية — يظهر حسب الفرع والفترة.', icon: FileText },
    { en: 'Export to Excel, PDF or CSV from the export menu on the report.', ar: 'صدّر إلى Excel أو PDF أو CSV من قائمة التصدير في التقرير.', icon: Download },
  ];

  readonly areas: Area[] = [
    { en: 'Dashboard', ar: 'الرئيسية', descEn: "Headline KPIs and today's performance at a glance.", descAr: 'مؤشرات سريعة وأداء اليوم في نظرة واحدة.', icon: LayoutDashboard },
    { en: 'Monitoring', ar: 'المراقبة', descEn: 'Raw action logs — who did what on each order and table, with before/after.', descAr: 'سجل الحركات الخام — مين عمل إيه على كل أوردر وطاولة، قبل وبعد.', icon: Activity },
    { en: 'Business Intelligence', ar: 'ذكاء الأعمال', descEn: 'Sales KPIs, peak hours, payment mix, staff productivity and retention.', descAr: 'مؤشرات المبيعات وساعات الذروة وطرق الدفع وإنتاجية الموظفين.', icon: ChartBar },
    { en: 'Audit', ar: 'تدقيق', descEn: 'Narrative reports — daily totals, order journeys, sessions, suspicious activity.', descAr: 'تقارير سردية — إجماليات يومية، رحلة الأوردر، الجلسات، الأنشطة المريبة.', icon: FileText },
    { en: 'Per Transaction', ar: 'حسب نوع الطلب', descEn: 'Breakdowns for Dine-in, Take-away and Delivery orders.', descAr: 'تفصيل أوردرات الصالة والتيك أواي والديليفري.', icon: Soup },
    { en: 'Owner Insights', ar: 'رؤى للمالك', descEn: 'Decision pages: growth, top customers, leakage, staff gaps — each names an action.', descAr: 'صفحات قرار: النمو، أفضل العملاء، التسرّب، فجوات الأداء — كل صفحة تقترح إجراء.', icon: TrendingUp },
    { en: 'Performance', ar: 'الأداء', descEn: 'Item insights, best/low sellers, and service speed by order and pilot.', descAr: 'تحليل الأصناف، الأعلى/الأقل مبيعاً، وسرعة الخدمة لكل أوردر وسواق.', icon: Gauge },
  ];

  readonly faqs: Faq[] = [
    {
      qEn: 'A report shows no data — why?', qAr: 'التقرير لا يعرض بيانات — لماذا؟',
      aEn: 'Make sure a branch is selected and the date range is valid (from ≤ to, and no wider than 92 days). Some reports only have data for periods where orders exist.',
      aAr: 'تأكد من اختيار فرع وأن الفترة صحيحة (البداية قبل النهاية، وألا تزيد عن 92 يوماً). بعض التقارير تعرض بيانات فقط للفترات التي بها أوردرات.',
    },
    {
      qEn: 'How do I switch language or theme?', qAr: 'كيف أغيّر اللغة أو السمة؟',
      aEn: 'Use the toggles at the bottom of the sidebar, or open Settings for the full set of appearance and default-filter preferences.',
      aAr: 'استخدم الأزرار أسفل القائمة الجانبية، أو افتح الإعدادات للتحكم الكامل في المظهر والفلاتر الافتراضية.',
    },
    {
      qEn: 'Where do my preferences get saved?', qAr: 'أين تُحفظ تفضيلاتي؟',
      aEn: 'Language, theme and default filters are stored in this browser only. Clearing browser data or using a different device resets them.',
      aAr: 'تُحفظ اللغة والسمة والفلاتر الافتراضية في هذا المتصفح فقط. مسح بيانات المتصفح أو استخدام جهاز آخر يعيدها للوضع الافتراضي.',
    },
    {
      qEn: 'Can I change my password here?', qAr: 'هل أغيّر كلمة المرور من هنا؟',
      aEn: 'No — this is a read-only reporting console. Account and password changes are done in the Apex POS desktop app.',
      aAr: 'لا — هذه لوحة تقارير للقراءة فقط. تغيير الحساب وكلمة المرور يتم من تطبيق نقاط البيع على سطح المكتب.',
    },
  ];
}
