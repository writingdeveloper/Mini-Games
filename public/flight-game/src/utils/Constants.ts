// Flight Physics Constants
export const PHYSICS = {
    // Gravity (m/s²)
    GRAVITY: 9.81,

    // Air density at sea level (kg/m³)
    AIR_DENSITY: 1.225,

    // Aircraft properties
    AIRCRAFT: {
        MASS: 1000,           // kg
        WING_AREA: 20,        // m²
        MAX_THRUST: 50000,    // N

        // Coefficients
        LIFT_COEFFICIENT: 1.2,
        DRAG_COEFFICIENT: 0.03,

        // Speed limits (m/s)
        MIN_SPEED: 30,        // Stall speed
        MAX_SPEED: 300,       // Terminal velocity
        CRUISE_SPEED: 100,

        // Rotation rates (rad/s)
        PITCH_RATE: 0.8,
        ROLL_RATE: 1.5,
        YAW_RATE: 0.5,

        // Altitude limits (m)
        MIN_ALTITUDE: 10,
        MAX_ALTITUDE: 15000,

        // Fuel
        MAX_FUEL: 100,
        FUEL_CONSUMPTION_RATE: 0.02,  // per second at full throttle
        BOOST_FUEL_MULTIPLIER: 3,
    },

    // Damping factors
    DAMPING: {
        LINEAR: 0.98,
        ANGULAR: 0.95,
    }
};

// Game Settings
export const GAME = {
    // Scoring
    SCORE: {
        CHECKPOINT: 100,
        DISTANCE_PER_100M: 1,
        LOW_ALTITUDE_MULTIPLIER: 2,
        COMBO_MULTIPLIERS: [1, 1.5, 2, 2.5, 3],
    },

    // Checkpoints
    CHECKPOINT: {
        RING_RADIUS: 50,      // meters
        SPAWN_DISTANCE: 2000, // meters
        COUNT_PER_LEVEL: 10,
    },

    // Warnings
    WARNINGS: {
        LOW_FUEL_THRESHOLD: 20,      // percent
        LOW_ALTITUDE_THRESHOLD: 100, // meters
        STALL_SPEED_THRESHOLD: 40,   // m/s
    },

    // Camera
    CAMERA: {
        THIRD_PERSON_DISTANCE: 30,
        THIRD_PERSON_HEIGHT: 10,
        FIRST_PERSON_OFFSET: 2,
        SMOOTH_FACTOR: 0.1,
    }
};

// Starting Locations
export const LOCATIONS = {
    SEOUL: { lat: 37.5665, lon: 126.9780, name: 'Seoul' },
    NEW_YORK: { lat: 40.7128, lon: -74.0060, name: 'New York' },
    PARIS: { lat: 48.8566, lon: 2.3522, name: 'Paris' },
    TOKYO: { lat: 35.6762, lon: 139.6503, name: 'Tokyo' },
    DUBAI: { lat: 25.2048, lon: 55.2708, name: 'Dubai' },
    SYDNEY: { lat: -33.8688, lon: 151.2093, name: 'Sydney' },
};

// Key bindings
export const KEYS = {
    PITCH_UP: ['KeyW', 'ArrowUp'],
    PITCH_DOWN: ['KeyS', 'ArrowDown'],
    ROLL_LEFT: ['KeyA', 'ArrowLeft'],
    ROLL_RIGHT: ['KeyD', 'ArrowRight'],
    YAW_LEFT: ['KeyQ'],
    YAW_RIGHT: ['KeyE'],
    THROTTLE_UP: ['ShiftLeft', 'ShiftRight'],
    THROTTLE_DOWN: ['ControlLeft', 'ControlRight'],
    TOGGLE_CAMERA: ['KeyC'],
    TOGGLE_MINIMAP: ['KeyM'],
    PAUSE: ['Escape'],
};

// Game modes
export type GameMode = 'free' | 'checkpoint' | 'survival';

// Camera modes
export type CameraMode = 'third-person' | 'first-person' | 'free';
