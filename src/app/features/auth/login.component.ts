import { Component, HostListener, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import {
  LucideAngularModule,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader,
  Sun,
  Moon,
  MonitorCog,
  LockKeyhole,
  Trash2,
  Check,
  Utensils,
  Coffee,
  Store,
  Bike,
} from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ThemeService } from '../../core/theme/theme.service';
import { SecretFieldDirective, toggleSecret } from '../../shared/secret-field/secret-field.directive';
import { ClearCacheButtonComponent } from '../../shared/clear-cache/clear-cache-button.component';

type LucideIcon = typeof Sun;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, SecretFieldDirective, ClearCacheButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly lang = inject(LanguageService);
  readonly theme = inject(ThemeService);

  readonly password = signal('');
  /** Default to Password mode (not PIN). */
  readonly isPIN = signal(false);
  readonly showPassword = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly isAr = computed(() => this.lang.language() === 'ar');
  readonly pinDots = computed(() => Array.from({ length: this.password().length }));

  readonly ShieldIcon = ShieldCheck;
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;
  readonly Loader = Loader;
  readonly LockKeyhole = LockKeyhole;
  readonly Trash2 = Trash2;
  readonly Check = Check;
  /** Show/hide never flips `type` (SecretFieldDirective). */
  readonly toggleSecret = toggleSecret;

  readonly bizTypes = [
    {
      icon: Utensils,
      color: '#E1342B',
      titleEn: 'Restaurants',
      titleAr: 'مطاعم',
      subtitleEn: 'Dine in, takeaway, delivery',
      subtitleAr: 'صالة، تيك أواي، وتوصيل',
    },
    {
      icon: Coffee,
      color: '#B5762B',
      titleEn: 'Cafes',
      titleAr: 'كافيهات',
      subtitleEn: 'Fast counter service',
      subtitleAr: 'خدمة سريعة على الكاونتر',
    },
    {
      icon: Store,
      color: '#7A5AF8',
      titleEn: 'Retail',
      titleAr: 'محلات تجزئة',
      subtitleEn: 'Barcode and quick sale',
      subtitleAr: 'باركود وبيع في ثواني',
    },
    {
      icon: Bike,
      color: '#1F8A5B',
      titleEn: 'Cloud kitchens',
      titleAr: 'مطابخ سحابية',
      subtitleEn: 'Online apps in one queue',
      subtitleAr: 'كل طلبات التطبيقات في مكان واحد',
    },
  ];

  themeIcon(): LucideIcon {
    const m = this.theme.mode();
    if (m === 'light') return Sun;
    if (m === 'dark') return Moon;
    return MonitorCog;
  }

  themeLabel(): string {
    const m = this.theme.mode();
    const ar = m === 'light' ? 'فاتح' : m === 'dark' ? 'داكن' : 'تلقائي';
    const en = m === 'light' ? 'Light' : m === 'dark' ? 'Dark' : 'System';
    return this.isAr() ? ar : en;
  }

  setMode(pin: boolean): void {
    if (this.isPIN() === pin) return;
    this.isPIN.set(pin);
    this.password.set('');
    this.showPassword.set(false);
    this.error.set('');
  }

  onPasswordChange(value: string): void {
    this.password.set(value);
    if (this.error()) this.error.set('');
  }

  addDigit(n: number): void {
    if (this.loading()) return;
    this.password.update(v => v + String(n));
    if (this.error()) this.error.set('');
  }

  deleteDigit(): void {
    if (this.loading()) return;
    this.password.update(v => v.slice(0, -1));
    if (this.error()) this.error.set('');
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(event: KeyboardEvent): void {
    if (!this.isPIN() || this.loading()) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      this.addDigit(Number(event.key));
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      this.deleteDigit();
    } else if (event.key === 'Enter' && this.password().length > 0) {
      event.preventDefault();
      this.submit();
    }
  }

  submit(): void {
    const secret = this.password();
    const pin = this.isPIN();
    if (!secret) {
      this.error.set(this.isAr()
        ? (pin ? 'اكتب الـ PIN.' : 'اكتب كلمة المرور.')
        : (pin ? 'Enter your PIN.' : 'Enter your password.'));
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const machineId = this.resolveMachineId();
    this.auth.login({
      password: secret,
      isDesktop: true,
      isPIN: pin,
      machineId,
    }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.ok) {
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
          this.router.navigateByUrl(returnUrl);
        } else {
          this.error.set(res.message || (this.isAr() ? 'فشل تسجيل الدخول.' : 'Login failed.'));
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set(this.isAr() ? 'مشكلة في الاتصال.' : 'Connection error.');
      },
    });
  }

  private resolveMachineId(): string {
    try {
      const key = 'pos-reports.machineId';
      let id = localStorage.getItem(key);
      if (!id) {
        id = `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem(key, id);
      }
      return id;
    } catch {
      return 'web-anon';
    }
  }
}
