import { CameraMode, GAME } from '../utils/Constants';

declare const Cesium: any;

export class CameraController {
    private viewer: any;
    private mode: CameraMode = 'third-person';
    private targetPosition: any;
    private targetOrientation: { heading: number; pitch: number; roll: number };
    private smoothFactor: number = GAME.CAMERA.SMOOTH_FACTOR;

    constructor(viewer: any) {
        this.viewer = viewer;
        this.targetOrientation = { heading: 0, pitch: 0, roll: 0 };

        // Disable default camera controls when in flight mode
        this.disableDefaultControls();
    }

    private disableDefaultControls(): void {
        const scene = this.viewer.scene;
        scene.screenSpaceCameraController.enableRotate = false;
        scene.screenSpaceCameraController.enableTranslate = false;
        scene.screenSpaceCameraController.enableZoom = false;
        scene.screenSpaceCameraController.enableTilt = false;
        scene.screenSpaceCameraController.enableLook = false;
    }

    public enableDefaultControls(): void {
        const scene = this.viewer.scene;
        scene.screenSpaceCameraController.enableRotate = true;
        scene.screenSpaceCameraController.enableTranslate = true;
        scene.screenSpaceCameraController.enableZoom = true;
        scene.screenSpaceCameraController.enableTilt = true;
        scene.screenSpaceCameraController.enableLook = true;
    }

    public setMode(mode: CameraMode): void {
        this.mode = mode;

        if (mode === 'free') {
            this.enableDefaultControls();
        } else {
            this.disableDefaultControls();
        }
    }

    public getMode(): CameraMode {
        return this.mode;
    }

    public toggleMode(): CameraMode {
        const modes: CameraMode[] = ['third-person', 'first-person'];
        const currentIndex = modes.indexOf(this.mode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.setMode(modes[nextIndex]);
        return this.mode;
    }

    public update(
        aircraftPosition: any,
        heading: number,
        pitch: number,
        roll: number
    ): void {
        if (!aircraftPosition) return;

        this.targetPosition = aircraftPosition;
        this.targetOrientation = { heading, pitch, roll };

        switch (this.mode) {
            case 'third-person':
                this.updateThirdPerson();
                break;
            case 'first-person':
                this.updateFirstPerson();
                break;
            case 'free':
                // Free camera - don't update automatically
                break;
        }
    }

    private updateThirdPerson(): void {
        const camera = this.viewer.camera;
        const { THIRD_PERSON_DISTANCE, THIRD_PERSON_HEIGHT } = GAME.CAMERA;

        // Calculate camera position behind and above the aircraft
        const transform = Cesium.Transforms.eastNorthUpToFixedFrame(this.targetPosition);

        // Calculate offset based on aircraft heading
        const heading = this.targetOrientation.heading;
        const pitch = this.targetOrientation.pitch;

        // Camera offset in local coordinates (behind and above)
        const offsetDistance = THIRD_PERSON_DISTANCE;
        const offsetHeight = THIRD_PERSON_HEIGHT;

        // Calculate the offset in the aircraft's local frame
        const localOffset = new Cesium.Cartesian3(
            -offsetDistance * Math.cos(heading) - Math.sin(heading) * 0,
            -offsetDistance * Math.sin(heading) + Math.cos(heading) * 0,
            offsetHeight - pitch * 10
        );

        // Transform to world coordinates
        const cameraPosition = Cesium.Matrix4.multiplyByPoint(
            transform,
            localOffset,
            new Cesium.Cartesian3()
        );

        // Smooth camera movement
        const currentPosition = camera.position.clone();
        const smoothedPosition = Cesium.Cartesian3.lerp(
            currentPosition,
            cameraPosition,
            this.smoothFactor,
            new Cesium.Cartesian3()
        );

        // Set camera position and look at aircraft
        camera.setView({
            destination: smoothedPosition,
            orientation: {
                heading: heading,
                pitch: Cesium.Math.toRadians(-15) + pitch * 0.3,
                roll: roll * 0.2
            }
        });

        // Look at the aircraft
        camera.lookAt(
            this.targetPosition,
            new Cesium.HeadingPitchRange(
                heading + Math.PI,
                Cesium.Math.toRadians(-15) - pitch * 0.3,
                offsetDistance
            )
        );
    }

    private updateFirstPerson(): void {
        const camera = this.viewer.camera;
        const { FIRST_PERSON_OFFSET } = GAME.CAMERA;

        // Position camera at cockpit location
        const transform = Cesium.Transforms.eastNorthUpToFixedFrame(this.targetPosition);

        // Small offset forward and up for cockpit view
        const localOffset = new Cesium.Cartesian3(
            Math.cos(this.targetOrientation.heading) * FIRST_PERSON_OFFSET,
            Math.sin(this.targetOrientation.heading) * FIRST_PERSON_OFFSET,
            2 // Slightly above aircraft center
        );

        const cameraPosition = Cesium.Matrix4.multiplyByPoint(
            transform,
            localOffset,
            new Cesium.Cartesian3()
        );

        // Set camera with aircraft's orientation
        camera.setView({
            destination: cameraPosition,
            orientation: {
                heading: this.targetOrientation.heading,
                pitch: this.targetOrientation.pitch,
                roll: this.targetOrientation.roll
            }
        });
    }

    public getModeDisplayName(): string {
        switch (this.mode) {
            case 'third-person':
                return '📷 Third Person';
            case 'first-person':
                return '📷 Cockpit View';
            case 'free':
                return '📷 Free Camera';
        }
    }

    public flyTo(
        longitude: number,
        latitude: number,
        altitude: number,
        duration: number = 2
    ): Promise<void> {
        return new Promise((resolve) => {
            this.viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, altitude + 100),
                orientation: {
                    heading: 0,
                    pitch: Cesium.Math.toRadians(-30),
                    roll: 0
                },
                duration: duration,
                complete: resolve
            });
        });
    }
}
