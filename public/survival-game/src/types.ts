import { Mesh, PhysicsBody, AbstractMesh } from '@babylonjs/core';

/**
 * Player survival stats
 */
export interface PlayerStats {
  health: number;
  stamina: number;
  hunger: number;
  thirst: number;
}

/**
 * Character customization options
 */
export interface CharacterCustomization {
  characterType: 'default' | 'warrior' | 'scout' | 'survivor';
  color: string;
  size: number;
  bodyType: 'slim' | 'normal' | 'muscular';
}

/**
 * Vehicle interface for cars and motorcycles
 */
export interface Vehicle {
  mesh: Mesh;
  type: 'car' | 'motorcycle';
  speed: number;
  turnSpeed: number;
  mass: number;
}

/**
 * Enemy state type
 */
export type EnemyState = 'patrol' | 'chase';

/**
 * Cached mesh references for enemy animation
 */
export interface EnemyMeshRefs {
  leftArm: AbstractMesh | null;
  rightArm: AbstractMesh | null;
  head: AbstractMesh | null;
}

/**
 * Enemy interface with AI properties
 */
export interface Enemy {
  mesh: Mesh;
  initialPosition: { x: number; y: number; z: number };
  patrolRadius: number;
  speed: number;
  chaseSpeed: number;
  detectionRange: number;
  state: EnemyState;
  patrolAngle: number;
  /** Cached mesh references for performance */
  meshRefs: EnemyMeshRefs;
}

/**
 * Input map for keyboard controls
 */
export interface InputMap {
  [key: string]: boolean;
}

/**
 * Cached DOM element references
 */
export interface CachedDOMElements {
  fps: HTMLElement | null;
  position: HTMLElement | null;
  healthBar: HTMLElement | null;
  staminaBar: HTMLElement | null;
  hungerBar: HTMLElement | null;
  thirstBar: HTMLElement | null;
  healthText: HTMLElement | null;
  staminaText: HTMLElement | null;
  hungerText: HTMLElement | null;
  thirstText: HTMLElement | null;
  time: HTMLElement | null;
  loading: HTMLElement | null;
  ui: HTMLElement | null;
  controls: HTMLElement | null;
}

/**
 * Body type multipliers for character creation
 */
export interface BodyTypeMultipliers {
  radius: number;
  height: number;
}

/**
 * Disposable interface for cleanup
 */
export interface Disposable {
  dispose(): void;
}
