import { Engine, Scene, UniversalCamera, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3, Color4, DirectionalLight, ShadowGenerator, PBRMaterial, Texture, DynamicTexture, Mesh, AbstractMesh } from '@babylonjs/core';
// @ts-ignore - Module resolution handled by build system
import HavokPhysics from '@babylonjs/havok';
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import { PhysicsAggregate, PhysicsShapeType } from '@babylonjs/core/Physics/v2';
import {
  PlayerStats,
  CharacterCustomization,
  Vehicle,
  Enemy,
  EnemyMeshRefs,
  InputMap,
  CachedDOMElements,
  Disposable,
} from './types';
import {
  PHYSICS,
  PLAYER,
  VEHICLE,
  ENEMY,
  CAMERA,
  RENDERING,
  TERRAIN,
  LIGHTING,
  SURVIVAL,
  TIME,
  SPAWN_POSITIONS,
  COLORS,
  MATERIALS,
  CHARACTER_TYPES,
  BODY_TYPES,
} from './config';

// =============================================================================
// VECTOR3 OBJECT POOL - Reduces GC pressure
// =============================================================================
class Vector3Pool {
  private pool: Vector3[] = [];
  private poolSize = 50;

  constructor() {
    for (let i = 0; i < this.poolSize; i++) {
      this.pool.push(new Vector3(0, 0, 0));
    }
  }

  get(): Vector3 {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return new Vector3(0, 0, 0);
  }

  release(v: Vector3): void {
    v.set(0, 0, 0);
    if (this.pool.length < this.poolSize * 2) {
      this.pool.push(v);
    }
  }

  getWith(x: number, y: number, z: number): Vector3 {
    const v = this.get();
    v.set(x, y, z);
    return v;
  }
}

// =============================================================================
// GAME CLASS
// =============================================================================
class Game implements Disposable {
  private canvas: HTMLCanvasElement;
  private engine: Engine;
  private scene!: Scene;
  private camera!: UniversalCamera;
  private player!: Mesh;
  private playerAggregate!: PhysicsAggregate;
  private shadowGenerator!: ShadowGenerator;

  private playerStats: PlayerStats = {
    health: SURVIVAL.INITIAL_HEALTH,
    stamina: SURVIVAL.INITIAL_STAMINA,
    hunger: SURVIVAL.INITIAL_HUNGER,
    thirst: SURVIVAL.INITIAL_THIRST,
  };

  private dayTime = 0;
  private isPointerLocked = false;

  private customization: CharacterCustomization = {
    characterType: 'default',
    color: '#9966ff',
    size: PLAYER.DEFAULT_SIZE,
    bodyType: 'normal',
  };

  private vehicles: Vehicle[] = [];
  private mountedVehicle: Vehicle | null = null;
  private isMounted = false;
  private enemies: Enemy[] = [];

  // Cached DOM elements
  private domElements: CachedDOMElements = {
    fps: null,
    position: null,
    healthBar: null,
    staminaBar: null,
    hungerBar: null,
    thirstBar: null,
    healthText: null,
    staminaText: null,
    hungerText: null,
    thirstText: null,
    time: null,
    loading: null,
    ui: null,
    controls: null,
  };

  // Vector3 pool for reuse
  private vec3Pool = new Vector3Pool();

  // Reusable vectors for update loop (avoid allocations)
  private moveVector = new Vector3(0, 0, 0);
  private tempVector = new Vector3(0, 0, 0);

  // Event listener references for cleanup
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundResize: () => void;
  private boundPointerLockChange: () => void;
  private boundCanvasClick: () => void;

  // Input map
  private inputMap: InputMap = {};

  constructor() {
    this.canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    // Bind event handlers for proper cleanup
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    this.boundResize = this.handleResize.bind(this);
    this.boundPointerLockChange = this.handlePointerLockChange.bind(this);
    this.boundCanvasClick = this.handleCanvasClick.bind(this);

    this.setupMenu();
  }

  /**
   * Cleanup all resources
   */
  public dispose(): void {
    // Remove event listeners
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('resize', this.boundResize);
    document.removeEventListener('pointerlockchange', this.boundPointerLockChange);
    this.canvas.removeEventListener('click', this.boundCanvasClick);

    // Dispose Babylon.js resources
    if (this.scene) {
      this.scene.dispose();
    }
    if (this.engine) {
      this.engine.dispose();
    }
  }

