import { FlightPhysics, ControlInput } from '../utils/FlightPhysics';
import { GameMode, KEYS, GAME } from '../utils/Constants';
import { Aircraft } from './Aircraft';
import { CameraController } from './CameraController';
import { CheckpointSystem } from './CheckpointSystem';
import { HUD } from '../ui/HUD';
import { Minimap } from '../ui/Minimap';
import { Menu } from '../ui/Menu';

declare const Cesium: any;

export class FlightGame {
    private viewer: any;
    private aircraft: Aircraft | null = null;
    private physics: FlightPhysics;
    private camera: CameraController | null = null;
    private checkpoints: CheckpointSystem | null = null;
    private hud: HUD;
    private minimap: Minimap;
    private menu: Menu;

    private isRunning: boolean = false;
    private isPaused: boolean = false;
    private gameMode: GameMode = 'free';

    private currentLon: number = 126.9780;
    private currentLat: number = 37.5665;
    private startingAltitude: number = 500;

    private inputState: ControlInput = {
        pitchUp: false,
        pitchDown: false,
        rollLeft: false,
        rollRight: false,
        yawLeft: false,
        yawRight: false,
        throttleUp: false,
        throttleDown: false,
    };

    private lastTime: number = 0;
    private animationFrameId: number = 0;

    constructor() {
        this.physics = new FlightPhysics(this.startingAltitude);
        this.hud = new HUD();
        this.minimap = new Minimap();
        this.menu = new Menu();

        this.setupMenuCallbacks();
    }

    public async initialize(): Promise<void> {
        this.menu.showLoading();
        this.menu.updateLoadingProgress(10);

        try {
            // Initialize Cesium viewer
            await this.initializeCesium();
            this.menu.updateLoadingProgress(50);

            // Setup input handlers
            this.setupInputHandlers();
            this.menu.updateLoadingProgress(70);

            // Initialize game systems
            this.aircraft = new Aircraft(this.viewer);
            this.camera = new CameraController(this.viewer);
            this.checkpoints = new CheckpointSystem(this.viewer);
            this.menu.updateLoadingProgress(90);

            // Setup checkpoint callback
            this.checkpoints.setOnCheckpointPassed((cp, combo) => {
                const multiplier = GAME.SCORE.COMBO_MULTIPLIERS[
                    Math.min(combo - 1, GAME.SCORE.COMBO_MULTIPLIERS.length - 1)
                ];
                const points = Math.round(GAME.SCORE.CHECKPOINT * multiplier);
                this.hud.addScore(points);

                // Update objective
                const progress = this.checkpoints!.getProgress();
                this.hud.updateObjective(
                    `Checkpoint ${progress.passed}/${progress.total} - Combo x${multiplier}`
                );
            });

            this.menu.updateLoadingProgress(100);

            // Hide loading and show start menu
            setTimeout(() => {
                this.menu.hideLoading();
                this.menu.showStartMenu();
            }, 500);

        } catch (error) {
            console.error('Failed to initialize game:', error);
            alert('Failed to initialize game. Please refresh the page.');
        }
    }

    private async initializeCesium(): Promise<void> {
        // Cesium Ion access token - injected at build time via scripts/inject-env.js
        // Set CESIUM_TOKEN in .env.local or Vercel environment variables
        Cesium.Ion.defaultAccessToken = '__CESIUM_TOKEN_PLACEHOLDER__';

        this.viewer = new Cesium.Viewer('cesiumContainer', {
            terrainProvider: await Cesium.createWorldTerrainAsync(),
            baseLayerPicker: false,
            geocoder: false,
            homeButton: false,
            sceneModePicker: false,
            selectionIndicator: false,
            timeline: false,
            animation: false,
            navigationHelpButton: false,
            fullscreenButton: false,
            vrButton: false,
            infoBox: false,
            skyBox: new Cesium.SkyBox({
                sources: {
                    positiveX: 'https://cesium.com/public/SandcastleSampleData/skybox_px.jpg',
                    negativeX: 'https://cesium.com/public/SandcastleSampleData/skybox_mx.jpg',
                    positiveY: 'https://cesium.com/public/SandcastleSampleData/skybox_py.jpg',
                    negativeY: 'https://cesium.com/public/SandcastleSampleData/skybox_my.jpg',
                    positiveZ: 'https://cesium.com/public/SandcastleSampleData/skybox_pz.jpg',
                    negativeZ: 'https://cesium.com/public/SandcastleSampleData/skybox_mz.jpg'
                }
            }),
            skyAtmosphere: new Cesium.SkyAtmosphere(),
        });

        // Enable lighting
        this.viewer.scene.globe.enableLighting = true;

        // Set high quality rendering
        this.viewer.scene.globe.maximumScreenSpaceError = 1;

        // Remove credit display
        this.viewer.cesiumWidget.creditContainer.style.display = 'none';
    }

