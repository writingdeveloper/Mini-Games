import { PHYSICS } from './Constants';

export interface FlightState {
    // Position (in Cesium Cartesian3 format, but stored as numbers)
    position: { x: number; y: number; z: number };

    // Velocity (m/s)
    velocity: { x: number; y: number; z: number };

    // Orientation (radians)
    heading: number;  // Yaw - rotation around vertical axis
    pitch: number;    // Pitch - nose up/down
    roll: number;     // Roll - banking

    // Speed (m/s)
    speed: number;

    // Altitude (m)
    altitude: number;

    // Engine
    throttle: number; // 0-1

    // Fuel
    fuel: number;     // 0-100
}

export interface ControlInput {
    pitchUp: boolean;
    pitchDown: boolean;
    rollLeft: boolean;
    rollRight: boolean;
    yawLeft: boolean;
    yawRight: boolean;
    throttleUp: boolean;
    throttleDown: boolean;
}

export class FlightPhysics {
    private state: FlightState;
    private readonly config = PHYSICS.AIRCRAFT;
    private readonly damping = PHYSICS.DAMPING;

    constructor(initialAltitude: number = 500) {
        this.state = {
            position: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            heading: 0,
            pitch: 0,
            roll: 0,
            speed: this.config.CRUISE_SPEED,
            altitude: initialAltitude,
            throttle: 0.5,
            fuel: this.config.MAX_FUEL,
        };
    }

    public getState(): FlightState {
        return { ...this.state };
    }

    public setState(state: Partial<FlightState>): void {
        this.state = { ...this.state, ...state };
    }

    public update(input: ControlInput, deltaTime: number): FlightState {
        const dt = deltaTime;

        // Update throttle
        this.updateThrottle(input, dt);

        // Update orientation
        this.updateOrientation(input, dt);

        // Calculate forces
        const forces = this.calculateForces();

        // Update velocity
        this.updateVelocity(forces, dt);

        // Update position (handled by Cesium, but we track speed)
        this.state.speed = Math.sqrt(
            this.state.velocity.x ** 2 +
            this.state.velocity.y ** 2 +
            this.state.velocity.z ** 2
        );

        // Clamp speed
        this.state.speed = Math.max(0, Math.min(this.config.MAX_SPEED, this.state.speed));

        // Update fuel
        this.updateFuel(dt);

        return this.getState();
    }

    private updateThrottle(input: ControlInput, dt: number): void {
        const throttleRate = 0.5; // per second

        if (input.throttleUp && this.state.fuel > 0) {
            this.state.throttle = Math.min(1, this.state.throttle + throttleRate * dt);
        }
        if (input.throttleDown) {
            this.state.throttle = Math.max(0, this.state.throttle - throttleRate * dt);
        }
    }

