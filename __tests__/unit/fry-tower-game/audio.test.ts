import { describe, it, expect } from "vitest";
import { AudioManager } from "../../../public/fry-tower-game/src/audio/AudioManager.js";

describe("AudioManager new-mechanic cues", () => {
  it("grab() and wobble() are safe no-ops before init", () => {
    const am = new AudioManager();
    // No AudioContext created (init not called) -> must not throw.
    expect(() => {
      am.grab();
      am.wobble();
    }).not.toThrow();
  });
});
