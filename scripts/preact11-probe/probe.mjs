/**
 * Throwaway pattern-leg probe — RUN-01 / D-01 (deleted on green, D-02).
 *
 * Mounts the real paintVersion bump+subscribe shape from 54-PATTERNS.md on
 * preact@11.0.1 + @preact/signals@2.11.3:
 *   - compare-then-write store setter (setRotoBackgroundMetadata idiom)
 *   - Preact render-effect subscriber reading version .value in the effect body
 *     and listing that same read in the dep array (PaintOverlay requestPreview idiom)
 *
 * Assertions:
 *   1. a bump after mount runs the subscriber
 *   2. an unchanged setter call bumps the clock zero times
 *   3. after unmount/dispose a further bump does NOT re-run the subscriber
 *      (the Preact 11 deferred-cleanup risk D-01 exists to de-risk)
 *
 * Do NOT rewrite the subscriber into a cleanup-based correctness pattern (D-11).
 * Runnable with plain node:  node scripts/preact11-probe/probe.mjs
 */

// ---------------------------------------------------------------------------
// Minimal DOM shim so preact.render can run under plain node (no extra install).
// Covers the element/text/comment surface preact touches for a tiny host tree.
// ---------------------------------------------------------------------------

let nodeSeq = 0;

class ProbeNode {
  constructor(nodeType, nodeName, ownerDocument) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.childNodes = [];
    this._data = '';
  }
  get firstChild() {
    return this.childNodes[0] ?? null;
  }
  get lastChild() {
    return this.childNodes[this.childNodes.length - 1] ?? null;
  }
  get nextSibling() {
    if (!this.parentNode) return null;
    const i = this.parentNode.childNodes.indexOf(this);
    return this.parentNode.childNodes[i + 1] ?? null;
  }
  get previousSibling() {
    if (!this.parentNode) return null;
    const i = this.parentNode.childNodes.indexOf(this);
    return i > 0 ? this.parentNode.childNodes[i - 1] : null;
  }
  get textContent() {
    if (this.nodeType === 3 || this.nodeType === 8) return this._data;
    return this.childNodes.map((c) => c.textContent).join('');
  }
  set textContent(v) {
    if (this.nodeType === 3 || this.nodeType === 8) {
      this._data = String(v);
      return;
    }
    while (this.childNodes.length) this.removeChild(this.childNodes[0]);
    if (v !== '' && v != null) {
      this.appendChild(this.ownerDocument.createTextNode(String(v)));
    }
  }
  get nodeValue() {
    return this.nodeType === 3 || this.nodeType === 8 ? this._data : null;
  }
  set nodeValue(v) {
    if (this.nodeType === 3 || this.nodeType === 8) this._data = String(v);
  }
  get data() {
    return this._data;
  }
  set data(v) {
    this._data = String(v);
  }
  appendChild(child) {
    return this.insertBefore(child, null);
  }
  insertBefore(child, ref) {
    if (child.parentNode) child.parentNode.removeChild(child);
    if (ref == null) {
      this.childNodes.push(child);
    } else {
      const i = this.childNodes.indexOf(ref);
      if (i < 0) throw new Error('insertBefore: ref is not a child');
      this.childNodes.splice(i, 0, child);
    }
    child.parentNode = this;
    return child;
  }
  removeChild(child) {
    const i = this.childNodes.indexOf(child);
    if (i < 0) throw new Error('removeChild: not a child');
    this.childNodes.splice(i, 1);
    child.parentNode = null;
    return child;
  }
  replaceChild(next, old) {
    this.insertBefore(next, old);
    this.removeChild(old);
    return old;
  }
  contains(other) {
    for (let n = other; n; n = n.parentNode) if (n === this) return true;
    return false;
  }
  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }
  moveBefore(node, ref) {
    return this.insertBefore(node, ref);
  }
  cloneNode() {
    return this.ownerDocument.createTextNode(this._data);
  }
}

