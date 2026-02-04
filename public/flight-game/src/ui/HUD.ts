import { FlightState } from '../utils/FlightPhysics';
import { GAME } from '../utils/Constants';

export class HUD {
    private elements: {
        speedValue: HTMLElement | null;
        scoreValue: HTMLElement | null;
        altitudeValue: HTMLElement | null;
        altitudeFill: HTMLElement | null;
        fuelFill: HTMLElement | null;
        fuelPercent: HTMLElement | null;
        throttleFill: HTMLElement | null;
        throttlePercent: HTMLElement | null;
        compassRing: HTMLElement | null;
        flightTime: HTMLElement | null;
        objectiveText: HTMLElement | null;
        cameraMode: HTMLElement | null;
        checkpointDistance: HTMLElement | null;
        checkpointArrow: HTMLElement | null;
        checkpointIndicator: HTMLElement | null;
        stallWarning: HTMLElement | null;
        fuelWarning: HTMLElement | null;
        altitudeWarning: HTMLElement | null;
        minimapPlane: HTMLElement | null;
    };

    private score: number = 0;
    private flightTimeSeconds: number = 0;
    private distanceTraveled: number = 0;

    constructor() {
        this.elements = {
            speedValue: document.getElementById('speed-value'),
            scoreValue: document.getElementById('score-value'),
            altitudeValue: document.getElementById('altitude-value'),
            altitudeFill: document.getElementById('altitude-fill'),
            fuelFill: document.getElementById('fuel-fill'),
            fuelPercent: document.getElementById('fuel-percent'),
            throttleFill: document.getElementById('throttle-fill'),
            throttlePercent: document.getElementById('throttle-percent'),
            compassRing: document.getElementById('compass-ring'),
            flightTime: document.getElementById('flight-time'),
            objectiveText: document.getElementById('objective-text'),
            cameraMode: document.getElementById('camera-mode'),
            checkpointDistance: document.getElementById('checkpoint-distance'),
            checkpointArrow: document.getElementById('checkpoint-arrow'),
            checkpointIndicator: document.getElementById('checkpoint-indicator'),
            stallWarning: document.getElementById('stall-warning'),
            fuelWarning: document.getElementById('fuel-warning'),
            altitudeWarning: document.getElementById('altitude-warning'),
            minimapPlane: document.getElementById('minimap-plane'),
        };
    }

    public update(state: FlightState, deltaTime: number): void {
        // Update flight time
        this.flightTimeSeconds += deltaTime;

        // Speed (convert m/s to km/h)
        const speedKmh = Math.round(state.speed * 3.6);
        this.updateElement(this.elements.speedValue, speedKmh.toString());

        // Altitude
        const altitude = Math.round(state.altitude);
        this.updateElement(this.elements.altitudeValue, altitude.toString());

        // Altitude bar (max 10000m for display)
        const altPercent = Math.min(100, (state.altitude / 10000) * 100);
        if (this.elements.altitudeFill) {
            this.elements.altitudeFill.style.height = `${altPercent}%`;
        }

        // Fuel
        const fuelPercent = Math.round(state.fuel);
        if (this.elements.fuelFill) {
            this.elements.fuelFill.style.width = `${fuelPercent}%`;
        }
        this.updateElement(this.elements.fuelPercent, `${fuelPercent}%`);

        // Throttle
        const throttlePercent = Math.round(state.throttle * 100);
        if (this.elements.throttleFill) {
            this.elements.throttleFill.style.width = `${throttlePercent}%`;
        }
        this.updateElement(this.elements.throttlePercent, `${throttlePercent}%`);

        // Compass (heading in degrees)
        const headingDeg = ((state.heading * 180 / Math.PI) + 360) % 360;
        if (this.elements.compassRing) {
            this.elements.compassRing.style.transform = `rotate(${-headingDeg}deg)`;
        }

        // Flight time
        this.updateElement(this.elements.flightTime, this.formatTime(this.flightTimeSeconds));

        // Minimap plane rotation
        if (this.elements.minimapPlane) {
            this.elements.minimapPlane.style.transform =
                `translate(-50%, -50%) rotate(${headingDeg}deg)`;
        }

        // Score
        this.updateElement(this.elements.scoreValue, this.score.toString());

        // Warnings
        this.updateWarnings(state);
    }

    private updateWarnings(state: FlightState): void {
        // Stall warning
        const isStalling = state.speed < GAME.WARNINGS.STALL_SPEED_THRESHOLD && state.pitch > 0;
        this.toggleWarning(this.elements.stallWarning, isStalling);

        // Low fuel warning
        const isLowFuel = state.fuel < GAME.WARNINGS.LOW_FUEL_THRESHOLD;
        this.toggleWarning(this.elements.fuelWarning, isLowFuel);

        // Low altitude warning
        const isLowAltitude = state.altitude < GAME.WARNINGS.LOW_ALTITUDE_THRESHOLD;
        this.toggleWarning(this.elements.altitudeWarning, isLowAltitude);
    }

    private toggleWarning(element: HTMLElement | null, show: boolean): void {
        if (element) {
            element.classList.toggle('hidden', !show);
        }
    }

    public updateCheckpointIndicator(
        distance: number,
        direction: number,
        aircraftHeading: number
    ): void {
        if (distance < 0) {
            this.hideCheckpointIndicator();
            return;
        }

        this.showCheckpointIndicator();

        // Update distance text
        const distanceKm = (distance / 1000).toFixed(1);
        this.updateElement(this.elements.checkpointDistance, `${distanceKm} km`);

        // Update arrow direction (relative to aircraft heading)
        const relativeAngle = ((direction - aircraftHeading) * 180 / Math.PI + 360) % 360;
        if (this.elements.checkpointArrow) {
            this.elements.checkpointArrow.style.transform = `rotate(${relativeAngle}deg)`;
        }
    }

    public showCheckpointIndicator(): void {
        this.elements.checkpointIndicator?.classList.remove('hidden');
    }

    public hideCheckpointIndicator(): void {
        this.elements.checkpointIndicator?.classList.add('hidden');
    }

    public updateObjective(text: string): void {
        this.updateElement(this.elements.objectiveText, text);
    }

    public updateCameraMode(mode: string): void {
        this.updateElement(this.elements.cameraMode, mode);
    }

    public addScore(points: number): void {
        this.score += points;
    }

    public getScore(): number {
        return this.score;
    }

    public getFlightTime(): number {
        return this.flightTimeSeconds;
    }

    public getDistanceTraveled(): number {
        return this.distanceTraveled;
    }

    public addDistance(meters: number): void {
        this.distanceTraveled += meters;

        // Add score for distance
        const distanceScore = Math.floor(this.distanceTraveled / 100);
        // Score is added elsewhere to avoid double counting
    }

    public show(): void {
        const hud = document.getElementById('hud');
        if (hud) {
            hud.classList.remove('hidden');
        }
    }

    public hide(): void {
        const hud = document.getElementById('hud');
        if (hud) {
            hud.classList.add('hidden');
        }
    }

    public reset(): void {
        this.score = 0;
        this.flightTimeSeconds = 0;
        this.distanceTraveled = 0;
    }

    private updateElement(element: HTMLElement | null, value: string): void {
        if (element) {
            element.textContent = value;
        }
    }

    private formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}
