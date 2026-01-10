// Game - 메인 게임 클래스 (리팩토링된 버전)

import { AudioManager } from '../managers/AudioManager.js';
import { EffectManager } from '../managers/EffectManager.js';
import { UIManager } from '../managers/UIManager.js';
import { WeaponSystem } from '../systems/WeaponSystem.js';
import { EnemySystem } from '../systems/EnemySystem.js';
import { VehicleSystem } from '../systems/VehicleSystem.js';
import { TerrainSystem } from '../systems/TerrainSystem.js';
import { PlayerSystem } from '../systems/PlayerSystem.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('renderCanvas');
    this.engine = new BABYLON.Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    this.playerStats = {
      health: 100,
      stamina: 100,
      hunger: 100,
      thirst: 100
    };

    this.dayTime = 0;
    this.isPointerLocked = false;
    this.customization = {
      characterType: 'default',
      color: '#9966ff',
      size: 1.0,
      bodyType: 'normal'
    };

    this.inputMap = {};
    this.isFirstPerson = true;
    this.isMouseDown = false;

    // 매니저 초기화
    this.audioManager = new AudioManager();
    this.effectManager = new EffectManager(this);
    this.uiManager = new UIManager(this);

    // 시스템 초기화
    this.weaponSystem = new WeaponSystem(this);
    this.enemySystem = new EnemySystem(this);
    this.vehicleSystem = new VehicleSystem(this);
    this.terrainSystem = new TerrainSystem(this);
    this.playerSystem = new PlayerSystem(this);

    // enemies 참조 (하위 호환성)
    this.enemies = this.enemySystem.enemies;

    this.uiManager.setupMenu();
  }

  async init() {
    this.setupKeyboardEvents();
    this.audioManager.init();

    await this.createScene();
    this.terrainSystem.createProceduralTerrain();
    this.playerSystem.createPlayer();
    this.weaponSystem.createGun();
    this.enemySystem.spawnInitialEnemies();
    this.setupControls();
    this.uiManager.hideLoading();
    this.startRenderLoop();
  }

  async createScene() {
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.5, 0.8, 0.9, 1);

    const havokInstance = await HavokPhysics();
    const havokPlugin = new BABYLON.HavokPlugin(true, havokInstance);
    this.scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), havokPlugin);

    this.camera = new BABYLON.UniversalCamera('camera', new BABYLON.Vector3(0, 1.6, -5), this.scene);
    this.camera.setTarget(BABYLON.Vector3.Zero());
    this.camera.attachControl(this.canvas, true);

    this.camera.keysUp = [];
    this.camera.keysDown = [];
    this.camera.keysLeft = [];
    this.camera.keysRight = [];

    this.camera.angularSensibility = 800;
    this.camera.speed = 0;
    this.camera.inertia = 0.5;
    this.camera.minZ = 0.01;
    this.camera.maxZ = 1000;

    this.canvas.addEventListener('click', () => {
      this.canvas.focus();
      if (!this.isPointerLocked) {
        this.canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
      if (this.isPointerLocked) {
        this.canvas.focus();
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isMouseDown = true;
      }
      if (e.button === 2) {
        this.weaponSystem.isAiming = true;
      }
    });
    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isMouseDown = false;
      }
      if (e.button === 2) {
        this.weaponSystem.isAiming = false;
      }
    });
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    const hemisphericLight = new BABYLON.HemisphericLight('hemiLight', new BABYLON.Vector3(0, 1, 0), this.scene);
    hemisphericLight.intensity = 0.5;
    hemisphericLight.groundColor = new BABYLON.Color3(0.3, 0.4, 0.3);

    const sunLight = new BABYLON.DirectionalLight('sunLight', new BABYLON.Vector3(-1, -2, -1), this.scene);
    sunLight.position = new BABYLON.Vector3(50, 100, 50);
    sunLight.intensity = 1.2;

    this.shadowGenerator = new BABYLON.ShadowGenerator(2048, sunLight);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 32;

    this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.003;
    this.scene.fogColor = new BABYLON.Color3(0.6, 0.7, 0.8);
  }

  setupKeyboardEvents() {
    const self = this;

    const handleKeyDown = function(e) {
      const key = e.key.toLowerCase();
      self.inputMap[key] = true;

      if (e.key === ' ' || ['w', 'a', 's', 'd'].includes(key)) {
        e.preventDefault();
      }

      if (key === 'f') {
        self.engine.switchFullscreen(false);
      }

      if (key === 'r' && !self.weaponSystem.isReloading &&
          self.weaponSystem.currentWeapon.magazineAmmo < self.weaponSystem.currentWeapon.maxMagazine &&
          self.weaponSystem.currentWeapon.reserveAmmo > 0) {
        self.weaponSystem.reload();
      }

      if (key === 'v') {
        self.playerSystem.toggleViewMode();
      }

      if (key === 'b' && self.weaponSystem.currentWeapon.autoFire) {
        self.weaponSystem.isAutoFire = !self.weaponSystem.isAutoFire;
        console.log(self.weaponSystem.isAutoFire ? '연사 모드' : '단발 모드');
      }

      if (key === '1') self.weaponSystem.switchWeapon(0);
      if (key === '2') self.weaponSystem.switchWeapon(1);
      if (key === '3') self.weaponSystem.switchWeapon(2);
      if (key === '4') self.weaponSystem.switchWeapon(3);
      if (key === '5') self.weaponSystem.switchWeapon(4);
      if (key === '6') self.weaponSystem.switchWeapon(5);
      if (key === '7') self.weaponSystem.switchWeapon(6);
      if (key === '8') self.weaponSystem.switchWeapon(7);

      if (key === 'g' && self.weaponSystem.grenades > 0) {
        self.weaponSystem.throwGrenade();
      }

      if (key === 't') {
        self.vehicleSystem.toggleVehicleMount();
      }

      if (key === 'q') self.weaponSystem.switchWeapon((self.weaponSystem.currentWeaponIndex - 1 + self.weaponSystem.weapons.length) % self.weaponSystem.weapons.length);
      if (key === 'e') self.weaponSystem.switchWeapon((self.weaponSystem.currentWeaponIndex + 1) % self.weaponSystem.weapons.length);
    };

    const handleKeyUp = function(e) {
      const key = e.key.toLowerCase();
      self.inputMap[key] = false;
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);
    this.canvas.addEventListener('keydown', handleKeyDown, true);
    this.canvas.addEventListener('keyup', handleKeyUp, true);

    this.canvas.tabIndex = 1;
    this.canvas.focus();

    window.addEventListener('blur', () => {
      this.inputMap = {};
      this.isMouseDown = false;
    });

    this.canvas.addEventListener('click', () => {
      this.canvas.focus();
    });
  }

  setupControls() {
    this.scene.onBeforeRenderObservable.add(() => {
      if (!this.player || !this.playerAggregate) return;

      const deltaTime = this.engine.getDeltaTime() / 1000;

      // 플레이어 업데이트
      const { moveX, moveZ } = this.playerSystem.update(deltaTime);

      // 무기 업데이트
      this.weaponSystem.update(deltaTime, moveX, moveZ);

      // 지형 청크 업데이트
      this.terrainSystem.updateTerrainChunks(this.collisionCapsule.position);

      // 픽업 체크
      this.terrainSystem.checkAmmoPickups(this.collisionCapsule.position);
      this.terrainSystem.checkHealthPickups(this.collisionCapsule.position);
      this.terrainSystem.checkJumpPads(this.collisionCapsule.position);
      this.terrainSystem.checkExplosiveBarrels();

      // 탈것 조작
      this.vehicleSystem.updateVehicleControls(deltaTime);

      // 적 AI
      this.enemySystem.update(deltaTime);

      // UI
      this.uiManager.updateUI();
    });
  }

  startRenderLoop() {
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });

    window.addEventListener('resize', () => {
      this.engine.resize();
    });
  }
}
