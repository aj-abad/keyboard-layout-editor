import { identity, IDENTITY_HUES, type IdentityHue } from "../../tailwind.config";

/**
 * Seeded art for an avatar with no image: a workspace, an organization,
 * anything that would otherwise wear a blank well.
 *
 * One seed in, one picture out, the same on every screen and every visit. The
 * seed picks one of the eight identity hues (`identity` in the Tailwind
 * config), and draws a field of sines, cut into three flat levels of that hue:
 *
 * - **The field is a sine bent by a second sine.** One wave runs across the
 *   tile at an angle the seed draws; a second, slower wave bends its phase,
 *   so the bands wander. A third, faint wave runs along them. Waves are 30 to
 *   46 units long on the 48-unit tile.
 * - **Three levels, one weight.** The cut points are taken from the field's
 *   own values, so every tile is 40% ground, 35% mid and 25% deep, and no
 *   avatar sits heavier on a page than another, as the family's marks keep
 *   their ink within 9% of each other.
 * - **A gutter parts the two figures.** The deep level is outlined in the
 *   ground's colour, as the marks part their pieces. The renderer sizes it in
 *   CSS pixels (`avatarArtGutter`), so it stays one device-independent pixel
 *   or more at every size instead of thinning with the art.
 *
 * Flat: fills only, holes cut even-odd, no gradients, masks or filters, so the
 * same layers draw in SVG on the web and in react-native-svg on a phone.
 *
 * **The art is pinned.** `avatarArt.test.ts` fingerprints it for a set of
 * seeds, so a change to anything here (the hash, the field, the cuts, the
 * rounding, the order of `identity`) fails the tests. Such a change re-draws
 * every avatar a user has learned to recognise, so it is made on purpose:
 * bump `AVATAR_ART_VERSION` and take the new fingerprints with it.
 */
export const AVATAR_ART_VERSION = 1;

/** The art is drawn in a square of this many units; scale it with a `viewBox`. */
export const AVATAR_ART_BOX = 48;

export type AvatarArtDepth = "ground" | "mid" | "deep";

export interface AvatarArtLayer {
  /** Path data in the 48-unit box. */
  readonly d: string;
  readonly depth: AvatarArtDepth;
  /** Fill with the even-odd rule: the level's holes are cut, not painted. */
  readonly evenOdd: boolean;
  /** Stroke this layer's edge in the ground's colour: the gutter. */
  readonly gutter: boolean;
}

export interface AvatarArt {
  readonly version: typeof AVATAR_ART_VERSION;
  readonly hue: IdentityHue;
  /** The hue's three depths, by name: what each layer's `depth` paints. */
  readonly colors: (typeof identity)[IdentityHue];
  /** Back to front: ground, mid, deep. */
  readonly layers: readonly AvatarArtLayer[];
}

/**
 * The gutter's width in CSS pixels for art drawn `size` pixels wide: one up to
 * 24, one and a half up to 48, two above. `Avatar` sets the same steps with
 * container queries, since a caller may size it by class; the two must agree.
 */
export const avatarArtGutter = (size: number) => (size <= 24 ? 1 : size <= 48 ? 1.5 : 2);

/* ------------------------------------------------------------------ *
 * Seed → numbers
 * ------------------------------------------------------------------ */

/** The same identity however it was typed: composed, trimmed, lowercased. */
const normalize = (seed: string) => seed.normalize("NFKC").trim().toLowerCase();

/** cyrb128: four 32-bit words with good avalanche from a short string. */
const cyrb128 = (text: string): [number, number, number, number] => {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
};

