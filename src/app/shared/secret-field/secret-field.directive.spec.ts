import { applySecret, isRevealed, toggleSecret } from './secret-field.directive';

describe('applySecret (browser must not save a password or PIN)', () => {
  function field(): HTMLInputElement {
    const el = document.createElement('input');
    el.type = 'text';
    el.name = 'password';
    return el;
  }

  it('with the CSS mask: a text field, never a password field, with autocomplete off', () => {
    const el = field();
    applySecret(el, false, true);
    expect(el.type).toBe('text');
    expect(el.getAttribute('autocomplete')).toBe('off');
    expect(el.name).not.toContain('password');
    expect(el.getAttribute('autocorrect')).toBe('off');
    expect(el.getAttribute('autocapitalize')).toBe('off');
    expect(el.spellcheck).toBe(false);
    expect(el.getAttribute('data-lpignore')).toBe('true');
  });

  it('show/hide with the mask never turns the field into a password field', () => {
    const el = field();
    applySecret(el, false, true);
    expect(isRevealed(el)).toBe(false);
    expect(toggleSecret(el)).toBe(true);
    expect(el.type).toBe('text');
    expect(isRevealed(el)).toBe(true);
    expect(toggleSecret(el)).toBe(false);
    expect(el.type).toBe('text');
    expect(isRevealed(el)).toBe(false);
  });

  it('without the mask: a real password field that asks not to be filled', () => {
    const pwd = field();
    applySecret(pwd, false, false);
    expect(pwd.type).toBe('password');
    expect(pwd.getAttribute('autocomplete')).toBe('new-password');

    const pin = field();
    applySecret(pin, true, false);
    expect(pin.type).toBe('password');
    expect(pin.getAttribute('autocomplete')).toBe('one-time-code');
    expect(pin.getAttribute('inputmode')).toBe('numeric');
  });

  it('every field gets its own name', () => {
    const a = field();
    const b = field();
    applySecret(a, false, true);
    applySecret(b, false, true);
    expect(a.name).not.toBe(b.name);
  });
});
