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

// Task-D: per-difficulty bad/good scaling + accident excludes near-riot workers.
describe("applyEventEffects — difficulty scaling", () => {
  const mkState = (workers: Worker[], economy: { funds: number } | null = { funds: 1000 }) => ({
    workers,
    economy,
    prodMult: 1,
    prodTimer: 0,
    boostMult: 1,
    boostTimer: 0,
  });

  // easy-flavored: bad events softened, good events amplified.
  const E2 = { ...E, badMult: 0.6, goodMult: 1.2 };
  // hard-flavored: bad events amplified, good events softened.
  const E3 = { ...E, badMult: 1.3, goodMult: 0.9 };

  it("breakdown duration scales by badMult (down for easy, up for hard)", () => {
    const easy = mkState([]);
    applyEventEffects(easy, evById("breakdown"), E2, () => 0.5);
    expect(easy.prodMult).toBe(E.breakdownProdMult); // magnitude unchanged
    expect(easy.prodTimer).toBeCloseTo(E2.breakdownSec * 0.6, 5);

    const hard = mkState([]);
    applyEventEffects(hard, evById("breakdown"), E3, () => 0.5);
    expect(hard.prodTimer).toBeCloseTo(E3.breakdownSec * 1.3, 5);
    expect(hard.prodTimer).toBeGreaterThan(E.breakdownSec); // amplified vs base
  });

  it("supply funds scale by goodMult; boost duration stays fixed", () => {
    const state = mkState([], { funds: 1000 });
    applyEventEffects(state, evById("supply"), E2, () => 0.5);
    expect(state.economy!.funds).toBeCloseTo(1000 + E.supplyBonus * 1.2, 5);
    expect(state.boostMult).toBeCloseTo(1 + (E.supplyBoost - 1) * 1.2, 5);
    expect(state.boostTimer).toBe(E.supplySec); // duration unaffected by mults
  });

  it("inspection funds scale by goodMult", () => {
    const state = mkState([], { funds: 1000 });
    applyEventEffects(state, evById("inspection"), E2, () => 0.5);
    expect(state.economy!.funds).toBeCloseTo(1000 + E.inspectionBonus * 1.2, 5);
  });

  it("snack boost magnitude scales by goodMult; rage drop + duration stay fixed", () => {
    const w = mkWorker(50);
    const state = mkState([w]);
    applyEventEffects(state, evById("snack"), E2, () => 0.5);
    expect(state.boostMult).toBeCloseTo(1 + (E.snackBoost - 1) * 1.2, 5);
    expect(state.boostTimer).toBe(E.snackSec);
    expect(w.logic.rage).toBe(50 - E.snackRageDrop); // rage drop not scaled
  });

  it("accident spike scales by badMult (hard amplifies the rage hit)", () => {
    const v = mkWorker(0, 1);
    const state = mkState([v]);
    applyEventEffects(state, evById("accident"), E3, () => 0, CONFIG.rage.flee);
    expect(v.logic.rage).toBeCloseTo(E.accidentRageSpike * 1.3, 5);
  });
});

describe("applyEventEffects — accident excludes near-riot workers", () => {
  const flee = CONFIG.rage.flee; // 80
  const mkState = (workers: Worker[]) => ({
    workers,
    economy: { funds: 1000 },
    prodMult: 1,
    prodTimer: 0,
    boostMult: 1,
    boostTimer: 0,
  });

  it("never targets a worker at/over the flee threshold; victim is among the eligible (< flee)", () => {
    // index 0 is near-riot (>= flee) and must be excluded; indices 1 & 2 are the only eligible victims.
    const nearRiot = mkWorker(85, 1); // >= flee (80) -> excluded
    const calm1 = mkWorker(10, 1);
    const calm2 = mkWorker(20, 1);
    const state = mkState([nearRiot, calm1, calm2]);

    // rng=0 selects the first eligible (filtered index 0 = calm1); near-riot untouched.
    applyEventEffects(state, evById("accident"), E, () => 0, flee);
    expect(nearRiot.logic.rage).toBe(85);
    expect(calm1.logic.rage).toBe(10 + E.accidentRageSpike);
    expect(calm2.logic.rage).toBe(20);

    // rng just under 1 selects the last eligible (filtered index 1 = calm2); near-riot still untouched.
    const state2 = mkState([mkWorker(85, 1), mkWorker(10, 1), mkWorker(20, 1)]);
    applyEventEffects(state2, evById("accident"), E, () => 0.999, flee);
    expect(state2.workers[0].logic.rage).toBe(85); // near-riot excluded
    expect(state2.workers[1].logic.rage).toBe(10); // first eligible spared
    expect(state2.workers[2].logic.rage).toBe(20 + E.accidentRageSpike);
  });

  it("the near-riot worker is never the victim across many rng samples", () => {
    const rng = mulberry32(2024);
    for (let i = 0; i < 500; i++) {
      const nearRiot = mkWorker(flee, 1); // exactly at threshold -> excluded (rage < flee is false)
      const calm1 = mkWorker(0, 1);
      const calm2 = mkWorker(0, 1);
      const state = mkState([nearRiot, calm1, calm2]);
      applyEventEffects(state, evById("accident"), E, rng, flee);
      expect(nearRiot.logic.rage).toBe(flee); // exactly at flee, never spiked
    }
  });

  it("all workers at/over flee -> no victim, no throw, rng not consumed", () => {
    const a = mkWorker(90, 1);
    const b = mkWorker(80, 1);
    const state = mkState([a, b]);
    let rngCalls = 0;
    const rng = () => {
      rngCalls += 1;
      return 0.5;
    };
    expect(() =>
      applyEventEffects(state, evById("accident"), E, rng, flee)
    ).not.toThrow();
    expect(a.logic.rage).toBe(90);
    expect(b.logic.rage).toBe(80);
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
