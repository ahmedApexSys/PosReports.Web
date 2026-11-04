import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from '../auth/auth.service';
import { EmbedComponent } from './embed.component';
import { EMBED_AUTH } from './embed';

describe('EmbedComponent', () => {
  let adopt: jasmine.Spy;
  // Stand-ins for the till and for any other window. A MessagePort is a valid
  // message source and never this window, so no case depends on whether the
  // runner happens to frame the specs.
  const till = new MessageChannel().port1;
  const other = new MessageChannel().port1;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmbedComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
    adopt = spyOn(TestBed.inject(AuthService), 'adopt');
    spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    TestBed.createComponent(EmbedComponent).detectChanges();
  });

  /** This page is framed by `parent`; by itself means not framed at all. */
  const framedBy = (parent: MessageEventSource): void => {
    spyOnProperty(window, 'parent').and.returnValue(parent as unknown as Window);
  };

  /** A sign-in in the till's shape, from `source`, at `origin`. */
  const post = (source: MessageEventSource, origin: string): void => {
    window.dispatchEvent(new MessageEvent('message', {
      source, origin, data: { type: EMBED_AUTH, token: 'jwt', profile: { branchId: 0 } },
    }));
  };

  it('takes the sign-in from the window that frames it', () => {
    framedBy(till);
    post(till, 'https://newposui.premiumasp.net');
    expect(adopt).toHaveBeenCalledOnceWith('jwt', undefined, jasmine.objectContaining({ branchId: 0 }));
  });

  it('ignores a sign-in from any other window, though its origin is allowed', () => {
    framedBy(till);
    // An opaque-origin page - a sandboxed frame on any site - posts as "null".
    post(other, 'null');
    expect(adopt).not.toHaveBeenCalled();
  });

  it('ignores a sign-in from the window that frames it at an origin not on the list', () => {
    framedBy(till);
    post(till, 'https://evil.example');
    expect(adopt).not.toHaveBeenCalled();
  });

  it('ignores a sign-in when not framed: a popup has no till around it', () => {
    framedBy(window);
    // The popup's opener posts into it.
    post(other, 'null');
    // Unframed, its parent is itself; that must not pass for the till either.
    post(window, 'null');
    expect(adopt).not.toHaveBeenCalled();
  });

  it('may be framed by the till only: the web.config the build ships says so', async () => {
    const config = new DOMParser().parseFromString(await (await fetch('/web.config')).text(), 'text/xml');
    expect(config.documentElement.nodeName).toBe('configuration');
    const csp = config.querySelector('add[name="Content-Security-Policy"]')?.getAttribute('value') ?? '';
    const ancestors = /frame-ancestors([^;]*)/.exec(csp)?.[1].trim().split(/\s+/) ?? [];
    expect(ancestors).toContain('https://newposui.premiumasp.net');
    expect(ancestors).not.toContain('*');
  });
});
