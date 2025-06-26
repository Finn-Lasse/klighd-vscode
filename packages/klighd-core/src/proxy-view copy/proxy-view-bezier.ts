import { Bounds } from "sprotty-protocol";
import { SKEdge, SKNode } from "../skgraph-models";

const {cos, sin, acos, atan2, sqrt, pow } = Math;
const pi = Math.PI

// type Bounds = { x: number; y: number; width: number; height: number};
type Point = { x: number; y: number };
type Line = { p1: Point; p2: Point };

function align(points: Point[], line: Line) {
    const tx = line.p1.x,
        ty = line.p1.y,
        a = -atan2(line.p2.y - ty, line.p2.x - tx),
        d = function (v: Point) {
            return {
            x: (v.x - tx) * cos(a) - (v.y - ty) * sin(a),
            y: (v.x - tx) * sin(a) + (v.y - ty) * cos(a),
            };
        };
    return points.map(d);
}
// cube root function yielding real roots
function crt(v: number) {
  return v < 0 ? -pow(-v, 1 / 3) : pow(v, 1 / 3);
}

// https://pomax.github.io/bezierinfo/#yforx
// https://pomax.github.io/bezierinfo/#extremities
function roots(points: Point[], line: Line) {
    line = line || { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } };

    const aligned = align(points, line);
    const reduce = function (t: number) {
         return 0 <= t && t <= 1;
    };

    // see http://www.trans4mind.com/personal_development/mathematics/polynomials/cubicAlgebra.htm
    const pa = aligned[0].y,
      pb = aligned[1].y,
      pc = aligned[2].y,
      pd = aligned[3].y;

    let d = -pa + 3 * pb - 3 * pc + pd,
      a = 3 * pa - 6 * pb + 3 * pc,
      b = -3 * pa + 3 * pb,
      c = pa;

    if (d == 0) {                                               //TODO: approx vllt wieder einsetzen, da mit trigonom. Funktionen gearbeitet wurde -> float fehler
      // this is not a cubic curve.
      if (a == 0) {
        // in fact, this is not a quadratic curve either.
        if (b == 0) {
          // in fact in fact, there are no solutions.
          return [];
        }
        // linear solution:
        return [-c / b].filter(reduce);
      }
      // quadratic solution:
      const q = sqrt(b * b - 4 * a * c),
        a2 = 2 * a;
      return [(q - b) / a2, (-b - q) / a2].filter(reduce);
    }

    // at this point, we know we need a cubic solution:

    a /= d;
    b /= d;
    c /= d;

    const p = (3 * b - a * a) / 3,
      p3 = p / 3,
      q = (2 * a * a * a - 9 * a * b + 27 * c) / 27,
      q2 = q / 2,
      discriminant = q2 * q2 + p3 * p3 * p3;

    let u1, v1, x1, x2, x3;
    if (discriminant < 0) {
      const mp3 = -p / 3,
        mp33 = mp3 * mp3 * mp3,
        r = sqrt(mp33),
        t = -q / (2 * r),
        cosphi = t < -1 ? -1 : t > 1 ? 1 : t,
        phi = acos(cosphi),
        crtr = crt(r),
        t1 = 2 * crtr;
      x1 = t1 * cos(phi / 3) - a / 3;
      x2 = t1 * cos((phi + 2 * pi) / 3) - a / 3;
      x3 = t1 * cos((phi + 2 * 2 * pi) / 3) - a / 3;
      return [x1, x2, x3].filter(reduce);
    } else if (discriminant === 0) {
      u1 = q2 < 0 ? crt(-q2) : -crt(q2);
      x1 = 2 * u1 - a / 3;
      x2 = -u1 - a / 3;
      return [x1, x2].filter(reduce);
    } else {
      const sd = sqrt(discriminant);
      u1 = crt(-q2 + sd);
      v1 = crt(q2 + sd);
      return [u1 - v1 - a / 3].filter(reduce);
    }
}

export function computeCubic(t: number, p: Point[]) {

    const mt = 1 - t;

    const a = mt * mt * mt;
    const b = mt * mt * t * 3;
    const c = mt * t * t * 3;
    const d = t * t * t;

    return {
        x: a * p[0].x + b * p[1].x + c * p[2].x + d * p[3].x,
        y: a * p[0].y + b * p[1].y + c * p[2].y + d * p[3].y
    };
}

export function getValueAt(value: number, points: Point[], axis = 0) {

    const xcoords = points.map(p => ({x:p.y - value , y: p.x - value}));

    let line = { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0} }
    if (axis == 1){
        line = { p1: { x: 0, y: 0 }, p2: { x: 0, y: 1} }
    }
    let root = roots(xcoords, line);

    const result : {point : Point, t : number}[] = []

    for (const t of root){
        const point : Point = computeCubic(t, points)
        result.push({ point , t })
    }

    return result
};


export function getBoundsFromPoints(points: Point[]): Bounds{
    const xarr = points.map((p) => p.x);
    const yarr = points.map((p) => p.y);

    const xmin = Math.min(...xarr)
    const ymin = Math.min(...yarr)
    const xmax = Math.max(...xarr)
    const ymax = Math.max(...yarr)

    return {x:xmin, y : ymin, width : xmax - xmin, height : ymax - ymin}
}

export enum Sides {
	N = "N",
	E = "E",
	S = "S",
	W = "W"
}

export enum Anchors {
	towardsMiddle = "towardsMiddle",
    center = "center",
    towardsEdge = "towardsEdge",
	topLeft = "topLeft"
}


export interface CrossingPoint{
	point:Point,
	incoming: Boolean,
	section: number,
	side: Sides,
	proxyPoint: Point,
	node: SKNode,
	nodeBounds: Bounds,
	anchor: Anchors

}

export interface Crossing{
	edge: SKEdge
	pointBounds: Bounds[]
	bezierPoints: Point[][]
	crossingPoints: CrossingPoint[]
}