    private updateOrientation(input: ControlInput, dt: number): void {
        // Calculate control effectiveness based on speed
        const speedRatio = this.state.speed / this.config.CRUISE_SPEED;
        const controlEffectiveness = Math.min(1, Math.max(0.1, speedRatio));

        // Pitch
        if (input.pitchUp) {
            this.state.pitch += this.config.PITCH_RATE * controlEffectiveness * dt;
        }
        if (input.pitchDown) {
            this.state.pitch -= this.config.PITCH_RATE * controlEffectiveness * dt;
        }

        // Roll
        if (input.rollLeft) {
            this.state.roll += this.config.ROLL_RATE * controlEffectiveness * dt;
        }
        if (input.rollRight) {
            this.state.roll -= this.config.ROLL_RATE * controlEffectiveness * dt;
        }

        // Yaw (direct control + roll-induced)
        const rollYaw = Math.sin(this.state.roll) * 0.3 * dt;
        if (input.yawLeft) {
            this.state.heading -= this.config.YAW_RATE * controlEffectiveness * dt;
        }
        if (input.yawRight) {
            this.state.heading += this.config.YAW_RATE * controlEffectiveness * dt;
        }
        this.state.heading += rollYaw;

        // Clamp pitch
        this.state.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.state.pitch));

        // Clamp roll
        this.state.roll = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.state.roll));

        // Apply damping to roll (auto-level when no input)
        if (!input.rollLeft && !input.rollRight) {
            this.state.roll *= 0.95;
        }

        // Normalize heading
        while (this.state.heading > Math.PI) this.state.heading -= 2 * Math.PI;
        while (this.state.heading < -Math.PI) this.state.heading += 2 * Math.PI;
    }

    private calculateForces(): { thrust: number; lift: number; drag: number; gravity: number } {
        const speedSquared = this.state.speed ** 2;

        // Thrust
        const thrust = this.state.fuel > 0
            ? this.config.MAX_THRUST * this.state.throttle
            : 0;

        // Lift (proportional to speed squared and angle of attack)
        const angleOfAttack = this.state.pitch;
        const liftCoefficient = this.config.LIFT_COEFFICIENT * Math.cos(angleOfAttack);
        const lift = 0.5 * PHYSICS.AIR_DENSITY * speedSquared *
            this.config.WING_AREA * liftCoefficient;

        // Drag (proportional to speed squared)
        const drag = 0.5 * PHYSICS.AIR_DENSITY * speedSquared *
            this.config.WING_AREA * this.config.DRAG_COEFFICIENT;

        // Gravity
        const gravity = this.config.MASS * PHYSICS.GRAVITY;

        return { thrust, lift, drag, gravity };
    }

    private updateVelocity(
        forces: { thrust: number; lift: number; drag: number; gravity: number },
        dt: number
    ): void {
        // Calculate net acceleration
        const netForce = forces.thrust - forces.drag;
        const acceleration = netForce / this.config.MASS;

        // Update forward speed
        this.state.speed += acceleration * dt;

        // Calculate vertical velocity component based on pitch and lift
        const verticalAcceleration =
            (forces.lift * Math.cos(this.state.roll) - forces.gravity) / this.config.MASS +
            Math.sin(this.state.pitch) * this.state.speed * 0.5;

        // Update altitude
        this.state.altitude += verticalAcceleration * dt;

        // Clamp altitude
        this.state.altitude = Math.max(
            this.config.MIN_ALTITUDE,
            Math.min(this.config.MAX_ALTITUDE, this.state.altitude)
        );

        // Update velocity vector based on orientation
        const cosHeading = Math.cos(this.state.heading);
        const sinHeading = Math.sin(this.state.heading);
        const cosPitch = Math.cos(this.state.pitch);
        const sinPitch = Math.sin(this.state.pitch);

        this.state.velocity = {
            x: this.state.speed * cosHeading * cosPitch,
            y: this.state.speed * sinHeading * cosPitch,
            z: this.state.speed * sinPitch,
        };
    }

    private updateFuel(dt: number): void {
        if (this.state.throttle > 0 && this.state.fuel > 0) {
            const consumption = this.config.FUEL_CONSUMPTION_RATE *
                this.state.throttle * dt;
            this.state.fuel = Math.max(0, this.state.fuel - consumption);
        }
    }

    // Check if aircraft is in stall condition
    public isStalling(): boolean {
        return this.state.speed < this.config.MIN_SPEED && this.state.pitch > 0;
    }

    // Check if fuel is low
    public isLowFuel(): boolean {
        return this.state.fuel < 20;
    }

    // Check if altitude is dangerously low
    public isLowAltitude(): boolean {
        return this.state.altitude < 100;
    }

    // Get speed in km/h for display
    public getSpeedKmh(): number {
        return Math.round(this.state.speed * 3.6);
    }

    // Refuel
    public refuel(amount: number = 100): void {
        this.state.fuel = Math.min(this.config.MAX_FUEL, this.state.fuel + amount);
    }

    // Reset state
    public reset(altitude: number = 500): void {
        this.state = {
            position: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            heading: 0,
            pitch: 0,
            roll: 0,
            speed: this.config.CRUISE_SPEED,
            altitude: altitude,
            throttle: 0.5,
            fuel: this.config.MAX_FUEL,
        };
    }
}
