// Aircraft model and management for Cesium
// Since we're using Cesium, we'll create a simple aircraft using primitives

declare const Cesium: any;

export interface AircraftConfig {
    bodyColor: string;
    wingColor: string;
    scale: number;
}

export class Aircraft {
    private viewer: any;
    private entity: any;
    private propellerAngle: number = 0;
    private config: AircraftConfig;

    constructor(viewer: any, config?: Partial<AircraftConfig>) {
        this.viewer = viewer;
        this.config = {
            bodyColor: '#FFFFFF',
            wingColor: '#FF4444',
            scale: 1,
            ...config
        };

        this.createAircraft();
    }

    private createAircraft(): void {
        // Create a simple aircraft model using a glTF or primitive shapes
        // For simplicity, we'll use a model entity with a simple box representation
        // In production, you'd load a proper glTF model

        this.entity = this.viewer.entities.add({
            name: 'Player Aircraft',
            position: Cesium.Cartesian3.fromDegrees(126.9780, 37.5665, 500),
            orientation: Cesium.Transforms.headingPitchRollQuaternion(
                Cesium.Cartesian3.fromDegrees(126.9780, 37.5665, 500),
                new Cesium.HeadingPitchRoll(0, 0, 0)
            ),
            // Use a simple box as placeholder - could be replaced with glTF model
            box: {
                dimensions: new Cesium.Cartesian3(10, 15, 3),
                material: Cesium.Color.fromCssColorString(this.config.bodyColor),
                outline: true,
                outlineColor: Cesium.Color.BLACK,
            },
        });

        // Add wings as a separate entity
        this.createWings();
    }

    private createWings(): void {
        // Wings will follow the main entity
        // This is simplified - a real implementation would use a proper 3D model
    }

    public updatePosition(
        longitude: number,
        latitude: number,
        altitude: number,
        heading: number,
        pitch: number,
        roll: number
    ): void {
        if (!this.entity) return;

        const position = Cesium.Cartesian3.fromDegrees(longitude, latitude, altitude);
        const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
        const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);

        this.entity.position = position;
        this.entity.orientation = orientation;

        // Animate propeller
        this.propellerAngle += 0.5;
    }

    public getEntity(): any {
        return this.entity;
    }

    public getPosition(): any {
        return this.entity?.position?.getValue(Cesium.JulianDate.now());
    }

    public setVisible(visible: boolean): void {
        if (this.entity) {
            this.entity.show = visible;
        }
    }

    public destroy(): void {
        if (this.entity && this.viewer) {
            this.viewer.entities.remove(this.entity);
        }
    }
}

// Create a more detailed aircraft model using primitives
export class DetailedAircraft {
    private viewer: any;
    private primitives: any[] = [];
    private position: any;
    private orientation: any;

    constructor(viewer: any) {
        this.viewer = viewer;
        this.position = Cesium.Cartesian3.fromDegrees(126.9780, 37.5665, 500);
        this.orientation = Cesium.Matrix3.IDENTITY;
    }

    public createModel(): any {
        // For a more detailed aircraft, we would create multiple primitives
        // Body (fuselage)
        // Wings
        // Tail
        // Propeller

        // This is a placeholder - in production you'd use:
        // 1. A glTF model loaded via Cesium.Model
        // 2. Or construct geometry using Cesium primitives

        return null;
    }

    public update(
        longitude: number,
        latitude: number,
        altitude: number,
        heading: number,
        pitch: number,
        roll: number
    ): void {
        this.position = Cesium.Cartesian3.fromDegrees(longitude, latitude, altitude);
        // Update model matrix based on orientation
    }

    public destroy(): void {
        this.primitives.forEach(p => {
            this.viewer.scene.primitives.remove(p);
        });
        this.primitives = [];
    }
}
