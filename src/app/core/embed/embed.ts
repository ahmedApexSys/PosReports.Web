/**
 * Inside the till (owner, 2026-11-03): the till's Reports menu opens these
 * reports in a frame rather than keeping its own copies of them. While framed,
 * the shell drops its own sidebar and account menu - the till has both.
 */
export const EMBEDDED: boolean = (() => {
  try {
    return window.self !== window.top;
  } catch {
    // A cross-origin parent throws on window.top access in some browsers -
    // which itself means we are framed.
    return true;
  }
})();

/** The message the frame sends its parent when it is ready for a sign-in. */
export const EMBED_READY = 'apex-reports-ready';
/** The message the till answers with: { type, token, refreshToken, profile }. */
export const EMBED_AUTH = 'apex-reports-auth';
