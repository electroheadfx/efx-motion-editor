(() => {
  // ../../../packages/efx-watercolor/src/playground/params.ts
  var DEFAULT_CANONICAL_PARAMS = Object.freeze({
    size: 12,
    water: 50,
    load: 50,
    flow: 50,
    bleed: 50,
    dry: 50,
    edge: 50,
    granulation: 50,
    lift: 22,
    viscosity: 0,
    body: 0,
    emboss: 0
  });
  function num(v, fallback) {
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
  }
  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
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
      lift: num(p.lift, d.lift) / 100,
      viscosity: clamp01(num(p.viscosity, d.viscosity) / 100),
      body: clamp01(num(p.body, d.body) / 100),
      emboss: clamp01(num(p.emboss, d.emboss) / 100)
    };
  }

  // ../../../packages/efx-watercolor/src/playground/mediums.ts
  var MEDIUM_IDS = Object.freeze([
    "watercolor",
    "gouache",
    "pastel",
    "graphite",
    "acrylic"
  ]);
  var WATERCOLOR_PARAMS = Object.freeze({
    water: DEFAULT_CANONICAL_PARAMS.water,
    load: DEFAULT_CANONICAL_PARAMS.load,
    flow: DEFAULT_CANONICAL_PARAMS.flow,
    bleed: DEFAULT_CANONICAL_PARAMS.bleed,
    dry: DEFAULT_CANONICAL_PARAMS.dry,
    edge: DEFAULT_CANONICAL_PARAMS.edge,
    granulation: DEFAULT_CANONICAL_PARAMS.granulation,
    viscosity: DEFAULT_CANONICAL_PARAMS.viscosity,
    body: DEFAULT_CANONICAL_PARAMS.body,
    emboss: DEFAULT_CANONICAL_PARAMS.emboss
  });
  var MEDIUMS = Object.freeze([
    Object.freeze({ id: "watercolor", name: "Watercolor", params: WATERCOLOR_PARAMS }),
    Object.freeze({
      id: "gouache",
      name: "Gouache",
      params: Object.freeze({
        water: 35,
        load: 70,
        flow: 55,
        bleed: 25,
        dry: 60,
        edge: 60,
        granulation: 40,
        viscosity: 55,
        body: 55,
        emboss: 20
      })
    }),
    Object.freeze({
      id: "pastel",
      // Displays as "Chalk" so the dropdown name and the brush-library section
      // header (D-18) are the same word over the pastel group.
      name: "Chalk",
      params: Object.freeze({
        water: 0,
        load: 65,
        flow: 30,
        bleed: 0,
        dry: 80,
        edge: 70,
        granulation: 60,
        viscosity: 85,
        body: 25,
        emboss: 0
      })
    }),
    Object.freeze({
      id: "graphite",
      name: "Graphite",
      params: Object.freeze({
        water: 0,
        load: 45,
        flow: 25,
        bleed: 0,
        dry: 85,
        edge: 75,
        granulation: 100,
        viscosity: 90,
        body: 0,
        emboss: 0
      })
    }),
    Object.freeze({
      id: "acrylic",
      name: "Acrylic",
      params: Object.freeze({
        water: 8,
        load: 100,
        flow: 50,
        bleed: 10,
        dry: 70,
        edge: 65,
        granulation: 25,
        viscosity: 90,
        body: 85,
        emboss: 40
      })
    })
  ]);

  // ../../../packages/efx-watercolor/src/playground/brushes.ts
  function brushTipCacheKey(b) {
    return `${b.id}|${b.textureId ?? ""}`;
  }
  function tipRowsForUpload(data, size) {
    if (size <= 1 || data.length !== size * size) return data;
    const out = new Uint8Array(data.length);
    for (let row = 0; row < size; row++) {
      const source = (size - 1 - row) * size;
      out.set(data.subarray(source, source + size), row * size);
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
      let v = 0, amp = 0.5, sum = 0;
      for (let i = 0; i < octaves; i++) {
        v += amp * this.value(x, y);
        sum += amp;
        x = x * 2.03 + 17.1;
        y = y * 2.01 + 9.7;
        amp *= 0.5;
      }
      return v / sum;
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
  var clamp012 = (v) => Math.min(1, Math.max(0, v));
  var smoothstep = (a, b, x) => {
    const t = clamp012((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  var soft = (r, hard) => 1 - smoothstep(hard, 1, r);
  function tip(fn) {
    return (n) => {
      const out = new Float32Array(n * n);
      for (let j = 0; j < n; j++) {
        const v = (j + 0.5) / n * 2 - 1;
        for (let i = 0; i < n; i++) {
          const u = (i + 0.5) / n * 2 - 1;
          out[j * n + i] = clamp012(fn(u, v, Math.hypot(u, v), Math.atan2(v, u)));
        }
      }
      return out;
    };
  }
  function hairs(segments, width, u, v) {
    let sum = 0;
    for (const [ax, ay, bx, by] of segments) {
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
      const t = clamp012(((u - ax) * dx + (v - ay) * dy) / len2);
      const d = Math.hypot(u - ax - dx * t, v - ay - dy * t);
      sum += Math.exp(-(d * d) / (width * width));
    }
    return sum;
  }
  function bristleTip(n, N) {
    const segs = [];
    const count = 14;
    for (let i = 0; i < count; i++) {
      const x = -0.92 + 1.84 * i / (count - 1) + (N.rnd() - 0.5) * 0.06;
      segs.push([x * 0.35, -0.95, x, 0.95]);
    }
    return tip((u, v) => {
      const edge = 1 - smoothstep(0.86, 1, Math.abs(v));
      const taper = 1 - 0.25 * smoothstep(0.7, 1, Math.abs(v));
      return Math.min(1, hairs(segs, 0.052, u, v)) * edge * taper;
    })(n);
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
  var brushGroupOrder = Object.freeze([
    "watercolor",
    "gouache",
    "pastel",
    "graphite",
    "acrylic"
  ]);
  var brushGroupLabels = Object.freeze({
    watercolor: "Watercolor",
    gouache: "Gouache",
    pastel: "Chalk",
    graphite: "Graphite",
    acrylic: "Acrylic"
  });
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
      group: "pastel",
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
      group: "watercolor",
      tip: (n, N) => tip((u, v, r, ang) => {
        const rr = r * (1 + 0.08 * (N.fbm(ang * 0.8 + 3, r * 2.5) * 2 - 1));
        return soft(rr, 0.3) * (1 - 0.12 * N.fbm(u * 5, v * 5));
      })(n)
    }),
    define({
      id: "detail",
      name: "Detail",
      hint: "A small round #2 for fine work",
      group: "watercolor",
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
      group: "watercolor",
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
      group: "watercolor",
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
      group: "watercolor",
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
      group: "watercolor",
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
      group: "watercolor",
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
      group: "pastel",
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
      group: "pastel",
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
      group: "watercolor",
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
      group: "watercolor",
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
      group: "watercolor",
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
      group: "watercolor",
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
      group: "pastel",
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
    }),
    /* ---------------------------------------------------------------------
     * Phase 64 (MED-29): the eight responses the medium taxonomy needs. They
     * APPEND after the legacy fifteen — never rename or reorder an existing id,
     * because a stroke persists the response id and an unknown id replays as
     * the round. Every field the spec table does not name inherits `BASE`.
     * ------------------------------------------------------------------- */
    define({
      id: "gouache-round",
      name: "Gouache Round",
      hint: "Opaque body colour: soft edge, dense flat deposit",
      group: "gouache",
      size: [4e-3, 0.02],
      spacing: 0.2,
      water: 0.35,
      load: 1.4,
      flow: 0.6,
      capacity: 1.4,
      grain: 0.2,
      wetRound: 0.2,
      roughness: 0.25,
      tip: (n) => tip((_u, _v, r) => soft(r, 0.42))(n)
    }),
    define({
      id: "gouache-flat",
      name: "Gouache Flat",
      hint: "Flat body stroke: crisp chisel edge with opaque load",
      group: "gouache",
      aspect: 0.45,
      rotation: "follow",
      size: [0.01, 0.03],
      spacing: 0.16,
      water: 0.3,
      load: 1.5,
      flow: 0.55,
      capacity: 1.6,
      grain: 0.25,
      wetRound: 0.15,
      roughness: 0.3,
      tip: (n, N) => tip((u, v) => {
        const ex = 1 - smoothstep(0.82, 0.98, Math.abs(u));
        const ey = 1 - smoothstep(0.7, 1, Math.abs(v));
        return ex * ey * (0.85 + 0.15 * N.fbm(u * 12, v * 3, 2));
      })(n)
    }),
    define({
      id: "pastel-soft",
      name: "Soft Pastel",
      hint: "Soft pastel stick: powdery core, broad crumbly edge",
      group: "pastel",
      aspect: 0.75,
      water: 0,
      load: 1.3,
      capacity: 1.3,
      grain: 0.55,
      roughness: 0.5,
      stampJitter: 0.15,
      spacing: 0.18,
      tip: (n, N) => tip((u, v, r) => soft(r, 0.5) * (0.75 + 0.25 * N.fbm(u * 9, v * 9, 2)))(n)
    }),
    define({
      id: "conte-hard",
      name: "Cont\xE9 Hard",
      hint: "Hard crayon: narrow dark core, crumbling edges",
      group: "pastel",
      aspect: 0.6,
      water: 0,
      load: 1.5,
      capacity: 0.9,
      grain: 0.35,
      roughness: 0.8,
      stampJitter: 0.08,
      tip: (n, N) => tip((u, v, r) => (1 - smoothstep(0.55, 0.72, r)) * (0.7 + 0.3 * N.fbm(u * 16 + 3, v * 16 + 7, 3)))(n)
    }),
    define({
      id: "graphite-pencil",
      name: "Graphite Pencil",
      hint: "Fine graphite: tooth-gated, thin and dark",
      group: "graphite",
      size: [8e-4, 45e-4],
      pressureSize: 1.35,
      spacing: 0.15,
      scatter: 0.05,
      water: 0,
      load: 0.75,
      flow: 0.3,
      capacity: 0.5,
      grain: 1,
      roughness: 0.3,
      tip: (n) => tip((_u, _v, r) => soft(r, 0.6))(n)
    }),
    define({
      id: "graphite-6b",
      name: "Graphite 6B",
      hint: "Broad soft graphite: dark shoulder, dusty edge",
      group: "graphite",
      size: [2e-3, 0.012],
      aspect: 0.85,
      load: 1.4,
      grain: 0.85,
      scatter: 0.18,
      spacing: 0.2,
      tip: (n, N) => tip((u, v, r) => soft(r, 0.5) * (0.8 + 0.2 * N.fbm(u * 11, v * 11, 2)))(n)
    }),
    define({
      id: "bristle-flat",
      name: "Bristle Flat",
      hint: "Thick acrylic flat: directional hair marks, hard body",
      group: "acrylic",
      aspect: 0.28,
      rotation: "follow",
      water: 0.05,
      load: 1.5,
      flow: 0.5,
      capacity: 1.8,
      grain: 0.15,
      spacing: 0.1,
      roughness: 0.55,
      stampJitter: 0.06,
      tip: bristleTip
    }),
    define({
      id: "bristle-round",
      name: "Bristle Round",
      hint: "Round acrylic brush with body: springy, loaded hairs",
      group: "acrylic",
      aspect: 0.7,
      rotation: "follow",
      water: 0.06,
      load: 1.4,
      capacity: 1.6,
      grain: 0.15,
      roughness: 0.4,
      spacing: 0.14,
      tip: bristleTip
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
      for (let i = 0; i < f.length; i++) tipData[i] = Math.round(clamp012(f[i]) * 255);
    }
    let sum = 0;
    for (let i = 0; i < tipData.length; i++) sum += tipData[i];
    return { ...rest, tipSize, tipData, tipMean: Math.max(0.01, sum / (255 * tipData.length)) };
  }
  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  // ../../../packages/efx-watercolor/src/playground/half.ts
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

  // ../../../packages/efx-watercolor/src/playground/gl.ts
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
    target(w, h, formats, filter) {
      const { gl } = this;
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      const tex = [];
      const views = [];
      formats.forEach((f, i) => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
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
    double(w, h, formats, filter) {
      let a = this.target(w, h, formats, filter);
      let b = this.target(w, h, formats, filter);
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
    texture(w, h, f, data, filter) {
      const { gl } = this;
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, f.internal, w, h, 0, f.format, f.type, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
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
      const format = gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_FORMAT);
      const direct = format === gl.RGBA && type === gl.HALF_FLOAT;
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
    uploadHalf(tex, x, y, w, h, format, data) {
      const { gl } = this;
      if (w <= 0 || h <= 0) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 2);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, format, gl.HALF_FLOAT, data);
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

  // ../../../packages/efx-watercolor/src/playground/history.ts
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
        for (let tx = tx0; tx <= tx1; tx++) {
          const id = ty * this.tilesX + tx;
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
          const tx = id % this.tilesX, ty = Math.floor(id / this.tilesX);
          const w = Math.min(TILE, this.w - tx * TILE), h = Math.min(TILE, this.h - ty * TILE);
          const sx = slot % pool.cols * TILE, sy = Math.floor(slot / pool.cols) * TILE;
          layers[p].forEach((fbs, i) => {
            const atlas = pool.atlas[i].views[0], scratch = pool.scratch[i].views[0];
            this.g.blit(fbs[0], tx * TILE, ty * TILE, scratch, 0, 0, w, h);
            for (const fb of fbs) this.g.blit(atlas, sx, sy, fb, tx * TILE, ty * TILE, w, h);
            this.g.blit(scratch, 0, 0, atlas, sx, sy, w, h);
          });
          const r = { x0: tx * TILE, y0: ty * TILE, x1: tx * TILE + w, y1: ty * TILE + h };
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
      const tx = id % this.tilesX * TILE, ty = Math.floor(id / this.tilesX) * TILE;
      const sx = slot % pool.cols * TILE, sy = Math.floor(slot / pool.cols) * TILE;
      const w = Math.min(TILE, this.w - tx), h = Math.min(TILE, this.h - ty);
      layers.forEach((fb, i) => {
        const atlas = pool.atlas[i].views[0];
        if (save) this.g.blit(fb, tx, ty, atlas, sx, sy, w, h);
        else this.g.blit(atlas, sx, sy, fb, tx, ty, w, h);
      });
    }
  };

  // ../../../packages/efx-watercolor/src/playground/papers.ts
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

  // ../../../packages/efx-watercolor/src/playground/scattering.ts
  var BODY_CURVE_EXPONENT = 6;
  var SCATTERING_MAX = 1;
  var SCATTER_EPSILON = 1e-3;
  function clamp013(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
  function bodyCurve(body) {
    if (!Number.isFinite(body)) return 0;
    return Math.pow(clamp013(body), BODY_CURVE_EXPONENT);
  }
  function scatteringDeposit(body, amount) {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    return SCATTERING_MAX * bodyCurve(body) * amount;
  }

  // ../../../packages/efx-watercolor/src/playground/spectralData.ts
  var SPECTRAL_EPSILON = 1e-4;
  var PRIMARIES = [[0.96853629, 0.51567122, 0.02055257, 0.03147571, 0.49108579, 0.97901834], [0.96855103, 0.5401552, 0.02059936, 0.03146636, 0.46944057, 0.97901649], [0.96859338, 0.62645502, 0.02062723, 0.03140624, 0.4016578, 0.97901118], [0.96877345, 0.75595012, 0.02073387, 0.03119611, 0.2449042, 0.97892146], [0.96942204, 0.92826996, 0.02114202, 0.03053888, 0.0682688, 0.97858555], [0.97143709, 0.97223624, 0.02233154, 0.02856855, 0.02732883, 0.97743705], [0.97541862, 0.98616174, 0.02556857, 0.02459485, 0.013606, 0.97428075], [0.98074186, 0.98955255, 0.03330189, 0.0192952, 0.01000187, 0.96663223], [0.98580992, 0.98676237, 0.05185294, 0.01423112, 0.01284127, 0.94822893], [0.98971194, 0.97312575, 0.10087639, 0.01033111, 0.02636635, 0.89937713], [0.99238027, 0.91944277, 0.24000413, 765876e-8, 0.07058713, 0.76070164], [0.99409844, 0.32564851, 0.53589066, 593693e-8, 0.70421692, 0.4642044], [0.995172, 0.13820628, 0.79874659, 485616e-8, 0.85473994, 0.20123039], [0.99576545, 0.05015143, 0.91186529, 426186e-8, 0.95081565, 0.08808402], [0.99593552, 0.02912336, 0.95399623, 409039e-8, 0.9717037, 0.04592894], [0.99564041, 0.02421691, 0.97137099, 438375e-8, 0.97651888, 0.02860373], [0.99464769, 0.02660696, 0.97939505, 537525e-8, 0.97429245, 0.02060067], [0.99229579, 0.03407586, 0.98345207, 772962e-8, 0.97012917, 0.01656701], [0.98638762, 0.04835936, 0.98553736, 0.0136612, 0.9425863, 0.01451549], [0.96829712, 1172e-7, 0.98648905, 0.03181352, 0.99989207, 0.01357964], [0.89228016, 8554e-8, 0.98674535, 0.10791525, 0.99989891, 0.01331243], [0.53740239, 0.85267882, 0.98657555, 0.46249516, 0.13823139, 0.01347661], [0.15360445, 0.93188793, 0.98611877, 0.84604333, 0.06968113, 0.01387181], [0.05705719, 0.94810268, 0.98559942, 0.94275572, 0.05628787, 0.01435472], [0.03126539, 0.94200977, 0.98507063, 0.96860996, 0.06111561, 0.01479836], [0.02205445, 0.91478045, 0.98460039, 0.97783966, 0.08987709, 0.0151525], [0.01802271, 0.87065445, 0.98425301, 0.98187757, 0.13656016, 0.01540513], [0.0161346, 0.78827548, 0.98403909, 0.98377315, 0.22169624, 0.01557233], [0.01520947, 0.65738359, 0.98388535, 0.98470202, 0.32176956, 0.0156571], [0.01475977, 0.59909403, 0.98376116, 0.98515481, 0.36157329, 0.01571025], [0.01454263, 0.56817268, 0.98368246, 0.98537114, 0.4836192, 0.01571916], [0.01444459, 0.54031997, 0.98365023, 0.98546685, 0.46488579, 0.01572133], [0.01439897, 0.52110241, 0.98361309, 0.98550011, 0.47440306, 0.01572502], [0.0143762, 0.51041094, 0.98357259, 0.98551031, 0.4857699, 0.01571717], [0.01436343, 0.50526577, 0.98353856, 0.98550741, 0.49267971, 0.01571905], [0.01435687, 0.5025508, 0.98351247, 0.98551323, 0.49625685, 0.01571059], [0.0143537, 0.50126452, 0.98350101, 0.98551563, 0.49807754, 0.01569728], [0.01435408, 0.50083021, 0.98350852, 0.98551547, 0.49889859, 0.0157002]];
  var BASIS = [[0.1441295, 0.1442537, 0.1447023, 0.1481238, 0.1558969, 0.1598567, 0.1620447, 0.1627555, 0.1616249, 0.1577825, 0.1510664, 0.1434845, 0.1548815, 0.1665376, 0.1732235, 0.176503, 0.1775172, 0.1768919, 0.1748587, 0.1783071, 0.17098, 0.1527153, 0.1627231, 0.169401, 0.1714174, 0.170287, 0.1680602, 0.1648873, 0.162965, 0.1626282, 0.159549, 0.1605975, 0.1607086, 0.1606138, 0.1605312, 0.1604933, 0.1604751, 0.160461], [-0.2038064, -0.203989, -0.2047454, -0.2096147, -0.2221909, -0.229624, -0.2342462, -0.2354314, -0.2303617, -0.2137209, -0.1783547, -0.124576, -0.08767601, -0.06654336, -0.05408394, -0.04631953, -0.04068168, -0.03551027, -0.02914774, -0.01869558, 0.01093349, 0.05936064, 0.1243476, 0.151563, 0.1619576, 0.1663112, 0.1683766, 0.1696986, 0.171131, 0.1718488, 0.1723758, 0.1726696, 0.172894, 0.1730376, 0.1731037, 0.1731485, 0.1731795, 0.1731822], [0.03137849, 0.03651497, 0.05369401, 0.09161207, 0.1575574, 0.1842324, 0.1949895, 0.1940139, 0.181434, 0.1530233, 0.09984866, -0.09188325, -0.1765157, -0.2432063, -0.2743489, -0.2876131, -0.2893418, -0.2831437, -0.2674148, -0.3019731, -0.2652804, 0.04536814, 0.1224234, 0.1512875, 0.1570717, 0.1463656, 0.128849, 0.1015794, 0.07210673, 0.06066822, 0.0405239, 0.04040221, 0.03731743, 0.03480428, 0.03341753, 0.03269546, 0.03233622, 0.03218968], [0.3475249, 0.3394636, 0.3120142, 0.2222812, 0.02525531, -0.07617525, -0.131711, -0.1551115, -0.1569514, -0.1445308, -0.1209759, 0.1224517, 0.04911107, -0.01336119, -0.05756325, -0.0821194, -0.0923594, -0.09218955, -0.0876826, -0.1097293, -0.08213999, -0.2512941, -0.2629964, -0.2346993, -0.1994343, -0.1372833, -0.07003431, 0.01097949, 0.07361673, 0.09292193, 0.1495078, 0.1393326, 0.1419586, 0.1459523, 0.1484407, 0.1497109, 0.1503627, 0.1506628], [0.06142204, 0.05786618, 0.04493868, -1667544e-9, -0.1239341, -0.18922, -0.2092335, -0.1813051, -0.09951376, 0.04750551, 0.2508217, 0.4173112, 0.3464263, 0.2114988, 0.1065638, 0.0396658, 1179382e-9, -0.02244844, -0.04379864, -0.2757395, -0.4358296, 2079004e-9, 0.08929734, 0.1616104, 0.1808936, 0.1600107, 0.1229764, 0.06541057, -1589698e-9, -0.02956237, -0.06381081, -0.07050402, -0.07924397, -0.08523274, -0.08834905, -0.09000503, -0.09082922, -0.09112351], [-0.2849056, -0.2809993, -0.2670309, -0.2146758, -0.04397425, 0.07688784, 0.1561441, 0.1960707, 0.2022741, 0.1829012, 0.1568899, 0.1352822, 0.1607311, 0.1282205, 0.08742798, 0.05524357, 0.03074158, 7401419e-9, -0.02492709, -0.144013, -0.2534114, -0.279643, -0.284807, -0.2400265, -0.1937673, -0.1278778, -0.06158691, 0.0106791, 0.06228573, 0.07793386, 0.1189043, 0.1120231, 0.1139095, 0.1167035, 0.118432, 0.119318, 0.1197796, 0.1199808], [-0.04867795, -0.03848097, -6388283e-9, 6091587e-10, -0.0367139, -0.0675538, -0.07838973, -0.06227753, -0.01207089, 0.08113584, 0.2171174, 0.1783848, 0.06910126, -0.09273659, -0.1425212, -0.1316225, -0.07574946, 0.0125239, 0.1328408, -0.1632446, 0.05201528, 0.7089535, 0.1776335, -0.1592273, -0.2833049, -0.2661033, -0.1976904, -0.09221338, -0.02023599, -4615753e-9, 0.08051684, 0.05602729, 0.05512528, 0.058801, 0.06145249, 0.06280478, 0.06355499, 0.06393252]];
  var DISPLAY_BANDS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32];
  var DISPLAY_RGB_WEIGHTS = [[7598756e-9, 0.0144316, 0.02304203], [-0.07190809, -0.05764169, 0.1207272], [0.299773, 0.0127048, 0.3249726], [-0.2579063, -0.06517872, 0.4461339], [0.07037487, 0.05889296, 0.1350291], [-0.2104469, 0.1285821, 0.09775973], [-0.02718884, 0.2208098, -0.09346024], [-0.3172512, 0.4457301, 0.04248862], [0.2293731, 0.1134161, -0.06150663], [0.1930991, 0.1395861, -0.01283952], [0.5274069, 0.03838932, -0.02348521], [0.3899227, 0.07193636, 0.01268301], [-0.165677, -0.2589753, -0.01230862], [0.5972293, 0.3119106, -548141e-8], [-0.197781, 0.08099158, 0.05785604], [-0.06596648, -0.2556352, -0.05165295]];

  // ../../../packages/efx-watercolor/src/playground/spectral.ts
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
    return { coeffs };
  }
  function displayBasisGLSL() {
    const f = (v) => Number.isInteger(v) ? v.toFixed(1) : v.toPrecision(7);
    const scattered = [];
    const legacy = [];
    DISPLAY_BANDS.forEach((band, i) => {
      const b = BASIS.map((v) => v[band]);
      const w = DISPLAY_RGB_WEIGHTS[i];
      const basis = `dot(a, vec4(${b.slice(0, 4).map(f).join(",")})) + dot(b, vec3(${b.slice(4, 7).map(f).join(",")}))`;
      legacy.push(
        `  tr = exp(-max(${basis}, 0.0));
  rgb += tr * vec3(${w.map(f).join(",")});`
      );
      scattered.push(
        `    float kmK${i} = 0.5 * max(${basis}, 0.0);
    float kmBand${i};
    if (kmK${i} <= 0.0){
      kmBand${i} = 1.0;
    } else {
      float kmArg${i} = sqrt(kmK${i} * (2.0 * scatter + kmK${i}));
      float kmE${i} = exp(-2.0 * kmArg${i});
      float kmSh${i} = 0.5 * (1.0 - kmE${i});
      float kmCh${i} = 0.5 * (1.0 + kmE${i});
      float kmDen${i} = (kmK${i} + scatter) * kmSh${i} + kmArg${i} * kmCh${i};
      float kmR${i} = scatter * kmSh${i} / kmDen${i};
      float kmT${i} = kmArg${i} * sqrt(kmE${i}) / kmDen${i};
      float kmOm${i} = (kmK${i} * kmSh${i} + kmArg${i} * kmCh${i}) / kmDen${i};
      kmBand${i} = kmR${i} + kmT${i} * kmT${i} / kmOm${i};
    }
    rgb += kmBand${i} * vec3(${w.map(f).join(",")});`
      );
    });
    return [
      "  // Kubelka-Munk layer over white (64-10, MED-34 / MED-35): each band is the",
      "  // layer's reflectance over black plus its squared transmittance over one",
      "  // minus that reflectance. S = scatter; one unit-amount Body-100 dab peaks at",
      `  // SCATTERING_MAX = ${f(SCATTERING_MAX)}, and the settled channel accumulates past it.`,
      "  // Each term is normalized by exp(-arg), so the hyperbolic forms stay",
      "  // bounded for any finite absorption and scattering. At or below the epsilon",
      "  // the legacy lines run verbatim, so a scattering-free render is",
      "  // byte-identical to the committed baseline.",
      `  if (scatter > ${f(SCATTER_EPSILON)}){`,
      scattered.join("\n"),
      "  } else {",
      legacy.join("\n"),
      "  }"
    ].join("\n");
  }

  // ../../../packages/efx-watercolor/src/playground/shaders.ts
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
  var reliefFS = `${HEADER}
layout(location=0) out vec4 o0;
uniform sampler2D uTip, uPaper;
uniform float uAspect, uRadius, uTipAspect, uRound, uGrain, uGrainThr;
uniform float uRough, uJitter;
uniform float uTipRotation;
uniform vec2 uPoint, uAxis;
uniform float uAmount;
void main(){
  vec2 p = vUv - uPoint; p.x *= uAspect;
  vec2 q = vec2(dot(p, uAxis), dot(p, vec2(-uAxis.y, uAxis.x))) / uRadius;
  q.y /= uTipAspect;
  // Rotate the TIP-SPACE sampling coordinates only: the discard and the
  // footprint value keep the unrotated q, exactly as stampFS does.
  float a = uTipRotation;
  vec2 tq = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
  if (abs(q.x) > 1.0 || abs(q.y) > 1.0) discard;
  // Dry media reads a different slice of the tip per dab (same law as stampFS).
  float e0 = fract(sin(dot(uPoint, vec2(12.9898, 78.233))) * 43758.5453);
  float e1 = fract(e0 * 63.7264 + 0.37);
  vec2 uv = clamp(tq * 0.5 + 0.5 + (vec2(e0, e1) - 0.5) * uJitter, 0.0, 1.0);
  float t = texture(uTip, uv).r;
  // Re-threshold the tip into the same hard, crumbly mask stampFS builds.
  float th = uRough * 0.45;
  float dry = smoothstep(th, th + 0.02, t);
  float sharp = mix(t, dry, step(0.0001, uRough));
  float d = dot(q, q);
  float round = 1.0 - smoothstep(0.15, 1.0, d);
  float f = mix(sharp, round, uRound);
  float h = texture(uPaper, vUv).g;
  f *= mix(1.0, smoothstep(uGrainThr - 0.08, uGrainThr + 0.08, h), uGrain);
  o0 = vec4(uAmount * f);
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
  var TO_SRGB = `
vec3 toSRGB(vec3 c){
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 fromSRGB(vec3 c){
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}`;
  var FILM_PRESENCE = `
uniform sampler2D uInkA, uInkB, uFixedA, uFixedB;
uniform float uGranulation;

// The paper-white scan's own line and its margin, derived once: luma 250 of
// 255 is the covered-paper-white scan's threshold, and the 5-level ramp is
// the margin the scan leaves above it (a texel at or above the line can never
// be counted covered paper-white after 8-bit quantization).
const float PAPER_WHITE = 250.0 / 255.0;
const float PAPER_WHITE_RAMP = 5.0 / 255.0;

${TO_SRGB}

// How much of the sheet this texel's combined paint film still hides: 1 where
// the film reads at or below the scan's ramp, 0 where it reads paper-white on
// the scan's own 8-bit grid. Exactly the display's film (the mobile and fixed
// layers summed as displayFS sums them), exactly its granulation, exactly its
// basis.
float filmPresence(vec2 uv){
  vec4 paper = texture(uPaper, uv);
  vec4 iB = texture(uInkB, uv);
  vec4 fB = texture(uFixedB, uv);
  vec4 a = texture(uInkA, uv) + texture(uFixedA, uv);
  vec3 b = iB.rgb + fB.rgb;
  float scatter = iB.a + fB.a;
  float gran = 1.0 + uGranulation * (0.5 - paper.g) * 2.2;
  a *= gran; b *= gran; scatter *= gran;
  vec3 rgb = vec3(0.0);
  float tr;
${displayBasisGLSL()}
  // The scan reads the transparent export's bytes: quantize to RGBA8 the same
  // way (round to nearest) before the mean, so both comparisons agree.
  vec3 s = toSRGB(rgb);
  vec3 q = floor(s * 255.0 + 0.5) / 255.0;
  float luma = (q.r + q.g + q.b) / 3.0;
  return 1.0 - smoothstep(PAPER_WHITE - PAPER_WHITE_RAMP, PAPER_WHITE, luma);
}`;
  var advectCoverFS = `${HEADER}
layout(location=0) out vec4 o0;
uniform sampler2D uVelocity, uCover, uWet, uPaper;
uniform vec2 uSimTexel, uTexel;
uniform float uDt, uBleed, uEdge, uAspect;
uniform vec3 uBrush;  // x, y, radius (radius <= 0: no brush down)

${FILM_PRESENCE}

float mobility(float w){ return smoothstep(0.02, 0.45, w); }

void face(vec2 off, float w, float m, float C, float diffusion, float edge,
          inout float dC){
  vec2 uv = vUv + off;
  float wn = texture(uWet, uv).x;
  float g = m * mobility(wn);
  if (g <= 0.0) return;
  float Cn = texture(uCover, uv).x;
  float d = diffusion * g;
  // positive: water (and coverage) drifts from this texel toward the drier neighbour
  float e = clamp(edge * (w - wn), -0.08, 0.08) * g;
  dC += d * (Cn - C) - (e > 0.0 ? e * C : e * Cn);
}

void main(){
  float w = texture(uWet, vUv).x;
  float m = mobility(w);
  float C = texture(uCover, vUv).x;
  if (m < 0.002){ o0 = vec4(C); return; }

  float p = filmPresence(vUv);
  vec2 vel = texture(uVelocity, vUv).xy;
  vec2 coord = vUv - uDt * vel * uSimTexel * m;
  float c = mix(C, texture(uCover, coord).x, m * p);

  float brush = 0.0;
  if (uBrush.z > 0.0){
    vec2 d = vUv - uBrush.xy; d.x *= uAspect;
    brush = exp(-dot(d, d) / (uBrush.z * uBrush.z));
  }
  float diffusion = clamp(uBleed * (0.25 + 1.3 * brush) * 0.3, 0.0, 0.15);
  float dC = 0.0;
  face(vec2( uTexel.x, 0.0), w, m, C, diffusion, uEdge, dC);
  face(vec2(-uTexel.x, 0.0), w, m, C, diffusion, uEdge, dC);
  face(vec2(0.0,  uTexel.y), w, m, C, diffusion, uEdge, dC);
  face(vec2(0.0, -uTexel.y), w, m, C, diffusion, uEdge, dC);

  // Coverage is a committed alpha in [0, 1]: clamp the transported sum, scaled
  // per texel by the film's presence \u2014 a paper-white texel keeps its value.
  o0 = vec4(clamp(c + dC * p, 0.0, 1.0));
}`;
  var settleFS = `${HEADER}
layout(location=0) out vec4 oA;
layout(location=1) out vec4 oB;
uniform sampler2D uInkA, uInkB;
uniform float uSettle;
void main(){
  vec4 A = texture(uInkA, vUv), B = texture(uInkB, vUv);
  oA = A * uSettle;
  oB = vec4(B.rgb * uSettle, B.a * uSettle);
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
  var FOOTPRINT_MASK = `
uniform sampler2D uTip, uPaper;
uniform float uAspect, uRadius, uTipAspect, uRound, uGrain, uGrainThr;
uniform float uRough, uJitter, uTipRotation;
uniform vec2 uPoint, uAxis;
float footprintMask(){
  vec2 p = vUv - uPoint; p.x *= uAspect;
  vec2 q = vec2(dot(p, uAxis), dot(p, vec2(-uAxis.y, uAxis.x))) / uRadius;
  q.y /= uTipAspect;
  float a = uTipRotation;
  vec2 tq = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
  if (abs(q.x) > 1.0 || abs(q.y) > 1.0) return 0.0;
  float e0 = fract(sin(dot(uPoint, vec2(12.9898, 78.233))) * 43758.5453);
  float e1 = fract(e0 * 63.7264 + 0.37);
  vec2 uv = clamp(tq * 0.5 + 0.5 + (vec2(e0, e1) - 0.5) * uJitter, 0.0, 1.0);
  float t = texture(uTip, uv).r;
  // The deposit's LOW cut without its hard edge: a dry brush thresholds the tip
  // at roughness * 0.45 with a 0.02 ramp, and a cover must start erasing at
  // the same alpha (never below it: that is where the paint is absent, and an
  // erase there compounds to paper-white over a stroke's overlapping dabs).
  // The ramp is WIDE on purpose: the underlayer survives partway up the tip's
  // alpha, which is the transition the rim needs, instead of a hard cut at the
  // dab's contour. A 1-in-1-out threshold here is what carved the scalloped
  // dab edges and the white specks through textured tips.
  float th = uRough * 0.45;
  float ramp = smoothstep(th, th + 0.5, t);
  float round = 1.0 - smoothstep(0.15, 1.0, dot(q, q));
  float f = mix(ramp, round, uRound);
  // Soften the tip square's cull: the deposit may stop at |q| = 1, but an erase
  // that stops on the same hard line draws the dab's contour. Fading the cover
  // out before the cull leaves the underlayer mixing at the outermost rim.
  f *= 1.0 - smoothstep(0.82, 1.0, max(abs(q.x), abs(q.y)));
  float h = texture(uPaper, vUv).g;
  return f * mix(1.0, smoothstep(uGrainThr - 0.08, uGrainThr + 0.08, h), uGrain);
}`;
  var bodyCoverFS = `${HEADER}${FOOTPRINT_MASK}
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
uniform float uAmount, uDensity, uShape;
void main(){
  float m = footprintMask();
  float f = uAmount * mix(m, 1.0 - exp(-uDensity * m), uShape);
  o0 = vec4(f);
  o1 = vec4(f);
}`;
  var coverDepositFS = `${HEADER}${FOOTPRINT_MASK}
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
uniform vec4 uColor0, uColor1;
uniform float uAmount, uDensity;
void main(){
  float m = footprintMask();
  float a = uAmount * (1.0 - exp(-uDensity * m));
  o0 = uColor0 * a;
  o1 = vec4(uColor1.rgb * a, uColor1.a * m);
}`;
  var coverMaskFS = `${HEADER}${FOOTPRINT_MASK}
layout(location=0) out vec4 o0;
uniform float uAmount, uDensity;
void main(){
  float m = footprintMask();
  o0 = vec4(uAmount * (1.0 - exp(-uDensity * m)));
}`;
  var coverClearFS = `${HEADER}
layout(location=0) out vec4 o0;
uniform sampler2D uSrc, uPaper, uCover;
${FILM_PRESENCE}
void main(){
  vec4 src = texture(uSrc, vUv);
  float p = filmPresence(vUv);
  float cov = texture(uCover, vUv).x;
  float cleared = (p < 0.0001 && cov > 0.0) ? 1.0 : 0.0;
  o0 = vec4(src.rgb, src.a * (1.0 - cleared));
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
uniform sampler2D uRelief; // Phase 64: paint thickness field (one channel)
uniform sampler2D uCover;  // SPIKE 001: pigment-layer coverage (one channel)
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
uniform float uLightAzimuth, uLightElevation, uLightIntensity, uReliefBump; // Phase 64: radians, radians, 0..4, fixed bump
const float EMBOSS_GAIN = 2.3;
const float EMBOSS_SHADE_MAX = 1.5;
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
  vec4 fB = texture(uFixedB, uv);
  vec4 a = texture(uInkA, uv) + texture(uFixedA, uv);
  vec3 b = iB.rgb + fB.rgb;
  // Phase 64 (MED-34): the settled scattering scalar, one broadband value for
  // every band. It is scaled with the coefficients below, so the grainiest
  // paint is also the most variable in opacity (D-16).
  float scatter = iB.a + fB.a;

  // Granulation: pigment settles into the valleys of the paper.
  float d0 = a.x;
  float gran = 1.0 + uGranulation * (0.5 - paper.g) * 2.2;
  // Edge darkening from the density gradient keeps fine pen work crisp.
  float l = density(uv - vec2(uTexel.x, 0.0)), r = density(uv + vec2(uTexel.x, 0.0));
  float bt = density(uv - vec2(0.0, uTexel.y)), t = density(uv + vec2(0.0, uTexel.y));
  float edge = min(length(vec2(r - l, t - bt)) / (d0 + 1.0), 1.0);
  float k = mix(gran * (1.0 + uEdgeDarken * edge), 1.0, uFlat);
  a *= k; b *= k; scatter *= k;

  vec3 rgb = vec3(0.0);
  float tr;
${displayBasisGLSL()}

  // Phase 64 (MED-15): light the paint thickness field. One document texel of
  // central difference \u2014 the same law paperLightFS uses \u2014 so the gradient is
  // fixed in document space and cannot crawl under zoom or pan. A texel with
  // no thickness casts no shade. A flat field tilts the normal to (0, 0, 1),
  // where dot(n, L) - L.z is exactly 0 at any intensity: the emboss is a
  // gradient term, never a flat multiply.
  float shade = 1.0;
  {
    float c = texture(uRelief, uv).x;
    if (c > 0.0){
      float l = texture(uRelief, uv - vec2(uTexel.x, 0.0)).x, r = texture(uRelief, uv + vec2(uTexel.x, 0.0)).x;
      float b = texture(uRelief, uv - vec2(0.0, uTexel.y)).x, t = texture(uRelief, uv + vec2(0.0, uTexel.y)).x;
      vec3 n = normalize(vec3((l - r) * uReliefBump, (b - t) * uReliefBump, 1.0));
      vec3 L = normalize(vec3(
        cos(uLightElevation) * cos(uLightAzimuth),
        cos(uLightElevation) * sin(uLightAzimuth),
        sin(uLightElevation)));
      float litDelta = uLightIntensity * (dot(n, L) - L.z) * uReliefBump * EMBOSS_GAIN;
      shade = clamp(1.0 + litDelta * (1.0 - uFlat), 0.0, EMBOSS_SHADE_MAX);
    }
  }

  // Phase 64: ONE shading law for every mode. The live compositor layer
  // (mode 4) shades in PIGMENT space \u2014 the pigment colour scales, the alpha
  // does not. Scaling the linear transmittance instead (the first cut) darkened
  // the darkest bands, so the emboss gradient read as a dark outline, and it
  // made the mode-2 sheet's cached-base alpha differ from the live layer.
  // Emitting the shaded transmittance as mn + (t - mn) * shade makes mode 2,
  // mode 4 and the cached-base round-trip the SAME law by construction. At
  // shade == 1 every legacy line below is byte-identical.
  vec3 tSrgb = toSRGB(rgb);
  float tMin = min(min(tSrgb.r, tSrgb.g), tSrgb.b);
  vec3 lit = vec3(tMin) + (tSrgb - vec3(tMin)) * shade;

  if (uMode == 4){
    // PIGMENT ALPHA (compositor display, 2026-10-26 round 2). The same
    // transmittance as mode 2, re-expressed as straight-alpha pigment so the
    // live sheet stacks with REAL layer alpha. Light washes stay translucent,
    // dense pigment masks. displayFS writes PREMULTIPLIED pixels (F1 contract),
    // so scale the colour by alpha. Storage/export keeps mode 2's opaque sheet.
    // Phase 64: the emboss scales only the premultiplied colour; the alpha is
    // derived from the UNSHADED reconstruction and stays byte-for-byte
    // untouched, so a lit stroke never changes its opacity.
    //
    // SPIKE 001: alpha is the max of the darkness alpha and the composited
    // COVERAGE. A near-white pigment's darkness alpha is ~0.06, which is why
    // the punch machinery existed; coverage is pigment-independent, so white
    // acrylic now hides what is beneath it. The colour keeps the same
    // over-white identity \u2014 over a white fond source-over gives
    // colour*alpha + (1-alpha) = t \u2014 and reduces exactly to the old formula
    // (alpha = 1 - tMin, colour = (t - tMin) / alpha) wherever cover is 0.
    float darkAlpha = 1.0 - tMin;
    float cov = texture(uCover, uv).x;
    float alpha = clamp(max(darkAlpha, cov), 0.0, 1.0);
    vec3 pigment = alpha > 0.0 ? (tSrgb - vec3(1.0 - alpha)) / alpha : vec3(0.0);
    pigment = clamp(pigment, 0.0, 1.0);
    o = vec4(pigment * alpha * shade, alpha);
    return;
  }

  if (uMode == 2){
    // TRANSMITTANCE, opaque (R2.2 paper-agnostic multiply seam). lit is how
    // much paper light gets through the pigment. Composited with
    // mix-blend-mode: multiply over ANY fond: result = fond x lit, exactly the
    // live mode-4 layer's composite. No alpha to misread (F1 neon / fringe)
    // and no un-mix round-trip to lose thin strokes (F2 fade).
    o = vec4(lit, 1.0);
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
  // Back to linear for the paper multiply. shade == 1 keeps the legacy linear
  // transmittance exactly, so a relief-free sheet stays byte-identical.
  vec3 litLinear = shade == 1.0 ? rgb : fromSRGB(lit);
  vec3 col = litLinear * paperCol;

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

  // ../../../packages/efx-watercolor/src/vector/spine.ts
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
  function cubicPointAt(start, controlA, controlB, end, t) {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return {
      x: a * start.x + b * controlA.x + c * controlB.x + d * end.x,
      y: a * start.y + b * controlA.y + c * controlB.y + d * end.y
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
      const end = anchors[index + 1];
      const controlA = handles[index].out;
      const controlB = handles[index + 1].in;
      const chord = distance(start, end);
      const steps = Math.max(1, Math.ceil(chord / PATH_SAMPLE_STEP_UV));
      for (let step = 1; step < steps; step++) {
        const sample = cubicPointAt(start, controlA, controlB, end, step / steps);
        const advance2 = distance(cursor, sample);
        if (advance2 <= 0) continue;
        total += advance2;
        points.push(sample);
        stations.push(total);
        cursor = sample;
      }
      const advance = distance(cursor, end);
      if (advance > 0) {
        total += advance;
        cursor = { x: end.x, y: end.y };
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
    const match = ANCHOR_COLOR_PATTERN.exec(value);
    if (match === null) return void 0;
    const digits = match[1].toLowerCase();
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
      const end = anchorStations[index + 1];
      if (station > end) continue;
      const span = end - start;
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
      const end = anchorStations[index + 1];
      if (station > end) continue;
      const span = end - start;
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

  // ../../../packages/efx-watercolor/src/playground/wetState.ts
  var WET_THRESHOLD = 4e-3;
  function isSheetWet(state) {
    return !state.fixing && state.wetPeak > WET_THRESHOLD && state.nowMs < state.wetUntilMs;
  }

  // ../../../packages/efx-watercolor/src/playground/Engine.ts
  var DEFAULT_PARAMS = {
    size: 0.5,
    water: 0.6,
    load: 0.5,
    flow: 0.45,
    bleed: 0.5,
    dry: 0.4,
    edge: 0.5,
    granulation: 0.45,
    lift: 0.22,
    viscosity: 0,
    body: 0,
    emboss: 0
  };
  var DEFAULT_LIGHT = { azimuth: 129.8, elevation: 38.45, intensity: 1 };
  var MODE = { screen: 0, paper: 1, transparent: 2, white: 3, pigment: 4 };
  var MAX_REF_SIDE = 4096;
  var RELIEF_BUMP = 1;
  var COVER_GAIN = 2;
  var COVER_MEDIUM_DENSITY = 8;
  var RELIEF_GAIN = 1.5;
  var RELIEF_ERODE = 0.5;
  var EMBOSS_PRESS_FLOOR = 0.15;
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
    constructor(canvas, cursor, callbacks = {}, size) {
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
        relief: this.g.program(reliefFS),
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
        lift: this.g.program(liftFS),
        paperField: this.g.program(paperFieldFS),
        paperLight: this.g.program(paperLightFS),
        paperSwatch: this.g.program(paperSwatchFS),
        paperSheet: this.g.program(paperSheetFS),
        display: this.g.program(displayFS),
        coverDeposit: this.g.program(coverDepositFS),
        coverMask: this.g.program(coverMaskFS)
      };
      this.programs.bodyCover = this.g.program(bodyCoverFS);
      this.programs.advectCover = this.g.program(advectCoverFS);
      this.programs.coverClear = this.g.program(coverClearFS);
      this.fitCanvas();
      this.createDocument(size ?? this.screenSize);
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
      coeffs: new Float32Array(COEFFS)
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
    // Phase 64: the emboss light, in degrees (converted at drawDisplay). Render-only.
    light = { ...DEFAULT_LIGHT };
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
    relief;
    // Phase 64: paint thickness, one channel, engine-only
    // SPIKE 001: the pigment layer's coverage, one channel. A ping-pong pair from
    // the start: 64-14 advects it with the ink and its undo needs both halves.
    cover;
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
      this.relief = g.target(this.dw, this.dh, [HALF_FLOAT_R], gl.LINEAR);
      this.cover = g.double(this.dw, this.dh, [HALF_FLOAT_R], gl.LINEAR);
      this.paper = g.target(this.dw, this.dh, [RGBA8], gl.LINEAR);
      this.wetMask = g.target(Math.ceil(this.dw / MASK_BLOCK), Math.ceil(this.dh / MASK_BLOCK), [RGBA8], gl.NEAREST);
      this.maskPixels = new Uint8Array(this.wetMask.w * this.wetMask.h * 4);
    }
    allocateHistory() {
      this.history = new History(this.g, this.dw, this.dh, [
        { formats: [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA, HALF_FLOAT_R, HALF_FLOAT_R, HALF_FLOAT_R], documents: 2 },
        // mobile pigment + water + thickness + coverage
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
        this.wetMask,
        this.relief,
        this.cover.read,
        this.cover.write
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
      const old = { targets: this.docTargets(), ink: this.ink.read, fixed: this.fixed, wet: this.wet.read, relief: this.relief, cover: this.cover.read };
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
      copy(old.relief, [this.relief]);
      copy(old.cover, [this.cover.read, this.cover.write]);
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
          wet: read(this.wet.read.views[0], 1),
          relief: read(this.relief.views[0], 1),
          cover: read(this.cover.read.views[0], 1)
        }
      };
    }
    /** Put `whole`'s layers into the (blank) current targets; both halves of the ping-pong pairs. */
    uploadWhole(whole) {
      const r = whole.rect;
      if (!r) return;
      const { gl, g } = this;
      const w = r.x1 - r.x0, h = r.y1 - r.y0;
      const up = (tex, format, data) => g.uploadHalf(tex, r.x0, r.y0, w, h, format, data);
      for (const t of [this.ink.read, this.ink.write]) {
        up(t.tex[0], gl.RGBA, whole.layers.inkA);
        up(t.tex[1], gl.RGBA, whole.layers.inkB);
      }
      up(this.fixed.tex[0], gl.RGBA, whole.layers.fixedA);
      up(this.fixed.tex[1], gl.RGBA, whole.layers.fixedB);
      for (const t of [this.wet.read, this.wet.write]) up(t.tex[0], gl.RED, whole.layers.wet);
      up(this.relief.tex[0], gl.RED, whole.layers.relief);
      for (const t of [this.cover.read, this.cover.write]) up(t.tex[0], gl.RED, whole.layers.cover);
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
        gl.uniform4f(p.u.uColor1, c[4] * amount, c[5] * amount, c[6] * amount, scatteringDeposit(P.body, amount));
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
    setRandom(fn) {
      this.rng = fn;
    }
    /** Deterministic bake: install a virtual clock in ms (A2). */
    setClock(fn) {
      this.clock = fn;
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
     * Set the emboss light (Phase 64, MED-15). Angles are degrees. Azimuth wraps
     * into 0..360, elevation clamps into 0..90 and intensity into 0..4; a
     * non-finite value falls back to the default, and a field the caller omits is
     * left alone. An unchanged value writes nothing and redraws nothing.
     * Render-only: params, the pigment and the thickness field are never
     * touched, and the sheet is never marked dirty for undo (T-64-10).
     */
    setLight(next) {
      const azimuth = next.azimuth === void 0 ? this.light.azimuth : Number.isFinite(next.azimuth) ? next.azimuth : DEFAULT_LIGHT.azimuth;
      const elevation = next.elevation === void 0 ? this.light.elevation : Number.isFinite(next.elevation) ? next.elevation : DEFAULT_LIGHT.elevation;
      const intensity = next.intensity === void 0 ? this.light.intensity : Number.isFinite(next.intensity) ? next.intensity : DEFAULT_LIGHT.intensity;
      const resolved = {
        azimuth: (azimuth % 360 + 360) % 360,
        elevation: clamp(elevation, 0, 90),
        intensity: clamp(intensity, 0, 4)
      };
      if (resolved.azimuth === this.light.azimuth && resolved.elevation === this.light.elevation && resolved.intensity === this.light.intensity) return;
      this.light = resolved;
      this.redraw();
    }
    /** The current emboss light state (Phase 64). A copy: callers cannot mutate the engine. */
    getLight() {
      return { ...this.light };
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
        const max = Math.min(MAX_REF_SIDE, this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE));
        const s = Math.min(1, max / Math.max(img.width, img.height));
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
        [[ink.read.views[0], ink.write.views[0]], [ink.read.views[1], ink.write.views[1]], [wet.read.views[0], wet.write.views[0]], [this.relief.views[0]], [this.cover.read.views[0], this.cover.write.views[0]]],
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
    /**
     * 64-20 decision A — the capture-time clearance. A dedicated pass at the
     * export boundary (never the interactive displayFS output): the display's own
     * pigment RGBA is the source, and the shared FILM_PRESENCE snippet zeroes the
     * coverage alpha exactly where the final film reads paper-white on the
     * scan's own 8-bit grid. RGB passes through verbatim; every texel the film
     * does not clear is byte-identical.
     */
    clearPaperWhiteCoverage(target, source) {
      const { gl, g } = this;
      const p = this.programs.coverClear;
      p.bind();
      gl.uniform1i(p.u.uSrc, g.bindTex(0, source));
      gl.uniform1i(p.u.uPaper, g.bindTex(1, this.paper.tex[0]));
      gl.uniform1i(p.u.uInkA, g.bindTex(2, this.ink.read.tex[0]));
      gl.uniform1i(p.u.uInkB, g.bindTex(3, this.ink.read.tex[1]));
      gl.uniform1i(p.u.uFixedA, g.bindTex(4, this.fixed.tex[0]));
      gl.uniform1i(p.u.uFixedB, g.bindTex(5, this.fixed.tex[1]));
      gl.uniform1i(p.u.uCover, g.bindTex(6, this.cover.read.tex[0]));
      gl.uniform1f(p.u.uGranulation, this.params.granulation * 0.55);
      gl.disable(gl.BLEND);
      g.draw(target);
    }
    /** The composited document at full resolution as RGBA8 bytes, bottom row first. */
    readback(flat, mode = MODE.paper, texture = true) {
      const { gl, g, dw, dh } = this;
      const out = g.target(dw, dh, [RGBA8], gl.NEAREST);
      this.drawDisplay(out, { x: 0, y: 0, w: dw, h: dh }, null, flat, mode, texture);
      let read = out;
      if (mode === MODE.pigment) {
        read = g.target(dw, dh, [RGBA8], gl.NEAREST);
        this.clearPaperWhiteCoverage(read, out.tex[0]);
      }
      const px = new Uint8Array(dw * dh * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, read.fbo);
      gl.readPixels(0, 0, dw, dh, gl.RGBA, gl.UNSIGNED_BYTE, px);
      g.disposeTarget(out);
      if (read !== out) g.disposeTarget(read);
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
      const on = (el, type, fn, opts) => {
        el.addEventListener(type, fn, opts);
        this.disposers.push(() => el.removeEventListener(type, fn, opts));
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
      const end = (e) => {
        if (!this.stroke || e.pointerId !== this.stroke.pointerId) return;
        this.stroke.ending = true;
        this.schedule();
      };
      on(c, "pointerup", end);
      on(c, "pointercancel", end);
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
      let tx = e.tiltX || 0;
      let ty = e.tiltY || 0;
      const now = this.clock();
      const nativeActive = this.nativePenAt > -Infinity && now - this.nativePenAt < 300;
      const reportsPenDynamics = e.pointerType === "pen" && e.pressure !== 0.5 && e.pressure !== 0;
      if (nativeActive && this.nativePen && !reportsPenDynamics && (e.pointerType !== "mouse" || e.buttons > 0)) {
        p = this.nativePen.pressure;
        tx = this.nativePen.tiltX;
        ty = this.nativePen.tiltY;
      } else if (e.pointerType === "pen") {
        p = e.pressure > 0 ? Math.pow(e.pressure, 0.8) : 0.5;
      } else if (e.pointerType === "mouse" && now - this.force.t < 3e3) {
        p = this.force.value;
      }
      const sample = { x, y, p, t: e.timeStamp, tx, ty, w: 1 };
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
          const embossPress = EMBOSS_PRESS_FLOOR + (1 - EMBOSS_PRESS_FLOOR) * clamp(pr, 0, 1);
          const reliefAmount = P.emboss * amount * RELIEF_GAIN * embossPress;
          const coverAmount = Math.min(1, bodyCurve(P.body) * COVER_GAIN);
          const coverDensity = coverAmount > 0 ? COVER_MEDIUM_DENSITY * amount : 0;
          const coverRelief = coverAmount * RELIEF_ERODE;
          const wet = (0.25 + 0.75 * P.water) * (0.7 + 0.3 * pr) * b.water * (0.4 + 0.6 * reservoir);
          const c = this.pigment.coeffs;
          const c0 = [c[0] * amount, c[1] * amount, c[2] * amount, c[3] * amount];
          const c1 = [c[4] * amount, c[5] * amount, c[6] * amount, scatteringDeposit(P.body, amount)];
          if (coverAmount > 0) {
            const coverRect = this.stampRect(x, y, r * (1 + b.sizeJitter + b.scatter), this.dw, this.dh, 2);
            this.touch(coverRect);
            const m = PROTECT_MARGIN;
            this.history.protect(1, { x0: Math.max(0, coverRect.x0 - m), y0: Math.max(0, coverRect.y0 - m), x1: Math.min(this.dw, coverRect.x1 + m), y1: Math.min(this.dh, coverRect.y1 + m) }, this.fixed.views);
          }
          this.eachDab(s, x, y, r, (dx, dy, dr, angle) => {
            if (coverAmount > 0) this.coverPass(dx, dy, dr, angle, coverAmount, coverDensity, coverRelief, dryness, grainThr);
            if (coverAmount > 0) this.coverageDeposit(dx, dy, dr, angle, coverAmount, coverDensity, c, c1[3], dryness, grainThr);
            else this.brushInk(dx, dy, dr, angle, c0, c1, dryness, grainThr);
            if (reliefAmount > 0) this.brushRelief(dx, dy, dr, angle, reliefAmount, dryness, grainThr);
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
            [c[4] * amount, c[5] * amount, c[6] * amount, scatteringDeposit(P.body, amount)],
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
    eachDab(s, x, y, r, fn) {
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
        fn(dx, dy, dr, this.brushAngle(s));
      }
    }
    /**
     * Phase 64 (MED-14): every footprint uniform a stamp-family program reads,
     * bound from ONE place. drawStamp (pigment / water) and drawRelief (the
     * thickness deposit) share it, so a tip change can never diverge between the
     * two draws. `b` defaults to the active brush; Lift's erosion passes its own
     * brush and disables roughness / jitter so the mask is exactly the one
     * liftFS erodes pigment with.
     */
    bindFootprint(p, x, y, r, angle, round, grain, grainThr, b = this.brush, rough = b.roughness ?? 0, jitter = b.stampJitter ?? 0) {
      const { gl, g } = this;
      gl.uniform1i(p.u.uTip, g.bindTex(0, this.tipTexture(b)));
      gl.uniform1i(p.u.uPaper, g.bindTex(1, this.paper.tex[0]));
      gl.uniform1f(p.u.uAspect, this.dw / this.dh);
      gl.uniform2f(p.u.uPoint, x, y);
      gl.uniform1f(p.u.uRadius, r);
      gl.uniform1f(p.u.uTipAspect, b.aspect);
      gl.uniform1f(p.u.uTipRotation, (b.textureRotation ?? 0) * DEG2);
      gl.uniform2f(p.u.uAxis, Math.cos(angle), Math.sin(angle));
      gl.uniform1f(p.u.uRound, round);
      gl.uniform1f(p.u.uGrain, grain);
      gl.uniform1f(p.u.uGrainThr, grainThr);
      gl.uniform1f(p.u.uRough, rough);
      gl.uniform1f(p.u.uJitter, jitter);
    }
    drawStamp(t, x, y, r, angle, c0, c1, round, grain, grainThr) {
      const { gl, g } = this;
      const b = this.brush;
      const p = this.programs.stamp;
      p.bind();
      this.bindFootprint(p, x, y, r, angle, round, grain, grainThr);
      gl.uniform4fv(p.u.uColor0, c0);
      gl.uniform4fv(p.u.uColor1, c1);
      g.draw(t, this.stampRect(x, y, r, t.w, t.h, Math.sqrt(1 + b.aspect * b.aspect) * 1.02));
    }
    /**
     * Phase 64 (MED-14): draw the thickness deposit (or Lift's erosion) into the
     * relief target with the same footprint the pigment stamp uses. `rect`
     * defaults to the ink dab's rect; Lift passes its own rect with 0/0 grain and
     * 0 roughness / jitter, so the eroded mask matches liftFS exactly.
     */
    drawRelief(amount, x, y, r, angle, grain, grainThr, b = this.brush, rect = this.stampRect(x, y, r, this.dw, this.dh, 1.5), rough = b.roughness ?? 0, jitter = b.stampJitter ?? 0) {
      const { gl, g } = this;
      const p = this.programs.relief;
      p.bind();
      this.bindFootprint(p, x, y, r, angle, 0, grain, grainThr, b, rough, jitter);
      gl.uniform1f(p.u.uAmount, amount);
      g.draw(this.relief, rect);
    }
    /** Phase 64 (MED-14): additive per-dab thickness deposit. */
    brushRelief(x, y, r, angle, amount, grain, grainThr) {
      const { gl } = this;
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE);
      this.drawRelief(amount, x, y, r, angle, grain, grainThr);
      gl.disable(gl.BLEND);
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
    /**
     * Phase 64 (MED-19..MED-22, spec 06): the cover pass — per dab, erode the
     * SETTLED pigment and the paint thickness under the dab's own tip, before
     * the dab deposits. One multiplicative draw, no tissue-water step: Body is
     * order, not water.
     *
     * The erase mask is the deposit's own tip-space footprint (rotation, jitter,
     * paper tooth) with the deposit's LOW cut but a WIDE inward ramp, softened
     * before the tip square's cull, and its strength is the SPIKE 001 coverage
     * term `a = coverAmount * (1 - exp(-density * mask))` — the SAME `a` the
     * coverage composite lets the paint film hide. `fixed` loses exactly what
     * the film gains, so the body replaces the settled underlayer while the
     * tip's alpha rim and the bristle gaps keep a partial underlayer (the
     * old/new mix the edge needs).
     * The Body row sits between Viscosity and Emboss (D-07); spec 08's
     * scattering composes on top through the same curve.
     *
     * ONE extra multiplicative draw per dab into two targets that already
     * exist: no new target, no allocation. Undo is NOT taken here: the caller
     * protects both pools once per stamp, before the first call, because the
     * deposit's own undo protection comes too late to save a relief this draw
     * has already eroded.
     */
    coverPass(x, y, r, angle, amount, density, reliefAmount, grain, grainThr) {
      const { gl, g } = this;
      const p = this.programs.bodyCover;
      p.bind();
      this.bindFootprint(this.programs.bodyCover, x, y, r, angle, 0, grain, grainThr);
      gl.uniform1f(p.u.uAmount, amount);
      gl.uniform1f(p.u.uDensity, density);
      gl.uniform1f(p.u.uShape, 1);
      const rect = this.stampRect(x, y, r, this.dw, this.dh, 2);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);
      g.draw(this.fixed, rect);
      gl.uniform1f(p.u.uAmount, reliefAmount);
      gl.uniform1f(p.u.uShape, 0);
      g.draw(this.relief, rect);
      gl.disable(gl.BLEND);
    }
    /**
     * SPIKE 001: the coverage composite — source-over inside the pigment layer,
     * replacing "erase the underlayer, then deposit". Per dab, on one shared
     * footprint rect, three scissored draws:
     *
     *   ink   <- ink * (1 - a) + C * a      (attenuate, then add the masstone)
     *   fixed <- fixed * (1 - a)            (settled underlayer, same a; coverPass)
     *   cover <- cover * (1 - a) + a        (the compositor's layer alpha)
     *
     * `a = amount * (1 - exp(-density * footprintMask))` with `density` the
     * MEDIUM's per-dab density (see COVER_MEDIUM_DENSITY), so coverage is
     * pigment-independent. `C` is this dab's masstone absorbance, so overlapping
     * dabs are idempotent: the colour converges on the chosen pigment instead of
     * summing absorbances (the black drift), and a near-white pigment covers
     * because its coverage does not come from its darkness. No snapshot, no
     * ping-pong, no full-document pass.
     */
    coverageDeposit(x, y, r, angle, amount, density, coeffs, scatter, grain, grainThr) {
      const { gl, g } = this;
      this.touch(this.stampRect(x, y, r, this.dw, this.dh, 1.5));
      const rect = this.stampRect(x, y, r, this.dw, this.dh, 2);
      const c = this.programs.bodyCover;
      c.bind();
      this.bindFootprint(c, x, y, r, angle, 0, grain, grainThr);
      gl.uniform1f(c.u.uAmount, amount);
      gl.uniform1f(c.u.uDensity, density);
      gl.uniform1f(c.u.uShape, 1);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);
      g.draw(this.ink.read, rect);
      gl.disable(gl.BLEND);
      const d = this.programs.coverDeposit;
      d.bind();
      this.bindFootprint(d, x, y, r, angle, 0, grain, grainThr);
      gl.uniform4f(d.u.uColor0, coeffs[0], coeffs[1], coeffs[2], coeffs[3]);
      gl.uniform4f(d.u.uColor1, coeffs[4], coeffs[5], coeffs[6], scatter);
      gl.uniform1f(d.u.uAmount, amount);
      gl.uniform1f(d.u.uDensity, density);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE);
      g.draw(this.ink.read, rect);
      gl.disable(gl.BLEND);
      const m = this.programs.coverMask;
      m.bind();
      this.bindFootprint(m, x, y, r, angle, 0, grain, grainThr);
      gl.uniform1f(m.u.uAmount, amount);
      gl.uniform1f(m.u.uDensity, density);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      g.draw(this.cover.read, rect);
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
      return [this.ink.read.views[0], this.ink.read.views[1], this.wet.read.views[0], this.relief.views[0], this.cover.read.views[0]];
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
      g.draw(this.cover.read, rect);
      this.drawRelief(amount, x, y, r, angle, 0, 0, b, rect, 0, 0);
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
      const viscosity = this.params.viscosity;
      const rect = this.active;
      P.advectVelocity.bind();
      gl.uniform1i(P.advectVelocity.u.uVelocity, g.bindTex(0, vel.read.tex[0]));
      gl.uniform1i(P.advectVelocity.u.uWet, g.bindTex(1, this.wet.read.tex[0]));
      gl.uniform2fv(P.advectVelocity.u.uTexel, simTexel);
      gl.uniform1f(P.advectVelocity.u.uDt, dt);
      gl.uniform1f(P.advectVelocity.u.uDissipation, Math.exp(-dt * (3 - flow * 2.4 + viscosity * 12)) * (fixing ? Math.exp(-dt * 7) : 1));
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
      gl.uniform1f(P.advectWet.u.uSpread, 0.12 * (1 - viscosity * 0.9));
      g.draw(this.wet.write, rect);
      this.wet.swap();
      const settle = fixing ? 1 - Math.exp(-dt * 5) : 0;
      if (fixing) {
        gl.enable(gl.BLEND);
        gl.blendEquation(gl.FUNC_ADD);
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
      P.advectCover.bind();
      gl.uniform1i(P.advectCover.u.uVelocity, g.bindTex(0, vel.read.tex[0]));
      gl.uniform1i(P.advectCover.u.uCover, g.bindTex(1, this.cover.read.tex[0]));
      gl.uniform1i(P.advectCover.u.uWet, g.bindTex(2, this.wet.read.tex[0]));
      gl.uniform1i(P.advectCover.u.uInkA, g.bindTex(3, this.ink.read.tex[0]));
      gl.uniform1i(P.advectCover.u.uInkB, g.bindTex(4, this.ink.read.tex[1]));
      gl.uniform1i(P.advectCover.u.uFixedA, g.bindTex(5, this.fixed.tex[0]));
      gl.uniform1i(P.advectCover.u.uFixedB, g.bindTex(6, this.fixed.tex[1]));
      gl.uniform1i(P.advectCover.u.uPaper, g.bindTex(7, this.paper.tex[0]));
      gl.uniform2fv(P.advectCover.u.uSimTexel, simTexel);
      gl.uniform2fv(P.advectCover.u.uTexel, texel);
      gl.uniform1f(P.advectCover.u.uDt, dt);
      gl.uniform1f(P.advectCover.u.uBleed, this.params.bleed);
      gl.uniform1f(P.advectCover.u.uEdge, this.params.edge * 1.4);
      gl.uniform1f(P.advectCover.u.uAspect, this.dw / this.dh);
      gl.uniform1f(P.advectCover.u.uGranulation, this.params.granulation * 0.55);
      gl.uniform3f(P.advectCover.u.uBrush, this.brushNow.x, this.brushNow.y, this.brushNow.r);
      g.draw(this.cover.write, rect);
      this.cover.swap();
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
      gl.uniform1i(p.u.uRelief, g.bindTex(7, this.relief.tex[0]));
      gl.uniform1i(p.u.uCover, g.bindTex(8, this.cover.read.tex[0]));
      gl.uniform1f(p.u.uLightAzimuth, this.light.azimuth * Math.PI / 180);
      gl.uniform1f(p.u.uLightElevation, this.light.elevation * Math.PI / 180);
      gl.uniform1f(p.u.uLightIntensity, this.light.intensity);
      gl.uniform1f(p.u.uReliefBump, RELIEF_BUMP);
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

  // ../../../packages/efx-paint-host/dist/index.mjs
  function fnv1a(source) {
    let hash = 2166136261;
    for (let i = 0; i < source.length; i++) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
  function avalanche(hash) {
    let h = hash >>> 0;
    h ^= h >>> 15;
    h = Math.imul(h, 2246822519);
    h ^= h >>> 13;
    h = Math.imul(h, 3266489917);
    h ^= h >>> 16;
    return h >>> 0;
  }
  function hashMutationId(mutationId) {
    return avalanche(fnv1a(`mutation:${mutationId ?? 0}`));
  }
  function mixStrokeSeed(strokeSeed, frame) {
    const base = Number.isFinite(strokeSeed) ? strokeSeed >>> 0 : 0;
    const local = Number.isFinite(frame) ? Math.trunc(frame) : 0;
    return avalanche(fnv1a(`paint-seed:${base}:${local}`));
  }

  // ../../../packages/efx-watercolor/src/payload/vectorPath.ts
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

  // ../../../packages/efx-watercolor/src/payload/toStudioStroke.ts
  var AQUARELLE_TOOLS = Object.freeze([
    "brush",
    "water",
    "pen",
    "lift"
  ]);
  var DIFFUSION_CAP = 600;

  // ../../../packages/efx-watercolor/src/payload/dryEvent.ts
  function isAquarelleDryEvent(value) {
    if (typeof value !== "object" || value === null) return false;
    const v = value;
    return v["kind"] === "dry";
  }

  // ../../../packages/efx-watercolor/src/payload/codec.ts
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

  // ../../../packages/efx-watercolor/src/brushes/deriveMask.ts
  var TIP_MASK_EDGE = 512;
  var TIP_MASK_BYTES = TIP_MASK_EDGE * TIP_MASK_EDGE;

  // ../../../packages/efx-watercolor/src/brushes/maskRegistry.ts
  var masks = /* @__PURE__ */ new Map();
  function resolveMask(id) {
    return masks.get(id) ?? null;
  }

  // ../../../packages/efx-watercolor/src/playground/brushBridge.ts
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

  // ../../../packages/efx-watercolor/src/adapter/engineAdapter.ts
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
    if (options.light && engine) {
      engine.setLight({ ...options.light });
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

  // workbench/src/playground/params.ts
  var DEFAULT_CANONICAL_PARAMS2 = Object.freeze({
    size: 12,
    water: 50,
    load: 50,
    flow: 50,
    bleed: 50,
    dry: 50,
    edge: 50,
    granulation: 50,
    lift: 22,
    viscosity: 0,
    body: 0,
    emboss: 0
  });
  function num2(v, fallback) {
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
  }
  function clamp014(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
  var LEGACY_SIZE_MAX_PX2 = 80;
  var SIZE_MAX_PX2 = 800;
  var SIZE_SCALE_AT_MAX2 = 2.04795;
  var SIZE_SCALE_HARD_MAX2 = 4;
  function sizeToEngineScale2(sizePx) {
    if (sizePx <= 32) return sizePx / 32;
    if (sizePx <= LEGACY_SIZE_MAX_PX2) return 1;
    const t = (sizePx - LEGACY_SIZE_MAX_PX2) / (SIZE_MAX_PX2 - LEGACY_SIZE_MAX_PX2);
    return Math.min(SIZE_SCALE_HARD_MAX2, 1 + t * (SIZE_SCALE_AT_MAX2 - 1));
  }
  function toEngineParams2(canonical) {
    const p = canonical ?? {};
    const d = DEFAULT_CANONICAL_PARAMS2;
    return {
      size: sizeToEngineScale2(num2(p.size, d.size)),
      water: num2(p.water, d.water) / 100,
      load: num2(p.load, d.load) / 100,
      flow: num2(p.flow, d.flow) / 100,
      bleed: num2(p.bleed, d.bleed) / 100,
      dry: num2(p.dry, d.dry) / 100,
      edge: num2(p.edge, d.edge) / 100,
      granulation: num2(p.granulation, d.granulation) / 100,
      lift: num2(p.lift, d.lift) / 100,
      viscosity: clamp014(num2(p.viscosity, d.viscosity) / 100),
      body: clamp014(num2(p.body, d.body) / 100),
      emboss: clamp014(num2(p.emboss, d.emboss) / 100)
    };
  }

  // workbench/src/playground/mediums.ts
  var MEDIUM_IDS2 = Object.freeze([
    "watercolor",
    "gouache",
    "pastel",
    "graphite",
    "acrylic"
  ]);
  var WATERCOLOR_PARAMS2 = Object.freeze({
    water: DEFAULT_CANONICAL_PARAMS2.water,
    load: DEFAULT_CANONICAL_PARAMS2.load,
    flow: DEFAULT_CANONICAL_PARAMS2.flow,
    bleed: DEFAULT_CANONICAL_PARAMS2.bleed,
    dry: DEFAULT_CANONICAL_PARAMS2.dry,
    edge: DEFAULT_CANONICAL_PARAMS2.edge,
    granulation: DEFAULT_CANONICAL_PARAMS2.granulation,
    viscosity: DEFAULT_CANONICAL_PARAMS2.viscosity,
    body: DEFAULT_CANONICAL_PARAMS2.body,
    emboss: DEFAULT_CANONICAL_PARAMS2.emboss
  });
  var MEDIUMS2 = Object.freeze([
    Object.freeze({ id: "watercolor", name: "Watercolor", params: WATERCOLOR_PARAMS2 }),
    Object.freeze({
      id: "gouache",
      name: "Gouache",
      params: Object.freeze({
        water: 35,
        load: 70,
        flow: 55,
        bleed: 25,
        dry: 60,
        edge: 60,
        granulation: 40,
        viscosity: 55,
        body: 55,
        emboss: 20
      })
    }),
    Object.freeze({
      id: "pastel",
      // Displays as "Chalk" so the dropdown name and the brush-library section
      // header (D-18) are the same word over the pastel group.
      name: "Chalk",
      params: Object.freeze({
        water: 0,
        load: 65,
        flow: 30,
        bleed: 0,
        dry: 80,
        edge: 70,
        granulation: 60,
        viscosity: 85,
        body: 25,
        emboss: 0
      })
    }),
    Object.freeze({
      id: "graphite",
      name: "Graphite",
      params: Object.freeze({
        water: 0,
        load: 45,
        flow: 25,
        bleed: 0,
        dry: 85,
        edge: 75,
        granulation: 100,
        viscosity: 90,
        body: 0,
        emboss: 0
      })
    }),
    Object.freeze({
      id: "acrylic",
      name: "Acrylic",
      params: Object.freeze({
        water: 8,
        load: 100,
        flow: 50,
        bleed: 10,
        dry: 70,
        edge: 65,
        granulation: 25,
        viscosity: 90,
        body: 85,
        emboss: 40
      })
    })
  ]);

  // workbench/src/playground/brushes.ts
  function brushTipCacheKey2(b) {
    return `${b.id}|${b.textureId ?? ""}`;
  }
  function tipRowsForUpload2(data, size) {
    if (size <= 1 || data.length !== size * size) return data;
    const out = new Uint8Array(data.length);
    for (let row = 0; row < size; row++) {
      const source = (size - 1 - row) * size;
      out.set(data.subarray(source, source + size), row * size);
    }
    return out;
  }
  var TIP_SIZE2 = 192;
  var DEG3 = Math.PI / 180;
  var Noise2 = class {
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
      let v = 0, amp = 0.5, sum = 0;
      for (let i = 0; i < octaves; i++) {
        v += amp * this.value(x, y);
        sum += amp;
        x = x * 2.03 + 17.1;
        y = y * 2.01 + 9.7;
        amp *= 0.5;
      }
      return v / sum;
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
  var clamp015 = (v) => Math.min(1, Math.max(0, v));
  var smoothstep2 = (a, b, x) => {
    const t = clamp015((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  var soft2 = (r, hard) => 1 - smoothstep2(hard, 1, r);
  function tip2(fn) {
    return (n) => {
      const out = new Float32Array(n * n);
      for (let j = 0; j < n; j++) {
        const v = (j + 0.5) / n * 2 - 1;
        for (let i = 0; i < n; i++) {
          const u = (i + 0.5) / n * 2 - 1;
          out[j * n + i] = clamp015(fn(u, v, Math.hypot(u, v), Math.atan2(v, u)));
        }
      }
      return out;
    };
  }
  function hairs2(segments, width, u, v) {
    let sum = 0;
    for (const [ax, ay, bx, by] of segments) {
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
      const t = clamp015(((u - ax) * dx + (v - ay) * dy) / len2);
      const d = Math.hypot(u - ax - dx * t, v - ay - dy * t);
      sum += Math.exp(-(d * d) / (width * width));
    }
    return sum;
  }
  function bristleTip2(n, N) {
    const segs = [];
    const count = 14;
    for (let i = 0; i < count; i++) {
      const x = -0.92 + 1.84 * i / (count - 1) + (N.rnd() - 0.5) * 0.06;
      segs.push([x * 0.35, -0.95, x, 0.95]);
    }
    return tip2((u, v) => {
      const edge = 1 - smoothstep2(0.86, 1, Math.abs(v));
      const taper = 1 - 0.25 * smoothstep2(0.7, 1, Math.abs(v));
      return Math.min(1, hairs2(segs, 0.052, u, v)) * edge * taper;
    })(n);
  }
  var BASE2 = {
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
  var define2 = (p) => ({ ...BASE2, ...p });
  var brushGroupOrder2 = Object.freeze([
    "watercolor",
    "gouache",
    "pastel",
    "graphite",
    "acrylic"
  ]);
  var brushGroupLabels2 = Object.freeze({
    watercolor: "Watercolor",
    gouache: "Gouache",
    pastel: "Chalk",
    graphite: "Graphite",
    acrylic: "Acrylic"
  });
  var BRUSH_PRESETS2 = [
    // 261027-gh9f: dry media and the FIRST card in the Brush tab grid. The
    // footprint range is deliberately small so the top-bar size slider reaches a
    // true hairline at 1; `roughness` re-thresholds the tip per dab in the stamp
    // shader (net, crumbly edges instead of a feathered alpha ramp) and
    // `stampJitter` shifts each dab's slice of the tip so the silhouette breaks
    // up randomly along the stroke. water 0 deposits no wetness by construction
    // (the engine multiplies `b.water` into the wet amount) and the engine now
    // also skips the velocity splat for a waterless brush, so strokes never mix
    // like a wet medium.
    define2({
      id: "chalk",
      name: "Chalk",
      hint: "Dry chalk stick: grainy core, crumbling edges, no wet bloom",
      group: "pastel",
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
      tip: (n, N) => tip2((u, v, r, ang) => {
        const lobes = N.fbm(ang * 2.1 + 1.6, r * 3.2, 3) * 2 - 1;
        const fibres = N.fbm(ang * 9.5 + 4.2, r * 5.5, 2) * 2 - 1;
        const splits = N.fbm(ang * 23 + 8.7, r * 7, 2) * 2 - 1;
        const contour = 0.87 + 0.11 * lobes + 0.06 * fibres + 0.035 * splits;
        const body = 1 - smoothstep2(contour - 8e-3, contour + 8e-3, r);
        const rim = smoothstep2(0.5, 0.95, r);
        const bite = smoothstep2(0.3, 0.5, N.fbm(u * 14 + 11, v * 14 + 3, 4));
        const chip = 1 - rim * 0.85 * (1 - bite);
        const pores = smoothstep2(0.18, 0.42, N.fbm(u * 30 + 5, v * 30 + 11, 3));
        const poreDepth = 0.24 + 0.45 * smoothstep2(0.25, 0.95, r);
        const crumble = 1 - poreDepth * (1 - pores);
        const grit = 0.7 + 0.3 * N.fbm(u * 64 + 3, v * 64 + 7, 2);
        return body * chip * crumble * grit;
      })(n)
    }),
    define2({
      id: "round",
      name: "Round",
      hint: "A pointed round #8: the everyday brush",
      group: "watercolor",
      tip: (n, N) => tip2((u, v, r, ang) => {
        const rr = r * (1 + 0.08 * (N.fbm(ang * 0.8 + 3, r * 2.5) * 2 - 1));
        return soft2(rr, 0.3) * (1 - 0.12 * N.fbm(u * 5, v * 5));
      })(n)
    }),
    define2({
      id: "detail",
      name: "Detail",
      hint: "A small round #2 for fine work",
      group: "watercolor",
      size: [25e-4, 0.014],
      pressureSize: 0.9,
      water: 0.7,
      load: 1.15,
      capacity: 0.6,
      spacing: 0.28,
      wetRound: 0.8,
      tip: (n) => tip2((_u, _v, r) => soft2(r, 0.55))(n)
    }),
    define2({
      id: "rigger",
      name: "Rigger",
      hint: "Long thin liner: holds a lot of paint for continuous lines",
      group: "watercolor",
      size: [15e-4, 65e-4],
      pressureSize: 0.7,
      speedThin: 0.08,
      water: 0.55,
      load: 1.3,
      capacity: 1.8,
      spacing: 0.25,
      wetRound: 0.9,
      tip: (n) => tip2((_u, _v, r) => soft2(r, 0.65))(n)
    }),
    define2({
      id: "flat",
      name: "Flat",
      hint: 'A \xBD" flat: thick or thin depending on direction; tilt the pen to turn it',
      group: "watercolor",
      aspect: 0.26,
      rotation: "fixed",
      angle: 40,
      angleJitter: 1.5,
      size: [0.02, 0.038],
      pressureSize: 1.4,
      spacing: 0.14,
      water: 0.8,
      wetRound: 0.25,
      tip: (n, N) => tip2((u, v) => {
        const chisel = 0.06 * (N.fbm(v * 3 + 9, 2, 3) * 2 - 1);
        const ex = 1 - smoothstep2(0.8, 0.98, Math.abs(u) + chisel);
        const ey = 1 - smoothstep2(0.8, 1, Math.abs(v));
        const bristles = 1 - 0.4 * smoothstep2(0.4, 0.75, N.fbm(u * 10, v * 0.7, 3));
        return ex * ey * bristles;
      })(n)
    }),
    define2({
      id: "hake",
      name: "Hake",
      hint: "Wide soft goat-hair wash brush; streaky, carries lots of water",
      group: "watercolor",
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
      tip: (n, N) => tip2((u, v) => {
        const ex = 1 - smoothstep2(0.72, 1, Math.abs(u) + 0.1 * (N.fbm(v * 2 + 4, 1, 3) * 2 - 1));
        const ey = 1 - smoothstep2(0.55, 1, Math.abs(v));
        const bristles = 1 - 0.65 * smoothstep2(0.35, 0.7, N.fbm(u * 16, v * 0.9, 3));
        const gaps = smoothstep2(0.25, 0.45, N.fbm(u * 7 + 20, v * 0.4, 2));
        return ex * ey * bristles * (0.4 + 0.6 * gaps);
      })(n)
    }),
    define2({
      id: "filbert",
      name: "Filbert",
      hint: "Oval tip: soft rounded marks that change with direction",
      group: "watercolor",
      aspect: 0.55,
      rotation: "fixed",
      angle: 25,
      angleJitter: 2,
      size: [0.012, 0.036],
      spacing: 0.18,
      wetRound: 0.5,
      tip: (n, N) => tip2((u, _v, r) => soft2(r, 0.45) * (1 - 0.25 * N.fbm(u * 8, 0.7, 3)))(n)
    }),
    define2({
      id: "mop",
      name: "Mop",
      hint: "Big squirrel mop: floods the paper for washes",
      group: "watercolor",
      size: [0.03, 0.075],
      pressureSize: 0.8,
      spacing: 0.25,
      water: 1.8,
      load: 0.8,
      flow: 1.3,
      capacity: 2.6,
      wetRound: 0.7,
      tip: (n, N) => tip2((u, v, r, ang) => {
        const rr = r * (1 + 0.22 * (N.fbm(ang * 1.2, 1.7, 3) * 2 - 1));
        return Math.pow(soft2(rr, 0.1), 1.3) * (1 - 0.25 * N.fbm(u * 3, v * 3));
      })(n)
    }),
    define2({
      id: "dry",
      name: "Dry Brush",
      hint: "Scruffy bristles with little water: skips over the paper tooth",
      group: "pastel",
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
      tip: (n, N) => tip2((u, v, r) => {
        const holes = smoothstep2(0.42, 0.62, N.fbm(u * 5.5, v * 5.5, 5));
        const streaks = 1 - 0.3 * N.fbm(u * 14, v * 1.2, 3);
        return soft2(r, 0.2) * holes * streaks;
      })(n)
    }),
    define2({
      id: "fan",
      name: "Fan",
      hint: "Splayed hairs: grass, fur and fine parallel texture",
      group: "pastel",
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
        return tip2((u, v) => Math.min(1, hairs2(segs, 0.045, u, v)) * (1 - smoothstep2(0.85, 1, Math.abs(v))))(n);
      }
    }),
    define2({
      id: "sponge",
      name: "Sponge",
      hint: "Natural sponge: dabbed cellular texture for foliage and stone",
      group: "watercolor",
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
      tip: (n, N) => tip2((u, v, r) => {
        const [f1, f2] = N.worley(u * 4.5, v * 4.5);
        return soft2(r, 0.55) * smoothstep2(0.03, 0.14, f2 - f1) * (0.55 + 0.45 * N.fbm(u * 7, v * 7, 3));
      })(n)
    }),
    define2({
      id: "spatter",
      name: "Spatter",
      hint: "Flicked droplets: sparse at a light touch, dense when pressing",
      group: "watercolor",
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
      tip: (n) => tip2((_u, _v, r) => soft2(r, 0.72))(n)
    }),
    define2({
      id: "sumi",
      name: "Sumi",
      hint: "Oriental brush: hairline to broad with pressure, fibrous edges",
      group: "watercolor",
      size: [2e-3, 0.052],
      pressureSize: 1.3,
      speedThin: 0.12,
      spacing: 0.22,
      water: 0.8,
      load: 1.3,
      capacity: 1.2,
      wetRound: 0.75,
      tip: (n, N) => tip2((_u, _v, r, ang) => {
        const rr = r * (1 + 0.35 * (N.fbm(ang * 2.5 + r * 2, 1, 3) * 2 - 1));
        return Math.pow(soft2(rr, 0.25), 1.5) * (1 - 0.3 * N.fbm(r * 8, ang * 3, 3));
      })(n)
    }),
    define2({
      id: "dagger",
      name: "Dagger",
      hint: "Sword liner: calligraphic strokes from a tapered blade",
      group: "watercolor",
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
      tip: (n) => tip2((u, v) => {
        const t = (u + 1) / 2;
        const w = Math.sqrt(Math.max(0, 4 * t * (1 - t))) * (1 - 0.5 * t);
        return 1 - smoothstep2(w * 0.8, w, Math.abs(v));
      })(n)
    }),
    define2({
      id: "stipple",
      name: "Stipple",
      hint: "A cluster of hard dots: pointillist texture",
      group: "pastel",
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
        return tip2((u, v) => {
          let m = 0;
          for (const [x, y, rd] of dots) m = Math.max(m, soft2(Math.hypot(u - x, v - y) / rd, 0.6));
          return m;
        })(n);
      }
    }),
    /* ---------------------------------------------------------------------
     * Phase 64 (MED-29): the eight responses the medium taxonomy needs. They
     * APPEND after the legacy fifteen — never rename or reorder an existing id,
     * because a stroke persists the response id and an unknown id replays as
     * the round. Every field the spec table does not name inherits `BASE`.
     * ------------------------------------------------------------------- */
    define2({
      id: "gouache-round",
      name: "Gouache Round",
      hint: "Opaque body colour: soft edge, dense flat deposit",
      group: "gouache",
      size: [4e-3, 0.02],
      spacing: 0.2,
      water: 0.35,
      load: 1.4,
      flow: 0.6,
      capacity: 1.4,
      grain: 0.2,
      wetRound: 0.2,
      roughness: 0.25,
      tip: (n) => tip2((_u, _v, r) => soft2(r, 0.42))(n)
    }),
    define2({
      id: "gouache-flat",
      name: "Gouache Flat",
      hint: "Flat body stroke: crisp chisel edge with opaque load",
      group: "gouache",
      aspect: 0.45,
      rotation: "follow",
      size: [0.01, 0.03],
      spacing: 0.16,
      water: 0.3,
      load: 1.5,
      flow: 0.55,
      capacity: 1.6,
      grain: 0.25,
      wetRound: 0.15,
      roughness: 0.3,
      tip: (n, N) => tip2((u, v) => {
        const ex = 1 - smoothstep2(0.82, 0.98, Math.abs(u));
        const ey = 1 - smoothstep2(0.7, 1, Math.abs(v));
        return ex * ey * (0.85 + 0.15 * N.fbm(u * 12, v * 3, 2));
      })(n)
    }),
    define2({
      id: "pastel-soft",
      name: "Soft Pastel",
      hint: "Soft pastel stick: powdery core, broad crumbly edge",
      group: "pastel",
      aspect: 0.75,
      water: 0,
      load: 1.3,
      capacity: 1.3,
      grain: 0.55,
      roughness: 0.5,
      stampJitter: 0.15,
      spacing: 0.18,
      tip: (n, N) => tip2((u, v, r) => soft2(r, 0.5) * (0.75 + 0.25 * N.fbm(u * 9, v * 9, 2)))(n)
    }),
    define2({
      id: "conte-hard",
      name: "Cont\xE9 Hard",
      hint: "Hard crayon: narrow dark core, crumbling edges",
      group: "pastel",
      aspect: 0.6,
      water: 0,
      load: 1.5,
      capacity: 0.9,
      grain: 0.35,
      roughness: 0.8,
      stampJitter: 0.08,
      tip: (n, N) => tip2((u, v, r) => (1 - smoothstep2(0.55, 0.72, r)) * (0.7 + 0.3 * N.fbm(u * 16 + 3, v * 16 + 7, 3)))(n)
    }),
    define2({
      id: "graphite-pencil",
      name: "Graphite Pencil",
      hint: "Fine graphite: tooth-gated, thin and dark",
      group: "graphite",
      size: [8e-4, 45e-4],
      pressureSize: 1.35,
      spacing: 0.15,
      scatter: 0.05,
      water: 0,
      load: 0.75,
      flow: 0.3,
      capacity: 0.5,
      grain: 1,
      roughness: 0.3,
      tip: (n) => tip2((_u, _v, r) => soft2(r, 0.6))(n)
    }),
    define2({
      id: "graphite-6b",
      name: "Graphite 6B",
      hint: "Broad soft graphite: dark shoulder, dusty edge",
      group: "graphite",
      size: [2e-3, 0.012],
      aspect: 0.85,
      load: 1.4,
      grain: 0.85,
      scatter: 0.18,
      spacing: 0.2,
      tip: (n, N) => tip2((u, v, r) => soft2(r, 0.5) * (0.8 + 0.2 * N.fbm(u * 11, v * 11, 2)))(n)
    }),
    define2({
      id: "bristle-flat",
      name: "Bristle Flat",
      hint: "Thick acrylic flat: directional hair marks, hard body",
      group: "acrylic",
      aspect: 0.28,
      rotation: "follow",
      water: 0.05,
      load: 1.5,
      flow: 0.5,
      capacity: 1.8,
      grain: 0.15,
      spacing: 0.1,
      roughness: 0.55,
      stampJitter: 0.06,
      tip: bristleTip2
    }),
    define2({
      id: "bristle-round",
      name: "Bristle Round",
      hint: "Round acrylic brush with body: springy, loaded hairs",
      group: "acrylic",
      aspect: 0.7,
      rotation: "follow",
      water: 0.06,
      load: 1.4,
      capacity: 1.6,
      grain: 0.15,
      roughness: 0.4,
      spacing: 0.14,
      tip: bristleTip2
    })
  ];
  var CUSTOM_BASE2 = {
    ...BASE2,
    rotation: "follow",
    angleJitter: 4,
    spacing: 0.2,
    wetRound: 0.4
  };
  function buildBrush2(preset, seed = 7) {
    const { tip: source, ...rest } = preset;
    let tipData, tipSize;
    if (source instanceof Uint8Array) {
      tipData = source;
      tipSize = Math.round(Math.sqrt(source.length));
    } else {
      tipSize = TIP_SIZE2;
      const f = source(tipSize, new Noise2(seed + hashString2(preset.id)));
      tipData = new Uint8Array(f.length);
      for (let i = 0; i < f.length; i++) tipData[i] = Math.round(clamp015(f[i]) * 255);
    }
    let sum = 0;
    for (let i = 0; i < tipData.length; i++) sum += tipData[i];
    return { ...rest, tipSize, tipData, tipMean: Math.max(0.01, sum / (255 * tipData.length)) };
  }
  function hashString2(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  // workbench/src/playground/half.ts
  var f322 = new Float32Array(1);
  var u322 = new Uint32Array(f322.buffer);
  function toHalf2(v) {
    f322[0] = v;
    const x = u322[0];
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
  function f32ToF162(src, dst, n = src.length) {
    for (let i = 0; i < n; i++) dst[i] = toHalf2(src[i]);
  }

  // workbench/src/playground/gl.ts
  var QUAD_VS2 = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
  var GL2 = class {
    gl;
    vs;
    resources = /* @__PURE__ */ new Map();
    constructor(gl) {
      this.gl = gl;
      this.vs = this.compile(gl.VERTEX_SHADER, QUAD_VS2);
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
    target(w, h, formats, filter) {
      const { gl } = this;
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      const tex = [];
      const views = [];
      formats.forEach((f, i) => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
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
    double(w, h, formats, filter) {
      let a = this.target(w, h, formats, filter);
      let b = this.target(w, h, formats, filter);
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
    texture(w, h, f, data, filter) {
      const { gl } = this;
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, f.internal, w, h, 0, f.format, f.type, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
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
      const format = gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_FORMAT);
      const direct = format === gl.RGBA && type === gl.HALF_FLOAT;
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
            f32ToF162(band32, out.subarray(y * rw * 4), n * rw * 4);
            continue;
          }
          src = new Uint16Array(n * rw * 4);
          f32ToF162(band32, src, n * rw * 4);
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
    uploadHalf(tex, x, y, w, h, format, data) {
      const { gl } = this;
      if (w <= 0 || h <= 0) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 2);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, format, gl.HALF_FLOAT, data);
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

  // workbench/src/playground/history.ts
  var TILE2 = 128;
  var Pool2 = class {
    atlas;
    /** One tile per layer, so undo can swap a tile's content without allocating a slot. */
    scratch;
    cols;
    free = [];
    constructor(g, tiles, formats) {
      const maxTex = g.gl.getParameter(g.gl.MAX_TEXTURE_SIZE);
      this.cols = Math.min(tiles, Math.floor(maxTex / TILE2));
      const rows = Math.ceil(tiles / this.cols);
      this.atlas = formats.map((f) => g.target(this.cols * TILE2, rows * TILE2, [f], g.gl.NEAREST));
      this.scratch = formats.map((f) => g.target(TILE2, TILE2, [f], g.gl.NEAREST));
      for (let i = tiles - 1; i >= 0; i--) this.free.push(i);
    }
    dispose(g) {
      [...this.atlas, ...this.scratch].forEach((t) => g.disposeTarget(t));
    }
  };
  var History2 = class {
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
      this.tilesX = Math.ceil(this.w / TILE2);
      this.tilesY = Math.ceil(this.h / TILE2);
      const tiles = this.tilesX * this.tilesY;
      this.pools = this.groups.map((gr) => new Pool2(this.g, Math.ceil(tiles * gr.documents), gr.formats));
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
      const tx0 = Math.max(0, Math.floor(rect.x0 / TILE2)), tx1 = Math.min(this.tilesX - 1, Math.floor((rect.x1 - 1) / TILE2));
      const ty0 = Math.max(0, Math.floor(rect.y0 / TILE2)), ty1 = Math.min(this.tilesY - 1, Math.floor((rect.y1 - 1) / TILE2));
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const id = ty * this.tilesX + tx;
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
          const tx = id % this.tilesX, ty = Math.floor(id / this.tilesX);
          const w = Math.min(TILE2, this.w - tx * TILE2), h = Math.min(TILE2, this.h - ty * TILE2);
          const sx = slot % pool.cols * TILE2, sy = Math.floor(slot / pool.cols) * TILE2;
          layers[p].forEach((fbs, i) => {
            const atlas = pool.atlas[i].views[0], scratch = pool.scratch[i].views[0];
            this.g.blit(fbs[0], tx * TILE2, ty * TILE2, scratch, 0, 0, w, h);
            for (const fb of fbs) this.g.blit(atlas, sx, sy, fb, tx * TILE2, ty * TILE2, w, h);
            this.g.blit(scratch, 0, 0, atlas, sx, sy, w, h);
          });
          const r = { x0: tx * TILE2, y0: ty * TILE2, x1: tx * TILE2 + w, y1: ty * TILE2 + h };
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
      const tx = id % this.tilesX * TILE2, ty = Math.floor(id / this.tilesX) * TILE2;
      const sx = slot % pool.cols * TILE2, sy = Math.floor(slot / pool.cols) * TILE2;
      const w = Math.min(TILE2, this.w - tx), h = Math.min(TILE2, this.h - ty);
      layers.forEach((fb, i) => {
        const atlas = pool.atlas[i].views[0];
        if (save) this.g.blit(fb, tx, ty, atlas, sx, sy, w, h);
        else this.g.blit(atlas, sx, sy, fb, tx, ty, w, h);
      });
    }
  };

  // workbench/src/playground/papers.ts
  var PAPERS2 = [
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
  var DEFAULT_PAPER2 = PAPERS2[0];
  function linearRGB2(hex) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => {
      c /= 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return [f(n >> 16 & 255), f(n >> 8 & 255), f(n & 255)];
  }

  // workbench/src/playground/scattering.ts
  var BODY_CURVE_EXPONENT2 = 6;
  var SCATTERING_MAX2 = 1;
  var SCATTER_EPSILON2 = 1e-3;
  function clamp016(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
  function bodyCurve2(body) {
    if (!Number.isFinite(body)) return 0;
    return Math.pow(clamp016(body), BODY_CURVE_EXPONENT2);
  }
  function scatteringDeposit2(body, amount) {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    return SCATTERING_MAX2 * bodyCurve2(body) * amount;
  }

  // workbench/src/playground/spectralData.ts
  var SPECTRAL_EPSILON2 = 1e-4;
  var PRIMARIES2 = [[0.96853629, 0.51567122, 0.02055257, 0.03147571, 0.49108579, 0.97901834], [0.96855103, 0.5401552, 0.02059936, 0.03146636, 0.46944057, 0.97901649], [0.96859338, 0.62645502, 0.02062723, 0.03140624, 0.4016578, 0.97901118], [0.96877345, 0.75595012, 0.02073387, 0.03119611, 0.2449042, 0.97892146], [0.96942204, 0.92826996, 0.02114202, 0.03053888, 0.0682688, 0.97858555], [0.97143709, 0.97223624, 0.02233154, 0.02856855, 0.02732883, 0.97743705], [0.97541862, 0.98616174, 0.02556857, 0.02459485, 0.013606, 0.97428075], [0.98074186, 0.98955255, 0.03330189, 0.0192952, 0.01000187, 0.96663223], [0.98580992, 0.98676237, 0.05185294, 0.01423112, 0.01284127, 0.94822893], [0.98971194, 0.97312575, 0.10087639, 0.01033111, 0.02636635, 0.89937713], [0.99238027, 0.91944277, 0.24000413, 765876e-8, 0.07058713, 0.76070164], [0.99409844, 0.32564851, 0.53589066, 593693e-8, 0.70421692, 0.4642044], [0.995172, 0.13820628, 0.79874659, 485616e-8, 0.85473994, 0.20123039], [0.99576545, 0.05015143, 0.91186529, 426186e-8, 0.95081565, 0.08808402], [0.99593552, 0.02912336, 0.95399623, 409039e-8, 0.9717037, 0.04592894], [0.99564041, 0.02421691, 0.97137099, 438375e-8, 0.97651888, 0.02860373], [0.99464769, 0.02660696, 0.97939505, 537525e-8, 0.97429245, 0.02060067], [0.99229579, 0.03407586, 0.98345207, 772962e-8, 0.97012917, 0.01656701], [0.98638762, 0.04835936, 0.98553736, 0.0136612, 0.9425863, 0.01451549], [0.96829712, 1172e-7, 0.98648905, 0.03181352, 0.99989207, 0.01357964], [0.89228016, 8554e-8, 0.98674535, 0.10791525, 0.99989891, 0.01331243], [0.53740239, 0.85267882, 0.98657555, 0.46249516, 0.13823139, 0.01347661], [0.15360445, 0.93188793, 0.98611877, 0.84604333, 0.06968113, 0.01387181], [0.05705719, 0.94810268, 0.98559942, 0.94275572, 0.05628787, 0.01435472], [0.03126539, 0.94200977, 0.98507063, 0.96860996, 0.06111561, 0.01479836], [0.02205445, 0.91478045, 0.98460039, 0.97783966, 0.08987709, 0.0151525], [0.01802271, 0.87065445, 0.98425301, 0.98187757, 0.13656016, 0.01540513], [0.0161346, 0.78827548, 0.98403909, 0.98377315, 0.22169624, 0.01557233], [0.01520947, 0.65738359, 0.98388535, 0.98470202, 0.32176956, 0.0156571], [0.01475977, 0.59909403, 0.98376116, 0.98515481, 0.36157329, 0.01571025], [0.01454263, 0.56817268, 0.98368246, 0.98537114, 0.4836192, 0.01571916], [0.01444459, 0.54031997, 0.98365023, 0.98546685, 0.46488579, 0.01572133], [0.01439897, 0.52110241, 0.98361309, 0.98550011, 0.47440306, 0.01572502], [0.0143762, 0.51041094, 0.98357259, 0.98551031, 0.4857699, 0.01571717], [0.01436343, 0.50526577, 0.98353856, 0.98550741, 0.49267971, 0.01571905], [0.01435687, 0.5025508, 0.98351247, 0.98551323, 0.49625685, 0.01571059], [0.0143537, 0.50126452, 0.98350101, 0.98551563, 0.49807754, 0.01569728], [0.01435408, 0.50083021, 0.98350852, 0.98551547, 0.49889859, 0.0157002]];
  var BASIS2 = [[0.1441295, 0.1442537, 0.1447023, 0.1481238, 0.1558969, 0.1598567, 0.1620447, 0.1627555, 0.1616249, 0.1577825, 0.1510664, 0.1434845, 0.1548815, 0.1665376, 0.1732235, 0.176503, 0.1775172, 0.1768919, 0.1748587, 0.1783071, 0.17098, 0.1527153, 0.1627231, 0.169401, 0.1714174, 0.170287, 0.1680602, 0.1648873, 0.162965, 0.1626282, 0.159549, 0.1605975, 0.1607086, 0.1606138, 0.1605312, 0.1604933, 0.1604751, 0.160461], [-0.2038064, -0.203989, -0.2047454, -0.2096147, -0.2221909, -0.229624, -0.2342462, -0.2354314, -0.2303617, -0.2137209, -0.1783547, -0.124576, -0.08767601, -0.06654336, -0.05408394, -0.04631953, -0.04068168, -0.03551027, -0.02914774, -0.01869558, 0.01093349, 0.05936064, 0.1243476, 0.151563, 0.1619576, 0.1663112, 0.1683766, 0.1696986, 0.171131, 0.1718488, 0.1723758, 0.1726696, 0.172894, 0.1730376, 0.1731037, 0.1731485, 0.1731795, 0.1731822], [0.03137849, 0.03651497, 0.05369401, 0.09161207, 0.1575574, 0.1842324, 0.1949895, 0.1940139, 0.181434, 0.1530233, 0.09984866, -0.09188325, -0.1765157, -0.2432063, -0.2743489, -0.2876131, -0.2893418, -0.2831437, -0.2674148, -0.3019731, -0.2652804, 0.04536814, 0.1224234, 0.1512875, 0.1570717, 0.1463656, 0.128849, 0.1015794, 0.07210673, 0.06066822, 0.0405239, 0.04040221, 0.03731743, 0.03480428, 0.03341753, 0.03269546, 0.03233622, 0.03218968], [0.3475249, 0.3394636, 0.3120142, 0.2222812, 0.02525531, -0.07617525, -0.131711, -0.1551115, -0.1569514, -0.1445308, -0.1209759, 0.1224517, 0.04911107, -0.01336119, -0.05756325, -0.0821194, -0.0923594, -0.09218955, -0.0876826, -0.1097293, -0.08213999, -0.2512941, -0.2629964, -0.2346993, -0.1994343, -0.1372833, -0.07003431, 0.01097949, 0.07361673, 0.09292193, 0.1495078, 0.1393326, 0.1419586, 0.1459523, 0.1484407, 0.1497109, 0.1503627, 0.1506628], [0.06142204, 0.05786618, 0.04493868, -1667544e-9, -0.1239341, -0.18922, -0.2092335, -0.1813051, -0.09951376, 0.04750551, 0.2508217, 0.4173112, 0.3464263, 0.2114988, 0.1065638, 0.0396658, 1179382e-9, -0.02244844, -0.04379864, -0.2757395, -0.4358296, 2079004e-9, 0.08929734, 0.1616104, 0.1808936, 0.1600107, 0.1229764, 0.06541057, -1589698e-9, -0.02956237, -0.06381081, -0.07050402, -0.07924397, -0.08523274, -0.08834905, -0.09000503, -0.09082922, -0.09112351], [-0.2849056, -0.2809993, -0.2670309, -0.2146758, -0.04397425, 0.07688784, 0.1561441, 0.1960707, 0.2022741, 0.1829012, 0.1568899, 0.1352822, 0.1607311, 0.1282205, 0.08742798, 0.05524357, 0.03074158, 7401419e-9, -0.02492709, -0.144013, -0.2534114, -0.279643, -0.284807, -0.2400265, -0.1937673, -0.1278778, -0.06158691, 0.0106791, 0.06228573, 0.07793386, 0.1189043, 0.1120231, 0.1139095, 0.1167035, 0.118432, 0.119318, 0.1197796, 0.1199808], [-0.04867795, -0.03848097, -6388283e-9, 6091587e-10, -0.0367139, -0.0675538, -0.07838973, -0.06227753, -0.01207089, 0.08113584, 0.2171174, 0.1783848, 0.06910126, -0.09273659, -0.1425212, -0.1316225, -0.07574946, 0.0125239, 0.1328408, -0.1632446, 0.05201528, 0.7089535, 0.1776335, -0.1592273, -0.2833049, -0.2661033, -0.1976904, -0.09221338, -0.02023599, -4615753e-9, 0.08051684, 0.05602729, 0.05512528, 0.058801, 0.06145249, 0.06280478, 0.06355499, 0.06393252]];
  var DISPLAY_BANDS2 = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32];
  var DISPLAY_RGB_WEIGHTS2 = [[7598756e-9, 0.0144316, 0.02304203], [-0.07190809, -0.05764169, 0.1207272], [0.299773, 0.0127048, 0.3249726], [-0.2579063, -0.06517872, 0.4461339], [0.07037487, 0.05889296, 0.1350291], [-0.2104469, 0.1285821, 0.09775973], [-0.02718884, 0.2208098, -0.09346024], [-0.3172512, 0.4457301, 0.04248862], [0.2293731, 0.1134161, -0.06150663], [0.1930991, 0.1395861, -0.01283952], [0.5274069, 0.03838932, -0.02348521], [0.3899227, 0.07193636, 0.01268301], [-0.165677, -0.2589753, -0.01230862], [0.5972293, 0.3119106, -548141e-8], [-0.197781, 0.08099158, 0.05785604], [-0.06596648, -0.2556352, -0.05165295]];

  // workbench/src/playground/spectral.ts
  var COEFFS2 = 7;
  var uncompand2 = (x) => x < 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  function hexToRgb2(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }
  function reflectance2(srgb) {
    let [r, g, b] = srgb.map(uncompand2);
    const w = Math.min(r, g, b);
    r -= w;
    g -= w;
    b -= w;
    const c = Math.min(g, b), m = Math.min(r, b), y = Math.min(r, g);
    const rr = Math.min(Math.max(0, r - b), Math.max(0, r - g));
    const gg = Math.min(Math.max(0, g - b), Math.max(0, g - r));
    const bb = Math.min(Math.max(0, b - g), Math.max(0, b - r));
    return PRIMARIES2.map((k) => Math.max(SPECTRAL_EPSILON2, w + c * k[0] + m * k[1] + y * k[2] + rr * k[3] + gg * k[4] + bb * k[5]));
  }
  function pigmentFromHex2(hex) {
    const absorbance = reflectance2(hexToRgb2(hex)).map((v) => -Math.log(v));
    const coeffs = new Float32Array(COEFFS2);
    for (let k = 0; k < COEFFS2; k++) {
      let s = 0;
      for (let i = 0; i < absorbance.length; i++) s += BASIS2[k][i] * absorbance[i];
      coeffs[k] = s;
    }
    return { coeffs };
  }
  function displayBasisGLSL2() {
    const f = (v) => Number.isInteger(v) ? v.toFixed(1) : v.toPrecision(7);
    const scattered = [];
    const legacy = [];
    DISPLAY_BANDS2.forEach((band, i) => {
      const b = BASIS2.map((v) => v[band]);
      const w = DISPLAY_RGB_WEIGHTS2[i];
      const basis = `dot(a, vec4(${b.slice(0, 4).map(f).join(",")})) + dot(b, vec3(${b.slice(4, 7).map(f).join(",")}))`;
      legacy.push(
        `  tr = exp(-max(${basis}, 0.0));
  rgb += tr * vec3(${w.map(f).join(",")});`
      );
      scattered.push(
        `    float kmK${i} = 0.5 * max(${basis}, 0.0);
    float kmBand${i};
    if (kmK${i} <= 0.0){
      kmBand${i} = 1.0;
    } else {
      float kmArg${i} = sqrt(kmK${i} * (2.0 * scatter + kmK${i}));
      float kmE${i} = exp(-2.0 * kmArg${i});
      float kmSh${i} = 0.5 * (1.0 - kmE${i});
      float kmCh${i} = 0.5 * (1.0 + kmE${i});
      float kmDen${i} = (kmK${i} + scatter) * kmSh${i} + kmArg${i} * kmCh${i};
      float kmR${i} = scatter * kmSh${i} / kmDen${i};
      float kmT${i} = kmArg${i} * sqrt(kmE${i}) / kmDen${i};
      float kmOm${i} = (kmK${i} * kmSh${i} + kmArg${i} * kmCh${i}) / kmDen${i};
      kmBand${i} = kmR${i} + kmT${i} * kmT${i} / kmOm${i};
    }
    rgb += kmBand${i} * vec3(${w.map(f).join(",")});`
      );
    });
    return [
      "  // Kubelka-Munk layer over white (64-10, MED-34 / MED-35): each band is the",
      "  // layer's reflectance over black plus its squared transmittance over one",
      "  // minus that reflectance. S = scatter; one unit-amount Body-100 dab peaks at",
      `  // SCATTERING_MAX = ${f(SCATTERING_MAX2)}, and the settled channel accumulates past it.`,
      "  // Each term is normalized by exp(-arg), so the hyperbolic forms stay",
      "  // bounded for any finite absorption and scattering. At or below the epsilon",
      "  // the legacy lines run verbatim, so a scattering-free render is",
      "  // byte-identical to the committed baseline.",
      `  if (scatter > ${f(SCATTER_EPSILON2)}){`,
      scattered.join("\n"),
      "  } else {",
      legacy.join("\n"),
      "  }"
    ].join("\n");
  }

  // workbench/src/playground/shaders.ts
  var HEADER2 = `#version 300 es
precision highp float;
in vec2 vUv;
`;
  var splatFS2 = `${HEADER2}
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
  var stampFS2 = `${HEADER2}
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
  var reliefFS2 = `${HEADER2}
layout(location=0) out vec4 o0;
uniform sampler2D uTip, uPaper;
uniform float uAspect, uRadius, uTipAspect, uRound, uGrain, uGrainThr;
uniform float uRough, uJitter;
uniform float uTipRotation;
uniform vec2 uPoint, uAxis;
uniform float uAmount;
void main(){
  vec2 p = vUv - uPoint; p.x *= uAspect;
  vec2 q = vec2(dot(p, uAxis), dot(p, vec2(-uAxis.y, uAxis.x))) / uRadius;
  q.y /= uTipAspect;
  // Rotate the TIP-SPACE sampling coordinates only: the discard and the
  // footprint value keep the unrotated q, exactly as stampFS does.
  float a = uTipRotation;
  vec2 tq = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
  if (abs(q.x) > 1.0 || abs(q.y) > 1.0) discard;
  // Dry media reads a different slice of the tip per dab (same law as stampFS).
  float e0 = fract(sin(dot(uPoint, vec2(12.9898, 78.233))) * 43758.5453);
  float e1 = fract(e0 * 63.7264 + 0.37);
  vec2 uv = clamp(tq * 0.5 + 0.5 + (vec2(e0, e1) - 0.5) * uJitter, 0.0, 1.0);
  float t = texture(uTip, uv).r;
  // Re-threshold the tip into the same hard, crumbly mask stampFS builds.
  float th = uRough * 0.45;
  float dry = smoothstep(th, th + 0.02, t);
  float sharp = mix(t, dry, step(0.0001, uRough));
  float d = dot(q, q);
  float round = 1.0 - smoothstep(0.15, 1.0, d);
  float f = mix(sharp, round, uRound);
  float h = texture(uPaper, vUv).g;
  f *= mix(1.0, smoothstep(uGrainThr - 0.08, uGrainThr + 0.08, h), uGrain);
  o0 = vec4(uAmount * f);
}`;
  var advectVelocityFS2 = `${HEADER2}
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
  var divergenceFS2 = `${HEADER2}
out vec4 o;
uniform sampler2D uVelocity; uniform vec2 uTexel;
void main(){
  float L = texture(uVelocity, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uVelocity, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uVelocity, vUv - vec2(0.0, uTexel.y)).y;
  float T = texture(uVelocity, vUv + vec2(0.0, uTexel.y)).y;
  o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;
  var pressureFS2 = `${HEADER2}
out vec4 o;
uniform sampler2D uPressure, uDivergence; uniform vec2 uTexel;
void main(){
  float L = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  o = vec4((L + R + B + T - texture(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0);
}`;
  var gradientSubtractFS2 = `${HEADER2}
out vec4 o;
uniform sampler2D uPressure, uVelocity; uniform vec2 uTexel;
void main(){
  float L = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  o = vec4(texture(uVelocity, vUv).xy - 0.5 * vec2(R - L, T - B), 0.0, 1.0);
}`;
  var curlFS2 = `${HEADER2}
out vec4 o;
uniform sampler2D uVelocity; uniform vec2 uTexel;
void main(){
  float L = texture(uVelocity, vUv - vec2(uTexel.x, 0.0)).y;
  float R = texture(uVelocity, vUv + vec2(uTexel.x, 0.0)).y;
  float B = texture(uVelocity, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uVelocity, vUv + vec2(0.0, uTexel.y)).x;
  o = vec4(0.5 * ((R - L) - (T - B)), 0.0, 0.0, 1.0);
}`;
  var vorticityFS2 = `${HEADER2}
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
  var scaleFS2 = `${HEADER2}
out vec4 o;
uniform sampler2D uTex; uniform float uValue;
void main(){ o = texture(uTex, vUv) * uValue; }`;
  var wetMaskFS2 = `${HEADER2}
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
  var advectWetFS2 = `${HEADER2}
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
  var advectInkFS2 = `${HEADER2}
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
  var TO_SRGB2 = `
vec3 toSRGB(vec3 c){
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 fromSRGB(vec3 c){
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}`;
  var FILM_PRESENCE2 = `
uniform sampler2D uInkA, uInkB, uFixedA, uFixedB;
uniform float uGranulation;

// The paper-white scan's own line and its margin, derived once: luma 250 of
// 255 is the covered-paper-white scan's threshold, and the 5-level ramp is
// the margin the scan leaves above it (a texel at or above the line can never
// be counted covered paper-white after 8-bit quantization).
const float PAPER_WHITE = 250.0 / 255.0;
const float PAPER_WHITE_RAMP = 5.0 / 255.0;

${TO_SRGB2}

// How much of the sheet this texel's combined paint film still hides: 1 where
// the film reads at or below the scan's ramp, 0 where it reads paper-white on
// the scan's own 8-bit grid. Exactly the display's film (the mobile and fixed
// layers summed as displayFS sums them), exactly its granulation, exactly its
// basis.
float filmPresence(vec2 uv){
  vec4 paper = texture(uPaper, uv);
  vec4 iB = texture(uInkB, uv);
  vec4 fB = texture(uFixedB, uv);
  vec4 a = texture(uInkA, uv) + texture(uFixedA, uv);
  vec3 b = iB.rgb + fB.rgb;
  float scatter = iB.a + fB.a;
  float gran = 1.0 + uGranulation * (0.5 - paper.g) * 2.2;
  a *= gran; b *= gran; scatter *= gran;
  vec3 rgb = vec3(0.0);
  float tr;
${displayBasisGLSL2()}
  // The scan reads the transparent export's bytes: quantize to RGBA8 the same
  // way (round to nearest) before the mean, so both comparisons agree.
  vec3 s = toSRGB(rgb);
  vec3 q = floor(s * 255.0 + 0.5) / 255.0;
  float luma = (q.r + q.g + q.b) / 3.0;
  return 1.0 - smoothstep(PAPER_WHITE - PAPER_WHITE_RAMP, PAPER_WHITE, luma);
}`;
  var advectCoverFS2 = `${HEADER2}
layout(location=0) out vec4 o0;
uniform sampler2D uVelocity, uCover, uWet, uPaper;
uniform vec2 uSimTexel, uTexel;
uniform float uDt, uBleed, uEdge, uAspect;
uniform vec3 uBrush;  // x, y, radius (radius <= 0: no brush down)

${FILM_PRESENCE2}

float mobility(float w){ return smoothstep(0.02, 0.45, w); }

void face(vec2 off, float w, float m, float C, float diffusion, float edge,
          inout float dC){
  vec2 uv = vUv + off;
  float wn = texture(uWet, uv).x;
  float g = m * mobility(wn);
  if (g <= 0.0) return;
  float Cn = texture(uCover, uv).x;
  float d = diffusion * g;
  // positive: water (and coverage) drifts from this texel toward the drier neighbour
  float e = clamp(edge * (w - wn), -0.08, 0.08) * g;
  dC += d * (Cn - C) - (e > 0.0 ? e * C : e * Cn);
}

void main(){
  float w = texture(uWet, vUv).x;
  float m = mobility(w);
  float C = texture(uCover, vUv).x;
  if (m < 0.002){ o0 = vec4(C); return; }

  float p = filmPresence(vUv);
  vec2 vel = texture(uVelocity, vUv).xy;
  vec2 coord = vUv - uDt * vel * uSimTexel * m;
  float c = mix(C, texture(uCover, coord).x, m * p);

  float brush = 0.0;
  if (uBrush.z > 0.0){
    vec2 d = vUv - uBrush.xy; d.x *= uAspect;
    brush = exp(-dot(d, d) / (uBrush.z * uBrush.z));
  }
  float diffusion = clamp(uBleed * (0.25 + 1.3 * brush) * 0.3, 0.0, 0.15);
  float dC = 0.0;
  face(vec2( uTexel.x, 0.0), w, m, C, diffusion, uEdge, dC);
  face(vec2(-uTexel.x, 0.0), w, m, C, diffusion, uEdge, dC);
  face(vec2(0.0,  uTexel.y), w, m, C, diffusion, uEdge, dC);
  face(vec2(0.0, -uTexel.y), w, m, C, diffusion, uEdge, dC);

  // Coverage is a committed alpha in [0, 1]: clamp the transported sum, scaled
  // per texel by the film's presence \u2014 a paper-white texel keeps its value.
  o0 = vec4(clamp(c + dC * p, 0.0, 1.0));
}`;
  var settleFS2 = `${HEADER2}
layout(location=0) out vec4 oA;
layout(location=1) out vec4 oB;
uniform sampler2D uInkA, uInkB;
uniform float uSettle;
void main(){
  vec4 A = texture(uInkA, vUv), B = texture(uInkB, vUv);
  oA = A * uSettle;
  oB = vec4(B.rgb * uSettle, B.a * uSettle);
}`;
  var liftFS2 = `${HEADER2}
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
  var FOOTPRINT_MASK2 = `
uniform sampler2D uTip, uPaper;
uniform float uAspect, uRadius, uTipAspect, uRound, uGrain, uGrainThr;
uniform float uRough, uJitter, uTipRotation;
uniform vec2 uPoint, uAxis;
float footprintMask(){
  vec2 p = vUv - uPoint; p.x *= uAspect;
  vec2 q = vec2(dot(p, uAxis), dot(p, vec2(-uAxis.y, uAxis.x))) / uRadius;
  q.y /= uTipAspect;
  float a = uTipRotation;
  vec2 tq = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
  if (abs(q.x) > 1.0 || abs(q.y) > 1.0) return 0.0;
  float e0 = fract(sin(dot(uPoint, vec2(12.9898, 78.233))) * 43758.5453);
  float e1 = fract(e0 * 63.7264 + 0.37);
  vec2 uv = clamp(tq * 0.5 + 0.5 + (vec2(e0, e1) - 0.5) * uJitter, 0.0, 1.0);
  float t = texture(uTip, uv).r;
  // The deposit's LOW cut without its hard edge: a dry brush thresholds the tip
  // at roughness * 0.45 with a 0.02 ramp, and a cover must start erasing at
  // the same alpha (never below it: that is where the paint is absent, and an
  // erase there compounds to paper-white over a stroke's overlapping dabs).
  // The ramp is WIDE on purpose: the underlayer survives partway up the tip's
  // alpha, which is the transition the rim needs, instead of a hard cut at the
  // dab's contour. A 1-in-1-out threshold here is what carved the scalloped
  // dab edges and the white specks through textured tips.
  float th = uRough * 0.45;
  float ramp = smoothstep(th, th + 0.5, t);
  float round = 1.0 - smoothstep(0.15, 1.0, dot(q, q));
  float f = mix(ramp, round, uRound);
  // Soften the tip square's cull: the deposit may stop at |q| = 1, but an erase
  // that stops on the same hard line draws the dab's contour. Fading the cover
  // out before the cull leaves the underlayer mixing at the outermost rim.
  f *= 1.0 - smoothstep(0.82, 1.0, max(abs(q.x), abs(q.y)));
  float h = texture(uPaper, vUv).g;
  return f * mix(1.0, smoothstep(uGrainThr - 0.08, uGrainThr + 0.08, h), uGrain);
}`;
  var bodyCoverFS2 = `${HEADER2}${FOOTPRINT_MASK2}
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
uniform float uAmount, uDensity, uShape;
void main(){
  float m = footprintMask();
  float f = uAmount * mix(m, 1.0 - exp(-uDensity * m), uShape);
  o0 = vec4(f);
  o1 = vec4(f);
}`;
  var coverDepositFS2 = `${HEADER2}${FOOTPRINT_MASK2}
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
uniform vec4 uColor0, uColor1;
uniform float uAmount, uDensity;
void main(){
  float m = footprintMask();
  float a = uAmount * (1.0 - exp(-uDensity * m));
  o0 = uColor0 * a;
  o1 = vec4(uColor1.rgb * a, uColor1.a * m);
}`;
  var coverMaskFS2 = `${HEADER2}${FOOTPRINT_MASK2}
layout(location=0) out vec4 o0;
uniform float uAmount, uDensity;
void main(){
  float m = footprintMask();
  o0 = vec4(uAmount * (1.0 - exp(-uDensity * m)));
}`;
  var coverClearFS2 = `${HEADER2}
layout(location=0) out vec4 o0;
uniform sampler2D uSrc, uPaper, uCover;
${FILM_PRESENCE2}
void main(){
  vec4 src = texture(uSrc, vUv);
  float p = filmPresence(vUv);
  float cov = texture(uCover, vUv).x;
  float cleared = (p < 0.0001 && cov > 0.0) ? 1.0 : 0.0;
  o0 = vec4(src.rgb, src.a * (1.0 - cleared));
}`;
  var paperFieldFS2 = `${HEADER2}
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
  var paperLightFS2 = `${HEADER2}
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
  var PAPER_COLOUR2 = `
uniform vec3 uPaperTint, uFleckTint;
uniform float uMottle;
uniform float uTexture;       // texture strength: 0 a flat sheet of the tint, 1 full relief
vec3 paperColour(vec4 paper, vec3 base){
  vec3 c = base * (1.0 + uTexture * ((paper.r - 0.5) * 0.32 + (paper.b - 0.5) * uMottle * 2.0));
  float fl = (paper.a - 0.5) * 2.0 * uTexture;
  return fl < 0.0 ? mix(c, uFleckTint, -fl) : mix(c, min(base * 1.1 + 0.02, vec3(1.0)), fl);
}`;
  var paperSwatchFS2 = `${HEADER2}
out vec4 o;
uniform sampler2D uPaper;
${PAPER_COLOUR2}
${TO_SRGB2}
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
  var paperSheetFS2 = `${HEADER2}
out vec4 o;
uniform sampler2D uPaper;
${PAPER_COLOUR2}
${TO_SRGB2}
void main(){
  vec4 paper = texture(uPaper, vUv);
  vec3 c = paperColour(paper, uPaperTint);
  o = vec4(toSRGB(c), 1.0);
}`;
  var fillFS2 = `${HEADER2}
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
  var displayFS2 = `${HEADER2}
out vec4 o;
uniform sampler2D uInkA, uInkB, uFixedA, uFixedB, uWet, uPaper;
uniform sampler2D uRelief; // Phase 64: paint thickness field (one channel)
uniform sampler2D uCover;  // SPIKE 001: pigment-layer coverage (one channel)
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
uniform float uLightAzimuth, uLightElevation, uLightIntensity, uReliefBump; // Phase 64: radians, radians, 0..4, fixed bump
const float EMBOSS_GAIN = 2.3;
const float EMBOSS_SHADE_MAX = 1.5;
${PAPER_COLOUR2}
${TO_SRGB2}
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
  vec4 fB = texture(uFixedB, uv);
  vec4 a = texture(uInkA, uv) + texture(uFixedA, uv);
  vec3 b = iB.rgb + fB.rgb;
  // Phase 64 (MED-34): the settled scattering scalar, one broadband value for
  // every band. It is scaled with the coefficients below, so the grainiest
  // paint is also the most variable in opacity (D-16).
  float scatter = iB.a + fB.a;

  // Granulation: pigment settles into the valleys of the paper.
  float d0 = a.x;
  float gran = 1.0 + uGranulation * (0.5 - paper.g) * 2.2;
  // Edge darkening from the density gradient keeps fine pen work crisp.
  float l = density(uv - vec2(uTexel.x, 0.0)), r = density(uv + vec2(uTexel.x, 0.0));
  float bt = density(uv - vec2(0.0, uTexel.y)), t = density(uv + vec2(0.0, uTexel.y));
  float edge = min(length(vec2(r - l, t - bt)) / (d0 + 1.0), 1.0);
  float k = mix(gran * (1.0 + uEdgeDarken * edge), 1.0, uFlat);
  a *= k; b *= k; scatter *= k;

  vec3 rgb = vec3(0.0);
  float tr;
${displayBasisGLSL2()}

  // Phase 64 (MED-15): light the paint thickness field. One document texel of
  // central difference \u2014 the same law paperLightFS uses \u2014 so the gradient is
  // fixed in document space and cannot crawl under zoom or pan. A texel with
  // no thickness casts no shade. A flat field tilts the normal to (0, 0, 1),
  // where dot(n, L) - L.z is exactly 0 at any intensity: the emboss is a
  // gradient term, never a flat multiply.
  float shade = 1.0;
  {
    float c = texture(uRelief, uv).x;
    if (c > 0.0){
      float l = texture(uRelief, uv - vec2(uTexel.x, 0.0)).x, r = texture(uRelief, uv + vec2(uTexel.x, 0.0)).x;
      float b = texture(uRelief, uv - vec2(0.0, uTexel.y)).x, t = texture(uRelief, uv + vec2(0.0, uTexel.y)).x;
      vec3 n = normalize(vec3((l - r) * uReliefBump, (b - t) * uReliefBump, 1.0));
      vec3 L = normalize(vec3(
        cos(uLightElevation) * cos(uLightAzimuth),
        cos(uLightElevation) * sin(uLightAzimuth),
        sin(uLightElevation)));
      float litDelta = uLightIntensity * (dot(n, L) - L.z) * uReliefBump * EMBOSS_GAIN;
      shade = clamp(1.0 + litDelta * (1.0 - uFlat), 0.0, EMBOSS_SHADE_MAX);
    }
  }

  // Phase 64: ONE shading law for every mode. The live compositor layer
  // (mode 4) shades in PIGMENT space \u2014 the pigment colour scales, the alpha
  // does not. Scaling the linear transmittance instead (the first cut) darkened
  // the darkest bands, so the emboss gradient read as a dark outline, and it
  // made the mode-2 sheet's cached-base alpha differ from the live layer.
  // Emitting the shaded transmittance as mn + (t - mn) * shade makes mode 2,
  // mode 4 and the cached-base round-trip the SAME law by construction. At
  // shade == 1 every legacy line below is byte-identical.
  vec3 tSrgb = toSRGB(rgb);
  float tMin = min(min(tSrgb.r, tSrgb.g), tSrgb.b);
  vec3 lit = vec3(tMin) + (tSrgb - vec3(tMin)) * shade;

  if (uMode == 4){
    // PIGMENT ALPHA (compositor display, 2026-10-26 round 2). The same
    // transmittance as mode 2, re-expressed as straight-alpha pigment so the
    // live sheet stacks with REAL layer alpha. Light washes stay translucent,
    // dense pigment masks. displayFS writes PREMULTIPLIED pixels (F1 contract),
    // so scale the colour by alpha. Storage/export keeps mode 2's opaque sheet.
    // Phase 64: the emboss scales only the premultiplied colour; the alpha is
    // derived from the UNSHADED reconstruction and stays byte-for-byte
    // untouched, so a lit stroke never changes its opacity.
    //
    // SPIKE 001: alpha is the max of the darkness alpha and the composited
    // COVERAGE. A near-white pigment's darkness alpha is ~0.06, which is why
    // the punch machinery existed; coverage is pigment-independent, so white
    // acrylic now hides what is beneath it. The colour keeps the same
    // over-white identity \u2014 over a white fond source-over gives
    // colour*alpha + (1-alpha) = t \u2014 and reduces exactly to the old formula
    // (alpha = 1 - tMin, colour = (t - tMin) / alpha) wherever cover is 0.
    float darkAlpha = 1.0 - tMin;
    float cov = texture(uCover, uv).x;
    float alpha = clamp(max(darkAlpha, cov), 0.0, 1.0);
    vec3 pigment = alpha > 0.0 ? (tSrgb - vec3(1.0 - alpha)) / alpha : vec3(0.0);
    pigment = clamp(pigment, 0.0, 1.0);
    o = vec4(pigment * alpha * shade, alpha);
    return;
  }

  if (uMode == 2){
    // TRANSMITTANCE, opaque (R2.2 paper-agnostic multiply seam). lit is how
    // much paper light gets through the pigment. Composited with
    // mix-blend-mode: multiply over ANY fond: result = fond x lit, exactly the
    // live mode-4 layer's composite. No alpha to misread (F1 neon / fringe)
    // and no un-mix round-trip to lose thin strokes (F2 fade).
    o = vec4(lit, 1.0);
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
  // Back to linear for the paper multiply. shade == 1 keeps the legacy linear
  // transmittance exactly, so a relief-free sheet stays byte-identical.
  vec3 litLinear = shade == 1.0 ? rgb : fromSRGB(lit);
  vec3 col = litLinear * paperCol;

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

  // workbench/src/vector/spine.ts
  var ANCHOR_WIDTH_MIN2 = 0.2;
  var ANCHOR_WIDTH_MAX2 = 20;
  var ANCHOR_WIDTH_DEFAULT2 = 1;
  var PATH_SAMPLE_STEP_UV2 = 2e-3;
  function isFinitePoint3(point) {
    return point !== void 0 && Number.isFinite(point.x) && Number.isFinite(point.y);
  }
  function distance2(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function normaliseVectorAnchors2(anchors) {
    const kept = [];
    for (const anchor of anchors) {
      if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) continue;
      const previous = kept[kept.length - 1];
      if (previous !== void 0 && previous.x === anchor.x && previous.y === anchor.y) continue;
      kept.push(anchor);
    }
    return kept;
  }
  function handlesFor2(anchors, index) {
    const anchor = anchors[index];
    if (anchor.kind === "bezier" && isFinitePoint3(anchor.in) && isFinitePoint3(anchor.out)) {
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
  function cubicPointAt2(start, controlA, controlB, end, t) {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return {
      x: a * start.x + b * controlA.x + c * controlB.x + d * end.x,
      y: a * start.y + b * controlA.y + c * controlB.y + d * end.y
    };
  }
  function walkPath2(anchors) {
    const points = [];
    const stations = [];
    const anchorStations = [];
    if (anchors.length === 0) return { points, stations, anchorStations };
    const handles = anchors.map((_, index) => handlesFor2(anchors, index));
    let total = 0;
    let cursor = { x: anchors[0].x, y: anchors[0].y };
    points.push(cursor);
    stations.push(0);
    anchorStations.push(0);
    for (let index = 0; index < anchors.length - 1; index++) {
      const start = anchors[index];
      const end = anchors[index + 1];
      const controlA = handles[index].out;
      const controlB = handles[index + 1].in;
      const chord = distance2(start, end);
      const steps = Math.max(1, Math.ceil(chord / PATH_SAMPLE_STEP_UV2));
      for (let step = 1; step < steps; step++) {
        const sample = cubicPointAt2(start, controlA, controlB, end, step / steps);
        const advance2 = distance2(cursor, sample);
        if (advance2 <= 0) continue;
        total += advance2;
        points.push(sample);
        stations.push(total);
        cursor = sample;
      }
      const advance = distance2(cursor, end);
      if (advance > 0) {
        total += advance;
        cursor = { x: end.x, y: end.y };
        points.push(cursor);
        stations.push(total);
      }
      anchorStations.push(total);
    }
    return { points, stations, anchorStations };
  }
  function clampAnchorWidth2(value) {
    if (!Number.isFinite(value)) return ANCHOR_WIDTH_DEFAULT2;
    return Math.min(ANCHOR_WIDTH_MAX2, Math.max(ANCHOR_WIDTH_MIN2, value));
  }
  function anchorWidthFactor2(anchor) {
    return anchor.width === void 0 ? ANCHOR_WIDTH_DEFAULT2 : clampAnchorWidth2(anchor.width);
  }
  function isUniformWidthProfile2(anchors) {
    return normaliseVectorAnchors2(anchors).every(
      (anchor) => anchorWidthFactor2(anchor) === ANCHOR_WIDTH_DEFAULT2
    );
  }
  var ANCHOR_COLOR_PATTERN2 = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
  function normaliseAnchorColor2(value) {
    if (typeof value !== "string") return void 0;
    const match = ANCHOR_COLOR_PATTERN2.exec(value);
    if (match === null) return void 0;
    const digits = match[1].toLowerCase();
    const expanded = digits.length === 3 ? digits[0] + digits[0] + digits[1] + digits[1] + digits[2] + digits[2] : digits.slice(0, 6);
    return `#${expanded}`;
  }
  function isUniformColorProfile2(anchors) {
    return normaliseVectorAnchors2(anchors).every((anchor) => anchor.color === void 0);
  }
  function widthAtStation2(anchors, anchorStations, station) {
    const last = anchors.length - 1;
    if (last < 0) return ANCHOR_WIDTH_DEFAULT2;
    if (last === 0) return anchorWidthFactor2(anchors[0]);
    if (!Number.isFinite(station) || station <= anchorStations[0]) {
      return anchorWidthFactor2(anchors[0]);
    }
    if (station >= anchorStations[last]) return anchorWidthFactor2(anchors[last]);
    for (let index = 0; index < last; index++) {
      const start = anchorStations[index];
      const end = anchorStations[index + 1];
      if (station > end) continue;
      const span = end - start;
      const from = anchorWidthFactor2(anchors[index]);
      if (span <= 0) return anchorWidthFactor2(anchors[index + 1]);
      const to = anchorWidthFactor2(anchors[index + 1]);
      return from + (to - from) * ((station - start) / span);
    }
    return anchorWidthFactor2(anchors[last]);
  }
  function sampleVectorWidths2(anchors, points) {
    if (points.length === 0) return [];
    const normalised = normaliseVectorAnchors2(anchors);
    if (normalised.length === 0) return points.map(() => ANCHOR_WIDTH_DEFAULT2);
    if (isUniformWidthProfile2(normalised)) return points.map(() => ANCHOR_WIDTH_DEFAULT2);
    const { points: samples, stations, anchorStations } = walkPath2(normalised);
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
      return widthAtStation2(normalised, anchorStations, stations[nearest] ?? 0);
    });
  }
  function anchorColorChannels2(hex) {
    return {
      r: Number.parseInt(hex.slice(1, 3), 16) / 255,
      g: Number.parseInt(hex.slice(3, 5), 16) / 255,
      b: Number.parseInt(hex.slice(5, 7), 16) / 255
    };
  }
  function formatAnchorColor2(color) {
    const channel = (value) => {
      const clamped = Math.min(1, Math.max(0, value));
      return Math.round(clamped * 255).toString(16).padStart(2, "0");
    };
    return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
  }
  function mixAnchorColor2(from, to, u) {
    return {
      r: from.r + (to.r - from.r) * u,
      g: from.g + (to.g - from.g) * u,
      b: from.b + (to.b - from.b) * u
    };
  }
  function colorAtStation2(anchors, anchorStations, anchorColors, station) {
    const last = anchors.length - 1;
    if (last === 0) return anchorColors[0];
    if (!Number.isFinite(station) || station <= anchorStations[0]) return anchorColors[0];
    if (station >= anchorStations[last]) return anchorColors[last];
    for (let index = 0; index < last; index++) {
      const start = anchorStations[index];
      const end = anchorStations[index + 1];
      if (station > end) continue;
      const span = end - start;
      if (span <= 0) return anchorColors[index + 1];
      return mixAnchorColor2(anchorColors[index], anchorColors[index + 1], (station - start) / span);
    }
    return anchorColors[last];
  }
  function sampleVectorColors2(anchors, points, baseColor) {
    if (points.length === 0) return [];
    const normalised = normaliseVectorAnchors2(anchors);
    if (normalised.length === 0) return points.map(() => baseColor);
    const normalisedBase = normaliseAnchorColor2(baseColor);
    if (normalisedBase === void 0) return points.map(() => baseColor);
    if (isUniformColorProfile2(normalised)) return points.map(() => normalisedBase);
    const anchorColors = normalised.map(
      (anchor) => anchorColorChannels2(normaliseAnchorColor2(anchor.color) ?? normalisedBase)
    );
    const { points: samples, stations, anchorStations } = walkPath2(normalised);
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
      return formatAnchorColor2(
        colorAtStation2(normalised, anchorStations, anchorColors, stations[nearest] ?? 0)
      );
    });
  }

  // workbench/src/playground/wetState.ts
  var WET_THRESHOLD2 = 4e-3;
  function isSheetWet2(state) {
    return !state.fixing && state.wetPeak > WET_THRESHOLD2 && state.nowMs < state.wetUntilMs;
  }

  // workbench/src/playground/bristles.ts
  var BRISTLE_CAP = 256;
  var BRISTLE_SPACING_PX = 1.1;
  var BRISTLE_MIN = 40;
  var clamp2 = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  var clamp017 = (v) => clamp2(v, 0, 1);
  var smoothstep3 = (a, b, x) => {
    const t = clamp017((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  function bristleCount(halfWidthPx) {
    if (!Number.isFinite(halfWidthPx) || halfWidthPx <= 0) return BRISTLE_MIN;
    return clamp2(Math.round(clamp2(2 * halfWidthPx / BRISTLE_SPACING_PX, BRISTLE_MIN, BRISTLE_CAP)), BRISTLE_MIN, BRISTLE_CAP);
  }
  function makeBristles(count, rng) {
    const n = clamp2(Math.trunc(count), BRISTLE_MIN, BRISTLE_CAP);
    const data = new Float32Array(n * 8);
    const spacing = 2 / n;
    let i = 0;
    while (i < n) {
      const run = 3 + Math.floor(rng() * 14);
      const d = 0.75 + rng() * 0.6;
      const f = (rng() - 0.5) * 0.16;
      const p = 0.88 + rng() * 0.12;
      const valuePick = rng();
      let m;
      if (valuePick < 0.18) m = 0.8 + rng() * 0.12;
      else if (valuePick < 0.3) m = 1.04 + rng() * 0.08;
      else m = 0.96 + rng() * 0.08;
      for (let k = 0; k < run && i < n; k += 1, i += 1) {
        const across = -1 + (i + 0.5) * spacing + (rng() - 0.5) * 0.6 * spacing;
        const edge = smoothstep3(0.55, 1, Math.abs(across));
        const radiusScale = d * (0.88 + rng() * 0.24) * (1 + 1.4 * edge);
        const touchReach = clamp2(0.04 + 0.3 * rng() * rng() + 0.42 * edge + f, 0, 0.92);
        const loadRate = d * (0.88 + rng() * 0.24) * (1 + 1.4 * edge);
        const initialLoad = p * (1 - 0.3 * edge * rng());
        const seed = rng();
        const valueJitter = m * (1 + (rng() * 2 - 1) * 0.04);
        const base = i * 8;
        data[base] = across;
        data[base + 1] = radiusScale;
        data[base + 2] = touchReach;
        data[base + 3] = loadRate;
        data[base + 4] = seed;
        data[base + 5] = valueJitter;
        data[base + 6] = initialLoad;
        data[base + 7] = 0;
      }
    }
    return { count: n, data };
  }

  // workbench/src/playground/bristleShaders.ts
  var NOISE = `
uint pcg(uint v){
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float hash21(vec2 c){
  uint x = uint(int(c.x));
  uint y = uint(int(c.y));
  return float(pcg(x + pcg(y))) / 4294967295.0;
}
float hash11(float c){ return float(pcg(uint(int(c)) + 1013904223u)) / 4294967295.0; }
float valueNoise(vec2 p){
  vec2 cell = floor(p);
  vec2 f = p - cell;
  vec2 blend = f * f * (3.0 - 2.0 * f);
  float bottom = mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), blend.x);
  float top = mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0, 1.0)), blend.x);
  return mix(bottom, top, blend.y);
}
float noise1(float v){
  float cell = floor(v);
  float f = v - cell;
  float blend = f * f * (3.0 - 2.0 * f);
  return mix(hash11(cell), hash11(cell + 1.0), blend);
}
// touchOf (app.js): pressure vs a bristle's contact threshold.
float touchOf(float reach, float pressure){ return smoothstep(reach, reach + 0.08, pressure); }
`;
  var HEADER3 = `#version 300 es
precision highp float;
in vec2 vUv;
${NOISE}
`;
  var BRISTLE_TEXTURES = `
uniform sampler2D uPaintA;   // carried absorbance coefficients 0..3
uniform sampler2D uPaintB;   // carried absorbance coefficients 4..6 + carried alpha
uniform sampler2D uState;    // (load, across, seed, valueJitter)
uniform sampler2D uShape;    // (radiusScale, touchReach, loadRate, spare)
uniform float uCount;
vec4 bristleTex(sampler2D t, int idx){ return texelFetch(t, ivec2(0, clamp(idx, 0, 255)), 0); }
`;
  var carrierBristleFS = `${HEADER3}
layout(location=0) out vec4 oA;
layout(location=1) out vec4 oB;
layout(location=2) out vec4 oC;
${BRISTLE_TEXTURES}
uniform sampler2D uInkA, uInkB, uFixedA, uFixedB, uWet, uCover, uTimes;
uniform vec2 uPoint;
uniform vec2 uAxis;          // across axis (unit, doc frame)
uniform float uRadius;       // half-width in doc heights
uniform float uSheetAspect;
uniform float uTravel;       // distance moved since the last dab, in brush widths
uniform float uTravelPx;     // the same distance in document texels
uniform float uPressure;
uniform float uPickupRate;
uniform float uRefillRate;
uniform float uDepletion;    // load lost per document texel travelled
uniform vec4 uPigmentA;      // palette absorbance 0..3
uniform vec3 uPigmentB;      // palette absorbance 4..6
uniform float uWetSeconds;
uniform float uNow;
uniform float uAlongPx;
uniform float uStreakLen;
uniform float uRimContact;
uniform int uWetMode;        // 0 = wet*cover proxy, 1 = last-touch timestamp

vec4 canvasAt(vec2 uv){
  vec4 a = texture(uInkA, uv) + texture(uFixedA, uv);
  vec3 b = (texture(uInkB, uv) + texture(uFixedB, uv)).rgb;
  return vec4(a.rgb, b.r);
}
vec3 canvasAtB(vec2 uv){
  vec4 ib = texture(uInkB, uv) + texture(uFixedB, uv);
  return ib.rgb;
}
float wetAt(vec2 uv){
  float cov = texture(uCover, uv).x;
  if (uWetMode == 1){
    float age = max(uNow - texture(uTimes, uv).r, 0.0);
    return exp(-age / uWetSeconds) * cov;
  }
  return texture(uWet, uv).x * cov;
}

void main(){
  int idx = int(gl_FragCoord.y);
  vec4 state = bristleTex(uState, idx);
  vec4 paintA = bristleTex(uPaintA, idx);
  vec4 paintB = bristleTex(uPaintB, idx);
  vec4 shape = bristleTex(uShape, idx);
  float across = state.y;

  // The bristle's own position and 3 taps along the stroke direction (\xA73.1).
  vec2 pos = uPoint + uAxis * (across * uRadius);
  vec2 dir = vec2(-uAxis.y, uAxis.x);
  float tap = uRadius * 0.35;
  float wet = max(wetAt(pos), max(wetAt(pos - dir * tap), wetAt(pos + dir * tap)));
  vec4 canvasA = canvasAt(pos);
  vec3 canvasB = canvasAtB(pos);
  float canvasAlpha = texture(uCover, pos).x;

  // \xA73.1 contact threshold with rim noise (\xA75.3 shares the same contact law).
  float rim = 0.25 + 0.75 * smoothstep(0.45, 1.0, abs(across));
  float contact = noise1(uAlongPx / max(uStreakLen * 0.7, 1.0) + state.z * 2048.0 + 0.5) - 0.5;
  float touch = touchOf(shape.y + contact * rim * uRimContact, uPressure);

  float thirst = 0.15 + 2.4 * smoothstep(0.35, 0.9, fract(state.z * 7.31));
  float pickup = clamp(uPickupRate * thirst * uTravel * wet * touch, 0.0, 0.75);
  float refill = clamp(uRefillRate * uTravel * state.x, 0.0, 1.0);

  vec4 carriedA = mix(paintA, canvasA, pickup);
  vec3 carriedB = mix(paintB.rgb, canvasB, pickup);
  float carriedAlpha = mix(paintB.a, canvasAlpha, pickup);
  // The refill target is the palette pigment at this bristle's value jitter
  // (state.w) \u2014 \xA73.1's brush.rgb * bristle.state.w.
  carriedA = mix(carriedA, uPigmentA * state.w, refill);
  carriedB = mix(carriedB, uPigmentB * state.w, refill);
  carriedAlpha = mix(carriedAlpha, 1.0, refill);

  float load = state.x - uDepletion * shape.z * uTravelPx * touch * (0.35 + 0.65 * uPressure);
  load = clamp(load + pickup * 0.25, 0.0, 1.0);

  oA = carriedA;
  oB = vec4(carriedB, carriedAlpha);
  oC = vec4(load, across, state.z, state.w);
}
`;
  var BRISTLE_GATHER = `${BRISTLE_TEXTURES}
uniform sampler2D uPaper, uWet, uCover, uTimes;
uniform vec2 uPoint;
uniform vec2 uAxis;
uniform float uRadius;
uniform float uSheetAspect;
uniform vec2 uSheet;          // document size in texels
uniform float uPressure;
uniform float uGrain;
uniform float uSoftness;
uniform float uStreak;
uniform float uStreakLen;
uniform float uStreakShare;
uniform float uRimContact;
uniform float uHairs;
uniform float uDryEdge;
uniform float uLanding;
uniform float uAlongPx;
uniform float uStrokeDistPx;
uniform float uHalfWidthPx;
uniform int uWetMode;
uniform float uWetSeconds;
uniform float uNow;

struct Gathered {
  vec4 cA;
  vec3 cB;
  float alpha;
  float coverage;
  int nearest;
};

// \xA74.4 paper tooth: streaks (brush-local, along the stroke), tooth
// (screen-space, isotropic), cloud (low-frequency absorbency).
float grainHeight(vec2 css, vec2 normal){
  vec2 tangent = vec2(-normal.y, normal.x);
  vec2 local = vec2(dot(css, tangent), dot(css, normal));
  float streaks = valueNoise(vec2(local.x / 11.0, local.y * 0.75)) * 0.65
                + valueNoise(vec2(local.x / 3.0, local.y * 1.9)) * 0.35;
  float tooth = valueNoise(css * 1.3) * 0.55 + valueNoise(css * 0.45 + 17.0) * 0.45;
  float cloud = valueNoise(css * 0.12 + 41.0) * 0.45
              + valueNoise(css * 0.05 + 83.0) * 0.33
              + valueNoise(css * 0.02 + 7.0) * 0.22;
  return streaks * uStreakShare + tooth * 0.35 + cloud * (0.65 - uStreakShare);
}

Gathered gatherBristle(vec2 uv){
  Gathered g;
  g.cA = vec4(0.0);
  g.cB = vec3(0.0);
  g.alpha = 0.0;
  g.coverage = 0.0;
  g.nearest = 0;
  vec2 p = uv - uPoint;
  p.x *= uSheetAspect;
  vec2 q = vec2(dot(p, uAxis), dot(p, vec2(-uAxis.y, uAxis.x))) / uRadius;
  float across = q.x;
  float along = q.y;
  int count = int(uCount + 0.5);
  float spacing = 2.0 / float(count);
  int nearest = int(floor((across + 1.0) / spacing));
  if (nearest < 0 || nearest >= count) return g;
  g.nearest = nearest;

  float inkSum = 0.0;
  float profileSum = 0.0;
  for (int o = -2; o <= 2; o++){
    int idx = nearest + o;
    if (idx < 0 || idx >= count) continue;
    vec4 state = bristleTex(uState, idx);
    vec4 shape = bristleTex(uShape, idx);
    // \xA74.1: radius = max(radiusScale * spacing * halfWidth, 0.8 px).
    float spacingPx = spacing * uRadius * uSheet.y;
    float radius = max(shape.x * spacingPx, 0.8);
    float offset = (across - state.y) * uRadius * uSheet.y / radius;
    if (abs(offset) >= 1.0) continue;
    float profile = 1.0 - offset * offset;
    profile *= profile;                                              // \xA75.1
    float rim = 0.25 + 0.75 * smoothstep(0.45, 1.0, abs(state.y));   // \xA75.3
    float contact = noise1(uAlongPx / max(uStreakLen * 0.7, 1.0) + state.z * 2048.0 + 0.5) - 0.5;
    float touch = touchOf(shape.y + contact * rim * uRimContact, uPressure);
    float load = state.x;
    float dryness = clamp((1.0 - load) * uStreak * 1.6, 0.0, 1.0);   // \xA74.3
    float streak = noise1(uAlongPx / max(uStreakLen, 1.0) + state.z * 4096.0);
    float broken = mix(1.0, smoothstep(0.3, 0.7, streak), dryness * uHairs);
    float landing = (0.04 + 0.7 * fract(state.z * 13.7) * fract(state.z * 13.7)) * uLanding; // \xA75.4
    float landed = smoothstep(landing, landing + 0.12, uStrokeDistPx / max(uHalfWidthPx, 1.0));
    float ink = profile * min(load * 1.5, 1.0) * touch * broken * landed;   // \xA73.2
    inkSum += ink;
    profileSum += profile;
    vec4 pa = bristleTex(uPaintA, idx);
    vec4 pb = bristleTex(uPaintB, idx);
    g.cA += ink * pa;
    g.cB += ink * pb.rgb;
    g.alpha += ink * pb.a;
  }
  if (inkSum <= 1e-4) return g;
  g.cA /= inkSum;
  g.cB /= inkSum;
  g.alpha /= inkSum;

  // \xA74.5 wide vs local body: the wide samples the bundle 7 bristles apart.
  float wide = 0.0;
  for (int o = -2; o <= 2; o++){
    int idx = clamp(nearest + o * 7, 0, count - 1);
    vec4 state = bristleTex(uState, idx);
    vec4 shape = bristleTex(uShape, idx);
    wide += min(state.x * 1.25, 1.0) * touchOf(shape.y, uPressure);
  }
  float presence = min(profileSum / 0.5, 1.0);
  float local = inkSum / max(profileSum, 0.5);
  float body = mix(wide / 5.0 * presence, local, uHairs);

  // \xA74.4 / \xA75.5: the paper threshold, biased at the rim.
  vec2 css = uv * uSheet;
  float height = grainHeight(css, uAxis);
  float threshold = uGrain * (1.0 - height) - 0.25;
  float dryEdge = mix(1.0, uDryEdge, smoothstep(0.3, 1.05, abs(across)));
  float coverage = body * (0.3 + 0.7 * uPressure) * dryEdge;
  g.coverage = smoothstep(threshold - uSoftness, threshold + uSoftness, coverage);
  return g;
}
`;
  var depositBristleFS = `${HEADER3}${BRISTLE_GATHER}
layout(location=0) out vec4 oA;   // absorbance 0..3, premultiplied by the deposit
layout(location=1) out vec4 oB;   // absorbance 4..6, scattering S
uniform float uAmount;            // the dab's own pigment amount
uniform float uBody;              // canonical Body 0..1 (scatter source)

void main(){
  // The same square cull the stamp uses (an early-out only: coverage can be
  // zero inside it, and is then written as a zero deposit).
  vec2 p = vUv - uPoint;
  p.x *= uSheetAspect;
  vec2 q = vec2(dot(p, uAxis), dot(p, vec2(-uAxis.y, uAxis.x))) / uRadius;
  if (abs(q.x) > 1.15 || abs(q.y) > 1.15) discard;
  Gathered g = gatherBristle(vUv);
  float deposit = g.coverage;
  if (deposit <= 1e-3) discard;
  float amount = uAmount * deposit;
  // \xA73.2's carried colour is premultiplied in the reference; here the engine's
  // deposit is additive absorbance, so the coefficients ride the amount.
  float scatter = pow(clamp(uBody, 0.0, 1.0), 6.0) * amount;
  oA = g.cA * amount;
  oB = vec4(g.cB * amount, scatter);
}
`;
  var coverBristleFS = `${HEADER3}${BRISTLE_GATHER}
layout(location=0) out vec4 o0;

void main(){
  vec2 p = vUv - uPoint;
  p.x *= uSheetAspect;
  vec2 q = vec2(dot(p, uAxis), dot(p, vec2(-uAxis.y, uAxis.x))) / uRadius;
  if (abs(q.x) > 1.15 || abs(q.y) > 1.15) discard;
  Gathered g = gatherBristle(vUv);
  if (g.coverage <= 1e-3) discard;
  o0 = vec4(clamp(g.coverage, 0.0, 1.0));
}
`;
  var touchBristleFS = `${HEADER3}
layout(location=0) out vec4 o0;
uniform sampler2D uTimes, uCover;
uniform float uNow;
uniform float uAmount;
void main(){
  float prev = texture(uTimes, vUv).r;
  // The cover target was just stamped by this dab; its value is the union of
  // coverage, which is the closest per-pixel weight available without a
  // third fragment pass. The weight is bounded by the dab amount.
  float weight = clamp(texture(uCover, vUv).x * uAmount, 0.0, 1.0);
  o0 = vec4(mix(prev, uNow, weight));
}
`;

  // workbench/src/playground/Engine.ts
  var DEFAULT_PARAMS2 = {
    size: 0.5,
    water: 0.6,
    load: 0.5,
    flow: 0.45,
    bleed: 0.5,
    dry: 0.4,
    edge: 0.5,
    granulation: 0.45,
    lift: 0.22,
    viscosity: 0,
    body: 0,
    emboss: 0
  };
  var DEFAULT_LIGHT2 = { azimuth: 129.8, elevation: 38.45, intensity: 1 };
  var MODE2 = { screen: 0, paper: 1, transparent: 2, white: 3, pigment: 4 };
  var MAX_REF_SIDE2 = 4096;
  var RELIEF_BUMP2 = 1;
  var COVER_GAIN2 = 2;
  var COVER_MEDIUM_DENSITY2 = 8;
  var RELIEF_GAIN2 = 1.5;
  var RELIEF_ERODE2 = 0.5;
  var EMBOSS_PRESS_FLOOR2 = 0.15;
  function scriptWidthFactor2(value) {
    return Number.isFinite(value) ? clamp3(value, ANCHOR_WIDTH_MIN2, ANCHOR_WIDTH_MAX2) : 1;
  }
  var DEG4 = Math.PI / 180;
  var SCRIPT_POINTER2 = -1;
  function scriptPressure2(p) {
    return p < 0 ? -1 : clamp3(p, 0.02, 1);
  }
  var STROKE_LABEL2 = { brush: "Brush stroke", water: "Water", pen: "Pen", lift: "Lift" };
  var GL_RG16F2 = 33327;
  var GL_R16F2 = 33325;
  var GL_RGBA16F2 = 34842;
  var GL_RG32F2 = 33328;
  var GL_RG2 = 33319;
  var GL_RED2 = 6403;
  var GL_RGBA2 = 6408;
  var GL_RGBA82 = 32856;
  var GL_HALF_FLOAT2 = 5131;
  var GL_UNSIGNED_BYTE2 = 5121;
  var GL_FLOAT2 = 5126;
  var HALF_FLOAT_RG2 = { internal: GL_RG16F2, format: GL_RG2, type: GL_HALF_FLOAT2 };
  var HALF_FLOAT_R2 = { internal: GL_R16F2, format: GL_RED2, type: GL_HALF_FLOAT2 };
  var HALF_FLOAT_RGBA2 = { internal: GL_RGBA16F2, format: GL_RGBA2, type: GL_HALF_FLOAT2 };
  var RGBA82 = { internal: GL_RGBA82, format: GL_RGBA2, type: GL_UNSIGNED_BYTE2 };
  var FLOAT_RG2 = { internal: GL_RG32F2, format: GL_RG2, type: GL_FLOAT2 };
  var FLOAT_R = { internal: 33326, format: GL_RED2, type: GL_FLOAT2 };
  var FILL_WATER_LEAD2 = 10;
  var FILL_WIDTH2 = 24;
  var FILL_JITTER2 = 3;
  var SIM_BASE2 = 256;
  var PRESSURE_ITERATIONS2 = 20;
  var SCREEN_DOC_LONG2 = 2048;
  var SCREEN_DOC_SHORT2 = 1536;
  var MAX_DOC_LONG2 = 3072;
  var MAX_DOC_PIXELS2 = 42e5;
  var MIN_DOC_SIDE2 = 256;
  var MIN_ZOOM2 = 0.02;
  var MAX_ZOOM2 = 32;
  var FIT_PADDING2 = 24;
  var PAN_KEEP2 = 48;
  var FIX_DURATION2 = 1.2;
  var MASK_BLOCK2 = 16;
  var MASK_EVERY2 = 10;
  var MASK_MARGIN2 = MASK_BLOCK2 + 8;
  var PROTECT_MARGIN2 = 24;
  var DESK2 = [1, 1, 1];
  var PAPER_UNITS2 = 1100;
  var clamp3 = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  function clampDocSize2(w, h, maxSide = MAX_DOC_LONG2) {
    w = Math.max(MIN_DOC_SIDE2, Math.round(w) || MIN_DOC_SIDE2);
    h = Math.max(MIN_DOC_SIDE2, Math.round(h) || MIN_DOC_SIDE2);
    const s = Math.min(1, Math.min(MAX_DOC_LONG2, maxSide) / Math.max(w, h), Math.sqrt(MAX_DOC_PIXELS2 / (w * h)));
    return [Math.max(MIN_DOC_SIDE2, Math.round(w * s)), Math.max(MIN_DOC_SIDE2, Math.round(h * s))];
  }
  var union2 = (a, b) => a ? { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) } : { ...b };
  var WatercolorEngine2 = class {
    /** `size` is the sheet in texels; omitted, the sheet follows the window ("screen"). */
    constructor(canvas, cursor, callbacks = {}, size) {
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
      this.g = new GL2(gl);
      gl.disable(gl.BLEND);
      this.programs = {
        splat: this.g.program(splatFS2),
        stamp: this.g.program(stampFS2),
        relief: this.g.program(reliefFS2),
        fill: this.g.program(fillFS2),
        advectVelocity: this.g.program(advectVelocityFS2),
        divergence: this.g.program(divergenceFS2),
        pressure: this.g.program(pressureFS2),
        gradient: this.g.program(gradientSubtractFS2),
        curl: this.g.program(curlFS2),
        vorticity: this.g.program(vorticityFS2),
        scale: this.g.program(scaleFS2),
        advectWet: this.g.program(advectWetFS2),
        wetMask: this.g.program(wetMaskFS2),
        advectInk: this.g.program(advectInkFS2),
        settle: this.g.program(settleFS2),
        lift: this.g.program(liftFS2),
        paperField: this.g.program(paperFieldFS2),
        paperLight: this.g.program(paperLightFS2),
        paperSwatch: this.g.program(paperSwatchFS2),
        paperSheet: this.g.program(paperSheetFS2),
        display: this.g.program(displayFS2),
        coverDeposit: this.g.program(coverDepositFS2),
        coverMask: this.g.program(coverMaskFS2),
        bristleCarrier: this.g.program(carrierBristleFS),
        bristleDeposit: this.g.program(depositBristleFS),
        bristleCover: this.g.program(coverBristleFS),
        bristleTouch: this.g.program(touchBristleFS)
      };
      this.programs.bodyCover = this.g.program(bodyCoverFS2);
      this.programs.advectCover = this.g.program(advectCoverFS2);
      this.programs.coverClear = this.g.program(coverClearFS2);
      this.fitCanvas();
      this.createDocument(size ?? this.screenSize);
      this.attachInput();
      this.schedule();
    }
    canvas;
    cursor;
    callbacks;
    params = { ...DEFAULT_PARAMS2 };
    tool = "brush";
    pigment = pigmentFromHex2("#2338a8");
    // 261027-gh9f: the Studio opens on the dry chalk stick (first Brush-tab
    // card); the everyday round remains the fallback.
    brush = buildBrush2(BRUSH_PRESETS2.find((p) => p.id === "chalk") ?? BRUSH_PRESETS2.find((p) => p.id === "round") ?? BRUSH_PRESETS2[0]);
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
      coeffs: new Float32Array(COEFFS2)
    };
    nav = false;
    /** Deterministic bake seam: seeded RNG (A2). Defaults to Math.random for live. */
    rng = Math.random;
    /** Deterministic bake seam: virtual clock in ms. Defaults to performance.now(). */
    clock = () => performance.now();
    /** When true, schedule() is a no-op — the host drives tick(dt) (bake). */
    manual = false;
    tipTextures = /* @__PURE__ */ new Map();
    paperPreset = DEFAULT_PAPER2;
    paperSeed = 0;
    paperStrength = 1;
    paperScale = 1;
    // paper units per texel, fixed when the sheet is made
    paperOrigin = [0, 0];
    // where the sheet sits in the paper's field (texels)
    // Phase 64: the emboss light, in degrees (converted at drawDisplay). Render-only.
    light = { ...DEFAULT_LIGHT2 };
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
    fitPadding = FIT_PADDING2;
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
    relief;
    // Phase 64: paint thickness, one channel, engine-only
    // SPIKE 001: the pigment layer's coverage, one channel. A ping-pong pair from
    // the start: 64-14 advects it with the ink and its undo needs both halves.
    cover;
    // SPIKE 002: the per-stroke bristle reservoirs (1 × 256, three RGBA16F
    // attachments: carried absorbance 0..3, 4..6 + alpha, and load/across/seed/
    // jitter) plus the static shape texture, and the last-touch field.
    bristles;
    bristleShape;
    lastTouch;
    bristleMode = false;
    bristleTouch = false;
    bristleSalt = 0;
    bristleCount = 0;
    bristlePrev = { x: 0, y: 0, along: 0 };
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
      this.zoomLevel = clamp3(z, MIN_ZOOM2, MAX_ZOOM2);
      this.pan = [0, 0];
      this.fitMode = true;
      this.updateView();
    }
    /** Place the sheet from zoom and pan; everything that maps pointers goes through `view`. */
    updateView() {
      const [cw, ch] = this.canvasSize;
      const s = this.zoomLevel * this.dpr, w = this.dw * s, h = this.dh * s;
      const keep = PAN_KEEP2 * this.dpr;
      const mx = Math.max(0, (cw + w) / 2 - keep), my = Math.max(0, (ch + h) / 2 - keep);
      this.pan = [clamp3(this.pan[0], -mx, mx), clamp3(this.pan[1], -my, my)];
      this.view = { x: (cw - w) / 2 + this.pan[0], y: (ch - h) / 2 + this.pan[1], w, h };
      this.dirtyAll = true;
      this.updateCursor();
      this.callbacks.onViewChange?.(this.zoomLevel, [this.dw, this.dh]);
    }
    /** A sheet the shape of the window, in device pixels, within the "screen" limits. */
    get screenSize() {
      const [cw, ch] = this.canvasSize;
      const s = Math.min(1, SCREEN_DOC_LONG2 / Math.max(cw, ch), SCREEN_DOC_SHORT2 / Math.min(cw, ch));
      return clampDocSize2(cw * s, ch * s, this.maxSide);
    }
    /** The longest sheet side this GPU allows. */
    get maxSide() {
      return Math.min(MAX_DOC_LONG2, this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE));
    }
    /** Allocate every document-sized target for a `dw`×`dh` sheet (the old ones are the caller's to free). */
    allocateTargets() {
      const { gl, g } = this;
      const ar = this.dw / this.dh;
      const sim = ar > 1 ? { w: Math.round(SIM_BASE2 * ar), h: SIM_BASE2 } : { w: SIM_BASE2, h: Math.round(SIM_BASE2 / ar) };
      this.velocity = g.double(sim.w, sim.h, [HALF_FLOAT_RG2], gl.LINEAR);
      this.pressure = g.double(sim.w, sim.h, [HALF_FLOAT_R2], gl.NEAREST);
      this.divergence = g.target(sim.w, sim.h, [HALF_FLOAT_R2], gl.NEAREST);
      this.curl = g.target(sim.w, sim.h, [HALF_FLOAT_R2], gl.NEAREST);
      this.ink = g.double(this.dw, this.dh, [HALF_FLOAT_RGBA2, HALF_FLOAT_RGBA2], gl.LINEAR);
      this.fixed = g.target(this.dw, this.dh, [HALF_FLOAT_RGBA2, HALF_FLOAT_RGBA2], gl.LINEAR);
      this.wet = g.double(this.dw, this.dh, [HALF_FLOAT_R2], gl.LINEAR);
      this.relief = g.target(this.dw, this.dh, [HALF_FLOAT_R2], gl.LINEAR);
      this.cover = g.double(this.dw, this.dh, [HALF_FLOAT_R2], gl.LINEAR);
      this.bristles = g.double(1, BRISTLE_CAP, [HALF_FLOAT_RGBA2, HALF_FLOAT_RGBA2, HALF_FLOAT_RGBA2], gl.NEAREST);
      this.bristleShape = g.target(1, BRISTLE_CAP, [HALF_FLOAT_RGBA2], gl.NEAREST);
      this.lastTouch = g.double(this.dw, this.dh, [FLOAT_R], gl.NEAREST);
      this.clearLastTouch();
      this.paper = g.target(this.dw, this.dh, [RGBA82], gl.LINEAR);
      this.wetMask = g.target(Math.ceil(this.dw / MASK_BLOCK2), Math.ceil(this.dh / MASK_BLOCK2), [RGBA82], gl.NEAREST);
      this.maskPixels = new Uint8Array(this.wetMask.w * this.wetMask.h * 4);
    }
    allocateHistory() {
      this.history = new History2(this.g, this.dw, this.dh, [
        // SPIKE 002: the last-touch field joins pool 0 (one R32F layer per texel).
        { formats: [HALF_FLOAT_RGBA2, HALF_FLOAT_RGBA2, HALF_FLOAT_R2, HALF_FLOAT_R2, HALF_FLOAT_R2, FLOAT_R], documents: 2 },
        // mobile pigment + water + thickness + coverage + last touch
        { formats: [HALF_FLOAT_RGBA2, HALF_FLOAT_RGBA2], documents: 1 }
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
        this.wetMask,
        this.relief,
        this.cover.read,
        this.cover.write,
        this.lastTouch.read,
        this.lastTouch.write
      ];
    }
    /** (Re)create a blank `w`×`h` sheet. Discards the painting. */
    createDocument([w, h]) {
      const oldAspect = this.aspect;
      [this.dw, this.dh] = clampDocSize2(w, h, this.maxSide);
      if (this.ref && Math.abs(this.aspect - oldAspect) > 1e-3) this.fitReference();
      this.g.disposeTargets();
      this.allocateTargets();
      this.allocateHistory();
      this.paperSeed = this.rng();
      this.paperScale = PAPER_UNITS2 / this.dh;
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
      [w, h] = clampDocSize2(w, h, this.maxSide);
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
      const old = { targets: this.docTargets(), ink: this.ink.read, fixed: this.fixed, wet: this.wet.read, relief: this.relief, cover: this.cover.read };
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
      copy(old.relief, [this.relief]);
      copy(old.cover, [this.cover.read, this.cover.write]);
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
          wet: read(this.wet.read.views[0], 1),
          relief: read(this.relief.views[0], 1),
          cover: read(this.cover.read.views[0], 1)
        }
      };
    }
    /** Put `whole`'s layers into the (blank) current targets; both halves of the ping-pong pairs. */
    uploadWhole(whole) {
      const r = whole.rect;
      if (!r) return;
      const { gl, g } = this;
      const w = r.x1 - r.x0, h = r.y1 - r.y0;
      const up = (tex, format, data) => g.uploadHalf(tex, r.x0, r.y0, w, h, format, data);
      for (const t of [this.ink.read, this.ink.write]) {
        up(t.tex[0], gl.RGBA, whole.layers.inkA);
        up(t.tex[1], gl.RGBA, whole.layers.inkB);
      }
      up(this.fixed.tex[0], gl.RGBA, whole.layers.fixedA);
      up(this.fixed.tex[1], gl.RGBA, whole.layers.fixedB);
      for (const t of [this.wet.read, this.wet.write]) up(t.tex[0], gl.RED, whole.layers.wet);
      up(this.relief.tex[0], gl.RED, whole.layers.relief);
      for (const t of [this.cover.read, this.cover.write]) up(t.tex[0], gl.RED, whole.layers.cover);
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
      const preset = PAPERS2.find((p) => p.id === d.paperId);
      if (preset && preset !== this.paperPreset) {
        this.paperPreset = preset;
        this.drawPaper(this.paper, this.paperOrigin, this.paperScale);
      }
      this.paperStrength = clamp3(d.paperStrength, 0, 1);
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
      const [w, h] = clampDocSize2(s.whole.w, s.whole.h, this.maxSide);
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
      this.paperPreset = PAPERS2.find((p) => p.id === s.paper.id) ?? DEFAULT_PAPER2;
      this.paperSeed = s.paper.seed;
      this.paperScale = s.paper.scale || PAPER_UNITS2 / this.dh;
      this.paperOrigin = [...s.paper.origin];
      this.paperStrength = clamp3(s.paper.strength, 0, 1);
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
      this.refOpacity = clamp3(s.reference.opacity, 0, 1);
      this.refVisible = s.reference.visible;
      this.zoomLevel = clamp3(s.view.zoom, MIN_ZOOM2, MAX_ZOOM2);
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
      const z = clamp3(this.zoomLevel * factor, MIN_ZOOM2, MAX_ZOOM2);
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
      return isSheetWet2({
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
      this.fitPadding = on ? 0 : FIT_PADDING2;
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
      return FILL_WIDTH2 + FILL_JITTER2 + 1;
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
      const tex = this.g.texture(this.dw, this.dh, FLOAT_RG2, field, this.gl.NEAREST);
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
      gl.uniform1f(p.u.uJitter, FILL_JITTER2);
      gl.uniform1f(p.u.uWidth, FILL_WIDTH2);
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
        gl.uniform4f(p.u.uColor1, c[4] * amount, c[5] * amount, c[6] * amount, scatteringDeposit2(P.body, amount));
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.ONE, gl.ONE);
        g.draw(this.ink.read, f.bbox);
      }
      const wetAmt = (0.25 + 0.75 * o.water) * 0.9;
      gl.uniform1i(p.u.uCumulative, 1);
      gl.uniform1f(p.u.uTo, to + FILL_WATER_LEAD2);
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
      return this.stroke?.pointerId === SCRIPT_POINTER2;
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
        pointerId: SCRIPT_POINTER2,
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
      this.queue.push({ x, y, p: scriptPressure2(pressure), t: this.clock(), tx: tiltX, ty: tiltY, w: scriptWidthFactor2(widthScale), pig: pigment });
      this.schedule();
      return true;
    }
    /** Feed the scripted stroke a sample; `t` is a performance.now() timestamp. False once the stroke is gone (undo, clear). */
    scriptMove(x, y, pressure, t, tiltX = 0, tiltY = 0, widthScale = 1, pigment) {
      if (!this.scripting) return false;
      this.queue.push({ x, y, p: scriptPressure2(pressure), t, tx: tiltX, ty: tiltY, w: scriptWidthFactor2(widthScale), pig: pigment });
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
    setRandom(fn) {
      this.rng = fn;
    }
    /** SPIKE 002: the per-bristle deposit and the last-touch channel toggles. */
    setBristleMode(on, touch = false) {
      this.bristleMode = on;
      this.bristleTouch = touch && on;
    }
    /**
     * SPIKE 002 determinism control: pre-draws `n` values from the stroke RNG
     * before the bristle set is generated — an unrecorded state offset. Salt 0
     * is the record-only path; any other value must change the deposit.
     */
    setBristleSalt(n) {
      this.bristleSalt = Math.max(0, Math.trunc(n));
    }
    /** SPIKE 002: the measured shape of the workbench's extra state. */
    get bristleInfo() {
      const maxTex = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);
      const tiles = Math.ceil(this.dw / 128) * Math.ceil(this.dh / 128);
      const slots = tiles * 2;
      const cols = Math.min(slots, Math.floor(maxTex / 128));
      const rows = Math.ceil(slots / cols);
      const atlasPixels = cols * 128 * rows * 128;
      return {
        mode: this.bristleMode,
        touch: this.bristleTouch,
        count: this.bristleCount,
        reservoirBytes: BRISTLE_CAP * 3 * 8 * 2 + BRISTLE_CAP * 8,
        touchSheetBytes: this.dw * this.dh * 4 * 2,
        touchUndoBytesPerTexel: 4,
        undoAtlasPixels: atlasPixels,
        touchUndoBytes: atlasPixels * 4,
        maxTextureSize: maxTex
      };
    }
    /** SPIKE 002: the three reservoir textures as half floats (1 × 256 RGBA each). */
    readBristles() {
      const a = this.g.readHalf(this.bristles.read.views[0], 1, BRISTLE_CAP, 4);
      const b = this.g.readHalf(this.bristles.read.views[1], 1, BRISTLE_CAP, 4);
      const c = this.g.readHalf(this.bristles.read.views[2], 1, BRISTLE_CAP, 4);
      const out = new Uint16Array(a.length + b.length + c.length);
      out.set(a, 0);
      out.set(b, a.length);
      out.set(c, a.length + b.length);
      return out;
    }
    /** Deterministic bake: install a virtual clock in ms (A2). */
    setClock(fn) {
      this.clock = fn;
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
        if (this.fixTimer <= 0 && ++this.maskCounter >= MASK_EVERY2) {
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
      const px = this.readback(false, MODE2[background], texture);
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
      v = clamp3(v, 0, 1);
      if (v === this.paperStrength) return;
      this.paperStrength = v;
      this.redraw();
    }
    /**
     * Set the emboss light (Phase 64, MED-15). Angles are degrees. Azimuth wraps
     * into 0..360, elevation clamps into 0..90 and intensity into 0..4; a
     * non-finite value falls back to the default, and a field the caller omits is
     * left alone. An unchanged value writes nothing and redraws nothing.
     * Render-only: params, the pigment and the thickness field are never
     * touched, and the sheet is never marked dirty for undo (T-64-10).
     */
    setLight(next) {
      const azimuth = next.azimuth === void 0 ? this.light.azimuth : Number.isFinite(next.azimuth) ? next.azimuth : DEFAULT_LIGHT2.azimuth;
      const elevation = next.elevation === void 0 ? this.light.elevation : Number.isFinite(next.elevation) ? next.elevation : DEFAULT_LIGHT2.elevation;
      const intensity = next.intensity === void 0 ? this.light.intensity : Number.isFinite(next.intensity) ? next.intensity : DEFAULT_LIGHT2.intensity;
      const resolved = {
        azimuth: (azimuth % 360 + 360) % 360,
        elevation: clamp3(elevation, 0, 90),
        intensity: clamp3(intensity, 0, 4)
      };
      if (resolved.azimuth === this.light.azimuth && resolved.elevation === this.light.elevation && resolved.intensity === this.light.intensity) return;
      this.light = resolved;
      this.redraw();
    }
    /** The current emboss light state (Phase 64). A copy: callers cannot mutate the engine. */
    getLight() {
      return { ...this.light };
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
      const paper = g.target(w, h, [RGBA82], gl.LINEAR);
      const out = g.target(w, h, [RGBA82], gl.NEAREST);
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
    paperSheet(preset, width, height, scale = PAPER_UNITS2 / height) {
      if (!(width > 0) || !Number.isFinite(width) || !(height > 0) || !Number.isFinite(height)) {
        throw new RangeError(`paperSheet: width and height must be positive and finite (got ${width}\xD7${height})`);
      }
      if (!(scale > 0) || !Number.isFinite(scale)) {
        throw new RangeError(`paperSheet: scale must be positive and finite (got ${scale})`);
      }
      const w = Math.round(width), h = Math.round(height);
      const { gl, g } = this;
      const paper = g.target(w, h, [RGBA82], gl.LINEAR);
      const out = g.target(w, h, [RGBA82], gl.NEAREST);
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
    paperHeight(preset, width, height, scale = PAPER_UNITS2 / height) {
      if (!(width > 0) || !Number.isFinite(width) || !(height > 0) || !Number.isFinite(height)) {
        throw new RangeError(`paperHeight: width and height must be positive and finite (got ${width}\xD7${height})`);
      }
      if (!(scale > 0) || !Number.isFinite(scale)) {
        throw new RangeError(`paperHeight: scale must be positive and finite (got ${scale})`);
      }
      const w = Math.round(width), h = Math.round(height);
      const { gl, g } = this;
      const paper = g.target(w, h, [RGBA82], gl.LINEAR);
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
      const field = g.target(t.w, t.h, [HALF_FLOAT_RGBA2], gl.NEAREST);
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
      gl.uniform3fv(p.u.uPaperTint, linearRGB2(preset.tint));
      gl.uniform3fv(p.u.uFleckTint, linearRGB2(preset.fleck));
      gl.uniform1f(p.u.uMottle, preset.mottle);
      gl.uniform1f(p.u.uTexture, texture);
    }
    setTool(t) {
      this.tool = t;
      this.updateCursor();
    }
    setBrush(b) {
      this.brush = b;
      this.lastAngle = b.rotation === "fixed" ? b.angle * DEG4 : b.rotation === "follow" ? Math.atan2(this.lastDir[1], this.lastDir[0]) + b.angle * DEG4 : 0;
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
        const max = Math.min(MAX_REF_SIDE2, this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE));
        const s = Math.min(1, max / Math.max(img.width, img.height));
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
      v = clamp3(v, 0, 1);
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
      const key = brushTipCacheKey2(b);
      let t = this.tipTextures.get(key);
      if (t) return t;
      const { gl } = this;
      t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      const tipSource = b.textureId != null ? tipRowsForUpload2(b.tipData, b.tipSize) : b.tipData;
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
      this.fixTimer = FIX_DURATION2;
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
      this.clearLastTouch();
      this.resetPaintState();
      this.notifyHistory();
    }
    /** SPIKE 002: the last-touch sentinel (one week before the virtual clock's zero). */
    clearLastTouch() {
      const { gl } = this;
      for (const t of [this.lastTouch.read, this.lastTouch.write]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
        gl.clearColor(-604800, -604800, -604800, -604800);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    }
    /** Take back the stroke in progress as if it never happened (a touch that became a pinch). */
    abortStroke() {
      const s = this.stroke;
      if (!s) return;
      this.stroke = null;
      this.restoreStrokePigment();
      this.queue = [];
      if (s.pointerId !== SCRIPT_POINTER2) this.callbacks.onStrokeTool?.(null);
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
      index = clamp3(Math.round(index), 0, list.length);
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
        [[ink.read.views[0], ink.write.views[0]], [ink.read.views[1], ink.write.views[1]], [wet.read.views[0], wet.write.views[0]], [this.relief.views[0]], [this.cover.read.views[0], this.cover.write.views[0]], [this.lastTouch.read.views[0], this.lastTouch.write.views[0]]],
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
        this.dirty = union2(this.dirty, res.rect);
        this.painted = union2(this.painted, res.rect);
        this.everPainted = union2(this.everPainted, res.rect);
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
      const px = this.readback(false, MODE2[bg], o.texture ?? true);
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
    /**
     * 64-20 decision A — the capture-time clearance. A dedicated pass at the
     * export boundary (never the interactive displayFS output): the display's own
     * pigment RGBA is the source, and the shared FILM_PRESENCE snippet zeroes the
     * coverage alpha exactly where the final film reads paper-white on the
     * scan's own 8-bit grid. RGB passes through verbatim; every texel the film
     * does not clear is byte-identical.
     */
    clearPaperWhiteCoverage(target, source) {
      const { gl, g } = this;
      const p = this.programs.coverClear;
      p.bind();
      gl.uniform1i(p.u.uSrc, g.bindTex(0, source));
      gl.uniform1i(p.u.uPaper, g.bindTex(1, this.paper.tex[0]));
      gl.uniform1i(p.u.uInkA, g.bindTex(2, this.ink.read.tex[0]));
      gl.uniform1i(p.u.uInkB, g.bindTex(3, this.ink.read.tex[1]));
      gl.uniform1i(p.u.uFixedA, g.bindTex(4, this.fixed.tex[0]));
      gl.uniform1i(p.u.uFixedB, g.bindTex(5, this.fixed.tex[1]));
      gl.uniform1i(p.u.uCover, g.bindTex(6, this.cover.read.tex[0]));
      gl.uniform1f(p.u.uGranulation, this.params.granulation * 0.55);
      gl.disable(gl.BLEND);
      g.draw(target);
    }
    /** The composited document at full resolution as RGBA8 bytes, bottom row first. */
    readback(flat, mode = MODE2.paper, texture = true) {
      const { gl, g, dw, dh } = this;
      const out = g.target(dw, dh, [RGBA82], gl.NEAREST);
      this.drawDisplay(out, { x: 0, y: 0, w: dw, h: dh }, null, flat, mode, texture);
      let read = out;
      if (mode === MODE2.pigment) {
        read = g.target(dw, dh, [RGBA82], gl.NEAREST);
        this.clearPaperWhiteCoverage(read, out.tex[0]);
      }
      const px = new Uint8Array(dw * dh * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, read.fbo);
      gl.readPixels(0, 0, dw, dh, gl.RGBA, gl.UNSIGNED_BYTE, px);
      g.disposeTarget(out);
      if (read !== out) g.disposeTarget(read);
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
      const on = (el, type, fn, opts) => {
        el.addEventListener(type, fn, opts);
        this.disposers.push(() => el.removeEventListener(type, fn, opts));
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
        this.beginStep("stroke", STROKE_LABEL2[tool]);
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
      const end = (e) => {
        if (!this.stroke || e.pointerId !== this.stroke.pointerId) return;
        this.stroke.ending = true;
        this.schedule();
      };
      on(c, "pointerup", end);
      on(c, "pointercancel", end);
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
        if (typeof f === "number") this.force = { value: clamp3((f - 1) / 1.7, 0.04, 1), t: this.clock() };
      });
    }
    pushSample(e) {
      const [x, y] = this.toUv(e);
      let p = -1;
      let tx = e.tiltX || 0;
      let ty = e.tiltY || 0;
      const now = this.clock();
      const nativeActive = this.nativePenAt > -Infinity && now - this.nativePenAt < 300;
      const reportsPenDynamics = e.pointerType === "pen" && e.pressure !== 0.5 && e.pressure !== 0;
      if (nativeActive && this.nativePen && !reportsPenDynamics && (e.pointerType !== "mouse" || e.buttons > 0)) {
        p = this.nativePen.pressure;
        tx = this.nativePen.tiltX;
        ty = this.nativePen.tiltY;
      } else if (e.pointerType === "pen") {
        p = e.pressure > 0 ? Math.pow(e.pressure, 0.8) : 0.5;
      } else if (e.pointerType === "mouse" && now - this.force.t < 3e3) {
        p = this.force.value;
      }
      const sample = { x, y, p, t: e.timeStamp, tx, ty, w: 1 };
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
      const u = clamp3(fraction, 0, 1);
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
      const u = clamp3(fraction, 0, 1);
      const coeffs = this.scratchPigment.coeffs;
      for (let k = 0; k < COEFFS2; k++) {
        coeffs[k] = from.coeffs[k] + (to.coeffs[k] - from.coeffs[k]) * u;
      }
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
          return (16e-4 + 42e-4 * pr) * clamp3(1.12 - speed * 0.3, 0.55, 1.12) * m;
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
      const t = Math.pow(clamp3(pr, 0, 1), b.pressureSize);
      return (b.size[0] + (b.size[1] - b.size[0]) * t) * clamp3(1 - speed * b.speedThin, 0.4, 1) * this.sizeMult(widthFactor) * 0.8;
    }
    /** Tip angle for the next dab, in the document frame. */
    brushAngle(s) {
      const b = this.brush;
      let a;
      if (b.rotation === "random") a = this.rng() * Math.PI * 2;
      else if (b.rotation === "follow") a = Math.atan2(s.dy, s.dx) + b.angle * DEG4;
      else a = s.azimuth ?? b.angle * DEG4;
      if (b.angleJitter) a += (this.rng() - 0.5) * 2 * b.angleJitter * DEG4;
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
          if (this.bristleMode && s.tool === "brush") this.beginBristles(s.pr, this.radius("brush", s.pr, s.speed, q.w));
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
        const target = clamp3(1.18 - s.speed * 0.95, 0.12, 1);
        s.simPressure += (target - s.simPressure) * (1 - Math.exp(-sdt * 6));
        const pr = this.pressureOf(s, q.p);
        const vx = (nx - s.cx) / sdt, vy = (ny - s.cy) / sdt;
        if (s.pointerId === SCRIPT_POINTER2) {
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
        if (s.pointerId !== SCRIPT_POINTER2) {
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
      const n = clamp3(Math.ceil(approx / Math.max(fine, 1e-5)), 1, 48);
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
          const dryness = clamp3(b.grain + (1 - b.grain) * clamp3((0.5 - reservoir) * 2.5, 0, 1) * 0.6, 0, 1);
          const grainThr = 0.74 - 0.45 * pr - 0.05 * P.water;
          const conc = 0.15 * Math.exp(P.load * 2.8) * reservoir * (0.4 + 0.6 * pr) * b.load;
          const norm = clamp3(Math.sqrt(0.5 / b.tipMean), 0.7, 2.2);
          const amount = conc * Math.min(b.spacing, 1) / 1.8 * norm * dwell;
          const embossPress = EMBOSS_PRESS_FLOOR2 + (1 - EMBOSS_PRESS_FLOOR2) * clamp3(pr, 0, 1);
          const reliefAmount = P.emboss * amount * RELIEF_GAIN2 * embossPress;
          const coverAmount = Math.min(1, bodyCurve2(P.body) * COVER_GAIN2);
          const coverDensity = coverAmount > 0 ? COVER_MEDIUM_DENSITY2 * amount : 0;
          const coverRelief = coverAmount * RELIEF_ERODE2;
          const wet = (0.25 + 0.75 * P.water) * (0.7 + 0.3 * pr) * b.water * (0.4 + 0.6 * reservoir);
          const c = this.pigment.coeffs;
          const c0 = [c[0] * amount, c[1] * amount, c[2] * amount, c[3] * amount];
          const c1 = [c[4] * amount, c[5] * amount, c[6] * amount, scatteringDeposit2(P.body, amount)];
          if (coverAmount > 0) {
            const coverRect = this.stampRect(x, y, r * (1 + b.sizeJitter + b.scatter), this.dw, this.dh, 2);
            this.touch(coverRect);
            const m = PROTECT_MARGIN2;
            this.history.protect(1, { x0: Math.max(0, coverRect.x0 - m), y0: Math.max(0, coverRect.y0 - m), x1: Math.min(this.dw, coverRect.x1 + m), y1: Math.min(this.dh, coverRect.y1 + m) }, this.fixed.views);
          }
          this.eachDab(s, x, y, r, (dx, dy, dr, angle) => {
            if (this.bristleMode) {
              const t = this.bristleTravel(dx, dy, dr);
              this.carrierPass(dx, dy, dr, angle, t.travel, t.travelPx, t.alongPx, pr);
              if (coverAmount > 0) this.coverPass(dx, dy, dr, angle, coverAmount, coverDensity, coverRelief, dryness, grainThr);
              this.bristleInk(dx, dy, dr, angle, amount, pr, dryness, grainThr);
            } else {
              if (coverAmount > 0) this.coverPass(dx, dy, dr, angle, coverAmount, coverDensity, coverRelief, dryness, grainThr);
              if (coverAmount > 0) this.coverageDeposit(dx, dy, dr, angle, coverAmount, coverDensity, c, c1[3], dryness, grainThr);
              else this.brushInk(dx, dy, dr, angle, c0, c1, dryness, grainThr);
            }
            if (reliefAmount > 0) this.brushRelief(dx, dy, dr, angle, reliefAmount, dryness, grainThr);
            if (wet > 0) this.brushWet(dx, dy, dr * (1 + 0.12 * b.wetRound), angle, wet, b.wetRound, dryness, grainThr);
          });
          if (moving && b.water > 0) this.splatVelocity(x, y, r * 1.2, vx, vy, (15 + P.flow * 95) * 0.25 * b.flow);
          break;
        }
        case "water": {
          const b = this.brush;
          const reservoir = 0.25 + 0.75 * Math.exp(-s.travelled / ((3 + 4 * P.water) * b.capacity));
          const amp = (0.35 + 0.65 * P.water) * (0.5 + 0.5 * pr) * clamp3(b.water, 0.6, 1.5) * (0.7 + 0.3 * reservoir);
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
          const dens = (0.9 + 1.6 * pr) * clamp3(1.25 - s.speed * 0.45, 0.6, 1.25) * (0.5 + P.load);
          const amount = dens * 0.5 / 1.8 * dwell;
          const c = this.pigment.coeffs;
          this.splatInk(
            x,
            y,
            r,
            [c[0] * amount, c[1] * amount, c[2] * amount, c[3] * amount],
            [c[4] * amount, c[5] * amount, c[6] * amount, scatteringDeposit2(P.body, amount)],
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
    eachDab(s, x, y, r, fn) {
      const b = this.brush;
      const aspect = this.dw / this.dh;
      for (let i = 0; i < b.dabs; i++) {
        let dx = x, dy = y, dr = r;
        if (b.scatter > 0) {
          const a = this.rng() * Math.PI * 2, m = Math.sqrt(this.rng()) * b.scatter * r;
          dx += Math.cos(a) * m / aspect;
          dy += Math.sin(a) * m;
        }
        if (b.sizeJitter > 0) dr *= clamp3(1 + (this.rng() * 2 - 1) * b.sizeJitter, 0.15, 2);
        fn(dx, dy, dr, this.brushAngle(s));
      }
    }
    /**
     * Phase 64 (MED-14): every footprint uniform a stamp-family program reads,
     * bound from ONE place. drawStamp (pigment / water) and drawRelief (the
     * thickness deposit) share it, so a tip change can never diverge between the
     * two draws. `b` defaults to the active brush; Lift's erosion passes its own
     * brush and disables roughness / jitter so the mask is exactly the one
     * liftFS erodes pigment with.
     */
    bindFootprint(p, x, y, r, angle, round, grain, grainThr, b = this.brush, rough = b.roughness ?? 0, jitter = b.stampJitter ?? 0) {
      const { gl, g } = this;
      gl.uniform1i(p.u.uTip, g.bindTex(0, this.tipTexture(b)));
      gl.uniform1i(p.u.uPaper, g.bindTex(1, this.paper.tex[0]));
      gl.uniform1f(p.u.uAspect, this.dw / this.dh);
      gl.uniform2f(p.u.uPoint, x, y);
      gl.uniform1f(p.u.uRadius, r);
      gl.uniform1f(p.u.uTipAspect, b.aspect);
      gl.uniform1f(p.u.uTipRotation, (b.textureRotation ?? 0) * DEG4);
      gl.uniform2f(p.u.uAxis, Math.cos(angle), Math.sin(angle));
      gl.uniform1f(p.u.uRound, round);
      gl.uniform1f(p.u.uGrain, grain);
      gl.uniform1f(p.u.uGrainThr, grainThr);
      gl.uniform1f(p.u.uRough, rough);
      gl.uniform1f(p.u.uJitter, jitter);
    }
    drawStamp(t, x, y, r, angle, c0, c1, round, grain, grainThr) {
      const { gl, g } = this;
      const b = this.brush;
      const p = this.programs.stamp;
      p.bind();
      this.bindFootprint(p, x, y, r, angle, round, grain, grainThr);
      gl.uniform4fv(p.u.uColor0, c0);
      gl.uniform4fv(p.u.uColor1, c1);
      g.draw(t, this.stampRect(x, y, r, t.w, t.h, Math.sqrt(1 + b.aspect * b.aspect) * 1.02));
    }
    /**
     * Phase 64 (MED-14): draw the thickness deposit (or Lift's erosion) into the
     * relief target with the same footprint the pigment stamp uses. `rect`
     * defaults to the ink dab's rect; Lift passes its own rect with 0/0 grain and
     * 0 roughness / jitter, so the eroded mask matches liftFS exactly.
     */
    drawRelief(amount, x, y, r, angle, grain, grainThr, b = this.brush, rect = this.stampRect(x, y, r, this.dw, this.dh, 1.5), rough = b.roughness ?? 0, jitter = b.stampJitter ?? 0) {
      const { gl, g } = this;
      const p = this.programs.relief;
      p.bind();
      this.bindFootprint(p, x, y, r, angle, 0, grain, grainThr, b, rough, jitter);
      gl.uniform1f(p.u.uAmount, amount);
      g.draw(this.relief, rect);
    }
    /** Phase 64 (MED-14): additive per-dab thickness deposit. */
    brushRelief(x, y, r, angle, amount, grain, grainThr) {
      const { gl } = this;
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE);
      this.drawRelief(amount, x, y, r, angle, grain, grainThr);
      gl.disable(gl.BLEND);
    }
    /* ------------------------------------------------- SPIKE 002: bristles */
    /**
     * Stroke-start bristle seeding: the count (§4.1), the tufted set (§4.2),
     * and the initial reservoir upload. The only entropy is this.rng — the
     * stroke's traceSeed — so the set is a pure function of the stroke record.
     */
    beginBristles(pr, r) {
      const { gl, g } = this;
      const halfWidthPx = Math.max(1, r * this.dh);
      const count = bristleCount(halfWidthPx);
      for (let i = 0; i < this.bristleSalt; i += 1) this.rng();
      const set = makeBristles(count, this.rng);
      this.bristleCount = count;
      this.bristlePrev = { x: 0, y: 0, along: 0 };
      const n = BRISTLE_CAP;
      const a = new Float32Array(n * 4);
      const b = new Float32Array(n * 4);
      const c = new Float32Array(n * 4);
      const sh = new Float32Array(n * 4);
      const pig = this.pigment.coeffs;
      for (let i = 0; i < n; i++) {
        const idx = Math.min(i, count - 1);
        const base = idx * 8;
        const vj = set.data[base + 5];
        a.set([pig[0] * vj, pig[1] * vj, pig[2] * vj, pig[3] * vj], i * 4);
        b.set([pig[4] * vj, pig[5] * vj, pig[6] * vj, 1], i * 4);
        c.set([set.data[base + 6], set.data[base], set.data[base + 4], vj], i * 4);
        sh.set([set.data[base + 1], set.data[base + 2], set.data[base + 3], 0], i * 4);
      }
      const a16 = new Uint16Array(n * 4), b16 = new Uint16Array(n * 4);
      const c16 = new Uint16Array(n * 4), sh16 = new Uint16Array(n * 4);
      f32ToF162(a, a16);
      f32ToF162(b, b16);
      f32ToF162(c, c16);
      f32ToF162(sh, sh16);
      g.uploadHalf(this.bristles.write.tex[0], 0, 0, 1, n, gl.RGBA, a16);
      g.uploadHalf(this.bristles.write.tex[1], 0, 0, 1, n, gl.RGBA, b16);
      g.uploadHalf(this.bristles.write.tex[2], 0, 0, 1, n, gl.RGBA, c16);
      g.uploadHalf(this.bristleShape.tex[0], 0, 0, 1, n, gl.RGBA, sh16);
      this.bristles.swap();
    }
    /** Distance since the previous dab, in brush widths / document texels. */
    bristleTravel(x, y, r) {
      const aspect = this.dw / this.dh;
      const distDoc = Math.hypot((x - this.bristlePrev.x) * aspect, y - this.bristlePrev.y);
      const alongDoc = this.bristlePrev.along + distDoc;
      this.bristlePrev = { x, y, along: alongDoc };
      const travelPx = distDoc * this.dh;
      return {
        travel: travelPx / Math.max(2 * r * this.dh, 1e-3),
        travelPx,
        alongPx: alongDoc * this.dh
      };
    }
    /**
     * §3.1 carrier pass: one fragment per bristle, three canvas taps, the
     * pickup/refill mix and the load update. Runs before the dab's deposit.
     */
    carrierPass(x, y, r, angle, travel, travelPx, alongPx, pr) {
      const { gl, g } = this;
      const p = this.programs.bristleCarrier;
      p.bind();
      gl.uniform1i(p.u.uPaintA, g.bindTex(0, this.bristles.read.tex[0]));
      gl.uniform1i(p.u.uPaintB, g.bindTex(1, this.bristles.read.tex[1]));
      gl.uniform1i(p.u.uState, g.bindTex(2, this.bristles.read.tex[2]));
      gl.uniform1i(p.u.uShape, g.bindTex(3, this.bristleShape.tex[0]));
      gl.uniform1i(p.u.uInkA, g.bindTex(4, this.ink.read.tex[0]));
      gl.uniform1i(p.u.uInkB, g.bindTex(5, this.ink.read.tex[1]));
      gl.uniform1i(p.u.uFixedA, g.bindTex(6, this.fixed.tex[0]));
      gl.uniform1i(p.u.uFixedB, g.bindTex(7, this.fixed.tex[1]));
      gl.uniform1i(p.u.uWet, g.bindTex(8, this.wet.read.tex[0]));
      gl.uniform1i(p.u.uCover, g.bindTex(9, this.cover.read.tex[0]));
      gl.uniform1i(p.u.uTimes, g.bindTex(10, this.lastTouch.read.tex[0]));
      gl.uniform2f(p.u.uPoint, x, y);
      gl.uniform2f(p.u.uAxis, Math.cos(angle), Math.sin(angle));
      gl.uniform1f(p.u.uRadius, r);
      gl.uniform1f(p.u.uSheetAspect, this.dw / this.dh);
      gl.uniform1f(p.u.uCount, this.bristleCount);
      gl.uniform1f(p.u.uTravel, travel);
      gl.uniform1f(p.u.uTravelPx, travelPx);
      gl.uniform1f(p.u.uPressure, clamp3(pr, 0, 1));
      gl.uniform1f(p.u.uPickupRate, 0.6);
      gl.uniform1f(p.u.uRefillRate, 0.6);
      gl.uniform1f(p.u.uDepletion, 0.25 / Math.min(this.dw, this.dh));
      const c = this.pigment.coeffs;
      gl.uniform4f(p.u.uPigmentA, c[0], c[1], c[2], c[3]);
      gl.uniform3f(p.u.uPigmentB, c[4], c[5], c[6]);
      gl.uniform1f(p.u.uWetSeconds, 7);
      gl.uniform1f(p.u.uNow, this.clock() / 1e3);
      gl.uniform1f(p.u.uAlongPx, alongPx);
      gl.uniform1f(p.u.uStreakLen, 18);
      gl.uniform1f(p.u.uRimContact, 0.45);
      gl.uniform1i(p.u.uWetMode, this.bristleTouch ? 1 : 0);
      g.draw(this.bristles.write, { x0: 0, y0: 0, x1: 1, y1: this.bristleCount });
      this.bristles.swap();
    }
    /**
     * §3.2–§5 deposit: the 5-nearest gather writes the carried absorbance into
     * `ink` (additive, like brushInk) and the dab's coverage into `cover`
     * (the 64-13 union), then optionally the last-touch stamp (§3.4).
     */
    bristleInk(x, y, r, angle, amount, pr, grain, grainThr) {
      const { gl, g } = this;
      const rect = this.stampRect(x, y, r, this.dw, this.dh, 1.6);
      this.touch(rect);
      const alongPx = this.bristlePrev.along * this.dh;
      const bindCommon = (p2) => {
        gl.uniform1i(p2.u.uPaintA, g.bindTex(0, this.bristles.read.tex[0]));
        gl.uniform1i(p2.u.uPaintB, g.bindTex(1, this.bristles.read.tex[1]));
        gl.uniform1i(p2.u.uState, g.bindTex(2, this.bristles.read.tex[2]));
        gl.uniform1i(p2.u.uShape, g.bindTex(3, this.bristleShape.tex[0]));
        gl.uniform1i(p2.u.uPaper, g.bindTex(4, this.paper.tex[0]));
        gl.uniform1i(p2.u.uWet, g.bindTex(5, this.wet.read.tex[0]));
        gl.uniform1i(p2.u.uCover, g.bindTex(6, this.cover.read.tex[0]));
        gl.uniform1i(p2.u.uTimes, g.bindTex(7, this.lastTouch.read.tex[0]));
        gl.uniform2f(p2.u.uPoint, x, y);
        gl.uniform2f(p2.u.uAxis, Math.cos(angle), Math.sin(angle));
        gl.uniform1f(p2.u.uRadius, r);
        gl.uniform1f(p2.u.uSheetAspect, this.dw / this.dh);
        gl.uniform2f(p2.u.uSheet, this.dw, this.dh);
        gl.uniform1f(p2.u.uCount, this.bristleCount);
        gl.uniform1f(p2.u.uPressure, clamp3(pr, 0, 1));
        gl.uniform1f(p2.u.uGrain, grain);
        gl.uniform1f(p2.u.uSoftness, 0.09);
        gl.uniform1f(p2.u.uStreak, 0.9);
        gl.uniform1f(p2.u.uStreakLen, 18);
        gl.uniform1f(p2.u.uStreakShare, 0.15);
        gl.uniform1f(p2.u.uRimContact, 0.45);
        gl.uniform1f(p2.u.uHairs, 0.45);
        gl.uniform1f(p2.u.uDryEdge, 0.35);
        gl.uniform1f(p2.u.uLanding, 1);
        gl.uniform1f(p2.u.uAlongPx, alongPx);
        gl.uniform1f(p2.u.uStrokeDistPx, alongPx);
        gl.uniform1f(p2.u.uHalfWidthPx, r * this.dh);
        gl.uniform1i(p2.u.uWetMode, this.bristleTouch ? 1 : 0);
        gl.uniform1f(p2.u.uWetSeconds, 7);
        gl.uniform1f(p2.u.uNow, this.clock() / 1e3);
      };
      let p = this.programs.bristleDeposit;
      p.bind();
      bindCommon(p);
      gl.uniform1f(p.u.uAmount, amount);
      gl.uniform1f(p.u.uBody, clamp3(this.params.body, 0, 1));
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE);
      g.draw(this.ink.read, rect);
      gl.disable(gl.BLEND);
      p = this.programs.bristleCover;
      p.bind();
      bindCommon(p);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      g.draw(this.cover.read, rect);
      gl.disable(gl.BLEND);
      if (this.bristleTouch) {
        p = this.programs.bristleTouch;
        p.bind();
        gl.uniform1i(p.u.uTimes, g.bindTex(0, this.lastTouch.read.tex[0]));
        gl.uniform1i(p.u.uCover, g.bindTex(1, this.cover.read.tex[0]));
        gl.uniform1f(p.u.uNow, this.clock() / 1e3);
        gl.uniform1f(p.u.uAmount, clamp3(amount * 8, 0, 1));
        g.draw(this.lastTouch.write, rect);
        this.lastTouch.swap();
      }
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
    /**
     * Phase 64 (MED-19..MED-22, spec 06): the cover pass — per dab, erode the
     * SETTLED pigment and the paint thickness under the dab's own tip, before
     * the dab deposits. One multiplicative draw, no tissue-water step: Body is
     * order, not water.
     *
     * The erase mask is the deposit's own tip-space footprint (rotation, jitter,
     * paper tooth) with the deposit's LOW cut but a WIDE inward ramp, softened
     * before the tip square's cull, and its strength is the SPIKE 001 coverage
     * term `a = coverAmount * (1 - exp(-density * mask))` — the SAME `a` the
     * coverage composite lets the paint film hide. `fixed` loses exactly what
     * the film gains, so the body replaces the settled underlayer while the
     * tip's alpha rim and the bristle gaps keep a partial underlayer (the
     * old/new mix the edge needs).
     * The Body row sits between Viscosity and Emboss (D-07); spec 08's
     * scattering composes on top through the same curve.
     *
     * ONE extra multiplicative draw per dab into two targets that already
     * exist: no new target, no allocation. Undo is NOT taken here: the caller
     * protects both pools once per stamp, before the first call, because the
     * deposit's own undo protection comes too late to save a relief this draw
     * has already eroded.
     */
    coverPass(x, y, r, angle, amount, density, reliefAmount, grain, grainThr) {
      const { gl, g } = this;
      const p = this.programs.bodyCover;
      p.bind();
      this.bindFootprint(this.programs.bodyCover, x, y, r, angle, 0, grain, grainThr);
      gl.uniform1f(p.u.uAmount, amount);
      gl.uniform1f(p.u.uDensity, density);
      gl.uniform1f(p.u.uShape, 1);
      const rect = this.stampRect(x, y, r, this.dw, this.dh, 2);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);
      g.draw(this.fixed, rect);
      gl.uniform1f(p.u.uAmount, reliefAmount);
      gl.uniform1f(p.u.uShape, 0);
      g.draw(this.relief, rect);
      gl.disable(gl.BLEND);
    }
    /**
     * SPIKE 001: the coverage composite — source-over inside the pigment layer,
     * replacing "erase the underlayer, then deposit". Per dab, on one shared
     * footprint rect, three scissored draws:
     *
     *   ink   <- ink * (1 - a) + C * a      (attenuate, then add the masstone)
     *   fixed <- fixed * (1 - a)            (settled underlayer, same a; coverPass)
     *   cover <- cover * (1 - a) + a        (the compositor's layer alpha)
     *
     * `a = amount * (1 - exp(-density * footprintMask))` with `density` the
     * MEDIUM's per-dab density (see COVER_MEDIUM_DENSITY), so coverage is
     * pigment-independent. `C` is this dab's masstone absorbance, so overlapping
     * dabs are idempotent: the colour converges on the chosen pigment instead of
     * summing absorbances (the black drift), and a near-white pigment covers
     * because its coverage does not come from its darkness. No snapshot, no
     * ping-pong, no full-document pass.
     */
    coverageDeposit(x, y, r, angle, amount, density, coeffs, scatter, grain, grainThr) {
      const { gl, g } = this;
      this.touch(this.stampRect(x, y, r, this.dw, this.dh, 1.5));
      const rect = this.stampRect(x, y, r, this.dw, this.dh, 2);
      const c = this.programs.bodyCover;
      c.bind();
      this.bindFootprint(c, x, y, r, angle, 0, grain, grainThr);
      gl.uniform1f(c.u.uAmount, amount);
      gl.uniform1f(c.u.uDensity, density);
      gl.uniform1f(c.u.uShape, 1);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);
      g.draw(this.ink.read, rect);
      gl.disable(gl.BLEND);
      const d = this.programs.coverDeposit;
      d.bind();
      this.bindFootprint(d, x, y, r, angle, 0, grain, grainThr);
      gl.uniform4f(d.u.uColor0, coeffs[0], coeffs[1], coeffs[2], coeffs[3]);
      gl.uniform4f(d.u.uColor1, coeffs[4], coeffs[5], coeffs[6], scatter);
      gl.uniform1f(d.u.uAmount, amount);
      gl.uniform1f(d.u.uDensity, density);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE);
      g.draw(this.ink.read, rect);
      gl.disable(gl.BLEND);
      const m = this.programs.coverMask;
      m.bind();
      this.bindFootprint(m, x, y, r, angle, 0, grain, grainThr);
      gl.uniform1f(m.u.uAmount, amount);
      gl.uniform1f(m.u.uDensity, density);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      g.draw(this.cover.read, rect);
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
      return { x0: clamp3(cx - e, 0, w), y0: clamp3(cy - e, 0, h), x1: clamp3(cx + e, 0, w), y1: clamp3(cy + e, 0, h) };
    }
    /**
     * Grow the simulated region. With `save`, the tiles around `rect` are saved for undo
     * first: a step restores what its own dabs and fills touched (plus a margin for what
     * spread from them), while the rest of the sheet simply keeps drying. That keeps a
     * step's cost proportional to the stroke, not to everything that happens to be wet.
     */
    touch(rect, wake = true, save = true) {
      if (rect.x1 <= rect.x0 || rect.y1 <= rect.y0) return;
      const next = union2(this.active, rect);
      if (save) {
        const m = PROTECT_MARGIN2;
        this.history.protect(0, { x0: Math.max(0, rect.x0 - m), y0: Math.max(0, rect.y0 - m), x1: Math.min(this.dw, rect.x1 + m), y1: Math.min(this.dh, rect.y1 + m) }, this.snapshotLayers());
      }
      this.active = next;
      this.painted = union2(this.painted, rect);
      this.everPainted = union2(this.everPainted, rect);
      this.dirty = union2(this.dirty, rect);
      if (wake) this.minAwakeUntil = Math.max(this.minAwakeUntil, this.clock() + 250);
    }
    snapshotLayers() {
      return [this.ink.read.views[0], this.ink.read.views[1], this.wet.read.views[0], this.relief.views[0], this.cover.read.views[0], this.lastTouch.read.views[0]];
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
      const m = PROTECT_MARGIN2;
      this.history.protect(1, { x0: Math.max(0, rect.x0 - m), y0: Math.max(0, rect.y0 - m), x1: Math.min(this.dw, rect.x1 + m), y1: Math.min(this.dh, rect.y1 + m) }, this.fixed.views);
      const p = this.programs.lift;
      p.bind();
      gl.uniform1i(p.u.uTip, g.bindTex(0, this.tipTexture(b)));
      gl.uniform1f(p.u.uAspect, this.dw / this.dh);
      gl.uniform2f(p.u.uPoint, x, y);
      gl.uniform1f(p.u.uRadius, r);
      gl.uniform1f(p.u.uTipAspect, b.aspect);
      gl.uniform1f(p.u.uTipRotation, (b.textureRotation ?? 0) * DEG4);
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
      g.draw(this.cover.read, rect);
      this.drawRelief(amount, x, y, r, angle, 0, 0, b, rect, 0, 0);
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
      if (this.wetPeak <= WET_THRESHOLD2) return this.lastWet;
      return this.lastWet + this.dryTau() * Math.log(this.wetPeak / WET_THRESHOLD2) * 1e3;
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
      const viscosity = this.params.viscosity;
      const rect = this.active;
      P.advectVelocity.bind();
      gl.uniform1i(P.advectVelocity.u.uVelocity, g.bindTex(0, vel.read.tex[0]));
      gl.uniform1i(P.advectVelocity.u.uWet, g.bindTex(1, this.wet.read.tex[0]));
      gl.uniform2fv(P.advectVelocity.u.uTexel, simTexel);
      gl.uniform1f(P.advectVelocity.u.uDt, dt);
      gl.uniform1f(P.advectVelocity.u.uDissipation, Math.exp(-dt * (3 - flow * 2.4 + viscosity * 12)) * (fixing ? Math.exp(-dt * 7) : 1));
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
      for (let i = 0; i < PRESSURE_ITERATIONS2; i++) {
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
      gl.uniform1f(P.advectWet.u.uSpread, 0.12 * (1 - viscosity * 0.9));
      g.draw(this.wet.write, rect);
      this.wet.swap();
      const settle = fixing ? 1 - Math.exp(-dt * 5) : 0;
      if (fixing) {
        gl.enable(gl.BLEND);
        gl.blendEquation(gl.FUNC_ADD);
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
      P.advectCover.bind();
      gl.uniform1i(P.advectCover.u.uVelocity, g.bindTex(0, vel.read.tex[0]));
      gl.uniform1i(P.advectCover.u.uCover, g.bindTex(1, this.cover.read.tex[0]));
      gl.uniform1i(P.advectCover.u.uWet, g.bindTex(2, this.wet.read.tex[0]));
      gl.uniform1i(P.advectCover.u.uInkA, g.bindTex(3, this.ink.read.tex[0]));
      gl.uniform1i(P.advectCover.u.uInkB, g.bindTex(4, this.ink.read.tex[1]));
      gl.uniform1i(P.advectCover.u.uFixedA, g.bindTex(5, this.fixed.tex[0]));
      gl.uniform1i(P.advectCover.u.uFixedB, g.bindTex(6, this.fixed.tex[1]));
      gl.uniform1i(P.advectCover.u.uPaper, g.bindTex(7, this.paper.tex[0]));
      gl.uniform2fv(P.advectCover.u.uSimTexel, simTexel);
      gl.uniform2fv(P.advectCover.u.uTexel, texel);
      gl.uniform1f(P.advectCover.u.uDt, dt);
      gl.uniform1f(P.advectCover.u.uBleed, this.params.bleed);
      gl.uniform1f(P.advectCover.u.uEdge, this.params.edge * 1.4);
      gl.uniform1f(P.advectCover.u.uAspect, this.dw / this.dh);
      gl.uniform1f(P.advectCover.u.uGranulation, this.params.granulation * 0.55);
      gl.uniform3f(P.advectCover.u.uBrush, this.brushNow.x, this.brushNow.y, this.brushNow.r);
      g.draw(this.cover.write, rect);
      this.cover.swap();
      this.dirty = union2(this.dirty, rect);
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
      gl.uniform1f(p.u.uThreshold, WET_THRESHOLD2);
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
          x0: Math.max(0, x0 * MASK_BLOCK2 - MASK_MARGIN2),
          y0: Math.max(0, y0 * MASK_BLOCK2 - MASK_MARGIN2),
          x1: Math.min(this.dw, (x1 + 1) * MASK_BLOCK2 + MASK_MARGIN2),
          y1: Math.min(this.dh, (y1 + 1) * MASK_BLOCK2 + MASK_MARGIN2)
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
    drawDisplay(target, view, scissor, flat = false, mode = MODE2.screen, texture = true) {
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
      gl.uniform3fv(p.u.uDesk, DESK2);
      gl.uniform1i(p.u.uMode, mode);
      this.paperUniforms(p, this.paperPreset, texture ? this.paperStrength : 0);
      const ref = mode === MODE2.screen && !flat && this.refVisible ? this.ref : null;
      gl.uniform1f(p.u.uRefOpacity, ref ? this.refOpacity : 0);
      gl.uniform1i(p.u.uRef, g.bindTex(6, ref ? ref.tex : this.paper.tex[0]));
      gl.uniform1i(p.u.uRelief, g.bindTex(7, this.relief.tex[0]));
      gl.uniform1i(p.u.uCover, g.bindTex(8, this.cover.read.tex[0]));
      gl.uniform1f(p.u.uLightAzimuth, this.light.azimuth * Math.PI / 180);
      gl.uniform1f(p.u.uLightElevation, this.light.elevation * Math.PI / 180);
      gl.uniform1f(p.u.uLightIntensity, this.light.intensity);
      gl.uniform1f(p.u.uReliefBump, RELIEF_BUMP2);
      const r = this.refRect;
      gl.uniform4f(p.u.uRefRect, r.x, r.y, r.w, r.h);
      const shadow = mode === MODE2.screen && !target ? clamp3(Math.min(view.w, view.h) / this.dpr * 0.05, 14, 48) * this.dpr : 0;
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
      this.drawDisplay(null, this.view, rect, false, this.compositorLayer ? MODE2.pigment : MODE2.screen);
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
      const dt = clamp3((now - this.lastFrame) / 1e3, 1 / 240, 1 / 30);
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
        if (this.fixTimer <= 0 && ++this.maskCounter >= MASK_EVERY2) {
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

  // workbench/src/payload/vectorPath.ts
  function isFiniteNumber3(value) {
    return typeof value === "number" && Number.isFinite(value);
  }
  function isFinitePoint4(value) {
    if (typeof value !== "object" || value === null) return false;
    const point = value;
    return isFiniteNumber3(point.x) && isFiniteNumber3(point.y);
  }
  var AQUARELLE_CURVE_MODES2 = Object.freeze([
    "bezier",
    "spline"
  ]);
  function isAquarelleCurveMode2(value) {
    return AQUARELLE_CURVE_MODES2.includes(value);
  }
  function canonicalAnchor2(raw) {
    const x = raw["x"];
    const y = raw["y"];
    if (!isFiniteNumber3(x) || !isFiniteNumber3(y)) return void 0;
    const kind = raw["kind"];
    if (kind !== "auto" && kind !== "bezier") return void 0;
    const handleIn = raw["in"];
    const handleOut = raw["out"];
    if (handleIn !== void 0 && !isFinitePoint4(handleIn)) return void 0;
    if (handleOut !== void 0 && !isFinitePoint4(handleOut)) return void 0;
    const width = raw["width"];
    if (width !== void 0) {
      if (!isFiniteNumber3(width)) return void 0;
      if (width < ANCHOR_WIDTH_MIN2 || width > ANCHOR_WIDTH_MAX2) return void 0;
    }
    const color = raw["color"];
    const normalisedColor = color === void 0 ? void 0 : normaliseAnchorColor2(color);
    if (color !== void 0 && normalisedColor === void 0) return void 0;
    const anchor = { x, y, kind };
    if (handleIn !== void 0) anchor.in = { x: handleIn.x, y: handleIn.y };
    if (handleOut !== void 0) anchor.out = { x: handleOut.x, y: handleOut.y };
    if (width !== void 0) anchor.width = width;
    if (normalisedColor !== void 0) anchor.color = normalisedColor;
    return anchor;
  }
  function normaliseAquarelleAnchors2(input) {
    if (!Array.isArray(input) || input.length === 0) return void 0;
    const anchors = [];
    for (const entry of input) {
      if (typeof entry !== "object" || entry === null) return void 0;
      const anchor = canonicalAnchor2(entry);
      if (anchor === void 0) return void 0;
      anchors.push(anchor);
    }
    return Object.freeze(anchors);
  }
  function projectVectorPath2(anchors) {
    const projected = anchors.map((anchor) => {
      const next = { x: anchor.x, y: anchor.y, kind: anchor.kind };
      if (anchor.in !== void 0) next.in = { x: anchor.in.x, y: anchor.in.y };
      if (anchor.out !== void 0) next.out = { x: anchor.out.x, y: anchor.out.y };
      if (anchor.width !== void 0 && anchor.width !== ANCHOR_WIDTH_DEFAULT2) {
        next.width = anchor.width;
      }
      if (anchor.color !== void 0) next.color = anchor.color;
      return next;
    });
    return Object.freeze(projected);
  }

  // workbench/src/payload/toStudioStroke.ts
  var AQUARELLE_TOOLS2 = Object.freeze([
    "brush",
    "water",
    "pen",
    "lift"
  ]);
  var DIFFUSION_CAP2 = 600;
  var PAINT_SEED_SALT_PARAM = "paintSeedSalt";
  function paintSeedSaltOf(params) {
    const raw = params?.[PAINT_SEED_SALT_PARAM];
    if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
    const salt = Math.trunc(raw);
    return salt < 0 ? null : salt;
  }
  function toStudioStroke2(s) {
    const baseSeed = hashMutationId(s.mutationId);
    const salt = paintSeedSaltOf(s.params);
    const pointTicks = s.pointTicks;
    const pts = s.points.map((p, i) => ({
      x: p.x,
      y: p.y,
      p: p.p,
      tx: p.tx,
      ty: p.ty,
      tw: p.tw,
      // quick 261116-rp: a raw-timed stroke keeps its REAL tick offsets. They
      // are nondecreasing but may repeat or skip — the deposit the live sheet
      // made. Absent/ill-sized timings fall back to the index law.
      tick: pointTicks !== void 0 && pointTicks.length === s.points.length ? Math.max(0, Math.trunc(pointTicks[i] ?? i)) : i
    }));
    let previousTick = 0;
    for (const point of pts) {
      point.tick = Math.max(previousTick, point.tick);
      previousTick = point.tick;
    }
    const lastTick = pts.length > 0 ? pts[pts.length - 1].tick : 0;
    return {
      pts,
      ticks: Math.max(1, lastTick),
      cuisson: s.diffusionFrames !== void 0 && s.diffusionFrames > 0 ? Math.min(DIFFUSION_CAP2, Math.trunc(s.diffusionFrames)) : 0,
      motion: null,
      brushId: s.brushId,
      toolOverrides: s.toolOverrides ? { ...s.toolOverrides } : {},
      traceSeed: salt === null ? baseSeed : mixStrokeSeed(baseSeed, salt),
      recordedOrder: s.timestamp,
      playFrame: s.playFrame ?? null,
      color: s.color,
      engine: {
        tool: s.tool,
        color: s.color,
        params: { ...s.params },
        brushId: s.brushId,
        toolOverrides: s.toolOverrides ? { ...s.toolOverrides } : void 0,
        // quick-261115-oh9: written ONLY when a texture was chosen, so an
        // untextured stroke keeps its exact pre-texture key set. A LIFT never
        // carries one — the eraser has no texture, and the one projection is
        // where that law is enforced for every producer (record, restore,
        // duplicate, script copy).
        ...s.textureId !== void 0 && s.tool !== "lift" ? { textureId: s.textureId } : {},
        // quick 261116-inu: the rotation is a texture-side property — written
        // only when the stroke carries one, never as a `textureRotation:
        // undefined` residue (the textureId precedent above).
        ...s.textureRotation !== void 0 && s.tool !== "lift" ? { textureRotation: s.textureRotation } : {},
        mutationId: s.mutationId,
        diffusionFrames: s.diffusionFrames,
        timestamp: s.timestamp,
        playFrame: s.playFrame,
        // 61-03: conditional canonical terms — each vector field is written
        // ONLY when present, so a hand-painted stroke keeps its exact
        // pre-vector key set and a mode-only stroke gains that key alone.
        ...s.anchors !== void 0 ? { anchors: projectVectorPath2(s.anchors) } : {},
        ...s.curveMode !== void 0 ? { curveMode: s.curveMode } : {},
        ...s.vectorDrawn === true ? { vectorDrawn: true } : {}
      }
    };
  }

  // workbench/src/payload/dryEvent.ts
  function isAquarelleDryEvent2(value) {
    if (typeof value !== "object" || value === null) return false;
    const v = value;
    return v["kind"] === "dry";
  }

  // workbench/src/payload/codec.ts
  var AQUARELLE_SCHEMA_VERSION2 = 1;
  function isRecord2(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  function isFiniteNumber4(value) {
    return typeof value === "number" && Number.isFinite(value);
  }
  function isIntegerTick2(value) {
    return isFiniteNumber4(value) && Number.isInteger(value) && value >= 0;
  }
  var TOOL_OVERRIDE_KEYS2 = [
    "tip",
    "aspect",
    "rotation",
    "sizeCurve",
    "scatter",
    "capacity",
    "grain",
    "wetRound"
  ];
  function isToolOverrides2(value) {
    if (!isRecord2(value)) return false;
    for (const key of TOOL_OVERRIDE_KEYS2) {
      const v = value[key];
      if (v !== void 0 && !isFiniteNumber4(v)) return false;
    }
    return true;
  }
  function isStudioPoint2(value) {
    if (!isRecord2(value)) return false;
    return isFiniteNumber4(value["x"]) && isFiniteNumber4(value["y"]) && isFiniteNumber4(value["p"]) && isFiniteNumber4(value["tx"]) && isFiniteNumber4(value["ty"]) && isFiniteNumber4(value["tw"]) && isIntegerTick2(value["tick"]);
  }
  function isDryEventShape2(value) {
    if (!isRecord2(value)) return false;
    if (value["kind"] !== "dry") return false;
    if (!isIntegerTick2(value["tick"])) return false;
    if (!isFiniteNumber4(value["recordedOrder"])) return false;
    if ("pts" in value || "brushId" in value || "brush" in value || "tool" in value) {
      return false;
    }
    return true;
  }
  function isStrokeShape2(value) {
    if (!isRecord2(value)) return false;
    if (!Array.isArray(value["pts"])) return false;
    if (!value["pts"].every(isStudioPoint2)) return false;
    if (!isFiniteNumber4(value["ticks"]) || value["ticks"] < 1) return false;
    if (!isFiniteNumber4(value["cuisson"]) || value["cuisson"] < 0) return false;
    if (!("motion" in value)) return false;
    if (typeof value["brushId"] !== "string") return false;
    if (!isToolOverrides2(value["toolOverrides"])) return false;
    if (!isFiniteNumber4(value["traceSeed"])) return false;
    if (!isFiniteNumber4(value["recordedOrder"])) return false;
    if (!("playFrame" in value)) return false;
    if (!("color" in value)) return false;
    const engine = value["engine"];
    if (!isRecord2(engine)) return false;
    if (typeof engine["tool"] !== "string") return false;
    if (!AQUARELLE_TOOLS2.includes(engine["tool"])) return false;
    if (typeof engine["brushId"] !== "string") return false;
    if (!isRecord2(engine["params"])) return false;
    if (!isFiniteNumber4(engine["timestamp"])) return false;
    const anchors = engine["anchors"];
    if (anchors !== void 0 && normaliseAquarelleAnchors2(anchors) === void 0) return false;
    const curveMode = engine["curveMode"];
    if (curveMode !== void 0 && !isAquarelleCurveMode2(curveMode)) return false;
    const vectorDrawn = engine["vectorDrawn"];
    if (vectorDrawn !== void 0 && vectorDrawn !== true) return false;
    const textureId = engine["textureId"];
    if (textureId !== void 0 && (typeof textureId !== "string" || textureId.length === 0)) {
      return false;
    }
    return true;
  }
  function clampDiffusion2(value) {
    if (value === void 0) return void 0;
    if (!isFiniteNumber4(value) || value <= 0) return 0;
    return Math.min(DIFFUSION_CAP2, Math.trunc(value));
  }
  function cloneStrokeForWire2(stroke) {
    const cuisson = Math.min(DIFFUSION_CAP2, Math.max(0, Math.trunc(stroke.cuisson)));
    const diffusionFrames = clampDiffusion2(stroke.engine.diffusionFrames);
    const anchors = stroke.engine.anchors === void 0 ? void 0 : normaliseAquarelleAnchors2(stroke.engine.anchors);
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
  function cloneDryForWire2(dry) {
    return { kind: "dry", tick: dry.tick, recordedOrder: dry.recordedOrder };
  }
  function serialize2(event) {
    if (isAquarelleDryEvent2(event)) {
      return {
        schemaVersion: AQUARELLE_SCHEMA_VERSION2,
        event: cloneDryForWire2(event)
      };
    }
    if (!isStrokeShape2(event)) {
      throw new TypeError("payloadCodec.serialize: expected an AquarellePayloadEvent");
    }
    return {
      schemaVersion: AQUARELLE_SCHEMA_VERSION2,
      event: cloneStrokeForWire2(event)
    };
  }
  function parse2(raw) {
    if (!isRecord2(raw)) return null;
    if (raw["schemaVersion"] !== AQUARELLE_SCHEMA_VERSION2) return null;
    const event = raw["event"];
    if (isDryEventShape2(event)) return cloneDryForWire2(event);
    if (isStrokeShape2(event)) return cloneStrokeForWire2(event);
    return null;
  }
  var payloadCodec2 = {
    serialize: serialize2,
    parse: parse2
  };

  // workbench/src/brushes/deriveMask.ts
  var TIP_MASK_EDGE2 = 512;
  var TIP_MASK_BYTES2 = TIP_MASK_EDGE2 * TIP_MASK_EDGE2;

  // workbench/src/brushes/maskRegistry.ts
  var masks2 = /* @__PURE__ */ new Map();
  function resolveMask2(id) {
    return masks2.get(id) ?? null;
  }

  // workbench/src/playground/brushBridge.ts
  var TIP_TO_PRESET2 = {
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
  function mult2(v, fallback = 1) {
    return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;
  }
  function presetFor2(brushId) {
    const presetId = TIP_TO_PRESET2[brushId] ?? (BRUSH_PRESETS2.some((b) => b.id === brushId) ? brushId : "round");
    return BRUSH_PRESETS2.find((b) => b.id === presetId) ?? BRUSH_PRESETS2[0];
  }
  function resolveStrokeBrush2(brushId, textureId, seed, textureRotation = null) {
    const base = presetFor2(brushId);
    const mask = textureId ? resolveMask2(textureId) : null;
    return {
      ...buildBrush2({ ...base, tip: mask ?? base.tip }, seed),
      textureId: mask ? textureId : null,
      // quick 261116-inu: same law for the rotation — it only means something
      // on a textured tip. A textured rotationless stroke carries 0 degrees
      // (the library default); an untextured/unknown one carries null.
      textureRotation: mask ? textureRotation ?? 0 : null
    };
  }
  function buildBrushForStroke2(brushId, options) {
    const base = resolveStrokeBrush2(
      brushId,
      options?.textureId ?? null,
      options?.seed ?? 7,
      options?.textureRotation ?? null
    );
    const overrides = options?.overrides;
    if (!overrides) return base;
    return {
      ...base,
      aspect: base.aspect * mult2(overrides.aspect),
      angle: base.angle * mult2(overrides.rotation),
      pressureSize: base.pressureSize * mult2(overrides.sizeCurve),
      spacing: base.spacing / mult2(overrides.tip),
      scatter: base.scatter * mult2(overrides.scatter),
      capacity: base.capacity * mult2(overrides.capacity),
      grain: base.grain * mult2(overrides.grain),
      wetRound: base.wetRound * mult2(overrides.wetRound)
    };
  }

  // workbench/src/adapter/engineAdapter.ts
  var HOST_TICK_HZ2 = 60;
  var HOST_DT2 = 1 / HOST_TICK_HZ2;
  function resolveBakePaperPreset2(paper, hostPreset) {
    if (!paper) return hostPreset;
    const vendor = PAPERS2.find((preset) => preset.id === paper.paperId);
    if (vendor) return vendor;
    return hostPreset ?? DEFAULT_PAPER2;
  }
  function acceptEvent2(raw) {
    if (typeof raw !== "object" || raw === null) return null;
    if (isAquarelleDryEvent2(raw)) {
      return payloadCodec2.parse(payloadCodec2.serialize(raw));
    }
    return payloadCodec2.parse(payloadCodec2.serialize(raw));
  }
  function seededRandom2(seed) {
    let state = seed | 0 || 1;
    return () => {
      state = state + 1831565813 | 0;
      let t = Math.imul(state ^ state >>> 15, 1 | state);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var AQUARELLE_TOOL_SET2 = /* @__PURE__ */ new Set(["brush", "water", "pen", "lift"]);
  function asTool2(raw) {
    return AQUARELLE_TOOL_SET2.has(raw) ? raw : "brush";
  }
  function resolveStrokeWidthFactors2(payload, pts) {
    const anchors = payload.anchors;
    if (anchors === void 0 || anchors.length === 0) return null;
    if (isUniformWidthProfile2(anchors)) return null;
    return Float32Array.from(sampleVectorWidths2(anchors, pts));
  }
  function resolveStrokeBaseColor2(stroke) {
    const hex = stroke.color ?? stroke.engine.color;
    return typeof hex === "string" && hex.length > 0 ? hex : null;
  }
  function resolveStrokeColors2(stroke, pts) {
    const anchors = stroke.engine.anchors;
    if (anchors === void 0 || anchors.length === 0) return null;
    if (isUniformColorProfile2(anchors)) return null;
    const base = resolveStrokeBaseColor2(stroke);
    if (base === null) return null;
    return sampleVectorColors2(anchors, pts, base).map((hex) => pigmentFromHex2(hex));
  }
  function createAquarelleEngineAdapter2(options = {}) {
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
        engine = new WatercolorEngine2(canvas, null, {}, width > 0 && height > 0 ? [width, height] : null);
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
    engine?.setRandom(seededRandom2(1));
    let paintSeedFrame = null;
    const applyPaper = (paper, preset) => {
      if (!engine) return;
      const resolved = preset ?? resolveBakePaperPreset2(paper, options.paperPreset);
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
    if (options.light && engine) {
      engine.setLight({ ...options.light });
    }
    let active = null;
    const feedStates = /* @__PURE__ */ new Map();
    const configure = (stroke) => {
      if (!engine) return;
      const payload = stroke.engine;
      const tool = asTool2(payload.tool);
      engine.setParams(toEngineParams2(payload.params));
      engine.setBrush(
        buildBrushForStroke2(payload.brushId ?? stroke.brushId, {
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
      const hex = resolveStrokeBaseColor2(stroke);
      if (hex !== null) engine.setPigment(pigmentFromHex2(hex));
      engine.setTool(tool);
      engine.setRandom(
        seededRandom2(
          paintSeedFrame === null ? stroke.traceSeed || 1 : mixStrokeSeed(stroke.traceSeed || 1, paintSeedFrame)
        )
      );
    };
    const applyDry = () => {
      if (!engine) return;
      engine.fix();
      for (let i = 0; i < 30; i += 1) {
        advanceClock(1e3 * HOST_DT2);
        engine.tick(HOST_DT2);
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
        advanceClock(1e3 * HOST_DT2);
        if (!active.started) {
          active.started = true;
          engine.scriptBegin(
            asTool2(active.stroke.engine.tool),
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
        engine.tick(HOST_DT2);
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
          advanceClock(1e3 * HOST_DT2);
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
        engine.setRandom(seededRandom2(1));
      },
      // The 56-06 codec covers the one payload union (strokes + Dry).
      // The host EngineAdapter type is stroke-shaped because the host
      // never reads P and never sees Dry — cast through unknown at this
      // seam only (T-56-17: host never inspects the engine slot).
      payloadCodec: {
        serialize: (raw) => payloadCodec2.serialize(raw),
        parse: (raw) => payloadCodec2.parse(raw)
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
        if (isAquarelleDryEvent2(stroke)) {
          applyDry();
          return;
        }
        const parsed = acceptEvent2(stroke);
        if (!parsed || isAquarelleDryEvent2(parsed)) return;
        strokes.push(parsed);
        if (!engine) return;
        configure(parsed);
        active = {
          stroke: parsed,
          index: 0,
          started: false,
          widths: resolveStrokeWidthFactors2(parsed.engine, parsed.pts),
          colors: resolveStrokeColors2(parsed, parsed.pts)
        };
        feedDueSample(Number.MAX_SAFE_INTEGER);
        advanceClock(1e3 * HOST_DT2);
        engine.tick(HOST_DT2);
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
            widths: resolveStrokeWidthFactors2(stroke.engine, stroke.pts),
            colors: resolveStrokeColors2(stroke, stroke.pts)
          };
          feedDueSample(Number.MAX_SAFE_INTEGER);
          advanceClock(1e3 * HOST_DT2);
          engine.tick(HOST_DT2);
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
              widths: resolveStrokeWidthFactors2(stroke.engine, stroke.pts),
              colors: resolveStrokeColors2(stroke, stroke.pts)
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
        advanceClock(1e3 * HOST_DT2);
        engine.tick(HOST_DT2);
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

  // probe/probe.ts
  var PAPER_SEED = 12648430;
  var PAPER_STRENGTH = 1;
  var SETTLE_TICKS = 8;
  var COLD = PAPERS.find((preset) => preset.id === "cold");
  var STROKE_PARAMS = {
    size: 12,
    water: 50,
    load: 50,
    flow: 50,
    bleed: 50,
    dry: 50,
    edge: 50,
    granulation: 50,
    lift: 22
  };
  function seededRandom3(seed) {
    let state = seed | 0 || 1;
    return () => {
      state = state + 1831565813 | 0;
      let t = Math.imul(state ^ state >>> 15, 1 | state);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function withSeededMathRandom(seed, fn) {
    const original = Math.random;
    const rng = seededRandom3(seed);
    Math.random = () => rng();
    try {
      return fn();
    } finally {
      Math.random = original;
    }
  }
  var BYTES_PER_TEXEL = {
    33327: 4,
    // RG16F
    33325: 2,
    // R16F
    34842: 8,
    // RGBA16F
    33328: 8,
    // RG32F
    32856: 4,
    // RGBA8
    33326: 4,
    // R32F
    34836: 16
    // RGBA32F
  };
  var MEMORY = { total: 0, peak: 0, live: /* @__PURE__ */ new Map() };
  var instrumented = false;
  function instrumentGL() {
    if (instrumented) return;
    instrumented = true;
    for (const glClass of [GL, GL2]) {
      const proto = glClass.prototype;
      const original = proto.target;
      proto.target = function patchedTarget(w, h, formats, filter) {
        const bytes = w * h * formats.reduce((sum, f) => sum + (BYTES_PER_TEXEL[f.internal] ?? 0), 0);
        MEMORY.total += bytes;
        MEMORY.peak = Math.max(MEMORY.peak, MEMORY.total);
        const t = original.call(this, w, h, formats, filter);
        MEMORY.live.set(t, bytes);
        return t;
      };
      const originalDispose = proto.disposeTarget;
      proto.disposeTarget = function patchedDispose(t) {
        const bytes = MEMORY.live.get(t);
        if (bytes !== void 0) {
          MEMORY.total -= bytes;
          MEMORY.live.delete(t);
        }
        return originalDispose.call(this, t);
      };
      const originalDisposeAll = proto.disposeTargets;
      proto.disposeTargets = function patchedDisposeAll() {
        return originalDisposeAll.call(this);
      };
    }
  }
  function resetMemory() {
    MEMORY.total = 0;
    MEMORY.peak = 0;
    MEMORY.live.clear();
  }
  var baseEngine = null;
  var bristleEngine = null;
  function tapEngine(cls, assign) {
    const proto = cls.prototype;
    const original = proto.setManual;
    proto.setManual = function patched(manual) {
      if (!this.__capped) {
        this.__capped = true;
        assign(this);
      }
      return original.call(this, manual);
    };
  }
  tapEngine(WatercolorEngine, (e) => {
    baseEngine = e;
  });
  tapEngine(WatercolorEngine2, (e) => {
    bristleEngine = e;
  });
  function fnvBytes(bytes) {
    let hash = 2166136261;
    for (let i = 0; i < bytes.length; i += 1) {
      hash ^= bytes[i];
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
  function digestCanvas(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("digest: exported canvas has no 2D context");
    return fnvBytes(new Uint8ClampedArray(ctx.getImageData(0, 0, canvas.width, canvas.height).data));
  }
  function horizontalLine(y, pressure = 0.75) {
    return [
      { x: 0.16, y, p: pressure, tx: 0, ty: 0, tw: 0 },
      { x: 0.5, y: y + 2e-3, p: pressure, tx: 0, ty: 0, tw: 0 },
      { x: 0.84, y, p: pressure, tx: 0, ty: 0, tw: 0 }
    ];
  }
  function diagonal(x0, y0, x1, y1, pressure = 0.8) {
    return [
      { x: x0, y: y0, p: pressure, tx: 0, ty: 0, tw: 0 },
      { x: (x0 + x1) / 2, y: (y0 + y1) / 2 + 0.02, p: pressure, tx: 0, ty: 0, tw: 0 },
      { x: x1, y: y1, p: pressure, tx: 0, ty: 0, tw: 0 }
    ];
  }
  function watercolor50() {
    const script = [];
    for (let i = 0; i < 50; i += 1) {
      const jitter = (i % 3 - 1) * 3e-3;
      script.push({
        color: "#cc2222",
        points: horizontalLine(0.5 + jitter),
        mutationId: 8315136 + i,
        settle: 1,
        fixAfter: false
      });
    }
    return script;
  }
  function crossScene() {
    return [
      { color: "#111111", points: horizontalLine(0.5, 0.7), mutationId: 5353473 },
      { color: "#dddddd", points: diagonal(0.2, 0.8, 0.8, 0.2), mutationId: 5353474, fixAfter: false },
      { color: "#cc2222", points: diagonal(0.2, 0.24, 0.8, 0.8), mutationId: 5353475, fixAfter: false }
    ];
  }
  function neutralScene() {
    return [
      {
        color: "#2244aa",
        points: [
          { x: 0.3, y: 0.3, p: 0.55, tx: 0, ty: 0, tw: 0 },
          { x: 0.42, y: 0.4, p: 0.7, tx: 0, ty: 0, tw: 0 },
          { x: 0.56, y: 0.52, p: 0.62, tx: 0, ty: 0, tw: 0 },
          { x: 0.7, y: 0.62, p: 0.45, tx: 0, ty: 0, tw: 0 }
        ],
        mutationId: 7169489
      }
    ];
  }
  function acrylic20() {
    const script = [];
    const colors = ["#cc2222", "#224488", "#dddddd", "#333333"];
    for (let i = 0; i < 20; i += 1) {
      const row = i % 4;
      const y = 0.22 + row * 0.18;
      const points = i % 2 === 0 ? horizontalLine(y, 0.75) : diagonal(0.16, y - 0.09, 0.84, y + 0.09, 0.75);
      script.push({
        color: colors[row],
        points,
        mutationId: 5357568 + i,
        settle: 3,
        fixAfter: i % 5 !== 4
      });
    }
    return script;
  }
  function readScenario() {
    const scenario = QUERY.get("scenario") ?? "cross";
    if (scenario === "cross") return crossScene();
    if (scenario === "watercolor-50") return watercolor50();
    if (scenario === "neutral") return neutralScene();
    if (scenario === "acrylic-20") return acrylic20();
    throw new Error(`invalid scenario "${scenario}" (expected cross, watercolor-50, neutral, acrylic-20)`);
  }
  function makeStroke(entry) {
    return toStudioStroke2({
      tool: "brush",
      color: entry.color,
      params: { ...STROKE_PARAMS, size: CANON_SIZE },
      brushId: BRUSH_ID,
      points: entry.points.map((p) => ({ ...p })),
      mutationId: entry.mutationId,
      timestamp: 0
    });
  }
  function canary() {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const engine = withSeededMathRandom(PAPER_SEED, () => new WatercolorEngine2(canvas, null, {}, [64, 64]));
    try {
      const gl = engine.gl;
      return gl.getParameter(gl.RENDERER);
    } finally {
      engine.destroy();
    }
  }
  var CROSS_BOXES = {
    crossing: { x0: 0.46, y0: 0.46, x1: 0.54, y1: 0.54 },
    redOwn: { x0: 0.28, y0: 0.34, x1: 0.36, y1: 0.42 },
    lightOwn: { x0: 0.28, y0: 0.64, x1: 0.36, y1: 0.72 },
    paper: { x0: 0.45, y0: 0.86, x1: 0.55, y1: 0.94 }
  };
  function boxMean(canvas, box) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("box mean: no 2D context");
    const w = canvas.width;
    const h = canvas.height;
    const x0 = Math.max(0, Math.min(w - 1, Math.round(box.x0 * w)));
    const x1 = Math.max(x0 + 1, Math.min(w, Math.round(box.x1 * w)));
    const y0 = Math.max(0, Math.min(h - 1, Math.round((1 - box.y1) * h)));
    const y1 = Math.max(y0 + 1, Math.min(h, Math.round((1 - box.y0) * h)));
    const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n += 1;
    }
    const mean = { r: r / n, g: g / n, b: b / n };
    return { ...mean, luma: (mean.r + mean.g + mean.b) / 3 };
  }
  function paintedPct(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("painted pct: no 2D context");
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      painted += (data[i] + data[i + 1] + data[i + 2]) / 3 < 250 ? 1 : 0;
      n += 1;
    }
    return Math.round(1e3 * painted / n) / 10;
  }
  var QUERY = new URLSearchParams(location.search);
  var CANON_SIZE = Number(QUERY.get("sizeParam") ?? "12");
  var BRUSH_ID = QUERY.get("brush") ?? "round";
  function runOnce(engineKind, script, sheet, touch, salt, pinnedPaperSeed = true) {
    if (!COLD) throw new Error("paper preset 'cold' is not in PAPERS");
    if (engineKind === "baseline") baseEngine = null;
    else bristleEngine = null;
    instrumentGL();
    resetMemory();
    const make = () => {
      if (engineKind === "baseline") {
        return createAquarelleEngineAdapter({ width: sheet, height: sheet, paperPreset: COLD, paperStrength: PAPER_STRENGTH });
      }
      return createAquarelleEngineAdapter2({ width: sheet, height: sheet, paperPreset: COLD, paperStrength: PAPER_STRENGTH });
    };
    const adapter = pinnedPaperSeed ? withSeededMathRandom(PAPER_SEED, make) : make();
    try {
      const engine = engineKind === "baseline" ? baseEngine : bristleEngine;
      if (engine === null) throw new Error(`probe never captured the ${engineKind} engine`);
      if (engineKind === "bristle") {
        const be = engine;
        be.setBristleMode(true, touch);
        be.setBristleSalt(salt);
      }
      const bakeStart = performance.now();
      script.forEach((entry, index) => {
        adapter.applyStroke(makeStroke(entry));
        const settle = entry.settle ?? SETTLE_TICKS;
        for (let tick = 0; tick <= settle; tick += 1) adapter.stepTick(tick);
        if (entry.fixAfter !== false) adapter.fix();
        if (entry.fixAfter === false && (index + 1) % 10 === 0) adapter.fix();
      });
      if (script.some((e) => e.fixAfter === false)) adapter.fix();
      const bakeMs = Math.round(performance.now() - bakeStart);
      const renderStart = performance.now();
      const paperCanvas = engine.exportCanvas("paper");
      const transparentCanvas = engine.exportCanvas("transparent");
      const whiteCanvas = engine.exportCanvas("white");
      const pigmentCanvas = engine.exportCanvas("pigment");
      const paper = digestCanvas(paperCanvas);
      const transparent = digestCanvas(transparentCanvas);
      const white = digestCanvas(whiteCanvas);
      const pigment = digestCanvas(pigmentCanvas);
      const renderMs = Math.round(performance.now() - renderStart);
      const painted = paintedPct(transparentCanvas);
      const regions = {
        crossing: boxMean(pigmentCanvas, CROSS_BOXES.crossing),
        redOwn: boxMean(pigmentCanvas, CROSS_BOXES.redOwn),
        lightOwn: boxMean(pigmentCanvas, CROSS_BOXES.lightOwn),
        paper: boxMean(pigmentCanvas, CROSS_BOXES.paper)
      };
      let bristleDigest = null;
      let info = null;
      if (engineKind === "bristle") {
        const be = engine;
        bristleDigest = fnvBytes(be.readBristles());
        info = { ...be.bristleInfo, gpuLiveBytes: MEMORY.total };
      }
      return {
        digests: { paper, transparent, white, pigment },
        bakeMs,
        renderMs,
        paintedPct: painted,
        regions,
        gpuPeakBytes: MEMORY.peak,
        bristleDigest,
        bristleInfo: info
      };
    } finally {
      adapter.dispose();
    }
  }
  function writeResult(report) {
    const pre = document.getElementById("result");
    if (!pre) throw new Error("probe page is missing pre#result");
    pre.textContent = JSON.stringify(report, null, 2);
    const status = document.getElementById("status");
    if (status) status.textContent = "DONE";
    console.log("PROBE_RESULT " + JSON.stringify(report));
  }
  function main() {
    const params = new URLSearchParams(location.search);
    const gate = params.get("gate") ?? "bristle-cross";
    const engineKind = params.get("engine") ?? "bristle";
    const sheet = Number(params.get("size") ?? "256");
    const touch = params.get("touch") === "1";
    const salt = Number(params.get("salt") ?? "0");
    const runs = Number(params.get("runs") ?? "2");
    try {
      if (!Number.isInteger(sheet) || sheet < 32 || sheet > 4096) throw new Error(`invalid size ${sheet}`);
      const script = readScenario();
      const renderer = canary();
      const paperB = params.get("paperB") === "random" ? false : true;
      const first = runOnce(engineKind, script, sheet, touch, salt);
      const second = runs >= 2 ? runOnce(engineKind, script, sheet, touch, salt, paperB) : first;
      writeResult({
        gate,
        engine: engineKind,
        scenario: params.get("scenario") ?? "cross",
        brush: BRUSH_ID,
        sizeParam: CANON_SIZE,
        sheet,
        touch,
        salt,
        runs,
        paperB: paperB ? "fixed" : "random",
        renderer,
        runA: first,
        runB: second,
        identicalImages: runs >= 2 ? JSON.stringify(first.digests) === JSON.stringify(second.digests) : null,
        identicalBristles: runs >= 2 && first.bristleDigest !== null ? first.bristleDigest === second.bristleDigest : null,
        verdict: "SPIKE-002 CAPTURED"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeResult({ gate, engine: engineKind, sheet, touch, salt, verdict: `SPIKE-002 FAIL ${message}`, error: message });
    }
  }
  main();
})();