  private setupMenu(): void {
    // Character selection
    document.querySelectorAll('.character-option').forEach((option) => {
      option.addEventListener('click', () => {
        document.querySelectorAll('.character-option').forEach((o) => o.classList.remove('selected'));
        option.classList.add('selected');
        this.customization.characterType = option.getAttribute('data-character') as CharacterCustomization['characterType'];
      });
    });

    // Color selection
    document.querySelectorAll('.color-option').forEach((option) => {
      option.addEventListener('click', () => {
        document.querySelectorAll('.color-option').forEach((o) => o.classList.remove('selected'));
        option.classList.add('selected');
        this.customization.color = option.getAttribute('data-color')!;
      });
    });

    // Size selection
    document.querySelectorAll('.size-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.size-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.customization.size = parseFloat(btn.getAttribute('data-size')!);
      });
    });

    // Body type selection
    document.querySelectorAll('.body-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.body-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.customization.bodyType = btn.getAttribute('data-body') as CharacterCustomization['bodyType'];
      });
    });

    // Start button
    const startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        const menu = document.getElementById('mainMenu');
        if (menu) menu.style.display = 'none';
        this.init();
      });
    }

    this.setupModalListeners();
    this.setupSettingsListeners();
  }

  private setupModalListeners(): void {
    // Settings modal
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');

    if (settingsBtn && settingsModal) {
      settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    }

    if (closeSettings && settingsModal) {
      closeSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
    }

    if (settingsModal) {
      settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.add('hidden');
      });
    }

    // Controls modal
    const controlsBtn = document.getElementById('controlsBtn');
    const controlsModal = document.getElementById('controlsModal');
    const closeControls = document.getElementById('closeControls');

    if (controlsBtn && controlsModal) {
      controlsBtn.addEventListener('click', () => controlsModal.classList.remove('hidden'));
    }

    if (closeControls && controlsModal) {
      closeControls.addEventListener('click', () => controlsModal.classList.add('hidden'));
    }

    if (controlsModal) {
      controlsModal.addEventListener('click', (e) => {
        if (e.target === controlsModal) controlsModal.classList.add('hidden');
      });
    }
  }

  private setupSettingsListeners(): void {
    this.setupVolumeSlider('masterVolume', 'masterVolumeValue', '%');
    this.setupVolumeSlider('musicVolume', 'musicVolumeValue', '%');
    this.setupVolumeSlider('sfxVolume', 'sfxVolumeValue', '%');

    const mouseSensitivity = document.getElementById('mouseSensitivity') as HTMLInputElement;
    const mouseSensitivityValue = document.getElementById('mouseSensitivityValue');
    if (mouseSensitivity && mouseSensitivityValue) {
      mouseSensitivity.addEventListener('input', () => {
        mouseSensitivityValue.textContent = mouseSensitivity.value;
        if (this.camera) {
          this.camera.angularSensibility = CAMERA.DEFAULT_ANGULAR_SENSIBILITY / parseFloat(mouseSensitivity.value);
        }
      });
    }
  }

  private setupVolumeSlider(sliderId: string, valueId: string, suffix: string): void {
    const slider = document.getElementById(sliderId) as HTMLInputElement;
    const value = document.getElementById(valueId);
    if (slider && value) {
      slider.addEventListener('input', () => {
        value.textContent = `${slider.value}${suffix}`;
      });
    }
  }

  private async init(): Promise<void> {
    this.cacheDOMElements();
    await this.createScene();
    this.createTerrain();
    this.createPlayer();
    this.setupControls();
    this.hideLoading();
    this.startRenderLoop();
  }

  /**
   * Cache all DOM elements once for performance
   */
  private cacheDOMElements(): void {
    this.domElements = {
      fps: document.getElementById('fps'),
      position: document.getElementById('position'),
      healthBar: document.getElementById('health-bar'),
      staminaBar: document.getElementById('stamina-bar'),
      hungerBar: document.getElementById('hunger-bar'),
      thirstBar: document.getElementById('thirst-bar'),
      healthText: document.getElementById('health-text'),
      staminaText: document.getElementById('stamina-text'),
      hungerText: document.getElementById('hunger-text'),
      thirstText: document.getElementById('thirst-text'),
      time: document.getElementById('time'),
      loading: document.getElementById('loading'),
      ui: document.getElementById('ui'),
      controls: document.getElementById('controls'),
    };
  }

  private async createScene(): Promise<void> {
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(COLORS.SKY.r, COLORS.SKY.g, COLORS.SKY.b, COLORS.SKY.a);

    // Physics engine
    const havokInstance = await HavokPhysics();
    const havokPlugin = new HavokPlugin(true, havokInstance);
    this.scene.enablePhysics(new Vector3(0, PHYSICS.GRAVITY, 0), havokPlugin);

    // Camera
    this.camera = new UniversalCamera(
      'camera',
      new Vector3(CAMERA.INITIAL_POSITION.x, CAMERA.INITIAL_POSITION.y, CAMERA.INITIAL_POSITION.z),
      this.scene
    );
    this.camera.setTarget(Vector3.Zero());
    this.camera.attachControl(this.canvas, true);
    this.camera.angularSensibility = CAMERA.DEFAULT_ANGULAR_SENSIBILITY;
    this.camera.speed = CAMERA.DEFAULT_SPEED;

    // Pointer lock
    this.canvas.addEventListener('click', this.boundCanvasClick);
    document.addEventListener('pointerlockchange', this.boundPointerLockChange);

    // Lighting
    const hemisphericLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), this.scene);
    hemisphericLight.intensity = LIGHTING.HEMISPHERIC_INTENSITY;
    hemisphericLight.groundColor = new Color3(LIGHTING.GROUND_COLOR.r, LIGHTING.GROUND_COLOR.g, LIGHTING.GROUND_COLOR.b);

    const sunLight = new DirectionalLight(
      'sunLight',
      new Vector3(LIGHTING.SUN_DIRECTION.x, LIGHTING.SUN_DIRECTION.y, LIGHTING.SUN_DIRECTION.z),
      this.scene
    );
    sunLight.position = new Vector3(LIGHTING.SUN_POSITION.x, LIGHTING.SUN_POSITION.y, LIGHTING.SUN_POSITION.z);
    sunLight.intensity = LIGHTING.SUN_INTENSITY;

    // Shadows
    this.shadowGenerator = new ShadowGenerator(RENDERING.SHADOW_MAP_SIZE, sunLight);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = RENDERING.SHADOW_BLUR_KERNEL;
  }

  private handleCanvasClick(): void {
    if (!this.isPointerLocked) {
      this.canvas.requestPointerLock();
    }
  }

  private handlePointerLockChange(): void {
    this.isPointerLocked = document.pointerLockElement === this.canvas;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    this.inputMap[e.key] = true;
    this.handleSpecialKeys(e);
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.inputMap[e.key] = false;
  }

  private handleResize(): void {
    this.engine.resize();
  }

  private handleSpecialKeys(e: KeyboardEvent): void {
    // E key - mount/dismount vehicle
    if (e.key === 'e' || e.key === 'E') {
      this.toggleVehicleMount();
    }

    // F key - fullscreen
    if (e.key === 'f' || e.key === 'F') {
      this.engine.switchFullscreen(false);
    }
  }

  private toggleVehicleMount(): void {
    if (this.isMounted && this.mountedVehicle) {
      // Dismount
      this.isMounted = false;
      this.player.position = new Vector3(
        this.mountedVehicle.mesh.position.x + VEHICLE.DISMOUNT_OFFSET_X,
        this.mountedVehicle.mesh.position.y + VEHICLE.DISMOUNT_OFFSET_Y,
        this.mountedVehicle.mesh.position.z
      );
      this.mountedVehicle = null;
    } else {
      // Find nearest vehicle
      const nearest = this.findNearestVehicle();
      if (nearest) {
        this.isMounted = true;
        this.mountedVehicle = nearest;
      }
    }
  }

  private findNearestVehicle(): Vehicle | null {
    let nearestVehicle: Vehicle | null = null;
    let minDistance = VEHICLE.MOUNT_DISTANCE;

    for (const vehicle of this.vehicles) {
      const distance = Vector3.Distance(this.player.position, vehicle.mesh.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearestVehicle = vehicle;
      }
    }

    return nearestVehicle;
  }

  private createTerrain(): void {
    const ground = MeshBuilder.CreateGroundFromHeightMap(
      'ground',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      {
        width: TERRAIN.WIDTH,
        height: TERRAIN.HEIGHT,
        subdivisions: TERRAIN.SUBDIVISIONS,
        minHeight: TERRAIN.MIN_HEIGHT,
        maxHeight: TERRAIN.MAX_HEIGHT,
      },
      this.scene
    );

    const groundMaterial = new PBRMaterial('groundMat', this.scene);
    groundMaterial.albedoTexture = this.createGrassTexture();
    groundMaterial.bumpTexture = this.createGrassBumpTexture();
    groundMaterial.bumpTexture.level = MATERIALS.GROUND.BUMP_LEVEL;
    groundMaterial.roughness = MATERIALS.GROUND.ROUGHNESS;
    groundMaterial.metallic = MATERIALS.GROUND.METALLIC;

    ground.material = groundMaterial;
    ground.receiveShadows = true;

    new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0, restitution: PHYSICS.RESTITUTION.DEFAULT }, this.scene);

    this.createEnvironmentObjects();
    this.createEnemies();
  }

  private createCar(position: Vector3): Vehicle {
    const car = MeshBuilder.CreateBox('car', { size: 0.01 }, this.scene);
    car.position = position;

    // Body
    const body = MeshBuilder.CreateBox('carBody', { width: 2.5, height: 1, depth: 5 }, this.scene);
    body.position.y = 1;
    body.parent = car;

    // Roof
    const roof = MeshBuilder.CreateBox('carRoof', { width: 2.3, height: 1, depth: 3 }, this.scene);
    roof.position = new Vector3(0, 1.5, -0.3);
    roof.parent = car;

    // Front glass
    const frontGlass = MeshBuilder.CreatePlane('frontGlass', { width: 2.3, height: 0.8 }, this.scene);
    frontGlass.position = new Vector3(0, 1.7, 1.2);
    frontGlass.rotation.x = -Math.PI / 6;
    frontGlass.parent = car;

    const glassMat = new PBRMaterial('glassMat', this.scene);
    glassMat.albedoColor = new Color3(COLORS.GLASS.r, COLORS.GLASS.g, COLORS.GLASS.b);
    glassMat.alpha = MATERIALS.GLASS.ALPHA;
    glassMat.metallic = MATERIALS.GLASS.METALLIC;
    glassMat.roughness = MATERIALS.GLASS.ROUGHNESS;
    frontGlass.material = glassMat;

    // Wheels
    const wheelPositions = [
      new Vector3(-1, 0.4, 1.8),
      new Vector3(1, 0.4, 1.8),
      new Vector3(-1, 0.4, -1.8),
      new Vector3(1, 0.4, -1.8),
    ];

    const wheelMat = new PBRMaterial('wheelMat', this.scene);
    wheelMat.albedoColor = new Color3(COLORS.WHEEL.r, COLORS.WHEEL.g, COLORS.WHEEL.b);
    wheelMat.roughness = MATERIALS.WHEEL.ROUGHNESS;
    wheelMat.metallic = MATERIALS.WHEEL.METALLIC;

    wheelPositions.forEach((pos, index) => {
      const wheel = MeshBuilder.CreateCylinder(`wheel${index}`, { diameter: 0.8, height: 0.3 }, this.scene);
      wheel.rotation.z = Math.PI / 2;
      wheel.position = pos;
      wheel.parent = car;
      wheel.material = wheelMat;
    });

    // Car material
    const carMat = new PBRMaterial('carMat', this.scene);
    carMat.albedoColor = new Color3(COLORS.CAR_BODY.r, COLORS.CAR_BODY.g, COLORS.CAR_BODY.b);
    carMat.metallic = MATERIALS.CAR.METALLIC;
    carMat.roughness = MATERIALS.CAR.ROUGHNESS;

    body.material = carMat;
    roof.material = carMat;

    new PhysicsAggregate(car, PhysicsShapeType.BOX, { mass: PHYSICS.CAR_MASS, restitution: PHYSICS.RESTITUTION.VEHICLE }, this.scene);

    car.getChildMeshes().forEach((mesh: AbstractMesh) => this.shadowGenerator.addShadowCaster(mesh));

    return {
      mesh: car,
      type: 'car',
      speed: VEHICLE.CAR_SPEED,
      turnSpeed: VEHICLE.TURN_SPEED,
      mass: PHYSICS.CAR_MASS,
    };
  }

  private createMotorcycle(position: Vector3): Vehicle {
    const motorcycle = MeshBuilder.CreateBox('motorcycle', { size: 0.01 }, this.scene);
    motorcycle.position = position;

    const frame = MeshBuilder.CreateBox('bikeFrame', { width: 0.5, height: 0.8, depth: 2 }, this.scene);
    frame.position.y = 0.9;
    frame.parent = motorcycle;

    const seat = MeshBuilder.CreateBox('bikeSeat', { width: 0.6, height: 0.3, depth: 1 }, this.scene);
    seat.position = new Vector3(0, 1.2, -0.3);
    seat.parent = motorcycle;

    const handlebar = MeshBuilder.CreateCylinder('handlebar', { diameter: 0.08, height: 1.2 }, this.scene);
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position = new Vector3(0, 1.3, 0.7);
    handlebar.parent = motorcycle;

    const frontWheel = MeshBuilder.CreateCylinder('frontWheel', { diameter: 0.8, height: 0.2 }, this.scene);
    frontWheel.rotation.z = Math.PI / 2;
    frontWheel.position = new Vector3(0, 0.4, 1.2);
    frontWheel.parent = motorcycle;

    const rearWheel = MeshBuilder.CreateCylinder('rearWheel', { diameter: 0.9, height: 0.25 }, this.scene);
    rearWheel.rotation.z = Math.PI / 2;
    rearWheel.position = new Vector3(0, 0.45, -1);
    rearWheel.parent = motorcycle;

    const wheelMat = new PBRMaterial('bikeWheelMat', this.scene);
    wheelMat.albedoColor = new Color3(COLORS.WHEEL.r, COLORS.WHEEL.g, COLORS.WHEEL.b);
    wheelMat.roughness = MATERIALS.WHEEL.ROUGHNESS;
    wheelMat.metallic = MATERIALS.WHEEL.METALLIC;
    frontWheel.material = wheelMat;
    rearWheel.material = wheelMat;

    const bikeMat = new PBRMaterial('bikeMat', this.scene);
    bikeMat.albedoColor = new Color3(COLORS.MOTORCYCLE_BODY.r, COLORS.MOTORCYCLE_BODY.g, COLORS.MOTORCYCLE_BODY.b);
    bikeMat.metallic = MATERIALS.MOTORCYCLE.METALLIC;
    bikeMat.roughness = MATERIALS.MOTORCYCLE.ROUGHNESS;

    frame.material = bikeMat;
    const seatMat = new PBRMaterial('seatMat', this.scene);
    seatMat.albedoColor = new Color3(COLORS.SEAT.r, COLORS.SEAT.g, COLORS.SEAT.b);
    seatMat.roughness = 0.7;
    seat.material = seatMat;
    handlebar.material = bikeMat;

    new PhysicsAggregate(motorcycle, PhysicsShapeType.BOX, { mass: PHYSICS.MOTORCYCLE_MASS, restitution: PHYSICS.RESTITUTION.MOTORCYCLE }, this.scene);

    motorcycle.getChildMeshes().forEach((mesh: AbstractMesh) => this.shadowGenerator.addShadowCaster(mesh));

    return {
      mesh: motorcycle,
      type: 'motorcycle',
      speed: VEHICLE.MOTORCYCLE_SPEED,
      turnSpeed: VEHICLE.TURN_SPEED,
      mass: PHYSICS.MOTORCYCLE_MASS,
    };
  }

  private createEnvironmentObjects(): void {
    // Vehicles
    SPAWN_POSITIONS.VEHICLES.CARS.forEach((pos) => {
      this.vehicles.push(this.createCar(new Vector3(pos.x, pos.y, pos.z)));
    });
    SPAWN_POSITIONS.VEHICLES.MOTORCYCLES.forEach((pos) => {
      this.vehicles.push(this.createMotorcycle(new Vector3(pos.x, pos.y, pos.z)));
    });

    // Trees
    SPAWN_POSITIONS.TREES.forEach((pos, index) => {
      const trunk = MeshBuilder.CreateCylinder(`trunk${index}`, { height: 4, diameter: 1 }, this.scene);
      trunk.position = new Vector3(pos.x, pos.y, pos.z);

      const trunkMat = new PBRMaterial(`trunkMat${index}`, this.scene);
      trunkMat.albedoTexture = this.createWoodTexture();
      trunkMat.bumpTexture = this.createWoodBumpTexture();
      trunkMat.bumpTexture.level = MATERIALS.WOOD.BUMP_LEVEL;
      trunkMat.roughness = MATERIALS.WOOD.ROUGHNESS;
      trunkMat.metallic = MATERIALS.WOOD.METALLIC;
      trunk.material = trunkMat;

      new PhysicsAggregate(trunk, PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);
      this.shadowGenerator.addShadowCaster(trunk);

      const leaves = MeshBuilder.CreateSphere(`leaves${index}`, { diameter: 4 }, this.scene);
      leaves.position = new Vector3(pos.x, pos.y + 3, pos.z);

      const leavesMat = new PBRMaterial(`leavesMat${index}`, this.scene);
      leavesMat.albedoTexture = this.createLeavesTexture();
      leavesMat.roughness = MATERIALS.LEAVES.ROUGHNESS;
      leavesMat.metallic = MATERIALS.LEAVES.METALLIC;
      leaves.material = leavesMat;

      this.shadowGenerator.addShadowCaster(leaves);
    });

    // Rocks
    SPAWN_POSITIONS.ROCKS.forEach((pos, index) => {
      const rock = MeshBuilder.CreatePolyhedron(`rock${index}`, { type: 0, size: 2 }, this.scene);
      rock.position = new Vector3(pos.x, pos.y, pos.z);

      const rockMat = new PBRMaterial(`rockMat${index}`, this.scene);
      rockMat.albedoTexture = this.createStoneTexture();
      rockMat.bumpTexture = this.createStoneBumpTexture();
      rockMat.bumpTexture.level = MATERIALS.STONE.BUMP_LEVEL;
      rockMat.roughness = MATERIALS.STONE.ROUGHNESS;
      rockMat.metallic = MATERIALS.STONE.METALLIC;
      rock.material = rockMat;

      new PhysicsAggregate(rock, PhysicsShapeType.CONVEX_HULL, { mass: 0 }, this.scene);
      this.shadowGenerator.addShadowCaster(rock);
    });
  }

  private createEnemies(): void {
    SPAWN_POSITIONS.ENEMIES.forEach((pos) => {
      const enemyMesh = this.createEnemyCharacter(new Vector3(pos.x, pos.y, pos.z));

      // Cache mesh references for performance
      const meshRefs = this.cacheEnemyMeshRefs(enemyMesh);

      this.enemies.push({
        mesh: enemyMesh,
        initialPosition: { x: pos.x, y: pos.y, z: pos.z },
        patrolRadius: ENEMY.PATROL_RADIUS,
        speed: ENEMY.PATROL_SPEED,
        chaseSpeed: ENEMY.CHASE_SPEED,
        detectionRange: ENEMY.DETECTION_RANGE,
        state: 'patrol',
        patrolAngle: Math.random() * Math.PI * 2,
        meshRefs,
      });
    });
  }

  /**
   * Cache enemy mesh references once instead of searching every frame
   */
  private cacheEnemyMeshRefs(mesh: Mesh): EnemyMeshRefs {
    const childMeshes = mesh.getChildMeshes();
    return {
      leftArm: childMeshes.find((m: AbstractMesh) => m.name === 'leftArm') || null,
      rightArm: childMeshes.find((m: AbstractMesh) => m.name === 'rightArm') || null,
      head: childMeshes.find((m: AbstractMesh) => m.name === 'enemyHead') || null,
    };
  }

  private createEnemyCharacter(position: Vector3): Mesh {
    const parent = MeshBuilder.CreateBox('enemy', { size: 0.01 }, this.scene);
    parent.position = position;

    const body = MeshBuilder.CreateCylinder('enemyBody', { height: 1.2, diameter: 0.6 }, this.scene);
    body.position.y = 0.6;
    body.parent = parent;

    const bodyMat = new PBRMaterial('enemyBodyMat', this.scene);
    bodyMat.albedoColor = new Color3(COLORS.ENEMY_BODY.r, COLORS.ENEMY_BODY.g, COLORS.ENEMY_BODY.b);
    bodyMat.roughness = 0.8;
    body.material = bodyMat;

    // Arms
    const leftArm = MeshBuilder.CreateCylinder('leftArm', { height: 0.8, diameter: 0.15 }, this.scene);
    leftArm.rotation.z = Math.PI / 2;
    leftArm.rotation.x = Math.PI / 4;
    leftArm.position = new Vector3(-0.5, 0.8, 0);
    leftArm.parent = parent;
    leftArm.material = bodyMat;

    const rightArm = MeshBuilder.CreateCylinder('rightArm', { height: 0.8, diameter: 0.15 }, this.scene);
    rightArm.rotation.z = Math.PI / 2;
    rightArm.rotation.x = Math.PI / 4;
    rightArm.position = new Vector3(0.5, 0.8, 0);
    rightArm.parent = parent;
    rightArm.material = bodyMat;

    // Legs
    const leftLeg = MeshBuilder.CreateCylinder('leftLeg', { height: 0.5, diameter: 0.2 }, this.scene);
    leftLeg.position = new Vector3(-0.15, 0.25, 0);
    leftLeg.parent = parent;
    leftLeg.material = bodyMat;

    const rightLeg = MeshBuilder.CreateCylinder('rightLeg', { height: 0.5, diameter: 0.2 }, this.scene);
    rightLeg.position = new Vector3(0.15, 0.25, 0);
    rightLeg.parent = parent;
    rightLeg.material = bodyMat;

    // Head with texture
    const head = MeshBuilder.CreateSphere('enemyHead', { diameter: 1.2 }, this.scene);
    head.position.y = 1.6;
    head.parent = parent;

    const headMat = new StandardMaterial('enemyHeadMat', this.scene);
    const headTexture = new Texture('/head.png', this.scene, false, false);
    headTexture.hasAlpha = true;
    headMat.diffuseTexture = headTexture;
    headMat.specularColor = new Color3(0.1, 0.1, 0.1);
    headMat.emissiveColor = new Color3(0.1, 0.1, 0.1);
    head.material = headMat;

    // Physics
    const enemyAggregate = new PhysicsAggregate(
      parent,
      PhysicsShapeType.CAPSULE,
      { mass: PHYSICS.ENEMY_MASS, restitution: PHYSICS.RESTITUTION.PLAYER, friction: PHYSICS.FRICTION },
      this.scene
    );
    enemyAggregate.body.setAngularDamping(PHYSICS.ANGULAR_DAMPING);
    enemyAggregate.body.setLinearDamping(PHYSICS.LINEAR_DAMPING);

    parent.getChildMeshes().forEach((mesh: AbstractMesh) => this.shadowGenerator.addShadowCaster(mesh));

    return parent;
  }

  private createHumanoidModel(radiusMultiplier: number, heightMultiplier: number): Mesh {
    const parent = MeshBuilder.CreateBox('humanoid', { size: 0.01 }, this.scene);
    const size = this.customization.size;

    // Head
    const head = MeshBuilder.CreateSphere('head', { diameter: 0.4 * size }, this.scene);
    head.position.y = 1.7 * heightMultiplier * size;
    head.parent = parent;

    const faceMat = new PBRMaterial('faceMat', this.scene);
    faceMat.albedoTexture = this.createFaceTexture();
    faceMat.roughness = 0.6;
    faceMat.metallic = 0;
    head.material = faceMat;

    // Neck
    const neck = MeshBuilder.CreateCylinder('neck', { height: 0.15 * size, diameter: 0.15 * radiusMultiplier * size }, this.scene);
    neck.position.y = 1.5 * heightMultiplier * size;
    neck.parent = parent;

    // Torso
    const torso = MeshBuilder.CreateCylinder('torso', {
      height: 0.6 * heightMultiplier * size,
      diameterTop: 0.5 * radiusMultiplier * size,
      diameterBottom: 0.45 * radiusMultiplier * size,
    }, this.scene);
    torso.position.y = 1.1 * heightMultiplier * size;
    torso.parent = parent;

    // Pelvis
    const pelvis = MeshBuilder.CreateCylinder('pelvis', { height: 0.2 * size, diameter: 0.45 * radiusMultiplier * size }, this.scene);
    pelvis.position.y = 0.7 * heightMultiplier * size;
    pelvis.parent = parent;

    // Arms
    this.createArmPair(parent, radiusMultiplier, heightMultiplier, size);

    // Legs
    this.createLegPair(parent, radiusMultiplier, heightMultiplier, size);

    parent.getChildMeshes().forEach((mesh: AbstractMesh) => this.shadowGenerator.addShadowCaster(mesh));

    return parent;
  }

  private createArmPair(parent: Mesh, radiusMultiplier: number, heightMultiplier: number, size: number): void {
    const armHeight = 0.35 * size;
    const armDiameter = 0.12 * radiusMultiplier * size;
    const forearmHeight = 0.3 * size;
    const forearmDiameter = 0.1 * radiusMultiplier * size;
    const handDiameter = 0.1 * size;
    const yPos = 1.25 * heightMultiplier * size;

    // Left arm
    const leftUpperArm = MeshBuilder.CreateCylinder('leftUpperArm', { height: armHeight, diameter: armDiameter }, this.scene);
    leftUpperArm.rotation.z = Math.PI / 2;
    leftUpperArm.position = new Vector3(-0.35 * radiusMultiplier * size, yPos, 0);
    leftUpperArm.parent = parent;

    const leftForearm = MeshBuilder.CreateCylinder('leftForearm', { height: forearmHeight, diameter: forearmDiameter }, this.scene);
    leftForearm.rotation.z = Math.PI / 2;
    leftForearm.position = new Vector3(-0.65 * radiusMultiplier * size, yPos, 0);
    leftForearm.parent = parent;

    const leftHand = MeshBuilder.CreateSphere('leftHand', { diameter: handDiameter }, this.scene);
    leftHand.position = new Vector3(-0.8 * radiusMultiplier * size, yPos, 0);
    leftHand.parent = parent;

    // Right arm
    const rightUpperArm = MeshBuilder.CreateCylinder('rightUpperArm', { height: armHeight, diameter: armDiameter }, this.scene);
    rightUpperArm.rotation.z = Math.PI / 2;
    rightUpperArm.position = new Vector3(0.35 * radiusMultiplier * size, yPos, 0);
    rightUpperArm.parent = parent;

    const rightForearm = MeshBuilder.CreateCylinder('rightForearm', { height: forearmHeight, diameter: forearmDiameter }, this.scene);
    rightForearm.rotation.z = Math.PI / 2;
    rightForearm.position = new Vector3(0.65 * radiusMultiplier * size, yPos, 0);
    rightForearm.parent = parent;

    const rightHand = MeshBuilder.CreateSphere('rightHand', { diameter: handDiameter }, this.scene);
    rightHand.position = new Vector3(0.8 * radiusMultiplier * size, yPos, 0);
    rightHand.parent = parent;
  }

  private createLegPair(parent: Mesh, radiusMultiplier: number, heightMultiplier: number, size: number): void {
    const thighHeight = 0.45 * heightMultiplier * size;
    const thighDiameter = 0.18 * radiusMultiplier * size;
    const shinHeight = 0.4 * heightMultiplier * size;
    const shinDiameter = 0.14 * radiusMultiplier * size;
    const footSize = { width: 0.15 * size, height: 0.1 * size, depth: 0.25 * size };
    const xOffset = 0.12 * radiusMultiplier * size;

    // Left leg
    const leftThigh = MeshBuilder.CreateCylinder('leftThigh', { height: thighHeight, diameter: thighDiameter }, this.scene);
    leftThigh.position = new Vector3(-xOffset, 0.35 * heightMultiplier * size, 0);
    leftThigh.parent = parent;

    const leftShin = MeshBuilder.CreateCylinder('leftShin', { height: shinHeight, diameter: shinDiameter }, this.scene);
    leftShin.position = new Vector3(-xOffset, -0.15 * heightMultiplier * size, 0);
    leftShin.parent = parent;

    const leftFoot = MeshBuilder.CreateBox('leftFoot', footSize, this.scene);
    leftFoot.position = new Vector3(-xOffset, -0.4 * heightMultiplier * size, 0.05 * size);
    leftFoot.parent = parent;

    // Right leg
    const rightThigh = MeshBuilder.CreateCylinder('rightThigh', { height: thighHeight, diameter: thighDiameter }, this.scene);
    rightThigh.position = new Vector3(xOffset, 0.35 * heightMultiplier * size, 0);
    rightThigh.parent = parent;

    const rightShin = MeshBuilder.CreateCylinder('rightShin', { height: shinHeight, diameter: shinDiameter }, this.scene);
    rightShin.position = new Vector3(xOffset, -0.15 * heightMultiplier * size, 0);
    rightShin.parent = parent;

    const rightFoot = MeshBuilder.CreateBox('rightFoot', footSize, this.scene);
    rightFoot.position = new Vector3(xOffset, -0.4 * heightMultiplier * size, 0.05 * size);
    rightFoot.parent = parent;
  }

  private createFaceTexture(): DynamicTexture {
    const size = RENDERING.DYNAMIC_TEXTURE_SIZE;
    const texture = new DynamicTexture('faceTexture', size, this.scene, false);
    const ctx = texture.getContext();

    // Skin background
    ctx.fillStyle = '#ffdbac';
    ctx.fillRect(0, 0, size, size);

    // Eyes
    this.drawEye(ctx, 180, 200);
    this.drawEye(ctx, 332, 200);

    // Eyebrows
    ctx.strokeStyle = '#3a2010';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(140, 160);
    ctx.quadraticCurveTo(180, 150, 220, 160);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(292, 160);
    ctx.quadraticCurveTo(332, 150, 372, 160);
    ctx.stroke();

    // Nose
    ctx.strokeStyle = '#d4a574';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(256, 220);
    ctx.lineTo(256, 280);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(240, 290, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(272, 290, 8, 0, Math.PI * 2);
    ctx.stroke();

    // Mouth
    ctx.strokeStyle = '#8b4513';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(200, 340);
    ctx.quadraticCurveTo(256, 370, 312, 340);
    ctx.stroke();

    ctx.strokeStyle = '#c48b6b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(210, 335);
    ctx.quadraticCurveTo(256, 345, 302, 335);
    ctx.stroke();

    texture.update();
    return texture;
  }

  private drawEye(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const isLeft = x < 256;

    // Eye white
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(x, y, 40, 30, 0, 0, Math.PI * 2);
    ctx.fill();

    // Iris
    ctx.fillStyle = '#4a3020';
    ctx.beginPath();
    ctx.arc(isLeft ? x + 10 : x - 10, y, 18, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(isLeft ? x + 15 : x - 15, y, 10, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(isLeft ? x + 20 : x - 20, y - 5, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  private createPlayer(): void {
    const bodyType = BODY_TYPES[this.customization.bodyType];
    const radiusMultiplier = bodyType.radius;
    const heightMultiplier = bodyType.height;

    this.player = this.createHumanoidModel(radiusMultiplier, heightMultiplier);
    this.player.position = new Vector3(SPAWN_POSITIONS.PLAYER.x, SPAWN_POSITIONS.PLAYER.y, SPAWN_POSITIONS.PLAYER.z);

    // Apply customization color
    const hexToColor3 = (hex: string): Color3 => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return new Color3(r, g, b);
    };

    const charType = CHARACTER_TYPES[this.customization.characterType];
    const playerMat = new PBRMaterial('playerMat', this.scene);
    playerMat.albedoColor = hexToColor3(this.customization.color);
    playerMat.metallic = charType.metallic;
    playerMat.roughness = charType.roughness;
    playerMat.emissiveColor = new Color3(charType.emissive.r, charType.emissive.g, charType.emissive.b);

    this.player.getChildMeshes().forEach((mesh: AbstractMesh) => {
      if (mesh.name !== 'head') {
        mesh.material = playerMat;
      }
    });

    // Physics collision capsule
    const collisionCapsule = MeshBuilder.CreateCapsule('playerCollision', {
      height: PLAYER.COLLISION_HEIGHT * heightMultiplier * this.customization.size,
      radius: PLAYER.COLLISION_RADIUS * radiusMultiplier * this.customization.size,
    }, this.scene);
    collisionCapsule.isVisible = false;
    collisionCapsule.position = this.player.position.clone();
    collisionCapsule.parent = this.player;

    this.playerAggregate = new PhysicsAggregate(
      collisionCapsule,
      PhysicsShapeType.CAPSULE,
      { mass: PHYSICS.PLAYER_MASS, restitution: PHYSICS.RESTITUTION.PLAYER, friction: PHYSICS.FRICTION },
      this.scene
    );

    this.playerAggregate.body.setAngularDamping(PHYSICS.ANGULAR_DAMPING);
    this.playerAggregate.body.setLinearDamping(PHYSICS.LINEAR_DAMPING);
    this.playerAggregate.body.disablePreStep = false;

    this.shadowGenerator.addShadowCaster(this.player);
    this.camera.target = this.player.position;
  }

  // Texture creation methods
  private createGrassTexture(): DynamicTexture {
    const size = RENDERING.DYNAMIC_TEXTURE_SIZE;
    const texture = new DynamicTexture('grassTexture', size, this.scene, false);
    const ctx = texture.getContext();

    ctx.fillStyle = '#3a5a2a';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < RENDERING.GRASS_BLADE_COUNT; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const length = Math.random() * 3 + 1;
      const green = Math.floor(Math.random() * 50 + 100);

      ctx.strokeStyle = `rgb(${Math.floor(green * 0.3)}, ${green}, ${Math.floor(green * 0.4)})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.random() * 2 - 1, y - length);
      ctx.stroke();
    }

    texture.update();
    texture.uScale = TERRAIN.GRASS_TEXTURE_SCALE;
    texture.vScale = TERRAIN.GRASS_TEXTURE_SCALE;
    return texture;
  }

  private createGrassBumpTexture(): DynamicTexture {
    const size = RENDERING.DYNAMIC_TEXTURE_SIZE;
    const texture = new DynamicTexture('grassBump', size, this.scene, false);
    const ctx = texture.getContext();

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < RENDERING.BUMP_NOISE_COUNT; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const gray = Math.floor(Math.random() * 30 + 110);
      ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
      ctx.fillRect(x, y, 2, 2);
    }

    texture.update();
    texture.uScale = TERRAIN.GRASS_TEXTURE_SCALE;
    texture.vScale = TERRAIN.GRASS_TEXTURE_SCALE;
    return texture;
  }

  private createWoodTexture(): DynamicTexture {
    const size = RENDERING.DYNAMIC_TEXTURE_SIZE;
    const texture = new DynamicTexture('woodTexture', size, this.scene, false);
    const ctx = texture.getContext();

    ctx.fillStyle = '#4a3020';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < RENDERING.WOOD_PATTERN_COUNT; i++) {
      const y = Math.random() * size;
      const brown = Math.floor(Math.random() * 30 + 40);
      ctx.strokeStyle = `rgba(${brown}, ${Math.floor(brown * 0.6)}, ${Math.floor(brown * 0.3)}, 0.5)`;
      ctx.lineWidth = Math.random() * 3 + 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(128, y + Math.random() * 20 - 10, 384, y + Math.random() * 20 - 10, size, y);
      ctx.stroke();
    }

    texture.update();
    texture.uScale = TERRAIN.WOOD_TEXTURE_U_SCALE;
    texture.vScale = TERRAIN.WOOD_TEXTURE_V_SCALE;
    return texture;
  }

  private createWoodBumpTexture(): DynamicTexture {
    const size = RENDERING.DYNAMIC_TEXTURE_SIZE;
    const texture = new DynamicTexture('woodBump', size, this.scene, false);
    const ctx = texture.getContext();

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 50; i++) {
      const y = Math.random() * size;
      ctx.strokeStyle = `rgba(${150 + Math.random() * 40}, ${150 + Math.random() * 40}, ${150 + Math.random() * 40}, 0.8)`;
      ctx.lineWidth = Math.random() * 5 + 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(128, y + Math.random() * 30 - 15, 384, y + Math.random() * 30 - 15, size, y);
      ctx.stroke();
    }

    texture.update();
    texture.uScale = TERRAIN.WOOD_TEXTURE_U_SCALE;
    texture.vScale = TERRAIN.WOOD_TEXTURE_V_SCALE;
    return texture;
  }

  private createLeavesTexture(): DynamicTexture {
    const size = RENDERING.DYNAMIC_TEXTURE_SIZE;
    const texture = new DynamicTexture('leavesTexture', size, this.scene, false);
    const ctx = texture.getContext();

    ctx.fillStyle = '#1a4a1a';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < RENDERING.LEAVES_PATTERN_COUNT; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const green = Math.floor(Math.random() * 80 + 60);
      ctx.fillStyle = `rgba(${Math.floor(green * 0.2)}, ${green}, ${Math.floor(green * 0.3)}, 0.7)`;
      ctx.beginPath();
      ctx.arc(x, y, Math.random() * 3 + 1, 0, Math.PI * 2);
      ctx.fill();
    }

    texture.update();
    texture.uScale = TERRAIN.LEAVES_TEXTURE_SCALE;
    texture.vScale = TERRAIN.LEAVES_TEXTURE_SCALE;
    return texture;
  }

  private createStoneTexture(): DynamicTexture {
    const size = RENDERING.DYNAMIC_TEXTURE_SIZE;
    const texture = new DynamicTexture('stoneTexture', size, this.scene, false);
    const ctx = texture.getContext();

    ctx.fillStyle = '#606070';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < RENDERING.STONE_PATTERN_COUNT; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const s = Math.random() * 15 + 5;
      const gray = Math.floor(Math.random() * 40 + 70);
      ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray + 10}, 0.6)`;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < RENDERING.STONE_CRACK_COUNT; i++) {
      const x1 = Math.random() * size;
      const y1 = Math.random() * size;
      const x2 = x1 + Math.random() * 100 - 50;
      const y2 = y1 + Math.random() * 100 - 50;
      ctx.strokeStyle = 'rgba(40, 40, 45, 0.8)';
      ctx.lineWidth = Math.random() * 2 + 0.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    texture.update();
    texture.uScale = TERRAIN.STONE_TEXTURE_SCALE;
    texture.vScale = TERRAIN.STONE_TEXTURE_SCALE;
    return texture;
  }

  private createStoneBumpTexture(): DynamicTexture {
    const size = RENDERING.DYNAMIC_TEXTURE_SIZE;
    const texture = new DynamicTexture('stoneBump', size, this.scene, false);
    const ctx = texture.getContext();

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 200; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const s = Math.random() * 10 + 3;
      const gray = Math.floor(Math.random() * 60 + 100);
      ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }

    texture.update();
    texture.uScale = TERRAIN.STONE_TEXTURE_SCALE;
    texture.vScale = TERRAIN.STONE_TEXTURE_SCALE;
    return texture;
  }

  private setupControls(): void {
    this.scene.onBeforeRenderObservable.add(() => {
      if (!this.player) return;

      if (this.isMounted && this.mountedVehicle) {
        this.updateVehicleControls();
      } else {
        this.updatePlayerControls();
      }

      this.updateEnemies();
      this.updateUI();
    });

    // Add event listeners with bound handlers for cleanup
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
  }

  private updateVehicleControls(): void {
    if (!this.mountedVehicle) return;

    const vehicle = this.mountedVehicle;
    const vehicleSpeed = vehicle.speed;
    const turnSpeed = vehicle.turnSpeed;

    const physicsBody = vehicle.mesh.physicsBody;
    const currentVelocity = physicsBody?.parent?.getLinearVelocity();
    const currentY = currentVelocity?.y ?? 0;

    // Forward/backward
    if (this.inputMap['w'] || this.inputMap['W']) {
      const forward = this.vec3Pool.getWith(0, 0, 1);
      if (physicsBody?.parent) {
        physicsBody.parent.setLinearVelocity(new Vector3(
          forward.x * vehicleSpeed,
          currentY,
          forward.z * vehicleSpeed
        ));
      }
      this.vec3Pool.release(forward);
    }

    if (this.inputMap['s'] || this.inputMap['S']) {
      if (physicsBody?.parent) {
        physicsBody.parent.setLinearVelocity(new Vector3(
          0,
          currentY,
          -vehicleSpeed * VEHICLE.REVERSE_SPEED_MULTIPLIER
        ));
      }
    }

    // Turn
    if (this.inputMap['a'] || this.inputMap['A']) {
      vehicle.mesh.rotation.y += turnSpeed;
    }
    if (this.inputMap['d'] || this.inputMap['D']) {
      vehicle.mesh.rotation.y -= turnSpeed;
    }

    // Hide player above vehicle
    this.player.position.set(
      vehicle.mesh.position.x,
      vehicle.mesh.position.y + 10,
      vehicle.mesh.position.z
    );

    // Third-person camera
    this.camera.position.set(
      vehicle.mesh.position.x,
      vehicle.mesh.position.y + VEHICLE.CAMERA_OFFSET_Y,
      vehicle.mesh.position.z + VEHICLE.CAMERA_OFFSET_Z
    );
    this.camera.setTarget(vehicle.mesh.position);
  }

  private updatePlayerControls(): void {
    const speed = PLAYER.MOVE_SPEED;

    // Reset move vector instead of creating new one
    this.moveVector.set(0, 0, 0);

    if (this.inputMap['w'] || this.inputMap['W']) {
      this.camera.getDirection(Vector3.Forward()).scaleToRef(1, this.tempVector);
      this.tempVector.y = 0;
      this.tempVector.normalize();
      this.moveVector.addInPlace(this.tempVector.scale(speed));
    }

    if (this.inputMap['s'] || this.inputMap['S']) {
      this.camera.getDirection(Vector3.Backward()).scaleToRef(1, this.tempVector);
      this.tempVector.y = 0;
      this.tempVector.normalize();
      this.moveVector.addInPlace(this.tempVector.scale(speed));
    }

    if (this.inputMap['a'] || this.inputMap['A']) {
      this.camera.getDirection(Vector3.Left()).scaleToRef(1, this.tempVector);
      this.tempVector.y = 0;
      this.tempVector.normalize();
      this.moveVector.addInPlace(this.tempVector.scale(speed));
    }

    if (this.inputMap['d'] || this.inputMap['D']) {
      this.camera.getDirection(Vector3.Right()).scaleToRef(1, this.tempVector);
      this.tempVector.y = 0;
      this.tempVector.normalize();
      this.moveVector.addInPlace(this.tempVector.scale(speed));
    }

    if (this.moveVector.length() > 0 && this.playerAggregate) {
      const velocity = this.playerAggregate.body.getLinearVelocity();
      this.playerAggregate.body.setLinearVelocity(new Vector3(
        this.moveVector.x,
        velocity.y,
        this.moveVector.z
      ));
    }

    // Jump
    if (this.inputMap[' '] && this.playerAggregate) {
      const velocity = this.playerAggregate.body.getLinearVelocity();
      if (velocity && Math.abs(velocity.y) < PLAYER.JUMP_VELOCITY_THRESHOLD && this.player.position.y < PLAYER.MAX_JUMP_HEIGHT) {
        this.playerAggregate.body.applyImpulse(new Vector3(0, PLAYER.JUMP_FORCE, 0), this.player.position);
        this.inputMap[' '] = false;
      }
    }

    // FPS camera
    const eyeHeight = PLAYER.EYE_HEIGHT * this.customization.size;
    this.camera.position.set(
      this.player.position.x,
      this.player.position.y + eyeHeight,
      this.player.position.z
    );
  }

  private updateEnemies(): void {
    if (!this.player) return;

    const deltaTime = this.engine.getDeltaTime() / 1000;
    const playerPos = this.player.position;

    for (const enemy of this.enemies) {
      const enemyPos = enemy.mesh.position;
      const distanceToPlayer = Vector3.Distance(enemyPos, playerPos);

      // State transition
      if (distanceToPlayer < enemy.detectionRange) {
        enemy.state = 'chase';
      } else if (distanceToPlayer > enemy.detectionRange * ENEMY.DETECTION_RELEASE_MULTIPLIER) {
        enemy.state = 'patrol';
      }

      if (enemy.state === 'chase') {
        this.updateEnemyChase(enemy, playerPos, enemyPos);
      } else {
        this.updateEnemyPatrol(enemy, enemyPos, deltaTime);
      }

      this.animateEnemyHead(enemy);
    }
  }

  private updateEnemyChase(enemy: Enemy, playerPos: Vector3, enemyPos: Vector3): void {
    // Use pooled vector
    const direction = this.vec3Pool.get();
    playerPos.subtractToRef(enemyPos, direction);
    direction.y = 0;
    direction.normalize();

    enemy.mesh.rotation.y = Math.atan2(direction.x, direction.z);

    const physicsBody = enemy.mesh.physicsBody;
    if (physicsBody) {
      const currentVelocity = physicsBody.getLinearVelocity();
      physicsBody.setLinearVelocity(new Vector3(
        direction.x * enemy.chaseSpeed,
        currentVelocity.y,
        direction.z * enemy.chaseSpeed
      ));
    }

    this.vec3Pool.release(direction);

    // Animate arms using cached refs
    const time = Date.now() * ENEMY.ARM_CHASE_ANIMATION_SPEED;
    if (enemy.meshRefs.leftArm) {
      enemy.meshRefs.leftArm.rotation.x = Math.PI / 4 + Math.sin(time) * ENEMY.ARM_CHASE_SWING;
    }
    if (enemy.meshRefs.rightArm) {
      enemy.meshRefs.rightArm.rotation.x = Math.PI / 4 + Math.cos(time) * ENEMY.ARM_CHASE_SWING;
    }
  }

  private updateEnemyPatrol(enemy: Enemy, enemyPos: Vector3, deltaTime: number): void {
    enemy.patrolAngle += deltaTime * ENEMY.PATROL_ROTATION_SPEED;

    const patrolX = enemy.initialPosition.x + Math.cos(enemy.patrolAngle) * enemy.patrolRadius;
    const patrolZ = enemy.initialPosition.z + Math.sin(enemy.patrolAngle) * enemy.patrolRadius;

    const direction = this.vec3Pool.getWith(patrolX - enemyPos.x, 0, patrolZ - enemyPos.z);
    direction.normalize();

    enemy.mesh.rotation.y = Math.atan2(direction.x, direction.z);

    const physicsBody = enemy.mesh.physicsBody;
    if (physicsBody) {
      const currentVelocity = physicsBody.getLinearVelocity();
      physicsBody.setLinearVelocity(new Vector3(
        direction.x * enemy.speed,
        currentVelocity.y,
        direction.z * enemy.speed
      ));
    }

    this.vec3Pool.release(direction);

    // Animate arms
    const time = Date.now() * ENEMY.ARM_PATROL_ANIMATION_SPEED;
    if (enemy.meshRefs.leftArm) {
      enemy.meshRefs.leftArm.rotation.x = Math.PI / 4 + Math.sin(time) * ENEMY.ARM_PATROL_SWING;
    }
    if (enemy.meshRefs.rightArm) {
      enemy.meshRefs.rightArm.rotation.x = Math.PI / 4 + Math.cos(time) * ENEMY.ARM_PATROL_SWING;
    }
  }

  private animateEnemyHead(enemy: Enemy): void {
    const head = enemy.meshRefs.head;
    if (head) {
      const bobTime = Date.now() * ENEMY.HEAD_BOB_SPEED;
      head.rotation.y = Math.sin(bobTime) * ENEMY.HEAD_SWING_Y;
      head.rotation.x = Math.sin(bobTime * 1.3) * ENEMY.HEAD_SWING_X;
      head.position.y = 1.6 + Math.sin(bobTime * 2) * ENEMY.HEAD_BOB_HEIGHT;
    }
  }

  private updateUI(): void {
    const { fps, position } = this.domElements;

    if (fps) {
      fps.textContent = this.engine.getFps().toFixed(0);
    }

    if (position && this.player) {
      const pos = this.player.position;
      position.textContent = `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
    }

    this.updateSurvivalStats();
  }

  private updateSurvivalStats(): void {
    const deltaTime = this.engine.getDeltaTime() / 1000;

    // Decay stats
    this.playerStats.hunger = Math.max(0, this.playerStats.hunger - deltaTime * SURVIVAL.HUNGER_DECAY_RATE);
    this.playerStats.thirst = Math.max(0, this.playerStats.thirst - deltaTime * SURVIVAL.THIRST_DECAY_RATE);

    // Stamina
    const velocity = this.playerAggregate?.body.getLinearVelocity();
    if (velocity && (Math.abs(velocity.x) > SURVIVAL.VELOCITY_THRESHOLD || Math.abs(velocity.z) > SURVIVAL.VELOCITY_THRESHOLD)) {
      this.playerStats.stamina = Math.max(0, this.playerStats.stamina - deltaTime * SURVIVAL.STAMINA_DRAIN_RATE);
    } else {
      this.playerStats.stamina = Math.min(100, this.playerStats.stamina + deltaTime * SURVIVAL.STAMINA_REGEN_RATE);
    }

    // Starvation damage
    if (this.playerStats.hunger <= 0 || this.playerStats.thirst <= 0) {
      this.playerStats.health = Math.max(0, this.playerStats.health - deltaTime * SURVIVAL.STARVATION_DAMAGE_RATE);
    }

    // Update UI bars using cached elements
    const { healthBar, staminaBar, hungerBar, thirstBar, healthText, staminaText, hungerText, thirstText, time } = this.domElements;

    if (healthBar) healthBar.style.width = `${this.playerStats.health}%`;
    if (staminaBar) staminaBar.style.width = `${this.playerStats.stamina}%`;
    if (hungerBar) hungerBar.style.width = `${this.playerStats.hunger}%`;
    if (thirstBar) thirstBar.style.width = `${this.playerStats.thirst}%`;

    if (healthText) healthText.textContent = this.playerStats.health.toFixed(0);
    if (staminaText) staminaText.textContent = this.playerStats.stamina.toFixed(0);
    if (hungerText) hungerText.textContent = this.playerStats.hunger.toFixed(0);
    if (thirstText) thirstText.textContent = this.playerStats.thirst.toFixed(0);

    // Time system
    this.dayTime += deltaTime * TIME.DAY_CYCLE_SPEED;
    const dayPhase = (this.dayTime % TIME.DAY_CYCLE_LENGTH) / TIME.DAY_CYCLE_LENGTH;

    if (time) {
      if (dayPhase < TIME.DAWN_THRESHOLD) {
        time.textContent = '🌅 새벽';
      } else if (dayPhase < TIME.DAY_THRESHOLD) {
        time.textContent = '☀️ 낮';
      } else if (dayPhase < TIME.DUSK_THRESHOLD) {
        time.textContent = '🌆 저녁';
      } else {
        time.textContent = '🌙 밤';
      }
    }
  }

  private hideLoading(): void {
    const { loading, ui, controls } = this.domElements;

    if (loading) loading.classList.add('hidden');
    if (ui) ui.classList.remove('hidden');
    if (controls) controls.classList.remove('hidden');
  }

  private startRenderLoop(): void {
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });

    window.addEventListener('resize', this.boundResize);
  }
}

// Start game
new Game();
