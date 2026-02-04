import { GAME } from '../utils/Constants';

declare const Cesium: any;

export interface Checkpoint {
    id: number;
    position: {
        longitude: number;
        latitude: number;
        altitude: number;
    };
    passed: boolean;
    entity: any;
}

export class CheckpointSystem {
    private viewer: any;
    private checkpoints: Checkpoint[] = [];
    private currentIndex: number = 0;
    private onCheckpointPassed: ((checkpoint: Checkpoint, combo: number) => void) | null = null;
    private combo: number = 0;

    constructor(viewer: any) {
        this.viewer = viewer;
    }

    public generateCheckpoints(
        startLon: number,
        startLat: number,
        count: number = GAME.CHECKPOINT.COUNT_PER_LEVEL
    ): void {
        this.clearCheckpoints();

        for (let i = 0; i < count; i++) {
            // Generate checkpoints in a path
            const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
            const distance = GAME.CHECKPOINT.SPAWN_DISTANCE * (0.5 + i * 0.3);

            const lon = startLon + (Math.cos(angle) * distance) / 111000;
            const lat = startLat + (Math.sin(angle) * distance) / 111000;
            const alt = 200 + Math.random() * 800; // 200-1000m altitude

            this.addCheckpoint(lon, lat, alt, i);
        }
    }

    private addCheckpoint(
        longitude: number,
        latitude: number,
        altitude: number,
        id: number
    ): void {
        const position = Cesium.Cartesian3.fromDegrees(longitude, latitude, altitude);

        // Create ring entity
        const entity = this.viewer.entities.add({
            name: `Checkpoint ${id}`,
            position: position,
            ellipse: {
                semiMajorAxis: GAME.CHECKPOINT.RING_RADIUS,
                semiMinorAxis: GAME.CHECKPOINT.RING_RADIUS,
                height: altitude,
                material: Cesium.Color.RED.withAlpha(0.3),
                outline: true,
                outlineColor: Cesium.Color.RED,
                outlineWidth: 3,
            },
            // Add a cylinder for visibility
            cylinder: {
                length: 10,
                topRadius: GAME.CHECKPOINT.RING_RADIUS,
                bottomRadius: GAME.CHECKPOINT.RING_RADIUS,
                material: Cesium.Color.RED.withAlpha(0.2),
                outline: true,
                outlineColor: Cesium.Color.RED,
                outlineWidth: 2,
            },
            label: {
                text: `${id + 1}`,
                font: '24px sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            }
        });

        this.checkpoints.push({
            id,
            position: { longitude, latitude, altitude },
            passed: false,
            entity
        });
    }

    public checkCollision(
        aircraftLon: number,
        aircraftLat: number,
        aircraftAlt: number
    ): Checkpoint | null {
        const current = this.checkpoints[this.currentIndex];
        if (!current || current.passed) return null;

        // Calculate distance to checkpoint
        const distance = this.calculateDistance(
            aircraftLon, aircraftLat, aircraftAlt,
            current.position.longitude, current.position.latitude, current.position.altitude
        );

        if (distance < GAME.CHECKPOINT.RING_RADIUS) {
            this.passCheckpoint(current);
            return current;
        }

        return null;
    }

    private calculateDistance(
        lon1: number, lat1: number, alt1: number,
        lon2: number, lat2: number, alt2: number
    ): number {
        // Simple Euclidean distance in meters (approximation)
        const dLon = (lon2 - lon1) * 111000 * Math.cos(lat1 * Math.PI / 180);
        const dLat = (lat2 - lat1) * 111000;
        const dAlt = alt2 - alt1;

        return Math.sqrt(dLon ** 2 + dLat ** 2 + dAlt ** 2);
    }

    private passCheckpoint(checkpoint: Checkpoint): void {
        checkpoint.passed = true;
        this.combo++;
        this.currentIndex++;

        // Update visual
        if (checkpoint.entity) {
            checkpoint.entity.ellipse.material = Cesium.Color.GREEN.withAlpha(0.3);
            checkpoint.entity.ellipse.outlineColor = Cesium.Color.GREEN;
            checkpoint.entity.cylinder.material = Cesium.Color.GREEN.withAlpha(0.2);
            checkpoint.entity.cylinder.outlineColor = Cesium.Color.GREEN;
        }

        // Callback
        if (this.onCheckpointPassed) {
            this.onCheckpointPassed(checkpoint, this.combo);
        }
    }

    public getNextCheckpoint(): Checkpoint | null {
        return this.checkpoints[this.currentIndex] || null;
    }

    public getDistanceToNext(
        aircraftLon: number,
        aircraftLat: number,
        aircraftAlt: number
    ): number {
        const next = this.getNextCheckpoint();
        if (!next) return -1;

        return this.calculateDistance(
            aircraftLon, aircraftLat, aircraftAlt,
            next.position.longitude, next.position.latitude, next.position.altitude
        );
    }

    public getDirectionToNext(
        aircraftLon: number,
        aircraftLat: number
    ): number {
        const next = this.getNextCheckpoint();
        if (!next) return 0;

        const dLon = next.position.longitude - aircraftLon;
        const dLat = next.position.latitude - aircraftLat;

        return Math.atan2(dLon, dLat);
    }

    public setOnCheckpointPassed(
        callback: (checkpoint: Checkpoint, combo: number) => void
    ): void {
        this.onCheckpointPassed = callback;
    }

    public getProgress(): { passed: number; total: number } {
        return {
            passed: this.checkpoints.filter(c => c.passed).length,
            total: this.checkpoints.length
        };
    }

    public isComplete(): boolean {
        return this.currentIndex >= this.checkpoints.length;
    }

    public getCombo(): number {
        return this.combo;
    }

    public resetCombo(): void {
        this.combo = 0;
    }

    public clearCheckpoints(): void {
        this.checkpoints.forEach(cp => {
            if (cp.entity) {
                this.viewer.entities.remove(cp.entity);
            }
        });
        this.checkpoints = [];
        this.currentIndex = 0;
        this.combo = 0;
    }

    public reset(): void {
        this.clearCheckpoints();
    }
}
