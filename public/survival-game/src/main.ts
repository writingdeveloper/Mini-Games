import { Engine, Scene, UniversalCamera, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3, Color4, ActionManager, DirectionalLight, ShadowGenerator, PBRMaterial, Texture, CubeTexture, DynamicTexture, VertexData } from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import { PhysicsAggregate, PhysicsShapeType } from '@babylonjs/core/Physics/v2';

// 서바이벌 상태 인터페이스 (멀티플레이 대비)
interface PlayerStats {
  health: number;
  stamina: number;
  hunger: number;
  thirst: number;
}

// 캐릭터 커스터마이징 옵션
interface CharacterCustomization {
  characterType: 'default' | 'warrior' | 'scout' | 'survivor';
  color: string;
  size: number;
  bodyType: 'slim' | 'normal' | 'muscular';
}

class Game {
  private canvas: HTMLCanvasElement;
  private engine: Engine;
  private scene!: Scene;
  private camera!: UniversalCamera;
  private player!: any;
  private playerAggregate!: PhysicsAggregate;
  private shadowGenerator!: ShadowGenerator;
  private playerStats: PlayerStats = {
    health: 100,
    stamina: 100,
    hunger: 100,
    thirst: 100
  };
  private dayTime: number = 0;
  private isPointerLocked: boolean = false;
  private customization: CharacterCustomization = {
    characterType: 'default',
    color: '#9966ff',
    size: 1.0,
    bodyType: 'normal'
  };
  private vehicles: any[] = [];
  private mountedVehicle: any = null;
  private isMounted: boolean = false;

  constructor() {
    this.canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    this.setupMenu();
  }

