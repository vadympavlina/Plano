/**
 * Tiny spring + velocity helpers for gestures.
 *
 * While a finger is down the element follows it 1:1 (direct `style` writes, no React state).
 * On release a spring takes over, seeded with the speed the finger had, so a flick leaves at
 * the speed it was thrown. A new gesture can `stop()` the spring mid-flight and take over from
 * the current value, which keeps everything interruptible (no keyframes involved).
 */

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Past `soft` px the element moves only a fraction of the finger travel (the edge pushes back). */
export function rubberBand(offset: number, soft: number, resistance = 0.2): number {
  const a = Math.abs(offset);
  if (a <= soft) return offset;
  return Math.sign(offset) * (soft + (a - soft) * resistance);
}

/** Velocity (px/s) over the last ~100 ms of pointer samples. */
export class VelocityTracker {
  private samples: { t: number; v: number }[] = [];
  reset(v?: number, t = performance.now()) {
    this.samples = v === undefined ? [] : [{ t, v }];
  }
  push(v: number, t = performance.now()) {
    this.samples.push({ t, v });
    while (this.samples.length > 2 && t - this.samples[0].t > 100) this.samples.shift();
  }
  get velocity(): number {
    const s = this.samples;
    if (s.length < 2) return 0;
    const a = s[0];
    const b = s[s.length - 1];
    const dt = (b.t - a.t) / 1000;
    // A finger that rested before lifting is not a flick.
    if (dt <= 0 || performance.now() - b.t > 80) return 0;
    return (b.v - a.v) / dt;
  }
}

export interface SpringOptions {
  from: number;
  to: number;
  /** px/s, same sign convention as the values. */
  velocity?: number;
  stiffness?: number;
  damping?: number;
  onUpdate: (value: number) => void;
  onDone?: () => void;
}

export interface SpringHandle {
  stop: () => void;
  /** Latest value and velocity, so a new touch can pick the motion up where it is. */
  readonly value: number;
  readonly velocity: number;
}

/** Damped spring integrated on rAF. Mass is 1. Settles when both distance and speed are tiny. */
export function runSpring({ from, to, velocity = 0, stiffness = 420, damping = 38, onUpdate, onDone }: SpringOptions): SpringHandle {
  let x = from;
  let v = velocity;
  let raf = 0;
  let last = performance.now();
  let stopped = false;
  const step = (now: number) => {
    if (stopped) return;
    // Fixed sub-steps keep the integration stable on a slow frame.
    let dt = Math.min(0.064, (now - last) / 1000);
    last = now;
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240);
      v += (-stiffness * (x - to) - damping * v) * h;
      x += v * h;
      dt -= h;
    }
    if (Math.abs(x - to) < 0.4 && Math.abs(v) < 8) {
      x = to;
      v = 0;
      onUpdate(to);
      stopped = true;
      onDone?.();
      return;
    }
    onUpdate(x);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame((t) => {
    last = t;
    step(t);
  });
  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
    },
    get value() {
      return x;
    },
    get velocity() {
      return v;
    },
  };
}