/** sfc32, a small fast generator, warmed up past its first draws. */
const random = (text: string) => {
  let [a, b, c, d] = cyrb128(text);
  const next = () => {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  return next;
};

/*
 * The salts keep the hue and the shape independent draws. They are the
 * study's names, kept so the art matches the canvas it was chosen from.
 */
const HUE_SALT = "\u0000hue";
const SHAPE_SALT = "\u0000contours2";

/** The identity hue a seed takes, without drawing the art. */
export const avatarHue = (seed: string): IdentityHue =>
  IDENTITY_HUES[Math.floor(random(normalize(seed) + HUE_SALT)() * IDENTITY_HUES.length)]!;

/* ------------------------------------------------------------------ *
 * The field
 * ------------------------------------------------------------------ */

type Point = [number, number];
type Field = (x: number, y: number) => number;

const TAU = 2 * Math.PI;

/**
 * Field values are snapped to a 2⁻¹⁶ grid before anything is cut from them,
 * so the last-digit differences between engines' `Math.sin` cannot move an
 * edge between the browser, the server and the phone.
 */
const snap = (value: number) => Math.round(value * 65536) / 65536;

const flowField = (u: readonly number[]): Field => {
  const angle = u[0]! * Math.PI;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const k = TAU / (30 + 16 * u[2]!);
  const bend = 4 + 5 * u[3]!;
  const kBend = TAU / (30 + 30 * u[4]!);
  const kAlong = TAU / (40 + 30 * u[8]!);
  const phase = u[5]! * TAU;
  const bendPhase = u[6]! * TAU;
  const alongPhase = u[7]! * TAU;
  return (x, y) => {
    const across = x * cos + y * sin;
    const along = -x * sin + y * cos;
    return snap(
      Math.sin(k * (across + bend * Math.sin(kBend * along + bendPhase)) + phase) +
        0.35 * Math.sin(kAlong * along + alongPhase),
    );
  };
};

/** The share of the tile below each cut: 40% ground, then 35% mid, 25% deep. */
const SHARES = [0.4, 0.75] as const;

/** Cut points as field values, read off a 24 × 24 sample of the tile. */
const cutPoints = (field: Field) => {
  const values: number[] = [];
  for (let j = 0; j < 24; j++)
    for (let i = 0; i < 24; i++) values.push(field(1 + 2 * i, 1 + 2 * j));
  values.sort((a, b) => a - b);
  return SHARES.map(
    (share) => values[Math.min(values.length - 1, Math.floor(share * values.length))]!,
  );
};

/* ------------------------------------------------------------------ *
 * Contours
 * ------------------------------------------------------------------ */

/**
 * The level set `field ≥ cut` as closed loops, by marching squares on a
 * 2-unit grid. The grid runs past the tile on every side and its outer ring is
 * held far below any cut, so every contour closes: a level that meets the
 * tile's edge closes just outside it, where the avatar's clip hides the seam.
 */
const levelLoops = (field: Field, cut: number): Point[][] => {
  const step = 2;
  const low = -6;
  const n = (54 - low) / step;
  const at = (q: number) => low + (q - 1) * step;
  const grid: number[][] = [];
  for (let j = 0; j <= n + 2; j++) {
    const row: number[] = [];
    for (let i = 0; i <= n + 2; i++) {
      const edge = i === 0 || j === 0 || i === n + 2 || j === n + 2;
      row.push(edge ? -1e3 : field(at(i), at(j)));
    }
    grid.push(row);
  }
  const points = new Map<string, Point>();
  const crossing = (
    key: string,
    ax: number,
    ay: number,
    av: number,
    bx: number,
    by: number,
    bv: number,
  ) => {
    if (!points.has(key)) {
      const t = (cut - av) / (bv - av);
      points.set(key, [ax + t * (bx - ax), ay + t * (by - ay)]);
    }
    return key;
  };
  const links = new Map<string, string[]>();
  const link = (p: string, q: string) => {
    if (!links.has(p)) links.set(p, []);
    links.get(p)!.push(q);
    if (!links.has(q)) links.set(q, []);
    links.get(q)!.push(p);
  };
  for (let j = 0; j <= n + 1; j++) {
    for (let i = 0; i <= n + 1; i++) {
      const a = grid[j]![i]!;
      const b = grid[j]![i + 1]!;
      const c = grid[j + 1]![i + 1]!;
      const d = grid[j + 1]![i]!;
      const code =
        (a >= cut ? 8 : 0) | (b >= cut ? 4 : 0) | (c >= cut ? 2 : 0) | (d >= cut ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const x0 = at(i);
      const x1 = at(i + 1);
      const y0 = at(j);
      const y1 = at(j + 1);
      const top = crossing(`h${i},${j}`, x0, y0, a, x1, y0, b);
      const right = crossing(`v${i + 1},${j}`, x1, y0, b, x1, y1, c);
      const bottom = crossing(`h${i},${j + 1}`, x0, y1, d, x1, y1, c);
      const left = crossing(`v${i},${j}`, x0, y0, a, x0, y1, d);
      // A saddle takes the side its centre is on.
      const centre = (a + b + c + d) / 4 >= cut;
      if (code === 1 || code === 14) link(left, bottom);
      else if (code === 2 || code === 13) link(bottom, right);
      else if (code === 3 || code === 12) link(left, right);
      else if (code === 4 || code === 11) link(top, right);
      else if (code === 6 || code === 9) link(top, bottom);
      else if (code === 7 || code === 8) link(left, top);
      else if (code === 5) {
        if (centre) {
          link(left, top);
          link(bottom, right);
        } else {
          link(left, bottom);
          link(top, right);
        }
      } else if (code === 10) {
        if (centre) {
          link(left, bottom);
          link(top, right);
        } else {
          link(left, top);
          link(bottom, right);
        }
      }
    }
  }
  const seen = new Set<string>();
  const loops: Point[][] = [];
  for (const start of links.keys()) {
    if (seen.has(start)) continue;
    const loop: Point[] = [];
    let previous: string | null = null;
    let current: string | undefined = start;
    while (current && !seen.has(current)) {
      seen.add(current);
      loop.push(points.get(current)!);
      const neighbours: string[] = links.get(current)!;
      const next: string | undefined = neighbours[0] !== previous ? neighbours[0] : neighbours[1];
      previous = current;
      current = next;
    }
    if (loop.length > 3) loops.push(loop);
  }
  return loops;
};

const area = (loop: readonly Point[]) => {
  let sum = 0;
  for (let i = 0; i < loop.length; i++) {
    const [x1, y1] = loop[i]!;
    const [x2, y2] = loop[(i + 1) % loop.length]!;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum / 2);
};

/** A tenth of a unit is a fiftieth of a pixel at 96px: path text, not precision, is the cost. */
const tenth = (value: number) => Math.round(value * 10) / 10;
const point = ([x, y]: Point) => `${tenth(x)} ${tenth(y)}`;

/** A closed loop through every point, as Catmull-Rom curves written as cubic Béziers. */
const smoothLoop = (loop: readonly Point[]) => {
  const n = loop.length;
  const at = (i: number) => loop[(i + n) % n]!;
  let d = `M${point(at(0))}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${point(c1)} ${point(c2)} ${point(p2)}`;
  }
  return `${d}Z`;
};

/**
 * Speckles under 12 square units, about two square pixels at 20px, are
 * dropped rather than drawn as dust. Every other crossing is kept, which the
 * curves smooth through, and halves the path.
 */
const levelPath = (field: Field, cut: number) =>
  levelLoops(field, cut)
    .filter((loop) => area(loop) >= 12)
    .map((loop) => smoothLoop(loop.filter((_, i) => i % 2 === 0)))
    .join("");

/** The ground covers past the tile, so no clip can find an edge to show. */
const GROUND = "M-14 -14h76v76h-76Z";

/* ------------------------------------------------------------------ *
 * The art
 * ------------------------------------------------------------------ */

const drawn = new Map<string, AvatarArt>();
const REMEMBERED = 256;

/**
 * The art for a seed. Pass something that never changes, such as a
 * workspace's id (`workspace:1042`); a name or a slug can be edited, and the
 * art would change with it. Memoised, since a list draws the same seeds on
 * every render.
 */
export const avatarArt = (seed: string): AvatarArt => {
  const key = normalize(seed);
  const remembered = drawn.get(key);
  if (remembered) return remembered;

  const next = random(key + SHAPE_SALT);
  const draws = Array.from({ length: 24 }, next);
  const field = flowField(draws);
  const [mid, deep] = cutPoints(field);
  const hue = avatarHue(seed);
  const art: AvatarArt = {
    version: AVATAR_ART_VERSION,
    hue,
    colors: identity[hue],
    layers: [
      { d: GROUND, depth: "ground", evenOdd: false, gutter: false },
      { d: levelPath(field, mid!), depth: "mid", evenOdd: true, gutter: false },
      { d: levelPath(field, deep!), depth: "deep", evenOdd: true, gutter: true },
    ],
  };
  if (drawn.size >= REMEMBERED) drawn.delete(drawn.keys().next().value!);
  drawn.set(key, art);
  return art;
};
