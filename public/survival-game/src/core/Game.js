// Game - 메인 게임 클래스 (리팩토링된 버전)

import { AudioManager } from '../managers/AudioManager.js';
import { EffectManager } from '../managers/EffectManager.js';
import { UIManager } from '../managers/UIManager.js';
import { ModelManager } from '../managers/ModelManager.js';
import { RemotePlayerManager } from '../managers/RemotePlayerManager.js';
import { NetworkEnemySync } from '../managers/NetworkEnemySync.js';
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

    // Multiplayer state
    this.isMultiplayer = false;
    this.networkClient = null;
    this.networkPlayerId = null;
    this.networkSendInterval = null;
    this.remotePlayerManager = null;
    this.networkEnemySync = null;

    // 매니저 초기화
    this.audioManager = new AudioManager();
    this.effectManager = new EffectManager(this);
    this.uiManager = new UIManager(this);
    this.modelManager = new ModelManager(this);

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

    // 3D 모델 프리로드 (선택적 - 모델 파일이 있을 경우)
    await this.preloadModels();

    this.terrainSystem.createProceduralTerrain();
    this.playerSystem.createPlayer();
    this.weaponSystem.createGun();
    this.enemySystem.spawnInitialEnemies();
    this.setupControls();
    this.uiManager.hideLoading();
    this.startRenderLoop();
  }

  async preloadModels() {
    // 사용할 모델들을 미리 로드 (실패해도 게임은 계속됨)
    const modelsToLoad = [
      'tree', 'tree_pine',
      'building_house', 'building_apartment', 'building_tower',
      'vehicle_car', 'vehicle_tank', 'vehicle_helicopter'
    ];

    try {
      await this.modelManager.preloadModels(modelsToLoad);
    } catch (error) {
      console.log('일부 모델 로드 실패 - 기본 프리미티브 사용');
    }
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

      // 적 AI (only in singleplayer; multiplayer uses server-authoritative enemies)
      if (!this.isMultiplayer) {
        this.enemySystem.update(deltaTime);
      } else {
        // Interpolate remote players and server enemies
        if (this.remotePlayerManager) this.remotePlayerManager.interpolate(deltaTime);
        if (this.networkEnemySync) this.networkEnemySync.interpolate(deltaTime);
      }

      // Send shoot action to server in multiplayer
      if (this.isMultiplayer && this.isMouseDown && this.networkClient) {
        const forward = this.camera.getDirection(BABYLON.Vector3.Forward());
        this.networkClient.sendAction('shoot', {
          origin: {
            x: this.camera.position.x,
            y: this.camera.position.y,
            z: this.camera.position.z,
          },
          direction: { x: forward.x, y: forward.y, z: forward.z },
          weaponType: this.weaponSystem.currentWeapon?.name || 'pistol',
        });
      }

      // UI
      this.uiManager.updateUI();
    });
  }

  // ---- Multiplayer ----

  initMultiplayer(gameClient) {
    this.isMultiplayer = true;
    this.networkClient = gameClient;
    this.networkPlayerId = gameClient.playerId;

    // Initialize remote player and enemy sync managers
    this.remotePlayerManager = new RemotePlayerManager(this);
    this.networkEnemySync = new NetworkEnemySync(this);

    // Listen for server events
    gameClient.on('gameState', (data) => this.onNetworkState(data));
    gameClient.on('gameEvent', (data) => this.onNetworkEvent(data));
    gameClient.on('gameEnd', (data) => this.onNetworkGameEnd(data));

    // Send local state to server at 15Hz
    this.networkSendInterval = setInterval(() => {
      if (!this.collisionCapsule || !this.networkClient) return;
      const pos = this.collisionCapsule.position;
      const rot = this.camera ? this.camera.rotation : { x: 0, y: 0, z: 0 };
      const isMoving = this.inputMap['w'] || this.inputMap['a'] || this.inputMap['s'] || this.inputMap['d'];
      const isRunning = isMoving && this.inputMap['shift'];

      this.networkClient.sendInput({
        position: { x: pos.x, y: pos.y, z: pos.z },
        rotation: { x: rot.x, y: rot.y, z: rot.z },
        animation: isRunning ? 'run' : isMoving ? 'walk' : 'idle',
        stamina: this.playerStats.stamina,
      });
    }, 66); // ~15Hz
  }

  onNetworkState(data) {
    if (!data) return;

    // Update remote players
    if (data.players && this.remotePlayerManager) {
      this.remotePlayerManager.updateFromServer(data.players);
    }

    // In multiplayer, enemies come from server
    if (data.enemies && this.networkEnemySync) {
      this.networkEnemySync.updateFromServer(data.enemies);
    }

    // Update local player stats from server
    if (data.players && data.players[this.networkPlayerId]) {
      const myState = data.players[this.networkPlayerId];
      this.playerStats.health = myState.health;
      this.playerStats.hunger = myState.hunger;
      this.playerStats.thirst = myState.thirst;
    }

    // Update day time
    if (typeof data.dayTime === 'number') {
      this.dayTime = data.dayTime;
    }
  }

  onNetworkEvent(data) {
    if (!data) return;

    if (data.type === 'player_shoot' && data.playerId !== this.networkPlayerId) {
      // Show remote player's shot effect
      if (data.origin && data.direction) {
        const origin = new BABYLON.Vector3(data.origin.x, data.origin.y, data.origin.z);
        const dir = new BABYLON.Vector3(data.direction.x, data.direction.y, data.direction.z);
        this.weaponSystem.createMatrixBullet(origin, dir, 'remote');
      }
    }

    if (data.type === 'enemy_killed') {
      // Play kill effect
      if (this.networkEnemySync) {
        const entry = this.networkEnemySync.serverEnemies.get(data.enemyId);
        if (entry && entry.mesh) {
          this.effectManager.createBulletImpact(entry.mesh.position);
        }
      }
    }

    if (data.type === 'enemy_shoot' && data.targetId === this.networkPlayerId) {
      this.effectManager.showDamageEffect();
      this.effectManager.createShootShake();
    }

    if (data.type === 'player_died' && data.playerId === this.networkPlayerId) {
      this.uiManager.gameOver();
    }

    if (data.type === 'grenade' && data.position) {
      const pos = new BABYLON.Vector3(data.position.x, data.position.y, data.position.z);
      this.effectManager.createExplosion(
        pos, data.radius || 8, 0, [], this.playerStats, this.collisionCapsule,
        () => this.uiManager.gameOver(),
      );
    }
  }

  onNetworkGameEnd(data) {
    this.uiManager.gameOver();
  }

  stopMultiplayer() {
    if (this.networkSendInterval) {
      clearInterval(this.networkSendInterval);
      this.networkSendInterval = null;
    }
    if (this.networkClient) {
      this.networkClient.off('gameState');
      this.networkClient.off('gameEvent');
      this.networkClient.off('gameEnd');
    }
    if (this.remotePlayerManager) {
      this.remotePlayerManager.destroy();
      this.remotePlayerManager = null;
    }
    if (this.networkEnemySync) {
      this.networkEnemySync.destroy();
      this.networkEnemySync = null;
    }
    this.isMultiplayer = false;
    this.networkClient = null;
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