  private setupMenu() {
    // 캐릭터 선택
    document.querySelectorAll('.character-option').forEach(option => {
      option.addEventListener('click', () => {
        document.querySelectorAll('.character-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        this.customization.characterType = option.getAttribute('data-character') as any;
      });
    });

    // 색상 선택
    document.querySelectorAll('.color-option').forEach(option => {
      option.addEventListener('click', () => {
        document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        this.customization.color = option.getAttribute('data-color')!;
      });
    });

    // 크기 선택
    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.customization.size = parseFloat(btn.getAttribute('data-size')!);
      });
    });

    // 체형 선택
    document.querySelectorAll('.body-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.body-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.customization.bodyType = btn.getAttribute('data-body') as any;
      });
    });

    // 게임 시작 버튼
    const startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        const menu = document.getElementById('mainMenu');
        if (menu) menu.style.display = 'none';
        this.init();
      });
    }

    // 설정 버튼
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');

    if (settingsBtn && settingsModal) {
      settingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
      });
    }

    if (closeSettings && settingsModal) {
      closeSettings.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
      });
    }

    // 설정 모달 배경 클릭 시 닫기
    if (settingsModal) {
      settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
          settingsModal.classList.add('hidden');
        }
      });
    }

    // 조작법 버튼
    const controlsBtn = document.getElementById('controlsBtn');
    const controlsModal = document.getElementById('controlsModal');
    const closeControls = document.getElementById('closeControls');

    if (controlsBtn && controlsModal) {
      controlsBtn.addEventListener('click', () => {
        controlsModal.classList.remove('hidden');
      });
    }

    if (closeControls && controlsModal) {
      closeControls.addEventListener('click', () => {
        controlsModal.classList.add('hidden');
      });
    }

    // 조작법 모달 배경 클릭 시 닫기
    if (controlsModal) {
      controlsModal.addEventListener('click', (e) => {
        if (e.target === controlsModal) {
          controlsModal.classList.add('hidden');
        }
      });
    }

    // 설정 값 변경 이벤트
    this.setupSettingsListeners();
  }

  private setupSettingsListeners() {
    // 마스터 볼륨
    const masterVolume = document.getElementById('masterVolume') as HTMLInputElement;
    const masterVolumeValue = document.getElementById('masterVolumeValue');
    if (masterVolume && masterVolumeValue) {
      masterVolume.addEventListener('input', () => {
        masterVolumeValue.textContent = `${masterVolume.value}%`;
      });
    }

    // 음악 볼륨
    const musicVolume = document.getElementById('musicVolume') as HTMLInputElement;
    const musicVolumeValue = document.getElementById('musicVolumeValue');
    if (musicVolume && musicVolumeValue) {
      musicVolume.addEventListener('input', () => {
        musicVolumeValue.textContent = `${musicVolume.value}%`;
      });
    }

    // 효과음 볼륨
    const sfxVolume = document.getElementById('sfxVolume') as HTMLInputElement;
    const sfxVolumeValue = document.getElementById('sfxVolumeValue');
    if (sfxVolume && sfxVolumeValue) {
      sfxVolume.addEventListener('input', () => {
        sfxVolumeValue.textContent = `${sfxVolume.value}%`;
      });
    }

    // 마우스 감도
    const mouseSensitivity = document.getElementById('mouseSensitivity') as HTMLInputElement;
    const mouseSensitivityValue = document.getElementById('mouseSensitivityValue');
    if (mouseSensitivity && mouseSensitivityValue) {
      mouseSensitivity.addEventListener('input', () => {
        mouseSensitivityValue.textContent = mouseSensitivity.value;
        // 카메라 감도 적용 (게임 시작 후에만)
        if (this.camera) {
          this.camera.angularSensibility = 2000 / parseFloat(mouseSensitivity.value);
        }
      });
    }
  }

  private async init() {
    await this.createScene();
    this.createTerrain();
    this.createPlayer();
    this.setupControls();
    this.hideLoading();
    this.startRenderLoop();
  }

  private async createScene() {
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.5, 0.8, 0.9, 1); // 하늘색 배경

    // 물리 엔진 초기화 및 활성화
    const havokInstance = await HavokPhysics();
    const havokPlugin = new HavokPlugin(true, havokInstance);
    this.scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin);

    // FPS 카메라 설정
    this.camera = new UniversalCamera('camera', new Vector3(0, 1.6, -5), this.scene);
    this.camera.setTarget(Vector3.Zero());
    this.camera.attachControl(this.canvas, true);

    // 마우스 감도 설정
    this.camera.angularSensibility = 2000;
    this.camera.speed = 0.3;

    // 포인터 락 설정 (클릭 시 FPS 모드)
    this.canvas.addEventListener('click', () => {
      if (!this.isPointerLocked) {
        this.canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
    });

    // 조명 개선 (사실적인 태양광)
    const hemisphericLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), this.scene);
    hemisphericLight.intensity = 0.4;
    hemisphericLight.groundColor = new Color3(0.2, 0.3, 0.3);

    // 태양 (방향성 조명 + 그림자)
    const sunLight = new DirectionalLight('sunLight', new Vector3(-1, -2, -1), this.scene);
    sunLight.position = new Vector3(20, 40, 20);
    sunLight.intensity = 1.2;

    // 그림자 생성기
    this.shadowGenerator = new ShadowGenerator(1024, sunLight);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 32;
  }

  private createTerrain() {
    // 지형 생성 (높낮이 있는 지형)
    const ground = MeshBuilder.CreateGroundFromHeightMap('ground',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      {
        width: 100,
        height: 100,
        subdivisions: 100,
        minHeight: 0,
        maxHeight: 3,
      },
      this.scene
    );

    // 사실적인 풀 텍스처
    const groundMaterial = new PBRMaterial('groundMat', this.scene);
    groundMaterial.albedoTexture = this.createGrassTexture();
    groundMaterial.bumpTexture = this.createGrassBumpTexture();
    groundMaterial.bumpTexture.level = 0.5;
    groundMaterial.roughness = 0.95;
    groundMaterial.metallic = 0;

    ground.material = groundMaterial;
    ground.receiveShadows = true;

    // 지면 물리 설정
    new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0, restitution: 0.2 }, this.scene);

    // 장애물/오브젝트 추가
    this.createEnvironmentObjects();
  }

  // 차량 생성
  private createCar(position: Vector3): any {
    const car = MeshBuilder.CreateBox('car', { size: 0.01 }, this.scene);
    car.position = position;

    // 차체 (본체)
    const body = MeshBuilder.CreateBox('carBody', {
      width: 2.5,
      height: 1,
      depth: 5
    }, this.scene);
    body.position.y = 1;
    body.parent = car;

    // 차량 상부 (지붕)
    const roof = MeshBuilder.CreateBox('carRoof', {
      width: 2.3,
      height: 1,
      depth: 3
    }, this.scene);
    roof.position = new Vector3(0, 1.5, -0.3);
    roof.parent = car;

    // 전면 유리
    const frontGlass = MeshBuilder.CreatePlane('frontGlass', {
      width: 2.3,
      height: 0.8
    }, this.scene);
    frontGlass.position = new Vector3(0, 1.7, 1.2);
    frontGlass.rotation.x = -Math.PI / 6;
    frontGlass.parent = car;

    const glassMat = new PBRMaterial('glassMat', this.scene);
    glassMat.albedoColor = new Color3(0.5, 0.7, 0.9);
    glassMat.alpha = 0.3;
    glassMat.metallic = 0.9;
    glassMat.roughness = 0.1;
    frontGlass.material = glassMat;

    // 바퀴 4개
    const wheelPositions = [
      new Vector3(-1, 0.4, 1.8),   // 앞 왼쪽
      new Vector3(1, 0.4, 1.8),    // 앞 오른쪽
      new Vector3(-1, 0.4, -1.8),  // 뒤 왼쪽
      new Vector3(1, 0.4, -1.8)    // 뒤 오른쪽
    ];

    const wheelMat = new PBRMaterial('wheelMat', this.scene);
    wheelMat.albedoColor = new Color3(0.1, 0.1, 0.1);
    wheelMat.roughness = 0.9;
    wheelMat.metallic = 0.2;

    wheelPositions.forEach((pos, index) => {
      const wheel = MeshBuilder.CreateCylinder(`wheel${index}`, {
        diameter: 0.8,
        height: 0.3
      }, this.scene);
      wheel.rotation.z = Math.PI / 2;
      wheel.position = pos;
      wheel.parent = car;
      wheel.material = wheelMat;
    });

    // 차체 머티리얼
    const carMat = new PBRMaterial('carMat', this.scene);
    carMat.albedoColor = new Color3(0.8, 0.1, 0.1); // 빨간색 차
    carMat.metallic = 0.7;
    carMat.roughness = 0.2;

    body.material = carMat;
    roof.material = carMat;

    // 물리 설정
    new PhysicsAggregate(car, PhysicsShapeType.BOX, { mass: 500, restitution: 0.1 }, this.scene);

    // 그림자
    car.getChildMeshes().forEach(mesh => {
      this.shadowGenerator.addShadowCaster(mesh);
    });

    return car;
  }

  // 오토바이 생성
  private createMotorcycle(position: Vector3): any {
    const motorcycle = MeshBuilder.CreateBox('motorcycle', { size: 0.01 }, this.scene);
    motorcycle.position = position;

    // 메인 프레임
    const frame = MeshBuilder.CreateBox('bikeFrame', {
      width: 0.5,
      height: 0.8,
      depth: 2
    }, this.scene);
    frame.position.y = 0.9;
    frame.parent = motorcycle;

    // 시트
    const seat = MeshBuilder.CreateBox('bikeSeat', {
      width: 0.6,
      height: 0.3,
      depth: 1
    }, this.scene);
    seat.position = new Vector3(0, 1.2, -0.3);
    seat.parent = motorcycle;

    // 핸들바
    const handlebar = MeshBuilder.CreateCylinder('handlebar', {
      diameter: 0.08,
      height: 1.2
    }, this.scene);
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position = new Vector3(0, 1.3, 0.7);
    handlebar.parent = motorcycle;

    // 앞 바퀴
    const frontWheel = MeshBuilder.CreateCylinder('frontWheel', {
      diameter: 0.8,
      height: 0.2
    }, this.scene);
    frontWheel.rotation.z = Math.PI / 2;
    frontWheel.position = new Vector3(0, 0.4, 1.2);
    frontWheel.parent = motorcycle;

    // 뒤 바퀴
    const rearWheel = MeshBuilder.CreateCylinder('rearWheel', {
      diameter: 0.9,
      height: 0.25
    }, this.scene);
    rearWheel.rotation.z = Math.PI / 2;
    rearWheel.position = new Vector3(0, 0.45, -1);
    rearWheel.parent = motorcycle;

    // 바퀴 머티리얼
    const wheelMat = new PBRMaterial('bikeWheelMat', this.scene);
    wheelMat.albedoColor = new Color3(0.1, 0.1, 0.1);
    wheelMat.roughness = 0.8;
    wheelMat.metallic = 0.3;
    frontWheel.material = wheelMat;
    rearWheel.material = wheelMat;

    // 바이크 머티리얼
    const bikeMat = new PBRMaterial('bikeMat', this.scene);
    bikeMat.albedoColor = new Color3(0.1, 0.1, 0.8); // 파란색 바이크
    bikeMat.metallic = 0.8;
    bikeMat.roughness = 0.15;

    frame.material = bikeMat;
    seat.material = new PBRMaterial('seatMat', this.scene);
    (seat.material as PBRMaterial).albedoColor = new Color3(0.2, 0.2, 0.2);
    (seat.material as PBRMaterial).roughness = 0.7;
    handlebar.material = bikeMat;

    // 물리 설정
    new PhysicsAggregate(motorcycle, PhysicsShapeType.BOX, { mass: 150, restitution: 0.05 }, this.scene);

    // 그림자
    motorcycle.getChildMeshes().forEach(mesh => {
      this.shadowGenerator.addShadowCaster(mesh);
    });

    return motorcycle;
  }

  private createEnvironmentObjects() {
    // 탈것 생성 (차량과 오토바이)
    this.vehicles.push(this.createCar(new Vector3(15, 1.5, 5)));
    this.vehicles.push(this.createCar(new Vector3(-20, 1.5, -10)));
    this.vehicles.push(this.createMotorcycle(new Vector3(8, 1, -8)));
    this.vehicles.push(this.createMotorcycle(new Vector3(-12, 1, 15)));

    // 나무 같은 오브젝트 생성
    const treePositions = [
      new Vector3(10, 2, 10),
      new Vector3(-15, 2, 8),
      new Vector3(20, 2, -15),
      new Vector3(-10, 2, -20),
      new Vector3(0, 2, 25),
    ];

    treePositions.forEach((pos, index) => {
      // 나무 기둥
      const trunk = MeshBuilder.CreateCylinder(`trunk${index}`, {
        height: 4,
        diameter: 1,
      }, this.scene);
      trunk.position = pos;

      // 사실적인 나무껍질 텍스처
      const trunkMat = new PBRMaterial(`trunkMat${index}`, this.scene);
      trunkMat.albedoTexture = this.createWoodTexture();
      trunkMat.bumpTexture = this.createWoodBumpTexture();
      trunkMat.bumpTexture.level = 0.8;
      trunkMat.roughness = 0.98;
      trunkMat.metallic = 0;
      trunk.material = trunkMat;

      new PhysicsAggregate(trunk, PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);
      this.shadowGenerator.addShadowCaster(trunk);

      // 나무 잎
      const leaves = MeshBuilder.CreateSphere(`leaves${index}`, {
        diameter: 4,
      }, this.scene);
      leaves.position = new Vector3(pos.x, pos.y + 3, pos.z);

      // 나뭇잎 텍스처
      const leavesMat = new PBRMaterial(`leavesMat${index}`, this.scene);
      leavesMat.albedoTexture = this.createLeavesTexture();
      leavesMat.roughness = 0.9;
      leavesMat.metallic = 0;
      leaves.material = leavesMat;

      this.shadowGenerator.addShadowCaster(leaves);
    });

    // 바위 추가
    const rockPositions = [
      new Vector3(5, 1, -5),
      new Vector3(-8, 1, 12),
      new Vector3(15, 1, 5),
    ];

    rockPositions.forEach((pos, index) => {
      const rock = MeshBuilder.CreatePolyhedron(`rock${index}`, {
        type: 0,
        size: 2,
      }, this.scene);
      rock.position = pos;

      // 사실적인 돌 텍스처
      const rockMat = new PBRMaterial(`rockMat${index}`, this.scene);
      rockMat.albedoTexture = this.createStoneTexture();
      rockMat.bumpTexture = this.createStoneBumpTexture();
      rockMat.bumpTexture.level = 1.0;
      rockMat.roughness = 0.98;
      rockMat.metallic = 0.05;
      rock.material = rockMat;

      new PhysicsAggregate(rock, PhysicsShapeType.CONVEX_HULL, { mass: 0 }, this.scene);
      this.shadowGenerator.addShadowCaster(rock);
    });
  }

  // 사람 모양 휴머노이드 모델 생성
  private createHumanoidModel(radiusMultiplier: number, heightMultiplier: number): any {
    const parent = MeshBuilder.CreateBox('humanoid', { size: 0.01 }, this.scene);
    const size = this.customization.size;

    // 머리 (구체)
    const head = MeshBuilder.CreateSphere('head', {
      diameter: 0.4 * size
    }, this.scene);
    head.position.y = 1.7 * heightMultiplier * size;
    head.parent = parent;

    // 얼굴 텍스처 적용
    const faceMat = new PBRMaterial('faceMat', this.scene);
    faceMat.albedoTexture = this.createFaceTexture();
    faceMat.roughness = 0.6;
    faceMat.metallic = 0;
    head.material = faceMat;

    // 목
    const neck = MeshBuilder.CreateCylinder('neck', {
      height: 0.15 * size,
      diameter: 0.15 * radiusMultiplier * size
    }, this.scene);
    neck.position.y = 1.5 * heightMultiplier * size;
    neck.parent = parent;

    // 몸통 (상체)
    const torso = MeshBuilder.CreateCylinder('torso', {
      height: 0.6 * heightMultiplier * size,
      diameterTop: 0.5 * radiusMultiplier * size,
      diameterBottom: 0.45 * radiusMultiplier * size
    }, this.scene);
    torso.position.y = 1.1 * heightMultiplier * size;
    torso.parent = parent;

    // 골반
    const pelvis = MeshBuilder.CreateCylinder('pelvis', {
      height: 0.2 * size,
      diameter: 0.45 * radiusMultiplier * size
    }, this.scene);
    pelvis.position.y = 0.7 * heightMultiplier * size;
    pelvis.parent = parent;

    // 왼팔 상완
    const leftUpperArm = MeshBuilder.CreateCylinder('leftUpperArm', {
      height: 0.35 * size,
      diameter: 0.12 * radiusMultiplier * size
    }, this.scene);
    leftUpperArm.rotation.z = Math.PI / 2;
    leftUpperArm.position = new Vector3(
      -0.35 * radiusMultiplier * size,
      1.25 * heightMultiplier * size,
      0
    );
    leftUpperArm.parent = parent;

    // 왼팔 전완
    const leftForearm = MeshBuilder.CreateCylinder('leftForearm', {
      height: 0.3 * size,
      diameter: 0.1 * radiusMultiplier * size
    }, this.scene);
    leftForearm.rotation.z = Math.PI / 2;
    leftForearm.position = new Vector3(
      -0.65 * radiusMultiplier * size,
      1.25 * heightMultiplier * size,
      0
    );
    leftForearm.parent = parent;

    // 오른팔 상완
    const rightUpperArm = MeshBuilder.CreateCylinder('rightUpperArm', {
      height: 0.35 * size,
      diameter: 0.12 * radiusMultiplier * size
    }, this.scene);
    rightUpperArm.rotation.z = Math.PI / 2;
    rightUpperArm.position = new Vector3(
      0.35 * radiusMultiplier * size,
      1.25 * heightMultiplier * size,
      0
    );
    rightUpperArm.parent = parent;

    // 오른팔 전완
    const rightForearm = MeshBuilder.CreateCylinder('rightForearm', {
      height: 0.3 * size,
      diameter: 0.1 * radiusMultiplier * size
    }, this.scene);
    rightForearm.rotation.z = Math.PI / 2;
    rightForearm.position = new Vector3(
      0.65 * radiusMultiplier * size,
      1.25 * heightMultiplier * size,
      0
    );
    rightForearm.parent = parent;

    // 왼쪽 손
    const leftHand = MeshBuilder.CreateSphere('leftHand', {
      diameter: 0.1 * size
    }, this.scene);
    leftHand.position = new Vector3(
      -0.8 * radiusMultiplier * size,
      1.25 * heightMultiplier * size,
      0
    );
    leftHand.parent = parent;

    // 오른쪽 손
    const rightHand = MeshBuilder.CreateSphere('rightHand', {
      diameter: 0.1 * size
    }, this.scene);
    rightHand.position = new Vector3(
      0.8 * radiusMultiplier * size,
      1.25 * heightMultiplier * size,
      0
    );
    rightHand.parent = parent;

    // 왼쪽 허벅지
    const leftThigh = MeshBuilder.CreateCylinder('leftThigh', {
      height: 0.45 * heightMultiplier * size,
      diameter: 0.18 * radiusMultiplier * size
    }, this.scene);
    leftThigh.position = new Vector3(
      -0.12 * radiusMultiplier * size,
      0.35 * heightMultiplier * size,
      0
    );
    leftThigh.parent = parent;

    // 왼쪽 정강이
    const leftShin = MeshBuilder.CreateCylinder('leftShin', {
      height: 0.4 * heightMultiplier * size,
      diameter: 0.14 * radiusMultiplier * size
    }, this.scene);
    leftShin.position = new Vector3(
      -0.12 * radiusMultiplier * size,
      -0.15 * heightMultiplier * size,
      0
    );
    leftShin.parent = parent;

    // 왼쪽 발
    const leftFoot = MeshBuilder.CreateBox('leftFoot', {
      width: 0.15 * size,
      height: 0.1 * size,
      depth: 0.25 * size
    }, this.scene);
    leftFoot.position = new Vector3(
      -0.12 * radiusMultiplier * size,
      -0.4 * heightMultiplier * size,
      0.05 * size
    );
    leftFoot.parent = parent;

    // 오른쪽 허벅지
    const rightThigh = MeshBuilder.CreateCylinder('rightThigh', {
      height: 0.45 * heightMultiplier * size,
      diameter: 0.18 * radiusMultiplier * size
    }, this.scene);
    rightThigh.position = new Vector3(
      0.12 * radiusMultiplier * size,
      0.35 * heightMultiplier * size,
      0
    );
    rightThigh.parent = parent;

    // 오른쪽 정강이
    const rightShin = MeshBuilder.CreateCylinder('rightShin', {
      height: 0.4 * heightMultiplier * size,
      diameter: 0.14 * radiusMultiplier * size
    }, this.scene);
    rightShin.position = new Vector3(
      0.12 * radiusMultiplier * size,
      -0.15 * heightMultiplier * size,
      0
    );
    rightShin.parent = parent;

    // 오른쪽 발
    const rightFoot = MeshBuilder.CreateBox('rightFoot', {
      width: 0.15 * size,
      height: 0.1 * size,
      depth: 0.25 * size
    }, this.scene);
    rightFoot.position = new Vector3(
      0.12 * radiusMultiplier * size,
      -0.4 * heightMultiplier * size,
      0.05 * size
    );
    rightFoot.parent = parent;

    // 모든 자식 메시에 그림자 적용
    parent.getChildMeshes().forEach(mesh => {
      this.shadowGenerator.addShadowCaster(mesh);
    });

    return parent;
  }

  // 얼굴 텍스처 생성 (눈, 코, 입)
  private createFaceTexture(): DynamicTexture {
    const texture = new DynamicTexture('faceTexture', 512, this.scene, false);
    const ctx = texture.getContext();

    // 피부색 배경
    ctx.fillStyle = '#ffdbac';
    ctx.fillRect(0, 0, 512, 512);

    // 왼쪽 눈
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(180, 200, 40, 30, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#4a3020';
    ctx.beginPath();
    ctx.arc(190, 200, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(195, 200, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(200, 195, 4, 0, Math.PI * 2);
    ctx.fill();

    // 오른쪽 눈
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(332, 200, 40, 30, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#4a3020';
    ctx.beginPath();
    ctx.arc(322, 200, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(317, 200, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(312, 195, 4, 0, Math.PI * 2);
    ctx.fill();

    // 눈썹
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

    // 코
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

    // 입 (미소)
    ctx.strokeStyle = '#8b4513';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(200, 340);
    ctx.quadraticCurveTo(256, 370, 312, 340);
    ctx.stroke();

    // 윗입술
    ctx.strokeStyle = '#c48b6b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(210, 335);
    ctx.quadraticCurveTo(256, 345, 302, 335);
    ctx.stroke();

    texture.update();
    return texture;
  }

  private createPlayer() {
    // 체형에 따른 크기 조정
    let radiusMultiplier = 1.0;
    let heightMultiplier = 1.0;

    switch (this.customization.bodyType) {
      case 'slim':
        radiusMultiplier = 0.8;
        heightMultiplier = 1.1;
        break;
      case 'normal':
        radiusMultiplier = 1.0;
        heightMultiplier = 1.0;
        break;
      case 'muscular':
        radiusMultiplier = 1.2;
        heightMultiplier = 0.95;
        break;
    }

    // 사람 모양 캐릭터 생성 - 커스터마이징 적용
    this.player = this.createHumanoidModel(radiusMultiplier, heightMultiplier);
    this.player.position = new Vector3(0, 2, 0);

    // 헥스 색상을 Color3로 변환
    const hexToColor3 = (hex: string): Color3 => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return new Color3(r, g, b);
    };

    // PBR 플레이어 머티리얼 - 선택한 색상 적용
    const playerMat = new PBRMaterial('playerMat', this.scene);
    playerMat.albedoColor = hexToColor3(this.customization.color);

    // 캐릭터 타입에 따른 속성 조정
    switch (this.customization.characterType) {
      case 'warrior':
        playerMat.metallic = 0.4;
        playerMat.roughness = 0.3;
        playerMat.emissiveColor = new Color3(0.1, 0.05, 0.05);
        break;
      case 'scout':
        playerMat.metallic = 0.1;
        playerMat.roughness = 0.6;
        playerMat.emissiveColor = new Color3(0.05, 0.1, 0.05);
        break;
      case 'survivor':
        playerMat.metallic = 0.2;
        playerMat.roughness = 0.7;
        playerMat.emissiveColor = new Color3(0.1, 0.08, 0.05);
        break;
      default: // default
        playerMat.metallic = 0.2;
        playerMat.roughness = 0.4;
        playerMat.emissiveColor = new Color3(0.05, 0.1, 0.2);
        break;
    }

    // 모든 신체 파트에 머티리얼 적용 (머리 제외 - 얼굴 텍스처 있음)
    this.player.getChildMeshes().forEach((mesh: any) => {
      if (mesh.name !== 'head') {
        mesh.material = playerMat;
      }
    });

    // 물리 충돌용 캡슐 생성 (보이지 않음)
    const collisionCapsule = MeshBuilder.CreateCapsule('playerCollision', {
      height: 2 * heightMultiplier * this.customization.size,
      radius: 0.4 * radiusMultiplier * this.customization.size,
    }, this.scene);
    collisionCapsule.isVisible = false;
    collisionCapsule.position = this.player.position.clone();
    collisionCapsule.parent = this.player;

    // 플레이어 물리 (충돌 캡슐에 적용)
    this.playerAggregate = new PhysicsAggregate(
      collisionCapsule,
      PhysicsShapeType.CAPSULE,
      { mass: 70, restitution: 0.0, friction: 0.5 },
      this.scene
    );

    // 회전 잠금 (넘어지지 않게)
    this.playerAggregate.body.setAngularDamping(10);
    this.playerAggregate.body.setLinearDamping(0.5);

    // 중력 방향 고정
    this.playerAggregate.body.disablePreStep = false;

    // 플레이어 그림자
    this.shadowGenerator.addShadowCaster(this.player);

    // 카메라가 플레이어를 따라가도록
    this.camera.target = this.player.position;
  }

  // 절차적 풀 텍스처 생성
  private createGrassTexture(): DynamicTexture {
    const texture = new DynamicTexture('grassTexture', 512, this.scene, false);
    const ctx = texture.getContext();

    // 흙 배경
    ctx.fillStyle = '#3a5a2a';
    ctx.fillRect(0, 0, 512, 512);

    // 풀잎 패턴
    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
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
    texture.uScale = 10;
    texture.vScale = 10;
    return texture;
  }

  private createGrassBumpTexture(): DynamicTexture {
    const texture = new DynamicTexture('grassBump', 512, this.scene, false);
    const ctx = texture.getContext();

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 1000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const gray = Math.floor(Math.random() * 30 + 110);

      ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
      ctx.fillRect(x, y, 2, 2);
    }

    texture.update();
    texture.uScale = 10;
    texture.vScale = 10;
    return texture;
  }

  // 나무껍질 텍스처
  private createWoodTexture(): DynamicTexture {
    const texture = new DynamicTexture('woodTexture', 512, this.scene, false);
    const ctx = texture.getContext();

    // 나무 베이스 색상
    ctx.fillStyle = '#4a3020';
    ctx.fillRect(0, 0, 512, 512);

    // 나무 결 패턴
    for (let i = 0; i < 100; i++) {
      const y = Math.random() * 512;
      const brown = Math.floor(Math.random() * 30 + 40);

      ctx.strokeStyle = `rgba(${brown}, ${Math.floor(brown * 0.6)}, ${Math.floor(brown * 0.3)}, 0.5)`;
      ctx.lineWidth = Math.random() * 3 + 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(128, y + Math.random() * 20 - 10, 384, y + Math.random() * 20 - 10, 512, y);
      ctx.stroke();
    }

    texture.update();
    texture.uScale = 2;
    texture.vScale = 3;
    return texture;
  }

  private createWoodBumpTexture(): DynamicTexture {
    const texture = new DynamicTexture('woodBump', 512, this.scene, false);
    const ctx = texture.getContext();

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 50; i++) {
      const y = Math.random() * 512;
      ctx.strokeStyle = `rgba(${150 + Math.random() * 40}, ${150 + Math.random() * 40}, ${150 + Math.random() * 40}, 0.8)`;
      ctx.lineWidth = Math.random() * 5 + 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(128, y + Math.random() * 30 - 15, 384, y + Math.random() * 30 - 15, 512, y);
      ctx.stroke();
    }

    texture.update();
    texture.uScale = 2;
    texture.vScale = 3;
    return texture;
  }

  // 나뭇잎 텍스처
  private createLeavesTexture(): DynamicTexture {
    const texture = new DynamicTexture('leavesTexture', 512, this.scene, false);
    const ctx = texture.getContext();

    ctx.fillStyle = '#1a4a1a';
    ctx.fillRect(0, 0, 512, 512);

    // 잎맥 패턴
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const green = Math.floor(Math.random() * 80 + 60);

      ctx.fillStyle = `rgba(${Math.floor(green * 0.2)}, ${green}, ${Math.floor(green * 0.3)}, 0.7)`;
      ctx.beginPath();
      ctx.arc(x, y, Math.random() * 3 + 1, 0, Math.PI * 2);
      ctx.fill();
    }

    texture.update();
    texture.uScale = 3;
    texture.vScale = 3;
    return texture;
  }

  // 돌 텍스처
  private createStoneTexture(): DynamicTexture {
    const texture = new DynamicTexture('stoneTexture', 512, this.scene, false);
    const ctx = texture.getContext();

    ctx.fillStyle = '#606070';
    ctx.fillRect(0, 0, 512, 512);

    // 돌 표면 불규칙 패턴
    for (let i = 0; i < 300; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const size = Math.random() * 15 + 5;
      const gray = Math.floor(Math.random() * 40 + 70);

      ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray + 10}, 0.6)`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 돌 균열
    for (let i = 0; i < 30; i++) {
      const x1 = Math.random() * 512;
      const y1 = Math.random() * 512;
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
    texture.uScale = 1.5;
    texture.vScale = 1.5;
    return texture;
  }

  private createStoneBumpTexture(): DynamicTexture {
    const texture = new DynamicTexture('stoneBump', 512, this.scene, false);
    const ctx = texture.getContext();

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 200; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const size = Math.random() * 10 + 3;
      const gray = Math.floor(Math.random() * 60 + 100);

      ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    texture.update();
    texture.uScale = 1.5;
    texture.vScale = 1.5;
    return texture;
  }

  private setupControls() {
    const inputMap: { [key: string]: boolean } = {};

    this.scene.onBeforeRenderObservable.add(() => {
      if (!this.player) return;

      if (this.isMounted && this.mountedVehicle) {
        // 탈것 조작 모드
        const vehicleSpeed = this.mountedVehicle.name.includes('motorcycle') ? 15 : 10;
        const turnSpeed = 0.05;
        const currentVelocity = this.mountedVehicle.physicsBody?.parent?.getLinearVelocity() || new Vector3(0, 0, 0);

        // 전진/후진
        if (inputMap['w'] || inputMap['W']) {
          const forward = this.mountedVehicle.forward || new Vector3(0, 0, 1);
          const rotatedForward = forward.rotateByQuaternionToRef(
            this.mountedVehicle.rotationQuaternion || this.mountedVehicle.rotation,
            new Vector3()
          );
          if (this.mountedVehicle.physicsBody?.parent) {
            this.mountedVehicle.physicsBody.parent.setLinearVelocity(new Vector3(
              rotatedForward.x * vehicleSpeed,
              currentVelocity.y,
              rotatedForward.z * vehicleSpeed
            ));
          }
        }
        if (inputMap['s'] || inputMap['S']) {
          const backward = this.mountedVehicle.forward || new Vector3(0, 0, -1);
          const rotatedBackward = backward.rotateByQuaternionToRef(
            this.mountedVehicle.rotationQuaternion || this.mountedVehicle.rotation,
            new Vector3()
          );
          if (this.mountedVehicle.physicsBody?.parent) {
            this.mountedVehicle.physicsBody.parent.setLinearVelocity(new Vector3(
              -rotatedBackward.x * vehicleSpeed * 0.5,
              currentVelocity.y,
              -rotatedBackward.z * vehicleSpeed * 0.5
            ));
          }
        }

        // 회전
        if (inputMap['a'] || inputMap['A']) {
          this.mountedVehicle.rotation.y += turnSpeed;
        }
        if (inputMap['d'] || inputMap['D']) {
          this.mountedVehicle.rotation.y -= turnSpeed;
        }

        // 탈것 위치로 플레이어 이동 (보이지 않게)
        this.player.position = new Vector3(
          this.mountedVehicle.position.x,
          this.mountedVehicle.position.y + 10, // 위로 멀리
          this.mountedVehicle.position.z
        );

        // 카메라를 탈것 뒤쪽에 배치 (3인칭 뷰)
        const offset = new Vector3(0, 3, -8);
        const rotatedOffset = offset.rotateByQuaternionToRef(
          this.mountedVehicle.rotationQuaternion || this.mountedVehicle.rotation,
          new Vector3()
        );
        this.camera.position = new Vector3(
          this.mountedVehicle.position.x + rotatedOffset.x,
          this.mountedVehicle.position.y + rotatedOffset.y,
          this.mountedVehicle.position.z + rotatedOffset.z
        );
        this.camera.setTarget(this.mountedVehicle.position);
      } else {
        // 일반 플레이어 조작 모드
        const speed = 0.2;
        const moveVector = new Vector3(0, 0, 0);

        // WASD 이동
        if (inputMap['w'] || inputMap['W']) moveVector.z += speed;
        if (inputMap['s'] || inputMap['S']) moveVector.z -= speed;
        if (inputMap['a'] || inputMap['A']) moveVector.x -= speed;
        if (inputMap['d'] || inputMap['D']) moveVector.x += speed;

        if (moveVector.length() > 0) {
          if (this.playerAggregate) {
            const velocity = this.playerAggregate.body.getLinearVelocity();
            this.playerAggregate.body.setLinearVelocity(new Vector3(
              moveVector.x * 5,
              velocity.y,
              moveVector.z * 5
            ));
          }
        }

        // 점프
        if (inputMap[' ']) {
          const velocity = this.playerAggregate?.body.getLinearVelocity();
          // 지면에 가까이 있을 때만 점프 (y 속도가 작을 때)
          if (this.playerAggregate && velocity && Math.abs(velocity.y) < 0.1 && this.player.position.y < 4) {
            this.playerAggregate.body.applyImpulse(new Vector3(0, 6, 0), this.player.position);
            inputMap[' '] = false; // 한 번만 점프
          }
        }

        // FPS 카메라 업데이트 (플레이어 눈높이)
        const eyeHeight = 1.6 * this.customization.size;
        this.camera.position = new Vector3(
          this.player.position.x,
          this.player.position.y + eyeHeight,
          this.player.position.z
        );
      }

      // UI 업데이트
      this.updateUI();
    });

    // 키보드 이벤트
    window.addEventListener('keydown', (e) => {
      inputMap[e.key] = true;

      // E키 - 탈것 탑승/하차
      if (e.key === 'e' || e.key === 'E') {
        if (this.isMounted) {
          // 하차
          this.isMounted = false;
          this.player.position = new Vector3(
            this.mountedVehicle.position.x + 3,
            this.mountedVehicle.position.y + 1,
            this.mountedVehicle.position.z
          );
          this.mountedVehicle = null;
        } else {
          // 가까운 탈것 찾기
          let nearestVehicle: any = null;
          let minDistance = 5; // 5미터 이내

          this.vehicles.forEach(vehicle => {
            const distance = Vector3.Distance(this.player.position, vehicle.position);
            if (distance < minDistance) {
              minDistance = distance;
              nearestVehicle = vehicle;
            }
          });

          if (nearestVehicle) {
            // 탑승
            this.isMounted = true;
            this.mountedVehicle = nearestVehicle;
          }
        }
      }

      // 전체화면 토글 (F키)
      if (e.key === 'f' || e.key === 'F') {
        this.engine.switchFullscreen(false);
      }
    });

    window.addEventListener('keyup', (e) => {
      inputMap[e.key] = false;
    });
  }

  private updateUI() {
    const fpsElement = document.getElementById('fps');
    const posElement = document.getElementById('position');

    if (fpsElement) {
      fpsElement.textContent = this.engine.getFps().toFixed(0);
    }

    if (posElement && this.player) {
      const pos = this.player.position;
      posElement.textContent = `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
    }

    // 서바이벌 상태 업데이트
    this.updateSurvivalStats();
  }

  private updateSurvivalStats() {
    // 시간 경과에 따라 상태 감소
    const deltaTime = this.engine.getDeltaTime() / 1000;
    this.playerStats.hunger = Math.max(0, this.playerStats.hunger - deltaTime * 0.5);
    this.playerStats.thirst = Math.max(0, this.playerStats.thirst - deltaTime * 0.8);

    // 이동 시 스태미나 소모
    const velocity = this.playerAggregate?.body.getLinearVelocity();
    if (velocity && (Math.abs(velocity.x) > 0.1 || Math.abs(velocity.z) > 0.1)) {
      this.playerStats.stamina = Math.max(0, this.playerStats.stamina - deltaTime * 2);
    } else {
      this.playerStats.stamina = Math.min(100, this.playerStats.stamina + deltaTime * 5);
    }

    // 배고픔/갈증이 0이면 체력 감소
    if (this.playerStats.hunger <= 0 || this.playerStats.thirst <= 0) {
      this.playerStats.health = Math.max(0, this.playerStats.health - deltaTime * 5);
    }

    // UI 바 업데이트
    const healthBar = document.getElementById('health-bar');
    const staminaBar = document.getElementById('stamina-bar');
    const hungerBar = document.getElementById('hunger-bar');
    const thirstBar = document.getElementById('thirst-bar');

    if (healthBar) healthBar.style.width = `${this.playerStats.health}%`;
    if (staminaBar) staminaBar.style.width = `${this.playerStats.stamina}%`;
    if (hungerBar) hungerBar.style.width = `${this.playerStats.hunger}%`;
    if (thirstBar) thirstBar.style.width = `${this.playerStats.thirst}%`;

    const healthText = document.getElementById('health-text');
    const staminaText = document.getElementById('stamina-text');
    const hungerText = document.getElementById('hunger-text');
    const thirstText = document.getElementById('thirst-text');

    if (healthText) healthText.textContent = this.playerStats.health.toFixed(0);
    if (staminaText) staminaText.textContent = this.playerStats.stamina.toFixed(0);
    if (hungerText) hungerText.textContent = this.playerStats.hunger.toFixed(0);
    if (thirstText) thirstText.textContent = this.playerStats.thirst.toFixed(0);

    // 시간 시스템
    this.dayTime += deltaTime * 0.1;
    const timeElement = document.getElementById('time');
    const dayPhase = (this.dayTime % 100) / 100;

    if (timeElement) {
      if (dayPhase < 0.25) {
        timeElement.textContent = '🌅 새벽';
      } else if (dayPhase < 0.5) {
        timeElement.textContent = '☀️ 낮';
      } else if (dayPhase < 0.75) {
        timeElement.textContent = '🌆 저녁';
      } else {
        timeElement.textContent = '🌙 밤';
      }
    }
  }

  private hideLoading() {
    const loading = document.getElementById('loading');
    const ui = document.getElementById('ui');
    const controls = document.getElementById('controls');

    if (loading) loading.classList.add('hidden');
    if (ui) ui.classList.remove('hidden');
    if (controls) controls.classList.remove('hidden');
  }

  private startRenderLoop() {
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });

    window.addEventListener('resize', () => {
      this.engine.resize();
    });
  }
}

// 게임 시작
new Game();
