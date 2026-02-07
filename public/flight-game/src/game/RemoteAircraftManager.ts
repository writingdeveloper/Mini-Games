// RemoteAircraftManager - Manages rendering and interpolation of remote player aircraft

import { Aircraft, AircraftConfig } from './Aircraft';

declare const Cesium: any;

const REMOTE_COLORS = ['#FF6B6B', '#4ECDC4', '#FFA07A', '#45B7D1'];

interface RemotePlayerState {
  lon: number;
  lat: number;
  altitude: number;
  heading: number;
  pitch: number;
  roll: number;
  speed: number;
  alive: boolean;
}

interface RemoteAircraftEntry {
  aircraft: Aircraft;
  currentState: RemotePlayerState | null;
  targetState: RemotePlayerState | null;
  interpolationT: number;
  nameLabel: any; // Cesium entity for name label
}

export class RemoteAircraftManager {
  private viewer: any;
  private remoteAircraft: Map<string, RemoteAircraftEntry> = new Map();
  private localPlayerId: string;

  constructor(viewer: any, localPlayerId: string) {
    this.viewer = viewer;
    this.localPlayerId = localPlayerId;
  }

  /**
   * Update all remote players from server state
   */
  updateFromServerState(players: Record<string, RemotePlayerState>): void {
    const remoteIds = new Set<string>();

    let colorIdx = 0;
    for (const [id, state] of Object.entries(players)) {
      if (id === this.localPlayerId) continue;
      remoteIds.add(id);

      let entry = this.remoteAircraft.get(id);
      if (!entry) {
        // Create new remote aircraft
        const color = REMOTE_COLORS[colorIdx % REMOTE_COLORS.length];
        const config: Partial<AircraftConfig> = {
          bodyColor: color,
          wingColor: color,
          scale: 1,
        };
        const aircraft = new Aircraft(this.viewer, config);

        // Create name label
        const nameLabel = this.viewer.entities.add({
          name: 'label_' + id,
          position: Cesium.Cartesian3.fromDegrees(state.lon, state.lat, state.altitude + 20),
          label: {
            text: id.substring(0, 6),
            font: '12px sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -20),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });

        entry = {
          aircraft,
          currentState: null,
          targetState: state,
          interpolationT: 0,
          nameLabel,
        };
        this.remoteAircraft.set(id, entry);
      }

      // Set new target state for interpolation
      entry.currentState = entry.targetState || state;
      entry.targetState = state;
      entry.interpolationT = 0;

      // Hide dead players
      if (!state.alive) {
        entry.aircraft.setVisible(false);
        if (entry.nameLabel) entry.nameLabel.show = false;
      }

      colorIdx++;
    }

    // Remove disconnected players
    for (const [id, entry] of this.remoteAircraft) {
      if (!remoteIds.has(id)) {
        entry.aircraft.destroy();
        if (entry.nameLabel) this.viewer.entities.remove(entry.nameLabel);
        this.remoteAircraft.delete(id);
      }
    }
  }

  /**
   * Call each frame to smoothly interpolate remote aircraft positions
   */
  interpolate(dt: number): void {
    for (const entry of this.remoteAircraft.values()) {
      if (!entry.currentState || !entry.targetState) continue;

      // Smooth interpolation toward target
      entry.interpolationT = Math.min(1, entry.interpolationT + dt * 10); // ~100ms catchup
      const t = entry.interpolationT;

      const current = entry.currentState;
      const target = entry.targetState;

      const lon = current.lon + (target.lon - current.lon) * t;
      const lat = current.lat + (target.lat - current.lat) * t;
      const alt = current.altitude + (target.altitude - current.altitude) * t;

      // Angle interpolation (shortest path)
      const heading = this.lerpAngle(current.heading, target.heading, t);
      const pitch = current.pitch + (target.pitch - current.pitch) * t;
      const roll = current.roll + (target.roll - current.roll) * t;

      entry.aircraft.updatePosition(lon, lat, alt, heading, pitch, roll);

      // Update name label position
      if (entry.nameLabel) {
        entry.nameLabel.position = Cesium.Cartesian3.fromDegrees(lon, lat, alt + 20);
      }
    }
  }

  private lerpAngle(a: number, b: number, t: number): number {
    let diff = b - a;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return a + diff * t;
  }

  getRemoteCount(): number {
    return this.remoteAircraft.size;
  }

  destroy(): void {
    for (const entry of this.remoteAircraft.values()) {
      entry.aircraft.destroy();
      if (entry.nameLabel) this.viewer.entities.remove(entry.nameLabel);
    }
    this.remoteAircraft.clear();
  }
}
