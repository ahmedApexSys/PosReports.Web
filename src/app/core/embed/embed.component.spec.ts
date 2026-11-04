import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from '../auth/auth.service';
import { EmbedComponent } from './embed.component';
import { EMBED_AUTH } from './embed';

// Karma runs the specs inside a frame, so window.parent is a real parent here.
describe('EmbedComponent', () => {
  let adopt: jasmine.Spy;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmbedComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
    adopt = spyOn(TestBed.inject(AuthService), 'adopt');
    spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    TestBed.createComponent(EmbedComponent).detectChanges();
  });

  /** A sign-in in the till's shape, from `source`, at `origin`. */
  const post = (source: MessageEventSource, origin: string): void => {
    window.dispatchEvent(new MessageEvent('message', {
      source, origin, data: { type: EMBED_AUTH, token: 'jwt', profile: { branchId: 0 } },
    }));
  };

  it('takes the sign-in from the window that frames it', () => {
    post(window.parent, 'https://newposui.premiumasp.net');
    expect(adopt).toHaveBeenCalledOnceWith('jwt', undefined, { branchId: 0 } as any);
  });

  it('ignores a sign-in from any other window, though its origin is allowed', () => {
    // An opaque-origin page - a sandboxed frame on any site - posts as "null".
    post(window, 'null');
    expect(adopt).not.toHaveBeenCalled();
  });

  it('ignores a sign-in when not framed: a popup has no till around it', () => {
    spyOnProperty(window, 'parent').and.returnValue(window);
    post(window, 'null');
    expect(adopt).not.toHaveBeenCalled();
  });
});