class ProbeElement extends ProbeNode {
  constructor(tagName, namespaceURI, ownerDocument) {
    super(1, String(tagName).toUpperCase(), ownerDocument);
    this.tagName = String(tagName).toUpperCase();
    this.localName = String(tagName);
    this.namespaceURI = namespaceURI ?? 'http://www.w3.org/1999/xhtml';
    this.attributes = new Map();
    this.style = new Proxy(
      {},
      {
        set(t, k, v) {
          t[k] = v;
          return true;
        },
        get(t, k) {
          return t[k] ?? '';
        },
      },
    );
    this._listeners = new Map();
    this._nsAttributes = new Map();
  }
  setAttribute(name, value) {
    this.attributes.set(String(name), String(value));
    if (String(name) === 'class') this.className = String(value);
  }
  setAttributeNS(_ns, name, value) {
    this._nsAttributes.set(String(name), String(value));
    this.setAttribute(name, value);
  }
  getAttribute(name) {
    return this.attributes.has(String(name)) ? this.attributes.get(String(name)) : null;
  }
  removeAttribute(name) {
    this.attributes.delete(String(name));
    this._nsAttributes.delete(String(name));
  }
  addEventListener(type, handler) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) {
    this._listeners.get(type)?.delete(handler);
  }
  cloneNode() {
    return this.ownerDocument.createElement(this.localName);
  }
  get innerHTML() {
    return '';
  }
  set innerHTML(_v) {
    while (this.childNodes.length) this.removeChild(this.childNodes[0]);
  }
}

class ProbeDocument extends ProbeNode {
  constructor() {
    super(9, '#document', null);
    this.ownerDocument = this;
    this.documentElement = null;
    this.body = null;
    this.head = null;
  }
  createElement(tagName) {
    return new ProbeElement(tagName, 'http://www.w3.org/1999/xhtml', this);
  }
  createElementNS(ns, tagName) {
    return new ProbeElement(tagName, ns, this);
  }
  createTextNode(data) {
    const n = new ProbeNode(3, '#text', this);
    n._data = String(data);
    return n;
  }
  createComment(data) {
    const n = new ProbeNode(8, '#comment', this);
    n._data = String(data);
    return n;
  }
  createDocumentFragment() {
    const n = new ProbeNode(11, '#document-fragment', this);
    return n;
  }
}

const probeDocument = new ProbeDocument();
const probeHtml = probeDocument.createElement('html');
const probeBody = probeDocument.createElement('body');
const probeHead = probeDocument.createElement('head');
probeHtml.appendChild(probeHead);
probeHtml.appendChild(probeBody);
probeDocument.appendChild(probeHtml);
probeDocument.documentElement = probeHtml;
probeDocument.body = probeBody;
probeDocument.head = probeHead;

globalThis.document = probeDocument;
globalThis.window = globalThis;
if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = { userAgent: 'probe' };
}
globalThis.HTMLElement = ProbeElement;
globalThis.Element = ProbeElement;
globalThis.Node = ProbeNode;
globalThis.Text = ProbeNode;
globalThis.Comment = ProbeNode;
globalThis.DocumentFragment = ProbeNode;
if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}

// ---------------------------------------------------------------------------
// Imports (after globals so preact sees the shimmed document at first render)
// ---------------------------------------------------------------------------

const preact = await import('preact');
const hooks = await import('preact/hooks');
const testUtils = await import('preact/test-utils');
const { signal } = await import('@preact/signals');

const { render, createElement: h } = preact;
const { useEffect } = hooks;
const { act } = testUtils;

// ---------------------------------------------------------------------------
// Store shape — compare-then-write setter + version clock (setRotoBackgroundMetadata idiom)
// ---------------------------------------------------------------------------

const paintVersion = signal(0);
/** Mirrors the metadata slot the real setter guards on. */
let current = { loop: false, fps: 12 };

/**
 * Compare-then-write store setter.
 * Called 1000x with the same value must bump 0 times (efx-preact-reactivity rule 3).
 */
function setRotoPlaybackSettings(next) {
  if (current.loop === next.loop && current.fps === next.fps) {
    return false;
  }
  current = { loop: next.loop, fps: next.fps };
  paintVersion.value++;
  return true;
}

// ---------------------------------------------------------------------------
// Subscriber — PaintOverlay.tsx requestPreview idiom (D-11: NOT cleanup-based)
// ---------------------------------------------------------------------------

