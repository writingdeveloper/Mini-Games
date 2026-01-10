/**
 * Game configuration constants
 * Centralized location for all magic numbers and tunable values
 */

// =============================================================================
// PHYSICS
// =============================================================================
export const PHYSICS = {
  GRAVITY: -9.81,
  PLAYER_MASS: 70,
  CAR_MASS: 500,
  MOTORCYCLE_MASS: 150,
  ENEMY_MASS: 60,
  RESTITUTION: {
    DEFAULT: 0.2,
    PLAYER: 0.0,
    VEHICLE: 0.1,
    MOTORCYCLE: 0.05,
  },
  FRICTION: 0.5,
  ANGULAR_DAMPING: 10,
  LINEAR_DAMPING: 0.5,
} as const;

// =============================================================================
// PLAYER
// =============================================================================
export const PLAYER = {
  MOVE_SPEED: 5,
  JUMP_FORCE: 6,
  EYE_HEIGHT: 1.6,
  MAX_JUMP_HEIGHT: 4,
  JUMP_VELOCITY_THRESHOLD: 0.1,
  DEFAULT_SIZE: 1.0,
  COLLISION_RADIUS: 0.4,
  COLLISION_HEIGHT: 2,
} as const;

// =============================================================================
// VEHICLE
// =============================================================================
export const VEHICLE = {
  CAR_SPEED: 10,
  MOTORCYCLE_SPEED: 15,
  TURN_SPEED: 0.05,
  REVERSE_SPEED_MULTIPLIER: 0.5,
  MOUNT_DISTANCE: 5,
  CAMERA_OFFSET_Y: 3,
  CAMERA_OFFSET_Z: -8,
  DISMOUNT_OFFSET_X: 3,
  DISMOUNT_OFFSET_Y: 1,
} as const;

// =============================================================================
// ENEMY AI
// =============================================================================
export const ENEMY = {
  DETECTION_RANGE: 15,
  DETECTION_RELEASE_MULTIPLIER: 1.5,
  PATROL_SPEED: 2,
  CHASE_SPEED: 4,
  PATROL_RADIUS: 10,
  PATROL_ROTATION_SPEED: 0.5,
  ARM_CHASE_ANIMATION_SPEED: 0.01,
  ARM_PATROL_ANIMATION_SPEED: 0.003,
  HEAD_BOB_SPEED: 0.005,
  ARM_CHASE_SWING: 0.5,
  ARM_PATROL_SWING: 0.2,
  HEAD_SWING_Y: 0.3,
  HEAD_SWING_X: 0.1,
  HEAD_BOB_HEIGHT: 0.05,
} as const;

// =============================================================================
// CAMERA
// =============================================================================
export const CAMERA = {
  DEFAULT_ANGULAR_SENSIBILITY: 2000,
  DEFAULT_SPEED: 0.3,
  INITIAL_POSITION: { x: 0, y: 1.6, z: -5 },
} as const;

// =============================================================================
// RENDERING
// =============================================================================
export const RENDERING = {
  SHADOW_MAP_SIZE: 1024,
  SHADOW_BLUR_KERNEL: 32,
  DYNAMIC_TEXTURE_SIZE: 512,
  GRASS_BLADE_COUNT: 2000,
  BUMP_NOISE_COUNT: 1000,
  WOOD_PATTERN_COUNT: 100,
  LEAVES_PATTERN_COUNT: 500,
  STONE_PATTERN_COUNT: 300,
  STONE_CRACK_COUNT: 30,
} as const;

// =============================================================================
// TERRAIN
// =============================================================================
export const TERRAIN = {
  WIDTH: 100,
  HEIGHT: 100,
  SUBDIVISIONS: 100,
  MIN_HEIGHT: 0,
  MAX_HEIGHT: 3,
  GRASS_TEXTURE_SCALE: 10,
  WOOD_TEXTURE_U_SCALE: 2,
  WOOD_TEXTURE_V_SCALE: 3,
  LEAVES_TEXTURE_SCALE: 3,
  STONE_TEXTURE_SCALE: 1.5,
} as const;

// =============================================================================
// LIGHTING
// =============================================================================
export const LIGHTING = {
  HEMISPHERIC_INTENSITY: 0.4,
  SUN_INTENSITY: 1.2,
  SUN_POSITION: { x: 20, y: 40, z: 20 },
  SUN_DIRECTION: { x: -1, y: -2, z: -1 },
  GROUND_COLOR: { r: 0.2, g: 0.3, b: 0.3 },
} as const;

// =============================================================================
// SURVIVAL STATS
// =============================================================================
export const SURVIVAL = {
  INITIAL_HEALTH: 100,
  INITIAL_STAMINA: 100,
  INITIAL_HUNGER: 100,
  INITIAL_THIRST: 100,
  HUNGER_DECAY_RATE: 0.5,
  THIRST_DECAY_RATE: 0.8,
  STAMINA_DRAIN_RATE: 2,
  STAMINA_REGEN_RATE: 5,
  STARVATION_DAMAGE_RATE: 5,
  VELOCITY_THRESHOLD: 0.1,
} as const;

