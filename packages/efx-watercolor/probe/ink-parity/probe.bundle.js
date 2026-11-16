"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all3) => {
    for (var name in all3)
      __defProp(target, name, { get: all3[name], enumerable: true });
  };

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Pipeable.js
  var pipeArguments = (self, args2) => {
    switch (args2.length) {
      case 0:
        return self;
      case 1:
        return args2[0](self);
      case 2:
        return args2[1](args2[0](self));
      case 3:
        return args2[2](args2[1](args2[0](self)));
      case 4:
        return args2[3](args2[2](args2[1](args2[0](self))));
      case 5:
        return args2[4](args2[3](args2[2](args2[1](args2[0](self)))));
      case 6:
        return args2[5](args2[4](args2[3](args2[2](args2[1](args2[0](self))))));
      case 7:
        return args2[6](args2[5](args2[4](args2[3](args2[2](args2[1](args2[0](self)))))));
      case 8:
        return args2[7](args2[6](args2[5](args2[4](args2[3](args2[2](args2[1](args2[0](self))))))));
      case 9:
        return args2[8](args2[7](args2[6](args2[5](args2[4](args2[3](args2[2](args2[1](args2[0](self)))))))));
      default: {
        let ret = self;
        for (let i = 0, len = args2.length; i < len; i++) {
          ret = args2[i](ret);
        }
        return ret;
      }
    }
  };

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Function.js
  var dual = function(arity, body) {
    if (typeof arity === "function") {
      return function() {
        return arity(arguments) ? body.apply(this, arguments) : (self) => body(self, ...arguments);
      };
    }
    switch (arity) {
      case 0:
      case 1:
        throw new RangeError(`Invalid arity ${arity}`);
      case 2:
        return function(a, b) {
          if (arguments.length >= 2) {
            return body(a, b);
          }
          return function(self) {
            return body(self, a);
          };
        };
      case 3:
        return function(a, b, c) {
          if (arguments.length >= 3) {
            return body(a, b, c);
          }
          return function(self) {
            return body(self, a, b);
          };
        };
      default:
        return function() {
          if (arguments.length >= arity) {
            return body.apply(this, arguments);
          }
          const args2 = arguments;
          return function(self) {
            return body(self, ...args2);
          };
        };
    }
  };
  var identity = (a) => a;
  var constant = (value) => () => value;
  var constTrue = /* @__PURE__ */ constant(true);
  var constFalse = /* @__PURE__ */ constant(false);
  var constUndefined = /* @__PURE__ */ constant(void 0);
  var constVoid = constUndefined;

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/internal/equal.js
  var getAllObjectKeys = (obj) => {
    const keys = new Set(Reflect.ownKeys(obj));
    if (obj.constructor === Object) return keys;
    if (obj instanceof Error) {
      keys.delete("stack");
    }
    const proto = Object.getPrototypeOf(obj);
    let current = proto;
    while (current !== null && current !== Object.prototype) {
      const ownKeys = Reflect.ownKeys(current);
      for (let i = 0; i < ownKeys.length; i++) {
        keys.add(ownKeys[i]);
      }
      current = Object.getPrototypeOf(current);
    }
    if (keys.has("constructor") && typeof obj.constructor === "function" && proto === obj.constructor.prototype) {
      keys.delete("constructor");
    }
    return keys;
  };
  var byReferenceInstances = /* @__PURE__ */ new WeakSet();

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Predicate.js
  function isString(input) {
    return typeof input === "string";
  }
  function isNumber(input) {
    return typeof input === "number";
  }
  function isFunction(input) {
    return typeof input === "function";
  }
  function isUndefined(input) {
    return input === void 0;
  }
  function isNotUndefined(input) {
    return input !== void 0;
  }
  function isObjectKeyword(input) {
    return typeof input === "object" && input !== null || isFunction(input);
  }
  var hasProperty = /* @__PURE__ */ dual(2, (self, property) => isObjectKeyword(self) && property in self);
  var isTagged = /* @__PURE__ */ dual(2, (self, tag) => hasProperty(self, "_tag") && self["_tag"] === tag);
  function isIterable(input) {
    return hasProperty(input, Symbol.iterator) || isString(input);
  }

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Hash.js
  var symbol = "~effect/Hash";
  var hash = (self) => {
    switch (typeof self) {
      case "number":
        return number(self);
      case "bigint":
        return string(self.toString(10));
      case "string":
        return string(self);
      case "undefined":
        return string("undefined");
      case "function":
      case "object": {
        if (self === null) {
          return string("null");
        } else if (self instanceof Date) {
          if (Number.isNaN(self.getTime())) {
            return string("Invalid Date");
          }
          return string(self.toISOString());
        } else if (self instanceof RegExp) {
          return string(self.toString());
        } else {
          if (byReferenceInstances.has(self)) {
            return random(self);
          }
          if (hashCache.has(self)) {
            return hashCache.get(self);
          }
          const h = withVisitedTracking(self, () => {
            if (isHash(self)) {
              return self[symbol]();
            } else if (typeof self === "function") {
              return random(self);
            } else if (self instanceof DataView) {
              return array(new Uint8Array(self.buffer, self.byteOffset, self.byteLength));
            } else if (Array.isArray(self) || ArrayBuffer.isView(self)) {
              return array(self);
            } else if (self instanceof Map) {
              return hashMap(self);
            } else if (self instanceof Set) {
              return hashSet(self);
            }
            return structure(self);
          });
          hashCache.set(self, h);
          return h;
        }
      }
      default:
        return string(String(self));
    }
  };
  var random = (self) => {
    if (!randomHashCache.has(self)) {
      randomHashCache.set(self, number(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)));
    }
    return randomHashCache.get(self);
  };
  var combine = /* @__PURE__ */ dual(2, (self, b) => self * 53 ^ b);
  var optimize = (n) => n & 3221225471 | n >>> 1 & 1073741824;
  var isHash = (u) => hasProperty(u, symbol);
  var number = (n) => {
    if (n !== n || n === Infinity || n === -Infinity) {
      return string(String(n));
    }
    let h = n | 0;
    if (h !== n) {
      h ^= n * 4294967295;
    }
    while (n > 4294967295) {
      h ^= n /= 4294967295;
    }
    return optimize(h);
  };
  var string = (str) => {
    let h = 5381, i = str.length;
    while (i) {
      h = h * 33 ^ str.charCodeAt(--i);
    }
    return optimize(h);
  };
  var structureKeys = (o, keys) => {
    let h = 12289;
    for (const key of keys) {
      h ^= combine(hash(key), hash(o[key]));
    }
    return optimize(h);
  };
  var structure = (o) => structureKeys(o, getAllObjectKeys(o));
  var iterableWith = (seed, f) => (iter) => {
    let h = seed;
    for (const element of iter) {
      h ^= f(element);
    }
    return optimize(h);
  };
  var array = /* @__PURE__ */ iterableWith(6151, hash);
  var hashMap = /* @__PURE__ */ iterableWith(/* @__PURE__ */ string("Map"), ([k, v]) => combine(hash(k), hash(v)));
  var hashSet = /* @__PURE__ */ iterableWith(/* @__PURE__ */ string("Set"), hash);
  var randomHashCache = /* @__PURE__ */ new WeakMap();
  var hashCache = /* @__PURE__ */ new WeakMap();
  var visitedObjects = /* @__PURE__ */ new WeakSet();
  function withVisitedTracking(obj, fn3) {
    if (visitedObjects.has(obj)) {
      return string("[Circular]");
    }
    visitedObjects.add(obj);
    const result3 = fn3();
    visitedObjects.delete(obj);
    return result3;
  }

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Equal.js
  var symbol2 = "~effect/Equal";
  function equals() {
    if (arguments.length === 1) {
      return (self) => compareBoth(self, arguments[0]);
    }
    return compareBoth(arguments[0], arguments[1]);
  }
  function compareBoth(self, that) {
    if (self === that) return true;
    if (self == null || that == null) return false;
    const selfType = typeof self;
    if (selfType !== typeof that) {
      return false;
    }
    if (selfType === "number" && self !== self && that !== that) {
      return true;
    }
    if (selfType !== "object" && selfType !== "function") {
      return false;
    }
    if (byReferenceInstances.has(self) || byReferenceInstances.has(that)) {
      return false;
    }
    return withCache(self, that, compareObjects);
  }
  function withVisitedTracking2(self, that, fn3) {
    const hasLeft = visitedLeft.has(self);
    const hasRight = visitedRight.has(that);
    if (hasLeft && hasRight) {
      return true;
    }
    if (hasLeft || hasRight) {
      return false;
    }
    visitedLeft.add(self);
    visitedRight.add(that);
    const result3 = fn3();
    visitedLeft.delete(self);
    visitedRight.delete(that);
    return result3;
  }
  var visitedLeft = /* @__PURE__ */ new WeakSet();
  var visitedRight = /* @__PURE__ */ new WeakSet();
  function compareObjects(self, that) {
    if (hash(self) !== hash(that)) {
      return false;
    } else if (self instanceof Date) {
      if (!(that instanceof Date)) return false;
      const selfTime = self.getTime();
      const thatTime = that.getTime();
      return selfTime === thatTime || Number.isNaN(selfTime) && Number.isNaN(thatTime);
    } else if (self instanceof RegExp) {
      if (!(that instanceof RegExp)) return false;
      return self.toString() === that.toString();
    }
    const selfIsEqual = isEqual(self);
    const thatIsEqual = isEqual(that);
    if (selfIsEqual !== thatIsEqual) return false;
    const bothEquals = selfIsEqual && thatIsEqual;
    if (typeof self === "function" && !bothEquals) {
      return false;
    }
    return withVisitedTracking2(self, that, () => {
      if (bothEquals) {
        return self[symbol2](that);
      } else if (Array.isArray(self)) {
        if (!Array.isArray(that) || self.length !== that.length) {
          return false;
        }
        return compareArrays(self, that);
      } else if (ArrayBuffer.isView(self)) {
        const selfIsDataView = self instanceof DataView;
        if (!ArrayBuffer.isView(that) || self.byteLength !== that.byteLength || selfIsDataView !== that instanceof DataView) {
          return false;
        }
        if (selfIsDataView) {
          const thatDataView = that;
          return compareTypedArrays(new Uint8Array(self.buffer, self.byteOffset, self.byteLength), new Uint8Array(thatDataView.buffer, thatDataView.byteOffset, thatDataView.byteLength));
        }
        return compareTypedArrays(self, that);
      } else if (self instanceof Map) {
        if (!(that instanceof Map) || self.size !== that.size) {
          return false;
        }
        return compareMaps(self, that);
      } else if (self instanceof Set) {
        if (!(that instanceof Set) || self.size !== that.size) {
          return false;
        }
        return compareSets(self, that);
      }
      return compareRecords(self, that);
    });
  }
  function withCache(self, that, f) {
    let selfMap = equalityCache.get(self);
    if (!selfMap) {
      selfMap = /* @__PURE__ */ new WeakMap();
      equalityCache.set(self, selfMap);
    } else if (selfMap.has(that)) {
      return selfMap.get(that);
    }
    const result3 = f(self, that);
    selfMap.set(that, result3);
    let thatMap = equalityCache.get(that);
    if (!thatMap) {
      thatMap = /* @__PURE__ */ new WeakMap();
      equalityCache.set(that, thatMap);
    }
    thatMap.set(self, result3);
    return result3;
  }
  var equalityCache = /* @__PURE__ */ new WeakMap();
  function compareArrays(self, that) {
    for (let i = 0; i < self.length; i++) {
      if (!compareBoth(self[i], that[i])) {
        return false;
      }
    }
    return true;
  }
  function compareTypedArrays(self, that) {
    if (self.length !== that.length) {
      return false;
    }
    for (let i = 0; i < self.length; i++) {
      if (self[i] !== that[i]) {
        return false;
      }
    }
    return true;
  }
  function compareRecords(self, that) {
    const selfKeys = getAllObjectKeys(self);
    const thatKeys = getAllObjectKeys(that);
    if (selfKeys.size !== thatKeys.size) {
      return false;
    }
    for (const key of selfKeys) {
      if (!thatKeys.has(key) || !compareBoth(self[key], that[key])) {
        return false;
      }
    }
    return true;
  }
  function makeCompareMap(keyEquivalence, valueEquivalence) {
    return function compareMaps2(self, that) {
      const thatEntries = Array.from(that);
      for (const [selfKey, selfValue] of self) {
        let found = false;
        for (let i = 0; i < thatEntries.length; i++) {
          const [thatKey, thatValue] = thatEntries[i];
          if (keyEquivalence(selfKey, thatKey) && valueEquivalence(selfValue, thatValue)) {
            thatEntries[i] = thatEntries[thatEntries.length - 1];
            thatEntries.pop();
            found = true;
            break;
          }
        }
        if (!found) {
          return false;
        }
      }
      return true;
    };
  }
  var compareMaps = /* @__PURE__ */ makeCompareMap(compareBoth, compareBoth);
  function makeCompareSet(equivalence) {
    return function compareSets2(self, that) {
      const thatValues = Array.from(that);
      for (const selfValue of self) {
        let found = false;
        for (let i = 0; i < thatValues.length; i++) {
          const thatValue = thatValues[i];
          if (equivalence(selfValue, thatValue)) {
            thatValues[i] = thatValues[thatValues.length - 1];
            thatValues.pop();
            found = true;
            break;
          }
        }
        if (!found) {
          return false;
        }
      }
      return true;
    };
  }
  var compareSets = /* @__PURE__ */ makeCompareSet(compareBoth);
  var isEqual = (u) => hasProperty(u, symbol2);
  var byReferenceUnsafe = (obj) => {
    byReferenceInstances.add(obj);
    return obj;
  };

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/internal/array.js
  var isArrayNonEmpty = (self) => self.length > 0;

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/internal/count.js
  var normalize = (n) => n > 0 ? Math.floor(n) : 0;

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/internal/doNotation.js
  var let_ = (map3) => dual(3, (self, name, f) => map3(self, (a) => ({
    ...a,
    [name]: f(a)
  })));
  var bindTo = (map3) => dual(2, (self, name) => map3(self, (a) => ({
    [name]: a
  })));
  var bind = (map3, flatMap3) => dual(3, (self, name, f) => flatMap3(self, (a) => map3(f(a), (b) => ({
    ...a,
    [name]: b
  }))));

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/internal/record.js
  function assignProperty(self, key, value) {
    if (key === "__proto__") {
      Object.defineProperty(self, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true
      });
    } else {
      ;
      self[key] = value;
    }
  }
  function assignProperties(self, source) {
    for (const key of Reflect.ownKeys(source)) {
      if (Object.prototype.propertyIsEnumerable.call(source, key)) {
        assignProperty(self, key, source[key]);
      }
    }
  }

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Redactable.js
  var symbolRedactable = /* @__PURE__ */ Symbol.for("~effect/Redactable");
  var isRedactable = (u) => hasProperty(u, symbolRedactable);
  function redact(u) {
    if (isRedactable(u)) return getRedacted(u);
    return u;
  }
  function getRedacted(redactable) {
    return redactable[symbolRedactable](globalThis[currentFiberTypeId]?.context ?? emptyContext);
  }
  var currentFiberTypeId = "~effect/Fiber/currentFiber";
  var emptyMap = /* @__PURE__ */ new Map();
  var emptyContext = {
    "~effect/Context": {},
    base: emptyMap,
    depth: 0,
    mapUnsafe: emptyMap,
    pipe() {
      return pipeArguments(this, arguments);
    }
  };

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Formatter.js
  function format(input, options) {
    const space = options?.space ?? 0;
    const ancestors = /* @__PURE__ */ new WeakSet();
    const gap = !space ? "" : typeof space === "number" ? " ".repeat(space) : space;
    const ind = (d) => gap.repeat(d);
    const wrap = (v, body) => {
      const ctor = v?.constructor;
      return ctor && ctor !== Object.prototype.constructor && ctor.name ? `${ctor.name}(${body})` : body;
    };
    const ownKeys = (o) => {
      try {
        return Reflect.ownKeys(o);
      } catch {
        return ["[ownKeys threw]"];
      }
    };
    function recur(v, d = 0) {
      try {
        return recurUnsafe(v, d);
      } catch {
        if (typeof v === "object" && v !== null || typeof v === "function") ancestors.delete(v);
        return "[inspection threw]";
      }
    }
    function recurUnsafe(v, d = 0) {
      if (typeof v === "string") return JSON.stringify(v);
      if (typeof v === "number" || v == null || typeof v === "boolean" || typeof v === "symbol") return String(v);
      if (typeof v === "bigint") return String(v) + "n";
      if (typeof v === "object" || typeof v === "function") {
        if (ancestors.has(v)) return CIRCULAR;
        ancestors.add(v);
        let output;
        if (symbolRedactable in v) {
          output = recur(getRedacted(v), d);
        } else if (Array.isArray(v)) {
          output = !gap || v.length <= 1 ? `[${v.map((x) => recur(x, d)).join(",")}]` : `[
${ind(d + 1)}${v.map((x) => recur(x, d + 1)).join(",\n" + ind(d + 1))}
${ind(d)}]`;
        } else if (v instanceof Date) {
          output = formatDate(v);
        } else if (!options?.ignoreToString && hasProperty(v, "toString") && typeof v["toString"] === "function" && v["toString"] !== Object.prototype.toString && v["toString"] !== Array.prototype.toString) {
          const s = safeToString(v);
          output = v instanceof Error && v.cause !== void 0 ? `${s} (cause: ${recur(v.cause, d)})` : s;
        } else if (Symbol.iterator in v) {
          output = `${v.constructor.name}(${recur(Array.from(v), d)})`;
        } else {
          const keys = ownKeys(v);
          if (!gap || keys.length <= 1) {
            const body = `{${keys.map((k) => `${formatPropertyKey(k)}:${recur(safeGet(v, k), d)}`).join(",")}}`;
            output = wrap(v, body);
          } else {
            const body = `{
${keys.map((k) => `${ind(d + 1)}${formatPropertyKey(k)}: ${recur(safeGet(v, k), d + 1)}`).join(",\n")}
${ind(d)}}`;
            output = wrap(v, body);
          }
        }
        ancestors.delete(v);
        return output;
      }
      return String(v);
    }
    return recur(input, 0);
  }
  var CIRCULAR = "[Circular]";
  function formatPropertyKey(name) {
    return typeof name === "string" ? JSON.stringify(name) : String(name);
  }
  function formatDate(date) {
    try {
      return date.toISOString();
    } catch {
      return "Invalid Date";
    }
  }
  function safeToString(input) {
    try {
      const s = input.toString();
      return typeof s === "string" ? s : String(s);
    } catch {
      return "[toString threw]";
    }
  }
  function safeGet(input, key) {
    try {
      return input[key];
    } catch {
      return "[property access threw]";
    }
  }
  function formatJson(input, options) {
    const ancestors = [];
    return JSON.stringify(input, function(key, value) {
      const original = Object.getOwnPropertyDescriptor(this, key)?.value;
      const redacted = hasProperty(original, symbolRedactable) ? redact(original) : redact(value);
      if (typeof redacted === "bigint") {
        return format(redacted);
      }
      if (typeof redacted !== "object" || redacted === null) {
        return redacted;
      }
      while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) {
        ancestors.pop();
      }
      if (ancestors.includes(redacted)) {
        return void 0;
      }
      ancestors.push(redacted);
      return redacted;
    }, options?.space) ?? "null";
  }

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Inspectable.js
  var NodeInspectSymbol = /* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom");
  var toJson = (input) => {
    try {
      input = redact(input);
      if (hasProperty(input, "toJSON") && isFunction(input["toJSON"]) && input["toJSON"].length === 0) {
        return input.toJSON();
      } else if (Array.isArray(input)) {
        return input.map(toJson);
      }
      return input;
    } catch {
      return "[toJSON threw]";
    }
  };
  var toStringUnknown = (u, whitespace = 2) => {
    if (typeof u === "string") {
      return u;
    }
    try {
      return typeof u === "object" ? formatJson(u, {
        space: whitespace
      }) : format(u, {
        space: whitespace
      });
    } catch {
      return String(u);
    }
  };
  var BaseProto = {
    toJSON() {
      return toJson(this);
    },
    [NodeInspectSymbol]() {
      return this.toJSON();
    },
    toString() {
      return format(this.toJSON());
    }
  };
  var Class = class {
    /**
     * Node.js custom inspection method.
     *
     * **When to use**
     *
     * Use to expose the class JSON representation to Node.js inspection.
     *
     * @since 2.0.0
     */
    [NodeInspectSymbol]() {
      return this.toJSON();
    }
    /**
     * Returns a formatted string representation of this object.
     *
     * **When to use**
     *
     * Use to format the class JSON representation as a string.
     *
     * @since 2.0.0
     */
    toString() {
      return format(this.toJSON());
    }
  };

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/internal/stackTraceLimit.js
  var isStackTraceLimitWritable = () => {
    const desc = Object.getOwnPropertyDescriptor(Error, "stackTraceLimit");
    if (desc === void 0) {
      return Object.isExtensible(Error);
    }
    return Object.hasOwn(desc, "writable") ? desc.writable === true : desc.set !== void 0;
  };
  var canWriteStackTraceLimit = /* @__PURE__ */ isStackTraceLimitWritable();
  var getStackTraceLimit = () => Error.stackTraceLimit;
  var setStackTraceLimit = (value) => {
    if (canWriteStackTraceLimit) {
      ;
      Error.stackTraceLimit = value;
    }
  };

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Utils.js
  var SingleShotGen = class _SingleShotGen {
    called = false;
    self;
    constructor(self) {
      this.self = self;
    }
    /**
     * Yields the stored value once, then completes with the value sent back in.
     *
     * **When to use**
     *
     * Use to advance a `SingleShotGen` through its single yield and completion
     * step.
     *
     * @since 2.0.0
     */
    next(a) {
      return this.called ? {
        value: a,
        done: true
      } : (this.called = true, {
        value: this.self,
        done: false
      });
    }
    /**
     * Creates a fresh single-shot iterator over the stored value.
     *
     * **When to use**
     *
     * Use to iterate the wrapped value again without reusing the consumed
     * iterator state.
     *
     * @since 2.0.0
     */
    [Symbol.iterator]() {
      return new _SingleShotGen(this.self);
    }
  };
  var pickInternalCall = () => {
    const InternalTypeId = "~effect/Utils/internal";
    const standard = {
      [InternalTypeId]: (body) => {
        return body();
      }
    };
    const forced = {
      [InternalTypeId]: (body) => {
        try {
          return body();
        } finally {
        }
      }
    };
    const isNotOptimizedAway = getStackTraceLimit() !== 0 && standard[InternalTypeId](() => new Error().stack)?.includes(InternalTypeId) === true;
    return isNotOptimizedAway ? standard[InternalTypeId] : forced[InternalTypeId];
  };
  var internalCall = /* @__PURE__ */ pickInternalCall();

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/internal/core.js
  var EffectTypeId = `~effect/Effect`;
  var ExitTypeId = `~effect/Exit`;
  var effectVariance = {
    _A: identity,
    _E: identity,
    _R: identity
  };
  var identifier = `${EffectTypeId}/identifier`;
  var args = `${EffectTypeId}/args`;
  var evaluate = `${EffectTypeId}/evaluate`;
  var contA = `${EffectTypeId}/successCont`;
  var contE = `${EffectTypeId}/failureCont`;
  var contAll = `${EffectTypeId}/ensureCont`;
  var Yield = /* @__PURE__ */ Symbol.for("effect/Effect/Yield");
  var PipeInspectableProto = {
    pipe() {
      return pipeArguments(this, arguments);
    },
    toJSON() {
      return {
        ...this
      };
    },
    toString() {
      return format(this.toJSON(), {
        ignoreToString: true,
        space: 2
      });
    },
    [NodeInspectSymbol]() {
      return this.toJSON();
    }
  };
  var StructuralProto = {
    [symbol]() {
      return structureKeys(this, Object.keys(this));
    },
    [symbol2](that) {
      const selfKeys = Object.keys(this);
      const thatKeys = Object.keys(that);
      if (selfKeys.length !== thatKeys.length) return false;
      for (let i = 0; i < selfKeys.length; i++) {
        if (selfKeys[i] !== thatKeys[i] || !equals(this[selfKeys[i]], that[selfKeys[i]])) {
          return false;
        }
      }
      return true;
    }
  };
  var EffectProto = {
    [EffectTypeId]: effectVariance,
    ...PipeInspectableProto,
    [Symbol.iterator]() {
      return new SingleShotGen(this);
    },
    toJSON() {
      return {
        _id: "Effect",
        op: this[identifier],
        ...args in this ? {
          args: this[args]
        } : void 0
      };
    }
  };
  var isEffect = (u) => hasProperty(u, EffectTypeId);
  var isExit = (u) => hasProperty(u, ExitTypeId);
  var CauseTypeId = "~effect/Cause";
  var CauseReasonTypeId = "~effect/Cause/Reason";
  var isCause = (self) => hasProperty(self, CauseTypeId);
  var CauseImpl = class {
    constructor(failures) {
      this[CauseTypeId] = CauseTypeId;
      this.reasons = failures;
    }
    pipe() {
      return pipeArguments(this, arguments);
    }
    toJSON() {
      return {
        _id: "Cause",
        failures: this.reasons.map((f) => f.toJSON())
      };
    }
    toString() {
      return `Cause(${format(this.reasons)})`;
    }
    [NodeInspectSymbol]() {
      return this.toJSON();
    }
    [symbol2](that) {
      return isCause(that) && this.reasons.length === that.reasons.length && this.reasons.every((e, i) => equals(e, that.reasons[i]));
    }
    [symbol]() {
      return array(this.reasons);
    }
  };
  var annotationsMap = /* @__PURE__ */ new WeakMap();
  var ReasonBase = class {
    [CauseReasonTypeId];
    annotations;
    _tag;
    constructor(_tag, annotations, originalError) {
      this[CauseReasonTypeId] = CauseReasonTypeId;
      this._tag = _tag;
      if (annotations !== constEmptyAnnotations && typeof originalError === "object" && originalError !== null && annotations.size > 0) {
        const prevAnnotations = annotationsMap.get(originalError);
        if (prevAnnotations) {
          annotations = new Map([...prevAnnotations, ...annotations]);
        }
        annotationsMap.set(originalError, annotations);
      }
      this.annotations = annotations;
    }
    annotate(annotations, options) {
      if (annotations.mapUnsafe.size === 0) return this;
      const newAnnotations = new Map(this.annotations);
      annotations.mapUnsafe.forEach((value, key) => {
        if (options?.overwrite !== true && newAnnotations.has(key)) return;
        newAnnotations.set(key, value);
      });
      const self = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
      self.annotations = newAnnotations;
      return self;
    }
    pipe() {
      return pipeArguments(this, arguments);
    }
    toString() {
      return format(this);
    }
    [NodeInspectSymbol]() {
      return this.toString();
    }
  };
  var constEmptyAnnotations = /* @__PURE__ */ new Map();
  var Fail = class extends ReasonBase {
    constructor(error, annotations = constEmptyAnnotations) {
      super("Fail", annotations, error);
      this.error = error;
    }
    toString() {
      return `Fail(${format(this.error)})`;
    }
    toJSON() {
      return {
        _tag: "Fail",
        error: this.error
      };
    }
    [symbol2](that) {
      return isFailReason(that) && equals(this.error, that.error) && equals(this.annotations, that.annotations);
    }
    [symbol]() {
      return combine(string(this._tag))(combine(hash(this.error))(hash(this.annotations)));
    }
  };
  var causeFromReasons = (reasons) => new CauseImpl(reasons);
  var causeEmpty = /* @__PURE__ */ new CauseImpl([]);
  var causeFail = (error) => new CauseImpl([new Fail(error)]);
  var Die = class extends ReasonBase {
    constructor(defect, annotations = constEmptyAnnotations) {
      super("Die", annotations, defect);
      this.defect = defect;
    }
    toString() {
      return `Die(${format(this.defect)})`;
    }
    toJSON() {
      return {
        _tag: "Die",
        defect: this.defect
      };
    }
    [symbol2](that) {
      return isDieReason(that) && equals(this.defect, that.defect) && equals(this.annotations, that.annotations);
    }
    [symbol]() {
      return combine(string(this._tag))(combine(hash(this.defect))(hash(this.annotations)));
    }
  };
  var causeDie = (defect) => new CauseImpl([new Die(defect)]);
  var causeAnnotate = /* @__PURE__ */ dual((args2) => isCause(args2[0]), (self, annotations, options) => {
    if (annotations.mapUnsafe.size === 0) return self;
    return new CauseImpl(self.reasons.map((f) => f.annotate(annotations, options)));
  });
  var isFailReason = (self) => self._tag === "Fail";
  var isDieReason = (self) => self._tag === "Die";
  var isInterruptReason = (self) => self._tag === "Interrupt";
  function defaultEvaluate(_fiber) {
    return exitDie(`Effect.evaluate: Not implemented`);
  }
  var makePrimitiveProto = (options) => ({
    ...EffectProto,
    [identifier]: options.op,
    [evaluate]: options[evaluate] ?? defaultEvaluate,
    [contA]: options[contA],
    [contE]: options[contE],
    [contAll]: options[contAll]
  });
  var makePrimitive = (options) => {
    const Proto3 = makePrimitiveProto(options);
    const PrimitiveImpl = function(value) {
      this[args] = value;
    };
    PrimitiveImpl.prototype = Proto3;
    return function(value) {
      return new PrimitiveImpl(value);
    };
  };
  var makeExit = (options) => {
    const Proto3 = {
      [ExitTypeId]: ExitTypeId,
      _tag: options.op,
      get [options.prop]() {
        return this[args];
      },
      ...makePrimitiveProto(options),
      toString() {
        return `${options.op}(${format(this[args])})`;
      },
      toJSON() {
        return {
          _id: "Exit",
          _tag: options.op,
          [options.prop]: this[args]
        };
      },
      [symbol2](that) {
        return isExit(that) && that._tag === this._tag && equals(this[args], that[args]);
      },
      [symbol]() {
        return combine(string(options.op), hash(this[args]));
      }
    };
    const ExitPrimitive = function(value) {
      this[args] = value;
    };
    ExitPrimitive.prototype = Proto3;
    return function(value) {
      return new ExitPrimitive(value);
    };
  };
  var exitSucceed = /* @__PURE__ */ makeExit({
    op: "Success",
    prop: "value",
    [evaluate](fiber3) {
      const cont = fiber3.getCont(contA);
      return cont ? cont[contA](this[args], fiber3, this) : fiber3.yieldWith(this);
    }
  });
  var StackTraceKey = {
    key: "effect/Cause/StackTrace"
  };
  var InterruptorStackTrace = {
    key: "effect/Cause/InterruptorStackTrace"
  };
  var exitFailCause = /* @__PURE__ */ makeExit({
    op: "Failure",
    prop: "cause",
    [evaluate](fiber3) {
      let cause = this[args];
      let annotated = false;
      if (fiber3.cache.stackFrame) {
        cause = causeAnnotate(cause, {
          mapUnsafe: /* @__PURE__ */ new Map([[StackTraceKey.key, fiber3.cache.stackFrame]])
        });
        annotated = true;
      }
      let cont = fiber3.getCont(contE);
      while (fiber3.interruptible && fiber3._interruptedCause && cont) {
        cont = fiber3.getCont(contE);
      }
      return cont ? cont[contE](cause, fiber3, annotated ? void 0 : this) : fiber3.yieldWith(annotated ? exitFailCause(cause) : this);
    }
  });
  var exitFail = (e) => exitFailCause(causeFail(e));
  var exitDie = (defect) => exitFailCause(causeDie(defect));
  var withFiber = /* @__PURE__ */ makePrimitive({
    op: "WithFiber",
    [evaluate](fiber3) {
      return this[args](fiber3);
    }
  });
  var withFiberSucceed = /* @__PURE__ */ makePrimitive({
    op: "WithFiberSucceed",
    [evaluate](fiber3) {
      const value = this[args](fiber3);
      const cont = fiber3.getCont(contA);
      return cont ? cont[contA](value, fiber3) : fiber3.yieldWith(exitSucceed(value));
    }
  });
  var YieldableError = /* @__PURE__ */ (function() {
    class YieldableError2 extends globalThis.Error {
    }
    const proto = /* @__PURE__ */ makePrimitiveProto({
      op: "YieldableError",
      [evaluate]() {
        return exitFail(this);
      }
    });
    delete proto.toString;
    Object.assign(YieldableError2.prototype, proto);
    return YieldableError2;
  })();
  var Error2 = /* @__PURE__ */ (function() {
    const plainArgsSymbol = /* @__PURE__ */ Symbol.for("effect/Data/Error/plainArgs");
    return class Base extends YieldableError {
      constructor(args2) {
        super(args2?.message, args2?.cause ? {
          cause: args2.cause
        } : void 0);
        if (args2) {
          assignProperties(this, args2);
          Object.defineProperty(this, plainArgsSymbol, {
            value: args2,
            enumerable: false
          });
        }
      }
      toJSON() {
        return {
          ...this[plainArgsSymbol],
          ...this
        };
      }
    };
  })();
  var TaggedError = (tag) => {
    class Base extends Error2 {
      _tag = tag;
    }
    ;
    Base.prototype.name = tag;
    return Base;
  };
  var NoSuchElementErrorTypeId = "~effect/Cause/NoSuchElementError";
  var isNoSuchElementError = (u) => hasProperty(u, NoSuchElementErrorTypeId);
  var NoSuchElementError = class extends (/* @__PURE__ */ TaggedError("NoSuchElementError")) {
    [NoSuchElementErrorTypeId] = NoSuchElementErrorTypeId;
    constructor(message) {
      super({
        message
      });
    }
  };
  var DoneTypeId = "~effect/Cause/Done";
  var isDone = (u) => hasProperty(u, DoneTypeId);
  var DoneVoid = {
    [DoneTypeId]: DoneTypeId,
    _tag: "Done",
    value: void 0
  };
  var Done = (value) => {
    if (value === void 0) return DoneVoid;
    return {
      [DoneTypeId]: DoneTypeId,
      _tag: "Done",
      value
    };
  };
  var doneVoid = /* @__PURE__ */ exitFail(DoneVoid);
  var done = (value) => {
    if (value === void 0) return doneVoid;
    return exitFail(Done(value));
  };

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/internal/option.js
  var TypeId = "~effect/Option";
  var CommonProto = {
    [TypeId]: {
      _A: (_) => _
    },
    ...PipeInspectableProto,
    [Symbol.iterator]() {
      return new SingleShotGen(this);
    }
  };
  var SomeProto = /* @__PURE__ */ Object.defineProperty(/* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto), {
    _tag: "Some",
    _op: "Some",
    [symbol2](that) {
      return isOption(that) && isSome(that) && equals(this.value, that.value);
    },
    [symbol]() {
      return combine(hash(this._tag))(hash(this.value));
    },
    toString() {
      return `some(${format(this.value)})`;
    },
    toJSON() {
      return {
        _id: "Option",
        _tag: this._tag,
        value: toJson(this.value)
      };
    }
  }), "valueOrUndefined", {
    get() {
      return this.value;
    }
  });
  var NoneHash = /* @__PURE__ */ hash("None");
  var NoneProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto), {
    _tag: "None",
    _op: "None",
    valueOrUndefined: void 0,
    [symbol2](that) {
      return isOption(that) && isNone(that);
    },
    [symbol]() {
      return NoneHash;
    },
    toString() {
      return `none()`;
    },
    toJSON() {
      return {
        _id: "Option",
        _tag: this._tag
      };
    }
  });
  var isOption = (input) => hasProperty(input, TypeId);
  var isNone = (fa) => fa._tag === "None";
  var isSome = (fa) => fa._tag === "Some";
  var none = /* @__PURE__ */ Object.create(NoneProto);
  var SomeImpl = function(value) {
    this.value = value;
  };
  SomeImpl.prototype = SomeProto;
  var some = (value) => new SomeImpl(value);

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/internal/result.js
  var TypeId2 = "~effect/Result";
  var CommonProto2 = {
    [TypeId2]: {
      /* v8 ignore next 2 */
      _A: (_) => _,
      _E: (_) => _
    },
    ...PipeInspectableProto,
    [Symbol.iterator]() {
      return new SingleShotGen(this);
    }
  };
  var SuccessProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto2), {
    _tag: "Success",
    _op: "Success",
    [symbol2](that) {
      return isResult(that) && isSuccess(that) && equals(this.success, that.success);
    },
    [symbol]() {
      return combine(hash(this._tag))(hash(this.success));
    },
    toString() {
      return `success(${format(this.success)})`;
    },
    toJSON() {
      return {
        _id: "Result",
        _tag: this._tag,
        value: toJson(this.success)
      };
    }
  });
  var FailureProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto2), {
    _tag: "Failure",
    _op: "Failure",
    [symbol2](that) {
      return isResult(that) && isFailure(that) && equals(this.failure, that.failure);
    },
    [symbol]() {
      return combine(hash(this._tag))(hash(this.failure));
    },
    toString() {
      return `failure(${format(this.failure)})`;
    },
    toJSON() {
      return {
        _id: "Result",
        _tag: this._tag,
        failure: toJson(this.failure)
      };
    }
  });
  var isResult = (input) => hasProperty(input, TypeId2);
  var isFailure = (result3) => result3._tag === "Failure";
  var isSuccess = (result3) => result3._tag === "Success";
  var FailureImpl = function(failure) {
    this.failure = failure;
  };
  FailureImpl.prototype = FailureProto;
  var fail = (failure) => new FailureImpl(failure);
  var SuccessImpl = function(success) {
    this.success = success;
  };
  SuccessImpl.prototype = SuccessProto;
  var succeed = (success) => new SuccessImpl(success);

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Order.js
  function make(compare) {
    return (self, that) => self === that ? 0 : compare(self, that);
  }
  var Number2 = /* @__PURE__ */ make((self, that) => {
    if (globalThis.Number.isNaN(self) && globalThis.Number.isNaN(that)) return 0;
    if (globalThis.Number.isNaN(self)) return -1;
    if (globalThis.Number.isNaN(that)) return 1;
    return self < that ? -1 : 1;
  });
  var mapInput = /* @__PURE__ */ dual(2, (self, f) => make((b1, b2) => self(f(b1), f(b2))));
  var isGreaterThan = (O) => dual(2, (self, that) => O(self, that) === 1);

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Option.js
  var none2 = () => none;
  var some2 = some;
  var isOption2 = isOption;
  var isNone2 = isNone;
  var isSome2 = isSome;
  var getOrElse = /* @__PURE__ */ dual(2, (self, onNone) => isNone2(self) ? onNone() : self.value);
  var getOrUndefined = /* @__PURE__ */ getOrElse(constUndefined);

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Result.js
  var succeed2 = succeed;
  var fail2 = fail;
  var isFailure2 = isFailure;
  var isSuccess2 = isSuccess;
  var match = /* @__PURE__ */ dual(2, (self, {
    onFailure,
    onSuccess
  }) => isFailure2(self) ? onFailure(self.failure) : onSuccess(self.success));

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Iterable.js
  var filter = /* @__PURE__ */ dual(2, (self, predicate) => ({
    [Symbol.iterator]() {
      const iterator = self[Symbol.iterator]();
      let i = 0;
      return {
        next() {
          let result3 = iterator.next();
          while (!result3.done) {
            if (predicate(result3.value, i++)) {
              return {
                done: false,
                value: result3.value
              };
            }
            result3 = iterator.next();
          }
          return {
            done: true,
            value: void 0
          };
        }
      };
    }
  }));

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Array.js
  var Array2 = globalThis.Array;
  var fromIterable = (collection) => Array2.isArray(collection) ? collection : Array2.from(collection);
  var isArray = Array2.isArray;
  var isArrayNonEmpty2 = isArrayNonEmpty;
  var empty = () => [];
  var partition = /* @__PURE__ */ dual(2, (self, f) => {
    const excluded = [];
    const satisfying = [];
    let i = 0;
    for (const a of self) {
      const result3 = f(a, i++);
      if (isSuccess2(result3)) {
        satisfying.push(result3.success);
      } else {
        excluded.push(result3.failure);
      }
    }
    return [excluded, satisfying];
  });

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Effectable.js
  var Prototype = (options) => makePrimitiveProto({
    op: options.label,
    [evaluate]: options.evaluate
  });

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Context.js
  var ServiceTypeId = "~effect/Context/Service";
  var Service = function() {
    function KeyClass() {
    }
    const self = KeyClass;
    Object.setPrototypeOf(self, ServiceProto);
    const init = (key, options) => {
      self.key = key;
      if (options?.defaultValue) {
        self[ReferenceTypeId] = ReferenceTypeId;
        self.defaultValue = options.defaultValue;
      }
      if (options?.make) {
        ;
        self.make = options.make;
      }
      if (options?.fiberCached) {
        cacheKeys.add(key);
      }
      return self;
    };
    return arguments.length > 0 ? init(arguments[0], arguments[1]) : init;
  };
  var ServiceProto = {
    [ServiceTypeId]: ServiceTypeId,
    .../* @__PURE__ */ Prototype({
      label: "Service",
      evaluate(fiber3) {
        return exitSucceed(get(fiber3.context, this));
      }
    }),
    toJSON() {
      return {
        _id: "Service",
        key: this.key
      };
    },
    of(self) {
      return self;
    },
    context(self) {
      return make2(this, self);
    },
    use(f) {
      return withFiber((fiber3) => f(get(fiber3.context, this)));
    },
    useSync(f) {
      return withFiber((fiber3) => exitSucceed(f(get(fiber3.context, this))));
    }
  };
  var cacheKeys = /* @__PURE__ */ new Set();
  var ReferenceTypeId = "~effect/Context/Reference";
  var TypeId3 = "~effect/Context";
  var MaxDepth = 8;
  var FlattenAfterBaseHits = 8;
  var makeImpl = (cacheRoot, base, overlay, depth) => {
    const self = Object.create(Proto);
    self.cacheRoot = cacheRoot ?? self;
    self.base = base;
    self.overlay = overlay;
    self.depth = depth;
    self._flat = void 0;
    self.baseHits = 0;
    return self;
  };
  var applyOverlays = (map3, overlay) => {
    if (!overlay) return;
    applyOverlays(map3, overlay.parent);
    map3.set(overlay.key, overlay.value);
  };
  var flatten = (self) => {
    if (self._flat) return self._flat;
    if (!self.overlay) return self._flat = self.base;
    const map3 = new Map(self.base);
    applyOverlays(map3, self.overlay);
    return self._flat = map3;
  };
  var withFlat = (self, f) => {
    const map3 = new Map(self.mapUnsafe);
    f(map3);
    return makeUnsafe(map3);
  };
  var notFound = /* @__PURE__ */ Symbol();
  var lookup = (self, key) => {
    const impl = self;
    for (let overlay = impl.overlay; overlay; overlay = overlay.parent) {
      if (overlay.key === key) return overlay.value;
    }
    const value = impl.base.get(key);
    if (value === void 0 && !impl.base.has(key)) return notFound;
    if (impl.overlay && ++impl.baseHits >= FlattenAfterBaseHits) {
      impl.base = flatten(impl);
      impl.overlay = void 0;
      impl.depth = 0;
    }
    return value;
  };
  var makeUnsafe = (mapUnsafe) => makeImpl(void 0, mapUnsafe, void 0, 0);
  var Proto = {
    get mapUnsafe() {
      return flatten(this);
    },
    ...PipeInspectableProto,
    [TypeId3]: {
      _Services: (_) => _
    },
    toJSON() {
      return {
        _id: "Context",
        services: Array.from(this.mapUnsafe).map(([key, value]) => ({
          key,
          value
        }))
      };
    },
    [symbol2](that) {
      if (!isContext(that)) return false;
      const self = this.mapUnsafe;
      const other = that.mapUnsafe;
      if (self.size !== other.size) return false;
      for (const [key, value] of self) {
        if (!other.has(key) || !equals(value, other.get(key))) return false;
      }
      return true;
    },
    [symbol]() {
      return number(this.mapUnsafe.size);
    }
  };
  var hasSameCache = (self, that) => self.cacheRoot === that.cacheRoot;
  var isContext = (u) => hasProperty(u, TypeId3);
  var isReference = (u) => !!u[ReferenceTypeId];
  var empty2 = () => emptyContext2;
  var emptyContext2 = /* @__PURE__ */ makeUnsafe(/* @__PURE__ */ new Map());
  var make2 = (key, service3) => makeUnsafe(/* @__PURE__ */ new Map([[key.key, service3]]));
  var add = /* @__PURE__ */ dual(3, (self, key, service3) => addUnsafe(self, key.key, service3));
  var addUnsafe = (self, key, service3) => {
    const impl = self;
    const cacheRoot = cacheKeys.has(key) ? void 0 : impl.cacheRoot;
    if (impl.depth >= MaxDepth) {
      const map3 = new Map(impl.mapUnsafe);
      map3.set(key, service3);
      return makeImpl(cacheRoot, map3, void 0, 0);
    }
    return makeImpl(cacheRoot, impl.base, {
      key,
      value: service3,
      parent: impl.overlay
    }, impl.depth + 1);
  };
  var getOrUndefined2 = /* @__PURE__ */ dual(2, (self, key) => getOrUndefinedUnsafe(self, key.key));
  var getOrUndefinedUnsafe = (self, key) => {
    const value = lookup(self, key);
    return value === notFound ? void 0 : value;
  };
  var getUnsafe = /* @__PURE__ */ dual(2, (self, service3) => {
    const value = lookup(self, service3.key);
    if (value === notFound) {
      if (isReference(service3)) return getDefaultValue(service3);
      throw serviceNotFoundError(service3);
    }
    return value;
  });
  var get = getUnsafe;
  var defaultValueCacheKey = "~effect/Context/defaultValue";
  var getDefaultValue = (ref) => {
    if (defaultValueCacheKey in ref) {
      return ref[defaultValueCacheKey];
    }
    return ref[defaultValueCacheKey] = ref.defaultValue();
  };
  var serviceNotFoundError = (service3) => {
    const error = new Error(`Service not found${service3.key ? `: ${String(service3.key)}` : ""}`);
    if (error.stack) {
      const lines = error.stack.split("\n");
      lines.splice(1, 3);
      error.stack = lines.join("\n");
    }
    return error;
  };
  var getOption = /* @__PURE__ */ dual(2, (self, service3) => {
    const value = lookup(self, service3.key);
    if (value !== notFound) return some2(value);
    return isReference(service3) ? some2(getDefaultValue(service3)) : none2();
  });
  var merge = /* @__PURE__ */ dual(2, (self, that) => {
    if (self.mapUnsafe.size === 0) return that;
    if (that.mapUnsafe.size === 0) return self;
    return withFlat(self, (map3) => that.mapUnsafe.forEach((value, key) => map3.set(key, value)));
  });
  var mergeAll = (...ctxs) => {
    const map3 = /* @__PURE__ */ new Map();
    for (let i = 0; i < ctxs.length; i++) {
      ctxs[i].mapUnsafe.forEach((value, key) => {
        map3.set(key, value);
      });
    }
    return makeUnsafe(map3);
  };
  var Reference = Service;

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Duration.js
  var TypeId4 = "~effect/Duration";
  var bigint0 = /* @__PURE__ */ BigInt(0);
  var bigint1 = /* @__PURE__ */ BigInt(1);
  var bigint2 = /* @__PURE__ */ BigInt(2);
  var bigint10 = /* @__PURE__ */ BigInt(10);
  var bigint24 = /* @__PURE__ */ BigInt(24);
  var bigint60 = /* @__PURE__ */ BigInt(60);
  var bigint1e3 = /* @__PURE__ */ BigInt(1e3);
  var bigint1e6 = /* @__PURE__ */ BigInt(1e6);
  var roundTiesAwayFromZero = (input) => BigInt(input < 0 ? Math.ceil(input - 0.5) : Math.floor(input + 0.5));
  var roundMillisToNanos = (millis2) => roundTiesAwayFromZero(millis2 * 1e6);
  var parseNanos = (input, scale) => {
    const decimalIndex = input.indexOf(".");
    if (decimalIndex === -1) return BigInt(input) * scale;
    const isNegative2 = input[0] === "-";
    const fractional = input.slice(decimalIndex + 1);
    const fractionalScale = bigint10 ** BigInt(fractional.length);
    const scaled = (BigInt(input.slice(isNegative2 ? 1 : 0, decimalIndex)) * fractionalScale + BigInt(fractional)) * scale;
    const rounded = scaled / fractionalScale + (scaled % fractionalScale * bigint2 >= fractionalScale ? bigint1 : bigint0);
    return isNegative2 ? -rounded : rounded;
  };
  var DURATION_REGEXP = /^(-?\d+(?:\.\d+)?)\s+(nanos?|micros?|millis?|seconds?|minutes?|hours?|days?|weeks?)$/;
  var fromInputUnsafe = (input) => {
    switch (typeof input) {
      case "number":
        return millis(input);
      case "bigint":
        return nanos(input);
      case "string": {
        if (input === "Infinity") {
          return infinity;
        }
        if (input === "-Infinity") {
          return negativeInfinity;
        }
        const match5 = DURATION_REGEXP.exec(input);
        if (!match5) break;
        const [_, valueStr, unit] = match5;
        if (unit === "nano" || unit === "nanos") {
          return nanos(parseNanos(valueStr, bigint1));
        }
        if (unit === "micro" || unit === "micros") {
          return nanos(parseNanos(valueStr, bigint1e3));
        }
        const value = Number(valueStr);
        switch (unit) {
          case "milli":
          case "millis":
            return millis(value);
          case "second":
          case "seconds":
            return seconds(value);
          case "minute":
          case "minutes":
            return minutes(value);
          case "hour":
          case "hours":
            return hours(value);
          case "day":
          case "days":
            return days(value);
          case "week":
          case "weeks":
            return weeks(value);
        }
        break;
      }
      case "object": {
        if (input === null) break;
        if (TypeId4 in input) return input;
        if (Array.isArray(input)) {
          if (input.length !== 2 || !input.every(isNumber)) {
            return invalid(input);
          }
          if (Number.isNaN(input[0]) || Number.isNaN(input[1])) {
            return zero;
          }
          if (input[0] === -Infinity || input[1] === -Infinity) {
            return negativeInfinity;
          }
          if (input[0] === Infinity || input[1] === Infinity) {
            return infinity;
          }
          return make3(roundTiesAwayFromZero(input[0] * 1e9 + input[1]));
        }
        const obj = input;
        let millis2 = 0;
        if (obj.weeks) millis2 += obj.weeks * 6048e5;
        if (obj.days) millis2 += obj.days * 864e5;
        if (obj.hours) millis2 += obj.hours * 36e5;
        if (obj.minutes) millis2 += obj.minutes * 6e4;
        if (obj.seconds) millis2 += obj.seconds * 1e3;
        if (obj.milliseconds) millis2 += obj.milliseconds;
        if (!obj.microseconds && !obj.nanoseconds) return make3(millis2);
        return make3(roundTiesAwayFromZero(millis2 * 1e6 + (obj.microseconds ?? 0) * 1e3 + (obj.nanoseconds ?? 0)));
      }
    }
    return invalid(input);
  };
  var invalid = (input) => {
    throw new Error(`Invalid Input: ${input}`);
  };
  var zeroDurationValue = {
    _tag: "Millis",
    millis: 0
  };
  var infinityDurationValue = {
    _tag: "Infinity"
  };
  var negativeInfinityDurationValue = {
    _tag: "NegativeInfinity"
  };
  var DurationProto = {
    [TypeId4]: TypeId4,
    [symbol]() {
      switch (this.value._tag) {
        case "Millis": {
          const nanos2 = this.value.millis * 1e6;
          return Number.isFinite(nanos2) ? hash(roundTiesAwayFromZero(nanos2)) : number(this.value.millis);
        }
        case "Nanos":
          return hash(this.value.nanos);
        default:
          return structure(this.value);
      }
    },
    [symbol2](that) {
      return isDuration(that) && equals2(this, that);
    },
    toString() {
      switch (this.value._tag) {
        case "Infinity":
          return "Infinity";
        case "NegativeInfinity":
          return "-Infinity";
        case "Nanos":
          return `${this.value.nanos} nanos`;
        case "Millis":
          return `${this.value.millis} millis`;
      }
    },
    toJSON() {
      switch (this.value._tag) {
        case "Millis":
          return {
            _id: "Duration",
            _tag: "Millis",
            millis: this.value.millis
          };
        case "Nanos":
          return {
            _id: "Duration",
            _tag: "Nanos",
            nanos: String(this.value.nanos)
          };
        case "Infinity":
          return {
            _id: "Duration",
            _tag: "Infinity"
          };
        case "NegativeInfinity":
          return {
            _id: "Duration",
            _tag: "NegativeInfinity"
          };
      }
    },
    [NodeInspectSymbol]() {
      return this.toJSON();
    },
    pipe() {
      return pipeArguments(this, arguments);
    }
  };
  var make3 = (input) => {
    const duration = Object.create(DurationProto);
    if (typeof input === "number") {
      if (isNaN(input) || input === 0 || Object.is(input, -0)) {
        duration.value = zeroDurationValue;
      } else if (!Number.isFinite(input)) {
        duration.value = input > 0 ? infinityDurationValue : negativeInfinityDurationValue;
      } else if (!Number.isInteger(input)) {
        duration.value = {
          _tag: "Nanos",
          nanos: roundMillisToNanos(input)
        };
      } else {
        duration.value = {
          _tag: "Millis",
          millis: input
        };
      }
    } else if (input === bigint0) {
      duration.value = zeroDurationValue;
    } else {
      duration.value = {
        _tag: "Nanos",
        nanos: input
      };
    }
    return duration;
  };
  var isDuration = (u) => hasProperty(u, TypeId4);
  var isZero = (self) => {
    switch (self.value._tag) {
      case "Millis":
        return self.value.millis === 0;
      case "Nanos":
        return self.value.nanos === bigint0;
      case "Infinity":
      case "NegativeInfinity":
        return false;
    }
  };
  var isNegative = (self) => {
    switch (self.value._tag) {
      case "Millis":
        return self.value.millis < 0;
      case "Nanos":
        return self.value.nanos < bigint0;
      case "NegativeInfinity":
        return true;
      case "Infinity":
        return false;
    }
  };
  var abs = (self) => {
    switch (self.value._tag) {
      case "Infinity":
      case "NegativeInfinity":
        return infinity;
      case "Millis":
        return self.value.millis < 0 ? make3(-self.value.millis) : self;
      case "Nanos":
        return self.value.nanos < bigint0 ? make3(-self.value.nanos) : self;
    }
  };
  var zero = /* @__PURE__ */ make3(0);
  var infinity = /* @__PURE__ */ make3(Infinity);
  var negativeInfinity = /* @__PURE__ */ make3(-Infinity);
  var nanos = (nanos2) => make3(nanos2);
  var millis = (millis2) => make3(millis2);
  var seconds = (seconds2) => make3(seconds2 * 1e3);
  var minutes = (minutes2) => make3(minutes2 * 6e4);
  var hours = (hours2) => make3(hours2 * 36e5);
  var days = (days2) => make3(days2 * 864e5);
  var weeks = (weeks2) => make3(weeks2 * 6048e5);
  var toMillis = (self) => match2(fromInputUnsafe(self), {
    onMillis: identity,
    onNanos: (nanos2) => Number(nanos2) / 1e6,
    onInfinity: () => Infinity,
    onNegativeInfinity: () => -Infinity
  });
  var toNanosUnsafe = (input) => {
    const self = fromInputUnsafe(input);
    switch (self.value._tag) {
      case "Infinity":
      case "NegativeInfinity":
        throw new Error("Cannot convert infinite duration to nanos");
      case "Nanos":
        return self.value.nanos;
      case "Millis":
        return roundMillisToNanos(self.value.millis);
    }
  };
  var match2 = /* @__PURE__ */ dual(2, (self, options) => {
    switch (self.value._tag) {
      case "Millis":
        return options.onMillis(self.value.millis);
      case "Nanos":
        return options.onNanos(self.value.nanos);
      case "Infinity":
        return options.onInfinity();
      case "NegativeInfinity":
        return (options.onNegativeInfinity ?? options.onInfinity)();
    }
  });
  var matchPair = /* @__PURE__ */ dual(3, (self, that, options) => {
    if (self.value._tag === "Infinity" || self.value._tag === "NegativeInfinity" || that.value._tag === "Infinity" || that.value._tag === "NegativeInfinity") return options.onInfinity(self, that);
    if (self.value._tag === "Millis") {
      return that.value._tag === "Millis" ? options.onMillis(self.value.millis, that.value.millis) : options.onNanos(toNanosUnsafe(self), that.value.nanos);
    } else {
      return options.onNanos(self.value.nanos, toNanosUnsafe(that));
    }
  });
  var Equivalence = (self, that) => matchPair(self, that, {
    onMillis: (self2, that2) => self2 === that2,
    onNanos: (self2, that2) => self2 === that2,
    onInfinity: (self2, that2) => self2.value._tag === that2.value._tag
  });
  var subtract = /* @__PURE__ */ dual(2, (self, that) => matchPair(self, that, {
    onMillis: (self2, that2) => make3(self2 - that2),
    onNanos: (self2, that2) => make3(self2 - that2),
    onInfinity: (self2, that2) => {
      const s = self2.value._tag;
      const t = that2.value._tag;
      if (s === "Infinity") return t === "Infinity" ? zero : infinity;
      if (s === "NegativeInfinity") return t === "NegativeInfinity" ? zero : negativeInfinity;
      return t === "Infinity" ? negativeInfinity : infinity;
    }
  }));
  var equals2 = /* @__PURE__ */ dual(2, (self, that) => Equivalence(self, that));
  var parts = (self) => {
    if (self.value._tag === "Infinity") {
      return {
        days: Infinity,
        hours: Infinity,
        minutes: Infinity,
        seconds: Infinity,
        millis: Infinity,
        nanos: Infinity
      };
    }
    if (self.value._tag === "NegativeInfinity") {
      return {
        days: -Infinity,
        hours: -Infinity,
        minutes: -Infinity,
        seconds: -Infinity,
        millis: -Infinity,
        nanos: -Infinity
      };
    }
    const n = toNanosUnsafe(self);
    const neg = n < bigint0;
    const a = neg ? -n : n;
    const ms = a / bigint1e6;
    const sec = ms / bigint1e3;
    const min2 = sec / bigint60;
    const hr = min2 / bigint60;
    const d = hr / bigint24;
    const sign = neg ? -1 : 1;
    return {
      days: sign * Number(d),
      hours: sign * Number(hr % bigint24),
      minutes: sign * Number(min2 % bigint60),
      seconds: sign * Number(sec % bigint60),
      millis: sign * Number(ms % bigint1e3),
      nanos: sign * Number(a % bigint1e6)
    };
  };
  var format2 = (self) => {
    if (self.value._tag === "Infinity") {
      return "Infinity";
    }
    if (self.value._tag === "NegativeInfinity") {
      return "-Infinity";
    }
    if (isZero(self)) {
      return "0";
    }
    if (isNegative(self)) {
      return "-" + format2(abs(self));
    }
    const fragments = parts(self);
    const pieces = [];
    if (fragments.days !== 0) {
      pieces.push(`${fragments.days}d`);
    }
    if (fragments.hours !== 0) {
      pieces.push(`${fragments.hours}h`);
    }
    if (fragments.minutes !== 0) {
      pieces.push(`${fragments.minutes}m`);
    }
    if (fragments.seconds !== 0) {
      pieces.push(`${fragments.seconds}s`);
    }
    if (fragments.millis !== 0) {
      pieces.push(`${fragments.millis}ms`);
    }
    if (fragments.nanos !== 0) {
      pieces.push(`${fragments.nanos}ns`);
    }
    return pieces.join(" ");
  };

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Scheduler.js
  var Scheduler = /* @__PURE__ */ Reference("effect/Scheduler", {
    fiberCached: true,
    defaultValue: () => new MixedScheduler()
  });
  var setMicrotask = (f) => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) f();
    });
    return () => {
      cancelled = true;
    };
  };
  var setTimer = "setImmediate" in globalThis ? (f) => {
    const timer = globalThis.setImmediate(f);
    return () => globalThis.clearImmediate(timer);
  } : (f) => {
    const timer = setTimeout(f, 0);
    return () => clearTimeout(timer);
  };
  var setImmediate = (f) => {
    try {
      return setTimer(f);
    } catch {
      return setMicrotask(f);
    }
  };
  var PriorityBuckets = class {
    buckets = [];
    scheduleTask(task, priority) {
      const buckets = this.buckets;
      const len = buckets.length;
      let bucket;
      let index = 0;
      for (; index < len; index++) {
        if (buckets[index][0] > priority) break;
        bucket = buckets[index];
      }
      if (bucket && bucket[0] === priority) {
        bucket[1].push(task);
      } else if (index === len) {
        buckets.push([priority, [task]]);
      } else {
        buckets.splice(index, 0, [priority, [task]]);
      }
    }
    drain() {
      const buckets = this.buckets;
      this.buckets = [];
      return buckets;
    }
  };
  var MixedScheduler = class {
    executionMode;
    setImmediate;
    constructor(executionMode = "async", setImmediateFn) {
      this.executionMode = executionMode;
      this.setImmediate = setImmediateFn ?? (executionMode === "sync" ? setMicrotask : setImmediate);
    }
    /**
     * Returns whether the fiber has reached its operation budget and should yield.
     *
     * **When to use**
     *
     * Use to decide whether a fiber should yield after consuming its current
     * operation budget.
     *
     * @since 2.0.0
     */
    shouldYield(fiber3) {
      return fiber3.currentOpCount >= fiber3.cache.maxOpsBeforeYield;
    }
    /**
     * Creates a dispatcher that schedules work through this scheduler.
     *
     * **When to use**
     *
     * Use when you need a standalone dispatcher from a scheduler instance, for
     * example in tests that enqueue tasks and then flush them deterministically.
     *
     * @since 4.0.0
     */
    makeDispatcher() {
      return new MixedSchedulerDispatcher(this.setImmediate);
    }
  };
  var MixedSchedulerDispatcher = class {
    tasks = /* @__PURE__ */ new PriorityBuckets();
    running = void 0;
    setImmediate;
    constructor(setImmediateFn = setImmediate) {
      this.setImmediate = setImmediateFn;
    }
    /**
     * @since 2.0.0
     */
    scheduleTask(task, priority) {
      this.tasks.scheduleTask(task, priority);
      if (this.running === void 0) {
        this.running = this.setImmediate(this.afterScheduled);
      }
    }
    /**
     * @since 2.0.0
     */
    afterScheduled = () => {
      this.running = void 0;
      this.runTasks();
    };
    /**
     * @since 2.0.0
     */
    runTasks() {
      const buckets = this.tasks.drain();
      for (let i = 0; i < buckets.length; i++) {
        const toRun = buckets[i][1];
        for (let j = 0; j < toRun.length; j++) {
          toRun[j]();
        }
      }
    }
    /**
     * @since 2.0.0
     */
    flush() {
      while (this.tasks.buckets.length > 0) {
        if (this.running !== void 0) {
          this.running();
          this.running = void 0;
        }
        this.runTasks();
      }
    }
  };
  var MaxOpsBeforeYield = /* @__PURE__ */ Reference("effect/Scheduler/MaxOpsBeforeYield", {
    fiberCached: true,
    defaultValue: () => 2048
  });
  var PreventSchedulerYield = /* @__PURE__ */ Reference("effect/Scheduler/PreventSchedulerYield", {
    fiberCached: true,
    defaultValue: () => false
  });

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Data.js
  var TaggedError2 = TaggedError;

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Encoding.js
  var EncodingErrorTypeId = "~effect/Encoding/EncodingError";
  var EncodingError = class extends (/* @__PURE__ */ TaggedError2("EncodingError")) {
    /**
     * Marks this value as an encoding or decoding error for runtime guards.
     *
     * **When to use**
     *
     * Use to identify `EncodingError` instances through `isEncodingError`.
     *
     * @since 4.0.0
     */
    [EncodingErrorTypeId] = EncodingErrorTypeId;
  };
  var randomHex = (length) => {
    switch (length) {
      case 16:
        return randomHex16();
      case 32:
        return randomHex32();
      default: {
        let result3 = "";
        for (let i = length >>> 3; i > 0; i--) {
          result3 += randomHex8();
        }
        return result3;
      }
    }
  };
  var hexCharCodes = /* @__PURE__ */ Uint8Array.from("0123456789abcdef", (c) => c.charCodeAt(0));
  var randomWord = () => Math.random() * 4294967296 >>> 0;
  var randomHex8 = () => {
    const a = randomWord();
    return String.fromCharCode(hexCharCodes[a >>> 28], hexCharCodes[a >>> 24 & 15], hexCharCodes[a >>> 20 & 15], hexCharCodes[a >>> 16 & 15], hexCharCodes[a >>> 12 & 15], hexCharCodes[a >>> 8 & 15], hexCharCodes[a >>> 4 & 15], hexCharCodes[a & 15]);
  };
  var randomHex16 = () => {
    const a = randomWord();
    const b = randomWord();
    return String.fromCharCode(hexCharCodes[a >>> 28], hexCharCodes[a >>> 24 & 15], hexCharCodes[a >>> 20 & 15], hexCharCodes[a >>> 16 & 15], hexCharCodes[a >>> 12 & 15], hexCharCodes[a >>> 8 & 15], hexCharCodes[a >>> 4 & 15], hexCharCodes[a & 15], hexCharCodes[b >>> 28], hexCharCodes[b >>> 24 & 15], hexCharCodes[b >>> 20 & 15], hexCharCodes[b >>> 16 & 15], hexCharCodes[b >>> 12 & 15], hexCharCodes[b >>> 8 & 15], hexCharCodes[b >>> 4 & 15], hexCharCodes[b & 15]);
  };
  var randomHex32 = () => {
    const a = randomWord();
    const b = randomWord();
    const c = randomWord();
    const d = randomWord();
    return String.fromCharCode(hexCharCodes[a >>> 28], hexCharCodes[a >>> 24 & 15], hexCharCodes[a >>> 20 & 15], hexCharCodes[a >>> 16 & 15], hexCharCodes[a >>> 12 & 15], hexCharCodes[a >>> 8 & 15], hexCharCodes[a >>> 4 & 15], hexCharCodes[a & 15], hexCharCodes[b >>> 28], hexCharCodes[b >>> 24 & 15], hexCharCodes[b >>> 20 & 15], hexCharCodes[b >>> 16 & 15], hexCharCodes[b >>> 12 & 15], hexCharCodes[b >>> 8 & 15], hexCharCodes[b >>> 4 & 15], hexCharCodes[b & 15], hexCharCodes[c >>> 28], hexCharCodes[c >>> 24 & 15], hexCharCodes[c >>> 20 & 15], hexCharCodes[c >>> 16 & 15], hexCharCodes[c >>> 12 & 15], hexCharCodes[c >>> 8 & 15], hexCharCodes[c >>> 4 & 15], hexCharCodes[c & 15], hexCharCodes[d >>> 28], hexCharCodes[d >>> 24 & 15], hexCharCodes[d >>> 20 & 15], hexCharCodes[d >>> 16 & 15], hexCharCodes[d >>> 12 & 15], hexCharCodes[d >>> 8 & 15], hexCharCodes[d >>> 4 & 15], hexCharCodes[d & 15]);
  };

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Tracer.js
  var ParentSpanKey = "effect/Tracer/ParentSpan";
  var ParentSpan = class extends (/* @__PURE__ */ Service()(ParentSpanKey, {
    fiberCached: true
  })) {
  };
  var make4 = (options) => options;
  var DisablePropagation = /* @__PURE__ */ Reference("effect/Tracer/DisablePropagation", {
    defaultValue: constFalse
  });
  var CurrentTraceLevel = /* @__PURE__ */ Reference("effect/Tracer/CurrentTraceLevel", {
    defaultValue: () => "Info"
  });
  var MinimumTraceLevel = /* @__PURE__ */ Reference("effect/Tracer/MinimumTraceLevel", {
    defaultValue: () => "All"
  });
  var TracerKey = "effect/Tracer";
  var Tracer = /* @__PURE__ */ Reference(TracerKey, {
    fiberCached: true,
    defaultValue: () => nativeTracer
  });
  var nativeTracer = /* @__PURE__ */ make4({
    span: (options) => new NativeSpan(options)
  });
  var NativeSpan = class {
    _tag = "Span";
    sampled;
    name;
    parent;
    annotations;
    links;
    startTime;
    kind;
    status;
    _traceId = void 0;
    _spanId = void 0;
    _attributes = void 0;
    _events = void 0;
    constructor(options) {
      this.name = options.name;
      this.parent = options.parent;
      this.annotations = options.annotations;
      this.links = options.links;
      this.startTime = options.startTime;
      this.kind = options.kind;
      this.sampled = options.sampled;
      this.status = {
        _tag: "Started",
        startTime: options.startTime
      };
    }
    get traceId() {
      return this._traceId ??= getOrUndefined(this.parent)?.traceId ?? randomHex(32);
    }
    get spanId() {
      return this._spanId ??= randomHex(16);
    }
    get attributes() {
      return this._attributes ??= /* @__PURE__ */ new Map();
    }
    get events() {
      return this._events ??= [];
    }
    end(endTime, exit3) {
      this.status = {
        _tag: "Ended",
        endTime,
        exit: exit3,
        startTime: this.status.startTime
      };
    }
    attribute(key, value) {
      this.attributes.set(key, value);
    }
    event(name, startTime, attributes) {
      this.events.push([name, startTime, attributes ?? {}]);
    }
    addLinks(links) {
      this.links.push(...links);
    }
  };

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/internal/metric.js
  var FiberRuntimeMetricsKey = "effect/Metric/FiberRuntimeMetrics";

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/internal/references.js
  var CurrentErrorReporters = /* @__PURE__ */ Reference("effect/ErrorReporter/CurrentErrorReporters", {
    defaultValue: () => /* @__PURE__ */ new Set()
  });
  var CurrentStackFrame = /* @__PURE__ */ Reference("effect/References/CurrentStackFrame", {
    fiberCached: true,
    defaultValue: constUndefined
  });
  var TracerEnabled = /* @__PURE__ */ Reference("effect/References/TracerEnabled", {
    fiberCached: true,
    defaultValue: constTrue
  });
  var TracerTimingEnabled = /* @__PURE__ */ Reference("effect/References/TracerTimingEnabled", {
    defaultValue: constTrue
  });
  var TracerSpanAnnotations = /* @__PURE__ */ Reference("effect/References/TracerSpanAnnotations", {
    defaultValue: () => ({})
  });
  var TracerSpanLinks = /* @__PURE__ */ Reference("effect/References/TracerSpanLinks", {
    defaultValue: () => []
  });
  var CurrentLogAnnotations = /* @__PURE__ */ Reference("effect/References/CurrentLogAnnotations", {
    defaultValue: () => ({})
  });
  var CurrentLogLevel = /* @__PURE__ */ Reference("effect/References/CurrentLogLevel", {
    fiberCached: true,
    defaultValue: () => "Info"
  });
  var MinimumLogLevel = /* @__PURE__ */ Reference("effect/References/MinimumLogLevel", {
    fiberCached: true,
    defaultValue: () => "Info"
  });
  var CurrentLogSpans = /* @__PURE__ */ Reference("effect/References/CurrentLogSpans", {
    defaultValue: () => []
  });

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/internal/tracer.js
  var addSpanStackTrace = (options) => {
    if (options?.captureStackTrace === false) {
      return options;
    } else if (options?.captureStackTrace !== void 0 && typeof options.captureStackTrace !== "boolean") {
      return options;
    }
    const limit = getStackTraceLimit();
    if (limit === 0 && options?.captureStackTrace !== true) {
      return {
        ...options,
        captureStackTrace: false
      };
    }
    setStackTraceLimit(3);
    const traceError = new Error();
    setStackTraceLimit(limit);
    return {
      ...options,
      captureStackTrace: spanCleaner(() => traceError.stack)
    };
  };
  var makeStackCleaner = (line) => (stack) => {
    let cache;
    return () => {
      if (cache !== void 0) return cache;
      const trace = stack();
      if (!trace) return void 0;
      const lines = trace.split("\n");
      if (lines[line] !== void 0) {
        cache = lines[line].trim();
        return cache;
      }
    };
  };
  var spanCleaner = /* @__PURE__ */ makeStackCleaner(3);

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/internal/effect.js
  var Interrupt = class extends ReasonBase {
    constructor(fiberId3, annotations = constEmptyAnnotations) {
      super("Interrupt", annotations, "Interrupted");
      this.fiberId = fiberId3;
    }
    toString() {
      return `Interrupt(${this.fiberId})`;
    }
    toJSON() {
      return {
        _tag: "Interrupt",
        fiberId: this.fiberId
      };
    }
    [symbol2](that) {
      return isInterruptReason(that) && this.fiberId === that.fiberId && this.annotations === that.annotations;
    }
    [symbol]() {
      return combine(string(`${this._tag}:${this.fiberId}`))(random(this.annotations));
    }
  };
  var causeInterrupt = (fiberId3) => new CauseImpl([new Interrupt(fiberId3)]);
  var findFail = (self) => {
    const reason = self.reasons.find(isFailReason);
    return reason ? succeed2(reason) : fail2(self);
  };
  var findError = (self) => {
    for (let i = 0; i < self.reasons.length; i++) {
      const reason = self.reasons[i];
      if (reason._tag === "Fail") {
        return succeed2(reason.error);
      }
    }
    return fail2(self);
  };
  var hasDies = (self) => self.reasons.some(isDieReason);
  var findDefect = (self) => {
    const reason = self.reasons.find(isDieReason);
    return reason ? succeed2(reason.defect) : fail2(self);
  };
  var hasInterrupts = (self) => self.reasons.some(isInterruptReason);
  var causeFilterInterruptors = (self) => {
    let interruptors;
    for (let i = 0; i < self.reasons.length; i++) {
      const f = self.reasons[i];
      if (f._tag !== "Interrupt") continue;
      interruptors ??= /* @__PURE__ */ new Set();
      if (f.fiberId !== void 0) {
        interruptors.add(f.fiberId);
      }
    }
    return interruptors ? succeed2(interruptors) : fail2(self);
  };
  var dedupeReasons = (self, that) => {
    const buckets = /* @__PURE__ */ new Map();
    const out = [];
    for (const reason of self.concat(that)) {
      const hash2 = hash(reason);
      const bucket = buckets.get(hash2);
      if (bucket === void 0) {
        buckets.set(hash2, [reason]);
      } else if (bucket.some((previous) => equals(previous, reason))) {
        continue;
      } else {
        bucket.push(reason);
      }
      out.push(reason);
    }
    return out;
  };
  var causeCombine = /* @__PURE__ */ dual(2, (self, that) => {
    if (self.reasons.length === 0) {
      return that;
    } else if (that.reasons.length === 0) {
      return self;
    }
    const newCause = new CauseImpl(dedupeReasons(self.reasons, that.reasons));
    return equals(self, newCause) ? self : newCause;
  });
  var causePartition = (self) => {
    const obj = {
      Fail: [],
      Die: [],
      Interrupt: []
    };
    for (let i = 0; i < self.reasons.length; i++) {
      obj[self.reasons[i]._tag].push(self.reasons[i]);
    }
    return obj;
  };
  var causeSquash = (self) => {
    const partitioned = causePartition(self);
    if (partitioned.Fail.length > 0) {
      return partitioned.Fail[0].error;
    } else if (partitioned.Die.length > 0) {
      return partitioned.Die[0].defect;
    } else if (partitioned.Interrupt.length > 0) {
      return new globalThis.Error("All fibers interrupted without error");
    }
    return new globalThis.Error("Empty cause");
  };
  var causePrettyErrors = (self, options) => {
    const errors = [];
    const interrupts = [];
    if (self.reasons.length === 0) return errors;
    const prevStackLimit = getStackTraceLimit();
    if (prevStackLimit !== 0) setStackTraceLimit(1);
    for (const failure of self.reasons) {
      if (failure._tag === "Interrupt") {
        interrupts.push(failure);
        continue;
      }
      errors.push(causePrettyError(failure._tag === "Die" ? failure.defect : failure.error, failure.annotations, options));
    }
    if (errors.length === 0) {
      const cause = new Error("The fiber was interrupted by:");
      cause.name = "InterruptCause";
      cause.stack = interruptCauseStack(cause, interrupts);
      const error = new globalThis.Error("All fibers interrupted without error", {
        cause
      });
      error.name = "InterruptError";
      error.stack = `${error.name}: ${error.message}`;
      errors.push(causePrettyError(error, interrupts[0].annotations, options));
    }
    if (prevStackLimit !== 0) setStackTraceLimit(prevStackLimit);
    return errors;
  };
  var causePrettyError = (original, annotations, options) => {
    const kind = typeof original;
    let error;
    if (original && kind === "object") {
      error = new globalThis.Error(causePrettyMessage(original), {
        cause: original.cause ? causePrettyError(original.cause) : void 0
      });
      if (typeof original.name === "string") {
        error.name = original.name;
      }
      if (typeof original.stack === "string") {
        error.stack = cleanErrorStack(original.stack, error, annotations);
      } else {
        const stack = `${error.name}: ${error.message}`;
        error.stack = annotations ? addStackAnnotations(stack, annotations) : stack;
      }
      if (options?.includeCauseInStack) {
        error.stack = renderPrettyError(error);
      }
      for (const key of Object.keys(original)) {
        if (!(key in error)) {
          ;
          error[key] = original[key];
        }
      }
    } else {
      error = new globalThis.Error(!original ? `Unknown error: ${original}` : kind === "string" ? original : formatJson(original));
    }
    return error;
  };
  var causePrettyMessage = (u) => {
    if (typeof u.message === "string") {
      return u.message;
    } else if (typeof u.toString === "function" && u.toString !== Object.prototype.toString && u.toString !== Array.prototype.toString) {
      try {
        return u.toString();
      } catch {
      }
    }
    return formatJson(u);
  };
  var locationRegExp = /\((.*)\)/g;
  var cleanErrorStack = (stack, error, annotations) => {
    const message = `${error.name}: ${error.message}`;
    const lines = (stack.startsWith(message) ? stack.slice(message.length) : stack).split("\n");
    const out = [message];
    for (let i = 1; i < lines.length; i++) {
      if (/(?:Generator\.next|~effect\/Effect)/.test(lines[i])) {
        break;
      }
      out.push(lines[i]);
    }
    return annotations ? addStackAnnotations(out.join("\n"), annotations) : out.join("\n");
  };
  var addStackAnnotations = (stack, annotations) => {
    const frame = annotations?.get(StackTraceKey.key);
    if (frame) {
      stack = `${stack}
${currentStackTrace(frame)}`;
    }
    return stack;
  };
  var interruptCauseStack = (error, interrupts) => {
    const out = [`${error.name}: ${error.message}`];
    for (const current of interrupts) {
      const fiberId3 = current.fiberId !== void 0 ? `#${current.fiberId}` : "unknown";
      const frame = current.annotations.get(InterruptorStackTrace.key);
      out.push(`    at fiber (${fiberId3})`);
      if (frame) out.push(currentStackTrace(frame));
    }
    return out.join("\n");
  };
  var currentStackTrace = (frame) => {
    const out = [];
    let current = frame;
    let i = 0;
    while (current && i < 10) {
      const stack = current.stack();
      if (stack) {
        const locationMatchAll = stack.matchAll(locationRegExp);
        let match5 = false;
        for (const [, location] of locationMatchAll) {
          match5 = true;
          out.push(`    at ${current.name} (${location})`);
        }
        if (!match5) {
          out.push(`    at ${current.name} (${stack.replace(/^at /, "")})`);
        }
      } else {
        out.push(`    at ${current.name}`);
      }
      current = current.parent;
      i++;
    }
    return out.join("\n");
  };
  var causePretty = (cause) => causePrettyErrors(cause).map(renderPrettyError).join("\n");
  var renderPrettyError = (e) => e.cause ? `${e.stack} {
${renderErrorCause(e.cause, "  ")}
}` : e.stack;
  var renderErrorCause = (cause, prefix) => {
    const lines = cause.stack.split("\n");
    let stack = `${prefix}[cause]: ${lines[0]}`;
    for (let i = 1, len = lines.length; i < len; i++) {
      stack += `
${prefix}${lines[i]}`;
    }
    if (cause.cause) {
      stack += ` {
${renderErrorCause(cause.cause, `${prefix}  `)}
${prefix}}`;
    }
    return stack;
  };
  var FiberTypeId = "~effect/Fiber";
  var fiberVariance = {
    _A: identity,
    _E: identity
  };
  var fiberIdStore = {
    id: 0
  };
  var getCurrentFiber = () => globalThis[currentFiberTypeId];
  var FiberImpl = class {
    constructor(context3, interruptible3 = true) {
      this[FiberTypeId] = fiberVariance;
      this.setContext(context3);
      this.id = ++fiberIdStore.id;
      this.currentOpCount = 0;
      this.interruptible = interruptible3;
      this._stack = [];
      this._observers = void 0;
      this._exit = void 0;
      this._children = void 0;
      this._interruptedCause = void 0;
      this._yielded = void 0;
      this._running = false;
      this._deferredInterrupt = false;
      this._parent = void 0;
      this.cache.runtimeMetrics?.recordFiberStart(this.context);
    }
    [FiberTypeId];
    id;
    interruptible;
    currentOpCount;
    _stack;
    _observers;
    _exit;
    _children;
    _interruptedCause;
    _yielded;
    _running;
    _deferredInterrupt;
    _parent;
    // set in setContext
    context;
    cache;
    _dispatcher = void 0;
    get currentDispatcher() {
      return this._dispatcher ??= this.cache.scheduler.makeDispatcher();
    }
    getRef(ref) {
      return get(this.context, ref);
    }
    addObserver(cb) {
      if (this._exit) {
        cb(this._exit);
        return constVoid;
      }
      if (this._observers === void 0) {
        this._observers = [cb];
      } else {
        this._observers.push(cb);
      }
      return () => {
        if (this._exit || this._observers === void 0) return;
        const index = this._observers.indexOf(cb);
        if (index >= 0) {
          this._observers.splice(index, 1);
        }
      };
    }
    interruptUnsafe(fiberId3, annotations) {
      if (this._exit) {
        return;
      }
      let cause = causeInterrupt(fiberId3);
      if (this.cache.stackFrame) {
        cause = causeAnnotate(cause, make2(StackTraceKey, this.cache.stackFrame));
      }
      if (annotations) {
        cause = causeAnnotate(cause, annotations);
      }
      this._interruptedCause = this._interruptedCause ? causeCombine(this._interruptedCause, cause) : cause;
      if (this.interruptible) {
        if (this._running) {
          this._deferredInterrupt = true;
        } else {
          this.evaluate(failCause(this._interruptedCause));
        }
      }
    }
    pollUnsafe() {
      return this._exit;
    }
    evaluate(effect) {
      if (this._exit) {
        return;
      } else if (this._yielded !== void 0) {
        const yielded = this._yielded;
        this._yielded = void 0;
        yielded();
      }
      const exit3 = this.runLoop(effect);
      if (exit3 === Yield) {
        return;
      }
      const interruptChildren = fiberMiddleware.interruptChildren && fiberMiddleware.interruptChildren(this);
      if (interruptChildren !== void 0) {
        return this.evaluate(flatMap(interruptChildren, () => exit3));
      }
      this._exit = exit3;
      this.cache.runtimeMetrics?.recordFiberEnd(this.context, this._exit);
      if (this._parent) {
        this._parent._children?.delete(this);
        this._parent = void 0;
      }
      if (this._observers !== void 0) {
        const observers = this._observers;
        this._observers = void 0;
        for (let i = 0; i < observers.length; i++) {
          observers[i](exit3);
        }
      }
      this._stack.length = 0;
      this._children = void 0;
      this.context = empty2();
    }
    runLoop(effect) {
      const prevFiber = globalThis[currentFiberTypeId];
      globalThis[currentFiberTypeId] = this;
      const prevRunning = this._running;
      this._running = true;
      let yielding = false;
      let current = effect;
      this.currentOpCount = 0;
      try {
        while (true) {
          if (this._deferredInterrupt) {
            this._deferredInterrupt = false;
            current = failCause(this._interruptedCause);
          }
          this.currentOpCount++;
          const cache = this.cache;
          if (!yielding && !cache.preventYield && cache.scheduler.shouldYield(this)) {
            yielding = true;
            const prev = current;
            current = flatMap(yieldNow, () => prev);
          }
          current = cache.tracerContext ? cache.tracerContext(current, this) : current[evaluate](this);
          if (current === Yield) {
            const yielded = this._yielded;
            if (ExitTypeId in yielded) {
              this._deferredInterrupt = false;
              this._yielded = void 0;
              return yielded;
            } else if (this._deferredInterrupt) {
              this._yielded = void 0;
              yielded();
              continue;
            }
            return Yield;
          }
        }
      } catch (error) {
        if (!hasProperty(current, evaluate)) {
          return exitDie(`Fiber.runLoop: Not a valid effect: ${String(current)}`);
        }
        return this.runLoop(exitDie(error));
      } finally {
        this._running = prevRunning;
        globalThis[currentFiberTypeId] = prevFiber;
      }
    }
    getCont(symbol3) {
      if (this._deferredInterrupt) {
        this._deferredInterrupt = false;
        return deferredInterruptCont;
      }
      while (true) {
        const op = this._stack.pop();
        if (!op) return void 0;
        const all3 = op[contAll];
        if (all3 !== void 0) {
          const cont = all3.call(op, this);
          if (cont) {
            ;
            cont[symbol3] = cont;
            return cont;
          }
        }
        if (op[symbol3]) return op;
      }
    }
    yieldWith(value) {
      this._yielded = value;
      return Yield;
    }
    children() {
      return this._children ??= /* @__PURE__ */ new Set();
    }
    pipe() {
      return pipeArguments(this, arguments);
    }
    setContext(context3) {
      const previous = this.context;
      this.context = context3;
      if (previous !== void 0 && hasSameCache(previous, context3)) return;
      const root = context3.cacheRoot;
      const cache = root._fiberCache ??= makeFiberContextCache(context3);
      if (this.cache !== void 0 && this.cache.scheduler !== cache.scheduler) {
        this._dispatcher = void 0;
      }
      this.cache = cache;
    }
    get currentSpanLocal() {
      const span = this.cache.span;
      return span?._tag === "Span" ? span : void 0;
    }
  };
  var makeFiberContextCache = (context3) => {
    const currentTracer = getOrUndefinedUnsafe(context3, TracerKey);
    return {
      scheduler: get(context3, Scheduler),
      tracer: currentTracer,
      tracerContext: currentTracer ? currentTracer["context"] : void 0,
      tracerEnabled: get(context3, TracerEnabled),
      span: getOrUndefinedUnsafe(context3, ParentSpanKey),
      logLevel: get(context3, CurrentLogLevel),
      minimumLogLevel: get(context3, MinimumLogLevel),
      stackFrame: get(context3, CurrentStackFrame),
      runtimeMetrics: getOrUndefinedUnsafe(context3, FiberRuntimeMetricsKey),
      maxOpsBeforeYield: get(context3, MaxOpsBeforeYield),
      preventYield: get(context3, PreventSchedulerYield)
    };
  };
  var deferredInterruptCont = {
    [contA](_value, fiber3) {
      return failCause(fiber3._interruptedCause);
    },
    [contE](_cause, fiber3) {
      return failCause(fiber3._interruptedCause);
    }
  };
  var fiberMiddleware = {
    interruptChildren: void 0
  };
  var fiberStackAnnotations = (fiber3) => {
    if (!fiber3.cache.stackFrame) return void 0;
    const annotations = /* @__PURE__ */ new Map();
    annotations.set(InterruptorStackTrace.key, fiber3.cache.stackFrame);
    return makeUnsafe(annotations);
  };
  var fiberInterruptChildren = (fiber3) => {
    if (fiber3._children === void 0 || fiber3._children.size === 0) {
      return void 0;
    }
    return fiberInterruptAll(fiber3._children);
  };
  var fiberAwait = (self) => {
    const impl = self;
    if (impl._exit) return succeed3(impl._exit);
    return callback((resume) => {
      if (impl._exit) return resume(succeed3(impl._exit));
      return sync(self.addObserver((exit3) => resume(succeed3(exit3))));
    });
  };
  var fiberAwaitAll = (self) => callback((resume) => {
    const iter = self[Symbol.iterator]();
    const exits = [];
    let cancel = void 0;
    function loop() {
      let result3 = iter.next();
      while (!result3.done) {
        if (result3.value._exit) {
          exits.push(result3.value._exit);
          result3 = iter.next();
          continue;
        }
        cancel = result3.value.addObserver((exit3) => {
          exits.push(exit3);
          loop();
        });
        return;
      }
      resume(succeed3(exits));
    }
    loop();
    return sync(() => cancel?.());
  });
  var fiberJoin = (self) => {
    const impl = self;
    if (impl._exit) return impl._exit;
    return callback((resume) => {
      if (impl._exit) return resume(impl._exit);
      return sync(self.addObserver(resume));
    });
  };
  var fiberJoinAll = (self) => callback((resume) => {
    const fibers = Array.from(self);
    if (fibers.length === 0) return resume(succeed3(empty()));
    const out = new Array(fibers.length);
    const cancels = empty();
    let done4 = 0;
    let failed = false;
    for (let i = 0; i < fibers.length; i++) {
      if (failed) break;
      cancels.push(fibers[i].addObserver((exit3) => {
        done4++;
        if (exit3._tag === "Failure") {
          failed = true;
          cancels.forEach((cancel) => cancel());
          return resume(exit3);
        }
        out[i] = exit3.value;
        if (done4 === fibers.length) {
          resume(succeed3(out));
        }
      }));
    }
    return sync(() => {
      failed = true;
      cancels.forEach((cancel) => cancel());
    });
  });
  var fiberInterrupt = (self) => withFiber((fiber3) => fiberInterruptAs(self, fiber3.id));
  var fiberInterruptAs = /* @__PURE__ */ dual((args2) => hasProperty(args2[0], FiberTypeId), (self, fiberId3, annotations) => withFiber((parent) => {
    let ann = fiberStackAnnotations(parent);
    ann = ann && annotations ? merge(ann, annotations) : ann ?? annotations;
    self.interruptUnsafe(fiberId3, ann);
    return asVoid(fiberAwait(self));
  }));
  var fiberInterruptAll = (fibers) => withFiber((parent) => {
    const annotations = fiberStackAnnotations(parent);
    let fiberArr = empty();
    for (const fiber3 of fibers) {
      fiber3.interruptUnsafe(parent.id, annotations);
      fiberArr.push(fiber3);
    }
    return asVoid(fiberAwaitAll(fiberArr));
  });
  var fiberInterruptAllAs = /* @__PURE__ */ dual(2, (fibers, fiberId3) => withFiber((parent) => {
    const annotations = fiberStackAnnotations(parent);
    const fiberArr = empty();
    for (const fiber3 of fibers) {
      fiber3.interruptUnsafe(fiberId3, annotations);
      fiberArr.push(fiber3);
    }
    return asVoid(fiberAwaitAll(fiberArr));
  }));
  var succeed3 = exitSucceed;
  var failCause = exitFailCause;
  var fail3 = exitFail;
  var sync = /* @__PURE__ */ makePrimitive({
    op: "Sync",
    [evaluate](fiber3) {
      const value = this[args]();
      const cont = fiber3.getCont(contA);
      return cont ? cont[contA](value, fiber3) : fiber3.yieldWith(exitSucceed(value));
    }
  });
  var suspend = /* @__PURE__ */ makePrimitive({
    op: "Suspend",
    [evaluate](_fiber) {
      return this[args]();
    }
  });
  var fromOption2 = /* @__PURE__ */ dual((args2) => args2.length >= 2 || isOption2(args2[0]), (option3, onNone) => isNone2(option3) ? fail3(onNone ? onNone() : new NoSuchElementError("Effect.fromOption: Option.none")) : succeed3(option3.value));
  var fromResult = /* @__PURE__ */ match({
    onFailure: fail3,
    onSuccess: succeed3
  });
  var fromNullishOr = (value) => value == null ? fail3(new NoSuchElementError()) : succeed3(value);
  var yieldNowWith = /* @__PURE__ */ makePrimitive({
    op: "Yield",
    [evaluate](fiber3) {
      let resumed = false;
      fiber3.currentDispatcher.scheduleTask(() => {
        if (resumed) return;
        fiber3.evaluate(exitVoid);
      }, this[args] ?? 0);
      return fiber3.yieldWith(() => {
        resumed = true;
      });
    }
  });
  var yieldNow = /* @__PURE__ */ yieldNowWith(0);
  var succeedSome = (a) => succeed3(some2(a));
  var succeedNone = /* @__PURE__ */ succeed3(/* @__PURE__ */ none2());
  var transposeOption = (self) => isNone2(self) ? succeedNone : map(self.value, some2);
  var failCauseSync = (evaluate2) => suspend(() => failCause(internalCall(evaluate2)));
  var die = (defect) => exitDie(defect);
  var failSync = (error) => suspend(() => fail3(internalCall(error)));
  var void_ = /* @__PURE__ */ succeed3(void 0);
  var try_ = (options) => {
    const evaluate2 = typeof options === "function" ? options : options.try;
    const catcher = typeof options === "function" ? (cause) => new UnknownError(cause, "An error occurred in Effect.try") : options.catch;
    return suspend(() => {
      try {
        return succeed3(internalCall(evaluate2));
      } catch (err) {
        return fail3(internalCall(() => catcher(err)));
      }
    });
  };
  var promise = (evaluate2) => callbackOptions(function(resume, signal) {
    internalCall(() => evaluate2(signal)).then((a) => resume(succeed3(a)), (e) => resume(die(e)));
  }, evaluate2.length !== 0);
  var tryPromise = (options) => {
    const f = typeof options === "function" ? options : options.try;
    const catcher = typeof options === "function" ? (cause) => new UnknownError(cause, "An error occurred in Effect.tryPromise") : options.catch;
    return callbackOptions(function(resume, signal) {
      const failWithCatch = (cause) => {
        try {
          resume(fail3(internalCall(() => catcher(cause))));
        } catch (err) {
          resume(die(err));
        }
      };
      try {
        internalCall(() => f(signal)).then((a) => resume(succeed3(a)), failWithCatch);
      } catch (err) {
        failWithCatch(err);
      }
    }, f.length !== 0);
  };
  var withFiberId = (f) => withFiber((fiber3) => f(fiber3.id));
  var fiber = /* @__PURE__ */ withFiber(succeed3);
  var fiberId = /* @__PURE__ */ withFiberId(succeed3);
  var callbackOptions = /* @__PURE__ */ (function() {
    const Proto3 = /* @__PURE__ */ makePrimitiveProto({
      op: "Async",
      [evaluate](fiber3) {
        const register = internalCall(() => this.register.bind(fiber3.cache.scheduler));
        let resumed = false;
        let yielded = false;
        const controller = this.withSignal ? new AbortController() : void 0;
        const onCancel = register((effect) => {
          if (resumed) return;
          resumed = true;
          if (yielded) {
            fiber3.evaluate(effect);
          } else {
            yielded = effect;
          }
        }, controller?.signal);
        if (yielded !== false) return yielded;
        yielded = true;
        fiber3._yielded = () => {
          resumed = true;
        };
        if (controller === void 0 && onCancel === void 0) {
          return Yield;
        }
        fiber3._stack.push(asyncFinalizer(() => {
          resumed = true;
          controller?.abort();
          return onCancel ?? exitVoid;
        }));
        return Yield;
      }
    });
    const AsyncImpl = function(register, withSignal) {
      this.register = register;
      this.withSignal = withSignal;
    };
    AsyncImpl.prototype = Proto3;
    return function(register, withSignal) {
      return new AsyncImpl(register, withSignal);
    };
  })();
  var asyncFinalizer = /* @__PURE__ */ makePrimitive({
    op: "AsyncFinalizer",
    [contAll](fiber3) {
      if (fiber3.interruptible) {
        fiber3.interruptible = false;
        fiber3._stack.push(setInterruptibleTrue);
      }
    },
    [contE](cause, _fiber) {
      return hasInterrupts(cause) ? flatMap(this[args](), () => failCause(cause)) : failCause(cause);
    }
  });
  var callback = (register) => callbackOptions(register, register.length >= 2);
  var never = /* @__PURE__ */ callback(constVoid);
  var gen = (...args2) => {
    if (args2.length === 1) {
      const body2 = args2[0];
      return suspend(() => fromIteratorUnsafe(body2()));
    }
    const [options, body] = args2;
    return suspend(() => fromIteratorUnsafe(body.call(options.self)));
  };
  var fnUntraced = (body, ...pipeables) => {
    const fn3 = pipeables.length === 0 ? function() {
      return suspend(() => fromIteratorUnsafe(body.apply(this, arguments)));
    } : function() {
      let effect = suspend(() => fromIteratorUnsafe(body.apply(this, arguments)));
      for (let i = 0; i < pipeables.length; i++) {
        effect = pipeables[i](effect, ...arguments);
      }
      return effect;
    };
    return defineFunctionLength(body.length, fn3);
  };
  var defineFunctionLength = (length, fn3) => Object.defineProperty(fn3, "length", {
    value: length,
    configurable: true
  });
  var fnStackCleaner = /* @__PURE__ */ makeStackCleaner(2);
  var fn = function() {
    const nameFirst = typeof arguments[0] === "string";
    const name = nameFirst ? arguments[0] : "Effect.fn";
    const spanOptions = nameFirst ? arguments[1] : void 0;
    const prevLimit = getStackTraceLimit();
    let defError;
    if (prevLimit !== 0) {
      setStackTraceLimit(2);
      defError = new globalThis.Error();
      setStackTraceLimit(prevLimit);
    }
    if (nameFirst) {
      return (body, ...pipeables) => makeFn(name, body, defError, pipeables, nameFirst, spanOptions);
    }
    return makeFn(name, arguments[0], defError, Array.prototype.slice.call(arguments, 1), nameFirst, spanOptions);
  };
  var makeFn = (name, bodyOrOptions, defError, pipeables, addSpan, spanOptions) => {
    const body = typeof bodyOrOptions === "function" ? bodyOrOptions : pipeables.shift().bind(bodyOrOptions.self);
    return defineFunctionLength(body.length, function(...args2) {
      let result3 = suspend(() => {
        const iter = body.apply(this, arguments);
        return isEffect(iter) ? iter : fromIteratorUnsafe(iter);
      });
      for (let i = 0; i < pipeables.length; i++) {
        result3 = pipeables[i](result3, ...args2);
      }
      if (!isEffect(result3)) {
        return result3;
      }
      const prevLimit = getStackTraceLimit();
      let callError;
      if (prevLimit !== 0) {
        setStackTraceLimit(2);
        callError = new globalThis.Error();
        setStackTraceLimit(prevLimit);
      }
      return updateService(addSpan ? useSpan(name, spanOptions, (span) => provideParentSpan(result3, span)) : result3, CurrentStackFrame, (prev) => ({
        name,
        stack: callError ? fnStackCleaner(() => callError.stack) : constUndefined,
        parent: {
          name: `${name} (definition)`,
          stack: defError ? fnStackCleaner(() => defError.stack) : constUndefined,
          parent: prev
        }
      }));
    });
  };
  var fnUntracedEager = (body, ...pipeables) => defineFunctionLength(body.length, pipeables.length === 0 ? function() {
    return fromIteratorEagerUnsafe(() => body.apply(this, arguments));
  } : function() {
    let effect = fromIteratorEagerUnsafe(() => body.apply(this, arguments));
    for (const pipeable of pipeables) {
      effect = pipeable(effect, ...arguments);
    }
    return effect;
  });
  var fromIteratorEagerUnsafe = (evaluate2) => {
    try {
      const iterator = evaluate2();
      let value = void 0;
      while (true) {
        const state = iterator.next(value);
        if (state.done) {
          return succeed3(state.value);
        }
        const primitive = state.value;
        if (primitive && primitive._tag === "Success") {
          value = primitive.value;
          continue;
        } else if (primitive && primitive._tag === "Failure") {
          return state.value;
        } else {
          let isFirstExecution = true;
          return suspend(() => {
            if (isFirstExecution) {
              isFirstExecution = false;
              return flatMap(state.value, (value2) => fromIteratorUnsafe(iterator, value2));
            } else {
              return suspend(() => fromIteratorUnsafe(evaluate2()));
            }
          });
        }
      }
    } catch (error) {
      return die(error);
    }
  };
  var fromIteratorUnsafe = /* @__PURE__ */ (function() {
    const Proto3 = /* @__PURE__ */ makePrimitiveProto({
      op: "Iterator",
      [contA](value, fiber3) {
        const iter = this.iterator;
        while (true) {
          const state = iter.next(value);
          if (state.done) return succeed3(state.value);
          if (!effectIsExit(state.value)) {
            fiber3._stack.push(this);
            return state.value;
          } else if (state.value._tag === "Failure") {
            return state.value;
          }
          value = state.value.value;
        }
      },
      [evaluate](fiber3) {
        return this[contA](this.initial, fiber3);
      }
    });
    const IteratorImpl = function(iterator, initial) {
      this.iterator = iterator;
      this.initial = initial;
    };
    IteratorImpl.prototype = Proto3;
    return function(iterator, initial) {
      return new IteratorImpl(iterator, initial);
    };
  })();
  var as = /* @__PURE__ */ dual(2, (self, value) => new ContImpl(self, returnPayload, succeed3(value)));
  var evaluateCont = function(fiber3) {
    fiber3._stack.push(this);
    return this[args];
  };
  var OnSuccessProto = /* @__PURE__ */ makePrimitiveProto({
    op: "OnSuccess",
    [evaluate]: evaluateCont
  });
  var OnSuccessImpl = function(self, f) {
    this[args] = self;
    this[contA] = f;
  };
  OnSuccessImpl.prototype = OnSuccessProto;
  var ContImpl = function(self, cont, payload) {
    this[args] = self;
    this[contA] = cont;
    this.payload = payload;
  };
  ContImpl.prototype = OnSuccessProto;
  var returnPayload = function() {
    return this.payload;
  };
  var mapCont = function(value) {
    const f = this.payload;
    return succeed3(internalCall(() => f(value)));
  };
  var andThenCont = function(value) {
    const f = this.payload;
    return internalCall(() => f(value));
  };
  var tapCont = function(value) {
    const f = this.payload;
    return new ContImpl(internalCall(() => f(value)), returnPayload, exitSucceed(value));
  };
  var tapEffectCont = function(value) {
    return new ContImpl(this.payload, returnPayload, exitSucceed(value));
  };
  var asSome = (self) => map(self, some2);
  var flip = (self) => matchEffect(self, {
    onFailure: succeed3,
    onSuccess: fail3
  });
  var andThen = /* @__PURE__ */ dual(2, (self, f) => new ContImpl(self, isEffect(f) ? returnPayload : andThenCont, f));
  var tap = /* @__PURE__ */ dual(2, (self, f) => new ContImpl(self, isEffect(f) ? tapEffectCont : tapCont, f));
  var asVoid = (self) => new ContImpl(self, returnPayload, exitVoid);
  var sandbox = (self) => catchCause(self, fail3);
  var raceAll = (all3, options) => withFiber((parent) => callback((resume) => {
    const effects = fromIterable(all3);
    const len = effects.length;
    let doneCount = 0;
    let done4 = false;
    const fibers = /* @__PURE__ */ new Set();
    const failures = [];
    const onExit3 = (exit3, fiber3, i) => {
      doneCount++;
      if (exit3._tag === "Failure") {
        failures.push(...exit3.cause.reasons);
        if (doneCount >= len) {
          resume(failCause(causeFromReasons(failures)));
        }
        return;
      }
      const isWinner = !done4;
      done4 = true;
      resume(fibers.size === 0 ? exit3 : flatMap(uninterruptible(fiberInterruptAll(fibers)), () => exit3));
      if (isWinner && options?.onWinner) {
        options.onWinner({
          fiber: fiber3,
          index: i,
          parentFiber: parent
        });
      }
    };
    for (let i = 0; i < len; i++) {
      const fiber3 = forkUnsafe(parent, effects[i], true, true, false);
      fibers.add(fiber3);
      fiber3.addObserver((exit3) => {
        fibers.delete(fiber3);
        onExit3(exit3, fiber3, i);
      });
      if (done4) break;
    }
    return fiberInterruptAll(fibers);
  }));
  var raceAllFirst = (all3, options) => withFiber((parent) => callback((resume) => {
    let done4 = false;
    const fibers = /* @__PURE__ */ new Set();
    const onExit3 = (exit3) => {
      done4 = true;
      resume(fibers.size === 0 ? exit3 : flatMap(uninterruptible(fiberInterruptAll(fibers)), () => exit3));
    };
    let i = 0;
    for (const effect of all3) {
      if (done4) break;
      const index = i++;
      const fiber3 = forkUnsafe(parent, effect, true, true, false);
      fibers.add(fiber3);
      fiber3.addObserver((exit3) => {
        fibers.delete(fiber3);
        const isWinner = !done4;
        onExit3(exit3);
        if (isWinner && options?.onWinner) {
          options.onWinner({
            fiber: fiber3,
            index,
            parentFiber: parent
          });
        }
      });
    }
    return fiberInterruptAll(fibers);
  }));
  var race = /* @__PURE__ */ dual((args2) => isEffect(args2[1]), (self, that, options) => raceAll([self, that], options));
  var raceFirst = /* @__PURE__ */ dual((args2) => isEffect(args2[1]), (self, that, options) => raceAllFirst([self, that], options));
  var flatMap = /* @__PURE__ */ dual(2, (self, f) => new OnSuccessImpl(self, f.length !== 1 ? (a) => f(a) : f));
  var matchCauseEffectEager = /* @__PURE__ */ dual(2, (self, options) => {
    if (effectIsExit(self)) {
      return self._tag === "Success" ? options.onSuccess(self.value) : options.onFailure(self.cause);
    }
    return matchCauseEffect(self, options);
  });
  var effectIsExit = (effect) => effect[ExitTypeId] !== void 0;
  var flatMapEager = /* @__PURE__ */ dual(2, (self, f) => {
    if (effectIsExit(self)) {
      return self._tag === "Success" ? f(self.value) : self;
    }
    return flatMap(self, f);
  });
  var flatten2 = (self) => flatMap(self, identity);
  var map = /* @__PURE__ */ dual(2, (self, f) => new ContImpl(self, mapCont, f));
  var mapEager = /* @__PURE__ */ dual(2, (self, f) => effectIsExit(self) ? exitMap(self, f) : map(self, f));
  var mapErrorEager = /* @__PURE__ */ dual(2, (self, f) => effectIsExit(self) ? exitMapError(self, f) : mapError(self, f));
  var mapBothEager = /* @__PURE__ */ dual(2, (self, options) => effectIsExit(self) ? exitMapBoth(self, options) : mapBoth(self, options));
  var catchEager = /* @__PURE__ */ dual(2, (self, f) => {
    if (effectIsExit(self)) {
      if (self._tag === "Success") return self;
      const error = findError(self.cause);
      if (isFailure2(error)) return self;
      return f(error.success);
    }
    return catch_(self, f);
  });
  var exitInterrupt = (fiberId3) => exitFailCause(causeInterrupt(fiberId3));
  var exitIsSuccess = (self) => self._tag === "Success";
  var exitIsFailure = (self) => self._tag === "Failure";
  var exitFilterCause = (self) => self._tag === "Failure" ? succeed2(self.cause) : fail2(self);
  var exitVoid = /* @__PURE__ */ exitSucceed(void 0);
  var exitMap = /* @__PURE__ */ dual(2, (self, f) => self._tag === "Success" ? exitSucceed(f(self.value)) : self);
  var exitMapError = /* @__PURE__ */ dual(2, (self, f) => {
    if (self._tag === "Success") return self;
    const error = findError(self.cause);
    if (isFailure2(error)) return self;
    return exitFail(f(error.success));
  });
  var exitMapBoth = /* @__PURE__ */ dual(2, (self, options) => {
    if (self._tag === "Success") return exitSucceed(options.onSuccess(self.value));
    const error = findError(self.cause);
    if (isFailure2(error)) return self;
    return exitFail(options.onFailure(error.success));
  });
  var exitZipRight = /* @__PURE__ */ dual(2, (self, that) => exitIsSuccess(self) ? that : self);
  var exitAsVoidAll = (exits) => {
    const failures = [];
    for (const exit3 of exits) {
      if (exit3._tag === "Failure") {
        failures.push(...exit3.cause.reasons);
      }
    }
    return failures.length === 0 ? exitVoid : exitFailCause(causeFromReasons(failures));
  };
  var service = (service3) => service3;
  var serviceOption = (service3) => withFiber((fiber3) => succeed3(getOption(fiber3.context, service3)));
  var serviceOptional = (service3) => withFiber((fiber3) => fromOption2(getOption(fiber3.context, service3)));
  var updateContext = /* @__PURE__ */ dual(2, (self, f) => withFiber((fiber3) => {
    const prevContext = fiber3.context;
    const nextContext = f(prevContext);
    if (prevContext === nextContext) return self;
    fiber3.setContext(nextContext);
    return onExitPrimitive(self, () => {
      fiber3.setContext(prevContext);
      return void 0;
    });
  }));
  var updateService = /* @__PURE__ */ dual(3, (self, service3, f) => updateContext(self, (s) => {
    const prev = getUnsafe(s, service3);
    const next = f(prev);
    if (prev === next) return s;
    return add(s, service3, next);
  }));
  var updateServiceScoped = (service3, update2, options) => uninterruptible(withFiber((fiber3) => {
    const original = getUnsafe(fiber3.context, service3);
    const updated = update2(original);
    fiber3.setContext(add(fiber3.context, service3, updated));
    return scopeAddFinalizerExit(getUnsafe(fiber3.context, scopeTag), (_) => {
      const currentOption = getOption(fiber3.context, service3);
      if (isNone2(currentOption)) return void_;
      const current = currentOption.value;
      let next;
      if (options?.reset === void 0) {
        if (current !== updated) return void_;
        next = original;
      } else {
        next = options.reset(original, updated, current);
      }
      fiber3.setContext(add(fiber3.context, service3, next));
      return void_;
    });
  }));
  var context = () => getContext;
  var getContext = /* @__PURE__ */ withFiber((fiber3) => succeed3(fiber3.context));
  var contextWith = (f) => withFiber((fiber3) => f(fiber3.context));
  var setContext = /* @__PURE__ */ dual(2, (self, context3) => updateContext(self, constant(context3)));
  var provideContext = /* @__PURE__ */ dual(2, (self, context3) => {
    if (effectIsExit(self)) return self;
    return updateContext(self, merge(context3));
  });
  var provideService = function() {
    if (arguments.length === 1) {
      return dual(2, (self, impl) => provideServiceImpl(self, arguments[0], impl));
    }
    return dual(3, (self, service3, impl) => provideServiceImpl(self, service3, impl)).apply(this, arguments);
  };
  var provideServiceImpl = (self, service3, implementation) => updateContext(self, add(service3, implementation));
  var provideServiceEffect = /* @__PURE__ */ dual(3, (self, service3, acquire) => flatMap(acquire, (implementation) => provideService(self, service3, implementation)));
  var zip = /* @__PURE__ */ dual((args2) => isEffect(args2[1]), (self, that, options) => zipWith(self, that, (a, a2) => [a, a2], options));
  var zipWith = /* @__PURE__ */ dual((args2) => isEffect(args2[1]), (self, that, f, options) => options?.concurrent ? map(all([self, that], {
    concurrency: 2
  }), ([a, a2]) => internalCall(() => f(a, a2))) : flatMap(self, (a) => map(that, (a2) => internalCall(() => f(a, a2)))));
  var filterOrFail = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, predicate, orFailWith) => filterOrElse(self, predicate, orFailWith ? (a) => fail3(orFailWith(a)) : () => fail3(new NoSuchElementError())));
  var when = /* @__PURE__ */ dual(2, (self, condition) => flatMap(condition, (pass) => pass ? asSome(self) : succeedNone));
  var replicate = /* @__PURE__ */ dual(2, (self, n) => Array.from({
    length: n
  }, () => self));
  var replicateEffect = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, n, options) => all(replicate(self, n), options));
  var forever = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, options) => whileLoop({
    while: constTrue,
    body: constant(options?.disableYield ? self : flatMap(self, (_) => yieldNow)),
    step: constVoid
  }));
  var catchCause = /* @__PURE__ */ dual(2, (self, f) => new OnFailureImpl(self, f.length !== 1 ? (cause) => f(cause) : f));
  var OnFailureProto = /* @__PURE__ */ makePrimitiveProto({
    op: "OnFailure",
    [evaluate]: evaluateCont
  });
  var OnFailureImpl = function(self, f) {
    this[args] = self;
    this[contE] = f;
  };
  OnFailureImpl.prototype = OnFailureProto;
  var catchCauseIf = /* @__PURE__ */ dual(3, (self, predicate, f) => catchCause(self, (cause) => {
    if (!predicate(cause)) {
      return failCause(cause);
    }
    return internalCall(() => f(cause));
  }));
  var catchCauseFilter = /* @__PURE__ */ dual(3, (self, filter4, f) => catchCause(self, (cause) => {
    const eb = filter4(cause);
    return isFailure2(eb) ? failCause(eb.failure) : internalCall(() => f(eb.success, cause));
  }));
  var catch_ = /* @__PURE__ */ dual(2, (self, f) => catchCauseFilter(self, findError, (e) => f(e)));
  var catchNoSuchElement = (self) => matchEffect(self, {
    onFailure: (error) => isNoSuchElementError(error) ? succeedNone : fail3(error),
    onSuccess: succeedSome
  });
  var catchDefect = /* @__PURE__ */ dual(2, (self, f) => catchCauseFilter(self, findDefect, f));
  var tapCause = /* @__PURE__ */ dual(2, (self, f) => catchCause(self, (cause) => andThen(internalCall(() => f(cause)), failCause(cause))));
  var tapCauseIf = /* @__PURE__ */ dual(3, (self, predicate, f) => catchCauseIf(self, predicate, (cause) => andThen(internalCall(() => f(cause)), failCause(cause))));
  var tapCauseFilter = /* @__PURE__ */ dual(3, (self, filter4, f) => catchCause(self, (cause) => {
    const result3 = filter4(cause);
    if (isFailure2(result3)) {
      return failCause(cause);
    }
    return andThen(internalCall(() => f(result3.success, cause)), failCause(cause));
  }));
  var tapError = /* @__PURE__ */ dual(2, (self, f) => tapCauseFilter(self, findError, (e) => f(e)));
  var tapErrorTag = /* @__PURE__ */ dual(3, (self, k, f) => {
    const predicate = Array.isArray(k) ? (e) => hasProperty(e, "_tag") && k.includes(e._tag) : isTagged(k);
    return tapError(self, (error) => predicate(error) ? f(error) : void_);
  });
  var tapDefect = /* @__PURE__ */ dual(2, (self, f) => tapCauseFilter(self, findDefect, (_) => f(_)));
  var catchIf = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, predicate, f, orElse) => catchCause(self, (cause) => {
    const error = findError(cause);
    if (isFailure2(error)) return failCause(error.failure);
    if (!predicate(error.success)) {
      return orElse ? internalCall(() => orElse(error.success)) : failCause(cause);
    }
    return internalCall(() => f(error.success));
  }));
  var catchFilter = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, filter4, f, orElse) => catchCause(self, (cause) => {
    const error = findError(cause);
    if (isFailure2(error)) return failCause(error.failure);
    const result3 = filter4(error.success);
    if (isFailure2(result3)) {
      return orElse ? internalCall(() => orElse(result3.failure)) : failCause(cause);
    }
    return internalCall(() => f(result3.success));
  }));
  var catchTag = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, k, f, orElse) => {
    const pred = Array.isArray(k) ? (e) => hasProperty(e, "_tag") && k.includes(e._tag) : isTagged(k);
    return catchIf(self, pred, f, orElse);
  });
  var catchTags = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, cases, orElse) => {
    let keys;
    return catchFilter(self, (e) => {
      keys ??= Object.keys(cases);
      return hasProperty(e, "_tag") && isString(e["_tag"]) && keys.includes(e["_tag"]) ? succeed2(e) : fail2(e);
    }, (e) => internalCall(() => cases[e["_tag"]](e)), orElse);
  });
  var catchReason = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, errorTag, reasonTag, f, orElse) => catchIf(self, (e) => isTagged(e, errorTag) && hasProperty(e, "reason") && (orElse !== void 0 || isTagged(e.reason, reasonTag)), (e) => {
    const reason = e.reason;
    if (isTagged(reason, reasonTag)) return f(reason, e);
    return orElse ? internalCall(() => orElse(reason, e)) : fail3(e);
  }));
  var catchReasons = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, errorTag, cases, orElse) => {
    let keys;
    return catchIf(self, (e) => isTagged(e, errorTag) && hasProperty(e, "reason") && hasProperty(e.reason, "_tag") && isString(e.reason._tag) && (orElse !== void 0 || (keys ??= Object.keys(cases)).includes(e.reason._tag)), (e) => {
      const reason = e.reason;
      keys ??= Object.keys(cases);
      if (keys.includes(reason._tag)) {
        return internalCall(() => cases[reason._tag](reason, e));
      }
      return orElse ? internalCall(() => orElse(reason, e)) : fail3(e);
    });
  });
  var unwrapReason = /* @__PURE__ */ dual(2, (self, errorTag) => catchFilter(self, (e) => {
    if (isTagged(e, errorTag) && hasProperty(e, "reason")) {
      return succeed2(e.reason);
    }
    return fail2(e);
  }, fail3));
  var mapError = /* @__PURE__ */ dual(2, (self, f) => catch_(self, (error) => failSync(() => f(error))));
  var mapBoth = /* @__PURE__ */ dual(2, (self, options) => matchEffect(self, {
    onFailure: (e) => failSync(() => options.onFailure(e)),
    onSuccess: (a) => sync(() => options.onSuccess(a))
  }));
  var orDie = (self) => catch_(self, die);
  var orElseSucceed = /* @__PURE__ */ dual(2, (self, f) => catch_(self, (_) => sync(f)));
  var firstSuccessOf = (effects) => suspend(() => {
    const iterator = effects[Symbol.iterator]();
    let state = iterator.next();
    if (state.done) {
      return die(new Error("Received an empty collection of effects"));
    }
    function loop(current) {
      const next = iterator.next();
      if (next.done) return current.value;
      return catch_(current.value, (_) => loop(next));
    }
    return loop(state);
  });
  var eventually = (self) => catch_(self, (_) => flatMap(yieldNow, () => eventually(self)));
  var ignore = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, options) => {
    if (!options?.log) {
      return matchEffect(self, {
        onFailure: (_) => void_,
        onSuccess: (_) => void_
      });
    }
    const logEffect = logWithLevel(options.log === true ? void 0 : options.log);
    return matchCauseEffect(self, {
      onFailure(cause) {
        const failure = findFail(cause);
        return isFailure2(failure) ? failCause(failure.failure) : options.message === void 0 ? logEffect(cause) : logEffect(options.message, cause);
      },
      onSuccess: (_) => void_
    });
  });
  var ignoreCause = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, options) => {
    if (!options?.log) {
      return matchCauseEffect(self, {
        onFailure: (_) => void_,
        onSuccess: (_) => void_
      });
    }
    const logEffect = logWithLevel(options.log === true ? void 0 : options.log);
    return matchCauseEffect(self, {
      onFailure: (cause) => options.message === void 0 ? logEffect(cause) : logEffect(options.message, cause),
      onSuccess: (_) => void_
    });
  });
  var option = (self) => match3(self, {
    onFailure: none2,
    onSuccess: some2
  });
  var result = (self) => matchEager(self, {
    onFailure: fail2,
    onSuccess: succeed2
  });
  var matchCauseEffect = /* @__PURE__ */ dual(2, (self, options) => new OnSuccessAndFailureImpl(self, options.onSuccess.length !== 1 ? (a) => options.onSuccess(a) : options.onSuccess, options.onFailure.length !== 1 ? (cause) => options.onFailure(cause) : options.onFailure));
  var OnSuccessAndFailureProto = /* @__PURE__ */ makePrimitiveProto({
    op: "OnSuccessAndFailure",
    [evaluate]: evaluateCont
  });
  var OnSuccessAndFailureImpl = function(self, onSuccess, onFailure) {
    this[args] = self;
    this[contA] = onSuccess;
    this[contE] = onFailure;
  };
  OnSuccessAndFailureImpl.prototype = OnSuccessAndFailureProto;
  var matchCause = /* @__PURE__ */ dual(2, (self, options) => matchCauseEffect(self, {
    onFailure: (cause) => sync(() => options.onFailure(cause)),
    onSuccess: (value) => sync(() => options.onSuccess(value))
  }));
  var matchEffect = /* @__PURE__ */ dual(2, (self, options) => matchCauseEffect(self, {
    onFailure: (cause) => {
      const fail6 = cause.reasons.find(isFailReason);
      return fail6 ? internalCall(() => options.onFailure(fail6.error)) : failCause(cause);
    },
    onSuccess: options.onSuccess
  }));
  var match3 = /* @__PURE__ */ dual(2, (self, options) => matchEffect(self, {
    onFailure: (error) => sync(() => options.onFailure(error)),
    onSuccess: (value) => sync(() => options.onSuccess(value))
  }));
  var matchEager = /* @__PURE__ */ dual(2, (self, options) => {
    if (effectIsExit(self)) {
      if (self._tag === "Success") return exitSucceed(options.onSuccess(self.value));
      const error = findError(self.cause);
      if (isFailure2(error)) return self;
      return exitSucceed(options.onFailure(error.success));
    }
    return match3(self, options);
  });
  var matchCauseEager = /* @__PURE__ */ dual(2, (self, options) => {
    if (effectIsExit(self)) {
      if (self._tag === "Success") return exitSucceed(options.onSuccess(self.value));
      return exitSucceed(options.onFailure(self.cause));
    }
    return matchCause(self, options);
  });
  var exit = (self) => effectIsExit(self) ? exitSucceed(self) : exitPrimitive(self);
  var exitPrimitive = /* @__PURE__ */ makePrimitive({
    op: "Exit",
    [evaluate](fiber3) {
      fiber3._stack.push(this);
      return this[args];
    },
    [contA](value, _, exit3) {
      return succeed3(exit3 ?? exitSucceed(value));
    },
    [contE](cause, _, exit3) {
      return succeed3(exit3 ?? exitFailCause(cause));
    }
  });
  var isFailure3 = /* @__PURE__ */ matchEager({
    onFailure: () => true,
    onSuccess: () => false
  });
  var isSuccess3 = /* @__PURE__ */ matchEager({
    onFailure: () => false,
    onSuccess: () => true
  });
  var delay = /* @__PURE__ */ dual(2, (self, duration) => andThen(sleep(duration), self));
  var timeoutOrElse = /* @__PURE__ */ dual(2, (self, options) => flatMap(timeoutOption(self, options.duration), (option3) => isNone2(option3) ? options.orElse() : succeed3(option3.value)));
  var timeoutErrorFromDuration = (duration) => new TimeoutError(`Operation timed out after '${format2(duration)}'`);
  var timeout = /* @__PURE__ */ dual(2, (self, duration) => {
    const decoded = fromInputUnsafe(duration);
    return timeoutOrElse(self, {
      duration: decoded,
      orElse: () => fail3(timeoutErrorFromDuration(decoded))
    });
  });
  var timeoutOption = /* @__PURE__ */ dual(2, (self, duration) => raceFirst(asSome(self), as(sleep(duration), none2())));
  var timed = (self) => clockWith((clock) => {
    const start = clock.monotonicTimeNanosUnsafe();
    return map(self, (a) => [nanos(clock.monotonicTimeNanosUnsafe() - start), a]);
  });
  var ScopeTypeId = "~effect/Scope";
  var ScopeCloseableTypeId = "~effect/Scope/Closeable";
  var scopeTag = /* @__PURE__ */ Service("effect/Scope");
  var scopeClose = (self, exit_) => suspend(() => scopeCloseUnsafe(self, exit_) ?? void_);
  var scopeCloseUnsafe = (self, exit_) => {
    if (self.state._tag === "Closed") return;
    const closed = {
      _tag: "Closed",
      exit: exit_
    };
    if (self.state._tag === "Empty") {
      self.state = closed;
      return;
    }
    const state = self.state;
    self.state = closed;
    if (state.finalizer !== void 0) {
      return state.finalizer(exit_);
    }
    const finalizers = state.finalizers;
    if (finalizers === void 0 || finalizers.size === 0) {
      return;
    } else if (finalizers.size === 1) {
      return finalizers.values().next().value(exit_);
    }
    return scopeCloseFinalizers(self, finalizers, exit_);
  };
  var combineFinalizerCause = (exit_, finalizer) => exitIsSuccess(exit_) ? finalizer : catchCause(finalizer, (cause) => failCause(causeCombine(exit_.cause, cause)));
  var scopeCloseFinalizers = /* @__PURE__ */ fnUntraced(function* (self, finalizers, exit_) {
    let exits = [];
    const fibers = [];
    const arr = Array.from(finalizers.values());
    const parent = getCurrentFiber();
    for (let i = arr.length - 1; i >= 0; i--) {
      const finalizer = arr[i];
      if (self.strategy === "sequential") {
        exits.push(yield* exit(finalizer(exit_)));
      } else {
        fibers.push(forkUnsafe(parent, finalizer(exit_), true, true, "inherit"));
      }
    }
    if (fibers.length > 0) {
      exits = yield* fiberAwaitAll(fibers);
    }
    return yield* exitAsVoidAll(exits);
  });
  var scopeForkUnsafe = (scope3, finalizerStrategy) => {
    const newScope = scopeMakeUnsafe(finalizerStrategy);
    if (scope3.state._tag === "Closed") {
      newScope.state = scope3.state;
      return newScope;
    }
    const key = {};
    scopeAddFinalizerUnsafe(scope3, key, (exit3) => scopeClose(newScope, exit3));
    scopeAddFinalizerUnsafe(newScope, key, (_) => sync(() => scopeRemoveFinalizerUnsafe(scope3, key)));
    return newScope;
  };
  var scopeAddFinalizerExit = (scope3, finalizer) => {
    return suspend(() => {
      if (scope3.state._tag === "Closed") {
        return finalizer(scope3.state.exit);
      }
      scopeAddFinalizerUnsafe(scope3, {}, finalizer);
      return void_;
    });
  };
  var scopeAddFinalizerUnsafe = (scope3, key, finalizer) => {
    if (scope3.state._tag === "Empty") {
      scope3.state = {
        _tag: "Open",
        finalizerKey: key,
        finalizer,
        finalizers: void 0
      };
    } else if (scope3.state._tag === "Open") {
      const state = scope3.state;
      if (state.finalizer !== void 0) {
        state.finalizers = /* @__PURE__ */ new Map([[state.finalizerKey, state.finalizer]]);
        state.finalizerKey = void 0;
        state.finalizer = void 0;
        state.finalizers.set(key, finalizer);
      } else if (state.finalizers === void 0) {
        state.finalizerKey = key;
        state.finalizer = finalizer;
      } else {
        state.finalizers.set(key, finalizer);
      }
    }
  };
  var scopeRemoveFinalizerUnsafe = (scope3, key) => {
    if (scope3.state._tag === "Open") {
      const state = scope3.state;
      if (state.finalizerKey === key) {
        state.finalizerKey = void 0;
        state.finalizer = void 0;
      } else if (state.finalizers !== void 0) {
        state.finalizers.delete(key);
      }
    }
  };
  var scopeMakeUnsafe = (finalizerStrategy = "sequential") => ({
    [ScopeCloseableTypeId]: ScopeCloseableTypeId,
    [ScopeTypeId]: ScopeTypeId,
    strategy: finalizerStrategy,
    state: constScopeEmpty
  });
  var constScopeEmpty = {
    _tag: "Empty"
  };
  var scope = scopeTag;
  var scoped = (self) => withFiber((fiber3) => {
    const prev = fiber3.context;
    const scope3 = scopeMakeUnsafe();
    fiber3.setContext(add(fiber3.context, scopeTag, scope3));
    return onExitPrimitive(self, (exit3) => {
      fiber3.setContext(prev);
      return scopeCloseUnsafe(scope3, exit3);
    });
  });
  var scopedWith = (f) => suspend(() => {
    const scope3 = scopeMakeUnsafe();
    return onExit(f(scope3), (exit3) => suspend(() => scopeCloseUnsafe(scope3, exit3) ?? void_));
  });
  var acquireRelease = (acquire, release, options) => contextWith((context3) => uninterruptibleMask((restore) => flatMap(scope, (scope3) => tap(options?.interruptible ? restore(acquire) : acquire, (a) => scopeAddFinalizerExit(scope3, (exit3) => provideContext(release(a, exit3), context3))))));
  var addFinalizer = (finalizer) => flatMap(scope, (scope3) => contextWith((context3) => scopeAddFinalizerExit(scope3, (exit3) => provideContext(finalizer(exit3), context3))));
  var onExitPrimitive = /* @__PURE__ */ (function() {
    const Proto3 = /* @__PURE__ */ makePrimitiveProto({
      op: "OnExit",
      [evaluate](fiber3) {
        fiber3._stack.push(this);
        return this.effect;
      },
      [contAll](fiber3) {
        if (fiber3.interruptible && this.interruptible !== true) {
          fiber3._stack.push(setInterruptibleTrue);
          fiber3.interruptible = false;
        }
      },
      [contA](value, _, exit3) {
        exit3 ??= exitSucceed(value);
        const eff = this.onExit(exit3);
        return eff ? flatMap(eff, (_2) => exit3) : exit3;
      },
      [contE](cause, _, exit3) {
        exit3 ??= exitFailCause(cause);
        const eff = this.onExit(exit3);
        return eff ? flatMap(combineFinalizerCause(exit3, eff), (_2) => exit3) : exit3;
      }
    });
    const OnExitImpl = function(effect, onExit3, interruptible3) {
      this.effect = effect;
      this.onExit = onExit3;
      this.interruptible = interruptible3;
    };
    OnExitImpl.prototype = Proto3;
    return function(effect, onExit3, interruptible3) {
      return new OnExitImpl(effect, onExit3, interruptible3);
    };
  })();
  var onExit = /* @__PURE__ */ dual(2, onExitPrimitive);
  var ensuring = /* @__PURE__ */ dual(2, (self, finalizer) => onExit(self, (_) => finalizer));
  var onExitIf = /* @__PURE__ */ dual(3, (self, predicate, f) => onExit(self, (exit3) => {
    if (!predicate(exit3)) {
      return void_;
    }
    return f(exit3);
  }));
  var onExitFilter = /* @__PURE__ */ dual(3, (self, filter4, f) => onExit(self, (exit3) => {
    const b = filter4(exit3);
    return isFailure2(b) ? void_ : f(b.success, exit3);
  }));
  var onError = /* @__PURE__ */ dual(2, (self, f) => onExitFilter(self, exitFilterCause, f));
  var onErrorIf = /* @__PURE__ */ dual(3, (self, predicate, f) => onExitIf(self, (exit3) => {
    if (exit3._tag !== "Failure") {
      return false;
    }
    return predicate(exit3.cause);
  }, (exit3) => f(exit3.cause)));
  var onErrorFilter = /* @__PURE__ */ dual(3, (self, filter4, f) => onExit(self, (exit3) => {
    if (exit3._tag !== "Failure") {
      return void_;
    }
    const result3 = filter4(exit3.cause);
    return isFailure2(result3) ? void_ : f(result3.success, exit3.cause);
  }));
  var onInterrupt = /* @__PURE__ */ dual(2, (self, finalizer) => onErrorFilter(causeFilterInterruptors, finalizer)(self));
  var acquireUseRelease = (acquire, use, release) => uninterruptibleMask((restore) => flatMap(acquire, (a) => onExitPrimitive(suspend(() => restore(use(a))), (exit3) => release(a, exit3), true)));
  var acquireDisposable = (acquire) => acquireRelease(acquire, (resource) => hasProperty(resource, Symbol.asyncDispose) ? promise(() => resource[Symbol.asyncDispose]()) : sync(() => resource[Symbol.dispose]()));
  var cachedInvalidateWithTTL = /* @__PURE__ */ dual(2, (self, ttl) => sync(() => {
    const ttlMillis = typeof ttl === "function" ? (exit4) => toMillis(fromInputUnsafe(ttl(exit4))) : constant(toMillis(fromInputUnsafe(ttl)));
    const latch = makeLatchUnsafe(false);
    let expiresAt = 0;
    let running = false;
    let exit3;
    const wait = flatMap(latch.await, () => exit3);
    return [withFiber((fiber3) => {
      const clock = fiber3.getRef(ClockRef);
      const now = expiresAt === Infinity ? 0 : clock.currentTimeMillisUnsafe();
      if (running || now < expiresAt) return exit3 ?? wait;
      running = true;
      latch.closeUnsafe();
      exit3 = void 0;
      return onExit(self, (exit_) => sync(() => {
        try {
          const duration = ttlMillis(exit_);
          expiresAt = clock.currentTimeMillisUnsafe() + duration;
          exit3 = exit_;
        } catch (error) {
          const cause = causeDie(error);
          exit3 = exitFailCause(exitIsFailure(exit_) ? causeCombine(exit_.cause, cause) : cause);
          throw error;
        } finally {
          running = false;
          latch.openUnsafe();
        }
      }));
    }), sync(() => {
      expiresAt = 0;
      latch.closeUnsafe();
      exit3 = void 0;
    })];
  }));
  var cachedWithTTL = /* @__PURE__ */ dual(2, (self, timeToLive) => map(cachedInvalidateWithTTL(self, timeToLive), (tuple) => tuple[0]));
  var cached = (self) => sync(() => {
    const latch = makeLatchUnsafe(false);
    let started = false;
    let exit3;
    const wait = flatMap(latch.await, () => exit3);
    return suspend(() => {
      if (exit3 !== void 0) return exit3;
      if (started) return wait;
      started = true;
      return onExit(self, (result3) => sync(() => {
        exit3 = result3;
        latch.openUnsafe();
      }));
    });
  });
  var interrupt = /* @__PURE__ */ withFiber((fiber3) => failCause(causeInterrupt(fiber3.id)));
  var uninterruptible = (self) => withFiber((fiber3) => {
    if (!fiber3.interruptible) return self;
    fiber3.interruptible = false;
    fiber3._stack.push(setInterruptibleTrue);
    return self;
  });
  var setInterruptible = /* @__PURE__ */ makePrimitive({
    op: "SetInterruptible",
    [contAll](fiber3) {
      fiber3.interruptible = this[args];
      if (fiber3._interruptedCause && fiber3.interruptible) {
        return () => failCause(fiber3._interruptedCause);
      }
    }
  });
  var setInterruptibleTrue = /* @__PURE__ */ setInterruptible(true);
  var setInterruptibleFalse = /* @__PURE__ */ setInterruptible(false);
  var setFiberInterruptible = (fiber3) => {
    fiber3.interruptible = true;
    fiber3._stack.push(setInterruptibleFalse);
    if (fiber3._interruptedCause) return failCause(fiber3._interruptedCause);
  };
  var interruptible = (self) => withFiber((fiber3) => {
    if (fiber3.interruptible) return self;
    return setFiberInterruptible(fiber3) ?? self;
  });
  var uninterruptibleMask = (f) => withFiber((fiber3) => {
    if (!fiber3.interruptible) return f(identity);
    fiber3.interruptible = false;
    fiber3._stack.push(setInterruptibleTrue);
    return f(interruptible);
  });
  var interruptibleMask = (f) => withFiber((fiber3) => {
    if (fiber3.interruptible) return f(identity);
    const interrupted = setFiberInterruptible(fiber3);
    const effect = f(uninterruptible);
    return interrupted ?? effect;
  });
  var abortSignal = /* @__PURE__ */ map(/* @__PURE__ */ acquireRelease(/* @__PURE__ */ sync(() => new AbortController()), (controller) => sync(() => controller.abort())), (_) => _.signal);
  var all = (arg, options) => {
    if (isIterable(arg)) {
      return options?.mode === "result" ? forEach(arg, result, options) : forEach(arg, identity, options);
    } else if (options?.discard) {
      return options.mode === "result" ? forEach(Object.values(arg), result, options) : forEach(Object.values(arg), identity, options);
    }
    return suspend(() => {
      const out = {};
      return as(forEach(Object.entries(arg), ([key, effect]) => map(options?.mode === "result" ? result(effect) : effect, (value) => {
        assignProperty(out, key, value);
      }), {
        discard: true,
        concurrency: options?.concurrency
      }), out);
    });
  };
  var partition2 = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, f, options) => map(forEach(elements, (a, i) => result(f(a, i)), options), (results) => partition(results, identity)));
  var reduce = /* @__PURE__ */ dual(3, (elements, zero2, f) => {
    const arr = fromIterable(elements);
    if (arr.length === 0) return sync(zero2);
    return suspend(() => {
      let index = 0;
      let state = zero2();
      return map(whileLoop({
        while: () => index < arr.length,
        body: () => f(state, arr[index], index),
        step(next) {
          state = next;
          index++;
        }
      }), () => state);
    });
  });
  var validate = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, f, options) => flatMap(partition2(elements, f, {
    concurrency: options?.concurrency
  }), ([excluded, satisfying]) => {
    if (isArrayNonEmpty2(excluded)) {
      return fail3(excluded);
    }
    return options?.discard ? void_ : succeed3(satisfying);
  }));
  var findFirst = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, predicate) => suspend(() => {
    const iterator = elements[Symbol.iterator]();
    const next = iterator.next();
    if (!next.done) {
      return findFirstLoop(iterator, 0, predicate, next.value);
    }
    return succeed3(none2());
  }));
  var findFirstLoop = (iterator, index, predicate, value) => flatMap(predicate(value, index), (keep) => {
    if (keep) {
      return succeed3(some2(value));
    }
    const next = iterator.next();
    if (!next.done) {
      return findFirstLoop(iterator, index + 1, predicate, next.value);
    }
    return succeed3(none2());
  });
  var findFirstFilter = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, filter4) => suspend(() => {
    const iterator = elements[Symbol.iterator]();
    const next = iterator.next();
    if (!next.done) {
      return findFirstFilterLoop(iterator, 0, filter4, next.value);
    }
    return succeed3(none2());
  }));
  var findFirstFilterLoop = (iterator, index, filter4, value) => flatMap(filter4(value, index), (result3) => {
    if (isSuccess2(result3)) {
      return succeed3(some2(result3.success));
    }
    const next = iterator.next();
    if (!next.done) {
      return findFirstFilterLoop(iterator, index + 1, filter4, next.value);
    }
    return succeed3(none2());
  });
  var whileLoop = /* @__PURE__ */ makePrimitive({
    op: "While",
    [contA](value, fiber3) {
      this[args].step(value);
      if (this[args].while()) {
        fiber3._stack.push(this);
        return this[args].body();
      }
      return exitVoid;
    },
    [evaluate](fiber3) {
      if (this[args].while()) {
        fiber3._stack.push(this);
        return this[args].body();
      }
      return exitVoid;
    }
  });
  var forEach = /* @__PURE__ */ dual((args2) => typeof args2[1] === "function", (iterable, f, options) => suspend(() => {
    const concurrency = resolveConcurrency(options?.concurrency);
    if (concurrency === 1) {
      return forEachSequential(iterable, f, options);
    }
    const items = fromIterable(iterable);
    let length = items.length;
    if (length === 0) {
      return options?.discard ? void_ : succeed3([]);
    }
    const out = options?.discard ? void 0 : new Array(length);
    const eff = forEachConcurrent({
      f,
      out
    }, items, {
      concurrency
    });
    return eff ? as(eff, out) : succeed3(out);
  }));
  var head = (self) => flatMap(self, (elements) => {
    const result3 = elements[Symbol.iterator]().next();
    return result3.done ? fail3(new NoSuchElementError()) : succeed3(result3.value);
  });
  var forEachSequential = (iterable, f, options) => suspend(() => {
    const out = options?.discard ? void 0 : [];
    const iterator = iterable[Symbol.iterator]();
    let state = iterator.next();
    let index = 0;
    return as(whileLoop({
      while: () => !state.done,
      body: () => f(state.value, index++),
      step: (b) => {
        if (out) out.push(b);
        state = iterator.next();
      }
    }), out);
  });
  var resolveConcurrency = (concurrency) => concurrency === "unbounded" ? Number.POSITIVE_INFINITY : Math.max(1, concurrency ?? 1);
  var iterateConcurrentImpl = (options) => {
    const onItem = options.onItem;
    const step = options.step;
    return (state, items, opts) => {
      let index = 0;
      const end2 = opts.end ?? items.length;
      const concurrency = opts.concurrency;
      let done4 = false;
      let parentFiber;
      let fibers;
      let resume;
      let interrupted = false;
      let terminal;
      let effect;
      const failDefect = (error) => {
        const defect = exitDie(error);
        terminal = defect;
        done4 = true;
        interrupted = true;
        return fibers && fibers.size > 0 ? flatMap(uninterruptible(fiberInterruptAll(Array.from(fibers))), () => defect) : defect;
      };
      const go = () => {
        let paused = false;
        for (; !terminal && index < end2; index++) {
          const item = items[index];
          const eff = effect ?? onItem(state, item, index);
          if (effectIsExit(eff)) {
            terminal = step(state, item, eff, index);
            if (terminal) break;
          } else if (!parentFiber) {
            return callback((cb) => {
              parentFiber = getCurrentFiber();
              fibers = /* @__PURE__ */ new Set();
              effect = eff;
              resume = cb;
              let result3;
              try {
                result3 = go();
              } catch (error) {
                return cb(failDefect(error));
              }
              if (result3) return cb(result3);
              return suspend(() => {
                terminal = exitVoid;
                interrupted = true;
                return fibers ? fiberInterruptAll(fibers) : void_;
              });
            });
          } else {
            effect = void 0;
            const fiber3 = forkUnsafe(parentFiber, eff, true, true, "inherit");
            if (fiber3._exit) {
              terminal = step(state, item, fiber3._exit, index);
              if (terminal) break;
              continue;
            }
            fibers.add(fiber3);
            const currentIndex = index;
            fiber3.addObserver((exit3) => {
              fibers.delete(fiber3);
              try {
                if (terminal) {
                  if (!interrupted && exit3._tag === "Failure") {
                    for (const reason of exit3.cause.reasons) {
                      if (reason._tag === "Interrupt") continue;
                      else if (terminal._tag === "Failure") {
                        ;
                        terminal.cause.reasons.push(reason);
                      } else {
                        terminal = exitFailCause(causeFromReasons([reason]));
                      }
                    }
                  }
                } else {
                  const result3 = step(state, item, exit3, currentIndex);
                  if (result3) {
                    terminal = result3._tag === "Failure" ? exitFailCause(causeFromReasons(result3.cause.reasons.slice())) : result3;
                    go();
                  }
                }
                if (paused) {
                  const eff2 = go();
                  if (eff2) resume(eff2);
                } else if (done4 && fibers.size === 0) {
                  resume(terminal ?? void_);
                }
              } catch (error) {
                resume(failDefect(error));
              }
            });
            if (fibers.size < concurrency) continue;
            paused = true;
            index++;
            return;
          }
        }
        done4 = true;
        if (terminal) {
          if (fibers && fibers.size > 0) {
            const annotations = fiberStackAnnotations(parentFiber);
            fibers.forEach((f) => f.interruptUnsafe(parentFiber.id, annotations));
            return;
          }
          if (resume || terminal._tag === "Failure") {
            return terminal;
          }
        } else if (resume) {
          if (!fibers) {
            return exitVoid;
          } else if (fibers.size === 0) {
            resume(void_);
          }
        }
      };
      return go();
    };
  };
  var forEachConcurrent = /* @__PURE__ */ iterateConcurrentImpl({
    onItem(state, item, index) {
      return state.f(item, index);
    },
    step(state, _, exit3, index) {
      if (exit3._tag === "Failure") return exit3;
      else if (state.out) {
        state.out[index] = exit3.value;
      }
    }
  });
  var filterOrElse = /* @__PURE__ */ dual(3, (self, predicate, orElse) => flatMap(self, (a) => predicate(a) ? succeed3(a) : orElse(a)));
  var filterMapOrElse = /* @__PURE__ */ dual(3, (self, filter4, orElse) => flatMap(self, (a) => {
    const result3 = filter4(a);
    return isFailure2(result3) ? orElse(result3.failure) : succeed3(result3.success);
  }));
  var filterMapOrFail = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, filter4, orFailWith) => filterMapOrElse(self, filter4, orFailWith ? (x) => fail3(orFailWith(x)) : () => fail3(new NoSuchElementError())));
  var filter2 = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, predicate, options) => suspend(() => {
    const out = [];
    return as(forEach(elements, (a, i) => {
      const result3 = predicate(a, i);
      if (typeof result3 === "boolean") {
        if (result3) out.push(a);
        return void_;
      }
      return map(result3, (keep) => {
        if (keep) {
          out.push(a);
        }
      });
    }, {
      discard: true,
      concurrency: options?.concurrency
    }), out);
  }));
  var filterMap = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, filter4) => suspend(() => {
    const out = [];
    for (const a of elements) {
      const result3 = filter4(a);
      if (isSuccess2(result3)) {
        out.push(result3.success);
      }
    }
    return succeed3(out);
  }));
  var filterMapEffect = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, filter4, options) => suspend(() => {
    const out = [];
    return as(forEach(elements, (a) => map(filter4(a), (result3) => {
      if (isSuccess2(result3)) {
        out.push(result3.success);
      }
    }), {
      discard: true,
      concurrency: options?.concurrency
    }), out);
  }));
  var Do = /* @__PURE__ */ succeed3({});
  var bindTo2 = /* @__PURE__ */ bindTo(map);
  var bind2 = /* @__PURE__ */ bind(map, flatMap);
  var let_2 = /* @__PURE__ */ let_(map);
  var forkChild = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, options) => withFiber((fiber3) => {
    interruptChildrenPatch();
    return succeed3(forkUnsafe(fiber3, self, options?.startImmediately, false, options?.uninterruptible ?? false));
  }));
  var forkUnsafe = (parent, effect, immediate = false, daemon = false, uninterruptible3 = false) => {
    const parentRuntime = parent;
    const interruptible3 = uninterruptible3 === "inherit" ? parentRuntime.interruptible : !uninterruptible3;
    const child = new FiberImpl(parentRuntime.context, interruptible3);
    if (immediate) {
      child.evaluate(effect);
    } else {
      parentRuntime.currentDispatcher.scheduleTask(() => child.evaluate(effect), 0);
    }
    if (!daemon && !child._exit) {
      parentRuntime.children().add(child);
      child._parent = parentRuntime;
    }
    return child;
  };
  var forkDetach = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, options) => withFiber((fiber3) => succeed3(forkUnsafe(fiber3, self, options?.startImmediately, true, options?.uninterruptible))));
  var awaitAllChildren = (self) => withFiber((fiber3) => {
    const initialChildren = fiber3._children && new Set(fiber3._children);
    return onExit(self, (_) => {
      let children = fiber3._children;
      if (children === void 0 || children.size === 0) {
        return void_;
      } else if (initialChildren) {
        children = filter(children, (child) => !initialChildren.has(child));
      }
      return asVoid(fiberAwaitAll(children));
    });
  });
  var forkIn = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, scope3, options) => withFiber((parent) => {
    const fiber3 = forkUnsafe(parent, self, options?.startImmediately, true, options?.uninterruptible);
    if (!fiber3._exit) {
      if (scope3.state._tag !== "Closed") {
        const key = {};
        const finalizer = () => withFiberId((interruptor) => interruptor === fiber3.id ? void_ : fiberInterrupt(fiber3));
        scopeAddFinalizerUnsafe(scope3, key, finalizer);
        fiber3.addObserver(() => scopeRemoveFinalizerUnsafe(scope3, key));
      } else {
        fiber3.interruptUnsafe(parent.id, fiberStackAnnotations(parent));
      }
    }
    return succeed3(fiber3);
  }));
  var forkScoped = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, options) => flatMap(scope, (scope3) => forkIn(self, scope3, options)));
  var runForkWith = (context3) => (effect, options) => {
    const fiber3 = new FiberImpl(options?.scheduler ? add(context3, Scheduler, options.scheduler) : context3, options?.uninterruptible !== true);
    fiber3.evaluate(effect);
    if (fiber3._exit) return fiber3;
    if (options?.signal) {
      if (options.signal.aborted) {
        fiber3.interruptUnsafe();
      } else {
        const abort = () => fiber3.interruptUnsafe();
        options.signal.addEventListener("abort", abort, {
          once: true
        });
        fiber3.addObserver(() => options.signal.removeEventListener("abort", abort));
      }
    }
    if (options?.onFiberStart) {
      options.onFiberStart(fiber3);
    }
    return fiber3;
  };
  var fiberRunIn = /* @__PURE__ */ dual(2, (self, scope3) => {
    if (self._exit) {
      return self;
    } else if (scope3.state._tag === "Closed") {
      self.interruptUnsafe(self.id);
      return self;
    }
    const key = {};
    scopeAddFinalizerUnsafe(scope3, key, () => fiberInterrupt(self));
    self.addObserver(() => scopeRemoveFinalizerUnsafe(scope3, key));
    return self;
  });
  var runFork = /* @__PURE__ */ runForkWith(/* @__PURE__ */ empty2());
  var runCallbackWith = (context3) => {
    const runFork3 = runForkWith(context3);
    return (effect, options) => {
      const fiber3 = runFork3(effect, options);
      if (options?.onExit) {
        fiber3.addObserver(options.onExit);
      }
      return (interruptor) => {
        return fiber3.interruptUnsafe(interruptor);
      };
    };
  };
  var runCallback = /* @__PURE__ */ runCallbackWith(/* @__PURE__ */ empty2());
  var runPromiseExitWith = (context3) => {
    const runFork3 = runForkWith(context3);
    return (effect, options) => {
      const fiber3 = runFork3(effect, options);
      return new Promise((resolve) => {
        fiber3.addObserver((exit3) => resolve(exit3));
      });
    };
  };
  var runPromiseExit = /* @__PURE__ */ runPromiseExitWith(/* @__PURE__ */ empty2());
  var runPromiseWith = (context3) => {
    const runPromiseExit3 = runPromiseExitWith(context3);
    return (effect, options) => runPromiseExit3(effect, options).then((exit3) => {
      if (exit3._tag === "Failure") {
        throw causeSquash(exit3.cause);
      }
      return exit3.value;
    });
  };
  var runPromise = /* @__PURE__ */ runPromiseWith(/* @__PURE__ */ empty2());
  var runSyncExitWith = (context3) => {
    const runFork3 = runForkWith(context3);
    return (effect) => {
      if (effectIsExit(effect)) return effect;
      const scheduler = new MixedScheduler("sync");
      const fiber3 = runFork3(effect, {
        scheduler
      });
      fiber3._dispatcher?.flush();
      return fiber3._exit ?? exitDie(new AsyncFiberError(fiber3));
    };
  };
  var runSyncExit = /* @__PURE__ */ runSyncExitWith(/* @__PURE__ */ empty2());
  var runSyncWith = (context3) => {
    const runSyncExit3 = runSyncExitWith(context3);
    return (effect) => {
      const exit3 = runSyncExit3(effect);
      if (exit3._tag === "Failure") throw causeSquash(exit3.cause);
      return exit3.value;
    };
  };
  var runSync = /* @__PURE__ */ runSyncWith(/* @__PURE__ */ empty2());
  var succeedTrue = /* @__PURE__ */ succeed3(true);
  var succeedFalse = /* @__PURE__ */ succeed3(false);
  var Latch = class {
    waiters = [];
    scheduled = void 0;
    _isOpen;
    constructor(isOpen) {
      this._isOpen = isOpen;
    }
    scheduleUnsafe(fiber3) {
      if (this.waiters.length === 0) {
        return succeedTrue;
      }
      if (this.scheduled === void 0) {
        this.scheduled = this.waiters;
        fiber3.currentDispatcher.scheduleTask(this.flushScheduled, 0);
      } else {
        for (let i = 0; i < this.waiters.length; i++) {
          this.scheduled.push(this.waiters[i]);
        }
      }
      this.waiters = [];
      return succeedTrue;
    }
    flushScheduled = () => {
      if (this.scheduled === void 0) return;
      const waiters = this.scheduled;
      this.scheduled = void 0;
      for (let i = 0; i < waiters.length; i++) {
        waiters[i](exitVoid);
      }
    };
    flushWaiters() {
      const waiters = this.waiters;
      this.waiters = [];
      this.flushScheduled();
      for (let i = 0; i < waiters.length; i++) {
        waiters[i](exitVoid);
      }
    }
    open = /* @__PURE__ */ withFiber((fiber3) => {
      if (this._isOpen) return succeedFalse;
      this._isOpen = true;
      return this.scheduleUnsafe(fiber3);
    });
    release = /* @__PURE__ */ withFiber((fiber3) => this._isOpen ? succeedFalse : this.scheduleUnsafe(fiber3));
    openUnsafe() {
      if (this._isOpen) return false;
      this._isOpen = true;
      this.flushWaiters();
      return true;
    }
    await = /* @__PURE__ */ callback((resume) => {
      if (this._isOpen) {
        return resume(void_);
      }
      this.waiters.push(resume);
      return sync(() => {
        let index = this.waiters.indexOf(resume);
        if (index !== -1) {
          this.waiters.splice(index, 1);
        } else if (this.scheduled !== void 0) {
          index = this.scheduled.indexOf(resume);
          if (index !== -1) {
            this.scheduled.splice(index, 1);
          }
        }
      });
    });
    closeUnsafe() {
      if (!this._isOpen) return false;
      this._isOpen = false;
      return true;
    }
    close = /* @__PURE__ */ sync(() => this.closeUnsafe());
    whenOpen = (self) => flatMap(this.await, () => self);
    isOpen() {
      return this._isOpen;
    }
  };
  var makeLatchUnsafe = (open) => new Latch(open ?? false);
  var tracer = /* @__PURE__ */ withFiber((fiber3) => succeed3(fiber3.getRef(Tracer)));
  var withTracer = /* @__PURE__ */ dual(2, (effect, tracer3) => provideService(effect, Tracer, tracer3));
  var withTracerEnabled = /* @__PURE__ */ provideService(TracerEnabled);
  var withTracerTiming = /* @__PURE__ */ provideService(TracerTimingEnabled);
  var bigint02 = /* @__PURE__ */ BigInt(0);
  var NoopSpanProto = {
    _tag: "Span",
    spanId: "noop",
    traceId: "noop",
    sampled: false,
    status: {
      _tag: "Ended",
      startTime: bigint02,
      endTime: bigint02,
      exit: exitVoid
    },
    attributes: /* @__PURE__ */ new Map(),
    links: [],
    kind: "internal",
    attribute() {
    },
    event() {
    },
    end() {
    },
    addLinks() {
    }
  };
  var noopSpan = (options) => Object.assign(Object.create(NoopSpanProto), options);
  var filterDisablePropagation = (span) => {
    if (!span) return none2();
    return get(span.annotations, DisablePropagation) ? span._tag === "Span" ? filterDisablePropagation(getOrUndefined(span.parent)) : none2() : some2(span);
  };
  var makeSpanUnsafe = (fiber3, name, options) => {
    const disablePropagation = !fiber3.getRef(TracerEnabled) || options?.annotations && get(options.annotations, DisablePropagation);
    const parent = options?.parent !== void 0 ? some2(options.parent) : options?.root ? none2() : filterDisablePropagation(fiber3.cache.span);
    let span;
    if (disablePropagation) {
      span = noopSpan({
        name,
        parent,
        annotations: add(options?.annotations ?? empty2(), DisablePropagation, true)
      });
    } else {
      const tracer3 = fiber3.getRef(Tracer);
      const clock = fiber3.getRef(ClockRef);
      const timingEnabled = fiber3.getRef(TracerTimingEnabled);
      const annotationsFromEnv = fiber3.getRef(TracerSpanAnnotations);
      const linksFromEnv = fiber3.getRef(TracerSpanLinks);
      const level = options?.level ?? fiber3.getRef(CurrentTraceLevel);
      const links = options?.links !== void 0 ? [...linksFromEnv, ...options.links] : linksFromEnv.length === 0 ? [] : linksFromEnv.slice();
      span = tracer3.span({
        name,
        parent,
        annotations: options?.annotations ?? empty2(),
        links,
        startTime: timingEnabled ? clock.currentTimeNanosUnsafe() : bigint02,
        kind: options?.kind ?? "internal",
        root: options?.root ?? isNone2(parent),
        sampled: options?.sampled ?? (isSome2(parent) && parent.value.sampled === false ? false : !isLogLevelGreaterThan(fiber3.getRef(MinimumTraceLevel), level))
      });
      for (const key in annotationsFromEnv) {
        span.attribute(key, annotationsFromEnv[key]);
      }
      if (options?.attributes !== void 0) {
        for (const key in options.attributes) {
          span.attribute(key, options.attributes[key]);
        }
      }
    }
    return span;
  };
  var makeSpan = (name, options) => withFiber((fiber3) => succeed3(makeSpanUnsafe(fiber3, name, options)));
  var makeSpanScoped = (name, options) => uninterruptible(withFiber((fiber3) => {
    const scope3 = getUnsafe(fiber3.context, scopeTag);
    const span = makeSpanUnsafe(fiber3, name, options ?? {});
    const clock = fiber3.getRef(ClockRef);
    const timingEnabled = fiber3.getRef(TracerTimingEnabled);
    return as(scopeAddFinalizerExit(scope3, (exit3) => endSpan(span, exit3, clock, timingEnabled)), span);
  }));
  var withSpanScoped = function() {
    const dataFirst = typeof arguments[0] !== "string";
    const name = dataFirst ? arguments[1] : arguments[0];
    const options = addSpanStackTrace(dataFirst ? arguments[2] : arguments[1]);
    if (dataFirst) {
      const self = arguments[0];
      return flatMap(makeSpanScoped(name, options), (span) => withParentSpan(self, span, options));
    }
    return (self) => flatMap(makeSpanScoped(name, options), (span) => withParentSpan(self, span, options));
  };
  var provideSpanStackFrame = (name, stack) => {
    stack = typeof stack === "function" ? stack : constUndefined;
    return updateService(CurrentStackFrame, (parent) => ({
      name,
      stack,
      parent
    }));
  };
  var spanAnnotations = TracerSpanAnnotations;
  var spanLinks = TracerSpanLinks;
  var linkSpans = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, span, attributes = {}) => {
    const spans = Array.isArray(span) ? span : [span];
    const links = spans.map((span2) => ({
      span: span2,
      attributes
    }));
    return updateService(self, TracerSpanLinks, (current) => [...current, ...links]);
  });
  var endSpan = (span, exit3, clock, timingEnabled) => sync(() => {
    if (span.status._tag === "Ended") return;
    span.end(timingEnabled ? clock.currentTimeNanosUnsafe() : bigint02, exit3);
  });
  var useSpan = (name, ...args2) => {
    const options = args2.length === 1 ? void 0 : args2[0];
    const evaluate2 = args2[args2.length - 1];
    return withFiber((fiber3) => {
      const span = makeSpanUnsafe(fiber3, name, options);
      const clock = fiber3.getRef(ClockRef);
      const timingEnabled = fiber3.getRef(TracerTimingEnabled);
      return onExit(suspend(() => internalCall(() => evaluate2(span))), (exit3) => endSpan(span, exit3, clock, timingEnabled));
    });
  };
  var provideParentSpan = /* @__PURE__ */ provideService(ParentSpan);
  var withParentSpan = function() {
    const dataFirst = isEffect(arguments[0]);
    const span = dataFirst ? arguments[1] : arguments[0];
    let options = dataFirst ? arguments[2] : arguments[1];
    let provideStackFrame = identity;
    if (span._tag === "Span") {
      options = addSpanStackTrace(options);
      provideStackFrame = provideSpanStackFrame(span.name, options?.captureStackTrace);
    }
    if (dataFirst) {
      return provideParentSpan(provideStackFrame(arguments[0]), span);
    }
    return (self) => provideParentSpan(provideStackFrame(self), span);
  };
  var withSpan = function() {
    const dataFirst = typeof arguments[0] !== "string";
    const name = dataFirst ? arguments[1] : arguments[0];
    const traceOptions = addSpanStackTrace(arguments[2]);
    if (dataFirst) {
      const self = arguments[0];
      return useSpan(name, arguments[2], (span) => withParentSpan(self, span, traceOptions));
    }
    const fnArg = typeof arguments[1] === "function" ? arguments[1] : void 0;
    const options = fnArg ? void 0 : arguments[1];
    return (self, ...args2) => useSpan(name, fnArg ? fnArg(...args2) : options, (span) => withParentSpan(self, span, traceOptions));
  };
  var annotateSpans = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (effect, ...args2) => updateService(effect, TracerSpanAnnotations, (annotations) => {
    const newAnnotations = args2.length === 1 ? {
      ...annotations,
      ...args2[0]
    } : {
      ...annotations
    };
    if (args2.length === 1) {
      return newAnnotations;
    } else {
      assignProperty(newAnnotations, args2[0], args2[1]);
    }
    return newAnnotations;
  }));
  var annotateCurrentSpan = (...args2) => withFiber((fiber3) => {
    const span = fiber3.currentSpanLocal;
    if (span) {
      if (args2.length === 1) {
        for (const [key, value] of Object.entries(args2[0])) {
          span.attribute(key, value);
        }
      } else {
        span.attribute(args2[0], args2[1]);
      }
    }
    return void_;
  });
  var currentSpan = /* @__PURE__ */ withFiber((fiber3) => {
    const span = fiber3.currentSpanLocal;
    return span ? succeed3(span) : fail3(new NoSuchElementError());
  });
  var currentParentSpan = /* @__PURE__ */ serviceOptional(ParentSpan);
  var ClockRef = /* @__PURE__ */ Reference("effect/Clock", {
    defaultValue: () => new ClockImpl()
  });
  var MAX_TIMER_MILLIS = 2 ** 31 - 1;
  var ClockImpl = class {
    currentTimeMillisUnsafe() {
      return Date.now();
    }
    currentTimeMillis = /* @__PURE__ */ sync(() => this.currentTimeMillisUnsafe());
    currentTimeNanosUnsafe() {
      return wallTimeNanos();
    }
    currentTimeNanos = /* @__PURE__ */ sync(() => this.currentTimeNanosUnsafe());
    monotonicTimeNanosUnsafe() {
      return monotonicNowNanos();
    }
    monotonicTimeNanos = /* @__PURE__ */ sync(() => this.monotonicTimeNanosUnsafe());
    sleep(duration) {
      return this.sleepMillis(toMillis(duration));
    }
    sleepMillis(millis2) {
      if (millis2 <= 0) return yieldNow;
      else if (!Number.isFinite(millis2)) return never;
      return callback((resume) => {
        const continuation = millis2 > MAX_TIMER_MILLIS ? this.sleepMillis(millis2 - MAX_TIMER_MILLIS) : void_;
        const handle = setTimeout(() => resume(continuation), Math.min(millis2, MAX_TIMER_MILLIS));
        return sync(() => clearTimeout(handle));
      });
    }
  };
  var nanosPerMilli = /* @__PURE__ */ BigInt(1e6);
  var monotonicNowNanos = /* @__PURE__ */ (function() {
    const processHrtime = globalThis.process?.hrtime;
    if (typeof processHrtime?.bigint === "function") {
      return () => processHrtime.bigint();
    }
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
      return () => BigInt(Math.round(performance.now() * 1e6));
    }
    let previous = /* @__PURE__ */ BigInt(0);
    return () => {
      const current = BigInt(Date.now()) * nanosPerMilli;
      if (current > previous) {
        previous = current;
      }
      return previous;
    };
  })();
  var wallTimeNanos = /* @__PURE__ */ (function() {
    const reanchorThresholdNanos = /* @__PURE__ */ BigInt(1e9);
    let origin;
    return () => {
      const monotonic = monotonicNowNanos();
      const wall = BigInt(Date.now()) * nanosPerMilli;
      if (origin === void 0) {
        origin = wall - monotonic;
      } else {
        const projected = origin + monotonic;
        const skew = wall > projected ? wall - projected : projected - wall;
        if (skew > reanchorThresholdNanos) {
          origin = wall - monotonic;
        }
      }
      return origin + monotonic;
    };
  })();
  var clockWith = (f) => withFiber((fiber3) => f(fiber3.getRef(ClockRef)));
  var sleep = (duration) => clockWith((clock) => clock.sleep(fromInputUnsafe(duration)));
  var currentTimeMillis = /* @__PURE__ */ clockWith((clock) => clock.currentTimeMillis);
  var TimeoutErrorTypeId = "~effect/Cause/TimeoutError";
  var TimeoutError = class extends (/* @__PURE__ */ TaggedError("TimeoutError")) {
    [TimeoutErrorTypeId] = TimeoutErrorTypeId;
    constructor(message) {
      super({
        message
      });
    }
  };
  var IllegalArgumentErrorTypeId = "~effect/Cause/IllegalArgumentError";
  var IllegalArgumentError = class extends (/* @__PURE__ */ TaggedError("IllegalArgumentError")) {
    [IllegalArgumentErrorTypeId] = IllegalArgumentErrorTypeId;
    constructor(message) {
      super({
        message
      });
    }
  };
  var ExceededCapacityErrorTypeId = "~effect/Cause/ExceededCapacityError";
  var ExceededCapacityError = class extends (/* @__PURE__ */ TaggedError("ExceededCapacityError")) {
    [ExceededCapacityErrorTypeId] = ExceededCapacityErrorTypeId;
    constructor(message) {
      super({
        message
      });
    }
  };
  var AsyncFiberErrorTypeId = "~effect/Cause/AsyncFiberError";
  var AsyncFiberError = class extends (/* @__PURE__ */ TaggedError("AsyncFiberError")) {
    [AsyncFiberErrorTypeId] = AsyncFiberErrorTypeId;
    constructor(fiber3) {
      super({
        message: "An asynchronous Effect was executed with Effect.runSync",
        fiber: fiber3
      });
    }
  };
  var UnknownErrorTypeId = "~effect/Cause/UnknownError";
  var UnknownError = class extends (/* @__PURE__ */ TaggedError("UnknownError")) {
    [UnknownErrorTypeId] = UnknownErrorTypeId;
    constructor(cause, message) {
      super({
        message,
        cause
      });
    }
  };
  var ConsoleRef = /* @__PURE__ */ Reference("effect/Console", {
    defaultValue: () => globalThis.console
  });
  var logLevelToOrder = (level) => {
    switch (level) {
      case "All":
        return Number.MIN_SAFE_INTEGER;
      case "Fatal":
        return 5e4;
      case "Error":
        return 4e4;
      case "Warn":
        return 3e4;
      case "Info":
        return 2e4;
      case "Debug":
        return 1e4;
      case "Trace":
        return 0;
      case "None":
        return Number.MAX_SAFE_INTEGER;
    }
  };
  var LogLevelOrder = /* @__PURE__ */ mapInput(Number2, logLevelToOrder);
  var isLogLevelGreaterThan = /* @__PURE__ */ isGreaterThan(LogLevelOrder);
  var CurrentLoggers = /* @__PURE__ */ Reference("effect/Logger/CurrentLoggers", {
    defaultValue: () => /* @__PURE__ */ new Set([defaultLogger, tracerLogger])
  });
  var LogToStderr = /* @__PURE__ */ Reference("effect/Logger/LogToStderr", {
    defaultValue: constFalse
  });
  var annotateLogsScoped = function() {
    const entries = typeof arguments[0] === "string" ? [[arguments[0], arguments[1]]] : Object.entries(arguments[0]);
    return uninterruptible(withFiber((fiber3) => {
      const prev = fiber3.getRef(CurrentLogAnnotations);
      const next = {
        ...prev
      };
      for (let i = 0; i < entries.length; i++) {
        const [key, value] = entries[i];
        assignProperty(next, key, value);
      }
      fiber3.setContext(add(fiber3.context, CurrentLogAnnotations, next));
      return scopeAddFinalizerExit(getUnsafe(fiber3.context, scopeTag), (_) => {
        const current = fiber3.getRef(CurrentLogAnnotations);
        const next2 = {
          ...current
        };
        for (let i = 0; i < entries.length; i++) {
          const [key, value] = entries[i];
          if (current[key] !== value && !Object.is(current[key], value)) continue;
          if (Object.hasOwn(prev, key)) {
            assignProperty(next2, key, prev[key]);
          } else {
            delete next2[key];
          }
        }
        fiber3.setContext(add(fiber3.context, CurrentLogAnnotations, next2));
        return void_;
      });
    }));
  };
  var LoggerTypeId = "~effect/Logger";
  var LoggerProto = {
    [LoggerTypeId]: {
      _Message: identity,
      _Output: identity
    },
    pipe() {
      return pipeArguments(this, arguments);
    }
  };
  var loggerMake = (log2) => {
    const self = Object.create(LoggerProto);
    self.log = log2;
    return self;
  };
  var formatLabel = (key) => key.replace(/[\s="]/g, "_");
  var formatLogSpan = (self, now) => {
    const label = formatLabel(self[0]);
    return `${label}=${now - self[1]}ms`;
  };
  var logWithLevel = (level) => (...message) => {
    let cause = void 0;
    for (let i = 0, len = message.length; i < len; i++) {
      const msg = message[i];
      if (isCause(msg)) {
        if (cause) {
          ;
          message.splice(i, 1);
        } else {
          message = message.slice(0, i).concat(message.slice(i + 1));
        }
        cause = cause ? causeFromReasons(cause.reasons.concat(msg.reasons)) : msg;
        i--;
      }
    }
    if (cause === void 0) {
      cause = causeEmpty;
    }
    return withFiber((fiber3) => {
      const logLevel = level ?? fiber3.cache.logLevel;
      if (isLogLevelGreaterThan(fiber3.cache.minimumLogLevel, logLevel)) {
        return void_;
      }
      const clock = fiber3.getRef(ClockRef);
      const loggers = fiber3.getRef(CurrentLoggers);
      if (loggers.size > 0) {
        const date = new Date(clock.currentTimeMillisUnsafe());
        for (const logger of loggers) {
          logger.log({
            cause,
            fiber: fiber3,
            date,
            logLevel,
            message
          });
        }
      }
      return void_;
    });
  };
  var colors = {
    bold: "1",
    red: "31",
    green: "32",
    yellow: "33",
    blue: "34",
    cyan: "36",
    white: "37",
    gray: "90",
    black: "30",
    bgBrightRed: "101"
  };
  var logLevelColors = {
    None: [],
    All: [],
    Trace: [colors.gray],
    Debug: [colors.blue],
    Info: [colors.green],
    Warn: [colors.yellow],
    Error: [colors.red],
    Fatal: [colors.bgBrightRed, colors.black]
  };
  var defaultDateFormat = (date) => `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}.${date.getMilliseconds().toString().padStart(3, "0")}`;
  var defaultLogger = /* @__PURE__ */ loggerMake(({
    cause,
    date,
    fiber: fiber3,
    logLevel,
    message
  }) => {
    const message_ = Array.isArray(message) ? message.slice() : [message];
    if (cause.reasons.length > 0) {
      message_.push(causePretty(cause));
    }
    const now = date.getTime();
    const spans = fiber3.getRef(CurrentLogSpans);
    let spanString = "";
    for (const span of spans) {
      spanString += ` ${formatLogSpan(span, now)}`;
    }
    const annotations = fiber3.getRef(CurrentLogAnnotations);
    if (Object.keys(annotations).length > 0) {
      message_.push(annotations);
    }
    const console = fiber3.getRef(ConsoleRef);
    const log2 = fiber3.getRef(LogToStderr) ? console.error : console.log;
    log2(`[${defaultDateFormat(date)}] ${logLevel.toUpperCase()} (#${fiber3.id})${spanString}:`, ...message_);
  });
  var tracerLogger = /* @__PURE__ */ loggerMake(({
    cause,
    fiber: fiber3,
    logLevel,
    message
  }) => {
    const clock = fiber3.getRef(ClockRef);
    const annotations = fiber3.getRef(CurrentLogAnnotations);
    const span = fiber3.cache.span;
    if (span === void 0 || span._tag === "ExternalSpan") return;
    const attributes = {};
    for (const [key, value] of Object.entries(annotations)) {
      assignProperty(attributes, key, value);
    }
    attributes["effect.fiberId"] = fiber3.id;
    attributes["effect.logLevel"] = logLevel.toUpperCase();
    if (cause.reasons.length > 0) {
      attributes["effect.cause"] = causePretty(cause);
    }
    span.event(toStringUnknown(Array.isArray(message) && message.length === 1 ? message[0] : message), clock.currentTimeNanosUnsafe(), attributes);
  });
  function interruptChildrenPatch() {
    fiberMiddleware.interruptChildren ??= fiberInterruptChildren;
  }
  var undefined_ = /* @__PURE__ */ succeed3(void 0);
  var withErrorReporting = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, options) => onError(self, (cause) => withFiber((fiber3) => {
    reportCauseUnsafe(fiber3, cause, options?.defectsOnly);
    return void_;
  })));
  var reportCauseUnsafe = (fiber3, cause, defectsOnly) => {
    const reporters = fiber3.getRef(CurrentErrorReporters);
    if (reporters.size === 0) return;
    if (defectsOnly && !hasDies(cause)) return;
    const opts = {
      cause,
      fiber: fiber3,
      timestamp: fiber3.getRef(ClockRef).currentTimeNanosUnsafe()
    };
    reporters.forEach((reporter) => reporter.report(opts));
  };

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Cause.js
  var fromReasons = causeFromReasons;
  var isDone2 = isDone;
  var done2 = done;

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Effect.js
  var Effect_exports = {};
  __export(Effect_exports, {
    Do: () => Do2,
    Transaction: () => Transaction,
    TypeId: () => TypeId11,
    abortSignal: () => abortSignal2,
    acquireDisposable: () => acquireDisposable2,
    acquireRelease: () => acquireRelease2,
    acquireUseRelease: () => acquireUseRelease2,
    addFinalizer: () => addFinalizer2,
    all: () => all2,
    andThen: () => andThen2,
    annotateCurrentSpan: () => annotateCurrentSpan2,
    annotateLogs: () => annotateLogs,
    annotateLogsScoped: () => annotateLogsScoped2,
    annotateSpans: () => annotateSpans2,
    as: () => as2,
    asSome: () => asSome2,
    asVoid: () => asVoid2,
    awaitAllChildren: () => awaitAllChildren2,
    bind: () => bind3,
    bindTo: () => bindTo3,
    cached: () => cached2,
    cachedInvalidateWithTTL: () => cachedInvalidateWithTTL2,
    cachedWithTTL: () => cachedWithTTL2,
    callback: () => callback2,
    catch: () => catch_2,
    catchCause: () => catchCause2,
    catchCauseFilter: () => catchCauseFilter2,
    catchCauseIf: () => catchCauseIf2,
    catchDefect: () => catchDefect2,
    catchEager: () => catchEager2,
    catchFilter: () => catchFilter2,
    catchIf: () => catchIf2,
    catchNoSuchElement: () => catchNoSuchElement2,
    catchReason: () => catchReason2,
    catchReasons: () => catchReasons2,
    catchTag: () => catchTag2,
    catchTags: () => catchTags2,
    clockWith: () => clockWith2,
    context: () => context2,
    contextWith: () => contextWith2,
    currentParentSpan: () => currentParentSpan2,
    currentSpan: () => currentSpan2,
    delay: () => delay2,
    die: () => die2,
    effectify: () => effectify,
    ensuring: () => ensuring2,
    eventually: () => eventually2,
    exit: () => exit2,
    fail: () => fail4,
    failCause: () => failCause2,
    failCauseSync: () => failCauseSync2,
    failSync: () => failSync2,
    fiber: () => fiber2,
    fiberId: () => fiberId2,
    filter: () => filter3,
    filterMap: () => filterMap2,
    filterMapEffect: () => filterMapEffect2,
    filterMapOrElse: () => filterMapOrElse2,
    filterMapOrFail: () => filterMapOrFail2,
    filterOrElse: () => filterOrElse2,
    filterOrFail: () => filterOrFail2,
    findFirst: () => findFirst2,
    findFirstFilter: () => findFirstFilter2,
    firstSuccessOf: () => firstSuccessOf2,
    flatMap: () => flatMap2,
    flatMapEager: () => flatMapEager2,
    flatten: () => flatten3,
    flip: () => flip2,
    fn: () => fn2,
    fnUntraced: () => fnUntraced2,
    fnUntracedEager: () => fnUntracedEager2,
    forEach: () => forEach2,
    forever: () => forever3,
    forkChild: () => forkChild2,
    forkDetach: () => forkDetach2,
    forkIn: () => forkIn2,
    forkScoped: () => forkScoped2,
    fromNullishOr: () => fromNullishOr2,
    fromOption: () => fromOption3,
    fromResult: () => fromResult2,
    gen: () => gen2,
    head: () => head2,
    ignore: () => ignore2,
    ignoreCause: () => ignoreCause2,
    interrupt: () => interrupt2,
    interruptible: () => interruptible2,
    interruptibleMask: () => interruptibleMask2,
    isEffect: () => isEffect2,
    isFailure: () => isFailure4,
    isSuccess: () => isSuccess5,
    let: () => let_3,
    linkSpans: () => linkSpans2,
    log: () => log,
    logDebug: () => logDebug,
    logError: () => logError,
    logFatal: () => logFatal,
    logInfo: () => logInfo,
    logTrace: () => logTrace,
    logWarning: () => logWarning,
    logWithLevel: () => logWithLevel2,
    makeSpan: () => makeSpan2,
    makeSpanScoped: () => makeSpanScoped2,
    map: () => map2,
    mapBoth: () => mapBoth2,
    mapBothEager: () => mapBothEager2,
    mapEager: () => mapEager2,
    mapError: () => mapError2,
    mapErrorEager: () => mapErrorEager2,
    match: () => match4,
    matchCause: () => matchCause2,
    matchCauseEager: () => matchCauseEager2,
    matchCauseEffect: () => matchCauseEffect2,
    matchCauseEffectEager: () => matchCauseEffectEager2,
    matchEager: () => matchEager2,
    matchEffect: () => matchEffect3,
    never: () => never2,
    onError: () => onError2,
    onErrorFilter: () => onErrorFilter2,
    onErrorIf: () => onErrorIf2,
    onExit: () => onExit2,
    onExitFilter: () => onExitFilter2,
    onExitIf: () => onExitIf2,
    onExitPrimitive: () => onExitPrimitive2,
    onInterrupt: () => onInterrupt2,
    option: () => option2,
    orDie: () => orDie2,
    orElseSucceed: () => orElseSucceed2,
    partition: () => partition3,
    promise: () => promise2,
    provide: () => provide4,
    provideContext: () => provideContext2,
    provideService: () => provideService2,
    provideServiceEffect: () => provideServiceEffect2,
    race: () => race2,
    raceAll: () => raceAll2,
    raceAllFirst: () => raceAllFirst2,
    raceFirst: () => raceFirst2,
    reduce: () => reduce2,
    repeat: () => repeat2,
    repeatOrElse: () => repeatOrElse2,
    replicate: () => replicate2,
    replicateEffect: () => replicateEffect2,
    request: () => request2,
    requestUnsafe: () => requestUnsafe2,
    result: () => result2,
    retry: () => retry2,
    retryOrElse: () => retryOrElse2,
    runCallback: () => runCallback2,
    runCallbackWith: () => runCallbackWith2,
    runFork: () => runFork2,
    runForkWith: () => runForkWith2,
    runPromise: () => runPromise2,
    runPromiseExit: () => runPromiseExit2,
    runPromiseExitWith: () => runPromiseExitWith2,
    runPromiseWith: () => runPromiseWith2,
    runSync: () => runSync2,
    runSyncExit: () => runSyncExit2,
    runSyncExitWith: () => runSyncExitWith2,
    runSyncWith: () => runSyncWith2,
    sandbox: () => sandbox2,
    satisfiesErrorType: () => satisfiesErrorType,
    satisfiesServicesType: () => satisfiesServicesType,
    satisfiesSuccessType: () => satisfiesSuccessType,
    schedule: () => schedule,
    scheduleFrom: () => scheduleFrom2,
    scope: () => scope2,
    scoped: () => scoped2,
    scopedWith: () => scopedWith2,
    service: () => service2,
    serviceOption: () => serviceOption2,
    setContext: () => setContext2,
    sleep: () => sleep2,
    spanAnnotations: () => spanAnnotations2,
    spanLinks: () => spanLinks2,
    succeed: () => succeed4,
    succeedNone: () => succeedNone2,
    succeedSome: () => succeedSome2,
    suspend: () => suspend2,
    sync: () => sync2,
    tap: () => tap2,
    tapCause: () => tapCause2,
    tapCauseFilter: () => tapCauseFilter2,
    tapCauseIf: () => tapCauseIf2,
    tapDefect: () => tapDefect2,
    tapError: () => tapError2,
    tapErrorTag: () => tapErrorTag2,
    timed: () => timed2,
    timeout: () => timeout2,
    timeoutOption: () => timeoutOption2,
    timeoutOrElse: () => timeoutOrElse2,
    tracer: () => tracer2,
    track: () => track,
    trackDefects: () => trackDefects,
    trackDuration: () => trackDuration,
    trackErrors: () => trackErrors,
    trackSuccesses: () => trackSuccesses,
    transposeOption: () => transposeOption2,
    try: () => try_2,
    tryPromise: () => tryPromise2,
    tx: () => tx,
    txRetry: () => txRetry,
    undefined: () => undefined_2,
    uninterruptible: () => uninterruptible2,
    uninterruptibleMask: () => uninterruptibleMask2,
    unwrapReason: () => unwrapReason2,
    updateContext: () => updateContext2,
    updateService: () => updateService2,
    updateServiceScoped: () => updateServiceScoped2,
    useSpan: () => useSpan2,
    validate: () => validate2,
    void: () => void_2,
    when: () => when2,
    whileLoop: () => whileLoop2,
    withErrorReporting: () => withErrorReporting2,
    withExecutionPlan: () => withExecutionPlan2,
    withFiber: () => withFiber2,
    withFiberSucceed: () => withFiberSucceed2,
    withLogSpan: () => withLogSpan,
    withLogger: () => withLogger,
    withParentSpan: () => withParentSpan2,
    withSpan: () => withSpan2,
    withSpanScoped: () => withSpanScoped2,
    withTracer: () => withTracer2,
    withTracerEnabled: () => withTracerEnabled2,
    withTracerTiming: () => withTracerTiming2,
    yieldNow: () => yieldNow2,
    yieldNowWith: () => yieldNowWith2,
    zip: () => zip2,
    zipWith: () => zipWith2
  });

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Exit.js
  var isSuccess4 = exitIsSuccess;

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Deferred.js
  var TypeId5 = "~effect/Deferred";
  var DeferredProto = {
    [TypeId5]: {
      _A: identity,
      _E: identity
    },
    pipe() {
      return pipeArguments(this, arguments);
    }
  };
  var DeferredImpl = function() {
    this.resumes = void 0;
    this.effect = void 0;
  };
  DeferredImpl.prototype = DeferredProto;
  var makeUnsafe2 = () => new DeferredImpl();
  var _await = (self) => callback((resume) => {
    if (self.effect) return resume(self.effect);
    self.resumes ??= [];
    self.resumes.push(resume);
    return sync(() => {
      const resumes = self.resumes;
      if (resumes === void 0) return;
      const index = resumes.indexOf(resume);
      if (index >= 0) resumes.splice(index, 1);
    });
  });
  var completeWith = /* @__PURE__ */ dual(2, (self, effect) => sync(() => doneUnsafe(self, effect)));
  var done3 = completeWith;
  var doneUnsafe = (self, effect) => {
    if (self.effect) return false;
    self.effect = effect;
    if (self.resumes) {
      const resumes = self.resumes;
      self.resumes = void 0;
      for (let i = 0; i < resumes.length; i++) {
        resumes[i](effect);
      }
    }
    return true;
  };

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/References.js
  var CurrentLogAnnotations2 = CurrentLogAnnotations;
  var CurrentLogSpans2 = CurrentLogSpans;

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Scope.js
  var makeUnsafe3 = scopeMakeUnsafe;
  var forkUnsafe2 = scopeForkUnsafe;
  var close = scopeClose;

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Layer.js
  var TypeId6 = "~effect/Layer";
  var MemoMapTypeId = "~effect/Layer/MemoMap";
  var memoMapReuse = (entry, scope3) => {
    entry.observers++;
    return andThen(scopeAddFinalizerExit(scope3, (exit3) => entry.finalizer(exit3)), entry.effect);
  };
  var isLayer = (u) => hasProperty(u, TypeId6);
  var LayerProto = {
    [TypeId6]: {
      _ROut: identity,
      _E: identity,
      _RIn: identity
    },
    pipe() {
      return pipeArguments(this, arguments);
    }
  };
  var fromBuildUnsafe = (build) => {
    const self = Object.create(LayerProto);
    self.build = build;
    return self;
  };
  var fromBuild = (build) => fromBuildUnsafe((memoMap, scope3) => {
    const layerScope = forkUnsafe2(scope3);
    return onExit(build(memoMap, layerScope), (exit3) => exit3._tag === "Failure" ? close(layerScope, exit3) : void_);
  });
  var memoMapBuild = (memoMap, layer, scope3, build) => {
    const layerScope = makeUnsafe3();
    const deferred2 = makeUnsafe2();
    const entry = {
      observers: 1,
      effect: _await(deferred2),
      finalizer: (exit3) => suspend(() => {
        entry.observers--;
        if (entry.observers === 0) {
          memoMap.map.delete(layer);
          return close(layerScope, exit3);
        }
        return void_;
      })
    };
    memoMap.map.set(layer, entry);
    return scopeAddFinalizerExit(scope3, entry.finalizer).pipe(flatMap(() => build(memoMap, layerScope)), onExit((exit3) => {
      entry.effect = exit3;
      return done3(deferred2, exit3);
    }));
  };
  var MemoMapImpl = class {
    get [MemoMapTypeId]() {
      return MemoMapTypeId;
    }
    parent;
    constructor(parent) {
      this.parent = parent;
    }
    map = /* @__PURE__ */ new Map();
    get(layer, scope3) {
      const local = this.map.get(layer);
      if (local) {
        return memoMapReuse(local, scope3);
      }
      return this.parent?.get(layer, scope3);
    }
    getOrElseMemoize(layer, scope3, build) {
      return suspend(() => {
        const existing = this.get(layer, scope3);
        if (existing) {
          return existing;
        }
        return memoMapBuild(this, layer, scope3, build);
      });
    }
  };
  var makeMemoMapUnsafe = () => new MemoMapImpl();
  var forkMemoMapUnsafe = (parent) => new MemoMapImpl(parent);
  var CurrentMemoMap = class _CurrentMemoMap extends (/* @__PURE__ */ Service()("effect/Layer/CurrentMemoMap")) {
    static forkOrCreate(self) {
      const current = getOrUndefined2(self, _CurrentMemoMap);
      return current ? forkMemoMapUnsafe(current) : makeMemoMapUnsafe();
    }
  };
  var buildWithMemoMap = /* @__PURE__ */ dual(3, (self, memoMap, scope3) => provideService(map(self.build(memoMap, scope3), add(CurrentMemoMap, memoMap)), CurrentMemoMap, memoMap));
  var buildWithScope = /* @__PURE__ */ dual(2, (self, scope3) => withFiber((fiber3) => buildWithMemoMap(self, CurrentMemoMap.forkOrCreate(fiber3.context), scope3)));
  var succeedContext = (context3) => fromBuildUnsafe(constant(succeed3(context3)));
  var mergeAllEffect = (layers, memoMap, scope3) => {
    const parentScope = forkUnsafe2(scope3, "parallel");
    return forEach(layers, (layer) => layer.build(memoMap, forkUnsafe2(parentScope, "sequential")), {
      concurrency: layers.length
    }).pipe(map((context3) => mergeAll(...context3)));
  };
  var mergeAll2 = (...layers) => fromBuild((memoMap, scope3) => mergeAllEffect(layers, memoMap, scope3));
  var provideWith = (self, that, f) => fromBuild((memoMap, scope3) => flatMap(Array.isArray(that) ? mergeAllEffect(that, memoMap, scope3) : that.build(memoMap, scope3), (context3) => self.build(memoMap, scope3).pipe(provideContext(context3), map((merged) => f(merged, context3)))));
  var provide2 = /* @__PURE__ */ dual(2, (self, that) => provideWith(self, that, identity));

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/ExecutionPlan.js
  var TypeId7 = "~effect/ExecutionPlan";
  var Proto2 = {
    [TypeId7]: TypeId7,
    get captureRequirements() {
      const self = this;
      return contextWith((context3) => succeed3(makeProto(self.steps.map((step) => ({
        ...step,
        while: step.while ? (input) => provideContext(step.while(input), context3) : void 0,
        provide: isLayer(step.provide) ? provide2(step.provide, succeedContext(context3)) : step.provide
      })))));
    },
    pipe() {
      return pipeArguments(this, arguments);
    }
  };
  var makeProto = (steps) => {
    const self = Object.create(Proto2);
    self.steps = steps;
    return self;
  };
  var CurrentMetadata = /* @__PURE__ */ Reference("effect/ExecutionPlan/CurrentMetadata", {
    defaultValue: /* @__PURE__ */ constant({
      attempt: 0,
      stepIndex: 0
    })
  });

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Pull.js
  var catchDone = /* @__PURE__ */ dual(2, (effect, f) => catchCauseFilter(effect, filterDoneLeftover, (l) => f(l)));
  var isDoneCause = (cause) => cause.reasons.some(isDoneFailure);
  var isDoneFailure = (failure) => failure._tag === "Fail" && isDone2(failure.error);
  var filterDone = (cause) => {
    let done4;
    let hasFailure = false;
    for (const reason of cause.reasons) {
      if (isDoneFailure(reason)) {
        done4 ??= reason.error;
      } else if (reason._tag !== "Interrupt") {
        hasFailure = true;
      }
    }
    if (done4 === void 0) return fail2(cause);
    return hasFailure ? fail2(fromReasons(cause.reasons.filter((reason) => !isDoneFailure(reason)))) : succeed2(done4);
  };
  var filterDoneLeftover = (cause) => {
    const done4 = filterDone(cause);
    return isFailure2(done4) ? done4 : succeed2(done4.success.value);
  };
  var matchEffect2 = /* @__PURE__ */ dual(2, (self, options) => matchCauseEffect(self, {
    onSuccess: options.onSuccess,
    onFailure: (cause) => {
      const halt = filterDone(cause);
      return !isFailure2(halt) ? options.onDone(halt.success.value) : options.onFailure(halt.failure);
    }
  }));

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Schedule.js
  var TypeId8 = "~effect/Schedule";
  var CurrentMetadata2 = /* @__PURE__ */ Reference("effect/Schedule/CurrentMetadata", {
    defaultValue: /* @__PURE__ */ constant({
      input: void 0,
      output: void 0,
      duration: zero,
      attempt: 0,
      start: 0,
      now: 0,
      elapsed: 0,
      elapsedSincePrevious: 0
    })
  });
  var ScheduleProto = {
    [TypeId8]: {
      _Out: identity,
      _In: identity,
      _Env: identity
    },
    pipe() {
      return pipeArguments(this, arguments);
    }
  };
  var isSchedule = (u) => hasProperty(u, TypeId8);
  var fromStep = (step) => {
    const self = Object.create(ScheduleProto);
    self.step = step;
    return self;
  };
  var metadataFn = () => {
    let n = 0;
    let previous;
    let start;
    return (now, input) => {
      if (start === void 0) start = now;
      const elapsed = now - start;
      const elapsedSincePrevious = previous === void 0 ? 0 : now - previous;
      previous = now;
      return {
        input,
        attempt: ++n,
        start,
        now,
        elapsed,
        elapsedSincePrevious
      };
    };
  };
  var fromStepWithMetadata = (step) => fromStep(map(step, (f) => {
    const meta = metadataFn();
    return (now, input) => f(meta(now, input));
  }));
  var toStep = (schedule2) => catchCause(schedule2.step, (cause) => succeed3(() => failCause(cause)));
  var toStepWithMetadata = (schedule2) => clockWith((clock) => map(toStep(schedule2), (step) => {
    const metaFn = metadataFn();
    return (input) => suspend(() => {
      const now = clock.currentTimeMillisUnsafe();
      return flatMap(step(now, input), ([output, duration]) => {
        const meta = metaFn(now, input);
        meta.output = output;
        meta.duration = duration;
        return as(sleep(duration), meta);
      });
    });
  }));
  var passthrough = (self) => fromStep(map(toStep(self), (step) => (now, input) => matchEffect2(step(now, input), {
    onSuccess: (result3) => succeed3([input, result3[1]]),
    onFailure: failCause,
    onDone: () => done2(input)
  })));
  var recurs = (times) => while_(forever2, ({
    attempt
  }) => succeed3(attempt <= times));
  var spaced = (duration) => {
    const decoded = fromInputUnsafe(duration);
    return fromStepWithMetadata(succeed3((meta) => succeed3([meta.attempt - 1, decoded])));
  };
  var while_ = /* @__PURE__ */ dual(2, (self, predicate) => fromStep(map(toStep(self), (step) => {
    const meta = metadataFn();
    return (now, input) => flatMap(step(now, input), (result3) => {
      const [output, duration] = result3;
      const eff = predicate({
        ...meta(now, input),
        output,
        duration
      });
      return flatMap(isEffect(eff) ? eff : succeed3(eff), (check) => check ? succeed3(result3) : done2(output));
    });
  })));
  var forever2 = /* @__PURE__ */ spaced(zero);

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/internal/layer.js
  var provideLayer = (self, layer, options) => scopedWith((scope3) => flatMap(options?.local ? buildWithMemoMap(layer, makeMemoMapUnsafe(), scope3) : buildWithScope(layer, scope3), (context3) => provideContext(self, context3)));
  var provide3 = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, source, options) => isContext(source) ? provideContext(self, source) : provideLayer(self, Array.isArray(source) ? mergeAll2(...source) : source, options));

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/internal/schedule.js
  var repeatOrElse = /* @__PURE__ */ dual(3, (self, schedule2, orElse) => flatMap(toStepWithMetadata(schedule2), (step) => {
    let meta = CurrentMetadata2.defaultValue();
    return catch_(forever(tap(flatMap(suspend(() => provideService(self, CurrentMetadata2, meta)), step), (meta_) => sync(() => {
      meta = meta_;
    })), {
      disableYield: true
    }), (error) => isDone(error) ? succeed3(error.value) : orElse(error, meta.attempt === 0 ? none2() : some2(meta)));
  }));
  var retryOrElse = /* @__PURE__ */ dual(3, (self, policy, orElse) => flatMap(toStepWithMetadata(policy), (step) => {
    let meta = CurrentMetadata2.defaultValue();
    let lastError;
    const loop = catch_(suspend(() => provideService(self, CurrentMetadata2, meta)), (error) => {
      lastError = error;
      return flatMap(step(error), (meta_) => {
        meta = meta_;
        return loop;
      });
    });
    return catchDone(loop, (out) => internalCall(() => orElse(lastError, out)));
  }));
  var repeat = /* @__PURE__ */ dual(2, (self, options) => {
    const schedule2 = typeof options === "function" ? options(identity) : isSchedule(options) ? options : buildFromOptions(options);
    return repeatOrElse(self, schedule2, fail3);
  });
  var retry = /* @__PURE__ */ dual(2, (self, options) => {
    const schedule2 = typeof options === "function" ? options(identity) : isSchedule(options) ? options : buildFromOptions(options);
    return retryOrElse(self, schedule2, fail3);
  });
  var scheduleFrom = /* @__PURE__ */ dual(3, (self, initial, schedule2) => flatMap(toStepWithMetadata(schedule2), (step) => {
    let meta = CurrentMetadata2.defaultValue();
    const selfWithMeta = suspend(() => provideService(self, CurrentMetadata2, meta));
    return catch_(flatMap(step(initial), (meta_) => {
      meta = meta_;
      const body = constant(flatMap(selfWithMeta, step));
      return whileLoop({
        while: constTrue,
        body,
        step(meta_2) {
          meta = meta_2;
        }
      });
    }), (error) => isDone(error) ? succeed3(error.value) : fail3(error));
  }));
  var passthroughForever = /* @__PURE__ */ passthrough(forever2);
  var buildFromOptions = (options) => {
    let schedule2 = options.schedule ? passthrough(options.schedule) : passthroughForever;
    if (options.while) {
      schedule2 = while_(schedule2, ({
        input
      }) => {
        const applied = options.while(input);
        return isEffect(applied) ? applied : succeed3(applied);
      });
    }
    if (options.until) {
      schedule2 = while_(schedule2, ({
        input
      }) => {
        const applied = options.until(input);
        return isEffect(applied) ? map(applied, (b) => !b) : succeed3(!applied);
      });
    }
    if (options.times !== void 0) {
      schedule2 = while_(schedule2, ({
        attempt
      }) => succeed3(attempt <= options.times));
    }
    return schedule2;
  };

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/internal/executionPlan.js
  var makeEventEmitter = (onEvent, currentMetadata) => {
    let lastStepIndex = -1;
    let stepAttempt = 0;
    const emit = (event) => ignoreCause(onEvent(event));
    return {
      begin: clockWith((clock) => suspend(() => {
        const meta = currentMetadata();
        if (meta.stepIndex !== lastStepIndex) {
          lastStepIndex = meta.stepIndex;
          stepAttempt = 0;
        }
        stepAttempt++;
        const state = {
          attempt: meta.attempt,
          stepAttempt,
          stepIndex: meta.stepIndex,
          startNanos: clock.monotonicTimeNanosUnsafe()
        };
        return as(emit({
          _tag: "AttemptStart",
          attempt: state.attempt,
          stepAttempt: state.stepAttempt,
          stepIndex: state.stepIndex
        }), state);
      })),
      end: (state, exit3) => clockWith((clock) => {
        const duration = nanos(clock.monotonicTimeNanosUnsafe() - state.startNanos);
        return emit(exit3._tag === "Success" ? {
          _tag: "AttemptSuccess",
          attempt: state.attempt,
          stepAttempt: state.stepAttempt,
          stepIndex: state.stepIndex,
          duration
        } : {
          _tag: "AttemptFailure",
          attempt: state.attempt,
          stepAttempt: state.stepAttempt,
          stepIndex: state.stepIndex,
          duration,
          cause: exit3.cause
        });
      })
    };
  };
  var withExecutionPlan = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, plan, options) => suspend(() => {
    let i = 0;
    let meta = {
      attempt: 0,
      stepIndex: 0
    };
    const provideMeta = provideServiceEffect(CurrentMetadata, sync(() => {
      meta = {
        attempt: meta.attempt + 1,
        stepIndex: i
      };
      return meta;
    }));
    const emitter = options?.onEvent === void 0 ? void 0 : makeEventEmitter(options.onEvent, () => meta);
    const instrument = emitter === void 0 ? identity : (attempt) => uninterruptibleMask((restore) => flatMap(emitter.begin, (state) => onExit(restore(attempt), (exit3) => emitter.end(state, exit3))));
    let result3;
    return flatMap(whileLoop({
      while: () => i < plan.steps.length && (result3 === void 0 || isFailure2(result3)),
      body() {
        const step = plan.steps[i];
        let nextEffect = provideMeta(instrument(provide3(self, step.provide)));
        if (result3) {
          let attempted = false;
          const wrapped = nextEffect;
          nextEffect = suspend(() => {
            if (attempted) return wrapped;
            attempted = true;
            return fromResult(result3);
          });
          nextEffect = retry(nextEffect, scheduleFromStep(step, false));
        } else {
          const schedule2 = scheduleFromStep(step, true);
          nextEffect = schedule2 ? retry(nextEffect, schedule2) : nextEffect;
        }
        return result(nextEffect);
      },
      step(result_) {
        result3 = result_;
        i++;
      }
    }), () => fromResult(result3));
  }));
  var scheduleFromStep = (step, first) => {
    if (!first) {
      return buildFromOptions({
        schedule: step.schedule ? step.schedule : step.attempts ? void 0 : scheduleOnce,
        times: step.attempts,
        while: step.while
      });
    } else if (step.attempts === 1 || !(step.schedule || step.attempts)) {
      return void 0;
    }
    return buildFromOptions({
      schedule: step.schedule,
      while: step.while,
      times: step.attempts ? step.attempts - 1 : void 0
    });
  };
  var scheduleOnce = /* @__PURE__ */ recurs(1);

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Request.js
  var TypeId9 = "~effect/Request";
  var requestVariance = /* @__PURE__ */ byReferenceUnsafe({
    /* c8 ignore next */
    _E: (_) => _,
    /* c8 ignore next */
    _A: (_) => _,
    /* c8 ignore next */
    _R: (_) => _
  });
  var RequestPrototype = {
    ...StructuralProto,
    [TypeId9]: requestVariance
  };
  var makeEntry = (options) => options;

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/internal/request.js
  var request = /* @__PURE__ */ dual(2, (self, resolver) => {
    const withResolver = (resolver2) => callback((resume) => {
      const entry = addEntry(resolver2, self, resume, getCurrentFiber());
      return maybeRemoveEntry(resolver2, entry);
    });
    return isEffect(resolver) ? flatMap(resolver, withResolver) : withResolver(resolver);
  });
  var requestUnsafe = (self, options) => {
    const entry = addEntry(options.resolver, self, options.onExit, {
      context: options.context,
      cache: {
        scheduler: get(options.context, Scheduler)
      }
    });
    return () => removeEntryUnsafe(options.resolver, entry);
  };
  var batchPool = [];
  var pendingBatches = /* @__PURE__ */ new WeakMap();
  var addEntry = (resolver, request3, resume, fiber3) => {
    let batchMap = pendingBatches.get(resolver);
    if (!batchMap) {
      batchMap = /* @__PURE__ */ new Map();
      pendingBatches.set(resolver, batchMap);
    }
    let batch;
    let completed = false;
    const entry = makeEntry({
      request: request3,
      context: fiber3.context,
      uninterruptible: false,
      completeUnsafe(effect) {
        if (completed) return;
        completed = true;
        if (batch && !batch.entrySet.delete(entry)) return;
        resume(effect);
      }
    });
    if (resolver.preCheck !== void 0 && !resolver.preCheck(entry)) {
      return entry;
    }
    const key = resolver.batchKey(entry);
    batch = batchMap.get(key);
    if (!batch) {
      if (batchPool.length > 0) {
        batch = batchPool.pop();
        batch.key = key;
        batch.resolver = resolver;
        batch.map = batchMap;
      } else {
        const newBatch = {
          key,
          resolver,
          map: batchMap,
          entrySet: /* @__PURE__ */ new Set(),
          entries: /* @__PURE__ */ new Set(),
          delayEffect: flatMap(suspend(() => newBatch.resolver.delay), (_) => runBatch(newBatch)),
          run: onExit(suspend(() => newBatch.resolver.runAll(Array.from(newBatch.entries), newBatch.key)), (exit3) => {
            for (const entry2 of newBatch.entrySet) {
              entry2.completeUnsafe(exit3._tag === "Success" ? exitDie(new Error("Effect.request: RequestResolver did not complete request", {
                cause: entry2.request
              })) : exit3);
            }
            newBatch.entries.clear();
            if (batchPool.length < 128) {
              newBatch.entrySet.clear();
              newBatch.key = void 0;
              newBatch.fiber = void 0;
              newBatch.resolver = void 0;
              newBatch.map = void 0;
              batchPool.push(newBatch);
            }
            return void_;
          })
        };
        batch = newBatch;
      }
      batchMap.set(key, batch);
      batch.fiber = runForkWith(fiber3.context)(batch.delayEffect, {
        scheduler: fiber3.cache.scheduler
      });
    }
    batch.entrySet.add(entry);
    batch.entries.add(entry);
    if (batch.resolver.collectWhile(batch.entries)) return entry;
    batch.fiber.interruptUnsafe(fiber3.id);
    batch.fiber = runForkWith(fiber3.context)(runBatch(batch), {
      scheduler: fiber3.cache.scheduler
    });
    return entry;
  };
  var removeEntryUnsafe = (resolver, entry) => {
    if (entry.uninterruptible) return;
    const batchMap = pendingBatches.get(resolver);
    if (!batchMap) return;
    const key = resolver.batchKey(entry);
    const batch = batchMap.get(key);
    if (!batch) return;
    if (!batch.entries.delete(entry)) return;
    batch.entrySet.delete(entry);
    let fiber3;
    if (batch.entries.size === 0) {
      batchMap.delete(key);
      fiber3 = batch.fiber;
    }
    entry.completeUnsafe(exitInterrupt());
    fiber3?.interruptUnsafe();
  };
  var maybeRemoveEntry = (resolver, entry) => sync(() => removeEntryUnsafe(resolver, entry));
  function runBatch(batch) {
    if (!batch.map.has(batch.key)) return void_;
    batch.map.delete(batch.key);
    return batch.run;
  }

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Metric.js
  var CurrentMetricAttributesKey = "effect/Metric/CurrentMetricAttributes";
  var CurrentMetricAttributes = /* @__PURE__ */ Reference(CurrentMetricAttributesKey, {
    defaultValue: () => ({})
  });
  var MetricRegistryKey = "effect/Metric/MetricRegistry";
  var MetricRegistry = /* @__PURE__ */ Reference(MetricRegistryKey, {
    defaultValue: () => /* @__PURE__ */ new Map()
  });
  var TypeId10 = "~effect/Metric";
  var Metric$ = class {
    [TypeId10] = TypeId10;
    #metadata = /* @__PURE__ */ new WeakMap();
    id;
    description;
    attributes;
    constructor(id, description, attributes) {
      this.id = id;
      this.description = description;
      this.attributes = attributes;
    }
    valueUnsafe(context3) {
      return this.hook(context3).get(context3);
    }
    modifyUnsafe(input, context3) {
      return this.hook(context3).modify(input, context3);
    }
    updateUnsafe(input, context3) {
      return this.hook(context3).update(input, context3);
    }
    hook(context3) {
      const extraAttributes = get(context3, CurrentMetricAttributes);
      if (Object.keys(extraAttributes).length > 0) {
        return this.getOrCreate(context3, mergeAttributes(this.attributes, extraAttributes)).hooks;
      }
      const registry = get(context3, MetricRegistry);
      let metadata = this.#metadata.get(registry);
      if (isUndefined(metadata)) {
        metadata = this.getOrCreate(context3, this.attributes);
        this.#metadata.set(registry, metadata);
      }
      return metadata.hooks;
    }
    getOrCreate(context3, attributes) {
      const key = makeKey(this, attributes);
      const registry = get(context3, MetricRegistry);
      if (registry.has(key)) {
        return registry.get(key);
      }
      const hooks = this.createHooks();
      const meta = {
        id: this.id,
        type: this.type,
        description: this.description,
        attributes: attributesToRecord(attributes),
        hooks
      };
      registry.set(key, meta);
      return meta;
    }
    pipe() {
      return pipeArguments(this, arguments);
    }
  };
  var update = /* @__PURE__ */ dual(2, (self, input) => contextWith((services) => sync(() => self.updateUnsafe(input, services))));
  function makeKey(metric, attributes) {
    let key = `${metric.type}:${metric.id}`;
    if (isNotUndefined(metric.description)) {
      key += `:${metric.description}`;
    }
    if (isNotUndefined(attributes)) {
      key += `:${serializeAttributes(attributes)}`;
    }
    return key;
  }
  function serializeAttributes(attributes) {
    const entries = Array.isArray(attributes) ? [...attributes] : Object.entries(attributes);
    entries.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    return JSON.stringify(entries);
  }
  function mergeAttributes(self, other) {
    return {
      ...attributesToRecord(self),
      ...attributesToRecord(other)
    };
  }
  function attributesToRecord(attributes) {
    if (isNotUndefined(attributes) && Array.isArray(attributes)) {
      return attributes.reduce((acc, [key, value]) => {
        assignProperty(acc, key, value);
        return acc;
      }, {});
    }
    return attributes;
  }

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Effect.js
  var TypeId11 = EffectTypeId;
  var isEffect2 = isEffect;
  var all2 = all;
  var partition3 = partition2;
  var reduce2 = reduce;
  var validate2 = validate;
  var findFirst2 = findFirst;
  var findFirstFilter2 = findFirstFilter;
  var forEach2 = forEach;
  var head2 = head;
  var whileLoop2 = whileLoop;
  var promise2 = promise;
  var tryPromise2 = tryPromise;
  var succeed4 = succeed3;
  var succeedNone2 = succeedNone;
  var succeedSome2 = succeedSome;
  var suspend2 = suspend;
  var sync2 = sync;
  var void_2 = void_;
  var undefined_2 = undefined_;
  var callback2 = callback;
  var never2 = never;
  var Do2 = Do;
  var bindTo3 = bindTo2;
  var let_3 = let_2;
  var bind3 = bind2;
  var gen2 = gen;
  var fail4 = fail3;
  var failSync2 = failSync;
  var failCause2 = failCause;
  var failCauseSync2 = failCauseSync;
  var die2 = die;
  var try_2 = try_;
  var yieldNow2 = yieldNow;
  var yieldNowWith2 = yieldNowWith;
  var withFiber2 = withFiber;
  var withFiberSucceed2 = withFiberSucceed;
  var fromResult2 = fromResult;
  var fromOption3 = fromOption2;
  var transposeOption2 = transposeOption;
  var fromNullishOr2 = fromNullishOr;
  var flatMap2 = flatMap;
  var flatten3 = flatten2;
  var andThen2 = andThen;
  var tap2 = tap;
  var result2 = result;
  var option2 = option;
  var exit2 = exit;
  var map2 = map;
  var as2 = as;
  var asSome2 = asSome;
  var asVoid2 = asVoid;
  var flip2 = flip;
  var zip2 = zip;
  var zipWith2 = zipWith;
  var catch_2 = catch_;
  var catchTag2 = catchTag;
  var catchTags2 = catchTags;
  var catchReason2 = catchReason;
  var catchReasons2 = catchReasons;
  var unwrapReason2 = unwrapReason;
  var catchCause2 = catchCause;
  var catchDefect2 = catchDefect;
  var catchIf2 = catchIf;
  var catchFilter2 = catchFilter;
  var catchNoSuchElement2 = catchNoSuchElement;
  var catchCauseIf2 = catchCauseIf;
  var catchCauseFilter2 = catchCauseFilter;
  var mapError2 = mapError;
  var mapBoth2 = mapBoth;
  var orDie2 = orDie;
  var tapError2 = tapError;
  var tapErrorTag2 = tapErrorTag;
  var tapCause2 = tapCause;
  var tapCauseIf2 = tapCauseIf;
  var tapCauseFilter2 = tapCauseFilter;
  var tapDefect2 = tapDefect;
  var eventually2 = eventually;
  var retry2 = retry;
  var retryOrElse2 = retryOrElse;
  var sandbox2 = sandbox;
  var ignore2 = ignore;
  var ignoreCause2 = ignoreCause;
  var withExecutionPlan2 = withExecutionPlan;
  var withErrorReporting2 = withErrorReporting;
  var orElseSucceed2 = orElseSucceed;
  var firstSuccessOf2 = firstSuccessOf;
  var timeout2 = timeout;
  var timeoutOption2 = timeoutOption;
  var timeoutOrElse2 = timeoutOrElse;
  var delay2 = delay;
  var sleep2 = sleep;
  var timed2 = timed;
  var raceAll2 = raceAll;
  var raceAllFirst2 = raceAllFirst;
  var race2 = race;
  var raceFirst2 = raceFirst;
  var filter3 = filter2;
  var filterMap2 = filterMap;
  var filterMapEffect2 = filterMapEffect;
  var filterOrElse2 = filterOrElse;
  var filterMapOrElse2 = filterMapOrElse;
  var filterOrFail2 = filterOrFail;
  var filterMapOrFail2 = filterMapOrFail;
  var when2 = when;
  var match4 = match3;
  var matchEager2 = matchEager;
  var matchCause2 = matchCause;
  var matchCauseEager2 = matchCauseEager;
  var matchCauseEffectEager2 = matchCauseEffectEager;
  var matchCauseEffect2 = matchCauseEffect;
  var matchEffect3 = matchEffect;
  var isFailure4 = isFailure3;
  var isSuccess5 = isSuccess3;
  var context2 = context;
  var contextWith2 = contextWith;
  var provide4 = provide3;
  var provideContext2 = provideContext;
  var setContext2 = setContext;
  var service2 = service;
  var serviceOption2 = serviceOption;
  var updateContext2 = updateContext;
  var updateService2 = updateService;
  var updateServiceScoped2 = updateServiceScoped;
  var provideService2 = provideService;
  var provideServiceEffect2 = provideServiceEffect;
  var scope2 = scope;
  var scoped2 = scoped;
  var scopedWith2 = scopedWith;
  var acquireRelease2 = acquireRelease;
  var acquireDisposable2 = acquireDisposable;
  var acquireUseRelease2 = acquireUseRelease;
  var addFinalizer2 = addFinalizer;
  var ensuring2 = ensuring;
  var onError2 = onError;
  var onErrorIf2 = onErrorIf;
  var onErrorFilter2 = onErrorFilter;
  var onExitPrimitive2 = onExitPrimitive;
  var onExit2 = onExit;
  var onExitIf2 = onExitIf;
  var onExitFilter2 = onExitFilter;
  var cached2 = cached;
  var cachedWithTTL2 = cachedWithTTL;
  var cachedInvalidateWithTTL2 = cachedInvalidateWithTTL;
  var interrupt2 = interrupt;
  var interruptible2 = interruptible;
  var onInterrupt2 = onInterrupt;
  var uninterruptible2 = uninterruptible;
  var uninterruptibleMask2 = uninterruptibleMask;
  var interruptibleMask2 = interruptibleMask;
  var abortSignal2 = abortSignal;
  var forever3 = forever;
  var repeat2 = repeat;
  var repeatOrElse2 = repeatOrElse;
  var replicate2 = replicate;
  var replicateEffect2 = replicateEffect;
  var schedule = /* @__PURE__ */ dual(2, (self, schedule2) => scheduleFrom2(self, void 0, schedule2));
  var scheduleFrom2 = scheduleFrom;
  var tracer2 = tracer;
  var withTracer2 = withTracer;
  var withTracerEnabled2 = withTracerEnabled;
  var withTracerTiming2 = withTracerTiming;
  var annotateSpans2 = annotateSpans;
  var annotateCurrentSpan2 = annotateCurrentSpan;
  var currentSpan2 = currentSpan;
  var currentParentSpan2 = currentParentSpan;
  var spanAnnotations2 = spanAnnotations;
  var spanLinks2 = spanLinks;
  var linkSpans2 = linkSpans;
  var makeSpan2 = makeSpan;
  var makeSpanScoped2 = makeSpanScoped;
  var useSpan2 = useSpan;
  var withSpan2 = withSpan;
  var withSpanScoped2 = withSpanScoped;
  var withParentSpan2 = withParentSpan;
  var request2 = request;
  var requestUnsafe2 = requestUnsafe;
  var forkChild2 = forkChild;
  var forkIn2 = forkIn;
  var forkScoped2 = forkScoped;
  var forkDetach2 = forkDetach;
  var awaitAllChildren2 = awaitAllChildren;
  var fiber2 = fiber;
  var fiberId2 = fiberId;
  var runFork2 = runFork;
  var runForkWith2 = runForkWith;
  var runCallbackWith2 = runCallbackWith;
  var runCallback2 = runCallback;
  var runPromise2 = runPromise;
  var runPromiseWith2 = runPromiseWith;
  var runPromiseExit2 = runPromiseExit;
  var runPromiseExitWith2 = runPromiseExitWith;
  var runSync2 = runSync;
  var runSyncWith2 = runSyncWith;
  var runSyncExit2 = runSyncExit;
  var runSyncExitWith2 = runSyncExitWith;
  var fnUntraced2 = fnUntraced;
  var fn2 = fn;
  var clockWith2 = clockWith;
  var logWithLevel2 = logWithLevel;
  var log = /* @__PURE__ */ logWithLevel();
  var logFatal = /* @__PURE__ */ logWithLevel("Fatal");
  var logWarning = /* @__PURE__ */ logWithLevel("Warn");
  var logError = /* @__PURE__ */ logWithLevel("Error");
  var logInfo = /* @__PURE__ */ logWithLevel("Info");
  var logDebug = /* @__PURE__ */ logWithLevel("Debug");
  var logTrace = /* @__PURE__ */ logWithLevel("Trace");
  var withLogger = /* @__PURE__ */ dual(2, (effect, logger) => updateService(effect, CurrentLoggers, (loggers) => /* @__PURE__ */ new Set([...loggers, logger])));
  var annotateLogs = /* @__PURE__ */ dual((args2) => isEffect2(args2[0]), (effect, ...args2) => updateService(effect, CurrentLogAnnotations2, (annotations) => {
    const newAnnotations = args2.length === 1 ? {
      ...annotations,
      ...args2[0]
    } : {
      ...annotations
    };
    if (args2.length === 1) {
      return newAnnotations;
    } else {
      assignProperty(newAnnotations, args2[0], args2[1]);
    }
    return newAnnotations;
  }));
  var annotateLogsScoped2 = annotateLogsScoped;
  var withLogSpan = /* @__PURE__ */ dual(2, (effect, label) => flatMap(currentTimeMillis, (now) => updateService(effect, CurrentLogSpans2, (spans) => {
    const span = [label, now];
    return [span, ...spans];
  })));
  var track = /* @__PURE__ */ dual((args2) => isEffect2(args2[0]), (self, metric, f) => onExit2(self, (exit3) => {
    const input = f === void 0 ? exit3 : internalCall(() => f(exit3));
    return update(metric, input);
  }));
  var trackSuccesses = /* @__PURE__ */ dual((args2) => isEffect2(args2[0]), (self, metric, f) => tap2(self, (value) => {
    const input = f === void 0 ? value : f(value);
    return update(metric, input);
  }));
  var trackErrors = /* @__PURE__ */ dual((args2) => isEffect2(args2[0]), (self, metric, f) => tapError2(self, (error) => {
    const input = f === void 0 ? error : internalCall(() => f(error));
    return update(metric, input);
  }));
  var trackDefects = /* @__PURE__ */ dual((args2) => isEffect2(args2[0]), (self, metric, f) => tapDefect2(self, (defect) => {
    const input = f === void 0 ? defect : internalCall(() => f(defect));
    return update(metric, input);
  }));
  var trackDuration = /* @__PURE__ */ dual((args2) => isEffect2(args2[0]), (self, metric, f) => clockWith2((clock) => {
    const startTime = clock.monotonicTimeNanosUnsafe();
    return onExit2(self, () => {
      const endTime = clock.monotonicTimeNanosUnsafe();
      const duration = subtract(fromInputUnsafe(endTime), fromInputUnsafe(startTime));
      const input = f === void 0 ? duration : internalCall(() => f(duration));
      return update(metric, input);
    });
  }));
  var Transaction = class extends (/* @__PURE__ */ Service()("effect/Effect/Transaction")) {
  };
  var tx = (effect) => withFiber2((fiber3) => {
    let state = getOrUndefined2(fiber3.context, Transaction);
    if (state) {
      return effect;
    }
    state = {
      journal: /* @__PURE__ */ new Map(),
      retry: false
    };
    let result3;
    return uninterruptibleMask2((restore) => flatMap2(whileLoop2({
      while: () => !result3,
      body: constant(restore(effect).pipe(provideService2(Transaction, state), tapCause2(() => {
        if (!state.retry) return void_2;
        return restore(awaitPendingTransaction(state));
      }), exit2)),
      step(exit3) {
        if (state.retry || !isTransactionConsistent(state)) {
          return clearTransaction(state);
        }
        if (isSuccess4(exit3)) {
          commitTransaction(fiber3, state);
        } else {
          clearTransaction(state);
        }
        result3 = exit3;
      }
    }), () => result3));
  });
  var isTransactionConsistent = (state) => {
    for (const [ref, {
      version
    }] of state.journal) {
      if (ref.version !== version) {
        return false;
      }
    }
    return true;
  };
  var awaitPendingTransaction = (state) => suspend2(() => {
    const key = {};
    const refs = Array.from(state.journal.keys());
    const clearPending = () => {
      for (const clear3 of refs) {
        clear3.pending.delete(key);
      }
    };
    return callback2((resume) => {
      const onCall = () => {
        clearPending();
        resume(void_2);
      };
      for (const ref of refs) {
        ref.pending.set(key, onCall);
      }
      return sync2(clearPending);
    });
  });
  function commitTransaction(fiber3, state) {
    for (const [ref, {
      value
    }] of state.journal) {
      if (value !== ref.value) {
        ref.version = ref.version + 1;
        ref.value = value;
      }
      for (const pending of ref.pending.values()) {
        fiber3.currentDispatcher.scheduleTask(pending, 0);
      }
      ref.pending.clear();
    }
  }
  function clearTransaction(state) {
    state.retry = false;
    state.journal.clear();
  }
  var txRetry = /* @__PURE__ */ flatMap2(Transaction, (state) => {
    state.retry = true;
    return interrupt2;
  });
  var effectify = (fn3, onError3, onSyncError) => (...args2) => callback2((resume) => {
    try {
      fn3(...args2, (err, result3) => {
        if (err) {
          resume(fail4(onError3 ? onError3(err, args2) : err));
        } else {
          resume(succeed4(result3));
        }
      });
    } catch (err) {
      resume(onSyncError ? fail4(onSyncError(err, args2)) : die2(err));
    }
  });
  var satisfiesSuccessType = () => (effect) => effect;
  var satisfiesErrorType = () => (effect) => effect;
  var satisfiesServicesType = () => (effect) => effect;
  var mapEager2 = mapEager;
  var mapErrorEager2 = mapErrorEager;
  var mapBothEager2 = mapBothEager;
  var flatMapEager2 = flatMapEager;
  var catchEager2 = catchEager;
  var fnUntracedEager2 = fnUntracedEager;

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Fiber.js
  var Fiber_exports = {};
  __export(Fiber_exports, {
    await: () => await_,
    awaitAll: () => awaitAll,
    getCurrent: () => getCurrent,
    interrupt: () => interrupt3,
    interruptAll: () => interruptAll,
    interruptAllAs: () => interruptAllAs,
    interruptAs: () => interruptAs,
    isFiber: () => isFiber,
    join: () => join,
    joinAll: () => joinAll,
    runIn: () => runIn
  });
  var await_ = fiberAwait;
  var awaitAll = fiberAwaitAll;
  var join = fiberJoin;
  var joinAll = fiberJoinAll;
  var interrupt3 = fiberInterrupt;
  var interruptAs = fiberInterruptAs;
  var interruptAll = fiberInterruptAll;
  var interruptAllAs = fiberInterruptAllAs;
  var isFiber = (u) => hasProperty(u, FiberTypeId);
  var getCurrent = getCurrentFiber;
  var runIn = fiberRunIn;

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/MutableList.js
  var Empty = /* @__PURE__ */ Symbol.for("effect/MutableList/Empty");
  var make5 = () => ({
    head: void 0,
    tail: void 0,
    length: 0
  });
  var emptyBucket = () => ({
    array: [],
    mutable: true,
    offset: 0,
    next: void 0
  });
  var append = (self, message) => {
    if (!self.tail) {
      self.head = self.tail = emptyBucket();
    } else if (!self.tail.mutable) {
      self.tail.next = emptyBucket();
      self.tail = self.tail.next;
    }
    self.tail.array.push(message);
    self.length++;
  };
  var appendAll = (self, messages) => appendAllUnsafe(self, fromIterable(messages), !Array.isArray(messages));
  var appendAllUnsafe = (self, messages, mutable = false) => {
    if (messages.length === 0) {
      return 0;
    }
    const chunk = {
      array: messages,
      mutable,
      offset: 0,
      next: void 0
    };
    if (self.head) {
      self.tail = self.tail.next = chunk;
    } else {
      self.head = self.tail = chunk;
    }
    self.length += messages.length;
    return messages.length;
  };
  var clear = (self) => {
    self.head = self.tail = void 0;
    self.length = 0;
  };
  var takeN = (self, n) => {
    n = normalize(n);
    if (n <= 0 || !self.head) return [];
    n = Math.min(n, self.length);
    if (n === self.length && self.head?.offset === 0 && !self.head.next) {
      const array3 = self.head.array;
      clear(self);
      return array3;
    }
    const array2 = new Array(n);
    let index = 0;
    let chunk = self.head;
    while (chunk) {
      while (chunk.offset < chunk.array.length) {
        array2[index++] = chunk.array[chunk.offset];
        if (chunk.mutable) chunk.array[chunk.offset] = void 0;
        chunk.offset++;
        if (index === n) {
          self.head = chunk;
          self.length -= n;
          if (self.length === 0) clear(self);
          return array2;
        }
      }
      chunk = chunk.next;
    }
    clear(self);
    return array2;
  };
  var takeAll = (self) => takeN(self, self.length);
  var take = (self) => {
    if (!self.head) return Empty;
    const message = self.head.array[self.head.offset];
    if (self.head.mutable) self.head.array[self.head.offset] = void 0;
    self.head.offset++;
    self.length--;
    if (self.head.offset === self.head.array.length) {
      if (self.head.next) {
        self.head = self.head.next;
      } else {
        clear(self);
      }
    }
    return message;
  };

  // node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect/dist/Queue.js
  var Queue_exports = {};
  __export(Queue_exports, {
    asDequeue: () => asDequeue,
    asEnqueue: () => asEnqueue,
    await: () => await_2,
    bounded: () => bounded,
    clear: () => clear2,
    collect: () => collect,
    dropping: () => dropping,
    end: () => end,
    endUnsafe: () => endUnsafe,
    fail: () => fail5,
    failCause: () => failCause3,
    failCauseUnsafe: () => failCauseUnsafe,
    flush: () => flush,
    flushUnsafe: () => flushUnsafe,
    interrupt: () => interrupt4,
    into: () => into,
    isDequeue: () => isDequeue,
    isEnqueue: () => isEnqueue,
    isFull: () => isFull,
    isFullUnsafe: () => isFullUnsafe,
    isQueue: () => isQueue,
    make: () => make6,
    offer: () => offer,
    offerAll: () => offerAll,
    offerAllUnsafe: () => offerAllUnsafe,
    offerUnsafe: () => offerUnsafe,
    peek: () => peek,
    poll: () => poll,
    shutdown: () => shutdown,
    size: () => size,
    sizeUnsafe: () => sizeUnsafe,
    sliding: () => sliding,
    take: () => take2,
    takeAll: () => takeAll2,
    takeBetween: () => takeBetween,
    takeN: () => takeN2,
    takeUnsafe: () => takeUnsafe,
    unbounded: () => unbounded
  });
  var TypeId12 = "~effect/Queue";
  var EnqueueTypeId = "~effect/Queue/Enqueue";
  var DequeueTypeId = "~effect/Queue/Dequeue";
  var isQueue = (u) => hasProperty(u, TypeId12);
  var isEnqueue = (u) => hasProperty(u, EnqueueTypeId);
  var isDequeue = (u) => hasProperty(u, DequeueTypeId);
  var asEnqueue = (self) => self;
  var asDequeue = identity;
  var variance = {
    _A: identity,
    _E: identity
  };
  var QueueProto = {
    [TypeId12]: variance,
    [EnqueueTypeId]: variance,
    [DequeueTypeId]: variance,
    ...PipeInspectableProto,
    toJSON() {
      return {
        _id: "effect/Queue",
        state: this.state._tag,
        size: sizeUnsafe(this)
      };
    }
  };
  var make6 = (options) => withFiber((fiber3) => {
    const self = Object.create(QueueProto);
    self.dispatcher = fiber3.currentDispatcher;
    self.capacity = options?.capacity ?? Number.POSITIVE_INFINITY;
    self.strategy = options?.strategy ?? "suspend";
    self.messages = make5();
    self.scheduleRunning = false;
    self.state = {
      _tag: "Open",
      takers: /* @__PURE__ */ new Set(),
      offers: /* @__PURE__ */ new Set(),
      awaiters: /* @__PURE__ */ new Set()
    };
    return succeed3(self);
  });
  var bounded = (capacity) => make6({
    capacity
  });
  var sliding = (capacity) => make6({
    capacity,
    strategy: "sliding"
  });
  var dropping = (capacity) => make6({
    capacity,
    strategy: "dropping"
  });
  var unbounded = () => make6();
  var offer = (self, message) => suspend(() => {
    if (self.state._tag !== "Open") {
      return exitFalse;
    } else if (self.messages.length >= self.capacity) {
      switch (self.strategy) {
        case "dropping":
          return exitFalse;
        case "suspend":
          if (self.capacity <= 0 && self.state.takers.size > 0) {
            append(self.messages, message);
            releaseTakers(self);
            return exitTrue;
          }
          return offerRemainingSingle(self, message);
        case "sliding":
          take(self.messages);
          append(self.messages, message);
          return exitTrue;
      }
    }
    append(self.messages, message);
    scheduleReleaseTaker(self);
    return exitTrue;
  });
  var offerUnsafe = (self, message) => {
    if (self.state._tag !== "Open") {
      return false;
    } else if (self.messages.length >= self.capacity) {
      if (self.strategy === "sliding") {
        take(self.messages);
        append(self.messages, message);
        return true;
      } else if (self.capacity <= 0 && self.state.takers.size > 0) {
        append(self.messages, message);
        releaseTakers(self);
        return true;
      }
      return false;
    }
    append(self.messages, message);
    scheduleReleaseTaker(self);
    return true;
  };
  var offerAll = (self, messages) => suspend(() => {
    if (self.state._tag !== "Open") {
      return succeed3(fromIterable(messages));
    }
    const remaining = offerAllUnsafe(self, messages);
    if (remaining.length === 0) {
      return exitSucceed([]);
    } else if (self.strategy === "dropping") {
      return succeed3(remaining);
    }
    return offerRemainingArray(self, remaining);
  });
  var offerAllUnsafe = (self, messages) => {
    if (self.state._tag !== "Open") {
      return fromIterable(messages);
    } else if (self.capacity === Number.POSITIVE_INFINITY || self.strategy === "sliding") {
      appendAll(self.messages, messages);
      if (self.strategy === "sliding") {
        takeN(self.messages, self.messages.length - self.capacity);
      }
      scheduleReleaseTaker(self);
      return [];
    }
    const free = self.capacity <= 0 ? self.state.takers.size : self.capacity - self.messages.length;
    if (free === 0) {
      return fromIterable(messages);
    }
    const remaining = [];
    let i = 0;
    for (const message of messages) {
      if (i < free) {
        append(self.messages, message);
      } else {
        remaining.push(message);
      }
      i++;
    }
    scheduleReleaseTaker(self);
    return remaining;
  };
  var fail5 = (self, error) => failCause3(self, causeFail(error));
  var failCause3 = /* @__PURE__ */ dual(2, (self, cause) => sync(() => failCauseUnsafe(self, cause)));
  var failCauseUnsafe = (self, cause) => {
    if (self.state._tag !== "Open") {
      return false;
    }
    const exit3 = exitFailCause(cause);
    const fail6 = exitZipRight(exit3, exitFailDone);
    if (self.state.offers.size === 0 && self.messages.length === 0) {
      finalize(self, fail6);
      return true;
    }
    self.state = {
      ...self.state,
      _tag: "Closing",
      exit: fail6
    };
    return true;
  };
  var end = (self) => failCause3(self, causeFail(Done()));
  var endUnsafe = (self) => failCauseUnsafe(self, causeFail(Done()));
  var interrupt4 = (self) => withFiber((fiber3) => failCause3(self, causeInterrupt(fiber3.id)));
  var shutdown = (self) => sync(() => {
    if (self.state._tag === "Done") {
      return true;
    }
    clear(self.messages);
    const offers = self.state.offers;
    finalize(self, self.state._tag === "Open" ? exitInterrupt2 : self.state.exit);
    if (offers.size > 0) {
      for (const entry of offers) {
        if (entry._tag === "Single") {
          entry.resume(exitFalse);
        } else {
          entry.resume(exitSucceed(entry.remaining.slice(entry.offset)));
        }
      }
      offers.clear();
    }
    return true;
  });
  var clear2 = (self) => suspend(() => {
    if (self.state._tag === "Done") {
      if (isDoneCause(self.state.exit.cause)) {
        return succeed3([]);
      }
      return self.state.exit;
    }
    const messages = takeAllUnsafe(self);
    releaseCapacity(self);
    return succeed3(messages);
  });
  var takeAll2 = (self) => takeBetween(self, 1, Number.POSITIVE_INFINITY);
  var collect = (self) => suspend(() => {
    const out = empty();
    return as(catchDone(whileLoop({
      while: constTrue,
      body: constant(takeAll2(self)),
      step(items) {
        for (let i = 0; i < items.length; i++) {
          out.push(items[i]);
        }
      }
    }), () => void_), out);
  });
  var takeN2 = (self, n) => takeBetween(self, n, n);
  var takeBetween = (self, min2, max2) => {
    min2 = normalize(min2);
    max2 = normalize(max2);
    return suspend(() => takeBetweenUnsafe(self, min2, max2) ?? andThen(awaitTake(self), takeBetween(self, 1, max2)));
  };
  var take2 = (self) => suspend(() => takeUnsafe(self) ?? andThen(awaitTake(self), take2(self)));
  var poll = (self) => suspend(() => {
    const result3 = takeUnsafe(self);
    if (result3 === void 0) {
      return succeed3(none2());
    }
    if (result3._tag === "Success") {
      return succeed3(some2(result3.value));
    }
    return succeed3(none2());
  });
  var peek = (self) => suspend(() => {
    if (self.state._tag === "Done") {
      return self.state.exit;
    }
    if (self.messages.length > 0 && self.messages.head) {
      return succeed3(self.messages.head.array[self.messages.head.offset]);
    }
    return andThen(awaitTake(self), peek(self));
  });
  var takeUnsafe = (self) => {
    if (self.state._tag === "Done") {
      return self.state.exit;
    }
    if (self.messages.length > 0) {
      const message = take(self.messages);
      releaseCapacity(self);
      return exitSucceed(message);
    } else if (self.capacity <= 0 && self.state.offers.size > 0) {
      const message = takeOfferUnsafe(self.state.offers);
      releaseCapacity(self);
      return exitSucceed(message);
    }
    return void 0;
  };
  var flushUnsafe = (self) => releaseTakers(self);
  var flush = (self) => sync(() => flushUnsafe(self));
  var await_2 = (self) => callback((resume) => {
    const awaiter = (effect) => resume(catchDone(effect, () => exitVoid));
    if (self.state._tag === "Done") {
      return awaiter(self.state.exit);
    }
    self.state.awaiters.add(awaiter);
    return sync(() => {
      if (self.state._tag !== "Done") {
        self.state.awaiters.delete(awaiter);
      }
    });
  });
  var size = (self) => sync(() => sizeUnsafe(self));
  var isFull = (self) => sync(() => isFullUnsafe(self));
  var sizeUnsafe = (self) => self.state._tag === "Done" ? 0 : self.messages.length;
  var isFullUnsafe = (self) => sizeUnsafe(self) === self.capacity;
  var into = /* @__PURE__ */ dual(2, (effect, self) => uninterruptibleMask((restore) => matchCauseEffect(restore(effect), {
    onFailure: (cause) => failCause3(self, cause),
    onSuccess: (_) => end(self)
  })));
  var exitFalse = /* @__PURE__ */ exitSucceed(false);
  var exitTrue = /* @__PURE__ */ exitSucceed(true);
  var exitFailDone = /* @__PURE__ */ exitFail(/* @__PURE__ */ Done());
  var exitInterrupt2 = /* @__PURE__ */ exitInterrupt();
  var releaseTakers = (self) => {
    if (self.state._tag === "Done" || self.state.takers.size === 0) {
      return;
    }
    for (const taker of self.state.takers) {
      self.state.takers.delete(taker);
      taker(exitVoid);
      if (self.messages.length === 0) {
        break;
      }
    }
  };
  var scheduleReleaseTaker = (self) => {
    if (self.scheduleRunning || self.state._tag === "Done" || self.state.takers.size === 0) {
      return;
    }
    self.scheduleRunning = true;
    self.dispatcher.scheduleTask(() => {
      self.scheduleRunning = false;
      releaseTakers(self);
    }, 0);
  };
  var takeBetweenUnsafe = (self, min2, max2) => {
    if (self.state._tag === "Done") {
      return self.state.exit;
    } else if (max2 <= 0 || min2 <= 0) {
      return exitSucceed([]);
    } else if (self.capacity <= 0 && self.messages.length === 0 && self.state.offers.size > 0) {
      const messages = [takeOfferUnsafe(self.state.offers)];
      releaseCapacity(self);
      return exitSucceed(messages);
    }
    min2 = Math.min(min2, self.capacity || 1);
    if (min2 <= self.messages.length) {
      const messages = takeN(self.messages, max2);
      releaseCapacity(self);
      return exitSucceed(messages);
    }
  };
  var offerRemainingSingle = (self, message) => {
    return callback((resume) => {
      if (self.state._tag !== "Open") {
        return resume(exitFalse);
      }
      const entry = {
        _tag: "Single",
        message,
        resume
      };
      self.state.offers.add(entry);
      return sync(() => {
        if (self.state._tag === "Open") {
          self.state.offers.delete(entry);
        }
      });
    });
  };
  var offerRemainingArray = (self, remaining) => {
    return callback((resume) => {
      if (self.state._tag !== "Open") {
        return resume(exitSucceed(remaining));
      }
      const entry = {
        _tag: "Array",
        remaining,
        offset: 0,
        resume
      };
      self.state.offers.add(entry);
      return sync(() => {
        if (self.state._tag === "Open") {
          self.state.offers.delete(entry);
        }
      });
    });
  };
  var takeOfferUnsafe = (offers) => {
    const entry = offers.values().next().value;
    if (entry._tag === "Single") {
      offers.delete(entry);
      entry.resume(exitTrue);
      return entry.message;
    }
    const message = entry.remaining[entry.offset++];
    if (entry.offset === entry.remaining.length) {
      offers.delete(entry);
      entry.resume(exitSucceed([]));
    }
    return message;
  };
  var releaseCapacity = (self) => {
    if (self.state._tag === "Done") {
      return isDoneCause(self.state.exit.cause);
    } else if (self.state.offers.size === 0) {
      if (self.state._tag === "Closing" && self.messages.length === 0) {
        finalize(self, self.state.exit);
        return isDoneCause(self.state.exit.cause);
      }
      return false;
    }
    for (const entry of self.state.offers) {
      let n = self.capacity - self.messages.length;
      if (n <= 0) break;
      else if (entry._tag === "Single") {
        append(self.messages, entry.message);
        self.state.offers.delete(entry);
        entry.resume(exitTrue);
      } else {
        for (; entry.offset < entry.remaining.length; entry.offset++) {
          if (n === 0) return false;
          append(self.messages, entry.remaining[entry.offset]);
          n--;
        }
        self.state.offers.delete(entry);
        entry.resume(exitSucceed([]));
      }
    }
    return false;
  };
  var awaitTake = (self) => callback((resume) => {
    if (self.state._tag === "Done") {
      return resume(self.state.exit);
    }
    self.state.takers.add(resume);
    return sync(() => {
      if (self.state._tag !== "Done") {
        self.state.takers.delete(resume);
      }
    });
  });
  var takeAllUnsafe = (self) => {
    if (self.messages.length > 0) {
      const messages = takeAll(self.messages);
      releaseCapacity(self);
      return messages;
    } else if (self.state._tag !== "Done" && self.state.offers.size > 0) {
      const messages = [takeOfferUnsafe(self.state.offers)];
      releaseCapacity(self);
      return messages;
    }
    return [];
  };
  var finalize = (self, exit3) => {
    if (self.state._tag === "Done") {
      return;
    }
    const openState = self.state;
    self.state = {
      _tag: "Done",
      exit: exit3
    };
    for (const taker of openState.takers) {
      taker(exit3);
    }
    openState.takers.clear();
    for (const awaiter of openState.awaiters) {
      awaiter(exit3);
    }
    openState.awaiters.clear();
  };

  // packages/efx-paint-host/dist/index.mjs
  function fnv1a(source) {
    let hash2 = 2166136261;
    for (let i = 0; i < source.length; i++) {
      hash2 ^= source.charCodeAt(i);
      hash2 = Math.imul(hash2, 16777619);
    }
    return hash2 >>> 0;
  }
  function avalanche(hash2) {
    let h = hash2 >>> 0;
    h ^= h >>> 15;
    h = Math.imul(h, 2246822519);
    h ^= h >>> 13;
    h = Math.imul(h, 3266489917);
    h ^= h >>> 16;
    return h >>> 0;
  }
  function mixStrokeSeed(strokeSeed, frame) {
    const base = Number.isFinite(strokeSeed) ? strokeSeed >>> 0 : 0;
    const local = Number.isFinite(frame) ? Math.trunc(frame) : 0;
    return avalanche(fnv1a(`paint-seed:${base}:${local}`));
  }
  var BAKE_TURN_CONCURRENCY = 2;
  function deferred() {
    let resolve;
    const promise3 = new Promise((next) => {
      resolve = next;
    });
    return { promise: promise3, resolve };
  }
  function createBakeHost(options = {}) {
    const concurrency = Math.max(1, Math.floor(options.concurrency ?? BAKE_TURN_CONCURRENCY));
    const slots = Effect_exports.runSync(Queue_exports.bounded(concurrency));
    for (let token = 0; token < concurrency; token += 1) Effect_exports.runSync(Queue_exports.offer(slots, token));
    const inFlight = /* @__PURE__ */ new Set();
    const liveTurns = /* @__PURE__ */ new Set();
    let flushDepth = 0;
    let generation2 = 0;
    let stopped = false;
    const beginFlush = () => {
      flushDepth += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        flushDepth -= 1;
      };
    };
    const drain = async () => {
      while (inFlight.size > 0) {
        await Promise.allSettled([...inFlight]);
      }
    };
    const cancelLiveTurns = (predicate, bumpGeneration) => {
      const toCancel = [...liveTurns].filter(predicate);
      if (toCancel.length === 0) return;
      if (bumpGeneration) generation2 += 1;
      for (const turn of toCancel) turn.cancel();
    };
    const interrupt5 = () => {
      cancelLiveTurns(() => true, true);
    };
    const dispose = () => {
      stopped = true;
      cancelLiveTurns((turn) => turn.mode === "abort-on-dispose", false);
    };
    const submit = (turn) => {
      const mode = turn.mode ?? "abort-on-dispose";
      if (stopped && mode === "abort-on-dispose") return Promise.resolve("cancelled");
      if (stopped && mode === "flush-survives-navigation" && flushDepth === 0) {
        return Promise.resolve("cancelled");
      }
      const turnGeneration = generation2;
      const settlement = deferred();
      let outcome = "cancelled";
      let heldSlot = null;
      let done4 = false;
      const release = () => {
        if (done4) return;
        done4 = true;
        inFlight.delete(settlement.promise);
        liveTurns.delete(record);
        settlement.resolve(outcome);
      };
      const program = Effect_exports.gen(function* () {
        yield* Effect_exports.promise(() => Promise.resolve());
        if (turnGeneration !== generation2) return;
        if (turn.isStillWanted && !turn.isStillWanted("before-produce")) {
          outcome = "stale";
          return;
        }
        heldSlot = yield* Queue_exports.take(slots);
        const produced = yield* Effect_exports.promise(async () => {
          try {
            return { ok: true, value: await turn.produce() };
          } catch {
            return { ok: false };
          }
        });
        if (!produced.ok) {
          outcome = "failed";
          return;
        }
        if (turnGeneration !== generation2) return;
        if (turn.isStillWanted && !turn.isStillWanted("before-commit")) {
          outcome = "stale";
          return;
        }
        if (!turn.commit) {
          outcome = "committed";
          return;
        }
        const accepted = yield* Effect_exports.promise(async () => {
          try {
            return await turn.commit?.(produced.value);
          } catch {
            return false;
          }
        });
        outcome = accepted === false ? "rejected" : "committed";
      }).pipe(
        Effect_exports.ensuring(
          Effect_exports.gen(function* () {
            const slot = heldSlot;
            heldSlot = null;
            if (slot !== null) yield* Queue_exports.offer(slots, slot);
            yield* Effect_exports.sync(release);
          })
        )
      );
      let interruptFiber = null;
      const record = {
        mode,
        cancel: () => {
          interruptFiber?.();
        }
      };
      liveTurns.add(record);
      inFlight.add(settlement.promise);
      const fiber3 = Effect_exports.runFork(program);
      interruptFiber = () => {
        void Effect_exports.runPromise(Fiber_exports.interrupt(fiber3)).catch(() => void 0);
      };
      return settlement.promise;
    };
    return {
      submit,
      drain,
      beginFlush,
      async flush() {
        const release = beginFlush();
        try {
          await drain();
        } finally {
          release();
        }
      },
      interrupt: interrupt5,
      dispose,
      get inFlight() {
        return inFlight.size;
      }
    };
  }

  // packages/efx-watercolor/src/vector/spine.ts
  var ANCHOR_WIDTH_MIN = 0.2;
  var ANCHOR_WIDTH_MAX = 20;
  var ANCHOR_WIDTH_DEFAULT = 1;
  var PATH_SAMPLE_STEP_UV = 2e-3;
  function isFinitePoint(point) {
    return point !== void 0 && Number.isFinite(point.x) && Number.isFinite(point.y);
  }
  function distance(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function normaliseVectorAnchors(anchors) {
    const kept = [];
    for (const anchor of anchors) {
      if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) continue;
      const previous = kept[kept.length - 1];
      if (previous !== void 0 && previous.x === anchor.x && previous.y === anchor.y) continue;
      kept.push(anchor);
    }
    return kept;
  }
  function handlesFor(anchors, index) {
    const anchor = anchors[index];
    if (anchor.kind === "bezier" && isFinitePoint(anchor.in) && isFinitePoint(anchor.out)) {
      return { in: { x: anchor.in.x, y: anchor.in.y }, out: { x: anchor.out.x, y: anchor.out.y } };
    }
    const last = anchors.length - 1;
    if (last === 0) {
      const point = { x: anchor.x, y: anchor.y };
      return { in: { ...point }, out: { ...point } };
    }
    const scale = index === 0 || index === last ? 3 : 6;
    const before = anchors[Math.max(0, index - 1)];
    const after = anchors[Math.min(last, index + 1)];
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    return {
      in: { x: (scale * anchor.x - dx) / scale, y: (scale * anchor.y - dy) / scale },
      out: { x: (scale * anchor.x + dx) / scale, y: (scale * anchor.y + dy) / scale }
    };
  }
  function cubicPointAt(start, controlA, controlB, end2, t) {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return {
      x: a * start.x + b * controlA.x + c * controlB.x + d * end2.x,
      y: a * start.y + b * controlA.y + c * controlB.y + d * end2.y
    };
  }
  function walkPath(anchors) {
    const points = [];
    const stations = [];
    const anchorStations = [];
    if (anchors.length === 0) return { points, stations, anchorStations };
    const handles = anchors.map((_, index) => handlesFor(anchors, index));
    let total = 0;
    let cursor = { x: anchors[0].x, y: anchors[0].y };
    points.push(cursor);
    stations.push(0);
    anchorStations.push(0);
    for (let index = 0; index < anchors.length - 1; index++) {
      const start = anchors[index];
      const end2 = anchors[index + 1];
      const controlA = handles[index].out;
      const controlB = handles[index + 1].in;
      const chord = distance(start, end2);
      const steps = Math.max(1, Math.ceil(chord / PATH_SAMPLE_STEP_UV));
      for (let step = 1; step < steps; step++) {
        const sample = cubicPointAt(start, controlA, controlB, end2, step / steps);
        const advance2 = distance(cursor, sample);
        if (advance2 <= 0) continue;
        total += advance2;
        points.push(sample);
        stations.push(total);
        cursor = sample;
      }
      const advance = distance(cursor, end2);
      if (advance > 0) {
        total += advance;
        cursor = { x: end2.x, y: end2.y };
        points.push(cursor);
        stations.push(total);
      }
      anchorStations.push(total);
    }
    return { points, stations, anchorStations };
  }
  function clampAnchorWidth(value) {
    if (!Number.isFinite(value)) return ANCHOR_WIDTH_DEFAULT;
    return Math.min(ANCHOR_WIDTH_MAX, Math.max(ANCHOR_WIDTH_MIN, value));
  }
  function anchorWidthFactor(anchor) {
    return anchor.width === void 0 ? ANCHOR_WIDTH_DEFAULT : clampAnchorWidth(anchor.width);
  }
  function isUniformWidthProfile(anchors) {
    return normaliseVectorAnchors(anchors).every(
      (anchor) => anchorWidthFactor(anchor) === ANCHOR_WIDTH_DEFAULT
    );
  }
  var ANCHOR_COLOR_PATTERN = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
  function normaliseAnchorColor(value) {
    if (typeof value !== "string") return void 0;
    const match5 = ANCHOR_COLOR_PATTERN.exec(value);
    if (match5 === null) return void 0;
    const digits = match5[1].toLowerCase();
    const expanded = digits.length === 3 ? digits[0] + digits[0] + digits[1] + digits[1] + digits[2] + digits[2] : digits.slice(0, 6);
    return `#${expanded}`;
  }
  function isUniformColorProfile(anchors) {
    return normaliseVectorAnchors(anchors).every((anchor) => anchor.color === void 0);
  }
  function widthAtStation(anchors, anchorStations, station) {
    const last = anchors.length - 1;
    if (last < 0) return ANCHOR_WIDTH_DEFAULT;
    if (last === 0) return anchorWidthFactor(anchors[0]);
    if (!Number.isFinite(station) || station <= anchorStations[0]) {
      return anchorWidthFactor(anchors[0]);
    }
    if (station >= anchorStations[last]) return anchorWidthFactor(anchors[last]);
    for (let index = 0; index < last; index++) {
      const start = anchorStations[index];
      const end2 = anchorStations[index + 1];
      if (station > end2) continue;
      const span = end2 - start;
      const from = anchorWidthFactor(anchors[index]);
      if (span <= 0) return anchorWidthFactor(anchors[index + 1]);
      const to = anchorWidthFactor(anchors[index + 1]);
      return from + (to - from) * ((station - start) / span);
    }
    return anchorWidthFactor(anchors[last]);
  }
  function sampleVectorWidths(anchors, points) {
    if (points.length === 0) return [];
    const normalised = normaliseVectorAnchors(anchors);
    if (normalised.length === 0) return points.map(() => ANCHOR_WIDTH_DEFAULT);
    if (isUniformWidthProfile(normalised)) return points.map(() => ANCHOR_WIDTH_DEFAULT);
    const { points: samples, stations, anchorStations } = walkPath(normalised);
    return points.map((point) => {
      let nearest = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < samples.length; index++) {
        const sample = samples[index];
        const dx = point.x - sample.x;
        const dy = point.y - sample.y;
        const squared = dx * dx + dy * dy;
        if (squared < nearestDistance) {
          nearestDistance = squared;
          nearest = index;
          if (squared === 0) break;
        }
      }
      return widthAtStation(normalised, anchorStations, stations[nearest] ?? 0);
    });
  }
  function anchorColorChannels(hex) {
    return {
      r: Number.parseInt(hex.slice(1, 3), 16) / 255,
      g: Number.parseInt(hex.slice(3, 5), 16) / 255,
      b: Number.parseInt(hex.slice(5, 7), 16) / 255
    };
  }
  function formatAnchorColor(color) {
    const channel = (value) => {
      const clamped = Math.min(1, Math.max(0, value));
      return Math.round(clamped * 255).toString(16).padStart(2, "0");
    };
    return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
  }
  function mixAnchorColor(from, to, u) {
    return {
      r: from.r + (to.r - from.r) * u,
      g: from.g + (to.g - from.g) * u,
      b: from.b + (to.b - from.b) * u
    };
  }
  function colorAtStation(anchors, anchorStations, anchorColors, station) {
    const last = anchors.length - 1;
    if (last === 0) return anchorColors[0];
    if (!Number.isFinite(station) || station <= anchorStations[0]) return anchorColors[0];
    if (station >= anchorStations[last]) return anchorColors[last];
    for (let index = 0; index < last; index++) {
      const start = anchorStations[index];
      const end2 = anchorStations[index + 1];
      if (station > end2) continue;
      const span = end2 - start;
      if (span <= 0) return anchorColors[index + 1];
      return mixAnchorColor(anchorColors[index], anchorColors[index + 1], (station - start) / span);
    }
    return anchorColors[last];
  }
  function sampleVectorColors(anchors, points, baseColor) {
    if (points.length === 0) return [];
    const normalised = normaliseVectorAnchors(anchors);
    if (normalised.length === 0) return points.map(() => baseColor);
    const normalisedBase = normaliseAnchorColor(baseColor);
    if (normalisedBase === void 0) return points.map(() => baseColor);
    if (isUniformColorProfile(normalised)) return points.map(() => normalisedBase);
    const anchorColors = normalised.map(
      (anchor) => anchorColorChannels(normaliseAnchorColor(anchor.color) ?? normalisedBase)
    );
    const { points: samples, stations, anchorStations } = walkPath(normalised);
    return points.map((point) => {
      let nearest = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < samples.length; index++) {
        const sample = samples[index];
        const dx = point.x - sample.x;
        const dy = point.y - sample.y;
        const squared = dx * dx + dy * dy;
        if (squared < nearestDistance) {
          nearestDistance = squared;
          nearest = index;
          if (squared === 0) break;
        }
      }
      return formatAnchorColor(
        colorAtStation(normalised, anchorStations, anchorColors, stations[nearest] ?? 0)
      );
    });
  }

  // packages/efx-watercolor/src/payload/vectorPath.ts
  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }
  function isFinitePoint2(value) {
    if (typeof value !== "object" || value === null) return false;
    const point = value;
    return isFiniteNumber(point.x) && isFiniteNumber(point.y);
  }
  var AQUARELLE_CURVE_MODES = Object.freeze([
    "bezier",
    "spline"
  ]);
  function isAquarelleCurveMode(value) {
    return AQUARELLE_CURVE_MODES.includes(value);
  }
  function canonicalAnchor(raw) {
    const x = raw["x"];
    const y = raw["y"];
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) return void 0;
    const kind = raw["kind"];
    if (kind !== "auto" && kind !== "bezier") return void 0;
    const handleIn = raw["in"];
    const handleOut = raw["out"];
    if (handleIn !== void 0 && !isFinitePoint2(handleIn)) return void 0;
    if (handleOut !== void 0 && !isFinitePoint2(handleOut)) return void 0;
    const width = raw["width"];
    if (width !== void 0) {
      if (!isFiniteNumber(width)) return void 0;
      if (width < ANCHOR_WIDTH_MIN || width > ANCHOR_WIDTH_MAX) return void 0;
    }
    const color = raw["color"];
    const normalisedColor = color === void 0 ? void 0 : normaliseAnchorColor(color);
    if (color !== void 0 && normalisedColor === void 0) return void 0;
    const anchor = { x, y, kind };
    if (handleIn !== void 0) anchor.in = { x: handleIn.x, y: handleIn.y };
    if (handleOut !== void 0) anchor.out = { x: handleOut.x, y: handleOut.y };
    if (width !== void 0) anchor.width = width;
    if (normalisedColor !== void 0) anchor.color = normalisedColor;
    return anchor;
  }
  function normaliseAquarelleAnchors(input) {
    if (!Array.isArray(input) || input.length === 0) return void 0;
    const anchors = [];
    for (const entry of input) {
      if (typeof entry !== "object" || entry === null) return void 0;
      const anchor = canonicalAnchor(entry);
      if (anchor === void 0) return void 0;
      anchors.push(anchor);
    }
    return Object.freeze(anchors);
  }

  // packages/efx-watercolor/src/payload/toStudioStroke.ts
  var AQUARELLE_TOOLS = Object.freeze([
    "brush",
    "water",
    "pen",
    "lift"
  ]);
  var DIFFUSION_CAP = 600;

  // packages/efx-watercolor/src/payload/dryEvent.ts
  function isAquarelleDryEvent(value) {
    if (typeof value !== "object" || value === null) return false;
    const v = value;
    return v["kind"] === "dry";
  }

  // packages/efx-watercolor/src/payload/codec.ts
  var AQUARELLE_SCHEMA_VERSION = 1;
  function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  function isFiniteNumber2(value) {
    return typeof value === "number" && Number.isFinite(value);
  }
  function isIntegerTick(value) {
    return isFiniteNumber2(value) && Number.isInteger(value) && value >= 0;
  }
  var TOOL_OVERRIDE_KEYS = [
    "tip",
    "aspect",
    "rotation",
    "sizeCurve",
    "scatter",
    "capacity",
    "grain",
    "wetRound"
  ];
  function isToolOverrides(value) {
    if (!isRecord(value)) return false;
    for (const key of TOOL_OVERRIDE_KEYS) {
      const v = value[key];
      if (v !== void 0 && !isFiniteNumber2(v)) return false;
    }
    return true;
  }
  function isStudioPoint(value) {
    if (!isRecord(value)) return false;
    return isFiniteNumber2(value["x"]) && isFiniteNumber2(value["y"]) && isFiniteNumber2(value["p"]) && isFiniteNumber2(value["tx"]) && isFiniteNumber2(value["ty"]) && isFiniteNumber2(value["tw"]) && isIntegerTick(value["tick"]);
  }
  function isDryEventShape(value) {
    if (!isRecord(value)) return false;
    if (value["kind"] !== "dry") return false;
    if (!isIntegerTick(value["tick"])) return false;
    if (!isFiniteNumber2(value["recordedOrder"])) return false;
    if ("pts" in value || "brushId" in value || "brush" in value || "tool" in value) {
      return false;
    }
    return true;
  }
  function isStrokeShape(value) {
    if (!isRecord(value)) return false;
    if (!Array.isArray(value["pts"])) return false;
    if (!value["pts"].every(isStudioPoint)) return false;
    if (!isFiniteNumber2(value["ticks"]) || value["ticks"] < 1) return false;
    if (!isFiniteNumber2(value["cuisson"]) || value["cuisson"] < 0) return false;
    if (!("motion" in value)) return false;
    if (typeof value["brushId"] !== "string") return false;
    if (!isToolOverrides(value["toolOverrides"])) return false;
    if (!isFiniteNumber2(value["traceSeed"])) return false;
    if (!isFiniteNumber2(value["recordedOrder"])) return false;
    if (!("playFrame" in value)) return false;
    if (!("color" in value)) return false;
    const engine = value["engine"];
    if (!isRecord(engine)) return false;
    if (typeof engine["tool"] !== "string") return false;
    if (!AQUARELLE_TOOLS.includes(engine["tool"])) return false;
    if (typeof engine["brushId"] !== "string") return false;
    if (!isRecord(engine["params"])) return false;
    if (!isFiniteNumber2(engine["timestamp"])) return false;
    const anchors = engine["anchors"];
    if (anchors !== void 0 && normaliseAquarelleAnchors(anchors) === void 0) return false;
    const curveMode = engine["curveMode"];
    if (curveMode !== void 0 && !isAquarelleCurveMode(curveMode)) return false;
    const vectorDrawn = engine["vectorDrawn"];
    if (vectorDrawn !== void 0 && vectorDrawn !== true) return false;
    const textureId = engine["textureId"];
    if (textureId !== void 0 && (typeof textureId !== "string" || textureId.length === 0)) {
      return false;
    }
    return true;
  }
  function clampDiffusion(value) {
    if (value === void 0) return void 0;
    if (!isFiniteNumber2(value) || value <= 0) return 0;
    return Math.min(DIFFUSION_CAP, Math.trunc(value));
  }
  function cloneStrokeForWire(stroke) {
    const cuisson = Math.min(DIFFUSION_CAP, Math.max(0, Math.trunc(stroke.cuisson)));
    const diffusionFrames = clampDiffusion(stroke.engine.diffusionFrames);
    const anchors = stroke.engine.anchors === void 0 ? void 0 : normaliseAquarelleAnchors(stroke.engine.anchors);
    return {
      pts: stroke.pts.map((p) => ({ ...p })),
      ticks: stroke.ticks,
      cuisson,
      motion: stroke.motion ? { ...stroke.motion } : null,
      brushId: stroke.brushId,
      toolOverrides: { ...stroke.toolOverrides },
      traceSeed: stroke.traceSeed,
      recordedOrder: stroke.recordedOrder,
      playFrame: stroke.playFrame,
      color: stroke.color,
      engine: {
        ...stroke.engine,
        params: { ...stroke.engine.params },
        toolOverrides: stroke.engine.toolOverrides ? { ...stroke.engine.toolOverrides } : void 0,
        diffusionFrames,
        ...anchors !== void 0 ? { anchors } : {}
      }
    };
  }
  function cloneDryForWire(dry) {
    return { kind: "dry", tick: dry.tick, recordedOrder: dry.recordedOrder };
  }
  function serialize(event) {
    if (isAquarelleDryEvent(event)) {
      return {
        schemaVersion: AQUARELLE_SCHEMA_VERSION,
        event: cloneDryForWire(event)
      };
    }
    if (!isStrokeShape(event)) {
      throw new TypeError("payloadCodec.serialize: expected an AquarellePayloadEvent");
    }
    return {
      schemaVersion: AQUARELLE_SCHEMA_VERSION,
      event: cloneStrokeForWire(event)
    };
  }
  function parse(raw) {
    if (!isRecord(raw)) return null;
    if (raw["schemaVersion"] !== AQUARELLE_SCHEMA_VERSION) return null;
    const event = raw["event"];
    if (isDryEventShape(event)) return cloneDryForWire(event);
    if (isStrokeShape(event)) return cloneStrokeForWire(event);
    return null;
  }
  var payloadCodec = {
    serialize,
    parse
  };

  // packages/efx-watercolor/src/playground/brushes.ts
  function brushTipCacheKey(b) {
    return `${b.id}|${b.textureId ?? ""}`;
  }
  function tipRowsForUpload(data, size2) {
    if (size2 <= 1 || data.length !== size2 * size2) return data;
    const out = new Uint8Array(data.length);
    for (let row = 0; row < size2; row++) {
      const source = (size2 - 1 - row) * size2;
      out.set(data.subarray(source, source + size2), row * size2);
    }
    return out;
  }
  var TIP_SIZE = 192;
  var DEG = Math.PI / 180;
  var Noise = class {
    constructor(seed) {
      this.seed = seed;
      this.state = seed | 0 || 1;
    }
    seed;
    state;
    /** mulberry32 */
    rnd() {
      this.state = this.state + 1831565813 | 0;
      let t = Math.imul(this.state ^ this.state >>> 15, 1 | this.state);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    hash(ix, iy) {
      let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(this.seed, 982451653) | 0;
      h = Math.imul(h ^ h >>> 13, 1274126177);
      return ((h ^ h >>> 16) >>> 0) / 4294967296;
    }
    value(x, y) {
      const ix = Math.floor(x), iy = Math.floor(y);
      let fx = x - ix, fy = y - iy;
      fx = fx * fx * (3 - 2 * fx);
      fy = fy * fy * (3 - 2 * fy);
      const a = this.hash(ix, iy), b = this.hash(ix + 1, iy), c = this.hash(ix, iy + 1), d = this.hash(ix + 1, iy + 1);
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    }
    fbm(x, y, octaves = 4) {
      let v = 0, amp = 0.5, sum2 = 0;
      for (let i = 0; i < octaves; i++) {
        v += amp * this.value(x, y);
        sum2 += amp;
        x = x * 2.03 + 17.1;
        y = y * 2.01 + 9.7;
        amp *= 0.5;
      }
      return v / sum2;
    }
    /** Distances to the nearest and second-nearest jittered cell point. */
    worley(x, y) {
      const ix = Math.floor(x), iy = Math.floor(y);
      let f1 = 9, f2 = 9;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const cx = ix + i, cy = iy + j;
        const px = cx + this.hash(cx, cy), py = cy + this.hash(cx + 71, cy + 13);
        const d = Math.hypot(px - x, py - y);
        if (d < f1) {
          f2 = f1;
          f1 = d;
        } else if (d < f2) f2 = d;
      }
      return [f1, f2];
    }
  };
  var clamp01 = (v) => Math.min(1, Math.max(0, v));
  var smoothstep = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  var soft = (r, hard) => 1 - smoothstep(hard, 1, r);
  function tip(fn3) {
    return (n) => {
      const out = new Float32Array(n * n);
      for (let j = 0; j < n; j++) {
        const v = (j + 0.5) / n * 2 - 1;
        for (let i = 0; i < n; i++) {
          const u = (i + 0.5) / n * 2 - 1;
          out[j * n + i] = clamp01(fn3(u, v, Math.hypot(u, v), Math.atan2(v, u)));
        }
      }
      return out;
    };
  }
  function hairs(segments, width, u, v) {
    let sum2 = 0;
    for (const [ax, ay, bx, by] of segments) {
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
      const t = clamp01(((u - ax) * dx + (v - ay) * dy) / len2);
      const d = Math.hypot(u - ax - dx * t, v - ay - dy * t);
      sum2 += Math.exp(-(d * d) / (width * width));
    }
    return sum2;
  }
  var BASE = {
    aspect: 1,
    rotation: "fixed",
    angle: 0,
    angleJitter: 0,
    size: [0.011, 0.05],
    pressureSize: 1,
    speedThin: 0,
    spacing: 0.3,
    scatter: 0,
    dabs: 1,
    sizeJitter: 0,
    water: 1,
    load: 1,
    flow: 1,
    capacity: 1,
    grain: 0,
    wetRound: 0.6,
    roughness: 0,
    stampJitter: 0
  };
  var define = (p) => ({ ...BASE, ...p });
  var BRUSH_PRESETS = [
    // 261027-gh9f: dry media and the FIRST card in the Brush tab grid. The
    // footprint range is deliberately small so the top-bar size slider reaches a
    // true hairline at 1; `roughness` re-thresholds the tip per dab in the stamp
    // shader (net, crumbly edges instead of a feathered alpha ramp) and
    // `stampJitter` shifts each dab's slice of the tip so the silhouette breaks
    // up randomly along the stroke. water 0 deposits no wetness by construction
    // (the engine multiplies `b.water` into the wet amount) and the engine now
    // also skips the velocity splat for a waterless brush, so strokes never mix
    // like a wet medium.
    define({
      id: "chalk",
      name: "Chalk",
      hint: "Dry chalk stick: grainy core, crumbling edges, no wet bloom",
      aspect: 0.8,
      rotation: "follow",
      angle: 0,
      angleJitter: 12,
      size: [3e-3, 0.012],
      pressureSize: 1.15,
      speedThin: 0.02,
      spacing: 0.2,
      scatter: 0.14,
      dabs: 1,
      sizeJitter: 0.28,
      water: 0,
      load: 1.1,
      flow: 0.35,
      capacity: 0.9,
      grain: 0.5,
      wetRound: 0,
      roughness: 0.7,
      stampJitter: 0.1,
      tip: (n, N) => tip((u, v, r, ang) => {
        const lobes = N.fbm(ang * 2.1 + 1.6, r * 3.2, 3) * 2 - 1;
        const fibres = N.fbm(ang * 9.5 + 4.2, r * 5.5, 2) * 2 - 1;
        const splits = N.fbm(ang * 23 + 8.7, r * 7, 2) * 2 - 1;
        const contour = 0.87 + 0.11 * lobes + 0.06 * fibres + 0.035 * splits;
        const body = 1 - smoothstep(contour - 8e-3, contour + 8e-3, r);
        const rim = smoothstep(0.5, 0.95, r);
        const bite = smoothstep(0.3, 0.5, N.fbm(u * 14 + 11, v * 14 + 3, 4));
        const chip = 1 - rim * 0.85 * (1 - bite);
        const pores = smoothstep(0.18, 0.42, N.fbm(u * 30 + 5, v * 30 + 11, 3));
        const poreDepth = 0.24 + 0.45 * smoothstep(0.25, 0.95, r);
        const crumble = 1 - poreDepth * (1 - pores);
        const grit = 0.7 + 0.3 * N.fbm(u * 64 + 3, v * 64 + 7, 2);
        return body * chip * crumble * grit;
      })(n)
    }),
    define({
      id: "round",
      name: "Round",
      hint: "A pointed round #8: the everyday brush",
      tip: (n, N) => tip((u, v, r, ang) => {
        const rr = r * (1 + 0.08 * (N.fbm(ang * 0.8 + 3, r * 2.5) * 2 - 1));
        return soft(rr, 0.3) * (1 - 0.12 * N.fbm(u * 5, v * 5));
      })(n)
    }),
    define({
      id: "detail",
      name: "Detail",
      hint: "A small round #2 for fine work",
      size: [25e-4, 0.014],
      pressureSize: 0.9,
      water: 0.7,
      load: 1.15,
      capacity: 0.6,
      spacing: 0.28,
      wetRound: 0.8,
      tip: (n) => tip((_u, _v, r) => soft(r, 0.55))(n)
    }),
    define({
      id: "rigger",
      name: "Rigger",
      hint: "Long thin liner: holds a lot of paint for continuous lines",
      size: [15e-4, 65e-4],
      pressureSize: 0.7,
      speedThin: 0.08,
      water: 0.55,
      load: 1.3,
      capacity: 1.8,
      spacing: 0.25,
      wetRound: 0.9,
      tip: (n) => tip((_u, _v, r) => soft(r, 0.65))(n)
    }),
    define({
      id: "flat",
      name: "Flat",
      hint: 'A \xBD" flat: thick or thin depending on direction; tilt the pen to turn it',
      aspect: 0.26,
      rotation: "fixed",
      angle: 40,
      angleJitter: 1.5,
      size: [0.02, 0.038],
      pressureSize: 1.4,
      spacing: 0.14,
      water: 0.8,
      wetRound: 0.25,
      tip: (n, N) => tip((u, v) => {
        const chisel = 0.06 * (N.fbm(v * 3 + 9, 2, 3) * 2 - 1);
        const ex = 1 - smoothstep(0.8, 0.98, Math.abs(u) + chisel);
        const ey = 1 - smoothstep(0.8, 1, Math.abs(v));
        const bristles = 1 - 0.4 * smoothstep(0.4, 0.75, N.fbm(u * 10, v * 0.7, 3));
        return ex * ey * bristles;
      })(n)
    }),
    define({
      id: "hake",
      name: "Hake",
      hint: "Wide soft goat-hair wash brush; streaky, carries lots of water",
      aspect: 0.2,
      rotation: "follow",
      angle: 90,
      angleJitter: 2,
      size: [0.05, 0.08],
      pressureSize: 1.6,
      spacing: 0.1,
      water: 1.6,
      load: 0.75,
      flow: 1.2,
      capacity: 2.2,
      wetRound: 0.5,
      tip: (n, N) => tip((u, v) => {
        const ex = 1 - smoothstep(0.72, 1, Math.abs(u) + 0.1 * (N.fbm(v * 2 + 4, 1, 3) * 2 - 1));
        const ey = 1 - smoothstep(0.55, 1, Math.abs(v));
        const bristles = 1 - 0.65 * smoothstep(0.35, 0.7, N.fbm(u * 16, v * 0.9, 3));
        const gaps = smoothstep(0.25, 0.45, N.fbm(u * 7 + 20, v * 0.4, 2));
        return ex * ey * bristles * (0.4 + 0.6 * gaps);
      })(n)
    }),
    define({
      id: "filbert",
      name: "Filbert",
      hint: "Oval tip: soft rounded marks that change with direction",
      aspect: 0.55,
      rotation: "fixed",
      angle: 25,
      angleJitter: 2,
      size: [0.012, 0.036],
      spacing: 0.18,
      wetRound: 0.5,
      tip: (n, N) => tip((u, _v, r) => soft(r, 0.45) * (1 - 0.25 * N.fbm(u * 8, 0.7, 3)))(n)
    }),
    define({
      id: "mop",
      name: "Mop",
      hint: "Big squirrel mop: floods the paper for washes",
      size: [0.03, 0.075],
      pressureSize: 0.8,
      spacing: 0.25,
      water: 1.8,
      load: 0.8,
      flow: 1.3,
      capacity: 2.6,
      wetRound: 0.7,
      tip: (n, N) => tip((u, v, r, ang) => {
        const rr = r * (1 + 0.22 * (N.fbm(ang * 1.2, 1.7, 3) * 2 - 1));
        return Math.pow(soft(rr, 0.1), 1.3) * (1 - 0.25 * N.fbm(u * 3, v * 3));
      })(n)
    }),
    define({
      id: "dry",
      name: "Dry Brush",
      hint: "Scruffy bristles with little water: skips over the paper tooth",
      aspect: 0.75,
      rotation: "follow",
      angle: 0,
      angleJitter: 8,
      size: [0.012, 0.036],
      spacing: 0.12,
      water: 0.2,
      load: 1.1,
      capacity: 0.6,
      grain: 0.9,
      wetRound: 0,
      tip: (n, N) => tip((u, v, r) => {
        const holes = smoothstep(0.42, 0.62, N.fbm(u * 5.5, v * 5.5, 5));
        const streaks = 1 - 0.3 * N.fbm(u * 14, v * 1.2, 3);
        return soft(r, 0.2) * holes * streaks;
      })(n)
    }),
    define({
      id: "fan",
      name: "Fan",
      hint: "Splayed hairs: grass, fur and fine parallel texture",
      aspect: 0.5,
      rotation: "follow",
      angle: 90,
      angleJitter: 3,
      size: [0.02, 0.045],
      pressureSize: 1.2,
      spacing: 0.1,
      water: 0.3,
      load: 1,
      capacity: 0.8,
      grain: 0.5,
      wetRound: 0,
      tip: (n, N) => {
        const segs = [];
        for (let i = 0; i < 13; i++) {
          const x = -0.95 + 1.9 * i / 12 + (N.rnd() - 0.5) * 0.08;
          segs.push([x * 0.25, -1.3, x, 0.75 + N.rnd() * 0.25]);
        }
        return tip((u, v) => Math.min(1, hairs(segs, 0.045, u, v)) * (1 - smoothstep(0.85, 1, Math.abs(v))))(n);
      }
    }),
    define({
      id: "sponge",
      name: "Sponge",
      hint: "Natural sponge: dabbed cellular texture for foliage and stone",
      rotation: "random",
      size: [0.025, 0.05],
      pressureSize: 0.7,
      spacing: 0.55,
      scatter: 0.3,
      sizeJitter: 0.3,
      water: 0.5,
      load: 0.9,
      capacity: 1.2,
      grain: 0.45,
      wetRound: 0.1,
      tip: (n, N) => tip((u, v, r) => {
        const [f1, f2] = N.worley(u * 4.5, v * 4.5);
        return soft(r, 0.55) * smoothstep(0.03, 0.14, f2 - f1) * (0.55 + 0.45 * N.fbm(u * 7, v * 7, 3));
      })(n)
    }),
    define({
      id: "spatter",
      name: "Spatter",
      hint: "Flicked droplets: sparse at a light touch, dense when pressing",
      rotation: "random",
      size: [3e-3, 8e-3],
      pressureSize: 0.8,
      spacing: 4.5,
      scatter: 10,
      dabs: 5,
      sizeJitter: 0.75,
      water: 1.3,
      load: 1.1,
      capacity: 1.5,
      wetRound: 0,
      tip: (n) => tip((_u, _v, r) => soft(r, 0.72))(n)
    }),
    define({
      id: "sumi",
      name: "Sumi",
      hint: "Oriental brush: hairline to broad with pressure, fibrous edges",
      size: [2e-3, 0.052],
      pressureSize: 1.3,
      speedThin: 0.12,
      spacing: 0.22,
      water: 0.8,
      load: 1.3,
      capacity: 1.2,
      wetRound: 0.75,
      tip: (n, N) => tip((_u, _v, r, ang) => {
        const rr = r * (1 + 0.35 * (N.fbm(ang * 2.5 + r * 2, 1, 3) * 2 - 1));
        return Math.pow(soft(rr, 0.25), 1.5) * (1 - 0.3 * N.fbm(r * 8, ang * 3, 3));
      })(n)
    }),
    define({
      id: "dagger",
      name: "Dagger",
      hint: "Sword liner: calligraphic strokes from a tapered blade",
      aspect: 0.38,
      rotation: "fixed",
      angle: 55,
      angleJitter: 1,
      size: [6e-3, 0.03],
      pressureSize: 1.1,
      speedThin: 0.06,
      spacing: 0.15,
      load: 1.1,
      capacity: 1.4,
      wetRound: 0.3,
      tip: (n) => tip((u, v) => {
        const t = (u + 1) / 2;
        const w = Math.sqrt(Math.max(0, 4 * t * (1 - t))) * (1 - 0.5 * t);
        return 1 - smoothstep(w * 0.8, w, Math.abs(v));
      })(n)
    }),
    define({
      id: "stipple",
      name: "Stipple",
      hint: "A cluster of hard dots: pointillist texture",
      rotation: "random",
      size: [0.015, 0.035],
      pressureSize: 0.8,
      spacing: 0.7,
      scatter: 0.2,
      sizeJitter: 0.2,
      water: 0.35,
      load: 1.1,
      grain: 0.3,
      wetRound: 0,
      tip: (n, N) => {
        const dots = [];
        while (dots.length < 46) {
          const x = N.rnd() * 2 - 1, y = N.rnd() * 2 - 1;
          if (Math.hypot(x, y) < 0.86) dots.push([x, y, 0.06 + N.rnd() * 0.08]);
        }
        return tip((u, v) => {
          let m = 0;
          for (const [x, y, rd] of dots) m = Math.max(m, soft(Math.hypot(u - x, v - y) / rd, 0.6));
          return m;
        })(n);
      }
    })
  ];
  var CUSTOM_BASE = {
    ...BASE,
    rotation: "follow",
    angleJitter: 4,
    spacing: 0.2,
    wetRound: 0.4
  };
  function buildBrush(preset, seed = 7) {
    const { tip: source, ...rest } = preset;
    let tipData, tipSize;
    if (source instanceof Uint8Array) {
      tipData = source;
      tipSize = Math.round(Math.sqrt(source.length));
    } else {
      tipSize = TIP_SIZE;
      const f = source(tipSize, new Noise(seed + hashString(preset.id)));
      tipData = new Uint8Array(f.length);
      for (let i = 0; i < f.length; i++) tipData[i] = Math.round(clamp01(f[i]) * 255);
    }
    let sum2 = 0;
    for (let i = 0; i < tipData.length; i++) sum2 += tipData[i];
    return { ...rest, tipSize, tipData, tipMean: Math.max(0.01, sum2 / (255 * tipData.length)) };
  }
  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  // packages/efx-watercolor/src/playground/half.ts
  var f32 = new Float32Array(1);
  var u32 = new Uint32Array(f32.buffer);
  function toHalf(v) {
    f32[0] = v;
    const x = u32[0];
    const sign = x >>> 16 & 32768;
    let exp = x >>> 23 & 255;
    let mant = x & 8388607;
    if (exp === 255) return sign | 31744 | (mant ? 512 : 0);
    const e = exp - 127 + 15;
    if (e >= 31) return sign | 31744;
    if (e <= 0) {
      if (e < -10) return sign;
      mant |= 8388608;
      const shift = 14 - e;
      let h2 = mant >>> shift;
      const rem2 = mant & (1 << shift) - 1, half = 1 << shift - 1;
      if (rem2 > half || rem2 === half && h2 & 1) h2++;
      return sign | h2;
    }
    let h = e << 10 | mant >>> 13;
    const rem = mant & 8191;
    if (rem > 4096 || rem === 4096 && h & 1) h++;
    return sign | h;
  }
  function f32ToF16(src, dst, n = src.length) {
    for (let i = 0; i < n; i++) dst[i] = toHalf(src[i]);
  }

  // packages/efx-watercolor/src/playground/gl.ts
  var QUAD_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
  var GL = class {
    gl;
    vs;
    resources = /* @__PURE__ */ new Map();
    constructor(gl) {
      this.gl = gl;
      this.vs = this.compile(gl.VERTEX_SHADER, QUAD_VS);
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    }
    compile(type, src) {
      const { gl } = this;
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const numbered = src.split("\n").map((l, i) => `${i + 1}: ${l}`).join("\n");
        throw new Error(`${gl.getShaderInfoLog(s)}
${numbered}`);
      }
      return s;
    }
    program(fs) {
      const { gl } = this;
      const p = gl.createProgram();
      gl.attachShader(p, this.vs);
      gl.attachShader(p, this.compile(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link failed");
      const u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i);
        u[info.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(p, info.name);
      }
      return { u, bind: () => gl.useProgram(p) };
    }
    target(w, h, formats, filter4) {
      const { gl } = this;
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      const tex = [];
      const views = [];
      formats.forEach((f, i) => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter4);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter4);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texStorage2D(gl.TEXTURE_2D, 1, f.internal, w, h);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0);
        tex.push(t);
      });
      gl.drawBuffers(formats.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`framebuffer incomplete: 0x${status.toString(16)}`);
      for (const t of tex) {
        const v = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, v);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        views.push(v);
      }
      const target = { w, h, fbo, tex, views };
      this.clearTarget(target);
      this.resources.set(target, () => {
        gl.deleteFramebuffer(fbo);
        views.forEach((v) => gl.deleteFramebuffer(v));
        tex.forEach((t) => gl.deleteTexture(t));
      });
      return target;
    }
    double(w, h, formats, filter4) {
      let a = this.target(w, h, formats, filter4);
      let b = this.target(w, h, formats, filter4);
      return {
        w,
        h,
        get read() {
          return a;
        },
        get write() {
          return b;
        },
        swap() {
          const t = a;
          a = b;
          b = t;
        }
      };
    }
    clearTarget(t, rect) {
      const { gl } = this;
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      if (rect) this.scissor(rect);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.SCISSOR_TEST);
    }
    scissor(r) {
      const { gl } = this;
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(r.x0, r.y0, Math.max(0, r.x1 - r.x0), Math.max(0, r.y1 - r.y0));
    }
    /** Draw the full-screen triangle into `target` (or the canvas), optionally scissored. */
    draw(target, rect, canvasSize) {
      const { gl } = this;
      if (target) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        gl.viewport(0, 0, target.w, target.h);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvasSize[0], canvasSize[1]);
      }
      if (rect) this.scissor(rect);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (rect) gl.disable(gl.SCISSOR_TEST);
    }
    /** Upload a CPU image as a texture. The caller owns it (it is not freed by disposeTargets). */
    texture(w, h, f, data, filter4) {
      const { gl } = this;
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, f.internal, w, h, 0, f.format, f.type, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter4);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter4);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    bindTex(unit, tex) {
      const { gl } = this;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      return unit;
    }
    /** Copy a rectangle between single-texture framebuffers (same format). */
    blit(src, sx, sy, dst, dx, dy, w, h) {
      const { gl } = this;
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst);
      gl.blitFramebuffer(sx, sy, sx + w, sy + h, dx, dy, dx + w, dy + h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    }
    /**
     * Read a single-attachment float framebuffer (a `Target.views[i]`) as half floats:
     * `channels` (1 or 4) per texel, rows bottom-up (row 0 is y = 0), within `rect`
     * (default: all of it). Reads HALF_FLOAT directly when the driver allows, else
     * FLOAT in bands converted on the CPU.
     */
    readHalf(fb, w, h, channels, rect) {
      const { gl } = this;
      const x0 = rect?.x0 ?? 0, y0 = rect?.y0 ?? 0, rw = (rect?.x1 ?? w) - x0, rh = (rect?.y1 ?? h) - y0;
      const out = new Uint16Array(Math.max(0, rw * rh * channels));
      if (rw <= 0 || rh <= 0) return out;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.pixelStorei(gl.PACK_ALIGNMENT, 1);
      const type = gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_TYPE);
      const format3 = gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_FORMAT);
      const direct = format3 === gl.RGBA && type === gl.HALF_FLOAT;
      gl.getError();
      const rows = Math.max(1, Math.floor(4 * 1024 * 1024 / (rw * 4)));
      const band32 = direct ? null : new Float32Array(rw * rows * 4);
      const band16 = direct && channels === 1 ? new Uint16Array(rw * rows * 4) : null;
      for (let y = 0; y < rh; y += rows) {
        const n = Math.min(rows, rh - y);
        if (direct && channels === 4) {
          gl.readPixels(x0, y0 + y, rw, n, gl.RGBA, gl.HALF_FLOAT, out.subarray(y * rw * 4, (y + n) * rw * 4));
          continue;
        }
        let src;
        if (direct) {
          gl.readPixels(x0, y0 + y, rw, n, gl.RGBA, gl.HALF_FLOAT, band16);
          src = band16;
        } else {
          gl.readPixels(x0, y0 + y, rw, n, gl.RGBA, gl.FLOAT, band32);
          if (channels === 4) {
            f32ToF16(band32, out.subarray(y * rw * 4), n * rw * 4);
            continue;
          }
          src = new Uint16Array(n * rw * 4);
          f32ToF16(band32, src, n * rw * 4);
        }
        const base = y * rw;
        for (let i = 0, m = n * rw; i < m; i++) out[base + i] = src[i * 4];
      }
      const err = gl.getError();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (err) throw new Error("This GPU cannot read its paint layers back.");
      return out;
    }
    /** Upload half floats into a texStorage2D texture at (x, y); `format` is RGBA or RED to match it. */
    uploadHalf(tex, x, y, w, h, format3, data) {
      const { gl } = this;
      if (w <= 0 || h <= 0) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 2);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, format3, gl.HALF_FLOAT, data);
    }
    /** Free one target now (a scratch target that should not live until disposeTargets). */
    disposeTarget(t) {
      this.resources.get(t)?.();
      this.resources.delete(t);
    }
    /** Free every target created so far (used on document re-creation). */
    disposeTargets() {
      this.resources.forEach((f) => f());
      this.resources.clear();
    }
  };

  // packages/efx-watercolor/src/playground/history.ts
  var TILE = 128;
  var Pool = class {
    atlas;
    /** One tile per layer, so undo can swap a tile's content without allocating a slot. */
    scratch;
    cols;
    free = [];
    constructor(g, tiles, formats) {
      const maxTex = g.gl.getParameter(g.gl.MAX_TEXTURE_SIZE);
      this.cols = Math.min(tiles, Math.floor(maxTex / TILE));
      const rows = Math.ceil(tiles / this.cols);
      this.atlas = formats.map((f) => g.target(this.cols * TILE, rows * TILE, [f], g.gl.NEAREST));
      this.scratch = formats.map((f) => g.target(TILE, TILE, [f], g.gl.NEAREST));
      for (let i = tiles - 1; i >= 0; i--) this.free.push(i);
    }
    dispose(g) {
      [...this.atlas, ...this.scratch].forEach((t) => g.disposeTarget(t));
    }
  };
  var History = class {
    /** `groups[i]` lists a pool's layer formats and its capacity in documents' worth of tiles. */
    constructor(g, w, h, groups) {
      this.g = g;
      this.w = w;
      this.h = h;
      this.groups = groups;
      this.allocate();
    }
    g;
    w;
    h;
    groups;
    pools;
    tilesX;
    tilesY;
    steps = [];
    redoSteps = [];
    maxSteps = 50;
    /** False after undo / redo until the next step begins: the sim settling then is saved only while slots are free. */
    recording = false;
    /** Bumped whenever a step is dropped to make room, so the engine can tell the UI. */
    evictions = 0;
    allocate() {
      this.tilesX = Math.ceil(this.w / TILE);
      this.tilesY = Math.ceil(this.h / TILE);
      const tiles = this.tilesX * this.tilesY;
      this.pools = this.groups.map((gr) => new Pool(this.g, Math.ceil(tiles * gr.documents), gr.formats));
    }
    get canUndo() {
      return this.steps.length > 0;
    }
    get canRedo() {
      return this.redoSteps.length > 0;
    }
    /** Every step, oldest first (applied ones, then undone ones), and how many are applied. */
    entries() {
      const info = (s) => ({ kind: s.kind, label: s.label });
      return { list: [...this.steps.map(info), ...[...this.redoSteps].reverse().map(info)], index: this.steps.length };
    }
    /** The step undo would take back, if any. */
    peekUndo() {
      return this.peek(this.steps);
    }
    /** The step redo would re-apply, if any. */
    peekRedo() {
      return this.peek(this.redoSteps);
    }
    peek(stack) {
      const s = stack[stack.length - 1];
      return s ? { kind: s.kind, label: s.label, boundary: !!s.boundary } : null;
    }
    begin(info, meta) {
      this.clearRedo();
      this.steps.push({ ...info, tiles: this.pools.map(() => /* @__PURE__ */ new Map()), meta });
      this.recording = true;
      while (this.steps.length > this.maxSteps) this.dropOldest();
    }
    /**
     * Record a change of sheet size to `w`×`h`. Earlier steps hold tiles of the old sheet,
     * so they are forgotten; the step itself keeps the old document in `meta`.
     */
    beginBoundary(info, meta, w, h) {
      this.clearRedo();
      for (const s of this.steps) this.release(s);
      this.steps = [{ ...info, tiles: [], meta, boundary: true }];
      this.recording = true;
      this.resize(w, h);
    }
    /** Re-create the tile pools for a `w`×`h` sheet (after a boundary step was crossed). */
    resize(w, h) {
      for (const s of this.steps) {
        this.release(s);
        s.tiles = [];
      }
      for (const s of this.redoSteps) {
        this.release(s);
        s.tiles = [];
      }
      this.dispose();
      this.w = w;
      this.h = h;
      this.allocate();
      for (const s of [...this.steps, ...this.redoSteps]) if (!s.boundary) s.tiles = this.pools.map(() => /* @__PURE__ */ new Map());
    }
    /** Save not-yet-saved tiles of `rect` (document texels) of pool `p` before they change. */
    protect(p, rect, layers) {
      const step = this.steps[this.steps.length - 1];
      if (!step) return;
      if (step.boundary) return;
      const pool = this.pools[p], saved = step.tiles[p];
      const tx0 = Math.max(0, Math.floor(rect.x0 / TILE)), tx1 = Math.min(this.tilesX - 1, Math.floor((rect.x1 - 1) / TILE));
      const ty0 = Math.max(0, Math.floor(rect.y0 / TILE)), ty1 = Math.min(this.tilesY - 1, Math.floor((rect.y1 - 1) / TILE));
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx2 = tx0; tx2 <= tx1; tx2++) {
          const id = ty * this.tilesX + tx2;
          if (saved.has(id)) continue;
          const slot = this.recording ? this.allocSlot(pool) : pool.free.pop();
          if (slot === void 0) return;
          saved.set(id, slot);
          this.copyTile(pool, id, slot, layers, true);
        }
      }
    }
    /**
     * Restore the last step. `layers[p][i]` lists every framebuffer that should receive
     * layer i of pool p (both halves of a ping-pong pair; the first is read from when the
     * current content is saved for redo). `metaNow` is the engine state to come back to
     * on redo. Returns the step's meta and the document rect that changed.
     */
    undo(layers, metaNow) {
      return this.swap(this.steps, this.redoSteps, layers, metaNow);
    }
    /** Re-apply the last undone step. */
    redo(layers, metaNow) {
      return this.swap(this.redoSteps, this.steps, layers, metaNow);
    }
    /**
     * Undo and redo are the same move in opposite directions: pop a step from `from`,
     * swap the content of each of its tiles with what is on the sheet now (through a
     * scratch tile, so nothing is allocated and no other step can be lost), and push
     * the step, now holding the way back, onto `to`.
     */
    swap(from, to, layers, metaNow) {
      const step = from.pop();
      if (!step) return null;
      this.recording = false;
      const info = { kind: step.kind, label: step.label };
      if (step.boundary) {
        for (const s of to) this.release(s);
        to.length = 0;
        to.push({ ...info, tiles: [], meta: metaNow, boundary: true });
        return { meta: step.meta, rect: null, info };
      }
      const back = { ...info, tiles: step.tiles, meta: metaNow };
      let rect = null;
      step.tiles.forEach((saved, p) => {
        const pool = this.pools[p];
        for (const [id, slot] of saved) {
          const tx2 = id % this.tilesX, ty = Math.floor(id / this.tilesX);
          const w = Math.min(TILE, this.w - tx2 * TILE), h = Math.min(TILE, this.h - ty * TILE);
          const sx = slot % pool.cols * TILE, sy = Math.floor(slot / pool.cols) * TILE;
          layers[p].forEach((fbs, i) => {
            const atlas = pool.atlas[i].views[0], scratch = pool.scratch[i].views[0];
            this.g.blit(fbs[0], tx2 * TILE, ty * TILE, scratch, 0, 0, w, h);
            for (const fb of fbs) this.g.blit(atlas, sx, sy, fb, tx2 * TILE, ty * TILE, w, h);
            this.g.blit(scratch, 0, 0, atlas, sx, sy, w, h);
          });
          const r = { x0: tx2 * TILE, y0: ty * TILE, x1: tx2 * TILE + w, y1: ty * TILE + h };
          rect = rect ? { x0: Math.min(rect.x0, r.x0), y0: Math.min(rect.y0, r.y0), x1: Math.max(rect.x1, r.x1), y1: Math.max(rect.y1, r.y1) } : r;
        }
      });
      to.push(back);
      return { meta: step.meta, rect, info };
    }
    /**
     * A free slot of `pool`, making room if needed: the oldest undo steps go first (the
     * step being recorded never does), then redo steps, newest first. Only recording
     * allocates; undo and redo swap tiles in place.
     */
    allocSlot(pool) {
      while (!pool.free.length) {
        if (this.steps.length > 1) this.release(this.steps.shift());
        else if (this.redoSteps.length) this.release(this.redoSteps.pop());
        else break;
        this.evictions++;
      }
      return pool.free.pop();
    }
    dropOldest() {
      const s = this.steps.shift();
      if (s) this.release(s);
    }
    /** Forget the redo stack (after an undone step should not come back). */
    discardRedo() {
      this.clearRedo();
    }
    /** Free the atlases (when the document is replaced without disposing every target). */
    dispose() {
      this.pools.forEach((p) => p.dispose(this.g));
    }
    /** Forget everything (the document was replaced). */
    reset() {
      for (const s of this.steps) this.release(s);
      this.steps = [];
      this.clearRedo();
    }
    clearRedo() {
      for (const s of this.redoSteps) this.release(s);
      this.redoSteps = [];
    }
    release(s) {
      s.tiles.forEach((saved, p) => {
        for (const slot of saved.values()) this.pools[p].free.push(slot);
      });
    }
    copyTile(pool, id, slot, layers, save) {
      const tx2 = id % this.tilesX * TILE, ty = Math.floor(id / this.tilesX) * TILE;
      const sx = slot % pool.cols * TILE, sy = Math.floor(slot / pool.cols) * TILE;
      const w = Math.min(TILE, this.w - tx2), h = Math.min(TILE, this.h - ty);
      layers.forEach((fb, i) => {
        const atlas = pool.atlas[i].views[0];
        if (save) this.g.blit(fb, tx2, ty, atlas, sx, sy, w, h);
        else this.g.blit(atlas, sx, sy, fb, tx2, ty, w, h);
      });
    }
  };

  // packages/efx-watercolor/src/playground/papers.ts
  var PAPERS = [
    { id: "cold", name: "Cold Press", hint: "Medium tooth, natural white: the all-round watercolour sheet", kind: 0, tint: "#f6f3ec", fleck: "#8a8070", bump: 1, mottle: 0.05 },
    { id: "hot", name: "Hot Press", hint: "Pressed smooth and bright: crisp edges, little granulation", kind: 1, tint: "#f8f7f3", fleck: "#8a8478", bump: 0.6, mottle: 0.04 },
    { id: "rough", name: "Rough", hint: "Deep, knobbly tooth: dry brush breaks up, pigment pools in the hollows", kind: 2, tint: "#f5f1e8", fleck: "#857a68", bump: 0.8, mottle: 0.06 },
    { id: "khadi", name: "Khadi", hint: "Handmade cotton rag: lumpy, cream, with fibres and specks", kind: 3, tint: "#efe7d6", fleck: "#6d5f4a", bump: 1, mottle: 0.12 },
    { id: "washi", name: "Washi", hint: "Japanese kozo: smooth, cloudy, with long silky fibres", kind: 4, tint: "#f1ece0", fleck: "#7a6a52", bump: 0.8, mottle: 0.14 },
    { id: "laid", name: "Laid", hint: "Ingres-style laid lines with chain lines every inch", kind: 5, tint: "#f2ebdb", fleck: "#8a7c64", bump: 1, mottle: 0.05 },
    { id: "canvas", name: "Canvas", hint: "Primed cotton canvas board: a fine plain weave", kind: 6, tint: "#f3efe6", fleck: "#8a8070", bump: 1, mottle: 0.04 },
    { id: "toned", name: "Toned Sand", hint: "Mi-Teintes-style honeycomb tooth on a warm tan sheet", kind: 7, tint: "#d9c8a6", fleck: "#6e5f45", bump: 1, mottle: 0.06 },
    { id: "kraft", name: "Kraft", hint: "Recycled brown kraft: smooth, streaky, flecked", kind: 8, tint: "#b99872", fleck: "#4e3b28", bump: 0.8, mottle: 0.12 },
    { id: "cellulose", name: "Student", hint: "Wood-pulp student paper: a regular machine-pressed texture", kind: 9, tint: "#f7f7f4", fleck: "#8a8a84", bump: 1, mottle: 0.03 }
  ];
  var DEFAULT_PAPER = PAPERS[0];
  function linearRGB(hex) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => {
      c /= 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return [f(n >> 16 & 255), f(n >> 8 & 255), f(n & 255)];
  }

  // packages/efx-watercolor/src/playground/spectralData.ts
  var SPECTRAL_EPSILON = 1e-4;
  var PRIMARIES = [[0.96853629, 0.51567122, 0.02055257, 0.03147571, 0.49108579, 0.97901834], [0.96855103, 0.5401552, 0.02059936, 0.03146636, 0.46944057, 0.97901649], [0.96859338, 0.62645502, 0.02062723, 0.03140624, 0.4016578, 0.97901118], [0.96877345, 0.75595012, 0.02073387, 0.03119611, 0.2449042, 0.97892146], [0.96942204, 0.92826996, 0.02114202, 0.03053888, 0.0682688, 0.97858555], [0.97143709, 0.97223624, 0.02233154, 0.02856855, 0.02732883, 0.97743705], [0.97541862, 0.98616174, 0.02556857, 0.02459485, 0.013606, 0.97428075], [0.98074186, 0.98955255, 0.03330189, 0.0192952, 0.01000187, 0.96663223], [0.98580992, 0.98676237, 0.05185294, 0.01423112, 0.01284127, 0.94822893], [0.98971194, 0.97312575, 0.10087639, 0.01033111, 0.02636635, 0.89937713], [0.99238027, 0.91944277, 0.24000413, 765876e-8, 0.07058713, 0.76070164], [0.99409844, 0.32564851, 0.53589066, 593693e-8, 0.70421692, 0.4642044], [0.995172, 0.13820628, 0.79874659, 485616e-8, 0.85473994, 0.20123039], [0.99576545, 0.05015143, 0.91186529, 426186e-8, 0.95081565, 0.08808402], [0.99593552, 0.02912336, 0.95399623, 409039e-8, 0.9717037, 0.04592894], [0.99564041, 0.02421691, 0.97137099, 438375e-8, 0.97651888, 0.02860373], [0.99464769, 0.02660696, 0.97939505, 537525e-8, 0.97429245, 0.02060067], [0.99229579, 0.03407586, 0.98345207, 772962e-8, 0.97012917, 0.01656701], [0.98638762, 0.04835936, 0.98553736, 0.0136612, 0.9425863, 0.01451549], [0.96829712, 1172e-7, 0.98648905, 0.03181352, 0.99989207, 0.01357964], [0.89228016, 8554e-8, 0.98674535, 0.10791525, 0.99989891, 0.01331243], [0.53740239, 0.85267882, 0.98657555, 0.46249516, 0.13823139, 0.01347661], [0.15360445, 0.93188793, 0.98611877, 0.84604333, 0.06968113, 0.01387181], [0.05705719, 0.94810268, 0.98559942, 0.94275572, 0.05628787, 0.01435472], [0.03126539, 0.94200977, 0.98507063, 0.96860996, 0.06111561, 0.01479836], [0.02205445, 0.91478045, 0.98460039, 0.97783966, 0.08987709, 0.0151525], [0.01802271, 0.87065445, 0.98425301, 0.98187757, 0.13656016, 0.01540513], [0.0161346, 0.78827548, 0.98403909, 0.98377315, 0.22169624, 0.01557233], [0.01520947, 0.65738359, 0.98388535, 0.98470202, 0.32176956, 0.0156571], [0.01475977, 0.59909403, 0.98376116, 0.98515481, 0.36157329, 0.01571025], [0.01454263, 0.56817268, 0.98368246, 0.98537114, 0.4836192, 0.01571916], [0.01444459, 0.54031997, 0.98365023, 0.98546685, 0.46488579, 0.01572133], [0.01439897, 0.52110241, 0.98361309, 0.98550011, 0.47440306, 0.01572502], [0.0143762, 0.51041094, 0.98357259, 0.98551031, 0.4857699, 0.01571717], [0.01436343, 0.50526577, 0.98353856, 0.98550741, 0.49267971, 0.01571905], [0.01435687, 0.5025508, 0.98351247, 0.98551323, 0.49625685, 0.01571059], [0.0143537, 0.50126452, 0.98350101, 0.98551563, 0.49807754, 0.01569728], [0.01435408, 0.50083021, 0.98350852, 0.98551547, 0.49889859, 0.0157002]];
  var BASIS = [[0.1441295, 0.1442537, 0.1447023, 0.1481238, 0.1558969, 0.1598567, 0.1620447, 0.1627555, 0.1616249, 0.1577825, 0.1510664, 0.1434845, 0.1548815, 0.1665376, 0.1732235, 0.176503, 0.1775172, 0.1768919, 0.1748587, 0.1783071, 0.17098, 0.1527153, 0.1627231, 0.169401, 0.1714174, 0.170287, 0.1680602, 0.1648873, 0.162965, 0.1626282, 0.159549, 0.1605975, 0.1607086, 0.1606138, 0.1605312, 0.1604933, 0.1604751, 0.160461], [-0.2038064, -0.203989, -0.2047454, -0.2096147, -0.2221909, -0.229624, -0.2342462, -0.2354314, -0.2303617, -0.2137209, -0.1783547, -0.124576, -0.08767601, -0.06654336, -0.05408394, -0.04631953, -0.04068168, -0.03551027, -0.02914774, -0.01869558, 0.01093349, 0.05936064, 0.1243476, 0.151563, 0.1619576, 0.1663112, 0.1683766, 0.1696986, 0.171131, 0.1718488, 0.1723758, 0.1726696, 0.172894, 0.1730376, 0.1731037, 0.1731485, 0.1731795, 0.1731822], [0.03137849, 0.03651497, 0.05369401, 0.09161207, 0.1575574, 0.1842324, 0.1949895, 0.1940139, 0.181434, 0.1530233, 0.09984866, -0.09188325, -0.1765157, -0.2432063, -0.2743489, -0.2876131, -0.2893418, -0.2831437, -0.2674148, -0.3019731, -0.2652804, 0.04536814, 0.1224234, 0.1512875, 0.1570717, 0.1463656, 0.128849, 0.1015794, 0.07210673, 0.06066822, 0.0405239, 0.04040221, 0.03731743, 0.03480428, 0.03341753, 0.03269546, 0.03233622, 0.03218968], [0.3475249, 0.3394636, 0.3120142, 0.2222812, 0.02525531, -0.07617525, -0.131711, -0.1551115, -0.1569514, -0.1445308, -0.1209759, 0.1224517, 0.04911107, -0.01336119, -0.05756325, -0.0821194, -0.0923594, -0.09218955, -0.0876826, -0.1097293, -0.08213999, -0.2512941, -0.2629964, -0.2346993, -0.1994343, -0.1372833, -0.07003431, 0.01097949, 0.07361673, 0.09292193, 0.1495078, 0.1393326, 0.1419586, 0.1459523, 0.1484407, 0.1497109, 0.1503627, 0.1506628], [0.06142204, 0.05786618, 0.04493868, -1667544e-9, -0.1239341, -0.18922, -0.2092335, -0.1813051, -0.09951376, 0.04750551, 0.2508217, 0.4173112, 0.3464263, 0.2114988, 0.1065638, 0.0396658, 1179382e-9, -0.02244844, -0.04379864, -0.2757395, -0.4358296, 2079004e-9, 0.08929734, 0.1616104, 0.1808936, 0.1600107, 0.1229764, 0.06541057, -1589698e-9, -0.02956237, -0.06381081, -0.07050402, -0.07924397, -0.08523274, -0.08834905, -0.09000503, -0.09082922, -0.09112351], [-0.2849056, -0.2809993, -0.2670309, -0.2146758, -0.04397425, 0.07688784, 0.1561441, 0.1960707, 0.2022741, 0.1829012, 0.1568899, 0.1352822, 0.1607311, 0.1282205, 0.08742798, 0.05524357, 0.03074158, 7401419e-9, -0.02492709, -0.144013, -0.2534114, -0.279643, -0.284807, -0.2400265, -0.1937673, -0.1278778, -0.06158691, 0.0106791, 0.06228573, 0.07793386, 0.1189043, 0.1120231, 0.1139095, 0.1167035, 0.118432, 0.119318, 0.1197796, 0.1199808], [-0.04867795, -0.03848097, -6388283e-9, 6091587e-10, -0.0367139, -0.0675538, -0.07838973, -0.06227753, -0.01207089, 0.08113584, 0.2171174, 0.1783848, 0.06910126, -0.09273659, -0.1425212, -0.1316225, -0.07574946, 0.0125239, 0.1328408, -0.1632446, 0.05201528, 0.7089535, 0.1776335, -0.1592273, -0.2833049, -0.2661033, -0.1976904, -0.09221338, -0.02023599, -4615753e-9, 0.08051684, 0.05602729, 0.05512528, 0.058801, 0.06145249, 0.06280478, 0.06355499, 0.06393252]];
  var DISPLAY_BANDS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32];
  var DISPLAY_RGB_WEIGHTS = [[7598756e-9, 0.0144316, 0.02304203], [-0.07190809, -0.05764169, 0.1207272], [0.299773, 0.0127048, 0.3249726], [-0.2579063, -0.06517872, 0.4461339], [0.07037487, 0.05889296, 0.1350291], [-0.2104469, 0.1285821, 0.09775973], [-0.02718884, 0.2208098, -0.09346024], [-0.3172512, 0.4457301, 0.04248862], [0.2293731, 0.1134161, -0.06150663], [0.1930991, 0.1395861, -0.01283952], [0.5274069, 0.03838932, -0.02348521], [0.3899227, 0.07193636, 0.01268301], [-0.165677, -0.2589753, -0.01230862], [0.5972293, 0.3119106, -548141e-8], [-0.197781, 0.08099158, 0.05785604], [-0.06596648, -0.2556352, -0.05165295]];

  // packages/efx-watercolor/src/playground/spectral.ts
  var COEFFS = 7;
  var uncompand = (x) => x < 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  function hexToRgb(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }
  function reflectance(srgb) {
    let [r, g, b] = srgb.map(uncompand);
    const w = Math.min(r, g, b);
    r -= w;
    g -= w;
    b -= w;
    const c = Math.min(g, b), m = Math.min(r, b), y = Math.min(r, g);
    const rr = Math.min(Math.max(0, r - b), Math.max(0, r - g));
    const gg = Math.min(Math.max(0, g - b), Math.max(0, g - r));
    const bb = Math.min(Math.max(0, b - g), Math.max(0, b - r));
    return PRIMARIES.map((k) => Math.max(SPECTRAL_EPSILON, w + c * k[0] + m * k[1] + y * k[2] + rr * k[3] + gg * k[4] + bb * k[5]));
  }
  function pigmentFromHex(hex) {
    const absorbance = reflectance(hexToRgb(hex)).map((v) => -Math.log(v));
    const coeffs = new Float32Array(COEFFS);
    for (let k = 0; k < COEFFS; k++) {
      let s = 0;
      for (let i = 0; i < absorbance.length; i++) s += BASIS[k][i] * absorbance[i];
      coeffs[k] = s;
    }
    return { coeffs, white: 0 };
  }
  var WHITE_GOUACHE = { coeffs: new Float32Array(COEFFS), white: 1 };
  function displayBasisGLSL() {
    const f = (v) => Number.isInteger(v) ? v.toFixed(1) : v.toPrecision(7);
    const lines = [];
    DISPLAY_BANDS.forEach((band, i) => {
      const b = BASIS.map((v) => v[band]);
      const w = DISPLAY_RGB_WEIGHTS[i];
      lines.push(
        `  tr = exp(-max(dot(a, vec4(${b.slice(0, 4).map(f).join(",")})) + dot(b, vec3(${b.slice(4, 7).map(f).join(",")})), 0.0));
  rgb += tr * vec3(${w.map(f).join(",")});`
      );
    });
    return lines.join("\n");
  }

  // packages/efx-watercolor/src/playground/shaders.ts
  var HEADER = `#version 300 es
precision highp float;
in vec2 vUv;
`;
  var splatFS = `${HEADER}
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
uniform float uAspect, uRadius, uHardness;
uniform vec2 uPoint;
uniform vec4 uColor0, uColor1;
void main(){
  vec2 p = vUv - uPoint; p.x *= uAspect;
  float d = dot(p, p) / (uRadius * uRadius);
  float f = exp(-pow(d, uHardness));
  o0 = uColor0 * f;
  o1 = uColor1 * f;
}`;
  var stampFS = `${HEADER}
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
uniform sampler2D uTip, uPaper;
uniform float uAspect, uRadius, uTipAspect, uRound, uGrain, uGrainThr;
uniform float uRough, uJitter;
// quick 261116-inu: the recorded texture rotation, in RADIANS (the engine
// converts the stroke's integer degrees at bind time).
uniform float uTipRotation;
uniform vec2 uPoint, uAxis;
uniform vec4 uColor0, uColor1;
void main(){
  vec2 p = vUv - uPoint; p.x *= uAspect;
  vec2 q = vec2(dot(p, uAxis), dot(p, vec2(-uAxis.y, uAxis.x))) / uRadius;
  q.y /= uTipAspect;
  // Rotate the TIP-SPACE sampling coordinates only. The discard test and every
  // footprint value below keep using the UNROTATED q, so the stamp's silhouette
  // is unchanged and only the texture inside it turns.
  float a = uTipRotation;
  vec2 tq = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
  if (abs(q.x) > 1.0 || abs(q.y) > 1.0) discard;
  // Dry media (uRough > 0): every dab reads a different slice of the tip, so
  // the silhouette breaks up randomly instead of repeating one contour.
  float e0 = fract(sin(dot(uPoint, vec2(12.9898, 78.233))) * 43758.5453);
  float e1 = fract(e0 * 63.7264 + 0.37);
  vec2 uv = clamp(tq * 0.5 + 0.5 + (vec2(e0, e1) - 0.5) * uJitter, 0.0, 1.0);
  float t = texture(uTip, uv).r;
  // Re-threshold the tip into a hard, crumbly mask. uRough = 0 keeps the
  // smooth alpha every wet brush expects.
  float th = uRough * 0.45;
  float dry = smoothstep(th, th + 0.02, t);
  float sharp = mix(t, dry, step(0.0001, uRough));
  float d = dot(q, q);
  float round = 1.0 - smoothstep(0.15, 1.0, d);
  float f = mix(sharp, round, uRound);
  float h = texture(uPaper, vUv).g;
  f *= mix(1.0, smoothstep(uGrainThr - 0.08, uGrainThr + 0.08, h), uGrain);
  o0 = uColor0 * f;
  o1 = uColor1 * f;
}`;
  var advectVelocityFS = `${HEADER}
out vec4 o;
uniform sampler2D uVelocity, uWet;
uniform vec2 uTexel;
uniform float uDt, uDissipation;
void main(){
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uTexel;
  vec2 vel = texture(uVelocity, coord).xy * uDissipation;
  float w = texture(uWet, vUv).x;
  o = vec4(vel * smoothstep(0.005, 0.2, w), 0.0, 1.0);
}`;
  var divergenceFS = `${HEADER}
out vec4 o;
uniform sampler2D uVelocity; uniform vec2 uTexel;
void main(){
  float L = texture(uVelocity, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uVelocity, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uVelocity, vUv - vec2(0.0, uTexel.y)).y;
  float T = texture(uVelocity, vUv + vec2(0.0, uTexel.y)).y;
  o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;
  var pressureFS = `${HEADER}
out vec4 o;
uniform sampler2D uPressure, uDivergence; uniform vec2 uTexel;
void main(){
  float L = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  o = vec4((L + R + B + T - texture(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0);
}`;
  var gradientSubtractFS = `${HEADER}
out vec4 o;
uniform sampler2D uPressure, uVelocity; uniform vec2 uTexel;
void main(){
  float L = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  o = vec4(texture(uVelocity, vUv).xy - 0.5 * vec2(R - L, T - B), 0.0, 1.0);
}`;
  var curlFS = `${HEADER}
out vec4 o;
uniform sampler2D uVelocity; uniform vec2 uTexel;
void main(){
  float L = texture(uVelocity, vUv - vec2(uTexel.x, 0.0)).y;
  float R = texture(uVelocity, vUv + vec2(uTexel.x, 0.0)).y;
  float B = texture(uVelocity, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uVelocity, vUv + vec2(0.0, uTexel.y)).x;
  o = vec4(0.5 * ((R - L) - (T - B)), 0.0, 0.0, 1.0);
}`;
  var vorticityFS = `${HEADER}
out vec4 o;
uniform sampler2D uVelocity, uCurl;
uniform vec2 uTexel; uniform float uCurlAmount, uDt;
void main(){
  float L = texture(uCurl, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uCurl, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uCurl, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uCurl, vUv + vec2(0.0, uTexel.y)).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 1e-4;
  force *= uCurlAmount * C * vec2(1.0, -1.0);
  o = vec4(clamp(texture(uVelocity, vUv).xy + force * uDt, -1000.0, 1000.0), 0.0, 1.0);
}`;
  var scaleFS = `${HEADER}
out vec4 o;
uniform sampler2D uTex; uniform float uValue;
void main(){ o = texture(uTex, vUv) * uValue; }`;
  var wetMaskFS = `${HEADER}
out vec4 o;
uniform sampler2D uWet;
uniform vec2 uBlock;        // one output texel, in wet-texture uv
uniform float uThreshold;
void main(){
  vec2 base = vUv - uBlock * 0.5;
  float m = 0.0;
  for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++) {
    vec2 p = base + uBlock * (vec2(float(x), float(y)) + 0.5) / 8.0;
    m = max(m, texture(uWet, p).r);
  }
  o = vec4(m > uThreshold ? 1.0 : 0.0, 0.0, 0.0, 1.0);
}`;
  var advectWetFS = `${HEADER}
out vec4 o;
uniform sampler2D uVelocity, uWet;
uniform vec2 uSimTexel, uTexel;
uniform float uDt, uDecay, uSpread;
void main(){
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uSimTexel * 0.6;
  float w = texture(uWet, coord).x;
  vec2 b = uTexel * 1.6;
  float n = (texture(uWet, coord + vec2(b.x, 0.0)).x + texture(uWet, coord - vec2(b.x, 0.0)).x
           + texture(uWet, coord + vec2(0.0, b.y)).x + texture(uWet, coord - vec2(0.0, b.y)).x) * 0.25;
  o = vec4(mix(w, n, uSpread) * uDecay, 0.0, 0.0, 1.0);
}`;
  var advectInkFS = `${HEADER}
layout(location=0) out vec4 oA;
layout(location=1) out vec4 oB;
uniform sampler2D uVelocity, uInkA, uInkB, uWet;
uniform vec2 uSimTexel, uTexel;
uniform float uDt, uBleed, uEdge, uAspect, uKeep;
uniform vec3 uBrush;  // x, y, radius (radius <= 0: no brush down)

float mobility(float w){ return smoothstep(0.02, 0.45, w); }

void face(vec2 off, float w, float m, vec4 A, vec4 B, float diffusion, float edge,
          inout vec4 dA, inout vec4 dB){
  vec2 uv = vUv + off;
  float wn = texture(uWet, uv).x;
  float g = m * mobility(wn);
  if (g <= 0.0) return;
  vec4 An = texture(uInkA, uv), Bn = texture(uInkB, uv);
  float d = diffusion * g;
  // positive: water (and pigment) drifts from this texel toward the drier neighbour
  float e = clamp(edge * (w - wn), -0.08, 0.08) * g;
  dA += d * (An - A) - (e > 0.0 ? e * A : e * An);
  dB += d * (Bn - B) - (e > 0.0 ? e * B : e * Bn);
}

void main(){
  float w = texture(uWet, vUv).x;
  float m = mobility(w);
  vec4 A = texture(uInkA, vUv), B = texture(uInkB, vUv);
  if (m < 0.002){ oA = A * uKeep; oB = B * uKeep; return; }

  vec2 vel = texture(uVelocity, vUv).xy;
  vec2 coord = vUv - uDt * vel * uSimTexel * m;
  vec4 a = mix(A, texture(uInkA, coord), m);
  vec4 b = mix(B, texture(uInkB, coord), m);

  float brush = 0.0;
  if (uBrush.z > 0.0){
    vec2 d = vUv - uBrush.xy; d.x *= uAspect;
    brush = exp(-dot(d, d) / (uBrush.z * uBrush.z));
  }
  float diffusion = clamp(uBleed * (0.25 + 1.3 * brush) * 0.3, 0.0, 0.15);
  vec4 dA = vec4(0.0), dB = vec4(0.0);
  face(vec2( uTexel.x, 0.0), w, m, A, B, diffusion, uEdge, dA, dB);
  face(vec2(-uTexel.x, 0.0), w, m, A, B, diffusion, uEdge, dA, dB);
  face(vec2(0.0,  uTexel.y), w, m, A, B, diffusion, uEdge, dA, dB);
  face(vec2(0.0, -uTexel.y), w, m, A, B, diffusion, uEdge, dA, dB);

  // no clamping: basis coefficients are signed (only the spectrum they encode is positive)
  oA = (a + dA) * uKeep;
  oB = vec4((b + dB).rgb, max(b.a + dB.a, 0.0)) * uKeep;
}`;
  var settleFS = `${HEADER}
layout(location=0) out vec4 oA;
layout(location=1) out vec4 oB;
uniform sampler2D uInkA, uInkB;
uniform float uSettle;
void main(){
  vec4 A = texture(uInkA, vUv), B = texture(uInkB, vUv);
  float keep = 1.0 - (1.0 - exp(-2.2 * B.a)) * uSettle;
  oA = A * uSettle * keep;
  oB = vec4(B.rgb * uSettle * keep, 0.0);
}`;
  var bleachFS = `${HEADER}
layout(location=0) out vec4 oA;
layout(location=1) out vec4 oB;
uniform sampler2D uInkB;
uniform float uSettle;
void main(){
  float keep = 1.0 - (1.0 - exp(-2.2 * texture(uInkB, vUv).a)) * uSettle;
  oA = vec4(keep);
  oB = vec4(keep);
}`;
  var liftFS = `${HEADER}
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
uniform sampler2D uTip;
uniform float uAspect, uRadius, uAmount, uTipAspect, uRound;
uniform float uTipRotation;
uniform vec2 uPoint, uAxis;
void main(){
  vec2 p = vUv - uPoint; p.x *= uAspect;
  vec2 q = vec2(dot(p, uAxis), dot(p, vec2(-uAxis.y, uAxis.x))) / uRadius;
  q.y /= uTipAspect;
  // quick 261116-inu: rotate the sampled UV only; the discard and the radial
  // envelope keep the unrotated q.
  float a = uTipRotation;
  vec2 tq = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
  if (abs(q.x) > 1.0 || abs(q.y) > 1.0) discard;
  float t = texture(uTip, clamp(tq * 0.5 + 0.5, 0.0, 1.0)).r;
  float f = uAmount * exp(-pow(dot(q, q), 2.0)) * mix(t, 1.0, uRound);
  o0 = vec4(f);
  o1 = vec4(f);
}`;
  var paperFieldFS = `${HEADER}
out vec4 o;
uniform vec2 uRes, uOffset;   // target size and where it sits on the sheet (texels)
uniform float uScale;         // units per texel
uniform float uSeed;
uniform int uKind;
const float PI = 3.14159265;

uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float hash(vec2 c, float salt){
  ivec2 i = ivec2(floor(c));
  return float(pcg(uint(i.x) + pcg(uint(i.y) + pcg(uint(salt) + uint(uSeed * 7919.0))))) * (1.0 / 4294967296.0);
}
vec2 hash2(vec2 c, float salt){ return vec2(hash(c, salt), hash(c, salt + 1.0)); }
float vnoise(vec2 p, float salt){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i, salt), hash(i + vec2(1.0, 0.0), salt), f.x),
             mix(hash(i + vec2(0.0, 1.0), salt), hash(i + vec2(1.0, 1.0), salt), f.x), f.y);
}
// normalised to 0..1; each octave rotated so the lattice never shows
float fbm(vec2 p, int oct, float salt){
  float v = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 6; i++){
    if (i >= oct) break;
    v += a * vnoise(p, salt + float(i) * 13.0); n += a;
    p = mat2(0.8, -0.6, 0.6, 0.8) * p * 2.03 + 17.1; a *= 0.5;
  }
  return v / n;
}
// distances to the nearest and second-nearest of a jittered lattice of points
vec2 cells(vec2 p, float jitter, float salt){
  vec2 i = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 c = vec2(x, y);
    float d = length(c + 0.5 + (hash2(i + c, salt) - 0.5) * jitter - f);
    if (d < d1){ d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return vec2(d1, d2);
}
// Rounded hills of random size and height scattered on a jittered grid; never polygonal
// like cells, because neighbouring hills simply add up. Roughly 0..1.
float blobs(vec2 p, float salt){
  vec2 i = floor(p), f = fract(p);
  float h = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 c = vec2(x, y);
    vec4 r = vec4(hash2(i + c, salt), hash2(i + c, salt + 2.0));
    vec2 d = c + r.xy - f;
    float rad = 0.35 + 0.4 * r.z;
    h += (0.5 + 0.5 * r.w) * exp(-dot(d, d) / (rad * rad));
  }
  return h * 0.75;
}
float segment(vec2 p, vec2 a, vec2 b){
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
// Thin strands scattered over a grid of 'cell' units, up to 'len' cells long and 'width'
// units wide; returns the coverage of the nearest. 'along' lines them up with x, the
// way a paper machine lays its fibres; 'density' is the share of grid slots that hold one.
float fibres(vec2 p, float cell, float len, float width, float density, float along, float salt){
  p /= cell;
  vec2 i = floor(p);
  float cov = 0.0;
  for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++){
    vec2 c = i + vec2(x, y);
    for (int k = 0; k < 2; k++){
      float s = salt + float(k) * 31.0;
      vec4 h = vec4(hash2(c, s), hash2(c, s + 2.0));
      if (h.w < density){
        float a = (h.z - 0.5) * PI * (1.0 - along);
        vec2 d = vec2(cos(a), sin(a)) * len * (0.35 + 0.65 * hash(c, s + 4.0)) * 0.5;
        float dist = segment(p, c + h.xy - d, c + h.xy + d) * cell;
        cov = max(cov, (1.0 - smoothstep(width * 0.5, width * 0.5 + 0.9, dist)) * (0.55 + 0.45 * hash(c, s + 5.0)));
      }
    }
  }
  return cov;
}
// small round specks: coverage of the nearest, 'density' of grid slots hold one
float specks(vec2 p, float cell, float radius, float density, float salt){
  vec2 i = floor(p / cell), f = p / cell - i;
  float cov = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 c = vec2(x, y);
    if (hash(i + c, salt + 2.0) < density){
      float r = radius * (0.4 + 0.6 * hash(i + c, salt + 3.0));
      float d = length(c + hash2(i + c, salt) - f) * cell;
      cov = max(cov, 1.0 - smoothstep(r * 0.6, r + 0.6, d));
    }
  }
  return cov;
}
// distance to the nearest centre of a hexagonal lattice with spacing 1
float hexDist(vec2 p){
  const vec2 s = vec2(1.0, 1.7320508);
  vec2 a = mod(p, s) - s * 0.5, b = mod(p - s * 0.5, s) - s * 0.5;
  return min(length(a), length(b));
}
vec2 warp(vec2 p, float freq, float amount, float salt){
  return p + (vec2(fbm(p * freq, 3, salt), fbm(p * freq, 3, salt + 50.0)) - 0.5) * amount;
}

// Cold press: rounded, irregular bumps of mixed size (~0.5-2 mm) over a fine felt.
vec3 coldPress(vec2 p){
  vec2 q = warp(p, 0.02, 10.0, 100.0);
  float hills = blobs(q / 11.0, 110.0) * 0.6 + blobs(q / 5.5, 115.0) * 0.4;
  float h = hills * 0.5 + fbm(q * 0.09, 5, 120.0) * 0.38 + vnoise(p * 0.5, 130.0) * 0.12;
  return vec3(0.5 + (h - 0.5) * 1.3, fbm(p * 0.012, 4, 140.0), 0.5);
}
// Hot press: pressed nearly flat; only a faint felt and the fibres show.
vec3 hotPress(vec2 p){
  float h = fbm(p * 0.06, 4, 200.0) * 0.6 + vnoise(p * 0.4, 210.0) * 0.25 + fibres(p, 16.0, 2.5, 0.8, 0.3, 0.0, 220.0) * 0.05;
  return vec3(0.5 + (h - 0.4) * 0.45, fbm(p * 0.01, 4, 230.0), 0.5);
}
// Rough: big knobbly hills (~2-4 mm) with deep valleys between them.
vec3 rough(vec2 p){
  vec2 q = warp(p, 0.01, 40.0, 300.0);
  // hill size varies across the sheet, as on a mould-made rough
  float big = smoothstep(0.3, 0.7, fbm(p * 0.006, 3, 305.0));
  float hills = blobs(q / 26.0, 310.0) * (0.35 + 0.4 * big) + blobs(q / 12.0, 315.0) * (0.45 - 0.25 * big);
  float h = hills * 0.65 + fbm(q * 0.06, 5, 320.0) * 0.25 + vnoise(p * 0.45, 325.0) * 0.1;
  return vec3(0.5 + (h - 0.52) * 1.5, fbm(p * 0.01, 4, 330.0), 0.5);
}
// Khadi: handmade, lumpy at every scale, with raised fibres and dark inclusions.
vec3 khadi(vec2 p){
  vec2 q = warp(p, 0.008, 60.0, 400.0);
  float lumps = fbm(q * 0.035, 5, 410.0);
  vec2 c = cells(q / 13.0, 1.0, 420.0);
  float knobs = 1.0 - smoothstep(0.0, 0.9, c.x);
  float fib = fibres(warp(p, 0.05, 8.0, 430.0), 9.0, 3.0, 1.1, 0.6, 0.0, 440.0);
  float h = lumps * 0.5 + knobs * 0.3 + fbm(p * 0.2, 3, 450.0) * 0.16 + fib * 0.03;
  float dark = max(specks(p, 60.0, 2.0, 0.3, 460.0), fibres(warp(p, 0.06, 10.0, 465.0), 110.0, 0.4, 0.9, 0.3, 0.0, 470.0) * 0.6);
  return vec3(0.5 + (h - 0.5) * 1.6, fbm(p * 0.006, 4, 480.0) * 0.7 + fib * 0.25, 0.5 - dark * 0.35 + fib * 0.06);
}
// Washi: smooth and cloudy, a web of long kozo fibres lying on top, the odd bark speck.
vec3 washi(vec2 p){
  vec2 q = warp(p, 0.025, 28.0, 500.0);
  float longF = fibres(q, 42.0, 3.4, 1.3, 0.4, 0.0, 510.0) * (0.6 + 0.4 * vnoise(p * 0.05, 512.0));
  float fineF = fibres(warp(p, 0.05, 10.0, 515.0), 14.0, 3.0, 0.6, 0.45, 0.0, 520.0);
  float h = fbm(p * 0.05, 4, 530.0) * 0.8 + longF * 0.08 + fineF * 0.03;
  float cloud = fbm(p * 0.005, 5, 540.0);
  float bark = specks(p, 70.0, 1.6, 0.18, 550.0);
  return vec3(0.5 + (h - 0.42) * 0.7, cloud * 0.85 + longF * 0.15, 0.5 + longF * 0.16 + fineF * 0.05 - bark * 0.4);
}
// Laid: close laid lines (~1 mm) crossed by chain lines (~25 mm), over a soft felt.
vec3 laid(vec2 p){
  float wob = (fbm(p * vec2(0.004, 0.02), 3, 600.0) - 0.5) * 6.0;
  float lines = pow(0.5 + 0.5 * cos(2.0 * PI * (p.y + wob) / 5.6), 2.0);
  float cx = p.x + (fbm(p * vec2(0.02, 0.004), 3, 610.0) - 0.5) * 8.0;
  float dc = abs(fract(cx / 140.0) - 0.5) * 140.0;   // distance to the nearest chain line
  float chain = 1.0 - smoothstep(1.0, 3.5, dc);
  float h = lines * 0.1 + chain * 0.05 + fbm(p * 0.08, 4, 620.0) * 0.6;
  // the sheet runs a touch thicker beside each chain line, and the laid lines read faintly in the tone
  float tone = 0.5 - 0.12 * exp(-dc / 12.0) - 0.06 * lines + (fbm(p * 0.01, 3, 630.0) - 0.5) * 0.6;
  return vec3(0.5 + (h - 0.36) * 1.1, tone, 0.5);
}
// Canvas: a plain weave of slightly uneven threads under a coat of gesso.
vec3 canvas(vec2 p){
  const float T = 8.0;
  p += (vec2(vnoise(p * 0.02, 700.0), vnoise(p * 0.02, 701.0)) - 0.5) * T * 1.2;
  vec2 c = p / T, i = floor(c), f = fract(c);
  float tx = 0.8 + 0.2 * hash(vec2(i.x, 0.0), 702.0) + 0.3 * (vnoise(vec2(i.x * 5.0, c.y * 0.35), 703.0) - 0.5);
  float ty = 0.8 + 0.2 * hash(vec2(0.0, i.y), 704.0) + 0.3 * (vnoise(vec2(c.x * 0.35, i.y * 5.0), 705.0) - 0.5);
  // where a thread crosses over, it shows as a rice-grain bump along its length;
  // over and under alternate, so the grains make a checkerboard
  vec2 d = f - 0.5;
  bool warpUp = mod(i.x + i.y, 2.0) > 0.5;
  d *= warpUp ? vec2(2.3, 1.15) : vec2(1.15, 2.3);
  float grain = max(0.0, 1.0 - dot(d, d)) * (warpUp ? tx : ty);
  float h = sqrt(grain) * 0.75 + fbm(p * 0.15, 3, 706.0) * 0.25;
  return vec3(0.5 + (h - 0.55) * 1.1, fbm(p * 0.01, 3, 707.0), 0.5);
}
// Toned (Mi-Teintes honeycomb): a regular mesh of shallow pits ~1.5 mm across.
vec3 toned(vec2 p){
  vec2 q = warp(p, 0.05, 7.0, 800.0) / 9.0;
  float d = hexDist(q) * (0.8 + 0.4 * vnoise(q * 2.0, 805.0));
  float rims = smoothstep(0.1, 0.55, d);
  float h = rims * 0.28 + fbm(p * 0.09, 4, 810.0) * 0.6 + fibres(p, 12.0, 2.0, 0.9, 0.35, 0.0, 820.0) * 0.04;
  return vec3(0.5 + (h - 0.42) * 1.2, fbm(p * 0.012, 4, 830.0), 0.5 - specks(p, 60.0, 1.2, 0.2, 840.0) * 0.3);
}
// Kraft: smooth, streaky along the machine direction, with dark bark and recycled flecks.
vec3 kraft(vec2 p){
  float h = fbm(p * 0.07, 4, 900.0) * 0.6 + vnoise(p * 0.35, 910.0) * 0.32 + fibres(p, 10.0, 2.5, 0.9, 0.6, 0.7, 920.0) * 0.04;
  float streak = fbm(p * vec2(0.004, 0.03), 5, 930.0);
  float dark = max(fibres(warp(p, 0.08, 10.0, 935.0), 60.0, 0.35, 0.7, 0.2, 0.6, 940.0) * 0.6, specks(p, 40.0, 1.3, 0.35, 950.0));
  float light = fibres(warp(p, 0.08, 10.0, 955.0), 70.0, 0.4, 1.0, 0.25, 0.5, 960.0);
  return vec3(0.5 + (h - 0.45) * 0.7, streak * 0.8 + fbm(p * 0.01, 3, 970.0) * 0.2, 0.5 - dark * 0.28 + light * 0.12);
}
// Student (cellulose): a felt-pressed texture of small bumps all of one size, evenly spread.
vec3 student(vec2 p){
  vec2 q = warp(p, 0.03, 3.0, 995.0);
  vec2 c = cells(q / 7.0, 0.7, 1000.0);
  float bumps = 1.0 - smoothstep(0.0, 0.7, c.x);
  float h = bumps * 0.6 + fbm(p * 0.12, 3, 1010.0) * 0.4;
  return vec3(0.5 + (h - 0.48) * 1.1, fbm(p * 0.015, 3, 1020.0), 0.5);
}

void main(){
  vec2 p = (vUv * uRes + uOffset) * uScale;
  vec3 f;
  switch (uKind){
    case 1: f = hotPress(p); break;
    case 2: f = rough(p); break;
    case 3: f = khadi(p); break;
    case 4: f = washi(p); break;
    case 5: f = laid(p); break;
    case 6: f = canvas(p); break;
    case 7: f = toned(p); break;
    case 8: f = kraft(p); break;
    case 9: f = student(p); break;
    default: f = coldPress(p);
  }
  o = vec4(clamp(f, 0.0, 1.0), 1.0);
}`;
  var paperLightFS = `${HEADER}
out vec4 o;
uniform sampler2D uField;
uniform vec2 uTexel;
uniform float uBump;          // relief strength, already divided by units per texel
void main(){
  vec4 f = texture(uField, vUv);
  float l = texture(uField, vUv - vec2(uTexel.x, 0.0)).x, r = texture(uField, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture(uField, vUv - vec2(0.0, uTexel.y)).x, t = texture(uField, vUv + vec2(0.0, uTexel.y)).x;
  vec3 n = normalize(vec3((l - r) * uBump, (b - t) * uBump, 1.0));
  vec3 L = normalize(vec3(-0.5, 0.6, 0.62));
  // a little ambient occlusion: valleys sit in shadow whichever way the light falls
  float lit = 0.5 + (dot(n, L) - L.z) * 1.3 + (f.x - 0.5) * 0.25;
  o = vec4(clamp(lit, 0.0, 1.0), f.x, f.y, f.z);
}`;
  var PAPER_COLOUR = `
uniform vec3 uPaperTint, uFleckTint;
uniform float uMottle;
uniform float uTexture;       // texture strength: 0 a flat sheet of the tint, 1 full relief
vec3 paperColour(vec4 paper, vec3 base){
  vec3 c = base * (1.0 + uTexture * ((paper.r - 0.5) * 0.32 + (paper.b - 0.5) * uMottle * 2.0));
  float fl = (paper.a - 0.5) * 2.0 * uTexture;
  return fl < 0.0 ? mix(c, uFleckTint, -fl) : mix(c, min(base * 1.1 + 0.02, vec3(1.0)), fl);
}`;
  var TO_SRGB = `
vec3 toSRGB(vec3 c){
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}`;
  var paperSwatchFS = `${HEADER}
out vec4 o;
uniform sampler2D uPaper;
${PAPER_COLOUR}
${TO_SRGB}
void main(){
  vec4 paper = texture(uPaper, vUv);
  vec3 c = paperColour(paper, uPaperTint);
  float x = vUv.x * 0.62 + (1.0 - vUv.y) * 0.38 + (paper.g - 0.5) * 0.03;
  float wash = smoothstep(0.6, 0.605, x);
  float gran = 1.0 + (0.5 - paper.g) * 2.4;
  float tide = 1.0 + 0.5 * exp(-(x - 0.6) * 90.0) * wash;
  c *= mix(vec3(1.0), pow(vec3(0.3, 0.38, 0.72), vec3(gran * tide)), wash);
  o = vec4(toSRGB(c), 1.0);
}`;
  var paperSheetFS = `${HEADER}
out vec4 o;
uniform sampler2D uPaper;
${PAPER_COLOUR}
${TO_SRGB}
void main(){
  vec4 paper = texture(uPaper, vUv);
  vec3 c = paperColour(paper, uPaperTint);
  o = vec4(toSRGB(c), 1.0);
}`;
  var fillFS = `${HEADER}
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
uniform highp sampler2D uField;
uniform sampler2D uPaper;
uniform float uFrom, uTo, uWidth, uSoft, uGrain, uGrainThr, uJitter;
uniform int uCumulative;
uniform vec4 uColor0, uColor1;
float ramp(float x){ return smoothstep(0.0, 1.0, clamp(x / uWidth, 0.0, 1.0)); }
void main(){
  vec2 f = texture(uField, vUv).rg;
  if (f.r < 0.0) discard;
  float h = texture(uPaper, vUv).g;
  float r = max(0.0, f.r + (h - 0.5) * uJitter);
  float w = ramp(uTo - r) - (uCumulative == 1 ? 0.0 : ramp(uFrom - r));
  if (w <= 0.0) discard;
  float edge = uSoft > 0.0 ? smoothstep(0.0, uSoft, f.g + 0.5) : 1.0;
  w *= edge * mix(1.0, smoothstep(uGrainThr - 0.08, uGrainThr + 0.08, h), uGrain);
  o0 = uColor0 * w;
  o1 = uColor1 * w;
}`;
  var displayFS = `${HEADER}
out vec4 o;
uniform sampler2D uInkA, uInkB, uFixedA, uFixedB, uWet, uPaper;
uniform vec4 uView;       // canvas px -> document uv: uv = (fragCoord - xy) / zw
uniform vec2 uTexel;      // document texel size
uniform float uGranulation, uEdgeDarken;
uniform float uFlat;      // 1: ignore the paper's relief, grain and wetness (for region picking)
uniform vec3 uDesk;
uniform int uMode;        // 0 screen, 1 export on paper, 2 export transparent, 3 export on white, 4 display pigment alpha
uniform sampler2D uRef;   // reference image (screen only), sRGB, y up
uniform vec4 uRefRect;    // its placement in document uv: xy origin, zw size
uniform float uRefOpacity;
uniform float uShadow;    // screen only: size of the sheet's shadow on the desk (canvas px), 0 for exports
uniform float uDpr;
${PAPER_COLOUR}
${TO_SRGB}
float density(vec2 uv){ return texture(uInkA, uv).x + texture(uFixedA, uv).x; }

// Signed distance (canvas px) from p to the sheet, moved down by \`drop\`.
float sheetDist(vec2 p, float drop){
  vec2 q = abs(p - uView.xy - uView.zw * 0.5 + vec2(0.0, drop)) - uView.zw * 0.5;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

// The sheet lying on the desk: a tight contact shadow at its edge and a soft one
// cast a little downward, as from a light above and in front.
vec3 desk(vec2 p){
  float R = uShadow;
  float contact = 1.0 - smoothstep(0.0, 0.12 * R, sheetDist(p, 0.03 * R));
  float d = max(sheetDist(p, 0.3 * R), 0.0) / R;
  float ambient = exp(-3.0 * d * d) * 0.75 + exp(-0.9 * d) * 0.25;   // a soft core with a long, faint tail
  vec3 lin = pow(uDesk, vec3(2.2)) * (1.0 - 0.45 * contact) * (1.0 - 0.32 * ambient);
  return toSRGB(lin);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - uView.xy) / uView.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0){
    // Compositor layer: nothing outside the sheet \u2014 the fond is the compositor's.
    o = (uMode == 2 || uMode == 4) ? vec4(0.0) : vec4(uShadow > 0.0 ? desk(gl_FragCoord.xy) : uDesk, 1.0);
    return;
  }

  vec4 paper = mix(texture(uPaper, uv), vec4(0.5), uFlat);
  vec4 iB = texture(uInkB, uv);
  vec4 a = texture(uInkA, uv) + texture(uFixedA, uv);
  vec3 b = iB.rgb + texture(uFixedB, uv).rgb;

  // Granulation: pigment settles into the valleys of the paper.
  float d0 = a.x;
  float gran = 1.0 + uGranulation * (0.5 - paper.g) * 2.2;
  // Edge darkening from the density gradient keeps fine pen work crisp.
  float l = density(uv - vec2(uTexel.x, 0.0)), r = density(uv + vec2(uTexel.x, 0.0));
  float bt = density(uv - vec2(0.0, uTexel.y)), t = density(uv + vec2(0.0, uTexel.y));
  float edge = min(length(vec2(r - l, t - bt)) / (d0 + 1.0), 1.0);
  float k = mix(gran * (1.0 + uEdgeDarken * edge), 1.0, uFlat);
  a *= k; b *= k;

  vec3 rgb = vec3(0.0);
  float tr;
${displayBasisGLSL()}

  // White gouache sits on top as an opaque layer, a little patchy on the tooth.
  float cov = 1.0 - exp(-2.2 * iB.a);
  cov = clamp(cov * (1.0 + (paper.g - 0.5) * 0.5), 0.0, 1.0);
  vec3 gouache = vec3(0.96, 0.955, 0.94) * (1.0 + 0.1 * (paper.r - 0.5) * uTexture);

  if (uMode == 2){
    // TRANSMITTANCE, opaque (R2.2 paper-agnostic multiply seam). rgb is how
    // much paper light gets through the pigment. Composited with
    // mix-blend-mode: multiply over ANY fond: result = fond x transmittance,
    // exactly MODE.paper's rgb * paperCol. No alpha to misread (F1 neon /
    // fringe) and no un-mix round-trip to lose thin strokes (F2 fade).
    vec3 t = toSRGB(rgb);
    // White gouache is a cover layer \u2014 lift transmittance so multiply shows
    // it as a pale veil (the pigment underneath still tints).
    t = mix(t, vec3(1.0), cov);
    o = vec4(t, 1.0);
    return;
  }

  if (uMode == 4){
    // PIGMENT ALPHA (compositor display, 2026-10-26 round 2). The same
    // transmittance as mode 2, re-expressed as straight-alpha pigment so the
    // live sheet stacks with REAL layer alpha: alpha = 1 - min(r,g,b),
    // colour = (t - min) / alpha. Light washes stay translucent, dense pigment
    // masks. displayFS writes PREMULTIPLIED pixels (F1 contract), so scale the
    // colour by alpha. Storage/export keeps mode 2's opaque sheet.
    vec3 t = toSRGB(rgb);
    t = mix(t, vec3(1.0), cov);
    float mn = min(min(t.r, t.g), t.b);
    float alpha = 1.0 - mn;
    vec3 pigment = alpha > 0.0 ? (t - vec3(mn)) / alpha : vec3(0.0);
    o = vec4(pigment * alpha, alpha);
    return;
  }

  // Paper: the sheet's tint, lit relief, fibre mottling and flecks (linear light).
  vec3 paperCol = paperColour(paper, uMode == 3 ? vec3(1.0) : uPaperTint);
  // On screen, a reference image shows through the paper, under the paint.
  if (uMode == 0 && uRefOpacity > 0.0){
    vec2 ruv = (uv - uRefRect.xy) / uRefRect.zw;
    if (ruv.x >= 0.0 && ruv.y >= 0.0 && ruv.x <= 1.0 && ruv.y <= 1.0){
      vec4 r = texture(uRef, ruv);
      vec3 lin = pow(r.rgb, vec3(2.2));
      paperCol = mix(paperCol, lin, r.a * uRefOpacity);
    }
  }
  vec3 col = rgb * paperCol;
  col = mix(col, uMode == 3 ? vec3(1.0) : gouache, cov);

  // Wet paper reads darker and slightly cool.
  float ws = uMode == 3 ? 0.0 : smoothstep(0.02, 0.7, texture(uWet, uv).x) * (1.0 - uFlat);
  col *= vec3(1.0) - ws * vec3(0.12, 0.11, 0.08);

  // On screen, the cut edge of the sheet catches a faint shade, so it reads as a thin card.
  if (uShadow > 0.0){
    float inside = -sheetDist(gl_FragCoord.xy, 0.0);
    col *= mix(0.9, 1.0, smoothstep(0.0, 1.5 * uDpr, inside));
  }

  o = vec4(toSRGB(col), 1.0);
}`;

  // packages/efx-watercolor/src/playground/wetState.ts
  var WET_THRESHOLD = 4e-3;
  function isSheetWet(state) {
    return !state.fixing && state.wetPeak > WET_THRESHOLD && state.nowMs < state.wetUntilMs;
  }

  // packages/efx-watercolor/src/playground/Engine.ts
  var DEFAULT_PARAMS = {
    size: 0.5,
    water: 0.6,
    load: 0.5,
    flow: 0.45,
    bleed: 0.5,
    dry: 0.4,
    edge: 0.5,
    granulation: 0.45,
    lift: 0.22
  };
  var MODE = { screen: 0, paper: 1, transparent: 2, white: 3, pigment: 4 };
  var MAX_REF_SIDE = 4096;
  function scriptWidthFactor(value) {
    return Number.isFinite(value) ? clamp(value, ANCHOR_WIDTH_MIN, ANCHOR_WIDTH_MAX) : 1;
  }
  var DEG2 = Math.PI / 180;
  var SCRIPT_POINTER = -1;
  function scriptPressure(p) {
    return p < 0 ? -1 : clamp(p, 0.02, 1);
  }
  var STROKE_LABEL = { brush: "Brush stroke", water: "Water", pen: "Pen", lift: "Lift" };
  var GL_RG16F = 33327;
  var GL_R16F = 33325;
  var GL_RGBA16F = 34842;
  var GL_RG32F = 33328;
  var GL_RG = 33319;
  var GL_RED = 6403;
  var GL_RGBA = 6408;
  var GL_RGBA8 = 32856;
  var GL_HALF_FLOAT = 5131;
  var GL_UNSIGNED_BYTE = 5121;
  var GL_FLOAT = 5126;
  var HALF_FLOAT_RG = { internal: GL_RG16F, format: GL_RG, type: GL_HALF_FLOAT };
  var HALF_FLOAT_R = { internal: GL_R16F, format: GL_RED, type: GL_HALF_FLOAT };
  var HALF_FLOAT_RGBA = { internal: GL_RGBA16F, format: GL_RGBA, type: GL_HALF_FLOAT };
  var RGBA8 = { internal: GL_RGBA8, format: GL_RGBA, type: GL_UNSIGNED_BYTE };
  var FLOAT_RG = { internal: GL_RG32F, format: GL_RG, type: GL_FLOAT };
  var FILL_WATER_LEAD = 10;
  var FILL_WIDTH = 24;
  var FILL_JITTER = 3;
  var SIM_BASE = 256;
  var PRESSURE_ITERATIONS = 20;
  var SCREEN_DOC_LONG = 2048;
  var SCREEN_DOC_SHORT = 1536;
  var MAX_DOC_LONG = 3072;
  var MAX_DOC_PIXELS = 42e5;
  var MIN_DOC_SIDE = 256;
  var MIN_ZOOM = 0.02;
  var MAX_ZOOM = 32;
  var FIT_PADDING = 24;
  var PAN_KEEP = 48;
  var FIX_DURATION = 1.2;
  var MASK_BLOCK = 16;
  var MASK_EVERY = 10;
  var MASK_MARGIN = MASK_BLOCK + 8;
  var PROTECT_MARGIN = 24;
  var DESK = [1, 1, 1];
  var PAPER_UNITS = 1100;
  var clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  function clampDocSize(w, h, maxSide = MAX_DOC_LONG) {
    w = Math.max(MIN_DOC_SIDE, Math.round(w) || MIN_DOC_SIDE);
    h = Math.max(MIN_DOC_SIDE, Math.round(h) || MIN_DOC_SIDE);
    const s = Math.min(1, Math.min(MAX_DOC_LONG, maxSide) / Math.max(w, h), Math.sqrt(MAX_DOC_PIXELS / (w * h)));
    return [Math.max(MIN_DOC_SIDE, Math.round(w * s)), Math.max(MIN_DOC_SIDE, Math.round(h * s))];
  }
  var union = (a, b) => a ? { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) } : { ...b };
  var WatercolorEngine = class {
    /** `size` is the sheet in texels; omitted, the sheet follows the window ("screen"). */
    constructor(canvas, cursor, callbacks = {}, size2) {
      this.canvas = canvas;
      this.cursor = cursor;
      this.callbacks = callbacks;
      const gl = canvas.getContext("webgl2", {
        // alpha: true so the compositor-layer display can show the fond beneath.
        // premultipliedAlpha stays at the WebGL DEFAULT (true) — displayFS
        // writes premultiplied pixels (F1). A straight-alpha write reads as
        // neon + a light fringe on WKWebView even with premultipliedAlpha:false
        // (that flag is not reliably honoured there).
        alpha: true,
        premultipliedAlpha: true,
        depth: false,
        stencil: false,
        antialias: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance"
      });
      if (!gl) throw new Error("WebGL2 is not available in this browser.");
      if (!gl.getExtension("EXT_color_buffer_float") && !gl.getExtension("EXT_color_buffer_half_float"))
        throw new Error("This GPU cannot render to floating-point textures.");
      this.gl = gl;
      this.g = new GL(gl);
      gl.disable(gl.BLEND);
      this.programs = {
        splat: this.g.program(splatFS),
        stamp: this.g.program(stampFS),
        fill: this.g.program(fillFS),
        advectVelocity: this.g.program(advectVelocityFS),
        divergence: this.g.program(divergenceFS),
        pressure: this.g.program(pressureFS),
        gradient: this.g.program(gradientSubtractFS),
        curl: this.g.program(curlFS),
        vorticity: this.g.program(vorticityFS),
        scale: this.g.program(scaleFS),
        advectWet: this.g.program(advectWetFS),
        wetMask: this.g.program(wetMaskFS),
        advectInk: this.g.program(advectInkFS),
        settle: this.g.program(settleFS),
        bleach: this.g.program(bleachFS),
        lift: this.g.program(liftFS),
        paperField: this.g.program(paperFieldFS),
        paperLight: this.g.program(paperLightFS),
        paperSwatch: this.g.program(paperSwatchFS),
        paperSheet: this.g.program(paperSheetFS),
        display: this.g.program(displayFS)
      };
      this.fitCanvas();
      this.createDocument(size2 ?? this.screenSize);
      this.attachInput();
      this.schedule();
    }
    canvas;
    cursor;
    callbacks;
    params = { ...DEFAULT_PARAMS };
    tool = "brush";
    pigment = pigmentFromHex("#2338a8");
    // 261027-gh9f: the Studio opens on the dry chalk stick (first Brush-tab
    // card); the everyday round remains the fallback.
    brush = buildBrush(BRUSH_PRESETS.find((p) => p.id === "chalk") ?? BRUSH_PRESETS.find((p) => p.id === "round") ?? BRUSH_PRESETS[0]);
    /** quick-261115-oh9: the untextured silhouette a lift stroke erases with (see setLiftBrush). */
    liftBrush = null;
    /** Once an Apple Pencil / stylus is seen, fingers paint with clear water. */
    fingerIsWater = true;
    /** When false, pointers on the paper are ignored (another tool, e.g. text, is driving it). */
    interactive = true;
    /** Footprint scale of the scripted stroke in progress (see scriptBegin). */
    scriptScale = 1;
    // 261111-wd6: the pigment `configure()` installed for the active scripted
    // stroke. Per-sample colours are swapped in around each stamp and this is
    // restored afterwards, so a sampled colour can never leak into the next
    // stroke, a bucket fill, or the live path.
    strokeBasePigment = null;
    /** Reused interpolation target — a per-sample pigment allocates nothing. */
    scratchPigment = {
      coeffs: new Float32Array(COEFFS),
      white: 0
    };
    nav = false;
    /** Deterministic bake seam: seeded RNG (A2). Defaults to Math.random for live. */
    rng = Math.random;
    /** Deterministic bake seam: virtual clock in ms. Defaults to performance.now(). */
    clock = () => performance.now();
    /** When true, schedule() is a no-op — the host drives tick(dt) (bake). */
    manual = false;
    tipTextures = /* @__PURE__ */ new Map();
    paperPreset = DEFAULT_PAPER;
    paperSeed = 0;
    paperStrength = 1;
    paperScale = 1;
    // paper units per texel, fixed when the sheet is made
    paperOrigin = [0, 0];
    // where the sheet sits in the paper's field (texels)
    // reference image: shown under the paint on screen only, never exported
    ref = null;
    refRect = { x: 0, y: 0, w: 1, h: 1 };
    refOpacity = 0.5;
    refVisible = true;
    lastDir = [1, 0];
    // direction of the last stroke, for the first dab
    lastAngle = 0;
    // tip angle shown by the hover cursor
    g;
    gl;
    programs;
    canvasSize = [1, 1];
    dpr = 1;
    view = { x: 0, y: 0, w: 1, h: 1 };
    // document placement in canvas px
    zoomLevel = 1;
    // 1 = one document texel per CSS px
    /** Compositor-layer mode: exact-fit view + transparent pigment display. */
    compositorLayer = false;
    fitPadding = FIT_PADDING;
    // CSS px around the sheet when fitted
    pan = [0, 0];
    // sheet centre from canvas centre (canvas px, y up)
    fitMode = true;
    // keep the sheet fitted as the window changes
    // document state
    dw = 1;
    dh = 1;
    velocity;
    pressure;
    divergence;
    curl;
    ink;
    fixed;
    wet;
    paper;
    wetMask;
    // coarse "is there water here" map, read back to bound the sim
    maskPixels = new Uint8Array(0);
    maskCounter = 0;
    history;
    // simulation bookkeeping
    active = null;
    // document texels the sim must process
    painted = null;
    // where mobile pigment may exist (since the last fix)
    everPainted = null;
    // where any pigment, mobile or fixed, may exist
    dirty = null;
    // document texels to redraw
    dirtyAll = true;
    lastWet = -Infinity;
    // ms timestamp of the last water added
    wetPeak = 0;
    minAwakeUntil = 0;
    fixTimer = 0;
    /** Studio settle-cap fix: the last step is a fix a new stroke may reopen (cancelAutoFix). */
    autoFix = false;
    flowSpeed = 0;
    // upper bound on water speed (sim texels / s)
    growCarry = 0;
    // fractional texels the active rect still has to grow
    brushNow = { x: 0, y: 0, r: 0 };
    raf = 0;
    lastFrame = 0;
    seenEvictions = 0;
    // history.evictions as of the last onHistoryChange
    // input
    stroke = null;
    fill = null;
    // a paint-bucket wash in progress
    queue = [];
    pencilSeen = false;
    hover = { x: 0, y: 0, inside: false, type: "mouse" };
    force = { value: 0, t: -Infinity };
    /** Host-injected tablet sample (261027-gh9e) — webviews that report no pen dynamics. */
    nativePen = null;
    nativePenAt = -Infinity;
    disposers = [];
    /* ------------------------------------------------------------------ setup */
    fitCanvas() {
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = this.canvas.getBoundingClientRect();
      const w = Math.max(2, Math.round(r.width * this.dpr)), h = Math.max(2, Math.round(r.height * this.dpr));
      this.canvas.width = w;
      this.canvas.height = h;
      this.canvasSize = [w, h];
      if (this.fitMode) this.fitZoom();
      else this.updateView();
    }
    /** The zoom that shows the whole sheet with a margin (0 margin in compositor mode). */
    fitZoom() {
      const [cw, ch] = this.canvasSize;
      const pad = 2 * this.fitPadding * this.dpr;
      const z = Math.min((cw - pad) / this.dw, (ch - pad) / this.dh) / this.dpr;
      this.zoomLevel = clamp(z, MIN_ZOOM, MAX_ZOOM);
      this.pan = [0, 0];
      this.fitMode = true;
      this.updateView();
    }
    /** Place the sheet from zoom and pan; everything that maps pointers goes through `view`. */
    updateView() {
      const [cw, ch] = this.canvasSize;
      const s = this.zoomLevel * this.dpr, w = this.dw * s, h = this.dh * s;
      const keep = PAN_KEEP * this.dpr;
      const mx = Math.max(0, (cw + w) / 2 - keep), my = Math.max(0, (ch + h) / 2 - keep);
      this.pan = [clamp(this.pan[0], -mx, mx), clamp(this.pan[1], -my, my)];
      this.view = { x: (cw - w) / 2 + this.pan[0], y: (ch - h) / 2 + this.pan[1], w, h };
      this.dirtyAll = true;
      this.updateCursor();
      this.callbacks.onViewChange?.(this.zoomLevel, [this.dw, this.dh]);
    }
    /** A sheet the shape of the window, in device pixels, within the "screen" limits. */
    get screenSize() {
      const [cw, ch] = this.canvasSize;
      const s = Math.min(1, SCREEN_DOC_LONG / Math.max(cw, ch), SCREEN_DOC_SHORT / Math.min(cw, ch));
      return clampDocSize(cw * s, ch * s, this.maxSide);
    }
    /** The longest sheet side this GPU allows. */
    get maxSide() {
      return Math.min(MAX_DOC_LONG, this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE));
    }
    /** Allocate every document-sized target for a `dw`×`dh` sheet (the old ones are the caller's to free). */
    allocateTargets() {
      const { gl, g } = this;
      const ar = this.dw / this.dh;
      const sim = ar > 1 ? { w: Math.round(SIM_BASE * ar), h: SIM_BASE } : { w: SIM_BASE, h: Math.round(SIM_BASE / ar) };
      this.velocity = g.double(sim.w, sim.h, [HALF_FLOAT_RG], gl.LINEAR);
      this.pressure = g.double(sim.w, sim.h, [HALF_FLOAT_R], gl.NEAREST);
      this.divergence = g.target(sim.w, sim.h, [HALF_FLOAT_R], gl.NEAREST);
      this.curl = g.target(sim.w, sim.h, [HALF_FLOAT_R], gl.NEAREST);
      this.ink = g.double(this.dw, this.dh, [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], gl.LINEAR);
      this.fixed = g.target(this.dw, this.dh, [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], gl.LINEAR);
      this.wet = g.double(this.dw, this.dh, [HALF_FLOAT_R], gl.LINEAR);
      this.paper = g.target(this.dw, this.dh, [RGBA8], gl.LINEAR);
      this.wetMask = g.target(Math.ceil(this.dw / MASK_BLOCK), Math.ceil(this.dh / MASK_BLOCK), [RGBA8], gl.NEAREST);
      this.maskPixels = new Uint8Array(this.wetMask.w * this.wetMask.h * 4);
    }
    allocateHistory() {
      this.history = new History(this.g, this.dw, this.dh, [
        { formats: [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA, HALF_FLOAT_R], documents: 2 },
        // mobile pigment + water
        { formats: [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], documents: 1 }
        // fixed pigment
      ]);
    }
    /** The targets that hold the sheet (not the sim grids, not the history atlases). */
    docTargets() {
      return [
        this.velocity.read,
        this.velocity.write,
        this.pressure.read,
        this.pressure.write,
        this.divergence,
        this.curl,
        this.ink.read,
        this.ink.write,
        this.fixed,
        this.wet.read,
        this.wet.write,
        this.paper,
        this.wetMask
      ];
    }
    /** (Re)create a blank `w`×`h` sheet. Discards the painting. */
    createDocument([w, h]) {
      const oldAspect = this.aspect;
      [this.dw, this.dh] = clampDocSize(w, h, this.maxSide);
      if (this.ref && Math.abs(this.aspect - oldAspect) > 1e-3) this.fitReference();
      this.g.disposeTargets();
      this.allocateTargets();
      this.allocateHistory();
      this.paperSeed = this.rng();
      this.paperScale = PAPER_UNITS / this.dh;
      this.paperOrigin = [0, 0];
      this.drawPaper(this.paper, this.paperOrigin, this.paperScale);
      this.resetPaintState();
      if (this.fitMode) this.fitZoom();
      else this.updateView();
      this.notifyHistory();
    }
    resetPaintState() {
      this.active = null;
      this.painted = null;
      this.everPainted = null;
      this.dirty = null;
      this.dirtyAll = true;
      this.lastWet = -Infinity;
      this.wetPeak = 0;
      this.fixTimer = 0;
      this.autoFix = false;
      this.flowSpeed = 0;
    }
    /**
     * Change the sheet to `w`×`h` texels, keeping the painting at its size and centred:
     * a bigger sheet adds blank paper around it, a smaller one crops it. The paper grain
     * stays registered under the paint. The change is one undo step; the steps before it
     * are forgotten (their undo tiles belong to the old sheet).
     */
    resizeDocument(w, h) {
      [w, h] = clampDocSize(w, h, this.maxSide);
      const ow = this.dw, oh = this.dh;
      if (w === ow && h === oh) return;
      this.stroke = null;
      this.restoreStrokePigment();
      this.dropFill();
      this.queue = [];
      this.autoFix = false;
      const { g } = this;
      const ox = Math.round((w - ow) / 2), oy = Math.round((h - oh) / 2);
      const meta = { ...this.currentMeta(), whole: this.captureWhole(), paperOrigin: [...this.paperOrigin] };
      const old = { targets: this.docTargets(), ink: this.ink.read, fixed: this.fixed, wet: this.wet.read };
      this.dw = w;
      this.dh = h;
      this.allocateTargets();
      this.history.beginBoundary({ kind: "resize", label: `Resize ${w} \xD7 ${h}` }, meta, w, h);
      const sx = Math.max(0, -ox), sy = Math.max(0, -oy), dx = Math.max(0, ox), dy = Math.max(0, oy);
      const cw = Math.min(ow - sx, w - dx), ch = Math.min(oh - sy, h - dy);
      const copy = (src, dsts) => {
        if (cw > 0 && ch > 0) src.views.forEach((v, i) => dsts.forEach((d) => g.blit(v, sx, sy, d.views[i], dx, dy, cw, ch)));
      };
      copy(old.ink, [this.ink.read, this.ink.write]);
      copy(old.wet, [this.wet.read, this.wet.write]);
      copy(old.fixed, [this.fixed]);
      old.targets.forEach((t) => g.disposeTarget(t));
      this.paperOrigin = [this.paperOrigin[0] - ox, this.paperOrigin[1] - oy];
      this.drawPaper(this.paper, this.paperOrigin, this.paperScale);
      const shift = (r) => {
        if (!r) return null;
        const n = { x0: Math.max(0, r.x0 + ox), y0: Math.max(0, r.y0 + oy), x1: Math.min(w, r.x1 + ox), y1: Math.min(h, r.y1 + oy) };
        return n.x1 > n.x0 && n.y1 > n.y0 ? n : null;
      };
      this.active = shift(this.active);
      this.painted = shift(this.painted);
      this.everPainted = shift(this.everPainted);
      this.dirty = null;
      const rr = this.refRect;
      this.refRect = { x: (rr.x * ow + ox) / w, y: (rr.y * oh + oy) / h, w: rr.w * ow / w, h: rr.h * oh / h };
      if (this.fitMode) this.fitZoom();
      else this.updateView();
      this.notifyHistory();
      this.callbacks.onDocumentChange?.(this.docState());
      this.schedule();
    }
    /* ------------------------------------------------- whole-document state */
    /** The paint layers, cropped to where anything was ever painted. */
    captureWhole() {
      const r = this.everPainted;
      const { g, dw, dh } = this;
      const read = (fb, ch) => r ? g.readHalf(fb, dw, dh, ch, r) : new Uint16Array(0);
      return {
        w: dw,
        h: dh,
        rect: r ? { ...r } : null,
        layers: {
          inkA: read(this.ink.read.views[0], 4),
          inkB: read(this.ink.read.views[1], 4),
          fixedA: read(this.fixed.views[0], 4),
          fixedB: read(this.fixed.views[1], 4),
          wet: read(this.wet.read.views[0], 1)
        }
      };
    }
    /** Put `whole`'s layers into the (blank) current targets; both halves of the ping-pong pairs. */
    uploadWhole(whole) {
      const r = whole.rect;
      if (!r) return;
      const { gl, g } = this;
      const w = r.x1 - r.x0, h = r.y1 - r.y0;
      const up = (tex, format3, data) => g.uploadHalf(tex, r.x0, r.y0, w, h, format3, data);
      for (const t of [this.ink.read, this.ink.write]) {
        up(t.tex[0], gl.RGBA, whole.layers.inkA);
        up(t.tex[1], gl.RGBA, whole.layers.inkB);
      }
      up(this.fixed.tex[0], gl.RGBA, whole.layers.fixedA);
      up(this.fixed.tex[1], gl.RGBA, whole.layers.fixedB);
      for (const t of [this.wet.read, this.wet.write]) up(t.tex[0], gl.RED, whole.layers.wet);
      this.everPainted = { ...r };
    }
    /** Replace the sheet with `whole` (another size, usually), keeping the history atlases. */
    applyWhole(whole, paperOrigin) {
      const old = this.docTargets();
      this.dw = whole.w;
      this.dh = whole.h;
      this.allocateTargets();
      old.forEach((t) => this.g.disposeTarget(t));
      this.history.resize(this.dw, this.dh);
      this.paperOrigin = [...paperOrigin];
      this.drawPaper(this.paper, this.paperOrigin, this.paperScale);
      this.everPainted = null;
      this.uploadWhole(whole);
      this.dirty = null;
      this.dirtyAll = true;
      if (this.fitMode) this.fitZoom();
      else this.updateView();
    }
    docState() {
      return {
        paperId: this.paperPreset.id,
        paperStrength: this.paperStrength,
        reference: { image: this.ref?.src ?? null, rect: { ...this.refRect }, opacity: this.refOpacity, visible: this.refVisible }
      };
    }
    /** Paper and reference state as undo tracks it. */
    get documentState() {
      return this.docState();
    }
    /** Bring paper / reference state back (after undo, redo or a project opened). */
    applyDocState(d) {
      const preset = PAPERS.find((p) => p.id === d.paperId);
      if (preset && preset !== this.paperPreset) {
        this.paperPreset = preset;
        this.drawPaper(this.paper, this.paperOrigin, this.paperScale);
      }
      this.paperStrength = clamp(d.paperStrength, 0, 1);
      const r = d.reference;
      if (r.image !== (this.ref?.src ?? null)) this.uploadReference(r.image);
      this.refRect = { ...r.rect };
      this.refOpacity = r.opacity;
      this.refVisible = r.visible;
      this.dirtyAll = true;
    }
    /**
     * Record a document-level change that has already been applied (paper, reference) as
     * one undo step; `before` is the state to come back to.
     */
    recordChange(kind, label, before) {
      this.dropFill();
      this.autoFix = false;
      this.history.begin({ kind, label }, { ...this.currentMeta(), doc: before });
      this.notifyHistory();
    }
    /** The painting as it is now, ready to be saved. */
    snapshot() {
      const m = this.currentMeta();
      return {
        whole: this.captureWhole(),
        paper: { id: this.paperPreset.id, seed: this.paperSeed, origin: [...this.paperOrigin], scale: this.paperScale, strength: this.paperStrength },
        wet: { wetAgo: m.wetAgo, wetPeak: m.wetPeak, active: m.active, painted: m.painted },
        reference: m.doc.reference,
        view: { zoom: this.zoomLevel, pan: [...this.pan], fitted: this.fitMode }
      };
    }
    /** Replace the painting with a saved one. History starts afresh. */
    restore(s) {
      const [w, h] = clampDocSize(s.whole.w, s.whole.h, this.maxSide);
      if (w !== s.whole.w || h !== s.whole.h) throw new Error(`This sheet (${s.whole.w} \xD7 ${s.whole.h}) is too large for this GPU.`);
      this.stroke = null;
      this.restoreStrokePigment();
      this.dropFill();
      this.queue = [];
      if (this.ref) {
        this.gl.deleteTexture(this.ref.tex);
        this.ref = null;
      }
      this.g.disposeTargets();
      this.dw = w;
      this.dh = h;
      this.allocateTargets();
      this.allocateHistory();
      this.resetPaintState();
      this.paperPreset = PAPERS.find((p) => p.id === s.paper.id) ?? DEFAULT_PAPER;
      this.paperSeed = s.paper.seed;
      this.paperScale = s.paper.scale || PAPER_UNITS / this.dh;
      this.paperOrigin = [...s.paper.origin];
      this.paperStrength = clamp(s.paper.strength, 0, 1);
      this.drawPaper(this.paper, this.paperOrigin, this.paperScale);
      this.uploadWhole(s.whole);
      const now = this.clock();
      this.lastWet = Number.isFinite(s.wet.wetAgo) ? now - s.wet.wetAgo : -Infinity;
      this.wetPeak = s.wet.wetPeak;
      this.active = s.wet.active ? { ...s.wet.active } : null;
      this.painted = s.wet.painted ? { ...s.wet.painted } : null;
      if (this.active) this.minAwakeUntil = now + 250;
      this.uploadReference(s.reference.image);
      this.refRect = { ...s.reference.rect };
      this.refOpacity = clamp(s.reference.opacity, 0, 1);
      this.refVisible = s.reference.visible;
      this.zoomLevel = clamp(s.view.zoom, MIN_ZOOM, MAX_ZOOM);
      this.pan = [...s.view.pan];
      this.fitMode = s.view.fitted;
      if (this.fitMode) this.fitZoom();
      else this.updateView();
      this.notifyHistory();
      this.callbacks.onDocumentChange?.(this.docState());
      this.schedule();
    }
    /* ---------------------------------------------------------------- view */
    /** Current zoom: 1 shows one document texel per CSS pixel. */
    get zoom() {
      return this.zoomLevel;
    }
    /** True while the sheet is fitted to the window (it stays fitted as the window changes). */
    get fitted() {
      return this.fitMode;
    }
    /** While navigating (e.g. Space held) pointers on the paper pan instead of paint. */
    get navigating() {
      return this.nav;
    }
    set navigating(v) {
      this.nav = v;
      this.updateCursor();
    }
    /** Zoom by `factor` keeping the document point under (clientX, clientY) in place. */
    zoomAt(clientX, clientY, factor) {
      const r = this.canvas.getBoundingClientRect();
      const [cw, ch] = this.canvasSize;
      const z = clamp(this.zoomLevel * factor, MIN_ZOOM, MAX_ZOOM);
      const k = z / this.zoomLevel;
      if (k === 1) return;
      const px = (clientX - r.left) * this.dpr, py = ch - (clientY - r.top) * this.dpr;
      const cx = cw / 2 + this.pan[0], cy = ch / 2 + this.pan[1];
      this.pan = [px - (px - cx) * k - cw / 2, py - (py - cy) * k - ch / 2];
      this.zoomLevel = z;
      this.fitMode = false;
      this.updateView();
      this.schedule();
    }
    /** Zoom to `z` about the middle of the window. */
    zoomTo(z) {
      const r = this.canvas.getBoundingClientRect();
      this.zoomAt(r.left + r.width / 2, r.top + r.height / 2, z / this.zoomLevel);
    }
    /** Show the whole sheet. */
    zoomToFit() {
      this.fitZoom();
      this.schedule();
    }
    /**
     * True while a stroke, fix, or wet diffusion still needs frames. Goes false
     * when the sheet settles — the point where the dry (concentrated) look is
     * what the user sees, and the right moment to capture it.
     */
    get isAwake() {
      const now = this.clock();
      return this.active !== null && (this.stroke !== null || this.fixTimer > 0 || now < this.minAwakeUntil || now < this.wetUntil());
    }
    /**
     * True while the sheet holds standing water the Water tool can act on — the
     * live UI gate's source of truth. False during the Dry fix bake even though
     * `isAwake` is still true.
     */
    get hasStandingWater() {
      return isSheetWet({
        wetPeak: this.wetPeak,
        wetUntilMs: this.wetUntil(),
        nowMs: this.clock(),
        fixing: this.fixTimer > 0
      });
    }
    /** True when the sheet holds paint (since the last clear) — never capture blank. */
    get hasPaint() {
      return this.everPainted !== null;
    }
    /**
     * Compositor-layer mode (Studio integration): the sheet maps 1:1 onto the
     * canvas box (no fit margin — pointer UV is the plain rect fraction) and the
     * display is pigment-on-transparent. The document fond is owned by the
     * compositor, never this surface (v1.0 compositor law).
     */
    setCompositorLayer(on) {
      if (this.compositorLayer === on) return;
      this.compositorLayer = on;
      this.fitPadding = on ? 0 : FIT_PADDING;
      if (this.fitMode) this.fitZoom();
      else this.updateView();
      this.redraw();
    }
    /** Move the sheet by (dx, dy) CSS pixels. */
    panBy(dx, dy) {
      if (!dx && !dy) return;
      this.pan = [this.pan[0] + dx * this.dpr, this.pan[1] - dy * this.dpr];
      this.fitMode = false;
      this.updateView();
      this.schedule();
    }
    /* ------------------------------------------------------------- public API */
    setParams(p) {
      Object.assign(this.params, p);
    }
    /** Document width / height. Document uv has y up; x spans `aspect` heights. */
    get aspect() {
      return this.dw / this.dh;
    }
    /** Client (CSS px) -> document uv. */
    clientToDoc(clientX, clientY) {
      return this.toUv({ clientX, clientY });
    }
    /** Document uv -> client (CSS px). */
    docToClient(x, y) {
      const r = this.canvas.getBoundingClientRect();
      return [r.left + (this.view.x + x * this.view.w) / this.dpr, r.top + (this.canvasSize[1] - this.view.y - y * this.view.h) / this.dpr];
    }
    /** Document size in texels. */
    get docSize() {
      return [this.dw, this.dh];
    }
    /* ------------------------------------------------- paint-bucket fills (fill) */
    /** Is a bucket fill in progress? */
    get filling() {
      return this.fill !== null;
    }
    /** How far (px) past the farthest field distance a fill must run so its roughened front covers everything. */
    get fillMargin() {
      return FILL_WIDTH + FILL_JITTER + 1;
    }
    /**
     * The document as a flat image: pigment on plain paper with no relief, grain, edge
     * darkening or wet tint, so areas of one colour read as one colour. RGBA8, row 0 is
     * document y = 0 (uv is y-up, so no flip is needed to index it by texel).
     */
    readFlat() {
      return this.readback(true);
    }
    /**
     * Start a bucket fill: `field` is RG per document texel (distance from the tap in
     * px, -1 outside the area; distance to the area's edge), `bbox` the half-open texel
     * rect around it. Opens one undo step for the whole wash. False while a stroke is
     * still on the paper.
     */
    fillBegin(field, bbox, label = "Fill") {
      if (this.stroke) return false;
      if (field.length !== this.dw * this.dh * 2) throw new Error("fill field does not match the document");
      this.beginStep("fill", label);
      const tex = this.g.texture(this.dw, this.dh, FLOAT_RG, field, this.gl.NEAREST);
      this.fill = { tex, bbox: { ...bbox } };
      return true;
    }
    /**
     * Deposit the band `from < distance <= to` of the current fill: pigment (if `paint`)
     * and water, feathered over `soft` px at the area's edge. False once the fill is
     * gone (undo, clear, another action), in which case the caller should stop.
     */
    fillStep(from, to, o) {
      const f = this.fill;
      if (!f) return false;
      const { gl, g } = this;
      const P = this.params;
      this.touch(f.bbox);
      const p = this.programs.fill;
      p.bind();
      gl.uniform1i(p.u.uField, g.bindTex(0, f.tex));
      gl.uniform1i(p.u.uPaper, g.bindTex(1, this.paper.tex[0]));
      gl.uniform1f(p.u.uSoft, Math.max(0, o.soft));
      gl.uniform1f(p.u.uGrainThr, 0.5);
      gl.uniform1f(p.u.uJitter, FILL_JITTER);
      gl.uniform1f(p.u.uWidth, FILL_WIDTH);
      gl.enable(gl.BLEND);
      if (o.paint) {
        const conc = 0.15 * Math.exp(P.load * 2.8) * 0.84;
        const amount = conc * o.strength;
        const c = this.pigment.coeffs;
        gl.uniform1i(p.u.uCumulative, 0);
        gl.uniform1f(p.u.uFrom, from);
        gl.uniform1f(p.u.uTo, to);
        gl.uniform1f(p.u.uGrain, 0.12);
        gl.uniform4f(p.u.uColor0, c[0] * amount, c[1] * amount, c[2] * amount, c[3] * amount);
        gl.uniform4f(p.u.uColor1, c[4] * amount, c[5] * amount, c[6] * amount, this.pigment.white * amount * 1.6);
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.ONE, gl.ONE);
        g.draw(this.ink.read, f.bbox);
      }
      const wetAmt = (0.25 + 0.75 * o.water) * 0.9;
      gl.uniform1i(p.u.uCumulative, 1);
      gl.uniform1f(p.u.uTo, to + FILL_WATER_LEAD);
      gl.uniform1f(p.u.uGrain, 0);
      gl.uniform4f(p.u.uColor0, wetAmt, 0, 0, 0);
      gl.uniform4f(p.u.uColor1, 0, 0, 0, 0);
      gl.blendEquation(gl.MAX);
      g.draw(this.wet.read, f.bbox);
      gl.blendEquation(gl.FUNC_ADD);
      gl.disable(gl.BLEND);
      this.wetPeak = Math.max(this.wetPeak * this.wetDecay(), wetAmt);
      this.lastWet = this.clock();
      this.schedule();
      return true;
    }
    /** Finish (or stop) the current fill; what has been laid down stays. */
    fillEnd() {
      this.dropFill();
    }
    dropFill() {
      if (!this.fill) return;
      this.gl.deleteTexture(this.fill.tex);
      this.fill = null;
    }
    /* -------------------------------------------------- scripted strokes (text) */
    /** Is a code-driven stroke in progress? */
    get scripting() {
      return this.stroke?.pointerId === SCRIPT_POINTER;
    }
    /**
     * Start a stroke driven by code rather than a pointer; it runs through the same
     * pipeline (spacing, speed thinning, dwell, undo). Returns false while another
     * stroke is still on the paper. A string `step` opens an undo step with that label;
     * pass false to group several strokes (the letters of a word) into one. `maxRadius`
     * (document heights) shrinks a footprint that would be wider than that at full
     * pressure, so a big brush still writes small letters legibly.
     *
     * Studio integration: `pressure` keeps the live sentinel — a negative value
     * means "no pen pressure available" (mouse / trackpad), so the stroke derives
     * it from speed exactly like the pointer path. Clamping it to the floor made
     * replayed mouse strokes land at minimum pressure (pale, thin, under-wet).
     * `tiltX`/`tiltY` carry the recorded pen tilt so asymmetric tips keep their
     * azimuth on replay.
     *
     * `widthScale` (61-04) is the per-sample width factor of the vector profile
     * — a footprint multiplier carried on the sample, bounded to the published
     * 0.2..20 range. It is NOT `maxRadius` and is never routed through
     * `scriptScale`: that clamp stays the footprint cap it always was (C-03).
     *
     * `pigment` (261111-wd6) is the per-vertex colour of this sample. Absent
     * keeps the pigment `configure()` installed — today's exact deposit. When
     * present it rides the queued sample and is swapped in only around that
     * sample's stamps, then the base pigment is restored (no leak).
     */
    scriptBegin(tool, x, y, pressure, step = "Stroke", maxRadius, tiltX = 0, tiltY = 0, widthScale = 1, pigment) {
      if (this.stroke) return false;
      if (step !== false) this.beginStep("script", step);
      this.scriptScale = maxRadius ? Math.min(1, maxRadius / this.radius(tool, 1, 0)) : 1;
      this.strokeBasePigment = this.pigment;
      this.stroke = {
        pointerId: SCRIPT_POINTER,
        pointerType: "pen",
        tool,
        started: false,
        ending: false,
        x: 0,
        y: 0,
        cx: 0,
        cy: 0,
        pr: 0,
        t: this.clock(),
        speed: 0,
        simPressure: 0.45,
        carry: 0,
        travelled: 0,
        moved: false,
        dx: this.lastDir[0],
        dy: this.lastDir[1],
        angle: this.lastAngle,
        azimuth: null,
        widthFrom: 1,
        widthTo: 1,
        pigFrom: null,
        pigTo: null
      };
      this.queue.push({ x, y, p: scriptPressure(pressure), t: this.clock(), tx: tiltX, ty: tiltY, w: scriptWidthFactor(widthScale), pig: pigment });
      this.schedule();
      return true;
    }
    /** Feed the scripted stroke a sample; `t` is a performance.now() timestamp. False once the stroke is gone (undo, clear). */
    scriptMove(x, y, pressure, t, tiltX = 0, tiltY = 0, widthScale = 1, pigment) {
      if (!this.scripting) return false;
      this.queue.push({ x, y, p: scriptPressure(pressure), t, tx: tiltX, ty: tiltY, w: scriptWidthFactor(widthScale), pig: pigment });
      this.schedule();
      return true;
    }
    scriptEnd() {
      if (!this.scripting) return;
      this.stroke.ending = true;
      this.schedule();
    }
    setPigment(p) {
      this.pigment = p;
    }
    /**
     * 261111-wd6: put the stroke's base pigment back when a scripted stroke
     * leaves the paper by any path (end, undo, clear, resize, restore, abort).
     * No-op once restored or for a live stroke.
     */
    restoreStrokePigment() {
      if (this.strokeBasePigment !== null) {
        this.pigment = this.strokeBasePigment;
        this.strokeBasePigment = null;
      }
    }
    /** Deterministic bake: install a seeded RNG (A2). */
    setRandom(fn3) {
      this.rng = fn3;
    }
    /** Deterministic bake: install a virtual clock in ms (A2). */
    setClock(fn3) {
      this.clock = fn3;
    }
    /** Deterministic bake: stop the rAF loop; the host drives tick(dt). */
    setManual(on) {
      this.manual = on;
      if (on) {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
      } else {
        this.schedule();
      }
    }
    /**
     * One deterministic simulation step (seconds). Runs the same body as the
     * rAF frame with a caller-supplied dt — the bake tick law.
     */
    tick(dt) {
      this.brushNow.r = 0;
      this.processInput(dt);
      const now = this.clock();
      const awake = this.active !== null && (this.stroke !== null || this.fixTimer > 0 || now < this.minAwakeUntil || now < this.wetUntil());
      if (awake) {
        this.flowSpeed *= Math.exp(-dt * (3 - this.params.flow * 2.4));
        this.growCarry += 0.4 + Math.min(3, 0.15 * this.flowSpeed * dt * (this.dw / this.velocity.w));
        const grow = Math.floor(this.growCarry);
        if (grow > 0) {
          this.growCarry -= grow;
          const a = this.active;
          this.touch({ x0: Math.max(0, a.x0 - grow), y0: Math.max(0, a.y0 - grow), x1: Math.min(this.dw, a.x1 + grow), y1: Math.min(this.dh, a.y1 + grow) }, false, false);
        }
        this.step(dt);
        if (this.fixTimer <= 0 && ++this.maskCounter >= MASK_EVERY) {
          this.maskCounter = 0;
          this.trimActive();
        }
      }
      this.render();
      if (!awake && this.active) this.sleep();
    }
    /** The composited document as an RGBA8 canvas (bottom row first flipped to top). */
    exportCanvas(background = "transparent", texture = true) {
      const { dw, dh } = this;
      const px = this.readback(false, MODE[background], texture);
      for (let i = 0; i < px.length; i += 4) {
        const a = px[i + 3];
        if (a > 0 && a < 255) {
          px[i] = Math.min(255, Math.round(px[i] * 255 / a));
          px[i + 1] = Math.min(255, Math.round(px[i + 1] * 255 / a));
          px[i + 2] = Math.min(255, Math.round(px[i + 2] * 255 / a));
        }
      }
      const c = document.createElement("canvas");
      c.width = dw;
      c.height = dh;
      const ctx = c.getContext("2d");
      const img = ctx.createImageData(dw, dh);
      const row = dw * 4;
      for (let y = 0; y < dh; y++) img.data.set(px.subarray((dh - 1 - y) * row, (dh - y) * row), y * row);
      ctx.putImageData(img, 0, 0);
      return c;
    }
    /* ------------------------------------------------------------------ paper */
    get paperId() {
      return this.paperPreset.id;
    }
    /** How strongly the sheet's relief, fibres and flecks show (0: a flat tint, 1: full), on screen and in textured exports. */
    get paperTexture() {
      return this.paperStrength;
    }
    set paperTexture(v) {
      v = clamp(v, 0, 1);
      if (v === this.paperStrength) return;
      this.paperStrength = v;
      this.redraw();
    }
    /**
     * Swap the sheet under the painting. Only the paper changes: the paint stays, and
     * granulation and dry brush follow the new tooth from here on.
     */
    setPaper(p) {
      if (p === this.paperPreset) return;
      this.paperPreset = p;
      this.drawPaper(this.paper, this.paperOrigin, this.paperScale);
      this.redraw();
    }
    /**
     * A preview of a paper at the scale it appears on screen: `w`×`h` device pixels of
     * the sheet with a granulating wash across one corner, as an sRGB canvas.
     */
    paperSwatch(p, w, h) {
      const { gl, g } = this;
      const paper = g.target(w, h, [RGBA8], gl.LINEAR);
      const out = g.target(w, h, [RGBA8], gl.NEAREST);
      this.drawPaper(paper, [w * 0.7, h * 1.3], this.paperScale * (this.dh / this.view.h), p);
      const s = this.programs.paperSwatch;
      s.bind();
      gl.uniform1i(s.u.uPaper, g.bindTex(0, paper.tex[0]));
      this.paperUniforms(s, p, 1);
      g.draw(out);
      const px = new Uint8Array(w * h * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, out.fbo);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      g.disposeTarget(paper);
      g.disposeTarget(out);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      const img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
      ctx.putImageData(img, 0, 0);
      return c;
    }
    /**
     * The sheet alone at `width`×`height` — the fond / thumb source. Same
     * allocation + readPixels tail as `paperSwatch`, but `paperSheetFS`
     * (no ultramarine wash) and the sheet origin + sheet scale law.
     */
    paperSheet(preset, width, height, scale = PAPER_UNITS / height) {
      if (!(width > 0) || !Number.isFinite(width) || !(height > 0) || !Number.isFinite(height)) {
        throw new RangeError(`paperSheet: width and height must be positive and finite (got ${width}\xD7${height})`);
      }
      if (!(scale > 0) || !Number.isFinite(scale)) {
        throw new RangeError(`paperSheet: scale must be positive and finite (got ${scale})`);
      }
      const w = Math.round(width), h = Math.round(height);
      const { gl, g } = this;
      const paper = g.target(w, h, [RGBA8], gl.LINEAR);
      const out = g.target(w, h, [RGBA8], gl.NEAREST);
      this.drawPaper(paper, [0, 0], scale, preset);
      const s = this.programs.paperSheet;
      s.bind();
      gl.uniform1i(s.u.uPaper, g.bindTex(0, paper.tex[0]));
      this.paperUniforms(s, preset, 1);
      g.draw(out);
      const px = new Uint8Array(w * h * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, out.fbo);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      g.disposeTarget(paper);
      g.disposeTarget(out);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      const img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
      ctx.putImageData(img, 0, 0);
      return c;
    }
    /**
     * The height channel of the packed paper texel (paperLightFS: lit, height,
     * mottle, fleck) as `width * height` floats in 0..1 — the bake tooth's field.
     */
    paperHeight(preset, width, height, scale = PAPER_UNITS / height) {
      if (!(width > 0) || !Number.isFinite(width) || !(height > 0) || !Number.isFinite(height)) {
        throw new RangeError(`paperHeight: width and height must be positive and finite (got ${width}\xD7${height})`);
      }
      if (!(scale > 0) || !Number.isFinite(scale)) {
        throw new RangeError(`paperHeight: scale must be positive and finite (got ${scale})`);
      }
      const w = Math.round(width), h = Math.round(height);
      const { gl, g } = this;
      const paper = g.target(w, h, [RGBA8], gl.LINEAR);
      this.drawPaper(paper, [0, 0], scale, preset);
      const px = new Uint8Array(w * h * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, paper.fbo);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      g.disposeTarget(paper);
      const out = new Float32Array(w * h);
      for (let y = 0; y < h; y++) {
        const src = (h - 1 - y) * w * 4;
        for (let x = 0; x < w; x++) out[y * w + x] = px[src + x * 4 + 1] / 255;
      }
      return out;
    }
    /** Generate a paper into `t`: `offset` places it on the sheet (texels), `scale` is paper units per texel. */
    drawPaper(t, offset, scale, preset = this.paperPreset) {
      const { gl, g } = this;
      const field = g.target(t.w, t.h, [HALF_FLOAT_RGBA], gl.NEAREST);
      const f = this.programs.paperField;
      f.bind();
      gl.uniform2f(f.u.uRes, t.w, t.h);
      gl.uniform2f(f.u.uOffset, offset[0], offset[1]);
      gl.uniform1f(f.u.uScale, scale);
      gl.uniform1f(f.u.uSeed, this.paperSeed);
      gl.uniform1i(f.u.uKind, preset.kind);
      g.draw(field);
      const l = this.programs.paperLight;
      l.bind();
      gl.uniform1i(l.u.uField, g.bindTex(0, field.tex[0]));
      gl.uniform2f(l.u.uTexel, 1 / t.w, 1 / t.h);
      gl.uniform1f(l.u.uBump, preset.bump * 1.4 / scale);
      g.draw(t);
      g.disposeTarget(field);
    }
    paperUniforms(p, preset, texture) {
      const { gl } = this;
      gl.uniform3fv(p.u.uPaperTint, linearRGB(preset.tint));
      gl.uniform3fv(p.u.uFleckTint, linearRGB(preset.fleck));
      gl.uniform1f(p.u.uMottle, preset.mottle);
      gl.uniform1f(p.u.uTexture, texture);
    }
    setTool(t) {
      this.tool = t;
      this.updateCursor();
    }
    setBrush(b) {
      this.brush = b;
      this.lastAngle = b.rotation === "fixed" ? b.angle * DEG2 : b.rotation === "follow" ? Math.atan2(this.lastDir[1], this.lastDir[0]) + b.angle * DEG2 : 0;
      this.updateCursor();
    }
    /**
     * quick-261115-oh9: the silhouette a LIFT stroke erases with. The eraser has
     * no texture, but a pen's eraser end lifts while the Brush tool (and its
     * textured brush) is selected — without this the live erase would wear the
     * brush's texture while the committed punch erases the response's own tip.
     * The host sets the untextured counterpart of the selected response; null
     * falls back to the bound brush (an untextured selection needs no override).
     */
    setLiftBrush(b) {
      this.liftBrush = b;
    }
    /**
     * 261027-gh9e: inject native tablet input for hosts where the webview's
     * PointerEvent carries no pen dynamics (macOS tablets often arrive as
     * pointerType 'mouse' / pressure 0). Mirrors the engine-1 host bridge:
     * the sample is used for a 300 ms window while the pointer reports none.
     */
    updateNativePenInput(input) {
      const pressure = Math.min(1, Math.max(0, Number(input.pressure)));
      if (!Number.isFinite(pressure)) return;
      this.nativePen = { pressure, tiltX: input.tiltX ?? 0, tiltY: input.tiltY ?? 0 };
      this.nativePenAt = this.clock();
    }
    /* ------------------------------------------------------- reference image */
    get hasReference() {
      return this.ref !== null;
    }
    /** Width / height of the reference image, or 0 without one. */
    get referenceAspect() {
      return this.ref?.aspect ?? 0;
    }
    /**
     * Show `img` under the paint (or remove it with null), fitted to the paper, as one
     * undo step. It survives clearing the paper and is never part of an export.
     */
    setReference(img) {
      const before = this.docState();
      let src = null;
      if (img) {
        const max2 = Math.min(MAX_REF_SIDE, this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE));
        const s = Math.min(1, max2 / Math.max(img.width, img.height));
        src = document.createElement("canvas");
        src.width = Math.max(1, Math.round(img.width * s));
        src.height = Math.max(1, Math.round(img.height * s));
        src.getContext("2d").drawImage(img, 0, 0, src.width, src.height);
      }
      this.uploadReference(src);
      if (src) this.fitReference();
      this.recordChange("reference", src ? "Reference added" : "Reference removed", before);
      this.redraw();
    }
    /** The reference image as the engine keeps it (downscaled), or null. */
    referenceImage() {
      return this.ref?.src ?? null;
    }
    /** Put `src` on the GPU as the reference (or drop it with null); placement is left alone. */
    uploadReference(src) {
      const { gl } = this;
      if (this.ref?.src === src) return;
      if (this.ref) {
        gl.deleteTexture(this.ref.tex);
        this.ref = null;
      }
      if (!src) return;
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.ref = { tex, aspect: src.width / src.height, src };
    }
    /** The reference placed as large as fits, centred on the paper. */
    fitReference() {
      if (!this.ref) return;
      const k = this.ref.aspect / this.aspect;
      const w = k > 1 ? 1 : k, h = k > 1 ? 1 / k : 1;
      this.referenceRect = { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
    }
    /**
     * The reference as placed on the paper, at document resolution, over plain white
     * (where it does not cover the paper, and through any transparency). Same layout as
     * readFlat: RGBA8, opaque, row 0 is document y = 0. Null without a reference.
     */
    readReferenceFlat() {
      if (!this.ref) return null;
      const { dw, dh } = this, r = this.refRect;
      const c = document.createElement("canvas");
      c.width = dw;
      c.height = dh;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, dw, dh);
      ctx.drawImage(this.ref.src, r.x * dw, (1 - r.y - r.h) * dh, r.w * dw, r.h * dh);
      const top = ctx.getImageData(0, 0, dw, dh).data;
      const out = new Uint8Array(dw * dh * 4), row = dw * 4;
      for (let y = 0; y < dh; y++) out.set(top.subarray((dh - 1 - y) * row, (dh - y) * row), y * row);
      for (let i = 3; i < out.length; i += 4) out[i] = 255;
      return out;
    }
    get referenceRect() {
      return { ...this.refRect };
    }
    set referenceRect(r) {
      const c = this.refRect;
      if (r.x === c.x && r.y === c.y && r.w === c.w && r.h === c.h) return;
      this.refRect = { ...r };
      this.redraw();
    }
    get referenceOpacity() {
      return this.refOpacity;
    }
    set referenceOpacity(v) {
      v = clamp(v, 0, 1);
      if (v === this.refOpacity) return;
      this.refOpacity = v;
      this.redraw();
    }
    /** Does the Fill tool find its areas on the reference (traced) rather than on the paint? */
    referenceForFill = false;
    get referenceVisible() {
      return this.refVisible;
    }
    set referenceVisible(v) {
      if (v !== this.refVisible) {
        this.refVisible = v;
        this.redraw();
      }
    }
    redraw() {
      this.dirtyAll = true;
      this.schedule();
    }
    /**
     * Drop every GPU copy of a response's tips — one per texture it can be
     * stamped through (quick-261115-oh9: the cache key is the response id AND the
     * texture, so a response may own several uploaded tips).
     */
    forgetBrush(id) {
      const prefix = `${id}|`;
      for (const [key, t] of this.tipTextures) {
        if (key !== id && !key.startsWith(prefix)) continue;
        this.gl.deleteTexture(t);
        this.tipTextures.delete(key);
      }
    }
    /**
     * Drop every uploaded tip (quick-261115-oh9 / WR-02). The mask registry can
     * replace the BYTES under an unchanged id (`registerMask` overwrites,
     * `replaceMaskRegistry` re-seeds on a project open), and this cache keys on
     * the ids alone — so a host that observes a registry change must sweep, or
     * the GPU would keep stamping the pre-change mask while every other cache
     * (chip, footprint) has already repainted.
     */
    clearTipTextures() {
      for (const t of this.tipTextures.values()) this.gl.deleteTexture(t);
      this.tipTextures.clear();
    }
    tipTexture(b) {
      const key = brushTipCacheKey(b);
      let t = this.tipTextures.get(key);
      if (t) return t;
      const { gl } = this;
      t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      const tipSource = b.textureId != null ? tipRowsForUpload(b.tipData, b.tipSize) : b.tipData;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, b.tipSize, b.tipSize, 0, gl.RED, gl.UNSIGNED_BYTE, tipSource);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.tipTextures.set(key, t);
      return t;
    }
    /**
     * Dry everything and bake the mobile pigment into the paper. `auto` marks the
     * Studio settle-cap fix: a later stroke may reopen it with cancelAutoFix() so
     * wet-on-wet painting still blends. An explicit Dry disarms that reopen even
     * when it cannot start (a fix is already running).
     */
    fix(auto = false) {
      if (!auto) this.autoFix = false;
      if (!this.painted || this.fixTimer > 0) return false;
      this.beginStep("dry", "Dry");
      this.history.protect(1, this.painted, this.fixed.views);
      this.fixTimer = FIX_DURATION;
      this.autoFix = auto;
      this.touch(this.painted);
      this.schedule();
      return true;
    }
    /**
     * Reopen a settle-cap fix (Studio): the artist painted again, so the sheet
     * goes back to its wet, blendable state instead of painting over dry paper.
     * No-op unless the last step is an auto fix — an explicit Dry stays permanent.
     */
    cancelAutoFix() {
      if (!this.autoFix) return false;
      this.autoFix = false;
      if (!this.history.canUndo) return false;
      this.travel("undo");
      return true;
    }
    /** Wipe the paint as one undo step. The sheet (and its grain) stays. */
    clear() {
      this.stroke = null;
      this.restoreStrokePigment();
      this.queue = [];
      if (!this.everPainted && !this.fill) return;
      this.beginStep("clear", "Clear");
      if (this.everPainted) {
        this.history.protect(0, this.everPainted, this.snapshotLayers());
        this.history.protect(1, this.everPainted, this.fixed.views);
      }
      for (const t of this.docTargets()) if (t !== this.paper) this.g.clearTarget(t);
      this.resetPaintState();
      this.notifyHistory();
      this.schedule();
    }
    /**
     * 261030-v1t: wipe pigment and water while KEEPING the sheet — the replay
     * seam a per-output-frame re-pattern bake needs (the aquarelle sheet is
     * cumulative, so each salted replay must start from the same naked paper).
     *
     * Unlike clear() this is not an undo step: bakes never travel history. It
     * must never re-roll `paperSeed`, redraw the paper or recreate targets — the
     * sheet and its seeded grain are the constant across replays. The caller
     * re-arms the virtual clock and the RNG stream.
     */
    resetSheet() {
      this.stroke = null;
      this.restoreStrokePigment();
      this.queue = [];
      this.dropFill();
      for (const t of this.docTargets()) if (t !== this.paper) this.g.clearTarget(t);
      this.resetPaintState();
      this.notifyHistory();
    }
    /** Take back the stroke in progress as if it never happened (a touch that became a pinch). */
    abortStroke() {
      const s = this.stroke;
      if (!s) return;
      this.stroke = null;
      this.restoreStrokePigment();
      this.queue = [];
      if (s.pointerId !== SCRIPT_POINTER) this.callbacks.onStrokeTool?.(null);
      if (this.history.canUndo) {
        this.travel("undo");
        this.history.discardRedo();
        this.notifyHistory();
      }
    }
    undo() {
      if (this.history.canUndo) this.travel("undo");
    }
    redo() {
      if (this.history.canRedo) this.travel("redo");
    }
    /** Undo or redo until `index` steps are applied. */
    jumpTo(index) {
      const { index: now, list } = this.history.entries();
      index = clamp(Math.round(index), 0, list.length);
      for (let i = now; i > index && this.history.canUndo; i--) this.travel("undo", false);
      for (let i = now; i < index && this.history.canRedo; i++) this.travel("redo", false);
      this.notifyHistory();
    }
    get canUndo() {
      return this.history.canUndo;
    }
    get canRedo() {
      return this.history.canRedo;
    }
    /** Step through history in either direction. */
    travel(dir, notify = true) {
      this.autoFix = false;
      this.stroke = null;
      this.restoreStrokePigment();
      this.dropFill();
      this.queue = [];
      this.fixTimer = 0;
      const next = dir === "undo" ? this.history.peekUndo() : this.history.peekRedo();
      const metaNow = this.currentMeta();
      if (next?.boundary) {
        metaNow.whole = this.captureWhole();
        metaNow.paperOrigin = [...this.paperOrigin];
      }
      this.sleep();
      const ink = this.ink, wet = this.wet;
      const layers = [
        [[ink.read.views[0], ink.write.views[0]], [ink.read.views[1], ink.write.views[1]], [wet.read.views[0], wet.write.views[0]]],
        [[this.fixed.views[0]], [this.fixed.views[1]]]
      ];
      const res = dir === "undo" ? this.history.undo(layers, metaNow) : this.history.redo(layers, metaNow);
      if (!res) return;
      const meta = res.meta;
      const now = this.clock();
      if (meta.whole) {
        this.applyWhole(meta.whole, meta.paperOrigin ?? [0, 0]);
        this.painted = meta.painted ? { ...meta.painted } : null;
      }
      if (res.info.kind !== "paper" && res.info.kind !== "reference") {
        this.lastWet = now - meta.wetAgo;
        this.wetPeak = meta.wetPeak;
        this.active = meta.active ? { ...meta.active } : null;
      }
      if (res.rect) {
        this.dirty = union(this.dirty, res.rect);
        this.painted = union(this.painted, res.rect);
        this.everPainted = union(this.everPainted, res.rect);
      }
      this.applyDocState(meta.doc);
      this.callbacks.onDocumentChange?.(this.docState());
      if (notify) this.notifyHistory();
      this.schedule();
    }
    notifyHistory() {
      this.seenEvictions = this.history.evictions;
      const { list, index } = this.history.entries();
      this.callbacks.onHistoryChange?.(list, index);
    }
    currentMeta() {
      return {
        wetAgo: this.clock() - this.lastWet,
        wetPeak: this.wetPeak,
        active: this.active ? { ...this.active } : null,
        painted: this.painted ? { ...this.painted } : null,
        doc: this.docState()
      };
    }
    /**
     * Render the document at full resolution as an image file. The reference image is
     * never included. JPEG has no alpha, so a transparent JPEG is put on white.
     */
    async exportImage(o) {
      const { dw, dh } = this;
      const bg = o.format === "jpeg" && o.background === "transparent" ? "white" : o.background;
      const px = this.readback(false, MODE[bg], o.texture ?? true);
      const c = document.createElement("canvas");
      c.width = dw;
      c.height = dh;
      const ctx = c.getContext("2d");
      const img = ctx.createImageData(dw, dh);
      const row = dw * 4;
      for (let y = 0; y < dh; y++) img.data.set(px.subarray((dh - 1 - y) * row, (dh - y) * row), y * row);
      ctx.putImageData(img, 0, 0);
      const type = `image/${o.format}`;
      return new Promise((resolve, reject) => c.toBlob((b) => {
        if (!b) reject(new Error("export failed"));
        else if (b.type !== type) reject(new Error(`This browser cannot save ${o.format.toUpperCase()}`));
        else resolve(b);
      }, type, o.quality));
    }
    /** The composited document at full resolution as RGBA8 bytes, bottom row first. */
    readback(flat, mode = MODE.paper, texture = true) {
      const { gl, g, dw, dh } = this;
      const out = g.target(dw, dh, [RGBA8], gl.NEAREST);
      this.drawDisplay(out, { x: 0, y: 0, w: dw, h: dh }, null, flat, mode, texture);
      const px = new Uint8Array(dw * dh * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, out.fbo);
      gl.readPixels(0, 0, dw, dh, gl.RGBA, gl.UNSIGNED_BYTE, px);
      g.disposeTarget(out);
      return px;
    }
    resize() {
      this.fitCanvas();
      this.schedule();
    }
    destroy() {
      cancelAnimationFrame(this.raf);
      this.dropFill();
      this.disposers.forEach((d) => d());
      this.tipTextures.forEach((t) => this.gl.deleteTexture(t));
      this.tipTextures.clear();
      if (this.ref) this.gl.deleteTexture(this.ref.tex);
      this.ref = null;
      this.g.disposeTargets();
    }
    /* ------------------------------------------------------------------ input */
    toUv(e) {
      const r = this.canvas.getBoundingClientRect();
      const cx = (e.clientX - r.left) * this.dpr;
      const cy = this.canvasSize[1] - (e.clientY - r.top) * this.dpr;
      return [(cx - this.view.x) / this.view.w, (cy - this.view.y) / this.view.h];
    }
    attachInput() {
      const c = this.canvas;
      const on = (el, type, fn3, opts) => {
        el.addEventListener(type, fn3, opts);
        this.disposers.push(() => el.removeEventListener(type, fn3, opts));
      };
      on(c, "pointerdown", (e) => {
        e.preventDefault();
        if (!this.interactive || this.nav || e.button === 1) return;
        if (this.stroke) return;
        if (e.pointerType === "pen") this.pencilSeen = true;
        try {
          c.setPointerCapture(e.pointerId);
        } catch {
        }
        let tool = this.tool;
        if (e.pointerType === "touch" && this.pencilSeen && this.fingerIsWater) tool = "water";
        if (e.pointerType === "pen" && e.buttons & 32) tool = "lift";
        else if (e.pointerType === "pen" && e.buttons & 2) tool = tool === "water" ? "brush" : "water";
        this.stroke = {
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          tool,
          started: false,
          ending: false,
          x: 0,
          y: 0,
          cx: 0,
          cy: 0,
          pr: 0,
          t: e.timeStamp,
          speed: 0,
          simPressure: 0.45,
          carry: 0,
          travelled: 0,
          moved: false,
          dx: this.lastDir[0],
          dy: this.lastDir[1],
          angle: this.lastAngle,
          azimuth: null,
          widthFrom: 1,
          widthTo: 1,
          pigFrom: null,
          pigTo: null
        };
        if (tool !== this.tool) this.callbacks.onStrokeTool?.(tool);
        this.beginStep("stroke", STROKE_LABEL[tool]);
        this.pushSample(e);
        this.trackHover(e);
        this.schedule();
      });
      on(c, "pointermove", (e) => {
        if (e.pointerType === "pen") this.pencilSeen = true;
        this.trackHover(e);
        if (!this.stroke || e.pointerId !== this.stroke.pointerId) return;
        const events = e.getCoalescedEvents?.() ?? [];
        for (const s of events.length ? events : [e]) this.pushSample(s);
        this.schedule();
      });
      const end2 = (e) => {
        if (!this.stroke || e.pointerId !== this.stroke.pointerId) return;
        this.stroke.ending = true;
        this.schedule();
      };
      on(c, "pointerup", end2);
      on(c, "pointercancel", end2);
      on(c, "pointerleave", () => {
        this.hover.inside = false;
        this.updateCursor();
      });
      on(c, "contextmenu", (e) => e.preventDefault());
      on(window, "blur", () => {
        if (this.stroke) this.stroke.ending = true;
      });
      on(c, "webkitmouseforcechanged", (e) => {
        const f = e.webkitForce;
        if (typeof f === "number") this.force = { value: clamp((f - 1) / 1.7, 0.04, 1), t: this.clock() };
      });
    }
    pushSample(e) {
      const [x, y] = this.toUv(e);
      let p = -1;
      let tx2 = e.tiltX || 0;
      let ty = e.tiltY || 0;
      const now = this.clock();
      const nativeActive = this.nativePenAt > -Infinity && now - this.nativePenAt < 300;
      const reportsPenDynamics = e.pointerType === "pen" && e.pressure !== 0.5 && e.pressure !== 0;
      if (nativeActive && this.nativePen && !reportsPenDynamics && (e.pointerType !== "mouse" || e.buttons > 0)) {
        p = this.nativePen.pressure;
        tx2 = this.nativePen.tiltX;
        ty = this.nativePen.tiltY;
      } else if (e.pointerType === "pen") {
        p = e.pressure > 0 ? Math.pow(e.pressure, 0.8) : 0.5;
      } else if (e.pointerType === "mouse" && now - this.force.t < 3e3) {
        p = this.force.value;
      }
      const sample = { x, y, p, t: e.timeStamp, tx: tx2, ty, w: 1 };
      this.queue.push(sample);
      this.callbacks.onStrokeSample?.(sample);
    }
    trackHover(e) {
      this.hover.x = e.clientX;
      this.hover.y = e.clientY;
      this.hover.inside = true;
      this.hover.type = e.pointerType;
      this.updateCursor();
    }
    updateCursor() {
      const el = this.cursor;
      if (!el) return;
      if (!this.hover.inside || this.hover.type === "touch" || !this.interactive || this.nav) {
        el.style.opacity = "0";
        return;
      }
      const tool = this.stroke?.tool ?? this.tool;
      const r = this.radius(tool, this.stroke ? this.pressureOf(this.stroke, -1) : 0.4, 0);
      const shaped = tool === "brush" || tool === "water";
      const b = this.brush;
      const d = Math.max(4, 2 * r * this.view.h / this.dpr);
      const h = shaped ? Math.max(3, d * b.aspect) : d;
      const angle = shaped && b.rotation !== "random" ? -(this.stroke?.angle ?? this.lastAngle) : 0;
      el.style.opacity = "1";
      el.style.width = `${d}px`;
      el.style.height = `${h}px`;
      el.style.transform = `translate(${this.hover.x - d / 2}px, ${this.hover.y - h / 2}px) rotate(${angle}rad)`;
      el.style.borderRadius = shaped && b.aspect < 0.6 ? `${h * 0.4}px / 50%` : "50%";
      el.dataset.tool = tool;
    }
    /* -------------------------------------------------------------- strokes */
    /**
     * Footprint multiplier. `widthFactor` (61-04) is the vector profile's
     * per-vertex factor, interpolated along the segment — it multiplies the
     * footprint on top of the scripted-stroke clamp, so it can exceed 1.0
     * where `scriptScale` alone could not (C-03). It is never assigned to
     * `scriptScale`. A factor of 1 (every existing call) is exact.
     */
    sizeMult(widthFactor = 1) {
      return Math.pow(3, (this.params.size - 0.5) * 2) * (this.scripting ? this.scriptScale : 1) * widthFactor;
    }
    /**
     * 61-04: the width factor at `fraction` of the segment being deposited,
     * linearly interpolated from the consumed sample's pair (widthFrom →
     * widthTo) and held at the ends. Always finite; never extrapolated.
     */
    widthFactorAt(s, fraction) {
      const u = clamp(fraction, 0, 1);
      return s.widthFrom + (s.widthTo - s.widthFrom) * u;
    }
    /**
     * 261111-wd6: the pigment at `fraction` of the segment being deposited,
     * linearly interpolated from the consumed sample's pair (pigFrom → pigTo)
     * and held at the ends. Null means no per-sample colour: the dab keeps
     * `this.pigment` (the stroke's base pigment). The interpolation targets ONE
     * scratch pigment — this runs per dab, so it never allocates.
     */
    pigmentAt(s, fraction) {
      const from = s.pigFrom;
      const to = s.pigTo;
      if (from === null || to === null) return null;
      if (from === to) return to;
      const u = clamp(fraction, 0, 1);
      const coeffs = this.scratchPigment.coeffs;
      for (let k = 0; k < COEFFS; k++) {
        coeffs[k] = from.coeffs[k] + (to.coeffs[k] - from.coeffs[k]) * u;
      }
      this.scratchPigment.white = from.white + (to.white - from.white) * u;
      return this.scratchPigment;
    }
    /**
     * 261111-wd6: stamp one dab with the segment's per-sample pigment, then put
     * the base pigment back. The swap is synchronous around the stamp, so a
     * sampled colour never outlives its dab — the next stroke, a bucket fill or
     * the live path always sees the pigment `configure()` installed.
     */
    stampScripted(s, x, y, pr, vx, vy, moving, dt, widthFactor, colorFraction) {
      const pigment = this.pigmentAt(s, colorFraction);
      if (pigment === null) {
        this.stamp(s, x, y, pr, vx, vy, moving, dt, widthFactor);
        return;
      }
      const previous = this.pigment;
      this.pigment = pigment;
      try {
        this.stamp(s, x, y, pr, vx, vy, moving, dt, widthFactor);
      } finally {
        this.pigment = previous;
      }
    }
    /** Footprint radius in document heights. */
    radius(tool, pr, speed, widthFactor = 1) {
      const m = this.sizeMult(widthFactor);
      switch (tool) {
        case "pen":
          return (16e-4 + 42e-4 * pr) * clamp(1.12 - speed * 0.3, 0.55, 1.12) * m;
        case "brush":
          return this.brushRadius(pr, speed, widthFactor);
        case "water":
          return this.brushRadius(pr, speed, widthFactor) * 1.3 * (1 + Math.min(speed, 2.5) * 0.12);
        case "lift":
          return (0.012 + 0.03 * pr) * m;
      }
    }
    /** Half the long axis of the current brush's footprint, in document heights. */
    brushRadius(pr, speed, widthFactor = 1) {
      const b = this.brush;
      const t = Math.pow(clamp(pr, 0, 1), b.pressureSize);
      return (b.size[0] + (b.size[1] - b.size[0]) * t) * clamp(1 - speed * b.speedThin, 0.4, 1) * this.sizeMult(widthFactor) * 0.8;
    }
    /** Tip angle for the next dab, in the document frame. */
    brushAngle(s) {
      const b = this.brush;
      let a;
      if (b.rotation === "random") a = this.rng() * Math.PI * 2;
      else if (b.rotation === "follow") a = Math.atan2(s.dy, s.dx) + b.angle * DEG2;
      else a = s.azimuth ?? b.angle * DEG2;
      if (b.angleJitter) a += (this.rng() - 0.5) * 2 * b.angleJitter * DEG2;
      s.angle = a;
      if (b.rotation !== "random") this.lastAngle = a;
      return a;
    }
    pressureOf(s, p) {
      return p >= 0 ? p : s.simPressure;
    }
    processInput(dt) {
      const s = this.stroke;
      if (!s) return;
      s.moved = false;
      const startedThisTick = !s.started;
      const aspect = this.dw / this.dh;
      for (const q of this.queue) {
        if (Math.hypot(q.tx, q.ty) > 12) s.azimuth = Math.atan2(-q.ty, q.tx);
        if (!s.started) {
          s.started = true;
          s.x = s.cx = q.x;
          s.y = s.cy = q.y;
          s.t = q.t;
          s.pr = this.pressureOf(s, q.p);
          s.widthFrom = s.widthTo = q.w;
          s.pigFrom = s.pigTo = q.pig ?? null;
          this.stampScripted(s, q.x, q.y, s.pr, 0, 0, 1, 0, q.w, 1);
          continue;
        }
        s.widthFrom = s.widthTo;
        s.widthTo = q.w;
        s.pigFrom = s.pigTo;
        s.pigTo = q.pig ?? null;
        const sdt = Math.max(q.t - s.t, 1) / 1e3;
        s.t = q.t;
        const k = s.pointerType === "mouse" ? 0.5 : 0.65;
        const nx = s.cx + (q.x - s.cx) * k, ny = s.cy + (q.y - s.cy) * k;
        const len = Math.hypot((nx - s.cx) * aspect, ny - s.cy);
        s.speed += (len / sdt - s.speed) * (1 - Math.exp(-sdt * 10));
        const target = clamp(1.18 - s.speed * 0.95, 0.12, 1);
        s.simPressure += (target - s.simPressure) * (1 - Math.exp(-sdt * 6));
        const pr = this.pressureOf(s, q.p);
        const vx = (nx - s.cx) / sdt, vy = (ny - s.cy) / sdt;
        if (s.pointerId === SCRIPT_POINTER) {
          this.trace(s, nx, ny, nx, ny, pr, vx, vy);
        } else {
          this.trace(s, s.cx, s.cy, (s.cx + nx) / 2, (s.cy + ny) / 2, pr, vx, vy);
        }
        s.cx = nx;
        s.cy = ny;
        if (len > 0) s.moved = true;
      }
      this.queue = [];
      if (s.started && (!s.moved || s.ending) && (s.x !== s.cx || s.y !== s.cy)) this.trace(s, s.cx, s.cy, s.cx, s.cy, s.pr, 0, 0);
      if (!s.moved && s.started && !s.ending && !startedThisTick) this.stampScripted(s, s.x, s.y, this.pressureOf(s, -1), 0, 0, 0, dt, this.widthFactorAt(s, 1), 1);
      if (s.ending) {
        this.stroke = null;
        this.restoreStrokePigment();
        if (s.pointerId !== SCRIPT_POINTER) {
          this.callbacks.onStrokeTool?.(null);
          this.callbacks.onStrokeEnd?.(s.tool);
        }
      }
    }
    /**
     * Lay dabs along the quadratic from the stroke's end (s.x, s.y) through control (qx, qy)
     * to (ex, ey), every `spacing` of arc length so deposits don't depend on event rate.
     * Pressure ramps from s.pr to `pr`; direction follows the curve's tangent.
     */
    trace(s, qx, qy, ex, ey, pr, vx, vy) {
      const aspect = this.dw / this.dh;
      const x0 = s.x, y0 = s.y, pr0 = s.pr;
      const approx = Math.hypot((qx - x0) * aspect, qy - y0) + Math.hypot((ex - qx) * aspect, ey - qy);
      if (approx < 1e-7) return;
      const fine = this.radius(s.tool, Math.max(pr0, pr), s.speed, this.widthFactorAt(s, 1)) * this.spacingFrac(s.tool);
      const n = clamp(Math.ceil(approx / Math.max(fine, 1e-5)), 1, 48);
      let px = x0, py = y0;
      for (let i = 1; i <= n; i++) {
        const u = i / n, w = 1 - u;
        const cx = w * w * x0 + 2 * w * u * qx + u * u * ex;
        const cy = w * w * y0 + 2 * w * u * qy + u * u * ey;
        const dx = (cx - px) * aspect, dy = cy - py;
        const len = Math.hypot(dx, dy);
        const p = pr0 + (pr - pr0) * u;
        const widthAt = this.widthFactorAt(s, u);
        if (len > 1e-5) {
          const kd = 1 - Math.exp(-len / (this.radius(s.tool, p, s.speed, widthAt) * 1.5 + 1e-4));
          s.dx += (dx / len - s.dx) * kd;
          s.dy += (dy / len - s.dy) * kd;
          const m = Math.hypot(s.dx, s.dy) || 1;
          s.dx /= m;
          s.dy /= m;
          this.lastDir = [s.dx, s.dy];
        }
        const spacing = this.radius(s.tool, p, s.speed, widthAt) * this.spacingFrac(s.tool);
        let pos = 0;
        while (len - pos >= spacing - s.carry) {
          pos += spacing - s.carry;
          s.carry = 0;
          const t = pos / len;
          const fraction = (i - 1 + t) / n;
          this.stampScripted(s, px + (cx - px) * t, py + (cy - py) * t, p, vx, vy, 1, 0, this.widthFactorAt(s, fraction), fraction);
        }
        s.carry += len - pos;
        s.travelled += len;
        px = cx;
        py = cy;
      }
      s.x = ex;
      s.y = ey;
      s.pr = pr;
    }
    /** Dab spacing as a fraction of the footprint radius. */
    spacingFrac(tool) {
      const b = this.brush;
      return tool === "brush" || tool === "water" ? b.spacing * Math.sqrt(b.aspect) : 0.5;
    }
    /** One dab of the current tool. `moving` = 0 with `dt` set means a dwell. */
    stamp(s, x, y, pr, vx, vy, moving, dt = 0, widthFactor = 1) {
      const P = this.params;
      const r = this.radius(s.tool, pr, s.speed, widthFactor);
      const dwell = moving ? 1 : dt * 8;
      switch (s.tool) {
        case "brush": {
          const b = this.brush;
          const reservoir = 0.25 + 0.75 * Math.exp(-s.travelled / ((1.5 + 3 * P.water) * b.capacity));
          const dryness = clamp(b.grain + (1 - b.grain) * clamp((0.5 - reservoir) * 2.5, 0, 1) * 0.6, 0, 1);
          const grainThr = 0.74 - 0.45 * pr - 0.05 * P.water;
          const conc = 0.15 * Math.exp(P.load * 2.8) * reservoir * (0.4 + 0.6 * pr) * b.load;
          const norm = clamp(Math.sqrt(0.5 / b.tipMean), 0.7, 2.2);
          const amount = conc * Math.min(b.spacing, 1) / 1.8 * norm * dwell;
          const wet = (0.25 + 0.75 * P.water) * (0.7 + 0.3 * pr) * b.water * (0.4 + 0.6 * reservoir);
          const c = this.pigment.coeffs;
          const c0 = [c[0] * amount, c[1] * amount, c[2] * amount, c[3] * amount];
          const c1 = [c[4] * amount, c[5] * amount, c[6] * amount, this.pigment.white * amount * 1.6];
          this.eachDab(s, x, y, r, (dx, dy, dr, angle) => {
            this.brushInk(dx, dy, dr, angle, c0, c1, dryness, grainThr);
            if (wet > 0) this.brushWet(dx, dy, dr * (1 + 0.12 * b.wetRound), angle, wet, b.wetRound, dryness, grainThr);
          });
          if (moving && b.water > 0) this.splatVelocity(x, y, r * 1.2, vx, vy, (15 + P.flow * 95) * 0.25 * b.flow);
          break;
        }
        case "water": {
          const b = this.brush;
          const reservoir = 0.25 + 0.75 * Math.exp(-s.travelled / ((3 + 4 * P.water) * b.capacity));
          const amp = (0.35 + 0.65 * P.water) * (0.5 + 0.5 * pr) * clamp(b.water, 0.6, 1.5) * (0.7 + 0.3 * reservoir);
          const dryness = b.grain * 0.7;
          const grainThr = 0.55 - 0.3 * pr;
          this.eachDab(s, x, y, r, (dx, dy, dr, angle) => {
            this.brushWet(dx, dy, dr, angle, amp, Math.max(b.wetRound, 0.3), dryness, grainThr);
          });
          this.brushNow = { x, y, r };
          if (moving) this.splatVelocity(x, y, r * 1.15, vx, vy, (15 + P.flow * 95) * b.flow);
          else {
            const a = this.rng() * Math.PI * 2, m = (6 + 26 * P.flow) * pr;
            this.splatVelocityRaw(x, y, r * 0.9, Math.cos(a) * m, Math.sin(a) * m);
          }
          break;
        }
        case "pen": {
          const dens = (0.9 + 1.6 * pr) * clamp(1.25 - s.speed * 0.45, 0.6, 1.25) * (0.5 + P.load);
          const amount = dens * 0.5 / 1.8 * dwell;
          const c = this.pigment.coeffs;
          this.splatInk(
            x,
            y,
            r,
            [c[0] * amount, c[1] * amount, c[2] * amount, c[3] * amount],
            [c[4] * amount, c[5] * amount, c[6] * amount, this.pigment.white * amount * 3],
            2
          );
          this.splatWet(x, y, r * 2.6, 0.13, 1);
          break;
        }
        case "lift": {
          const amount = Math.min(0.9, P.lift * dwell);
          this.lift(x, y, r, this.brushAngle(s), amount);
          break;
        }
      }
    }
    /* --------------------------------------------------------------- splats */
    /** Run `fn` for every dab of a stamp: one for most brushes, a scattered burst for spatter. */
    eachDab(s, x, y, r, fn3) {
      const b = this.brush;
      const aspect = this.dw / this.dh;
      for (let i = 0; i < b.dabs; i++) {
        let dx = x, dy = y, dr = r;
        if (b.scatter > 0) {
          const a = this.rng() * Math.PI * 2, m = Math.sqrt(this.rng()) * b.scatter * r;
          dx += Math.cos(a) * m / aspect;
          dy += Math.sin(a) * m;
        }
        if (b.sizeJitter > 0) dr *= clamp(1 + (this.rng() * 2 - 1) * b.sizeJitter, 0.15, 2);
        fn3(dx, dy, dr, this.brushAngle(s));
      }
    }
    drawStamp(t, x, y, r, angle, c0, c1, round, grain, grainThr) {
      const { gl, g } = this;
      const b = this.brush;
      const p = this.programs.stamp;
      p.bind();
      gl.uniform1i(p.u.uTip, g.bindTex(0, this.tipTexture(b)));
      gl.uniform1i(p.u.uPaper, g.bindTex(1, this.paper.tex[0]));
      gl.uniform1f(p.u.uAspect, t.w / t.h);
      gl.uniform2f(p.u.uPoint, x, y);
      gl.uniform1f(p.u.uRadius, r);
      gl.uniform1f(p.u.uTipAspect, b.aspect);
      gl.uniform1f(p.u.uTipRotation, (b.textureRotation ?? 0) * DEG2);
      gl.uniform2f(p.u.uAxis, Math.cos(angle), Math.sin(angle));
      gl.uniform1f(p.u.uRound, round);
      gl.uniform1f(p.u.uGrain, grain);
      gl.uniform1f(p.u.uGrainThr, grainThr);
      gl.uniform1f(p.u.uRough, b.roughness ?? 0);
      gl.uniform1f(p.u.uJitter, b.stampJitter ?? 0);
      gl.uniform4fv(p.u.uColor0, c0);
      gl.uniform4fv(p.u.uColor1, c1);
      g.draw(t, this.stampRect(x, y, r, t.w, t.h, Math.sqrt(1 + b.aspect * b.aspect) * 1.02));
    }
    brushInk(x, y, r, angle, c0, c1, grain, grainThr) {
      const { gl } = this;
      this.touch(this.stampRect(x, y, r, this.dw, this.dh, 1.5));
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE);
      this.drawStamp(this.ink.read, x, y, r, angle, c0, c1, 0, grain, grainThr);
      gl.disable(gl.BLEND);
    }
    brushWet(x, y, r, angle, amount, round, grain, grainThr) {
      const { gl } = this;
      this.touch(this.stampRect(x, y, r, this.dw, this.dh, 1.5));
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.MAX);
      this.drawStamp(this.wet.read, x, y, r, angle, [amount, 0, 0, 0], [0, 0, 0, 0], round, grain, grainThr);
      gl.blendEquation(gl.FUNC_ADD);
      gl.disable(gl.BLEND);
      this.wetPeak = Math.max(this.wetPeak * this.wetDecay(), amount);
      this.lastWet = this.clock();
    }
    /** Rect (in texels of a w×h grid) covered by a stamp of radius r (doc heights). */
    stampRect(x, y, r, w, h, extent) {
      const e = Math.ceil(r * extent * h) + 2;
      const cx = Math.round(x * w), cy = Math.round(y * h);
      return { x0: clamp(cx - e, 0, w), y0: clamp(cy - e, 0, h), x1: clamp(cx + e, 0, w), y1: clamp(cy + e, 0, h) };
    }
    /**
     * Grow the simulated region. With `save`, the tiles around `rect` are saved for undo
     * first: a step restores what its own dabs and fills touched (plus a margin for what
     * spread from them), while the rest of the sheet simply keeps drying. That keeps a
     * step's cost proportional to the stroke, not to everything that happens to be wet.
     */
    touch(rect, wake = true, save = true) {
      if (rect.x1 <= rect.x0 || rect.y1 <= rect.y0) return;
      const next = union(this.active, rect);
      if (save) {
        const m = PROTECT_MARGIN;
        this.history.protect(0, { x0: Math.max(0, rect.x0 - m), y0: Math.max(0, rect.y0 - m), x1: Math.min(this.dw, rect.x1 + m), y1: Math.min(this.dh, rect.y1 + m) }, this.snapshotLayers());
      }
      this.active = next;
      this.painted = union(this.painted, rect);
      this.everPainted = union(this.everPainted, rect);
      this.dirty = union(this.dirty, rect);
      if (wake) this.minAwakeUntil = Math.max(this.minAwakeUntil, this.clock() + 250);
    }
    snapshotLayers() {
      return [this.ink.read.views[0], this.ink.read.views[1], this.wet.read.views[0]];
    }
    drawSplat(t, x, y, r, c0, c1, hardness, extent) {
      const { gl, g } = this;
      const p = this.programs.splat;
      p.bind();
      gl.uniform1f(p.u.uAspect, t.w / t.h);
      gl.uniform2f(p.u.uPoint, x, y);
      gl.uniform1f(p.u.uRadius, r);
      gl.uniform1f(p.u.uHardness, hardness);
      gl.uniform4fv(p.u.uColor0, c0);
      gl.uniform4fv(p.u.uColor1, c1);
      g.draw(t, this.stampRect(x, y, r, t.w, t.h, extent));
    }
    splatInk(x, y, r, c0, c1, hardness) {
      const { gl } = this;
      const extent = hardness > 1.4 ? 2.2 : 3.2;
      this.touch(this.stampRect(x, y, r, this.dw, this.dh, extent));
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE);
      this.drawSplat(this.ink.read, x, y, r, c0, c1, hardness, extent);
      gl.disable(gl.BLEND);
    }
    splatWet(x, y, r, amount, hardness) {
      const { gl } = this;
      const extent = hardness > 1.4 ? 2.2 : 3.2;
      this.touch(this.stampRect(x, y, r, this.dw, this.dh, extent));
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.MAX);
      this.drawSplat(this.wet.read, x, y, r, [amount, 0, 0, 0], [0, 0, 0, 0], hardness, extent);
      gl.blendEquation(gl.FUNC_ADD);
      gl.disable(gl.BLEND);
      this.wetPeak = Math.max(this.wetPeak * this.wetDecay(), amount);
      this.lastWet = this.clock();
    }
    splatVelocity(x, y, r, vx, vy, force) {
      let fx = vx * force, fy = vy * force;
      const m = Math.hypot(fx, fy), vmax = 240;
      if (m > vmax) {
        fx *= vmax / m;
        fy *= vmax / m;
      }
      this.flowSpeed = Math.max(this.flowSpeed, Math.min(m, vmax));
      this.splatVelocityRaw(x, y, r, fx, fy);
    }
    splatVelocityRaw(x, y, r, fx, fy) {
      const { gl } = this;
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE);
      this.drawSplat(this.velocity.read, x, y, r, [fx, fy, 0, 0], [0, 0, 0, 0], 1, 3);
      gl.disable(gl.BLEND);
    }
    lift(x, y, r, angle, amount) {
      const { gl, g } = this;
      const b = this.liftBrush ?? this.brush;
      const rect = this.stampRect(x, y, r, this.dw, this.dh, 2);
      this.touch(rect);
      const m = PROTECT_MARGIN;
      this.history.protect(1, { x0: Math.max(0, rect.x0 - m), y0: Math.max(0, rect.y0 - m), x1: Math.min(this.dw, rect.x1 + m), y1: Math.min(this.dh, rect.y1 + m) }, this.fixed.views);
      const p = this.programs.lift;
      p.bind();
      gl.uniform1i(p.u.uTip, g.bindTex(0, this.tipTexture(b)));
      gl.uniform1f(p.u.uAspect, this.dw / this.dh);
      gl.uniform2f(p.u.uPoint, x, y);
      gl.uniform1f(p.u.uRadius, r);
      gl.uniform1f(p.u.uTipAspect, b.aspect);
      gl.uniform1f(p.u.uTipRotation, (b.textureRotation ?? 0) * DEG2);
      gl.uniform2f(p.u.uAxis, Math.cos(angle), Math.sin(angle));
      gl.uniform1f(p.u.uRound, 0);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);
      gl.uniform1f(p.u.uAmount, amount);
      g.draw(this.ink.read, rect);
      gl.uniform1f(p.u.uAmount, amount * 0.8);
      g.draw(this.wet.read, rect);
      gl.uniform1f(p.u.uAmount, amount);
      g.draw(this.fixed, rect);
      gl.disable(gl.BLEND);
      this.callbacks.onLiftDab?.(x, y, r, amount, angle);
    }
    /* ----------------------------------------------------------- simulation */
    dryTau() {
      return this.fixTimer > 0 ? 0.25 : 2 + (1 - this.params.dry) * 16;
    }
    wetDecay() {
      return Math.exp(-(this.clock() - this.lastWet) / 1e3 / this.dryTau());
    }
    /** Time (ms) until standing water everywhere has dried below the threshold. */
    wetUntil() {
      if (this.wetPeak <= WET_THRESHOLD) return this.lastWet;
      return this.lastWet + this.dryTau() * Math.log(this.wetPeak / WET_THRESHOLD) * 1e3;
    }
    beginStep(kind, label) {
      this.dropFill();
      this.autoFix = false;
      this.history.begin({ kind, label }, this.currentMeta());
      this.notifyHistory();
    }
    step(dt) {
      const { gl, g, programs: P } = this;
      const fixing = this.fixTimer > 0;
      if (fixing) {
        this.fixTimer -= dt;
        if (this.fixTimer <= 0) {
          this.wetPeak = 0;
          this.minAwakeUntil = 0;
          this.painted = null;
        }
      }
      const vel = this.velocity;
      const simTexel = [1 / vel.w, 1 / vel.h];
      const texel = [1 / this.dw, 1 / this.dh];
      const flow = this.params.flow;
      const rect = this.active;
      P.advectVelocity.bind();
      gl.uniform1i(P.advectVelocity.u.uVelocity, g.bindTex(0, vel.read.tex[0]));
      gl.uniform1i(P.advectVelocity.u.uWet, g.bindTex(1, this.wet.read.tex[0]));
      gl.uniform2fv(P.advectVelocity.u.uTexel, simTexel);
      gl.uniform1f(P.advectVelocity.u.uDt, dt);
      gl.uniform1f(P.advectVelocity.u.uDissipation, Math.exp(-dt * (3 - flow * 2.4)) * (fixing ? Math.exp(-dt * 7) : 1));
      g.draw(vel.write);
      vel.swap();
      P.curl.bind();
      gl.uniform1i(P.curl.u.uVelocity, g.bindTex(0, vel.read.tex[0]));
      gl.uniform2fv(P.curl.u.uTexel, simTexel);
      g.draw(this.curl);
      P.vorticity.bind();
      gl.uniform1i(P.vorticity.u.uVelocity, g.bindTex(0, vel.read.tex[0]));
      gl.uniform1i(P.vorticity.u.uCurl, g.bindTex(1, this.curl.tex[0]));
      gl.uniform2fv(P.vorticity.u.uTexel, simTexel);
      gl.uniform1f(P.vorticity.u.uCurlAmount, 4 + flow * 22);
      gl.uniform1f(P.vorticity.u.uDt, dt);
      g.draw(vel.write);
      vel.swap();
      P.divergence.bind();
      gl.uniform1i(P.divergence.u.uVelocity, g.bindTex(0, vel.read.tex[0]));
      gl.uniform2fv(P.divergence.u.uTexel, simTexel);
      g.draw(this.divergence);
      P.scale.bind();
      gl.uniform1i(P.scale.u.uTex, g.bindTex(0, this.pressure.read.tex[0]));
      gl.uniform1f(P.scale.u.uValue, 0.8);
      g.draw(this.pressure.write);
      this.pressure.swap();
      P.pressure.bind();
      gl.uniform1i(P.pressure.u.uDivergence, g.bindTex(1, this.divergence.tex[0]));
      gl.uniform2fv(P.pressure.u.uTexel, simTexel);
      for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
        gl.uniform1i(P.pressure.u.uPressure, g.bindTex(0, this.pressure.read.tex[0]));
        g.draw(this.pressure.write);
        this.pressure.swap();
      }
      P.gradient.bind();
      gl.uniform1i(P.gradient.u.uPressure, g.bindTex(0, this.pressure.read.tex[0]));
      gl.uniform1i(P.gradient.u.uVelocity, g.bindTex(1, vel.read.tex[0]));
      gl.uniform2fv(P.gradient.u.uTexel, simTexel);
      g.draw(vel.write);
      vel.swap();
      P.advectWet.bind();
      gl.uniform1i(P.advectWet.u.uVelocity, g.bindTex(0, vel.read.tex[0]));
      gl.uniform1i(P.advectWet.u.uWet, g.bindTex(1, this.wet.read.tex[0]));
      gl.uniform2fv(P.advectWet.u.uSimTexel, simTexel);
      gl.uniform2fv(P.advectWet.u.uTexel, texel);
      gl.uniform1f(P.advectWet.u.uDt, dt);
      gl.uniform1f(P.advectWet.u.uDecay, Math.exp(-dt / this.dryTau()));
      gl.uniform1f(P.advectWet.u.uSpread, 0.12);
      g.draw(this.wet.write, rect);
      this.wet.swap();
      const settle = fixing ? 1 - Math.exp(-dt * 5) : 0;
      if (fixing) {
        gl.enable(gl.BLEND);
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
        P.bleach.bind();
        gl.uniform1i(P.bleach.u.uInkB, g.bindTex(0, this.ink.read.tex[1]));
        gl.uniform1f(P.bleach.u.uSettle, settle);
        g.draw(this.fixed, rect);
        gl.blendFunc(gl.ONE, gl.ONE);
        P.settle.bind();
        gl.uniform1i(P.settle.u.uInkA, g.bindTex(0, this.ink.read.tex[0]));
        gl.uniform1i(P.settle.u.uInkB, g.bindTex(1, this.ink.read.tex[1]));
        gl.uniform1f(P.settle.u.uSettle, settle);
        g.draw(this.fixed, rect);
        gl.disable(gl.BLEND);
      }
      const p = P.advectInk;
      p.bind();
      gl.uniform1i(p.u.uVelocity, g.bindTex(0, vel.read.tex[0]));
      gl.uniform1i(p.u.uInkA, g.bindTex(1, this.ink.read.tex[0]));
      gl.uniform1i(p.u.uInkB, g.bindTex(2, this.ink.read.tex[1]));
      gl.uniform1i(p.u.uWet, g.bindTex(3, this.wet.read.tex[0]));
      gl.uniform2fv(p.u.uSimTexel, simTexel);
      gl.uniform2fv(p.u.uTexel, texel);
      gl.uniform1f(p.u.uDt, dt);
      gl.uniform1f(p.u.uBleed, this.params.bleed);
      gl.uniform1f(p.u.uEdge, this.params.edge * 1.4);
      gl.uniform1f(p.u.uAspect, this.dw / this.dh);
      gl.uniform1f(p.u.uKeep, 1 - settle);
      gl.uniform3f(p.u.uBrush, this.brushNow.x, this.brushNow.y, this.brushNow.r);
      g.draw(this.ink.write, rect);
      this.ink.swap();
      this.dirty = union(this.dirty, rect);
    }
    /**
     * The active rect grows blindly each frame so the wet front can creep; left alone it
     * would cover the sheet in a minute, and every undo step would have to save all of
     * it. Now and then, find where there is actually water and cut the rect down to that.
     */
    trimActive() {
      const a = this.active;
      if (!a) return;
      const { gl, g } = this;
      const m = this.wetMask;
      const p = this.programs.wetMask;
      p.bind();
      gl.uniform1i(p.u.uWet, g.bindTex(0, this.wet.read.tex[0]));
      gl.uniform2f(p.u.uBlock, 1 / m.w, 1 / m.h);
      gl.uniform1f(p.u.uThreshold, WET_THRESHOLD);
      g.draw(m);
      gl.bindFramebuffer(gl.FRAMEBUFFER, m.fbo);
      gl.readPixels(0, 0, m.w, m.h, gl.RGBA, gl.UNSIGNED_BYTE, this.maskPixels);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      let x0 = m.w, y0 = m.h, x1 = -1, y1 = -1;
      const px = this.maskPixels;
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        if (!px[(y * m.w + x) * 4]) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      let next = null;
      if (x1 >= 0) {
        const wet = {
          x0: Math.max(0, x0 * MASK_BLOCK - MASK_MARGIN),
          y0: Math.max(0, y0 * MASK_BLOCK - MASK_MARGIN),
          x1: Math.min(this.dw, (x1 + 1) * MASK_BLOCK + MASK_MARGIN),
          y1: Math.min(this.dh, (y1 + 1) * MASK_BLOCK + MASK_MARGIN)
        };
        const r = { x0: Math.max(a.x0, wet.x0), y0: Math.max(a.y0, wet.y0), x1: Math.min(a.x1, wet.x1), y1: Math.min(a.y1, wet.y1) };
        if (r.x1 > r.x0 && r.y1 > r.y0) next = r;
      }
      if (next && next.x0 === a.x0 && next.y0 === a.y0 && next.x1 === a.x1 && next.y1 === a.y1) return;
      const w = a.x1 - a.x0, h = a.y1 - a.y0;
      for (const d of [this.ink, this.wet])
        d.read.views.forEach((v, i) => g.blit(v, a.x0, a.y0, d.write.views[i], a.x0, a.y0, w, h));
      if (next) this.active = next;
      else this.sleep();
    }
    /** Make both halves of the ping-pong buffers identical, then stop simulating. */
    sleep() {
      const rect = this.active;
      if (rect) {
        const { g } = this;
        const w = rect.x1 - rect.x0, h = rect.y1 - rect.y0;
        for (const d of [this.ink, this.wet])
          d.read.views.forEach((v, i) => g.blit(v, rect.x0, rect.y0, d.write.views[i], rect.x0, rect.y0, w, h));
      }
      for (const d of [this.velocity, this.pressure]) {
        this.g.clearTarget(d.read);
        this.g.clearTarget(d.write);
      }
      this.active = null;
      this.wetPeak = 0;
      this.flowSpeed = 0;
    }
    /* -------------------------------------------------------------- display */
    drawDisplay(target, view, scissor, flat = false, mode = MODE.screen, texture = true) {
      const { gl, g } = this;
      const p = this.programs.display;
      p.bind();
      gl.uniform1i(p.u.uInkA, g.bindTex(0, this.ink.read.tex[0]));
      gl.uniform1i(p.u.uInkB, g.bindTex(1, this.ink.read.tex[1]));
      gl.uniform1i(p.u.uFixedA, g.bindTex(2, this.fixed.tex[0]));
      gl.uniform1i(p.u.uFixedB, g.bindTex(3, this.fixed.tex[1]));
      gl.uniform1i(p.u.uWet, g.bindTex(4, this.wet.read.tex[0]));
      gl.uniform1i(p.u.uPaper, g.bindTex(5, this.paper.tex[0]));
      gl.uniform4f(p.u.uView, view.x, view.y, view.w, view.h);
      gl.uniform2f(p.u.uTexel, 1 / this.dw, 1 / this.dh);
      gl.uniform1f(p.u.uGranulation, this.params.granulation * 0.55);
      gl.uniform1f(p.u.uEdgeDarken, 0.8);
      gl.uniform1f(p.u.uFlat, flat ? 1 : 0);
      gl.uniform3fv(p.u.uDesk, DESK);
      gl.uniform1i(p.u.uMode, mode);
      this.paperUniforms(p, this.paperPreset, texture ? this.paperStrength : 0);
      const ref = mode === MODE.screen && !flat && this.refVisible ? this.ref : null;
      gl.uniform1f(p.u.uRefOpacity, ref ? this.refOpacity : 0);
      gl.uniform1i(p.u.uRef, g.bindTex(6, ref ? ref.tex : this.paper.tex[0]));
      const r = this.refRect;
      gl.uniform4f(p.u.uRefRect, r.x, r.y, r.w, r.h);
      const shadow = mode === MODE.screen && !target ? clamp(Math.min(view.w, view.h) / this.dpr * 0.05, 14, 48) * this.dpr : 0;
      gl.uniform1f(p.u.uShadow, shadow);
      gl.uniform1f(p.u.uDpr, this.dpr);
      g.draw(target, scissor, this.canvasSize);
    }
    render() {
      if (!this.dirtyAll && !this.dirty) return;
      let rect = null;
      if (!this.dirtyAll && this.dirty) {
        const v = this.view, d = this.dirty;
        rect = {
          x0: Math.floor(v.x + d.x0 / this.dw * v.w) - 2,
          y0: Math.floor(v.y + d.y0 / this.dh * v.h) - 2,
          x1: Math.ceil(v.x + d.x1 / this.dw * v.w) + 2,
          y1: Math.ceil(v.y + d.y1 / this.dh * v.h) + 2
        };
      }
      this.drawDisplay(null, this.view, rect, false, this.compositorLayer ? MODE.pigment : MODE.screen);
      this.dirty = null;
      this.dirtyAll = false;
    }
    /* ------------------------------------------------------------ main loop */
    schedule() {
      if (this.manual) return;
      if (!this.raf) {
        this.lastFrame = this.clock();
        this.raf = requestAnimationFrame(this.frame);
      }
    }
    frame = (now) => {
      this.raf = 0;
      const dt = clamp((now - this.lastFrame) / 1e3, 1 / 240, 1 / 30);
      this.lastFrame = now;
      this.brushNow.r = 0;
      this.processInput(dt);
      const awake = this.active !== null && (this.stroke !== null || this.fixTimer > 0 || now < this.minAwakeUntil || now < this.wetUntil());
      if (awake) {
        this.flowSpeed *= Math.exp(-dt * (3 - this.params.flow * 2.4));
        this.growCarry += 0.4 + Math.min(3, 0.15 * this.flowSpeed * dt * (this.dw / this.velocity.w));
        const grow = Math.floor(this.growCarry);
        if (grow > 0) {
          this.growCarry -= grow;
          const a = this.active;
          this.touch({ x0: Math.max(0, a.x0 - grow), y0: Math.max(0, a.y0 - grow), x1: Math.min(this.dw, a.x1 + grow), y1: Math.min(this.dh, a.y1 + grow) }, false, false);
        }
        this.step(dt);
        if (this.fixTimer <= 0 && ++this.maskCounter >= MASK_EVERY) {
          this.maskCounter = 0;
          this.trimActive();
        }
      }
      this.render();
      if (this.history.evictions !== this.seenEvictions) this.notifyHistory();
      if (!awake && this.active) this.sleep();
      if (awake || this.stroke) this.schedule();
    };
  };

  // packages/efx-watercolor/src/playground/params.ts
  var DEFAULT_CANONICAL_PARAMS = Object.freeze({
    size: 12,
    water: 50,
    load: 50,
    flow: 50,
    bleed: 50,
    dry: 50,
    edge: 50,
    granulation: 50,
    lift: 22
  });
  function num(v, fallback) {
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
  }
  var LEGACY_SIZE_MAX_PX = 80;
  var SIZE_MAX_PX = 800;
  var SIZE_SCALE_AT_MAX = 2.04795;
  var SIZE_SCALE_HARD_MAX = 4;
  function sizeToEngineScale(sizePx) {
    if (sizePx <= 32) return sizePx / 32;
    if (sizePx <= LEGACY_SIZE_MAX_PX) return 1;
    const t = (sizePx - LEGACY_SIZE_MAX_PX) / (SIZE_MAX_PX - LEGACY_SIZE_MAX_PX);
    return Math.min(SIZE_SCALE_HARD_MAX, 1 + t * (SIZE_SCALE_AT_MAX - 1));
  }
  function toEngineParams(canonical) {
    const p = canonical ?? {};
    const d = DEFAULT_CANONICAL_PARAMS;
    return {
      size: sizeToEngineScale(num(p.size, d.size)),
      water: num(p.water, d.water) / 100,
      load: num(p.load, d.load) / 100,
      flow: num(p.flow, d.flow) / 100,
      bleed: num(p.bleed, d.bleed) / 100,
      dry: num(p.dry, d.dry) / 100,
      edge: num(p.edge, d.edge) / 100,
      granulation: num(p.granulation, d.granulation) / 100,
      lift: num(p.lift, d.lift) / 100
    };
  }

  // packages/efx-watercolor/src/brushes/deriveMask.ts
  var TIP_MASK_EDGE = 512;
  var TIP_MASK_BYTES = TIP_MASK_EDGE * TIP_MASK_EDGE;

  // packages/efx-watercolor/src/brushes/maskRegistry.ts
  var masks = /* @__PURE__ */ new Map();
  var generation = 0;
  function isWritable(id, mask) {
    if (typeof id !== "string" || id.length === 0) return false;
    if (!(mask instanceof Uint8Array)) return false;
    return mask.length === TIP_MASK_BYTES;
  }
  function registerMask(id, mask) {
    if (!isWritable(id, mask)) return false;
    masks.set(id, mask);
    generation += 1;
    return true;
  }
  function resolveMask(id) {
    return masks.get(id) ?? null;
  }

  // packages/efx-watercolor/src/playground/brushBridge.ts
  var TIP_TO_PRESET = {
    "wc/round-small": "round",
    "wc/round-medium": "round",
    "wc/round-large": "round",
    "wc/round-detail": "detail",
    "wc/flat-wash": "flat",
    "wc/flat-angle": "dagger",
    "wc/flat-dry": "dry",
    "wc/texture-grain": "dry",
    "wc/texture-sponge": "sponge",
    "wc/texture-salt": "spatter",
    "wc/texture-stipple": "stipple",
    "wc/experimental-bloom": "mop",
    "wc/experimental-bleed": "mop",
    "wc/experimental-granulate": "dry"
  };
  function mult(v, fallback = 1) {
    return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;
  }
  function presetFor(brushId) {
    const presetId = TIP_TO_PRESET[brushId] ?? (BRUSH_PRESETS.some((b) => b.id === brushId) ? brushId : "round");
    return BRUSH_PRESETS.find((b) => b.id === presetId) ?? BRUSH_PRESETS[0];
  }
  function resolveStrokeBrush(brushId, textureId, seed, textureRotation = null) {
    const base = presetFor(brushId);
    const mask = textureId ? resolveMask(textureId) : null;
    return {
      ...buildBrush({ ...base, tip: mask ?? base.tip }, seed),
      textureId: mask ? textureId : null,
      // quick 261116-inu: same law for the rotation — it only means something
      // on a textured tip. A textured rotationless stroke carries 0 degrees
      // (the library default); an untextured/unknown one carries null.
      textureRotation: mask ? textureRotation ?? 0 : null
    };
  }
  function buildBrushForStroke(brushId, options) {
    const base = resolveStrokeBrush(
      brushId,
      options?.textureId ?? null,
      options?.seed ?? 7,
      options?.textureRotation ?? null
    );
    const overrides = options?.overrides;
    if (!overrides) return base;
    return {
      ...base,
      aspect: base.aspect * mult(overrides.aspect),
      angle: base.angle * mult(overrides.rotation),
      pressureSize: base.pressureSize * mult(overrides.sizeCurve),
      spacing: base.spacing / mult(overrides.tip),
      scatter: base.scatter * mult(overrides.scatter),
      capacity: base.capacity * mult(overrides.capacity),
      grain: base.grain * mult(overrides.grain),
      wetRound: base.wetRound * mult(overrides.wetRound)
    };
  }

  // packages/efx-watercolor/src/adapter/engineAdapter.ts
  var HOST_TICK_HZ = 60;
  var HOST_DT = 1 / HOST_TICK_HZ;
  function resolveBakePaperPreset(paper, hostPreset) {
    if (!paper) return hostPreset;
    const vendor = PAPERS.find((preset) => preset.id === paper.paperId);
    if (vendor) return vendor;
    return hostPreset ?? DEFAULT_PAPER;
  }
  function acceptEvent(raw) {
    if (typeof raw !== "object" || raw === null) return null;
    if (isAquarelleDryEvent(raw)) {
      return payloadCodec.parse(payloadCodec.serialize(raw));
    }
    return payloadCodec.parse(payloadCodec.serialize(raw));
  }
  function seededRandom(seed) {
    let state = seed | 0 || 1;
    return () => {
      state = state + 1831565813 | 0;
      let t = Math.imul(state ^ state >>> 15, 1 | state);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var AQUARELLE_TOOL_SET = /* @__PURE__ */ new Set(["brush", "water", "pen", "lift"]);
  function asTool(raw) {
    return AQUARELLE_TOOL_SET.has(raw) ? raw : "brush";
  }
  function resolveStrokeWidthFactors(payload, pts) {
    const anchors = payload.anchors;
    if (anchors === void 0 || anchors.length === 0) return null;
    if (isUniformWidthProfile(anchors)) return null;
    return Float32Array.from(sampleVectorWidths(anchors, pts));
  }
  function resolveStrokeBaseColor(stroke) {
    const hex = stroke.color ?? stroke.engine.color;
    return typeof hex === "string" && hex.length > 0 ? hex : null;
  }
  function resolveStrokeColors(stroke, pts) {
    const anchors = stroke.engine.anchors;
    if (anchors === void 0 || anchors.length === 0) return null;
    if (isUniformColorProfile(anchors)) return null;
    const base = resolveStrokeBaseColor(stroke);
    if (base === null) return null;
    return sampleVectorColors(anchors, pts, base).map((hex) => pigmentFromHex(hex));
  }
  function createAquarelleEngineAdapter(options = {}) {
    const engineId = "efx-watercolor";
    const strokes = [];
    const width = Math.max(1, Math.trunc(options.width ?? 0));
    const height = Math.max(1, Math.trunc(options.height ?? 0));
    let disposed = false;
    const canvas = options.canvas ?? (typeof document !== "undefined" ? document.createElement("canvas") : null);
    if (canvas && width > 0 && height > 0) {
      canvas.width = width;
      canvas.height = height;
    }
    let engine = null;
    if (canvas) {
      try {
        engine = new WatercolorEngine(canvas, null, {}, width > 0 && height > 0 ? [width, height] : null);
        engine.setManual(true);
      } catch {
        engine = null;
      }
    }
    let virtualNow = 0;
    const advanceClock = (ms) => {
      virtualNow += ms;
    };
    engine?.setClock(() => virtualNow);
    engine?.setRandom(seededRandom(1));
    let paintSeedFrame = null;
    const applyPaper = (paper, preset) => {
      if (!engine) return;
      const resolved = preset ?? resolveBakePaperPreset(paper, options.paperPreset);
      if (resolved) engine.setPaper(resolved);
      const strength = paper?.grainStrength;
      if (typeof strength === "number" && Number.isFinite(strength)) {
        engine.paperTexture = strength < 0 ? 0 : strength > 1 ? 1 : strength;
      }
    };
    applyPaper(void 0, options.paperPreset);
    if (typeof options.paperStrength === "number" && engine) {
      engine.paperTexture = options.paperStrength < 0 ? 0 : options.paperStrength > 1 ? 1 : options.paperStrength;
    }
    let active = null;
    const feedStates = /* @__PURE__ */ new Map();
    const configure = (stroke) => {
      if (!engine) return;
      const payload = stroke.engine;
      const tool = asTool(payload.tool);
      engine.setParams(toEngineParams(payload.params));
      engine.setBrush(
        buildBrushForStroke(payload.brushId ?? stroke.brushId, {
          // quick-261115-oh9: the texture axis rides the opaque engine slot.
          // Absent stays absent — the response's own tip is stamped. A LIFT
          // never carries one (the eraser has no texture, and the punch erased
          // the response tip): a persisted lift+texture pair — an earlier build
          // wrote them — replays as the response tip instead of erasing a
          // silhouette the punch never removed.
          textureId: tool === "lift" ? null : payload.textureId ?? null,
          // quick 261116-inu: the STROKE snapshot is the rotation authority at
          // replay — never the library row (which the bake cannot read). A
          // textureless or lift stroke carries no rotation; a textured stroke
          // with no recorded value stamps the 0-degree default.
          textureRotation: tool === "lift" ? null : payload.textureRotation ?? null,
          overrides: payload.toolOverrides ?? stroke.toolOverrides
        })
      );
      const hex = resolveStrokeBaseColor(stroke);
      if (hex !== null) engine.setPigment(pigmentFromHex(hex));
      engine.setTool(tool);
      engine.setRandom(
        seededRandom(
          paintSeedFrame === null ? stroke.traceSeed || 1 : mixStrokeSeed(stroke.traceSeed || 1, paintSeedFrame)
        )
      );
    };
    const applyDry = () => {
      if (!engine) return;
      engine.fix();
      for (let i = 0; i < 30; i += 1) {
        advanceClock(1e3 * HOST_DT);
        engine.tick(HOST_DT);
      }
    };
    const feedDueSample = (maxCount) => {
      if (!engine || !active) return;
      const pts = active.stroke.pts;
      const count = Math.max(0, Math.trunc(maxCount));
      while (active.index < pts.length && active.index < count) {
        const p = pts[active.index];
        const widthFactor = active.widths === null ? 1 : active.widths[active.index] ?? 1;
        const samplePigment = active.colors === null ? void 0 : active.colors[active.index];
        active.index += 1;
        advanceClock(1e3 * HOST_DT);
        if (!active.started) {
          active.started = true;
          engine.scriptBegin(
            asTool(active.stroke.engine.tool),
            p.x,
            p.y,
            p.p,
            "Stroke",
            void 0,
            p.tx,
            p.ty,
            widthFactor,
            samplePigment
          );
        } else {
          engine.scriptMove(p.x, p.y, p.p, virtualNow, p.tx, p.ty, widthFactor, samplePigment);
        }
        engine.tick(HOST_DT);
      }
      if (active.index >= pts.length && active.started) {
        engine.scriptEnd();
      }
    };
    return {
      engineId,
      // 261017-fz3: the bake calls setPaper before the first applyStroke (the
      // EngineAdapter interface has no paper seam — optional extension).
      setPaper(paper) {
        applyPaper(paper);
      },
      // 261019: the bake's final frame steps until this gate closes — the same
      // settled state the live sheet (and its cache capture) reaches.
      isAwake() {
        return engine?.isAwake ?? false;
      },
      // 261019c: the live sheet force-dries at the visible settle cap; the bake
      // runs the same fix so the end key keeps the artist's denser look.
      fix() {
        engine?.fix();
      },
      // 261029-bks: clock-only advance for an idle gap the bake proved asleep.
      // The guard is the exact `stepTick` law — it must precede every clock add,
      // so a disposed adapter's clock can never drift from a no-skip run. One
      // `advanceClock` per tick (never a single multiply) keeps the virtual clock
      // bit-identical to per-tick stepping.
      skipTicks(fromTick, toTick) {
        if (disposed || !engine) return;
        if (!(toTick > fromTick)) return;
        let remaining = toTick - fromTick;
        while (remaining > 0) {
          advanceClock(1e3 * HOST_DT);
          remaining -= 1;
        }
      },
      // 261030-v1t: the per-frame paint salt + the sheet reset that makes a
      // from-scratch replay start on the same naked paper. Both are optional
      // EXTENSION seams — the host EngineAdapter interface is unchanged.
      setPaintSeedFrame(frame) {
        paintSeedFrame = typeof frame === "number" && Number.isFinite(frame) ? Math.max(0, Math.trunc(frame)) : null;
      },
      resetSheet() {
        if (disposed || !engine) return;
        engine.resetSheet();
        virtualNow = 0;
        active = null;
        feedStates.clear();
        strokes.length = 0;
        engine.setRandom(seededRandom(1));
      },
      // The 56-06 codec covers the one payload union (strokes + Dry).
      // The host EngineAdapter type is stroke-shaped because the host
      // never reads P and never sees Dry — cast through unknown at this
      // seam only (T-56-17: host never inspects the engine slot).
      payloadCodec: {
        serialize: (raw) => payloadCodec.serialize(raw),
        parse: (raw) => payloadCodec.parse(raw)
      },
      setInputLocked(_locked) {
      },
      setAnimationMode(_mode) {
      },
      getStrokes() {
        return strokes;
      },
      applyStroke(stroke) {
        if (disposed) return;
        if (isAquarelleDryEvent(stroke)) {
          applyDry();
          return;
        }
        const parsed = acceptEvent(stroke);
        if (!parsed || isAquarelleDryEvent(parsed)) return;
        strokes.push(parsed);
        if (!engine) return;
        configure(parsed);
        active = {
          stroke: parsed,
          index: 0,
          started: false,
          widths: resolveStrokeWidthFactors(parsed.engine, parsed.pts),
          colors: resolveStrokeColors(parsed, parsed.pts)
        };
        feedDueSample(Number.MAX_SAFE_INTEGER);
        advanceClock(1e3 * HOST_DT);
        engine.tick(HOST_DT);
        active = null;
      },
      renderAllStrokes() {
        if (disposed || !engine) return;
        for (const stroke of strokes) {
          configure(stroke);
          active = {
            stroke,
            index: 0,
            started: false,
            widths: resolveStrokeWidthFactors(stroke.engine, stroke.pts),
            colors: resolveStrokeColors(stroke, stroke.pts)
          };
          feedDueSample(Number.MAX_SAFE_INTEGER);
          advanceClock(1e3 * HOST_DT);
          engine.tick(HOST_DT);
        }
        active = null;
      },
      exportCompositeCanvas() {
        const out = engine?.exportCanvas("transparent") ?? canvas;
        if (!out) throw new Error("createAquarelleEngineAdapter: no canvas to export \u2014 pass options.canvas");
        return out;
      },
      renderPartialStrokes(strokeData) {
        if (disposed || !engine) return;
        for (const entry of strokeData) {
          const { stroke, pointCount } = entry;
          let state = feedStates.get(stroke);
          if (!state) {
            state = {
              index: 0,
              started: false,
              ended: false,
              widths: resolveStrokeWidthFactors(stroke.engine, stroke.pts),
              colors: resolveStrokeColors(stroke, stroke.pts)
            };
            feedStates.set(stroke, state);
            strokes.push(stroke);
          }
          if (state.ended) continue;
          if (active && active.stroke !== stroke) continue;
          if (!state.started) configure(stroke);
          const cursor = {
            stroke,
            index: state.index,
            started: state.started,
            widths: state.widths,
            colors: state.colors
          };
          active = cursor;
          feedDueSample(pointCount);
          state.index = cursor.index;
          state.started = cursor.started;
          if (state.index >= stroke.pts.length) {
            state.ended = true;
            active = null;
          }
        }
      },
      stepTick(_tick) {
        if (disposed || !engine) return;
        advanceClock(1e3 * HOST_DT);
        engine.tick(HOST_DT);
      },
      captureFrame() {
        const frame = engine?.exportCanvas("transparent") ?? canvas;
        if (!frame) throw new Error("createAquarelleEngineAdapter: no canvas to capture \u2014 pass options.canvas");
        return frame;
      },
      dispose() {
        disposed = true;
        strokes.length = 0;
        active = null;
        engine?.destroy();
        engine = null;
      }
    };
  }

  // packages/efx-paint-host/dist/animation.mjs
  function buildProgressiveStrokeSchedule(strokes, frameCount) {
    const usableFrames = Math.max(1, Math.trunc(frameCount));
    if (strokes.length === 0) return [];
    const scheduledStrokes = orderStrokesForPlayback(strokes, usableFrames);
    const sourceAnchors = new Map(strokes.map((stroke) => [stroke, getPlayFrameAnchor(stroke, usableFrames)]));
    if (scheduledStrokes.length > usableFrames) {
      for (const scheduledStroke of scheduledStrokes) {
        if (scheduledStroke.playFrameAnchor === null) {
          scheduledStroke.playFrameAnchor = sourceAnchors.get(scheduledStroke.stroke) ?? null;
        }
      }
      return scheduledStrokes.map(({ stroke, playFrameAnchor }, index) => {
        const startFrame = playFrameAnchor ?? Math.min(usableFrames - 1, Math.floor(index * (usableFrames + 1) / scheduledStrokes.length));
        const endFrame = playFrameAnchor === null ? startFrame : usableFrames - 1;
        const pointsPerFrame = Math.max(1, Math.ceil(stroke.pts.length / Math.max(1, endFrame - startFrame + 1)));
        return { stroke, startFrame, endFrame, pointsPerFrame };
      });
    }
    const weights = scheduledStrokes.map(({ stroke }) => Math.max(1, stroke.pts.length));
    const remainingWeights = new Array(scheduledStrokes.length);
    let runningWeight = 0;
    for (let index = scheduledStrokes.length - 1; index >= 0; index -= 1) {
      runningWeight += weights[index];
      remainingWeights[index] = runningWeight;
    }
    let allocatedFrames = 0;
    const playFrameCursors = /* @__PURE__ */ new Map();
    return scheduledStrokes.map(({ stroke, playFrameAnchor }, index) => {
      const remainingStrokeCount = scheduledStrokes.length - index;
      const latestStartFrame = playFrameAnchor === null ? usableFrames - 1 : Math.max(0, usableFrames - remainingStrokeCount);
      const requestedStartFrame = playFrameAnchor === null ? allocatedFrames : playFrameCursors.get(playFrameAnchor) ?? playFrameAnchor;
      const startFrame = Math.min(usableFrames - 1, Math.min(requestedStartFrame, latestStartFrame));
      const remainingFrames = Math.max(1, usableFrames - startFrame);
      const remainingFrameBudget = playFrameAnchor === null ? Math.max(1, usableFrames - allocatedFrames) : remainingFrames;
      const weightedExactFrames = weights[index] / Math.max(1, remainingWeights[index]) * remainingFrameBudget;
      let frameSpan = Math.max(1, Math.floor(weightedExactFrames));
      if (index === scheduledStrokes.length - 1) {
        frameSpan = remainingFrames;
      } else if (playFrameAnchor !== null) {
        const laterStrokeCount = scheduledStrokes.length - index - 1;
        const maxSpanBeforeLaterStrokes = Math.max(1, remainingFrames - laterStrokeCount);
        frameSpan = Math.min(frameSpan, maxSpanBeforeLaterStrokes);
      }
      const endFrame = Math.min(usableFrames - 1, startFrame + frameSpan - 1);
      allocatedFrames = Math.max(allocatedFrames, endFrame + 1);
      if (playFrameAnchor !== null) playFrameCursors.set(playFrameAnchor, endFrame + 1);
      const pointsPerFrame = Math.max(1, Math.ceil(stroke.pts.length / Math.max(1, endFrame - startFrame + 1)));
      return { stroke, startFrame, endFrame, pointsPerFrame };
    });
  }
  function getProgressiveFrameStrokes(schedule2, frameIndex, transform) {
    const finalFrame = schedule2.length > 0 && frameIndex >= Math.max(...schedule2.map((entry) => entry.endFrame));
    const strokes = [];
    for (let strokeIndex = 0; strokeIndex < schedule2.length; strokeIndex += 1) {
      const entry = schedule2[strokeIndex];
      if (entry.startFrame > frameIndex) continue;
      const complete = finalFrame || entry.endFrame < frameIndex;
      const framesIntoStroke = frameIndex - entry.startFrame + 1;
      const pointCount = complete ? entry.stroke.pts.length : Math.min(entry.stroke.pts.length, entry.pointsPerFrame * framesIntoStroke);
      strokes.push({
        stroke: transform?.(entry.stroke, frameIndex, strokeIndex) ?? entry.stroke,
        pointCount
      });
    }
    return strokes;
  }
  function orderStrokesForPlayback(strokes, usableFrames) {
    const scheduled = strokes.map((stroke, sourceIndex) => ({ stroke, sourceIndex, playFrameAnchor: getPlayFrameAnchor(stroke, usableFrames) }));
    const orderedByRecording = [...scheduled].sort(compareAnchoredPlaybackOrder);
    if (!hasSourceOrderInsertion(scheduled)) return orderedByRecording.map(({ stroke, playFrameAnchor }) => ({ stroke, playFrameAnchor }));
    const insertedSourceStart = getInsertedSourceStart(scheduled);
    const base = scheduled.filter(({ sourceIndex }) => sourceIndex < insertedSourceStart).sort(compareAnchoredPlaybackOrder);
    if (base.length === 0) return orderedByRecording.map(({ stroke, playFrameAnchor }) => ({ stroke, playFrameAnchor }));
    const playbackOrder = [...base];
    const appended = scheduled.filter(({ sourceIndex }) => sourceIndex >= insertedSourceStart).sort(comparePlayFrameInsertionOrder);
    const insertedByTarget = /* @__PURE__ */ new Map();
    for (const inserted of appended) {
      const targetIndex = getInsertionTargetIndex(inserted, playbackOrder, usableFrames);
      const offset = inserted.playFrameAnchor === null ? 0 : insertedByTarget.get(targetIndex) ?? 0;
      playbackOrder.splice(targetIndex + offset, 0, inserted);
      if (inserted.playFrameAnchor !== null) insertedByTarget.set(targetIndex, offset + 1);
    }
    return playbackOrder.map(({ stroke }) => ({ stroke, playFrameAnchor: null }));
  }
  function hasSourceOrderInsertion(scheduled) {
    return scheduled.some(({ sourceIndex, playFrameAnchor }) => playFrameAnchor !== null && playFrameAnchor > 0 && sourceIndex > playFrameAnchor);
  }
  function getInsertedSourceStart(scheduled) {
    return scheduled.find(({ sourceIndex, playFrameAnchor }) => playFrameAnchor !== null && playFrameAnchor > 0 && sourceIndex > playFrameAnchor)?.sourceIndex ?? scheduled.length;
  }
  function compareAnchoredPlaybackOrder(a, b) {
    return compareStrokeRecordingTime(a, b) || comparePlayFrameAnchor(a, b);
  }
  function comparePlayFrameAnchor(a, b) {
    return (a.playFrameAnchor ?? Number.POSITIVE_INFINITY) - (b.playFrameAnchor ?? Number.POSITIVE_INFINITY);
  }
  function comparePlayFrameInsertionOrder(a, b) {
    return comparePlayFrameAnchor(a, b) || compareStrokeRecordingTime(a, b);
  }
  function compareStrokeRecordingTime(a, b) {
    const aTime = Number.isFinite(a.stroke.recordedOrder) ? a.stroke.recordedOrder : a.sourceIndex;
    const bTime = Number.isFinite(b.stroke.recordedOrder) ? b.stroke.recordedOrder : b.sourceIndex;
    return aTime - bTime || a.sourceIndex - b.sourceIndex;
  }
  function getInsertionTargetIndex(inserted, playbackOrder, usableFrames) {
    if (inserted.playFrameAnchor !== null) return Math.min(inserted.playFrameAnchor, playbackOrder.length);
    const timestampTarget = playbackOrder.findIndex((candidate) => compareStrokeRecordingTime(inserted, candidate) < 0);
    return timestampTarget === -1 ? playbackOrder.length : Math.min(timestampTarget, usableFrames);
  }
  function getPlayFrameAnchor(stroke, usableFrames) {
    if (!Number.isInteger(stroke.playFrame) || stroke.playFrame === null || stroke.playFrame < 0) return null;
    return Math.min(usableFrames - 1, stroke.playFrame);
  }

  // packages/efx-watercolor/src/bake/aquarelleBake.ts
  function clampCuisson(raw) {
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return 0;
    return Math.min(DIFFUSION_CAP, Math.trunc(raw));
  }
  function aquarelleVisibleSettleTicks(dryPercent) {
    const dry = typeof dryPercent === "number" && Number.isFinite(dryPercent) ? Math.max(0, Math.min(100, dryPercent)) : 50;
    return Math.round(30 + 270 * (1 - dry / 100));
  }
  var FIX_SETTLE_TICKS = Math.round(1.2 * 60);
  var HOST_TICK_MS = 1e3 / 60;
  var SETTLE_MAX_TICKS = 3600;
  function pointTickAt(stroke, index) {
    const tick = stroke.pts[index]?.tick;
    return typeof tick === "number" && Number.isFinite(tick) && tick >= 0 ? Math.trunc(tick) : index;
  }
  function readSize(frame) {
    const carrier = frame;
    return { width: carrier.width ?? 0, height: carrier.height ?? 0 };
  }
  function yieldToHost() {
    if (typeof MessageChannel === "function") {
      return new Promise((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
          channel.port1.close();
          channel.port2.close();
          resolve();
        };
        channel.port2.postMessage(0);
      });
    }
    return new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
  function readNow() {
    return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  }
  async function defaultEncodeWebp(frame) {
    const carrier = frame;
    if (typeof carrier.toDataURL !== "function") {
      throw new Error("createAquarelleBake: no WebP encoder available \u2014 pass options.encodeWebp");
    }
    const dataUrl = carrier.toDataURL("image/webp");
    const comma = dataUrl.indexOf(",");
    const binary = atob(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  function createAquarelleBake(adapter, options = {}) {
    const host = createBakeHost({
      concurrency: Math.max(1, Math.floor(options.concurrency ?? BAKE_TURN_CONCURRENCY))
    });
    const encodeWebp = options.encodeWebp ?? ((frame) => defaultEncodeWebp(frame));
    const onCommit = options.onCommit;
    const countedStep = (d) => (tick) => {
      d.simulatedTicks += 1;
      adapter.stepTick(tick);
    };
    const emitDiagnostics = (d, startedAt) => {
      d.bakeMs = readNow() - startedAt;
      const consumer = options.onDiagnostics;
      if (!consumer) return;
      try {
        consumer(d);
      } catch {
      }
    };
    let adapterChain = Promise.resolve();
    const scheduleAdapter = (work) => {
      const run = adapterChain.then(work);
      adapterChain = run.then(
        () => void 0,
        () => void 0
      );
      return run;
    };
    let sharedFlush = null;
    const buildRecordedTimeline = (strokes) => {
      if (strokes.length === 0) return null;
      const entries = [];
      let originMs = null;
      let previousEnd = 0;
      for (const stroke of strokes) {
        const endMs = stroke.recordedOrder;
        if (typeof endMs !== "number" || !Number.isFinite(endMs) || endMs <= 0) return null;
        const durationTicks = Math.max(1, Math.trunc(stroke.ticks));
        if (originMs === null) originMs = endMs - durationTicks * HOST_TICK_MS;
        const rawBegin = Math.round((endMs - durationTicks * HOST_TICK_MS - originMs) / HOST_TICK_MS);
        if (!Number.isFinite(rawBegin)) return null;
        const beginTick = Math.max(previousEnd, Math.max(0, rawBegin));
        entries.push({ stroke, beginTick, endTick: beginTick + durationTicks });
        previousEnd = beginTick + durationTicks;
      }
      return entries;
    };
    const bakeProgressive = async (events, frameCount, diagnostics) => {
      const frames = [];
      const outcomes = [];
      let commitBarrier = Promise.resolve();
      const frameSpan = Math.max(1, Math.trunc(frameCount));
      const seams = adapter;
      const variation = options.paintSeedVariation ?? null;
      if (variation !== null && (typeof seams.setPaintSeedFrame !== "function" || typeof seams.resetSheet !== "function")) {
        return { ok: false, reason: "failed" };
      }
      if (options.paper) {
        const paper = options.paper;
        void scheduleAdapter(() => {
          const seam = adapter;
          seam.setPaper?.(paper);
        });
      }
      const strokes = [];
      for (const event of events) {
        if (!isAquarelleDryEvent(event)) strokes.push(event);
      }
      const timedBase = buildRecordedTimeline(strokes);
      diagnostics.path = timedBase ? "timed" : "fallback";
      const schedule2 = timedBase ? [] : buildProgressiveStrokeSchedule(strokes, frameSpan);
      const canSkip = typeof seams.skipTicks === "function" && typeof seams.isAwake === "function";
      const stepTimeline = countedStep(diagnostics);
      function stepGap(fromTick, toTick) {
        if (toTick <= fromTick) return;
        diagnostics.gapCount += 1;
        let tick = fromTick;
        while (tick < toTick) {
          if (canSkip && !seams.isAwake()) {
            stepTimeline(tick);
            tick += 1;
            if (tick >= toTick) return;
            if (!seams.isAwake()) {
              const skipFrom = tick;
              seams.skipTicks(skipFrom, toTick);
              diagnostics.skippedGapTicks += toTick - skipFrom;
              tick = toTick;
            }
            continue;
          }
          stepTimeline(tick);
          tick += 1;
        }
      }
      const onStrokeFed = options.onStrokeFed;
      const fedStrokes = /* @__PURE__ */ new Set();
      let fedStrokeCount = 0;
      const strokeTotal = strokes.length;
      const reportFed = async (stroke, report) => {
        if (!onStrokeFed || !report || fedStrokes.has(stroke)) return;
        fedStrokes.add(stroke);
        fedStrokeCount += 1;
        onStrokeFed(fedStrokeCount, strokeTotal);
        if (frameSpan === 1 && fedStrokeCount < strokeTotal) await yieldToHost();
      };
      const sampleTicks = [];
      if (timedBase) {
        for (const entry of timedBase) {
          for (let index = 0; index < entry.stroke.pts.length; index += 1) {
            sampleTicks.push(entry.beginTick + pointTickAt(entry.stroke, index));
          }
        }
      }
      const drawFrameSpan = Math.max(1, frameSpan - 1);
      const startFrameOf = /* @__PURE__ */ new Map();
      const timed3 = timedBase;
      let timelineEnd = 0;
      let settleCapped = false;
      if (timedBase) {
        const lastEntry = timedBase[timedBase.length - 1];
        const lastStrokeDry = lastEntry.stroke.engine?.params?.dry;
        const settleCap = aquarelleVisibleSettleTicks(typeof lastStrokeDry === "number" ? lastStrokeDry : 50);
        const rawSettle = clampCuisson(
          lastEntry.stroke.cuisson || lastEntry.stroke.engine?.diffusionFrames
        );
        settleCapped = rawSettle <= 0 || rawSettle >= settleCap;
        const settleEstimate = Math.min(rawSettle || settleCap, settleCap);
        timelineEnd = Math.max(
          1,
          lastEntry.endTick + settleEstimate,
          lastEntry.beginTick + pointTickAt(
            lastEntry.stroke,
            Math.max(0, lastEntry.stroke.pts.length - 1)
          ) + 1
        );
        const frameForTick = (tick) => Math.max(0, Math.min(
          frameSpan - 1,
          Math.ceil(tick * frameSpan / timelineEnd) - 1
        ));
        for (const entry of timedBase) startFrameOf.set(entry.stroke, frameForTick(entry.beginTick));
      } else {
        for (const entry of schedule2) startFrameOf.set(entry.stroke, entry.startFrame);
      }
      const firstFedFrameOf = /* @__PURE__ */ new Map();
      const drysByFrame = /* @__PURE__ */ new Map();
      const drysBeforeStroke = /* @__PURE__ */ new Map();
      const trailingDrys = [];
      let pendingDrys = [];
      for (const event of events) {
        if (isAquarelleDryEvent(event)) {
          pendingDrys.push(event);
          continue;
        }
        const stroke = event;
        if (timed3) {
          if (pendingDrys.length > 0) {
            drysBeforeStroke.set(stroke, pendingDrys);
            pendingDrys = [];
          }
          continue;
        }
        const frame = startFrameOf.get(stroke);
        if (frame !== void 0 && pendingDrys.length > 0) {
          const list = drysByFrame.get(frame) ?? [];
          list.push(...pendingDrys);
          drysByFrame.set(frame, list);
          pendingDrys = [];
        }
      }
      if (pendingDrys.length > 0) {
        if (timed3) trailingDrys.push(...pendingDrys);
        else {
          const frame = Math.max(0, frameSpan - 1);
          const list = drysByFrame.get(frame) ?? [];
          list.push(...pendingDrys);
          drysByFrame.set(frame, list);
        }
      }
      let totalCuisson = 0;
      for (const stroke of strokes) {
        totalCuisson += clampCuisson(
          stroke.cuisson || stroke.engine?.diffusionFrames
        );
      }
      const diffusionPerFrame = Math.max(1, Math.ceil(totalCuisson / frameSpan));
      const lastStroke = strokes[strokes.length - 1];
      const lastStrokeCuisson = lastStroke ? clampCuisson(
        lastStroke.cuisson || lastStroke.engine?.diffusionFrames
      ) : 0;
      const lastStrokeStart = lastStroke ? startFrameOf.get(lastStroke) ?? 0 : 0;
      const lastStrokeCatchUp = Math.max(
        0,
        lastStrokeCuisson - diffusionPerFrame * (frameSpan - lastStrokeStart)
      );
      const windows = [];
      {
        let previousWindowEnd = 0;
        for (let frameIndex = 0; frameIndex < frameSpan; frameIndex += 1) {
          const isFinalFrame = frameIndex === frameSpan - 1;
          const windowStart = previousWindowEnd;
          let frameStrokes = [];
          let tickBudget = 0;
          let windowEnd = previousWindowEnd;
          if (timed3) {
            if (isFinalFrame || sampleTicks.length === 0) {
              windowEnd = isFinalFrame ? Math.max(previousWindowEnd, timelineEnd) : Math.max(previousWindowEnd, Math.round((frameIndex + 1) * timelineEnd / frameSpan));
            } else {
              const target = Math.min(
                sampleTicks.length,
                Math.max(1, Math.ceil((frameIndex + 1) / drawFrameSpan * sampleTicks.length))
              );
              windowEnd = Math.min(timelineEnd, Math.max(previousWindowEnd, sampleTicks[target - 1] + 1));
            }
            tickBudget = Math.max(0, windowEnd - previousWindowEnd);
            previousWindowEnd = windowEnd;
          } else {
            frameStrokes = getProgressiveFrameStrokes(schedule2, frameIndex);
            tickBudget = isFinalFrame ? diffusionPerFrame + lastStrokeCatchUp : diffusionPerFrame;
          }
          windows.push({ windowStart, windowEnd, tickBudget, frameStrokes });
          if (timed3) {
            for (const entry of timed3) {
              if (entry.beginTick >= windowEnd) break;
              if (!firstFedFrameOf.has(entry.stroke)) firstFedFrameOf.set(entry.stroke, frameIndex);
            }
          } else {
            for (const entry of frameStrokes) {
              if (!firstFedFrameOf.has(entry.stroke)) firstFedFrameOf.set(entry.stroke, frameIndex);
            }
          }
        }
      }
      const fedCounts = /* @__PURE__ */ new Map();
      const walkWindow = async (frameIndex, window2, state) => {
        diagnostics.timelineTicks += window2.tickBudget;
        if (timed3) {
          let cursor = state.cursor;
          for (const entry of timed3) {
            if (entry.beginTick > window2.windowEnd) break;
            const pts = entry.stroke.pts;
            const fed = state.fedCounts.get(entry.stroke) ?? 0;
            if (pts.length === 0) {
              await reportFed(entry.stroke, state.report);
              continue;
            }
            const windowDelta = window2.windowEnd - entry.beginTick;
            let pointCount = fed;
            while (pointCount < pts.length && pointTickAt(entry.stroke, pointCount) < windowDelta) {
              pointCount += 1;
            }
            if (pointCount <= fed) continue;
            const firstTick = entry.beginTick + pointTickAt(entry.stroke, fed);
            stepGap(cursor, firstTick);
            if (fed === 0) {
              for (const dry of drysBeforeStroke.get(entry.stroke) ?? []) {
                adapter.applyStroke(dry);
              }
            }
            adapter.renderPartialStrokes([{ stroke: entry.stroke, pointCount }]);
            cursor = entry.beginTick + pointTickAt(entry.stroke, pointCount - 1) + 1;
            state.fedCounts.set(entry.stroke, pointCount);
            if (pointCount >= pts.length) await reportFed(entry.stroke, state.report);
          }
          if (frameIndex === frameSpan - 1 && trailingDrys.length > 0) {
            stepGap(cursor, window2.windowEnd);
            cursor = window2.windowEnd;
            for (const dry of trailingDrys) {
              adapter.applyStroke(dry);
            }
          }
          stepGap(cursor, window2.windowEnd);
          state.cursor = cursor;
        } else {
          for (const dry of drysByFrame.get(frameIndex) ?? []) {
            adapter.applyStroke(dry);
          }
          adapter.renderPartialStrokes(
            window2.frameStrokes
          );
          for (const entry of window2.frameStrokes) {
            if (entry.pointCount >= entry.stroke.pts.length) await reportFed(entry.stroke, state.report);
          }
          for (let tick = 0; tick < window2.tickBudget; tick += 1) {
            stepTimeline(tick);
          }
        }
      };
      const applySettle = () => {
        const fixSeam = seams.fix;
        if (settleCapped && typeof fixSeam === "function") {
          fixSeam.call(adapter);
          for (let tick = 0; tick < FIX_SETTLE_TICKS; tick += 1) {
            stepTimeline(tick);
            diagnostics.settleTicks += 1;
          }
        } else if (typeof seams.isAwake === "function") {
          const awake = seams.isAwake;
          for (let guard = 0; guard < SETTLE_MAX_TICKS && awake(); guard += 1) {
            stepTimeline(guard);
            diagnostics.settleTicks += 1;
          }
        }
      };
      for (let frameIndex = 0; frameIndex < frameSpan; frameIndex += 1) {
        const isFinalFrame = frameIndex === frameSpan - 1;
        const window2 = windows[frameIndex];
        let tickBudget = window2.tickBudget;
        if (variation === "progressive") {
          tickBudget = 0;
          for (let w = 0; w <= frameIndex; w += 1) tickBudget += windows[w].tickBudget;
        } else if (variation === "static") {
          tickBudget = windows.reduce((total, w) => total + w.tickBudget, 0);
        }
        const framePromise = scheduleAdapter(async () => {
          if (variation === null) {
            const state2 = { cursor: window2.windowStart, fedCounts, report: true };
            await walkWindow(frameIndex, window2, state2);
            if (isFinalFrame) applySettle();
            return adapter.captureFrame();
          }
          const lastWindow = variation === "static" ? frameSpan - 1 : frameIndex;
          if (frameIndex > 0) seams.resetSheet();
          seams.setPaintSeedFrame(frameIndex);
          diagnostics.paintSeedReplays += 1;
          const state = {
            cursor: 0,
            fedCounts: /* @__PURE__ */ new Map(),
            // Progress reports only from the final replay (monotonic, <= total).
            report: isFinalFrame
          };
          for (let w = 0; w <= lastWindow; w += 1) await walkWindow(w, windows[w], state);
          if (variation === "static" || isFinalFrame) applySettle();
          return adapter.captureFrame();
        });
        const myBarrier = commitBarrier;
        let releaseBarrier;
        commitBarrier = new Promise((resolve) => {
          releaseBarrier = resolve;
        });
        const outcome = host.submit({
          mode: "flush-survives-navigation",
          produce: async () => {
            const captured = await framePromise;
            const frame = options.poseFrame ? options.poseFrame(captured, frameIndex) : captured;
            const fallback = readSize(frame);
            const width = options.width ?? fallback.width;
            const height = options.height ?? fallback.height;
            const encodeStartedAt = readNow();
            const bytes = await encodeWebp(frame, width, height);
            diagnostics.encodeMs += readNow() - encodeStartedAt;
            return {
              eventIndex: frameIndex,
              strokeIndex: frameIndex,
              tick: tickBudget,
              bytes,
              width,
              height
            };
          },
          commit: (value) => myBarrier.then(() => {
            frames.push(value);
            onCommit?.(value);
            return true;
          })
        });
        void outcome.then(
          () => releaseBarrier(),
          () => releaseBarrier()
        );
        outcomes.push(outcome);
      }
      if (options.onStrokeFrameAnchors) {
        try {
          options.onStrokeFrameAnchors(strokes.map((stroke) => ({
            stroke,
            startFrame: firstFedFrameOf.get(stroke) ?? startFrameOf.get(stroke) ?? 0
          })));
        } catch {
        }
      }
      const settled = await Promise.all(outcomes);
      await adapterChain;
      if (settled.some((o) => o === "cancelled" || o === "stale")) {
        return { ok: false, reason: "cancelled" };
      }
      if (settled.some((o) => o === "failed" || o === "rejected")) {
        return { ok: false, reason: "failed" };
      }
      return { ok: true, frames };
    };
    const flush2 = () => {
      if (sharedFlush) return sharedFlush;
      sharedFlush = (async () => {
        const release = host.beginFlush();
        try {
          await host.drain();
        } finally {
          release();
        }
      })().finally(() => {
        sharedFlush = null;
      });
      return sharedFlush;
    };
    const bake = async (events) => {
      const startedAt = readNow();
      const diagnostics = {
        path: "legacy",
        timelineTicks: 0,
        simulatedTicks: 0,
        skippedGapTicks: 0,
        gapCount: 0,
        settleTicks: 0,
        bakeMs: 0,
        encodeMs: 0,
        paintSeedReplays: 0
      };
      const stepTimeline = countedStep(diagnostics);
      try {
        if (options.paintSeedVariation && !(options.frameCount && options.frameCount > 0)) {
          return { ok: false, reason: "failed" };
        }
        if (options.frameCount && options.frameCount > 0) {
          return await bakeProgressive(events, Math.floor(options.frameCount), diagnostics);
        }
        const frames = [];
        const outcomes = [];
        let commitBarrier = Promise.resolve();
        let strokeIndex = 0;
        if (options.paper) {
          const paper = options.paper;
          void scheduleAdapter(() => {
            const seam = adapter;
            seam.setPaper?.(paper);
          });
        }
        for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
          const event = events[eventIndex];
          if (!event) continue;
          if (isAquarelleDryEvent(event)) {
            void scheduleAdapter(() => {
              adapter.applyStroke(event);
            });
            continue;
          }
          const stroke = event;
          const myStrokeIndex = strokeIndex;
          strokeIndex += 1;
          const cuisson = clampCuisson(
            stroke.cuisson || stroke.engine?.diffusionFrames
          );
          const framePromise = scheduleAdapter(() => {
            adapter.applyStroke(stroke);
            diagnostics.timelineTicks += cuisson;
            for (let tick = 0; tick < cuisson; tick += 1) {
              stepTimeline(tick);
            }
            return adapter.captureFrame();
          });
          const myBarrier = commitBarrier;
          let releaseBarrier;
          commitBarrier = new Promise((resolve) => {
            releaseBarrier = resolve;
          });
          const outcome = host.submit({
            // AQUA-07 / D-21: long cuisson survives navigation and dispose().
            mode: "flush-survives-navigation",
            produce: async () => {
              const frame = await framePromise;
              const fallback = readSize(frame);
              const width = options.width ?? fallback.width;
              const height = options.height ?? fallback.height;
              const encodeStartedAt = readNow();
              const bytes = await encodeWebp(frame, width, height);
              diagnostics.encodeMs += readNow() - encodeStartedAt;
              return {
                eventIndex,
                strokeIndex: myStrokeIndex,
                tick: cuisson,
                bytes,
                width,
                height
              };
            },
            // Publish IS the commit body — the host's generation-stale guard is
            // what keeps a cancelled/interrupted turn from reaching here (T-56-24).
            commit: (value) => myBarrier.then(() => {
              frames.push(value);
              onCommit?.(value);
              return true;
            })
          });
          void outcome.then(
            () => releaseBarrier(),
            () => releaseBarrier()
          );
          outcomes.push(outcome);
        }
        const settled = await Promise.all(outcomes);
        await adapterChain;
        if (settled.some((o) => o === "cancelled" || o === "stale")) {
          return { ok: false, reason: "cancelled" };
        }
        if (settled.some((o) => o === "failed" || o === "rejected")) {
          return { ok: false, reason: "failed" };
        }
        return { ok: true, frames };
      } finally {
        emitDiagnostics(diagnostics, startedAt);
      }
    };
    return {
      bake,
      flush: flush2,
      beginFlush: () => host.beginFlush(),
      // D-21: dispose() keeps flush-survives-navigation turns running. The
      // navigation escape is beginFlush()/flush(), never an abort.
      dispose: () => host.dispose(),
      interrupt: () => host.interrupt(),
      get inFlight() {
        return host.inFlight;
      }
    };
  }

  // packages/efx-watercolor/probe/ink-parity/apply.ts
  var W = 1080;
  var H = 1080;
  function fetchSync(url) {
    const request3 = new XMLHttpRequest();
    request3.open("GET", url, false);
    request3.overrideMimeType("text/plain; charset=x-user-defined");
    request3.send(null);
    if (request3.status !== 0 && request3.status !== 200) throw new Error(`fetch failed: ${url}`);
    const text = request3.responseText;
    const bytes = new Uint8Array(text.length);
    for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index) & 255;
    return bytes;
  }
  function toEvents(strokes) {
    return strokes.map((stroke) => {
      if (stroke["engine"]?.["kind"] === "dry") {
        return {
          kind: "dry",
          tick: stroke["engine"]["tick"],
          recordedOrder: stroke["engine"]["recordedOrder"]
        };
      }
      return stroke;
    });
  }
  async function webpToPng(bytes) {
    const blob = new Blob([bytes], { type: "image/webp" });
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(bitmap, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;
    let ink = 0;
    let coverage = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = W;
    let maxX = -1;
    let minY = H;
    let maxY = -1;
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const at = (y * W + x) * 4;
        const lum = 0.2126 * data[at] + 0.7152 * data[at + 1] + 0.0722 * data[at + 2];
        const v = 255 - lum;
        ink += v;
        if (lum < 220) {
          coverage += 1;
          sumX += x * v;
          sumY += y * v;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    return {
      png: canvas.toDataURL("image/png"),
      ink: Math.round(ink),
      coverage,
      cx: coverage > 0 ? Math.round(sumX / coverage / 2) : 0,
      cy: coverage > 0 ? Math.round(sumY / coverage / 2) : 0,
      minX,
      maxX,
      minY,
      maxY
    };
  }
  async function runBake(events, options) {
    const adapter = createAquarelleEngineAdapter({
      width: W,
      height: H,
      paperStrength: 0.6
    });
    adapter.setPaper?.({ paperId: "paper/cold-press", grainStrength: 0.6, grainScale: 1 });
    const committed = [];
    let diagnostics = null;
    const bake = createAquarelleBake(adapter, {
      width: W,
      height: H,
      frameCount: options.frameCount,
      ...options.variation ? { paintSeedVariation: options.variation } : {},
      encodeWebp: async (frame, width, height) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(frame, 0, 0, width, height);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.95));
        if (!blob) throw new Error("webp encode failed");
        return new Uint8Array(await blob.arrayBuffer());
      },
      onCommit: (frame) => committed.push(frame.bytes),
      onDiagnostics: (d) => {
        diagnostics = d;
      }
    });
    const result3 = await bake.bake(events);
    bake.dispose();
    adapter.dispose();
    if (!result3.ok) throw new Error(`bake failed: ${result3.reason}`);
    const frames = [];
    for (const bytes of committed) frames.push(await webpToPng(bytes));
    return { frames, diagnostics };
  }
  var TICK = 1e3 / 60;
  async function renderLive(events) {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const engine = new WatercolorEngine(canvas, null, {}, [W, H]);
    engine.setManual(true);
    engine.setPaper(PAPERS[0]);
    engine.paperTexture = 0.6;
    let clock = 0;
    engine.setClock(() => clock);
    const privateEngine = engine;
    const strokes = events.filter((event) => event["kind"] !== "dry");
    let previousEnd = 0;
    for (const event of strokes) {
      const enginePart = event["engine"];
      const duration = Math.max(1, Math.trunc(event["ticks"]));
      const begin = Math.max(previousEnd, 0);
      previousEnd = begin + duration;
      while (clock < begin * TICK) {
        clock += TICK;
        engine.tick(1 / 60);
      }
      engine.setParams(toEngineParams(enginePart["params"]));
      engine.setBrush(buildBrushForStroke(enginePart["brushId"] ?? "round", {
        textureId: enginePart["textureId"] ?? null,
        textureRotation: enginePart["textureRotation"] ?? null,
        overrides: event["toolOverrides"] ?? null
      }));
      engine.setTool(enginePart["tool"] ?? "brush");
      engine.setPigment(pigmentFromHex(event["color"] ?? "#103c65"));
      privateEngine.stroke = {
        pointerId: 1,
        pointerType: "pen",
        tool: enginePart["tool"] ?? "brush",
        started: false,
        ending: false,
        x: 0,
        y: 0,
        cx: 0,
        cy: 0,
        pr: 0,
        t: clock,
        speed: 0,
        simPressure: 0.45,
        carry: 0,
        travelled: 0,
        moved: false,
        dx: 0,
        dy: 0,
        angle: 0,
        azimuth: null,
        widthFrom: 1,
        widthTo: 1,
        pigFrom: null,
        pigTo: null
      };
      const pts = event["pts"];
      let index = 0;
      for (let tick = 0; tick <= duration && index < pts.length; tick += 1) {
        while (index < pts.length && (pts[index]["tick"] ?? index) <= tick) {
          const point = pts[index];
          privateEngine.queue.push({ x: point["x"], y: point["y"], p: point["p"], t: begin * TICK + tick * TICK, tx: point["tx"], ty: point["ty"], w: 1 });
          index += 1;
        }
        clock = (begin + tick + 1) * TICK;
        engine.tick(1 / 60);
      }
      privateEngine.stroke.ending = true;
      clock += TICK;
      engine.tick(1 / 60);
    }
    for (let tick = 0; tick < 72; tick += 1) {
      engine.fix();
      engine.tick(1 / 60);
    }
    const frame = engine.exportCanvas("transparent");
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    const ctx = out.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(frame, 0, 0, W, H);
    engine.destroy();
    const data = ctx.getImageData(0, 0, W, H).data;
    let ink = 0;
    let coverage = 0;
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      ink += 255 - lum;
      if (lum < 220) coverage += 1;
    }
    return { png: out.toDataURL("image/png"), ink: Math.round(ink), coverage };
  }
  function instrumentStamps() {
    const proto = WatercolorEngine.prototype;
    const original = proto["stamp"];
    const calls = [];
    proto["stamp"] = function(s, x, y, pr, _vx, _vy, moving, dt, _wf) {
      const speed = typeof s?.speed === "number" ? s.speed : Number.NaN;
      const r = this.radius(s.tool, pr, speed, _wf);
      calls.push({ x, y, moving, dt, pr, speed, r, angle: s?.angle ?? 0 });
      return original.call(this, s, x, y, pr, _vx, _vy, moving, dt, _wf);
    };
    return { stop: () => {
      proto["stamp"] = original;
      return calls;
    } };
  }
  function summarizeStamps(calls) {
    const moving = calls.filter((call) => call.moving === 1);
    const dwell = calls.filter((call) => call.moving === 0);
    const r = calls.map((call) => call.r);
    const speed = calls.map((call) => call.speed);
    return {
      total: calls.length,
      moving: moving.length,
      dwell: dwell.length,
      r: [Math.min(...r), Math.max(...r)].map((value) => +value.toFixed(4)),
      speed: [Math.min(...speed), Math.max(...speed)].map((value) => +value.toFixed(3)),
      points: calls.slice(0, 12).map((call) => [+call.x.toFixed(4), +call.y.toFixed(4), +call.r.toFixed(4), +call.speed.toFixed(2), call.moving, +call.dt.toFixed(4)])
    };
  }
  async function renderPointerLive(event) {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    canvas.style.display = "block";
    document.body.appendChild(canvas);
    const engine = new WatercolorEngine(canvas, null, {}, [W, H]);
    engine.setManual(true);
    engine.setPaper(PAPERS[0]);
    engine.paperTexture = 0.6;
    let clock = 0;
    engine.setClock(() => clock);
    const enginePart = event["engine"];
    engine.setParams(toEngineParams(enginePart["params"]));
    engine.setBrush(buildBrushForStroke(enginePart["brushId"] ?? "round", {
      textureId: enginePart["textureId"] ?? null,
      textureRotation: enginePart["textureRotation"] ?? null,
      overrides: event["toolOverrides"] ?? null
    }));
    engine.setTool(enginePart["tool"] ?? "brush");
    engine.setPigment(pigmentFromHex(event["color"] ?? "#103c65"));
    const rect = canvas.getBoundingClientRect();
    const pts = event["pts"];
    const duration = Math.max(1, Math.trunc(event["ticks"]));
    const send = (type, point, buttons) => {
      const pressure = point["p"] >= 0 ? Math.pow(point["p"], 1 / 0.8) : 0.5;
      canvas.dispatchEvent(new PointerEvent(type, {
        pointerId: 7,
        pointerType: "pen",
        isPrimary: true,
        buttons,
        pressure,
        tiltX: point["tx"] ?? 0,
        tiltY: point["ty"] ?? 0,
        clientX: rect.left + point["x"] * W,
        clientY: rect.top + (1 - point["y"]) * H,
        bubbles: true,
        cancelable: true
      }));
    };
    let index = 0;
    for (let tick = 0; tick <= duration && index < pts.length; tick += 1) {
      while (index < pts.length && (pts[index]["tick"] ?? index) <= tick) {
        send(index === 0 ? "pointerdown" : "pointermove", pts[index], 1);
        index += 1;
      }
      clock += TICK;
      engine.tick(1 / 60);
    }
    send("pointerup", pts[pts.length - 1], 0);
    clock += TICK;
    engine.tick(1 / 60);
    for (let tick = 0; tick < 72; tick += 1) {
      engine.fix();
      clock += TICK;
      engine.tick(1 / 60);
    }
    const frame = engine.exportCanvas("transparent");
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    const ctx = out.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(frame, 0, 0, W, H);
    engine.destroy();
    canvas.remove();
    const data = ctx.getImageData(0, 0, W, H).data;
    let ink = 0;
    let coverage = 0;
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      ink += 255 - lum;
      if (lum < 220) coverage += 1;
    }
    return { png: out.toDataURL("image/png"), ink: Math.round(ink), coverage };
  }
  var progress = (stage) => {
    document.getElementById("status").textContent = stage;
    window["__PROBE_PROGRESS"] = stage;
  };
  async function main() {
    const result3 = document.getElementById("result");
    try {
      progress("loading");
      const document_ = JSON.parse(new TextDecoder().decode(fetchSync("./script.json")));
      registerMask(document_.brushPack.entries[0].id, fetchSync("./mask.bin"));
      const events = toEvents(document_.strokes);
      progress("solo");
      const firstStroke = events.find(
        (event) => event["kind"] !== "dry" && event["engine"]?.["mutationId"] === 168
      ) ?? events.find((event) => event["kind"] !== "dry");
      const indexTicked = {
        ...firstStroke,
        pts: firstStroke["pts"].map((point, index) => ({ ...point, tick: index })),
        ticks: Math.max(1, firstStroke["pts"].length - 1)
      };
      const rawMeter = instrumentStamps();
      const soloRaw = await runBake([firstStroke], { frameCount: 1 });
      const rawStamps = summarizeStamps(rawMeter.stop());
      const indexMeter = instrumentStamps();
      const soloIndex = await runBake([indexTicked], { frameCount: 1 });
      const indexStamps = summarizeStamps(indexMeter.stop());
      const pointerMeter = instrumentStamps();
      const soloPointer = await renderPointerLive(firstStroke);
      const pointerStamps = summarizeStamps(pointerMeter.stop());
      progress("live");
      const liveSolo = await renderLive([firstStroke]);
      const live = await renderLive(events);
      progress("single");
      const single = await runBake(events, { frameCount: 1 });
      progress("progressive");
      const progressive = await runBake(events, { frameCount: 5, variation: "progressive" });
      progress("plain5");
      const plain5 = await runBake(events, { frameCount: 5 });
      progress("staticOn");
      const staticOn = await runBake(events, { frameCount: 3, variation: "static" });
      const pngs = {
        "solo-raw": soloRaw.frames[0].png,
        "solo-index": soloIndex.frames[0].png,
        "solo-pointer": soloPointer.png,
        "live-solo": liveSolo.png,
        live: live.png,
        "single-0": single.frames[single.frames.length - 1].png,
        "prog-last": progressive.frames[progressive.frames.length - 1].png,
        "plain5-last": plain5.frames[plain5.frames.length - 1].png,
        "static-last": staticOn.frames[staticOn.frames.length - 1].png
      };
      const brief = (run) => ({
        frames: run.frames.map(({ png, ...rest }) => rest),
        diagnostics: run.diagnostics
      });
      const out = JSON.stringify({
        strokes: events.filter((event) => event["kind"] !== "dry").length,
        points: firstStroke["pts"].length,
        ticks: firstStroke["ticks"],
        soloRawStamps: rawStamps,
        soloIndexStamps: indexStamps,
        soloPointerStamps: pointerStamps,
        soloPointer: { ink: soloPointer.ink, coverage: soloPointer.coverage },
        live: { ink: live.ink, coverage: live.coverage },
        single: brief(single),
        progressive: brief(progressive),
        plain5: brief(plain5),
        staticOn: brief(staticOn),
        pngs
      });
      result3.textContent = out.slice(0, 2e3);
      progress("DONE");
      window["__PROBE_STATE"] = out;
    } catch (error) {
      progress("FAILED");
      const out = JSON.stringify({ error: String(error?.stack ?? error) });
      result3.textContent = out;
      window["__PROBE_STATE"] = out;
    }
  }
  main();
})();