let subscriberRuns = 0;

function PatternSubscriber() {
  useEffect(() => {
    // Subscribe to changes by reading .value in the effect body…
    const _v = paintVersion.value;
    // …and the same read is listed in the dep array below (PaintOverlay idiom).
    subscriberRuns += 1;
    void _v;
    // No cleanup unsubscribe on purpose (D-11) — teardown must come from
    // Preact 11 + signals dispose, not from a hand-rolled cleanup.
  }, [paintVersion.value]);
  return h('div', { id: 'probe-subscriber' }, `v=${paintVersion.value}`);
}

// ---------------------------------------------------------------------------
// Pattern-leg assertions
// ---------------------------------------------------------------------------

function fail(message) {
  console.error(`PROBE_FAIL: ${message}`);
  process.exit(1);
}

function assert(cond, message) {
  if (!cond) fail(message);
}

const host = document.createElement('div');
document.body.appendChild(host);

let baseline = 0;

// --- mount ---
await act(() => {
  render(h(PatternSubscriber, null), host);
});
baseline = subscriberRuns;
assert(baseline >= 1, `subscriber should run at least once on mount (got ${baseline})`);
console.log(`mount-runs=${baseline}`);

// --- assertion 1: a bump after mount runs the subscriber ---
const runsBeforeBump = subscriberRuns;
const clockBeforeBump = paintVersion.value;
let changed = false;
await act(() => {
  changed = setRotoPlaybackSettings({ loop: true, fps: 12 });
});
assert(changed === true, 'changed setter call must return true');
assert(
  paintVersion.value === clockBeforeBump + 1,
  `changed setter must bump the clock once (before=${clockBeforeBump} after=${paintVersion.value})`,
);
assert(
  subscriberRuns > runsBeforeBump,
  `bump after mount must re-run the subscriber (before=${runsBeforeBump} after=${subscriberRuns})`,
);
console.log(`bump-clean runs=${subscriberRuns} clock=${paintVersion.value}`);

// --- assertion 2: unchanged setter call bumps the clock zero times ---
const clockBeforeNoop = paintVersion.value;
const runsBeforeNoop = subscriberRuns;
await act(() => {
  for (let i = 0; i < 1000; i++) {
    const wrote = setRotoPlaybackSettings({ loop: true, fps: 12 });
    if (wrote) fail(`unchanged setter call ${i} returned true (must be false)`);
  }
});
assert(
  paintVersion.value === clockBeforeNoop,
  `1000 unchanged setter calls must bump the clock zero times (before=${clockBeforeNoop} after=${paintVersion.value})`,
);
assert(
  subscriberRuns === runsBeforeNoop,
  `unchanged setter calls must not re-run the subscriber (before=${runsBeforeNoop} after=${subscriberRuns})`,
);
console.log(`idempotent-clean clock=${paintVersion.value} runs=${subscriberRuns}`);

// --- assertion 3: after unmount a further bump does NOT re-run the subscriber ---
await act(() => {
  render(null, host);
});
const runsAfterUnmount = subscriberRuns;
const clockAfterUnmount = paintVersion.value;
assert(clockAfterUnmount > 0, 'clock should be > 0 before dispose-then-bump');

// Dispose-then-bump: the deferred-cleanup risk D-01 de-risks.
let bumped = false;
await act(() => {
  bumped = setRotoPlaybackSettings({ loop: true, fps: 24 });
});
assert(bumped === true, 'post-unmount changed setter must return true');
assert(
  paintVersion.value === clockAfterUnmount + 1,
  `post-unmount setter must bump the clock (before=${clockAfterUnmount} after=${paintVersion.value})`,
);
assert(
  subscriberRuns === runsAfterUnmount,
  `post-unmount bump must NOT re-run the subscriber (before=${runsAfterUnmount} after=${subscriberRuns})`,
);
console.log(`teardown-clean runs=${subscriberRuns} clock=${paintVersion.value}`);

console.log('PROBE_PASS pattern-leg preact@11.0.1 + @preact/signals@2.11.3');
process.exit(0);
