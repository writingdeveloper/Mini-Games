import { describe, it, expect } from "vitest";
import {
  SITE_EVENTS,
  pickEvent,
  pickEventGuarded,
  initEventState,
  applyEventEffects,
  tickEventMultipliers,
} from "../../../public/construction-game/src/logic/events.js";
import { mulberry32 } from "../../../public/construction-game/src/logic/spawn.js";
import { CONFIG } from "../../../public/construction-game/src/logic/config.js";

const E = CONFIG.events;
const evById = (id: string) => SITE_EVENTS.find((e) => e.id === id)!;

// Build a worker view object matching what applyEventEffects expects.
const mkWorker = (rage: number, sensitivity = 1, escaped = false) => ({
  archetype: { rageSensitivity: sensitivity },
  logic: { rage, escaped, activity: "working" },
});

describe("events", () => {
  it("SITE_EVENTS is a non-empty, well-formed catalog with unique ids", () => {
    expect(Array.isArray(SITE_EVENTS)).toBe(true);
    expect(SITE_EVENTS.length).toBeGreaterThan(0);
    const kinds = new Set(["good", "neutral", "bad"]);
    for (const e of SITE_EVENTS) {
      expect(typeof e.id).toBe("string");
      expect(typeof e.label).toBe("string");
      expect(typeof e.icon).toBe("string");
      expect(typeof e.weight).toBe("number");
      expect(e.weight).toBeGreaterThan(0);
      expect(kinds.has(e.kind)).toBe(true);
    }
    const ids = SITE_EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("catalog leans good: total good weight strictly exceeds total bad weight", () => {
    const sum = (kind: string) =>
      SITE_EVENTS.filter((e) => e.kind === kind).reduce((s, e) => s + e.weight, 0);
    expect(sum("good")).toBeGreaterThan(sum("bad"));
  });

  it("pickEvent returns an element of SITE_EVENTS with boundary rng stubs", () => {
    const first = pickEvent(() => 0);
    expect(first).toBe(SITE_EVENTS[0]);
    const last = pickEvent(() => 0.999);
    expect(last).toBe(SITE_EVENTS[SITE_EVENTS.length - 1]);
    expect(SITE_EVENTS).toContain(pickEvent(() => 0.5));
  });

  it("pickEvent with seeded mulberry32 is reproducible", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 50 }, () => pickEvent(a).id);
    const seqB = Array.from({ length: 50 }, () => pickEvent(b).id);
    expect(seqA).toEqual(seqB);
  });

  it("every event id appears at least once over many seeded samples", () => {
    const rng = mulberry32(999);
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) seen.add(pickEvent(rng).id);
    for (const e of SITE_EVENTS) expect(seen.has(e.id)).toBe(true);
  });
});

describe("pickEventGuarded", () => {
  it("first event is never bad (new-player grace)", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = mulberry32(seed);
      const ev = pickEventGuarded(rng, { firstEvent: true, lastKind: null });
      expect(ev.kind).not.toBe("bad");
    }
  });

  it("no bad after bad (never two consecutive bad events)", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = mulberry32(seed);
      const ev = pickEventGuarded(rng, { firstEvent: false, lastKind: "bad" });
      expect(ev.kind).not.toBe("bad");
    }
  });

  it("unconstrained behaves like a normal weighted pick (does NOT avoid bad)", () => {
    const rng = mulberry32(999);
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      seen.add(pickEventGuarded(rng, { firstEvent: false, lastKind: "good" }).id);
    }
    for (const e of SITE_EVENTS) expect(seen.has(e.id)).toBe(true);
  });

  it("deterministic: same seed + same ctx -> same returned id", () => {
    const ctx = { firstEvent: true, lastKind: null };
    const a = mulberry32(54321);
    const b = mulberry32(54321);
    const seqA = Array.from({ length: 50 }, () => pickEventGuarded(a, { ...ctx }).id);
    const seqB = Array.from({ length: 50 }, () => pickEventGuarded(b, { ...ctx }).id);
    expect(seqA).toEqual(seqB);
  });
});

describe("initEventState", () => {
  it("returns neutral multipliers and zeroed timers", () => {
    expect(initEventState()).toEqual({
      prodMult: 1,
      prodTimer: 0,
      boostMult: 1,
      boostTimer: 0,
    });
  });

  it("returns a fresh object each call (no shared reference)", () => {
    const a = initEventState();
    const b = initEventState();
    expect(a).not.toBe(b);
  });
});

type Worker = ReturnType<typeof mkWorker>;

