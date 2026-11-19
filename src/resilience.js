// Keeps sign-in calls from hanging when many people connect at once or the network is slow:
// 20 second timeout, then up to 2 retries with growing, randomised waits (so phones do not retry together).
const AUTH = /^https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\//;
const nativeFetch = window.fetch;
if (nativeFetch) {
  window.fetch = function (input, init) {
    if (typeof input !== "string" || !AUTH.test(input)) return nativeFetch.apply(this, arguments);
    let tries = 0;
    const once = () => {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 20000);
      const opts = { ...(init || {}) };
      if (!opts.signal) opts.signal = ac.signal;
      return nativeFetch.call(window, input, opts).then(
        (r) => { clearTimeout(timer); return (r.status >= 500 || r.status === 429) && tries < 2 ? retry() : r; },
        (e) => { clearTimeout(timer); if (tries < 2 && navigator.onLine !== false) return retry(); throw e; },
      );
    };
    const retry = () => { tries++; const wait = Math.min(8000, 500 * 2 ** tries) * (0.5 + Math.random()); return new Promise((r) => setTimeout(r, wait)).then(once); };
    return once();
  };
}
