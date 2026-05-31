import { describe, it, expect } from "vitest";
import { createCarState, stepCar, CAR } from "../../../public/desert-game/src/logic/carPhysics.js";

const flat = () => 0;
const noInput = { throttle: 0, steer: 0, handbrake: false };

describe("carPhysics", () => {
  it("accelerates forward under throttle, capped at maxSpeed", () => {
    let s = createCarState();
    for (let i = 0; i < 600; i++) s = stepCar(s, { ...noInput, throttle: 1 }, 1 / 60, flat);
    expect(s.speed).toBeGreaterThan(0);
    expect(s.speed).toBeLessThanOrEqual(CAR.maxSpeed + 1e-6);
  });
  it("rolls to a stop with no throttle (friction)", () => {
    let s = createCarState(); s.speed = 20; s.velHeading = 0;
    for (let i = 0; i < 600; i++) s = stepCar(s, noInput, 1 / 60, flat);
    expect(s.speed).toBeLessThan(1);
  });
  it("steering changes heading more at speed than at rest", () => {
    let moving = createCarState(); moving.speed = 20; moving.velHeading = 0;
    moving = stepCar(moving, { ...noInput, steer: 1 }, 0.2, flat);
    let still = createCarState(); still.speed = 0;
    still = stepCar(still, { ...noInput, steer: 1 }, 0.2, flat);
    expect(Math.abs(moving.heading)).toBeGreaterThan(Math.abs(still.heading));
  });
  it("handbrake produces a larger drift angle than normal driving", () => {
    const run = (hb: boolean) => {
      let s = createCarState(); s.speed = 25; s.velHeading = 0; s.heading = 0;
      for (let i = 0; i < 30; i++) s = stepCar(s, { throttle: 0.4, steer: 1, handbrake: hb }, 1 / 60, flat);
      return Math.abs(s.heading - s.velHeading);
    };
    expect(run(true)).toBeGreaterThan(run(false));
  });
  it("launches airborne when cresting a fast-falling slope, then lands", () => {
    // car is currently at y=12 (on a crest) but the ground at the new position has dropped to 0
    const lowGround = () => 0;
    let s = createCarState(); s.y = 12; s.speed = 30; s.velHeading = 0;
    s = stepCar(s, noInput, 1 / 60, lowGround);
    expect(s.airborne).toBe(true);
    expect(s.vy).toBeGreaterThan(0);
    let landed = s;
    for (let i = 0; i < 600 && landed.airborne; i++) landed = stepCar(landed, noInput, 1 / 60, lowGround);
    expect(landed.airborne).toBe(false);
    expect(landed.y).toBeCloseTo(0, 1);
  });
  it("stays glued to flat ground when grounded", () => {
    let s = createCarState(); s.speed = 15; s.velHeading = 0;
    s = stepCar(s, noInput, 1 / 60, flat);
    expect(s.airborne).toBe(false);
    expect(s.y).toBeCloseTo(0, 5);
  });
});
