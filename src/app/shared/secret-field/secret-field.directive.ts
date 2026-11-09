import { Directive, ElementRef, HostListener, Input, OnInit, inject } from '@angular/core';

/**
 * Plan item 10.9: the browser must never offer to save - or fill in - a
 * password or PIN typed into this app.
 *
 * `autocomplete="off"` does not do that: Chrome ignores it on a password
 * field. What Chrome's password manager keys on is the field itself - an
 * `<input type="password">`, or one that has EVER been one in this page (so
 * the old show/hide toggle that flipped `type` counted too). This directive
 * therefore keeps the field a plain text field and masks it with CSS
 * (`-webkit-text-security: disc`): no password field, nothing to save, and
 * nothing to offer. Chrome, Edge, Safari, Samsung Internet and every Android
 * WebView support the mask.
 *
 * A browser that does not support it gets a real password field instead -
 * never a password in clear - with `autocomplete="new-password"` (or
 * `one-time-code` for a PIN), which keeps saved passwords from being offered.
 *
 * In both cases the `name` is a random token (no "password" for a heuristic
 * to recognise), mobile keyboards are told not to correct or learn the text,
 * and the common password-manager extensions are asked to ignore the field.
 *
 * The template must NOT say `type="password"`: a field that started as one
 * is remembered as one. Write `type="text"` and add `apexSecret` (or
 * `apexSecret="pin"`). Show/hide goes through {@link toggleSecret}, never by
 * changing `type`.
 */
@Directive({
  selector: 'input[apexSecret]',
  standalone: true,
  exportAs: 'apexSecret',
})
export class SecretFieldDirective implements OnInit {
  private readonly el = inject(ElementRef).nativeElement as HTMLInputElement;

  /** `'pin'` for a numeric PIN; empty for a password. */
  @Input() apexSecret: string | null | undefined = '';

  ngOnInit(): void {
    applySecret(this.el, this.apexSecret === 'pin');
  }

  /** Masked text can be copied where a password field's cannot: keep it so. */
  @HostListener('copy', ['$event'])
  @HostListener('cut', ['$event'])
  onCopy(event: Event): void {
    if (!isRevealed(this.el)) event.preventDefault();
  }

  /** Show or hide what was typed. Returns true when it is now shown. */
  toggle(): boolean {
    return toggleSecret(this.el);
  }
}

let counter = 0;

export function maskSupported(): boolean {
  try {
    return typeof CSS !== 'undefined' && !!CSS.supports?.('-webkit-text-security', 'disc');
  } catch {
    return false;
  }
}

export function applySecret(el: HTMLInputElement, pin: boolean, mask = maskSupported()): void {
  if (mask) {
    el.type = 'text';
    el.style.setProperty('-webkit-text-security', 'disc');
    el.setAttribute('autocomplete', 'off');
    el.dataset['secret'] = 'masked';
  } else {
    el.type = 'password';
    el.setAttribute('autocomplete', pin ? 'one-time-code' : 'new-password');
    el.dataset['secret'] = 'password';
  }
  el.name = `f${Date.now().toString(36)}${(counter++).toString(36)}`;
  el.setAttribute('autocapitalize', 'off');
  el.setAttribute('autocorrect', 'off');
  el.spellcheck = false;
  if (pin && !el.getAttribute('inputmode')) el.setAttribute('inputmode', 'numeric');
  // LastPass, 1Password, Bitwarden, Dashlane.
  el.setAttribute('data-lpignore', 'true');
  el.setAttribute('data-1p-ignore', 'true');
  el.setAttribute('data-bwignore', 'true');
  el.setAttribute('data-form-type', 'other');
}

export function isRevealed(el: HTMLInputElement): boolean {
  return el.dataset['secret'] === 'shown' || (el.dataset['secret'] === 'password' && el.type === 'text');
}

/** Show or hide what was typed. Returns true when it is now shown. */
export function toggleSecret(el: HTMLInputElement): boolean {
  switch (el.dataset['secret']) {
    case 'masked':
      el.style.setProperty('-webkit-text-security', 'none');
      el.dataset['secret'] = 'shown';
      return true;
    case 'shown':
      el.style.setProperty('-webkit-text-security', 'disc');
      el.dataset['secret'] = 'masked';
      return false;
    default:
      // The fallback is a real password field already; flipping it is safe.
      el.type = el.type === 'password' ? 'text' : 'password';
      return el.type === 'text';
  }
}