describe("applyEventEffects", () => {
  const mkState = (workers: Worker[], economy: { funds: number } | null = { funds: 1000 }) => ({
    workers,
    economy,
    prodMult: 1,
    prodTimer: 0,
    boostMult: 1,
    boostTimer: 0,
  });

  it("snack: drops rage on non-escaped workers (clamped at 0), skips escaped, sets boost", () => {
    const w1 = mkWorker(10); // < snackRageDrop (22) -> clamps to 0, not negative
    const w2 = mkWorker(50);
    const escaped = mkWorker(40, 1, true);
    const state = mkState([w1, w2, escaped]);
    const res = applyEventEffects(state, evById("snack"), E, () => 0.5);

    expect(w1.logic.rage).toBe(0);
    expect(w2.logic.rage).toBe(50 - E.snackRageDrop);
    expect(escaped.logic.rage).toBe(40); // untouched
    expect(state.boostMult).toBe(E.snackBoost);
    expect(state.boostTimer).toBe(E.snackSec);
    expect(res).toEqual({ id: "snack", kind: "good" });
  });

  it("supply: grants funds and sets boost; null economy does not throw", () => {
    const state = mkState([], { funds: 1000 });
    applyEventEffects(state, evById("supply"), E, () => 0.5);
    expect(state.economy!.funds).toBe(1000 + E.supplyBonus);
    expect(state.boostMult).toBe(E.supplyBoost);
    expect(state.boostTimer).toBe(E.supplySec);

    const nullState = mkState([], null);
    expect(() =>
      applyEventEffects(nullState, evById("supply"), E, () => 0.5)
    ).not.toThrow();
    expect(nullState.boostMult).toBe(E.supplyBoost);
  });

  it("inspection: grants funds and leaves multipliers at 1", () => {
    const state = mkState([], { funds: 1000 });
    const res = applyEventEffects(state, evById("inspection"), E, () => 0.5);
    expect(state.economy!.funds).toBe(1000 + E.inspectionBonus);
    expect(state.prodMult).toBe(1);
    expect(state.boostMult).toBe(1);
    expect(res).toEqual({ id: "inspection", kind: "neutral" });
  });

  it("breakdown: sets prod multiplier and timer", () => {
    const state = mkState([]);
    const res = applyEventEffects(state, evById("breakdown"), E, () => 0.5);
    expect(state.prodMult).toBe(E.breakdownProdMult);
    expect(state.prodTimer).toBe(E.breakdownSec);
    expect(res).toEqual({ id: "breakdown", kind: "bad" });
  });

  it("accident: rng=0.5 picks the middle of 3 victims; rage scales by sensitivity and clamps at 100", () => {
    const w0 = mkWorker(0, 1);
    const w1 = mkWorker(50, 2); // middle, sensitivity 2 -> +70 -> 120 clamps to 100
    const w2 = mkWorker(0, 1);
    const state = mkState([w0, w1, w2]);
    applyEventEffects(state, evById("accident"), E, () => 0.5);

    expect(w0.logic.rage).toBe(0);
    expect(w2.logic.rage).toBe(0);
    // sensitivity 2: +E.accidentRageSpike*2 -> clamped at 100
    expect(w1.logic.rage).toBe(100);
  });

  it("accident: sensitivity multiplies the spike (no clamp case)", () => {
    const v = mkWorker(0, 2);
    const state = mkState([v]);
    applyEventEffects(state, evById("accident"), E, () => 0);
    expect(v.logic.rage).toBe(E.accidentRageSpike * 2);
  });

  it("accident: all workers escaped -> no mutation, no throw, rng not consumed", () => {
    const e1 = mkWorker(30, 1, true);
    const e2 = mkWorker(40, 1, true);
    const state = mkState([e1, e2]);
    let rngCalls = 0;
    const rng = () => {
      rngCalls += 1;
      return 0.5;
    };
    expect(() =>
      applyEventEffects(state, evById("accident"), E, rng)
    ).not.toThrow();
    expect(e1.logic.rage).toBe(30);
    expect(e2.logic.rage).toBe(40);
    expect(rngCalls).toBe(0);
  });
});

describe("tickEventMultipliers", () => {
  const mkState = (over: Partial<{ prodMult: number; prodTimer: number; boostMult: number; boostTimer: number }> = {}) => ({
    prodMult: 1,
    prodTimer: 0,
    boostMult: 1,
    boostTimer: 0,
    ...over,
  });

  it("partial decay leaves the multiplier intact and decrements the timer", () => {
    const s = mkState({ boostMult: 1.4, boostTimer: 6 });
    tickEventMultipliers(s, 2);
    expect(s.boostMult).toBe(1.4);
    expect(s.boostTimer).toBe(4);
  });

  it("resets to mult 1 / timer 0 exactly on expiry", () => {
    const s = mkState({ boostMult: 1.4, boostTimer: 1 });
    tickEventMultipliers(s, 1);
    expect(s.boostMult).toBe(1);
    expect(s.boostTimer).toBe(0);
  });

  it("overshoot clamps timer to 0 (never negative) and restores mult to 1", () => {
    const s = mkState({ prodMult: 0.5, prodTimer: 1 });
    tickEventMultipliers(s, 2);
    expect(s.prodMult).toBe(1);
    expect(s.prodTimer).toBe(0);
  });

  it("prod and boost channels decay independently", () => {
    const s = mkState({ prodMult: 0.5, prodTimer: 1, boostMult: 1.4, boostTimer: 6 });
    tickEventMultipliers(s, 2);
    // prod expired, boost still active
    expect(s.prodMult).toBe(1);
    expect(s.prodTimer).toBe(0);
    expect(s.boostMult).toBe(1.4);
    expect(s.boostTimer).toBe(4);
  });

  it("already-expired state stays neutral across further ticks; timers never go negative", () => {
    const s = mkState();
    tickEventMultipliers(s, 5);
    expect(s).toEqual({ prodMult: 1, prodTimer: 0, boostMult: 1, boostTimer: 0 });
    tickEventMultipliers(s, 100);
    expect(s).toEqual({ prodMult: 1, prodTimer: 0, boostMult: 1, boostTimer: 0 });
  });
});