// =============================================================================
// TIME SYSTEM
// =============================================================================
export const TIME = {
  DAY_CYCLE_SPEED: 0.1,
  DAY_CYCLE_LENGTH: 100,
  DAWN_THRESHOLD: 0.25,
  DAY_THRESHOLD: 0.5,
  DUSK_THRESHOLD: 0.75,
} as const;

// =============================================================================
// SPAWN POSITIONS
// =============================================================================
export const SPAWN_POSITIONS = {
  PLAYER: { x: 0, y: 2, z: 0 },
  VEHICLES: {
    CARS: [
      { x: 15, y: 1.5, z: 5 },
      { x: -20, y: 1.5, z: -10 },
    ],
    MOTORCYCLES: [
      { x: 8, y: 1, z: -8 },
      { x: -12, y: 1, z: 15 },
    ],
  },
  TREES: [
    { x: 10, y: 2, z: 10 },
    { x: -15, y: 2, z: 8 },
    { x: 20, y: 2, z: -15 },
    { x: -10, y: 2, z: -20 },
    { x: 0, y: 2, z: 25 },
  ],
  ROCKS: [
    { x: 5, y: 1, z: -5 },
    { x: -8, y: 1, z: 12 },
    { x: 15, y: 1, z: 5 },
  ],
  ENEMIES: [
    { x: 20, y: 1, z: 20 },
    { x: -25, y: 1, z: 15 },
    { x: 15, y: 1, z: -25 },
    { x: -20, y: 1, z: -20 },
    { x: 30, y: 1, z: 5 },
    { x: -15, y: 1, z: 30 },
    { x: 25, y: 1, z: -15 },
    { x: -30, y: 1, z: -5 },
  ],
} as const;

// =============================================================================
// COLORS
// =============================================================================
export const COLORS = {
  SKY: { r: 0.5, g: 0.8, b: 0.9, a: 1 },
  CAR_BODY: { r: 0.8, g: 0.1, b: 0.1 },
  MOTORCYCLE_BODY: { r: 0.1, g: 0.1, b: 0.8 },
  ENEMY_BODY: { r: 0.3, g: 0.3, b: 0.3 },
  WHEEL: { r: 0.1, g: 0.1, b: 0.1 },
  SEAT: { r: 0.2, g: 0.2, b: 0.2 },
  GLASS: { r: 0.5, g: 0.7, b: 0.9 },
} as const;

// =============================================================================
// MATERIALS
// =============================================================================
export const MATERIALS = {
  CAR: {
    METALLIC: 0.7,
    ROUGHNESS: 0.2,
  },
  MOTORCYCLE: {
    METALLIC: 0.8,
    ROUGHNESS: 0.15,
  },
  GLASS: {
    ALPHA: 0.3,
    METALLIC: 0.9,
    ROUGHNESS: 0.1,
  },
  WHEEL: {
    ROUGHNESS: 0.9,
    METALLIC: 0.2,
  },
  GROUND: {
    ROUGHNESS: 0.95,
    METALLIC: 0,
    BUMP_LEVEL: 0.5,
  },
  WOOD: {
    ROUGHNESS: 0.98,
    METALLIC: 0,
    BUMP_LEVEL: 0.8,
  },
  LEAVES: {
    ROUGHNESS: 0.9,
    METALLIC: 0,
  },
  STONE: {
    ROUGHNESS: 0.98,
    METALLIC: 0.05,
    BUMP_LEVEL: 1.0,
  },
} as const;

// =============================================================================
// CHARACTER TYPE PROPERTIES
// =============================================================================
export const CHARACTER_TYPES = {
  default: {
    metallic: 0.2,
    roughness: 0.4,
    emissive: { r: 0.05, g: 0.1, b: 0.2 },
  },
  warrior: {
    metallic: 0.4,
    roughness: 0.3,
    emissive: { r: 0.1, g: 0.05, b: 0.05 },
  },
  scout: {
    metallic: 0.1,
    roughness: 0.6,
    emissive: { r: 0.05, g: 0.1, b: 0.05 },
  },
  survivor: {
    metallic: 0.2,
    roughness: 0.7,
    emissive: { r: 0.1, g: 0.08, b: 0.05 },
  },
} as const;

// =============================================================================
// BODY TYPE MULTIPLIERS
// =============================================================================
export const BODY_TYPES = {
  slim: { radius: 0.8, height: 1.1 },
  normal: { radius: 1.0, height: 1.0 },
  muscular: { radius: 1.2, height: 0.95 },
} as const;