    private setupMenuCallbacks(): void {
        this.menu.setCallbacks({
            onStart: (location, mode) => {
                this.startGame(location.lon, location.lat, mode);
            },
            onResume: () => {
                this.resume();
            },
            onRestart: () => {
                this.restart();
            },
            onQuit: () => {
                this.quitToMenu();
            }
        });
    }

    private setupInputHandlers(): void {
        // Keyboard down
        window.addEventListener('keydown', (e) => {
            if (!this.isRunning) return;

            // Pause
            if (KEYS.PAUSE.includes(e.code)) {
                if (this.isPaused) {
                    this.resume();
                } else {
                    this.pause();
                }
                return;
            }

            if (this.isPaused) return;

            // Camera toggle
            if (KEYS.TOGGLE_CAMERA.includes(e.code)) {
                const mode = this.camera?.toggleMode();
                if (mode) {
                    this.hud.updateCameraMode(this.camera!.getModeDisplayName());
                }
                return;
            }

            // Minimap toggle
            if (KEYS.TOGGLE_MINIMAP.includes(e.code)) {
                this.minimap.toggle();
                return;
            }

            // Flight controls
            this.updateInputState(e.code, true);
        });

        // Keyboard up
        window.addEventListener('keyup', (e) => {
            this.updateInputState(e.code, false);
        });

        // Prevent default for game keys
        window.addEventListener('keydown', (e) => {
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }
        });
    }

    private updateInputState(code: string, pressed: boolean): void {
        if (KEYS.PITCH_UP.includes(code)) this.inputState.pitchUp = pressed;
        if (KEYS.PITCH_DOWN.includes(code)) this.inputState.pitchDown = pressed;
        if (KEYS.ROLL_LEFT.includes(code)) this.inputState.rollLeft = pressed;
        if (KEYS.ROLL_RIGHT.includes(code)) this.inputState.rollRight = pressed;
        if (KEYS.YAW_LEFT.includes(code)) this.inputState.yawLeft = pressed;
        if (KEYS.YAW_RIGHT.includes(code)) this.inputState.yawRight = pressed;
        if (KEYS.THROTTLE_UP.includes(code)) this.inputState.throttleUp = pressed;
        if (KEYS.THROTTLE_DOWN.includes(code)) this.inputState.throttleDown = pressed;
    }

    private async startGame(lon: number, lat: number, mode: GameMode): Promise<void> {
        this.currentLon = lon;
        this.currentLat = lat;
        this.gameMode = mode;

        // Reset systems
        this.physics.reset(this.startingAltitude);
        this.hud.reset();
        this.checkpoints?.reset();

        // Setup based on mode
        if (mode === 'checkpoint') {
            this.checkpoints?.generateCheckpoints(lon, lat);
            this.hud.updateObjective('Checkpoint 0/10 - Pass through the rings!');
        } else if (mode === 'survival') {
            this.hud.updateObjective('Survival Mode - Fly as far as possible!');
        } else {
            this.hud.updateObjective('Free Flight Mode');
        }

        // Hide menu and show HUD
        this.menu.hideStartMenu();
        this.hud.show();

        // Fly camera to starting position
        await this.camera?.flyTo(lon, lat, this.startingAltitude, 2);

        // Start game loop
        this.isRunning = true;
        this.isPaused = false;
        this.lastTime = performance.now();
        this.gameLoop();
    }

    private gameLoop(): void {
        if (!this.isRunning) return;

        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;

        if (!this.isPaused) {
            this.update(deltaTime);
        }

        this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
    }

    private update(deltaTime: number): void {
        // Update physics
        const state = this.physics.update(this.inputState, deltaTime);

        // Update position based on velocity
        const metersPerDegreeLon = 111000 * Math.cos(this.currentLat * Math.PI / 180);
        const metersPerDegreeLat = 111000;

        this.currentLon += (state.velocity.x * deltaTime) / metersPerDegreeLon;
        this.currentLat += (state.velocity.y * deltaTime) / metersPerDegreeLat;

        // Update aircraft position
        this.aircraft?.updatePosition(
            this.currentLon,
            this.currentLat,
            state.altitude,
            state.heading,
            state.pitch,
            state.roll
        );

        // Update camera
        const position = Cesium.Cartesian3.fromDegrees(
            this.currentLon,
            this.currentLat,
            state.altitude
        );
        this.camera?.update(position, state.heading, state.pitch, state.roll);

        // Update HUD
        this.hud.update(state, deltaTime);

        // Update minimap
        this.minimap.render(
            this.currentLon,
            this.currentLat,
            state.heading,
            this.getCheckpointPositions()
        );

        // Check checkpoints (only in checkpoint mode)
        if (this.gameMode === 'checkpoint') {
            this.checkpoints?.checkCollision(this.currentLon, this.currentLat, state.altitude);

            // Update checkpoint indicator
            const distance = this.checkpoints?.getDistanceToNext(
                this.currentLon, this.currentLat, state.altitude
            ) ?? -1;
            const direction = this.checkpoints?.getDirectionToNext(
                this.currentLon, this.currentLat
            ) ?? 0;

            this.hud.updateCheckpointIndicator(distance, direction, state.heading);

            // Check if all checkpoints passed
            if (this.checkpoints?.isComplete()) {
                this.gameOver();
            }
        }

        // Check game over conditions
        if (state.altitude <= 10) {
            // Crashed into ground
            this.gameOver();
        }

        if (this.gameMode === 'survival' && state.fuel <= 0 && state.speed < 30) {
            // Out of fuel and too slow
            this.gameOver();
        }
    }

    private getCheckpointPositions(): Array<{ longitude: number; latitude: number; passed: boolean }> {
        // This would be implemented to get checkpoint data from CheckpointSystem
        // For now, return empty array
        return [];
    }

    private pause(): void {
        this.isPaused = true;
        this.menu.showPauseMenu();
    }

    private resume(): void {
        this.isPaused = false;
        this.menu.hidePauseMenu();
        this.lastTime = performance.now();
    }

    private restart(): void {
        this.menu.hidePauseMenu();
        this.menu.hideGameOver();
        this.startGame(this.currentLon, this.currentLat, this.gameMode);
    }

    private quitToMenu(): void {
        this.isRunning = false;
        this.isPaused = false;
        cancelAnimationFrame(this.animationFrameId);

        this.hud.hide();
        this.menu.hidePauseMenu();
        this.menu.hideGameOver();
        this.menu.showStartMenu();

        // Reset camera to default view
        this.camera?.enableDefaultControls();
    }

    private gameOver(): void {
        this.isRunning = false;
        cancelAnimationFrame(this.animationFrameId);

        this.hud.hide();
        this.menu.showGameOver(
            this.hud.getScore(),
            this.hud.getDistanceTraveled(),
            this.hud.getFlightTime()
        );
    }

    public destroy(): void {
        this.isRunning = false;
        cancelAnimationFrame(this.animationFrameId);

        this.aircraft?.destroy();
        this.checkpoints?.reset();

        if (this.viewer) {
            this.viewer.destroy();
        }
    }
}
