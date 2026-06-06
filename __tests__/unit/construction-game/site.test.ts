import { describe, it, expect } from "vitest";
import {
  FOOTPRINT,
  BUILDING_ROW_Z,
  STATION,
  activeBuildingIndex,
  buildingCenter,
  workSlots,
  separation,
} from "../../../public/construction-game/src/logic/site.js";

describe("site geometry + helpers", () => {
  it("activeBuildingIndex advances every floorsPerBuilding floors", () => {
    expect(activeBuildingIndex(0, 3)).toBe(0);
    expect(activeBuildingIndex(2, 3)).toBe(0);
    expect(activeBuildingIndex(3, 3)).toBe(1);
    expect(activeBuildingIndex(8, 3)).toBe(2);
  });

  it("buildingCenter mirrors the Buildings.js layout (centered row at z=-6)", () => {
    // 3 buildings, spacing 12 -> centers at -12, 0, +12
    expect(buildingCenter(0, 3)).toEqual({ x: -12, z: BUILDING_ROW_Z });
    expect(buildingCenter(1, 3)).toEqual({ x: 0, z: -6 });
    expect(buildingCenter(2, 3)).toEqual({ x: 12, z: -6 });
  });

  it("workSlots returns `count` points hugging the +Z face within the footprint span", () => {
    const slots = workSlots({ x: 0, z: -6 }, 8);
    expect(slots).toHaveLength(8);
    for (const s of slots) {
      expect(s.z).toBeGreaterThan(-6 + FOOTPRINT / 2); // in front of the camera-facing face
      expect(Math.abs(s.x)).toBeLessThanOrEqual((FOOTPRINT * 0.8) / 2 + 1e-9);
    }
  });

  it("workSlots is deterministic (same input -> identical output) and follows the center", () => {
    expect(workSlots({ x: 5, z: -6 }, 6)).toEqual(workSlots({ x: 5, z: -6 }, 6));
    expect(workSlots({ x: 12, z: -6 }, 4)[0].x).toBeCloseTo(12 - (FOOTPRINT * 0.8) / 2, 5);
  });

  it("STATION en-route factor is a travel dip (between 0 and 1)", () => {
    expect(STATION.enRouteFactor).toBeGreaterThan(0);
    expect(STATION.enRouteFactor).toBeLessThan(1);
  });

  it("separation pushes near peers apart and ignores far ones", () => {
    const push = separation({ x: 0, z: 0 }, [{ x: 0.5, z: 0 }], 1.4);
    expect(push.x).toBeLessThan(0); // shoved away from the +x neighbor
    expect(separation({ x: 0, z: 0 }, [{ x: 9, z: 0 }], 1.4)).toEqual({ x: 0, z: 0 });
  });
});
