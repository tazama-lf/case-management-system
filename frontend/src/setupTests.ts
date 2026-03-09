// setupTests.ts
import 'whatwg-fetch';

// MSW server setup (if not already done)
import { server } from './test/mocks/server';

// Prefer undici AbortController/AbortSignal implementation so that
// Request and AbortSignal come from the same runtime implementation
// (this prevents cross-implementation instance checks that trigger
// the `RequestInit: Expected signal ...` error in Node's undici).
try {
  // Use createRequire to synchronously load undici in ESM test setup
  // so the global AbortController is replaced before tests run.

  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  try {
    const undici = require('undici');
    if (undici?.AbortController) {
      (globalThis as any).AbortController = undici.AbortController;
    }
    if (undici?.AbortSignal) {
      (globalThis as any).AbortSignal = undici.AbortSignal;
    }
  } catch (e) {
    // undici might not be loadable in some environments; fall back silently
  }
} catch (e) {
  // ignore environments where `module` or import.meta.url isn't available
}

// Polyfill localStorage for MSW and test environment
class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string) {
    this.store[key] = value;
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}
globalThis.localStorage = new LocalStorageMock();
globalThis.window ??= {};
globalThis.window.location ??= {
  href: '',
  assign: () => {},
  replace: () => {},
};
// Ensure AbortController/AbortSignal and Request come from the same implementation
if (
  typeof globalThis.AbortController === 'undefined' &&
  (globalThis as any).window?.AbortController
) {
  globalThis.AbortController = (globalThis as any).window.AbortController;
}
if (typeof globalThis.AbortSignal === 'undefined') {
  // prefer the window AbortSignal (from whatwg-fetch) if available
  globalThis.AbortSignal =
    (globalThis as any).window?.AbortSignal ??
    globalThis.AbortController?.prototype?.signal?.constructor;
}
// Ensure Request constructor will accept signals from the same AbortSignal
// implementation or safely ignore incompatible signals in the test env.
const _OriginalRequest =
  (globalThis as any).Request ?? (globalThis as any).fetch?.Request;
if (_OriginalRequest) {
  const RequestWrapper: any = function (input: any, init?: any) {
    let initObj = init;
    try {
      if (initObj && 'signal' in initObj) {
        // Always drop the signal in the test environment to avoid
        // cross-implementation AbortSignal type checks (undici vs DOM).
        // This disables cancellation in tests but prevents the runtime
        // type error coming from RequestInit validation.

        const { signal, ...rest } = initObj;
        initObj = rest;
      }
    } catch (e) {
      // swallow any defensive errors here
    }
    return new _OriginalRequest(input, initObj);
  };
  RequestWrapper.prototype = _OriginalRequest.prototype;
  Object.setPrototypeOf(RequestWrapper, _OriginalRequest);
  (globalThis as any).Request = RequestWrapper;
} else {
  (globalThis as any).Request = (globalThis as any).Request;
}
beforeAll(() => {
  server.listen();
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

// Catch and ignore specific unhandled rejections that arise from
// environment differences (AbortSignal/undici and occasional window refs)
const ignoreUnhandled = (reason: any) => {
  const msg = reason?.message ?? String(reason);
  if (
    typeof msg === 'string' &&
    (msg.includes('Expected signal ("AbortSignal') ||
      msg.includes('window is not defined'))
  ) {
    return true;
  }
  return false;
};

if (typeof process !== 'undefined' && process && process.on) {
  process.on('unhandledRejection', (reason) => {
    if (ignoreUnhandled(reason)) return;
     
    console.error('Unhandled rejection in tests:', reason);
  });
  process.on('uncaughtException', (err: any) => {
    if (ignoreUnhandled(err)) return;
     
    console.error('Uncaught exception in tests:', err);
  });
}

if (typeof globalThis.addEventListener === 'function') {
  globalThis.addEventListener('unhandledrejection', (evt: any) => {
    if (ignoreUnhandled(evt.reason)) {
      evt.preventDefault();
    }
  });
}
