import { describe, it, expect } from "vitest";
import { SETTINGS, saveSettings } from "../../../public/construction-game/src/logic/settings.js";

describe("settings", () => {
  it("exposes boolean muted/reducedMotion flags", () => {
    expect(typeof SETTINGS.muted).toBe("boolean");
    expect(typeof SETTINGS.reducedMotion).toBe("boolean");
  });
  it("saveSettings does not throw when localStorage is unavailable", () => {
    expect(() => saveSettings()).not.toThrow();
  });
});
