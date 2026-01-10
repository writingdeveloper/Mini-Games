// 서바이벌 게임 - JavaScript 버전

class Game {
  constructor() {
    this.canvas = document.getElementById('renderCanvas');
    // 성능 최적화된 엔진 설정
    this.engine = new BABYLON.Engine(this.canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      disableWebGL2Support: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false,
      antialias: true,
      audioEngine: false // 별도의 오디오 컨텍스트 사용
    });
    // 엔진 최적화 설정
    this.engine.enableOfflineSupport = false;
    this.engine.doNotHandleContextLost = true;
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
    this.vehicles = [];
    this.mountedVehicle = null;
    this.isMounted = false;
    this.enemies = [];
    this.inputMap = {};

    // 새로운 기능들
    this.isFirstPerson = true; // 1인칭/3인칭 토글
    this.isAutoFire = false; // 연사 모드
    this.isReloading = false; // 재장전 중
    this.loadedChunks = new Set(); // 로드된 청크
    this.chunkSize = 50; // 청크 크기
    this.enemySpawnTimer = 0;

    // ADS (조준 사격) 시스템
    this.isAiming = false;
    this.aimTransition = 0; // 0 = 비조준, 1 = 완전 조준
    this.normalFOV = 75;
    this.aimFOV = 40;
    this.normalGunPos = new BABYLON.Vector3(0.3, -0.28, 0.5);
    this.aimGunPos = new BABYLON.Vector3(0, -0.15, 0.4);

    // 무기 시스템
    this.weapons = [
      {
        name: '권총',
        type: 'pistol',
        magazineAmmo: 12,
        maxMagazine: 12,
        reserveAmmo: 48,
        damage: 25,
        fireRate: 0.2,
        autoFire: false,
        recoil: 0.04,
        spread: 0.02
      },
      {
        name: '돌격소총',
        type: 'rifle',
        magazineAmmo: 30,
        maxMagazine: 30,
        reserveAmmo: 120,
        damage: 20,
        fireRate: 0.08,
        autoFire: true,
        recoil: 0.03,
        spread: 0.04
      },
      {
        name: '샷건',
        type: 'shotgun',
        magazineAmmo: 8,
        maxMagazine: 8,
        reserveAmmo: 32,
        damage: 15,
        fireRate: 0.8,
        autoFire: false,
        recoil: 0.12,
        spread: 0.15,
        pellets: 8
      },
      {
        name: 'SMG',
        type: 'smg',
        magazineAmmo: 25,
        maxMagazine: 25,
        reserveAmmo: 100,
        damage: 12,
        fireRate: 0.05,
        autoFire: true,
        recoil: 0.02,
        spread: 0.06
      },
      {
        name: '수류탄',
        type: 'grenade',
        magazineAmmo: 3,
        maxMagazine: 3,
        reserveAmmo: 6,
        damage: 80,
        fireRate: 1.0,
        autoFire: false,
        recoil: 0.01,
        spread: 0,
        explosive: true,
        blastRadius: 8
      },
      {
        name: '로켓런처',
        type: 'rocket',
        magazineAmmo: 1,
        maxMagazine: 1,
        reserveAmmo: 5,
        damage: 120,
        fireRate: 2.0,
        autoFire: false,
        recoil: 0.2,
        spread: 0,
        explosive: true,
        blastRadius: 12
      },
      {
        name: '레이저건',
        type: 'laser',
        magazineAmmo: 100,
        maxMagazine: 100,
        reserveAmmo: 200,
        damage: 5,
        fireRate: 0.02,
        autoFire: true,
        recoil: 0,
        spread: 0
      },
      {
        name: '저격소총',
        type: 'sniper',
        magazineAmmo: 5,
        maxMagazine: 5,
        reserveAmmo: 20,
        damage: 150,
        fireRate: 1.5,
        autoFire: false,
        recoil: 0.25,
        spread: 0,
        scopeZoom: 4.0 // 스코프 배율
      }
    ];
    this.currentWeaponIndex = 1; // 기본 돌격소총
    this.currentWeapon = this.weapons[this.currentWeaponIndex];

    // 수류탄/특수 무기 인벤토리
    this.grenades = 5;
    this.cannonballs = 3;

    this.setupMenu();
  }

  setupMenu() {
    // 캐릭터 선택
    document.querySelectorAll('.character-option').forEach(option => {
      option.addEventListener('click', () => {
        document.querySelectorAll('.character-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        this.customization.characterType = option.getAttribute('data-character');
      });
    });

    // 색상 선택
    document.querySelectorAll('.color-option').forEach(option => {
      option.addEventListener('click', () => {
        document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        this.customization.color = option.getAttribute('data-color');
      });
    });

    // 크기 선택
    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.customization.size = parseFloat(btn.getAttribute('data-size'));
      });
    });

    // 체형 선택
    document.querySelectorAll('.body-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.body-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.customization.bodyType = btn.getAttribute('data-body');
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

    if (controlsModal) {
      controlsModal.addEventListener('click', (e) => {
        if (e.target === controlsModal) {
          controlsModal.classList.add('hidden');
        }
      });
    }

    this.setupSettingsListeners();
  }

  setupSettingsListeners() {
    const masterVolume = document.getElementById('masterVolume');
    const masterVolumeValue = document.getElementById('masterVolumeValue');
    if (masterVolume && masterVolumeValue) {
      masterVolume.addEventListener('input', () => {
        masterVolumeValue.textContent = `${masterVolume.value}%`;
      });
    }

    const musicVolume = document.getElementById('musicVolume');
    const musicVolumeValue = document.getElementById('musicVolumeValue');
    if (musicVolume && musicVolumeValue) {
      musicVolume.addEventListener('input', () => {
        musicVolumeValue.textContent = `${musicVolume.value}%`;
      });
    }

    const sfxVolume = document.getElementById('sfxVolume');
    const sfxVolumeValue = document.getElementById('sfxVolumeValue');
    if (sfxVolume && sfxVolumeValue) {
      sfxVolume.addEventListener('input', () => {
        sfxVolumeValue.textContent = `${sfxVolume.value}%`;
      });
    }

    const mouseSensitivity = document.getElementById('mouseSensitivity');
    const mouseSensitivityValue = document.getElementById('mouseSensitivityValue');
    if (mouseSensitivity && mouseSensitivityValue) {
      mouseSensitivity.addEventListener('input', () => {
        mouseSensitivityValue.textContent = mouseSensitivity.value;
        if (this.camera) {
          this.camera.angularSensibility = 2000 / parseFloat(mouseSensitivity.value);
        }
      });
    }
  }

  async init() {
    // 키보드 이벤트 먼저 설정
    this.setupKeyboardEvents();

    // 오디오 시스템 초기화
    this.initAudio();

    await this.createScene();
    this.createProceduralTerrain();
    this.createPlayer();
    this.createGun();
    this.spawnInitialEnemies();
    this.setupControls();
    this.hideLoading();
    this.startRenderLoop();
  }

  initAudio() {
    // Web Audio API 컨텍스트
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // 첫 클릭시 오디오 컨텍스트 활성화
    const resumeAudio = () => {
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
    };
    document.addEventListener('click', resumeAudio, { once: true });
  }

  playGunSound() {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // 메인 폭발음 (노이즈 기반)
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / noiseData.length, 3);
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(3000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(300, now + 0.1);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSource.start(now);

    // 저음 쿵 소리
    const bassOsc = ctx.createOscillator();
    bassOsc.type = 'sine';
    bassOsc.frequency.setValueAtTime(150, now);
    bassOsc.frequency.exponentialRampToValueAtTime(50, now + 0.08);

    const bassGain = ctx.createGain();
    bassGain.gain.setValueAtTime(0.5, now);
    bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    bassOsc.connect(bassGain);
    bassGain.connect(ctx.destination);
    bassOsc.start(now);
    bassOsc.stop(now + 0.1);

    // 고음 찰칵 소리
    const clickOsc = ctx.createOscillator();
    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(2000, now + 0.02);
    clickOsc.frequency.exponentialRampToValueAtTime(500, now + 0.06);

    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.15, now + 0.02);
    clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(now + 0.02);
    clickOsc.stop(now + 0.08);
  }

  playReloadSound() {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // 탄창 빼는 소리
    const ejectOsc = ctx.createOscillator();
    ejectOsc.type = 'square';
    ejectOsc.frequency.setValueAtTime(800, now);
    ejectOsc.frequency.exponentialRampToValueAtTime(200, now + 0.1);

    const ejectGain = ctx.createGain();
    ejectGain.gain.setValueAtTime(0.2, now);
    ejectGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    ejectOsc.connect(ejectGain);
    ejectGain.connect(ctx.destination);
    ejectOsc.start(now);
    ejectOsc.stop(now + 0.15);

    // 탄창 넣는 소리
    setTimeout(() => {
      const insertOsc = ctx.createOscillator();
      insertOsc.type = 'square';
      insertOsc.frequency.setValueAtTime(400, ctx.currentTime);
      insertOsc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05);

      const insertGain = ctx.createGain();
      insertGain.gain.setValueAtTime(0.3, ctx.currentTime);
      insertGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      insertOsc.connect(insertGain);
      insertGain.connect(ctx.destination);
      insertOsc.start(ctx.currentTime);
      insertOsc.stop(ctx.currentTime + 0.1);
    }, 800);

    // 슬라이드 당기는 소리
    setTimeout(() => {
      const slideOsc = ctx.createOscillator();
      slideOsc.type = 'sawtooth';
      slideOsc.frequency.setValueAtTime(300, ctx.currentTime);
      slideOsc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.08);

      const slideGain = ctx.createGain();
      slideGain.gain.setValueAtTime(0.25, ctx.currentTime);
      slideGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      slideOsc.connect(slideGain);
      slideGain.connect(ctx.destination);
      slideOsc.start(ctx.currentTime);
      slideOsc.stop(ctx.currentTime + 0.1);
    }, 1200);
  }

  playHitSound() {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
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

      // R키로 재장전
      if (key === 'r' && !self.isReloading && self.currentWeapon.magazineAmmo < self.currentWeapon.maxMagazine && self.currentWeapon.reserveAmmo > 0) {
        self.reload();
      }

      // V키로 1인칭/3인칭 전환
      if (key === 'v') {
        self.toggleViewMode();
      }

      // B키로 연사/단발 전환
      if (key === 'b' && self.currentWeapon.autoFire) {
        self.isAutoFire = !self.isAutoFire;
        console.log(self.isAutoFire ? '연사 모드' : '단발 모드');
      }

      // 1-8 키로 무기 전환
      if (key === '1') self.switchWeapon(0);
      if (key === '2') self.switchWeapon(1);
      if (key === '3') self.switchWeapon(2);
      if (key === '4') self.switchWeapon(3);
      if (key === '5') self.switchWeapon(4); // 수류탄
      if (key === '6') self.switchWeapon(5); // 로켓런처
      if (key === '7') self.switchWeapon(6); // 레이저건
      if (key === '8') self.switchWeapon(7); // 저격소총

      // G키로 수류탄 던지기 (현재 무기와 상관없이)
      if (key === 'g' && self.grenades > 0) {
        self.throwGrenade();
      }

      // T키로 탈것 탑승/하차
      if (key === 't') {
        self.toggleVehicleMount();
      }

      // 마우스 휠로 무기 전환 (Q/E키)
      if (key === 'q') self.switchWeapon((self.currentWeaponIndex - 1 + self.weapons.length) % self.weapons.length);
      if (key === 'e') self.switchWeapon((self.currentWeaponIndex + 1) % self.weapons.length);
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

  toggleViewMode() {
    this.isFirstPerson = !this.isFirstPerson;

    if (this.isFirstPerson) {
      // 1인칭 모드
      this.player.setEnabled(false);
      if (this.gunParent) this.gunParent.setEnabled(true);
    } else {
      // 3인칭 모드
      this.player.setEnabled(true);
      if (this.gunParent) this.gunParent.setEnabled(false);
    }

    console.log(this.isFirstPerson ? '1인칭 모드' : '3인칭 모드');
  }

  switchWeapon(index) {
    if (index === this.currentWeaponIndex || this.isReloading) return;
    if (index < 0 || index >= this.weapons.length) return;

    this.currentWeaponIndex = index;
    this.currentWeapon = this.weapons[index];

    // 연사 모드 설정
    this.isAutoFire = this.currentWeapon.autoFire;

    // 무기 교체 애니메이션
    if (this.gunParent) {
      const startY = this.gunParent.position.y;
      let switchTime = 0;

      const switchAnimation = () => {
        switchTime += 0.016;

        if (switchTime < 0.15) {
          // 내리기
          this.gunParent.position.y = startY - switchTime * 2;
        } else if (switchTime < 0.3) {
          // 모델 변경 및 올리기
          if (switchTime > 0.15 && switchTime < 0.17) {
            this.updateGunModel();
          }
          this.gunParent.position.y = startY - 0.3 + (switchTime - 0.15) * 2;
        } else {
          this.gunParent.position.y = startY;
          return;
        }

        requestAnimationFrame(switchAnimation);
      };
      switchAnimation();
    }

    console.log(`무기 전환: ${this.currentWeapon.name}`);
  }

  updateGunModel() {
    // 기존 총 메시 색상/크기 변경으로 무기 타입 표현
    if (!this.gunParent) return;

    const frame = this.gunParent.getChildMeshes().find(m => m.name === 'gunFrame');
    const slide = this.gunSlide;
    const barrel = this.gunParent.getChildMeshes().find(m => m.name === 'gunBarrel');

    switch (this.currentWeapon.type) {
      case 'pistol':
        if (frame) frame.scaling = new BABYLON.Vector3(1, 1, 1);
        if (slide) slide.scaling = new BABYLON.Vector3(1, 1, 1);
        if (barrel) barrel.scaling = new BABYLON.Vector3(1, 1, 0.8);
        this.gunParent.scaling = new BABYLON.Vector3(2.0, 2.0, 2.0);
        break;

      case 'rifle':
        if (frame) frame.scaling = new BABYLON.Vector3(1, 1, 1.5);
        if (slide) slide.scaling = new BABYLON.Vector3(1, 1, 1.5);
        if (barrel) barrel.scaling = new BABYLON.Vector3(1, 1, 2);
        this.gunParent.scaling = new BABYLON.Vector3(2.2, 2.2, 2.2);
        break;

      case 'shotgun':
        if (frame) frame.scaling = new BABYLON.Vector3(1.3, 1, 1.8);
        if (slide) slide.scaling = new BABYLON.Vector3(1.3, 1, 1.8);
        if (barrel) barrel.scaling = new BABYLON.Vector3(1.5, 1.5, 2.5);
        this.gunParent.scaling = new BABYLON.Vector3(2.5, 2.5, 2.5);
        break;

      case 'smg':
        if (frame) frame.scaling = new BABYLON.Vector3(0.9, 0.9, 1.2);
        if (slide) slide.scaling = new BABYLON.Vector3(0.9, 0.9, 1.2);
        if (barrel) barrel.scaling = new BABYLON.Vector3(0.8, 0.8, 1.5);
        this.gunParent.scaling = new BABYLON.Vector3(1.8, 1.8, 1.8);
        break;

      case 'sniper':
        if (frame) frame.scaling = new BABYLON.Vector3(1, 1, 2.5);
        if (slide) slide.scaling = new BABYLON.Vector3(1, 1, 2.5);
        if (barrel) barrel.scaling = new BABYLON.Vector3(0.8, 0.8, 4);
        this.gunParent.scaling = new BABYLON.Vector3(2.5, 2.5, 2.5);
        // 스코프 추가
        this.createSniperScope();
        break;
    }
  }

  toggleVehicleMount() {
    if (this.isMounted && this.mountedVehicle) {
      // 하차
      this.dismountVehicle();
    } else {
      // 탑승 가능한 탈것 찾기
      this.tryMountVehicle();
    }
  }

  tryMountVehicle() {
    if (!this.spawnedVehicles || !this.collisionCapsule) return;

    const playerPos = this.collisionCapsule.position;
    let closestVehicle = null;
    let closestDist = 5; // 탑승 거리

    this.spawnedVehicles.forEach(vehicle => {
      if (!vehicle.parent || vehicle.parent.isDisposed()) return;
      const dist = BABYLON.Vector3.Distance(playerPos, vehicle.parent.position);
      if (dist < closestDist && vehicle.canMount) {
        closestDist = dist;
        closestVehicle = vehicle;
      }
    });

    if (closestVehicle) {
      this.mountVehicle(closestVehicle);
    }
  }

  mountVehicle(vehicle) {
    this.isMounted = true;
    this.mountedVehicle = vehicle;

    // 플레이어 숨기기
    if (this.collisionCapsule) {
      this.collisionCapsule.setEnabled(false);
    }
    if (this.player) {
      this.player.setEnabled(false);
    }

    // 카메라를 탈것에 부착
    this.camera.parent = vehicle.parent;
    this.camera.position = new BABYLON.Vector3(0, vehicle.type === 'helicopter' ? 5 : 3, vehicle.type === 'helicopter' ? -8 : -6);

    // 총 숨기기
    if (this.gunParent) {
      this.gunParent.setEnabled(false);
    }

    console.log(`${vehicle.type} 탑승!`);
  }

  dismountVehicle() {
    if (!this.mountedVehicle) return;

    const vehiclePos = this.mountedVehicle.parent.position.clone();

    // 카메라 분리
    this.camera.parent = null;
    this.camera.position = vehiclePos.clone();
    this.camera.position.y += 2;
    this.camera.position.z -= 3;

    // 플레이어 복원
    if (this.collisionCapsule) {
      this.collisionCapsule.position = vehiclePos.clone();
      this.collisionCapsule.position.y += 2;
      this.collisionCapsule.position.x += 3;
      this.collisionCapsule.setEnabled(true);
    }
    if (this.player) {
      this.player.setEnabled(this.isFirstPerson ? false : true);
    }

    // 총 복원
    if (this.gunParent) {
      this.gunParent.setEnabled(this.isFirstPerson);
    }

    this.isMounted = false;
    this.mountedVehicle = null;

    console.log('탈것에서 하차!');
  }

  updateVehicleControls(deltaTime) {
    if (!this.isMounted || !this.mountedVehicle) return;

    const vehicle = this.mountedVehicle;
    const speed = vehicle.speed * deltaTime;
    const rotSpeed = 2 * deltaTime;

    // 이동
    if (this.inputMap['w']) {
      const forward = vehicle.parent.getDirection(BABYLON.Vector3.Forward());
      vehicle.parent.position.addInPlace(forward.scale(speed));
    }
    if (this.inputMap['s']) {
      const backward = vehicle.parent.getDirection(BABYLON.Vector3.Backward());
      vehicle.parent.position.addInPlace(backward.scale(speed * 0.5));
    }

    // 회전
    if (this.inputMap['a']) {
      vehicle.parent.rotation.y -= rotSpeed;
    }
    if (this.inputMap['d']) {
      vehicle.parent.rotation.y += rotSpeed;
    }

    // 헬기 상승/하강
    if (vehicle.canFly) {
      if (this.inputMap[' ']) {
        vehicle.parent.position.y += speed * 0.5;
      }
      if (this.inputMap['shift']) {
        vehicle.parent.position.y = Math.max(this.noise(vehicle.parent.position.x, vehicle.parent.position.z) + 2, vehicle.parent.position.y - speed * 0.5);
      }
    }

    // 탱크 발사
    if (vehicle.canShoot && this.isMouseDown) {
      if (!vehicle.shootCooldown || vehicle.shootCooldown <= 0) {
        this.fireVehicleWeapon(vehicle);
        vehicle.shootCooldown = 2; // 2초 쿨다운
      }
    }

    if (vehicle.shootCooldown > 0) {
      vehicle.shootCooldown -= deltaTime;
    }

    // 탑승 표시 업데이트
    if (vehicle.indicator) {
      vehicle.indicator.position = vehicle.parent.position.clone();
      vehicle.indicator.position.y = this.noise(vehicle.parent.position.x, vehicle.parent.position.z) + 0.1;
    }
  }

  fireVehicleWeapon(vehicle) {
    if (vehicle.type !== 'tank') return;

    const startPos = vehicle.parent.position.clone();
    startPos.y += 2.2;
    const forward = vehicle.parent.getDirection(BABYLON.Vector3.Forward());
    startPos.addInPlace(forward.scale(4));

    // 포탄 생성
    const shell = BABYLON.MeshBuilder.CreateSphere('tankShell', { diameter: 0.5 }, this.scene);
    shell.position = startPos;

    const shellMat = new BABYLON.StandardMaterial('shellMat', this.scene);
    shellMat.emissiveColor = new BABYLON.Color3(1, 0.5, 0);
    shell.material = shellMat;

    const direction = forward.clone();
    const shellSpeed = 50;
    let shellLife = 0;

    const animateShell = () => {
      shellLife += 0.016;
      shell.position.addInPlace(direction.scale(shellSpeed * 0.016));
      shell.position.y -= 5 * 0.016 * shellLife; // 중력

      // 지면 충돌 체크
      const groundY = this.noise(shell.position.x, shell.position.z);
      if (shell.position.y <= groundY || shellLife > 5) {
        this.createExplosion(shell.position.clone(), 15, vehicle.damage);
        shell.dispose();
        return;
      }

      // 적 충돌 체크
      this.enemies.forEach(enemy => {
        if (!enemy.mesh) return;
        const dist = BABYLON.Vector3.Distance(shell.position, enemy.mesh.position);
        if (dist < 2) {
          this.createExplosion(shell.position.clone(), 15, vehicle.damage);
          shell.dispose();
          return;
        }
      });

      if (!shell.isDisposed()) {
        requestAnimationFrame(animateShell);
      }
    };
    animateShell();

    // 발사 소리 및 효과
    this.playExplosionSound();
  }

  createSniperScope() {
    // 기존 스코프 제거
    if (this.sniperScope) {
      this.sniperScope.dispose();
    }

    // 스코프 본체
    this.sniperScope = BABYLON.MeshBuilder.CreateCylinder('scope', {
      height: 0.15,
      diameter: 0.04
    }, this.scene);
    this.sniperScope.rotation.x = Math.PI / 2;
    this.sniperScope.position = new BABYLON.Vector3(0, 0.08, 0);
    this.sniperScope.parent = this.gunParent;

    const scopeMat = new BABYLON.PBRMaterial('scopeMat', this.scene);
    scopeMat.albedoColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    scopeMat.metallic = 0.9;
    scopeMat.roughness = 0.2;
    this.sniperScope.material = scopeMat;
    this.sniperScope.renderingGroupId = 1;

    // 스코프 렌즈 (앞)
    const lensFront = BABYLON.MeshBuilder.CreateCylinder('lensFront', {
      height: 0.01,
      diameter: 0.045
    }, this.scene);
    lensFront.rotation.x = Math.PI / 2;
    lensFront.position = new BABYLON.Vector3(0, 0.08, 0.08);
    lensFront.parent = this.gunParent;

    const lensMat = new BABYLON.StandardMaterial('lensMat', this.scene);
    lensMat.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.5);
    lensMat.alpha = 0.5;
    lensFront.material = lensMat;
    lensFront.renderingGroupId = 1;
  }

  async createScene() {
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.5, 0.8, 0.9, 1);

    // 씬 최적화 설정
    this.scene.skipPointerMovePicking = true;
    this.scene.autoClear = false;
    this.scene.autoClearDepthAndStencil = true;
    this.scene.blockMaterialDirtyMechanism = true;

    // 물리 엔진 초기화
    const havokInstance = await HavokPhysics();
    const havokPlugin = new BABYLON.HavokPlugin(true, havokInstance);
    this.scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), havokPlugin);

    // FPS 카메라 설정
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

    // 포인터 락 설정
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

    // 마우스 버튼 이벤트 (연사용, 조준용)
    this.isMouseDown = false;
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isMouseDown = true;
      }
      // 마우스 오른쪽 버튼으로 조준 (ADS)
      if (e.button === 2) {
        this.isAiming = true;
      }
    });
    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isMouseDown = false;
      }
      if (e.button === 2) {
        this.isAiming = false;
      }
    });
    // 우클릭 컨텍스트 메뉴 방지
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // 조명
    const hemisphericLight = new BABYLON.HemisphericLight('hemiLight', new BABYLON.Vector3(0, 1, 0), this.scene);
    hemisphericLight.intensity = 0.5;
    hemisphericLight.groundColor = new BABYLON.Color3(0.3, 0.4, 0.3);

    const sunLight = new BABYLON.DirectionalLight('sunLight', new BABYLON.Vector3(-1, -2, -1), this.scene);
    sunLight.position = new BABYLON.Vector3(50, 100, 50);
    sunLight.intensity = 1.2;

    this.shadowGenerator = new BABYLON.ShadowGenerator(2048, sunLight);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 32;

    // 안개 효과
    this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.003;
    this.scene.fogColor = new BABYLON.Color3(0.6, 0.7, 0.8);
  }

  // 노이즈 함수 (절차적 지형 생성용)
  noise(x, z) {
    const sin1 = Math.sin(x * 0.1) * Math.cos(z * 0.1);
    const sin2 = Math.sin(x * 0.05 + 1.5) * Math.cos(z * 0.07 + 2.1);
    const sin3 = Math.sin(x * 0.02) * Math.sin(z * 0.02);
    return (sin1 * 0.5 + sin2 * 0.3 + sin3 * 0.2) * 3;
  }

  createProceduralTerrain() {
    this.groundMeshes = [];
    this.ammoPickups = [];

    // 초기 청크 로드
    this.updateTerrainChunks(new BABYLON.Vector3(0, 0, 0));
  }

  updateTerrainChunks(playerPos) {
    const chunkX = Math.floor(playerPos.x / this.chunkSize);
    const chunkZ = Math.floor(playerPos.z / this.chunkSize);

    // 주변 3x3 청크 로드
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const cx = chunkX + dx;
        const cz = chunkZ + dz;
        const key = `${cx},${cz}`;

        if (!this.loadedChunks.has(key)) {
          this.createTerrainChunk(cx, cz);
          this.loadedChunks.add(key);
        }
      }
    }
  }

  createTerrainChunk(chunkX, chunkZ) {
    const offsetX = chunkX * this.chunkSize;
    const offsetZ = chunkZ * this.chunkSize;

    // 지형 생성 (Ground 사용)
    const ground = BABYLON.MeshBuilder.CreateGround(
      `ground_${chunkX}_${chunkZ}`,
      {
        width: this.chunkSize,
        height: this.chunkSize,
        subdivisions: 20,
        updatable: true
      },
      this.scene
    );

    ground.position = new BABYLON.Vector3(offsetX, 0, offsetZ);

    // 절차적 높이 적용
    const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    for (let i = 0; i < positions.length; i += 3) {
      const worldX = positions[i] + offsetX;
      const worldZ = positions[i + 2] + offsetZ;
      positions[i + 1] = this.noise(worldX, worldZ);
    }
    ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    ground.refreshBoundingInfo();

    // 물리 적용 (즉시)
    new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.MESH, { mass: 0, restitution: 0.2, friction: 0.8 }, this.scene);

    // 잔디 텍스처 로드
    const grassTexture = new BABYLON.Texture("textures/grass_path_2_diff_4k.jpg", this.scene);
    grassTexture.uScale = 8;
    grassTexture.vScale = 8;

    const roughnessTexture = new BABYLON.Texture("textures/grass_path_2_rough_4k.jpg", this.scene);
    roughnessTexture.uScale = 8;
    roughnessTexture.vScale = 8;

    const groundMat = new BABYLON.PBRMaterial(`groundMat_${chunkX}_${chunkZ}`, this.scene);
    groundMat.albedoTexture = grassTexture;
    groundMat.metallicTexture = roughnessTexture;
    groundMat.useRoughnessFromMetallicTextureGreen = true;
    groundMat.roughness = 1;
    groundMat.metallic = 0;
    ground.material = groundMat;
    ground.receiveShadows = true;

    this.groundMeshes.push(ground);

    // 환경 오브젝트 생성
    this.createChunkObjects(offsetX, offsetZ);

    // 탄약 상자 배치
    this.createChunkAmmo(offsetX, offsetZ, chunkX, chunkZ);
  }

  createChunkObjects(offsetX, offsetZ) {
    const seed = offsetX * 1000 + offsetZ;
    const random = (i) => {
      const x = Math.sin(seed + i * 127.1) * 43758.5453;
      return x - Math.floor(x);
    };

    // 나무 생성
    const treeCount = 5 + Math.floor(random(0) * 5);
    for (let i = 0; i < treeCount; i++) {
      const x = offsetX + (random(i * 3) - 0.5) * this.chunkSize * 0.9;
      const z = offsetZ + (random(i * 3 + 1) - 0.5) * this.chunkSize * 0.9;
      const y = this.noise(x, z);

      if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;

      const treeHeight = 4 + random(i * 3 + 2) * 4;
      const trunk = BABYLON.MeshBuilder.CreateCylinder(`trunk_${x}_${z}`, {
        height: treeHeight,
        diameter: 0.4 + random(i) * 0.4,
      }, this.scene);
      trunk.position = new BABYLON.Vector3(x, y + treeHeight / 2, z);

      const trunkMat = new BABYLON.PBRMaterial(`trunkMat_${x}_${z}`, this.scene);
      trunkMat.albedoColor = new BABYLON.Color3(0.25, 0.15, 0.05);
      trunkMat.roughness = 0.98;
      trunk.material = trunkMat;

      new BABYLON.PhysicsAggregate(trunk, BABYLON.PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);
      this.shadowGenerator.addShadowCaster(trunk);

      // 나뭇잎
      const leafCount = 2 + Math.floor(random(i + 100) * 3);
      for (let j = 0; j < leafCount; j++) {
        const leafSize = 2 + random(i * 10 + j) * 2;
        const leaves = BABYLON.MeshBuilder.CreateSphere(`leaves_${x}_${z}_${j}`, {
          diameter: leafSize,
        }, this.scene);
        leaves.position = new BABYLON.Vector3(
          x + (random(i * 10 + j + 1) - 0.5) * 2,
          y + treeHeight + random(i * 10 + j + 2) * 2,
          z + (random(i * 10 + j + 3) - 0.5) * 2
        );

        const leavesMat = new BABYLON.PBRMaterial(`leavesMat_${x}_${z}_${j}`, this.scene);
        leavesMat.albedoColor = new BABYLON.Color3(0.1, 0.35 + random(i + j) * 0.15, 0.08);
        leavesMat.roughness = 0.9;
        leaves.material = leavesMat;
        this.shadowGenerator.addShadowCaster(leaves);
      }
    }

    // 바위 생성
    const rockCount = 3 + Math.floor(random(50) * 4);
    for (let i = 0; i < rockCount; i++) {
      const x = offsetX + (random(i * 5 + 100) - 0.5) * this.chunkSize * 0.9;
      const z = offsetZ + (random(i * 5 + 101) - 0.5) * this.chunkSize * 0.9;
      const y = this.noise(x, z);

      if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;

      const rockSize = 0.5 + random(i * 5 + 102) * 1.5;
      const rock = BABYLON.MeshBuilder.CreatePolyhedron(`rock_${x}_${z}`, {
        type: Math.floor(random(i * 5 + 103) * 3),
        size: rockSize,
      }, this.scene);
      rock.position = new BABYLON.Vector3(x, y + rockSize * 0.4, z);
      rock.rotation = new BABYLON.Vector3(random(i) * 0.3, random(i + 1) * Math.PI * 2, random(i + 2) * 0.3);

      const rockMat = new BABYLON.PBRMaterial(`rockMat_${x}_${z}`, this.scene);
      const gray = 0.35 + random(i * 5 + 104) * 0.2;
      rockMat.albedoColor = new BABYLON.Color3(gray, gray, gray + 0.05);
      rockMat.roughness = 0.95;
      rock.material = rockMat;

      new BABYLON.PhysicsAggregate(rock, BABYLON.PhysicsShapeType.CONVEX_HULL, { mass: 0 }, this.scene);
      this.shadowGenerator.addShadowCaster(rock);
    }

    // 폭발 배럴 생성
    if (!this.explosiveBarrels) this.explosiveBarrels = [];
    const barrelCount = Math.floor(random(200) * 3);
    for (let i = 0; i < barrelCount; i++) {
      const x = offsetX + (random(i * 7 + 300) - 0.5) * this.chunkSize * 0.8;
      const z = offsetZ + (random(i * 7 + 301) - 0.5) * this.chunkSize * 0.8;
      const y = this.noise(x, z);

      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;

      this.createExplosiveBarrel(new BABYLON.Vector3(x, y + 0.75, z));
    }

    // 엄폐물 (벽/장벽) 생성
    if (!this.coverObjects) this.coverObjects = [];
    const coverCount = Math.floor(random(250) * 2);
    for (let i = 0; i < coverCount; i++) {
      const x = offsetX + (random(i * 11 + 400) - 0.5) * this.chunkSize * 0.7;
      const z = offsetZ + (random(i * 11 + 401) - 0.5) * this.chunkSize * 0.7;
      const y = this.noise(x, z);

      if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;

      this.createCoverWall(new BABYLON.Vector3(x, y, z), random(i * 11 + 402) * Math.PI);
    }

    // 점프대 생성
    if (random(350) > 0.7) {
      const x = offsetX + (random(351) - 0.5) * this.chunkSize * 0.6;
      const z = offsetZ + (random(352) - 0.5) * this.chunkSize * 0.6;
      const y = this.noise(x, z);

      if (Math.abs(x) > 8 || Math.abs(z) > 8) {
        this.createJumpPad(new BABYLON.Vector3(x, y + 0.1, z));
      }
    }

    // 대포/터렛 생성
    if (!this.turrets) this.turrets = [];
    if (random(400) > 0.85) {
      const x = offsetX + (random(401) - 0.5) * this.chunkSize * 0.5;
      const z = offsetZ + (random(402) - 0.5) * this.chunkSize * 0.5;
      const y = this.noise(x, z);

      if (Math.abs(x) > 10 || Math.abs(z) > 10) {
        this.createTurret(new BABYLON.Vector3(x, y, z));
      }
    }

    // 체력 회복 아이템
    if (!this.healthPickups) this.healthPickups = [];
    if (random(450) > 0.7) {
      const x = offsetX + (random(451) - 0.5) * this.chunkSize * 0.6;
      const z = offsetZ + (random(452) - 0.5) * this.chunkSize * 0.6;
      const y = this.noise(x, z) + 0.5;

      this.createHealthPickup(new BABYLON.Vector3(x, y, z));
    }

    // 탈것 생성
    if (!this.spawnedVehicles) this.spawnedVehicles = [];
    if (random(500) > 0.85) {
      const x = offsetX + (random(501) - 0.5) * this.chunkSize * 0.5;
      const z = offsetZ + (random(502) - 0.5) * this.chunkSize * 0.5;
      const y = this.noise(x, z);

      if (Math.abs(x) > 15 || Math.abs(z) > 15) {
        const vehicleType = random(503) < 0.5 ? 'car' : (random(504) < 0.7 ? 'tank' : 'helicopter');
        this.createVehicle(new BABYLON.Vector3(x, y, z), vehicleType);
      }
    }

    // 건물 생성
    if (!this.buildings) this.buildings = [];
    const buildingChance = random(600);
    if (buildingChance > 0.7) {
      const x = offsetX + (random(601) - 0.5) * this.chunkSize * 0.6;
      const z = offsetZ + (random(602) - 0.5) * this.chunkSize * 0.6;
      const y = this.noise(x, z);

      if (Math.abs(x) > 20 || Math.abs(z) > 20) {
        const buildingType = random(603) < 0.4 ? 'apartment' : (random(604) < 0.6 ? 'house' : 'tower');
        this.createBuilding(new BABYLON.Vector3(x, y, z), buildingType, random(605));
      }
    }
  }

  createExplosiveBarrel(position) {
    const barrel = BABYLON.MeshBuilder.CreateCylinder('barrel', {
      height: 1.5,
      diameter: 0.8
    }, this.scene);
    barrel.position = position;

    const barrelMat = new BABYLON.PBRMaterial('barrelMat' + Date.now(), this.scene);
    barrelMat.albedoColor = new BABYLON.Color3(0.8, 0.2, 0.1);
    barrelMat.metallic = 0.7;
    barrelMat.roughness = 0.4;
    barrel.material = barrelMat;

    // 경고 표시
    const warning = BABYLON.MeshBuilder.CreatePlane('warning', { size: 0.4 }, this.scene);
    warning.position.y = 0.3;
    warning.position.z = 0.41;
    warning.parent = barrel;
    const warnMat = new BABYLON.StandardMaterial('warnMat', this.scene);
    warnMat.emissiveColor = new BABYLON.Color3(1, 0.8, 0);
    warnMat.disableLighting = true;
    warning.material = warnMat;

    new BABYLON.PhysicsAggregate(barrel, BABYLON.PhysicsShapeType.CYLINDER, { mass: 50, restitution: 0.1 }, this.scene);
    this.shadowGenerator.addShadowCaster(barrel);

    this.explosiveBarrels.push({
      mesh: barrel,
      health: 30,
      exploded: false
    });
  }

  createCoverWall(position, rotation) {
    // 모래주머니/벽
    const wall = BABYLON.MeshBuilder.CreateBox('cover', {
      width: 3,
      height: 1.5,
      depth: 0.6
    }, this.scene);
    wall.position = position.clone();
    wall.position.y += 0.75;
    wall.rotation.y = rotation;

    const wallMat = new BABYLON.PBRMaterial('wallMat' + Date.now(), this.scene);
    wallMat.albedoColor = new BABYLON.Color3(0.5, 0.45, 0.35);
    wallMat.roughness = 0.95;
    wall.material = wallMat;

    new BABYLON.PhysicsAggregate(wall, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    this.shadowGenerator.addShadowCaster(wall);

    this.coverObjects.push(wall);
  }

  createJumpPad(position) {
    // 점프대 베이스
    const pad = BABYLON.MeshBuilder.CreateCylinder('jumpPad', {
      height: 0.2,
      diameter: 2
    }, this.scene);
    pad.position = position;

    const padMat = new BABYLON.StandardMaterial('padMat' + Date.now(), this.scene);
    padMat.emissiveColor = new BABYLON.Color3(0, 0.8, 1);
    padMat.alpha = 0.8;
    pad.material = padMat;

    // 글로우 효과
    const glow = BABYLON.MeshBuilder.CreateTorus('padGlow', {
      diameter: 2,
      thickness: 0.1
    }, this.scene);
    glow.position = position.clone();
    glow.position.y += 0.15;
    const glowMat = new BABYLON.StandardMaterial('glowMat', this.scene);
    glowMat.emissiveColor = new BABYLON.Color3(0, 1, 1);
    glowMat.alpha = 0.6;
    glow.material = glowMat;

    // 애니메이션
    this.scene.onBeforeRenderObservable.add(() => {
      if (pad && !pad.isDisposed()) {
        glow.rotation.y += 0.05;
        padMat.emissiveColor = new BABYLON.Color3(
          0,
          0.5 + Math.sin(Date.now() * 0.005) * 0.3,
          0.8 + Math.sin(Date.now() * 0.005) * 0.2
        );
      }
    });

    // 점프대 배열 저장
    if (!this.jumpPads) this.jumpPads = [];
    this.jumpPads.push({
      mesh: pad,
      position: position.clone(),
      power: 25
    });
  }

  createTurret(position) {
    // 터렛 베이스
    const base = BABYLON.MeshBuilder.CreateCylinder('turretBase', {
      height: 0.5,
      diameter: 1.5
    }, this.scene);
    base.position = position.clone();
    base.position.y += 0.25;

    const baseMat = new BABYLON.PBRMaterial('baseMat' + Date.now(), this.scene);
    baseMat.albedoColor = new BABYLON.Color3(0.3, 0.3, 0.35);
    baseMat.metallic = 0.8;
    baseMat.roughness = 0.3;
    base.material = baseMat;

    // 터렛 포신
    const barrel = BABYLON.MeshBuilder.CreateCylinder('turretBarrel', {
      height: 1.5,
      diameter: 0.3
    }, this.scene);
    barrel.rotation.x = Math.PI / 2;
    barrel.position = position.clone();
    barrel.position.y += 0.8;
    barrel.position.z += 0.5;

    barrel.material = baseMat;

    new BABYLON.PhysicsAggregate(base, BABYLON.PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);
    this.shadowGenerator.addShadowCaster(base);
    this.shadowGenerator.addShadowCaster(barrel);

    this.turrets.push({
      base,
      barrel,
      position: position.clone(),
      canUse: true,
      cooldown: 0
    });
  }

  createHealthPickup(position) {
    // 체력 박스
    const box = BABYLON.MeshBuilder.CreateBox('healthBox', {
      size: 0.5
    }, this.scene);
    box.position = position;

    const boxMat = new BABYLON.StandardMaterial('healthMat' + Date.now(), this.scene);
    boxMat.emissiveColor = new BABYLON.Color3(0.2, 1, 0.2);
    boxMat.alpha = 0.8;
    box.material = boxMat;

    // + 표시
    const cross1 = BABYLON.MeshBuilder.CreateBox('cross1', {
      width: 0.3, height: 0.08, depth: 0.52
    }, this.scene);
    cross1.parent = box;
    const cross2 = BABYLON.MeshBuilder.CreateBox('cross2', {
      width: 0.08, height: 0.3, depth: 0.52
    }, this.scene);
    cross2.parent = box;

    const crossMat = new BABYLON.StandardMaterial('crossMat', this.scene);
    crossMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
    cross1.material = crossMat;
    cross2.material = crossMat;

    // 회전 애니메이션
    this.scene.onBeforeRenderObservable.add(() => {
      if (box && !box.isDisposed()) {
        box.rotation.y += 0.02;
        box.position.y = position.y + Math.sin(Date.now() * 0.003) * 0.2;
      }
    });

    this.healthPickups.push({
      mesh: box,
      position: position.clone(),
      healAmount: 30
    });
  }

  createVehicle(position, type) {
    const vehicleParent = new BABYLON.TransformNode(`vehicle_${type}_${Date.now()}`, this.scene);
    vehicleParent.position = position.clone();

    const metalMat = new BABYLON.PBRMaterial('vehicleMetal' + Date.now(), this.scene);
    metalMat.metallic = 0.8;
    metalMat.roughness = 0.3;

    let vehicle = { parent: vehicleParent, type, canMount: true, health: 100 };

    switch (type) {
      case 'car':
        metalMat.albedoColor = new BABYLON.Color3(0.2, 0.3, 0.8);
        vehicle.speed = 30;
        vehicle.health = 150;

        // 차체
        const carBody = BABYLON.MeshBuilder.CreateBox('carBody', {
          width: 2.5, height: 1.2, depth: 5
        }, this.scene);
        carBody.position.y = 0.8;
        carBody.parent = vehicleParent;
        carBody.material = metalMat;

        // 지붕
        const carRoof = BABYLON.MeshBuilder.CreateBox('carRoof', {
          width: 2.2, height: 0.8, depth: 2.5
        }, this.scene);
        carRoof.position = new BABYLON.Vector3(0, 1.8, -0.3);
        carRoof.parent = vehicleParent;
        carRoof.material = metalMat;

        // 바퀴 4개
        const wheelMat = new BABYLON.PBRMaterial('wheelMat', this.scene);
        wheelMat.albedoColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        wheelMat.roughness = 0.9;

        const wheelPositions = [
          new BABYLON.Vector3(-1.2, 0.4, 1.5),
          new BABYLON.Vector3(1.2, 0.4, 1.5),
          new BABYLON.Vector3(-1.2, 0.4, -1.5),
          new BABYLON.Vector3(1.2, 0.4, -1.5)
        ];

        wheelPositions.forEach((pos, i) => {
          const wheel = BABYLON.MeshBuilder.CreateCylinder(`wheel${i}`, {
            height: 0.3, diameter: 0.8
          }, this.scene);
          wheel.rotation.z = Math.PI / 2;
          wheel.position = pos;
          wheel.parent = vehicleParent;
          wheel.material = wheelMat;
        });

        // 헤드라이트
        const headlightMat = new BABYLON.StandardMaterial('headlightMat', this.scene);
        headlightMat.emissiveColor = new BABYLON.Color3(1, 1, 0.8);
        [-0.8, 0.8].forEach(x => {
          const light = BABYLON.MeshBuilder.CreateSphere('headlight', { diameter: 0.25 }, this.scene);
          light.position = new BABYLON.Vector3(x, 0.7, 2.5);
          light.parent = vehicleParent;
          light.material = headlightMat;
        });

        new BABYLON.PhysicsAggregate(carBody, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, this.scene);
        this.shadowGenerator.addShadowCaster(carBody);
        break;

      case 'tank':
        metalMat.albedoColor = new BABYLON.Color3(0.3, 0.35, 0.25);
        vehicle.speed = 15;
        vehicle.health = 500;
        vehicle.canShoot = true;
        vehicle.damage = 100;

        // 탱크 몸체
        const tankBody = BABYLON.MeshBuilder.CreateBox('tankBody', {
          width: 3.5, height: 1.5, depth: 6
        }, this.scene);
        tankBody.position.y = 1;
        tankBody.parent = vehicleParent;
        tankBody.material = metalMat;

        // 포탑
        const turret = BABYLON.MeshBuilder.CreateCylinder('tankTurret', {
          height: 1, diameter: 2.5
        }, this.scene);
        turret.position = new BABYLON.Vector3(0, 2, -0.5);
        turret.parent = vehicleParent;
        turret.material = metalMat;

        // 포신
        const cannon = BABYLON.MeshBuilder.CreateCylinder('tankCannon', {
          height: 4, diameter: 0.4
        }, this.scene);
        cannon.rotation.x = Math.PI / 2;
        cannon.position = new BABYLON.Vector3(0, 2.2, 2);
        cannon.parent = vehicleParent;
        cannon.material = metalMat;

        // 궤도
        const trackMat = new BABYLON.PBRMaterial('trackMat', this.scene);
        trackMat.albedoColor = new BABYLON.Color3(0.15, 0.15, 0.15);
        trackMat.roughness = 0.95;

        [-1.5, 1.5].forEach(x => {
          const track = BABYLON.MeshBuilder.CreateBox('track', {
            width: 0.8, height: 0.8, depth: 5.5
          }, this.scene);
          track.position = new BABYLON.Vector3(x, 0.4, 0);
          track.parent = vehicleParent;
          track.material = trackMat;
        });

        new BABYLON.PhysicsAggregate(tankBody, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, this.scene);
        this.shadowGenerator.addShadowCaster(tankBody);
        break;

      case 'helicopter':
        metalMat.albedoColor = new BABYLON.Color3(0.4, 0.4, 0.35);
        vehicle.speed = 40;
        vehicle.health = 200;
        vehicle.canFly = true;

        // 헬기 본체
        const heliBody = BABYLON.MeshBuilder.CreateBox('heliBody', {
          width: 2, height: 2, depth: 6
        }, this.scene);
        heliBody.position.y = 2;
        heliBody.parent = vehicleParent;
        heliBody.material = metalMat;

        // 조종석 (유리)
        const glassMat = new BABYLON.StandardMaterial('glassMat', this.scene);
        glassMat.diffuseColor = new BABYLON.Color3(0.3, 0.5, 0.7);
        glassMat.alpha = 0.5;

        const cockpit = BABYLON.MeshBuilder.CreateSphere('cockpit', {
          diameter: 1.8, slice: 0.5
        }, this.scene);
        cockpit.rotation.x = -Math.PI / 2;
        cockpit.position = new BABYLON.Vector3(0, 2.2, 2.5);
        cockpit.parent = vehicleParent;
        cockpit.material = glassMat;

        // 꼬리
        const tail = BABYLON.MeshBuilder.CreateBox('heliTail', {
          width: 0.6, height: 0.8, depth: 4
        }, this.scene);
        tail.position = new BABYLON.Vector3(0, 2.2, -4.5);
        tail.parent = vehicleParent;
        tail.material = metalMat;

        // 메인 로터
        const rotorMat = new BABYLON.PBRMaterial('rotorMat', this.scene);
        rotorMat.albedoColor = new BABYLON.Color3(0.2, 0.2, 0.2);

        const mainRotor = BABYLON.MeshBuilder.CreateBox('mainRotor', {
          width: 10, height: 0.1, depth: 0.3
        }, this.scene);
        mainRotor.position = new BABYLON.Vector3(0, 3.5, 0);
        mainRotor.parent = vehicleParent;
        mainRotor.material = rotorMat;
        vehicle.mainRotor = mainRotor;

        // 테일 로터
        const tailRotor = BABYLON.MeshBuilder.CreateBox('tailRotor', {
          width: 0.1, height: 1.5, depth: 0.2
        }, this.scene);
        tailRotor.position = new BABYLON.Vector3(0.4, 2.5, -6.3);
        tailRotor.parent = vehicleParent;
        tailRotor.material = rotorMat;
        vehicle.tailRotor = tailRotor;

        // 스키드 (착륙 장치)
        [-0.8, 0.8].forEach(x => {
          const skid = BABYLON.MeshBuilder.CreateBox('skid', {
            width: 0.1, height: 0.1, depth: 3
          }, this.scene);
          skid.position = new BABYLON.Vector3(x, 0.5, 0);
          skid.parent = vehicleParent;
          skid.material = metalMat;
        });

        new BABYLON.PhysicsAggregate(heliBody, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, this.scene);
        this.shadowGenerator.addShadowCaster(heliBody);

        // 로터 회전 애니메이션
        this.scene.onBeforeRenderObservable.add(() => {
          if (mainRotor && !mainRotor.isDisposed()) {
            mainRotor.rotation.y += 0.3;
          }
          if (tailRotor && !tailRotor.isDisposed()) {
            tailRotor.rotation.x += 0.5;
          }
        });
        break;
    }

    // 탑승 가능 표시
    const indicator = BABYLON.MeshBuilder.CreateTorus('mountIndicator', {
      diameter: 4, thickness: 0.1
    }, this.scene);
    indicator.position = position.clone();
    indicator.position.y += 0.1;
    const indicatorMat = new BABYLON.StandardMaterial('indicatorMat', this.scene);
    indicatorMat.emissiveColor = new BABYLON.Color3(0, 1, 0.5);
    indicatorMat.alpha = 0.5;
    indicator.material = indicatorMat;
    vehicle.indicator = indicator;

    // 차량 체력바 생성 (Box로 변경하여 항상 보이게)
    const vHealthBarHeight = type === 'helicopter' ? 5 : (type === 'tank' ? 4 : 3);

    const vHealthBarContainer = new BABYLON.TransformNode('vHealthBarContainer', this.scene);
    vHealthBarContainer.parent = vehicleParent;
    vHealthBarContainer.position.y = vHealthBarHeight;
    vHealthBarContainer.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;

    const vHealthBarBg = BABYLON.MeshBuilder.CreateBox('vehicleHealthBarBg', { width: 3, height: 0.3, depth: 0.08 }, this.scene);
    vHealthBarBg.parent = vHealthBarContainer;
    const vHealthBarBgMat = new BABYLON.StandardMaterial('vHealthBarBgMat' + Date.now(), this.scene);
    vHealthBarBgMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    vHealthBarBgMat.emissiveColor = new BABYLON.Color3(0.15, 0.15, 0.15);
    vHealthBarBgMat.disableLighting = true;
    vHealthBarBg.material = vHealthBarBgMat;

    const vHealthBar = BABYLON.MeshBuilder.CreateBox('vehicleHealthBar', { width: 2.8, height: 0.25, depth: 0.1 }, this.scene);
    vHealthBar.parent = vHealthBarContainer;
    vHealthBar.position.z = -0.01;
    const vHealthBarMat = new BABYLON.StandardMaterial('vHealthBarMat' + Date.now(), this.scene);
    vHealthBarMat.diffuseColor = new BABYLON.Color3(0.2, 0.9, 1);
    vHealthBarMat.emissiveColor = new BABYLON.Color3(0.1, 0.7, 0.8);
    vHealthBarMat.disableLighting = true;
    vHealthBar.material = vHealthBarMat;

    vehicle.healthBar = vHealthBar;
    vehicle.healthBarBg = vHealthBarBg;
    vehicle.healthBarContainer = vHealthBarContainer;
    vehicle.maxHealth = vehicle.health;
    vehicle.isDestroyed = false;

    this.spawnedVehicles.push(vehicle);
  }

  createBuilding(position, type, seed) {
    const buildingParent = new BABYLON.TransformNode(`building_${type}_${Date.now()}`, this.scene);
    buildingParent.position = position.clone();

    const concreteMat = new BABYLON.PBRMaterial('concreteMat' + Date.now(), this.scene);
    concreteMat.roughness = 0.95;
    concreteMat.metallic = 0;

    const windowMat = new BABYLON.StandardMaterial('windowMat' + Date.now(), this.scene);
    windowMat.emissiveColor = new BABYLON.Color3(0.8, 0.9, 1);
    windowMat.alpha = 0.7;

    switch (type) {
      case 'apartment':
        const floors = 5 + Math.floor(seed * 10);
        const width = 12 + seed * 8;
        const depth = 10 + seed * 5;
        concreteMat.albedoColor = new BABYLON.Color3(0.7, 0.7, 0.75);

        // 건물 본체
        const apartmentBody = BABYLON.MeshBuilder.CreateBox('apartmentBody', {
          width: width, height: floors * 3, depth: depth
        }, this.scene);
        apartmentBody.position.y = floors * 1.5;
        apartmentBody.parent = buildingParent;
        apartmentBody.material = concreteMat;

        // 창문들
        for (let f = 0; f < floors; f++) {
          for (let w = 0; w < Math.floor(width / 3); w++) {
            const window = BABYLON.MeshBuilder.CreateBox('window', {
              width: 1.5, height: 2, depth: 0.1
            }, this.scene);
            window.position = new BABYLON.Vector3(
              -width / 2 + 2 + w * 3,
              f * 3 + 2,
              depth / 2 + 0.05
            );
            window.parent = buildingParent;
            window.material = windowMat;
          }
        }

        // 옥상 구조물
        const rooftop = BABYLON.MeshBuilder.CreateBox('rooftop', {
          width: 3, height: 2, depth: 3
        }, this.scene);
        rooftop.position.y = floors * 3 + 1;
        rooftop.parent = buildingParent;
        rooftop.material = concreteMat;

        new BABYLON.PhysicsAggregate(apartmentBody, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, this.scene);
        this.shadowGenerator.addShadowCaster(apartmentBody);
        break;

      case 'house':
        concreteMat.albedoColor = new BABYLON.Color3(0.85, 0.8, 0.7);

        // 집 본체
        const houseBody = BABYLON.MeshBuilder.CreateBox('houseBody', {
          width: 8, height: 4, depth: 10
        }, this.scene);
        houseBody.position.y = 2;
        houseBody.parent = buildingParent;
        houseBody.material = concreteMat;

        // 지붕
        const roofMat = new BABYLON.PBRMaterial('roofMat', this.scene);
        roofMat.albedoColor = new BABYLON.Color3(0.5, 0.25, 0.15);
        roofMat.roughness = 0.9;

        const roof = BABYLON.MeshBuilder.CreateCylinder('roof', {
          height: 10, diameter: 12, tessellation: 4
        }, this.scene);
        roof.rotation.x = Math.PI / 2;
        roof.rotation.y = Math.PI / 4;
        roof.scaling = new BABYLON.Vector3(0.8, 1, 0.4);
        roof.position.y = 5.5;
        roof.parent = buildingParent;
        roof.material = roofMat;

        // 문
        const doorMat = new BABYLON.PBRMaterial('doorMat', this.scene);
        doorMat.albedoColor = new BABYLON.Color3(0.4, 0.25, 0.15);
        const door = BABYLON.MeshBuilder.CreateBox('door', {
          width: 1.2, height: 2.5, depth: 0.15
        }, this.scene);
        door.position = new BABYLON.Vector3(0, 1.25, 5.05);
        door.parent = buildingParent;
        door.material = doorMat;

        // 창문
        [[-2.5, 2.5], [2.5, 2.5]].forEach(([x, y]) => {
          const window = BABYLON.MeshBuilder.CreateBox('houseWindow', {
            width: 1.5, height: 1.5, depth: 0.1
          }, this.scene);
          window.position = new BABYLON.Vector3(x, y, 5.05);
          window.parent = buildingParent;
          window.material = windowMat;
        });

        new BABYLON.PhysicsAggregate(houseBody, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, this.scene);
        this.shadowGenerator.addShadowCaster(houseBody);
        this.shadowGenerator.addShadowCaster(roof);
        break;

      case 'tower':
        const towerHeight = 20 + seed * 30;
        concreteMat.albedoColor = new BABYLON.Color3(0.4, 0.45, 0.5);

        // 타워 본체
        const towerBody = BABYLON.MeshBuilder.CreateCylinder('towerBody', {
          height: towerHeight, diameter: 8, tessellation: 8
        }, this.scene);
        towerBody.position.y = towerHeight / 2;
        towerBody.parent = buildingParent;
        towerBody.material = concreteMat;

        // 상부 구조물 (물탱크/안테나)
        const topStructure = BABYLON.MeshBuilder.CreateCylinder('topStructure', {
          height: 3, diameter: 5
        }, this.scene);
        topStructure.position.y = towerHeight + 1.5;
        topStructure.parent = buildingParent;
        topStructure.material = concreteMat;

        // 안테나
        const antenna = BABYLON.MeshBuilder.CreateCylinder('antenna', {
          height: 5, diameter: 0.3
        }, this.scene);
        antenna.position.y = towerHeight + 5.5;
        antenna.parent = buildingParent;
        const antennaMat = new BABYLON.StandardMaterial('antennaMat', this.scene);
        antennaMat.emissiveColor = new BABYLON.Color3(1, 0, 0);
        antenna.material = antennaMat;

        // 빨간 경고등
        const warningLight = BABYLON.MeshBuilder.CreateSphere('warningLight', {
          diameter: 0.5
        }, this.scene);
        warningLight.position.y = towerHeight + 8;
        warningLight.parent = buildingParent;
        warningLight.material = antennaMat;

        // 점멸 효과
        this.scene.onBeforeRenderObservable.add(() => {
          if (warningLight && !warningLight.isDisposed()) {
            antennaMat.emissiveColor = new BABYLON.Color3(
              Math.sin(Date.now() * 0.005) > 0 ? 1 : 0.2, 0, 0
            );
          }
        });

        new BABYLON.PhysicsAggregate(towerBody, BABYLON.PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);
        this.shadowGenerator.addShadowCaster(towerBody);
        break;
    }

    this.buildings.push({ parent: buildingParent, type });
  }

  createChunkAmmo(offsetX, offsetZ, chunkX, chunkZ) {
    const seed = chunkX * 10000 + chunkZ;
    const random = (i) => {
      const x = Math.sin(seed + i * 127.1) * 43758.5453;
      return x - Math.floor(x);
    };

    const ammoCount = 1 + Math.floor(random(0) * 2);
    for (let i = 0; i < ammoCount; i++) {
      const x = offsetX + (random(i * 2 + 200) - 0.5) * this.chunkSize * 0.8;
      const z = offsetZ + (random(i * 2 + 201) - 0.5) * this.chunkSize * 0.8;
      const y = this.noise(x, z) + 0.5;

      this.createAmmoBox(new BABYLON.Vector3(x, y, z), `${chunkX}_${chunkZ}_${i}`);
    }
  }

  createAmmoBox(position, id) {
    const ammoBox = BABYLON.MeshBuilder.CreateBox(`ammoBox_${id}`, {
      width: 0.4,
      height: 0.25,
      depth: 0.3
    }, this.scene);
    ammoBox.position = position.clone();

    const ammoMat = new BABYLON.PBRMaterial(`ammoMat_${id}`, this.scene);
    ammoMat.albedoColor = new BABYLON.Color3(0.15, 0.3, 0.15);
    ammoMat.metallic = 0.3;
    ammoMat.roughness = 0.6;
    ammoBox.material = ammoMat;

    const bulletDecor = BABYLON.MeshBuilder.CreateCylinder(`bulletDecor_${id}`, {
      height: 0.15,
      diameter: 0.06
    }, this.scene);
    bulletDecor.position = position.clone();
    bulletDecor.position.y += 0.2;
    bulletDecor.rotation.z = Math.PI / 2;

    const bulletMat = new BABYLON.PBRMaterial(`bulletMat_${id}`, this.scene);
    bulletMat.albedoColor = new BABYLON.Color3(0.85, 0.65, 0.2);
    bulletMat.metallic = 0.9;
    bulletMat.roughness = 0.2;
    bulletDecor.material = bulletMat;

    const glowLayer = this.scene.getGlowLayerByName('glow') || new BABYLON.GlowLayer('glow', this.scene);
    glowLayer.addIncludedOnlyMesh(bulletDecor);

    // 회전만 (점프 제거)
    this.scene.onBeforeRenderObservable.add(() => {
      if (ammoBox && !ammoBox.isDisposed()) {
        ammoBox.rotation.y += 0.02;
        bulletDecor.rotation.y += 0.02;
      }
    });

    this.ammoPickups.push({
      box: ammoBox,
      decor: bulletDecor,
      position: position.clone(),
      ammoAmount: 60 + Math.floor(Math.random() * 60) // 더 많은 탄약 (60~120)
    });
  }

  spawnInitialEnemies() {
    // 초기 적 배치
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const distance = 20 + Math.random() * 20;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const y = this.noise(x, z) + 2;

      this.spawnEnemy(new BABYLON.Vector3(x, y, z));
    }
  }

  spawnEnemy(position) {
    const enemy = this.createEnemyCharacter(position);
    const enemyData = {
      mesh: enemy.parent,
      aggregate: enemy.aggregate,
      gun: enemy.gun,
      healthBar: enemy.healthBar,
      healthBarBg: enemy.healthBarBg,
      healthBarContainer: enemy.healthBarContainer,
      initialPosition: position.clone(),
      patrolRadius: 8,
      speed: 1.5,
      chaseSpeed: 3.5,
      detectionRange: 25,
      attackRange: 20,
      state: 'patrol',
      patrolAngle: Math.random() * Math.PI * 2,
      health: 100,
      maxHealth: 100,
      shootCooldown: 0,
      shootInterval: 1.5 + Math.random() * 1.0 // 1.5~2.5초 간격
    };
    this.enemies.push(enemyData);
  }

  spawnRandomEnemy() {
    if (this.enemies.length >= 20) return;

    const playerPos = this.collisionCapsule ? this.collisionCapsule.position : new BABYLON.Vector3(0, 0, 0);
    const angle = Math.random() * Math.PI * 2;
    const distance = 30 + Math.random() * 30;
    const x = playerPos.x + Math.cos(angle) * distance;
    const z = playerPos.z + Math.sin(angle) * distance;
    const y = this.noise(x, z) + 2;

    this.spawnEnemy(new BABYLON.Vector3(x, y, z));
  }

  createEnemyCharacter(position) {
    const parent = BABYLON.MeshBuilder.CreateBox('enemy', { size: 0.01 }, this.scene);
    parent.position = position;

    // 랜덤 밝은 색상 (우스꽝스러운 색)
    const funnyColors = [
      new BABYLON.Color3(1, 0.4, 0.7),    // 핑크
      new BABYLON.Color3(0.4, 1, 0.6),    // 민트
      new BABYLON.Color3(1, 0.8, 0.3),    // 노랑
      new BABYLON.Color3(0.6, 0.4, 1),    // 보라
      new BABYLON.Color3(1, 0.5, 0.3),    // 오렌지
      new BABYLON.Color3(0.3, 0.8, 1),    // 하늘색
    ];
    const randomColor = funnyColors[Math.floor(Math.random() * funnyColors.length)];

    const bodyMat = new BABYLON.PBRMaterial('enemyBodyMat' + Math.random(), this.scene);
    bodyMat.albedoColor = randomColor;
    bodyMat.roughness = 0.6;
    bodyMat.metallic = 0.1;

    // 작은 목 (거의 없음 - 머리가 몸통에 바로 붙은 느낌)
    const neck = BABYLON.MeshBuilder.CreateCylinder('neck', { height: 0.15, diameter: 0.25 }, this.scene);
    neck.position.y = 1.0;
    neck.parent = parent;
    neck.material = bodyMat;

    // 뚱뚱한 몸통 (달걀형 - 배불뚝이)
    const body = BABYLON.MeshBuilder.CreateSphere('enemyBody', {
      diameterX: 0.9,
      diameterY: 1.1,
      diameterZ: 0.8
    }, this.scene);
    body.position.y = 0.55;
    body.parent = parent;
    body.material = bodyMat;

    // 배꼽 (귀여운 포인트)
    const belly = BABYLON.MeshBuilder.CreateSphere('belly', { diameter: 0.15 }, this.scene);
    belly.position = new BABYLON.Vector3(0, 0.4, 0.35);
    belly.parent = parent;
    const bellyMat = new BABYLON.PBRMaterial('bellyMat' + Math.random(), this.scene);
    bellyMat.albedoColor = randomColor.scale(0.7);
    bellyMat.roughness = 0.5;
    belly.material = bellyMat;

    // 짧고 뚱뚱한 팔 (소시지 팔)
    const leftArm = BABYLON.MeshBuilder.CreateCapsule('leftArm', { height: 0.5, radius: 0.1 }, this.scene);
    leftArm.rotation.x = Math.PI / 2.5;
    leftArm.rotation.z = 0.3;
    leftArm.position = new BABYLON.Vector3(-0.5, 0.7, 0.2);
    leftArm.parent = parent;
    leftArm.material = bodyMat;

    const rightArm = BABYLON.MeshBuilder.CreateCapsule('rightArm', { height: 0.5, radius: 0.1 }, this.scene);
    rightArm.rotation.x = Math.PI / 2.5;
    rightArm.rotation.z = -0.3;
    rightArm.position = new BABYLON.Vector3(0.5, 0.7, 0.2);
    rightArm.parent = parent;
    rightArm.material = bodyMat;

    // 짧고 뚱뚱한 다리 (펭귄 다리)
    const leftLeg = BABYLON.MeshBuilder.CreateCapsule('leftLeg', { height: 0.4, radius: 0.12 }, this.scene);
    leftLeg.position = new BABYLON.Vector3(-0.2, 0.1, 0);
    leftLeg.parent = parent;
    leftLeg.material = bodyMat;

    const rightLeg = BABYLON.MeshBuilder.CreateCapsule('rightLeg', { height: 0.4, radius: 0.12 }, this.scene);
    rightLeg.position = new BABYLON.Vector3(0.2, 0.1, 0);
    rightLeg.parent = parent;
    rightLeg.material = bodyMat;

    // 큰 발 (오리발처럼)
    const footMat = new BABYLON.PBRMaterial('footMat' + Math.random(), this.scene);
    footMat.albedoColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    footMat.roughness = 0.9;

    const leftFoot = BABYLON.MeshBuilder.CreateBox('leftFoot', { width: 0.2, height: 0.08, depth: 0.35 }, this.scene);
    leftFoot.position = new BABYLON.Vector3(-0.2, -0.05, 0.1);
    leftFoot.parent = parent;
    leftFoot.material = footMat;

    const rightFoot = BABYLON.MeshBuilder.CreateBox('rightFoot', { width: 0.2, height: 0.08, depth: 0.35 }, this.scene);
    rightFoot.position = new BABYLON.Vector3(0.2, -0.05, 0.1);
    rightFoot.parent = parent;
    rightFoot.material = footMat;

    // 큰 머리 (더 크게!)
    const headFront = BABYLON.MeshBuilder.CreatePlane('enemyHead', { width: 4, height: 4 }, this.scene);
    headFront.position.y = 1.7;
    headFront.parent = parent;
    headFront.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

    const headMat = new BABYLON.StandardMaterial('enemyHeadMat' + Math.random(), this.scene);
    const headTexture = new BABYLON.Texture('/survival-game/head.png', this.scene);
    headTexture.hasAlpha = true;
    headMat.diffuseTexture = headTexture;
    headMat.specularColor = new BABYLON.Color3(0, 0, 0);
    headMat.emissiveTexture = headTexture;
    headMat.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    headMat.useAlphaFromDiffuseTexture = true;
    headMat.backFaceCulling = false;
    headFront.material = headMat;

    // 적 총 추가
    const gunMat = new BABYLON.PBRMaterial('enemyGunMat' + Math.random(), this.scene);
    gunMat.albedoColor = new BABYLON.Color3(0.15, 0.15, 0.15);
    gunMat.metallic = 0.9;
    gunMat.roughness = 0.3;

    const enemyGun = BABYLON.MeshBuilder.CreateBox('enemyGun', {
      width: 0.08,
      height: 0.12,
      depth: 0.4
    }, this.scene);
    enemyGun.position = new BABYLON.Vector3(0.4, 0.8, 0.3);
    enemyGun.rotation.x = -0.3;
    enemyGun.parent = parent;
    enemyGun.material = gunMat;

    const enemyBarrel = BABYLON.MeshBuilder.CreateCylinder('enemyBarrel', {
      height: 0.2,
      diameter: 0.04
    }, this.scene);
    enemyBarrel.rotation.x = Math.PI / 2;
    enemyBarrel.position = new BABYLON.Vector3(0, 0, 0.3);
    enemyBarrel.parent = enemyGun;
    enemyBarrel.material = gunMat;

    // 적 체력바 생성 (Box로 변경하여 항상 보이게)
    const healthBarContainer = new BABYLON.TransformNode('healthBarContainer', this.scene);
    healthBarContainer.parent = parent;
    healthBarContainer.position.y = 2.8;

    const healthBarBg = BABYLON.MeshBuilder.CreateBox('enemyHealthBarBg', { width: 1.2, height: 0.15, depth: 0.05 }, this.scene);
    healthBarBg.parent = healthBarContainer;
    const healthBarBgMat = new BABYLON.StandardMaterial('healthBarBgMat' + Math.random(), this.scene);
    healthBarBgMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    healthBarBgMat.emissiveColor = new BABYLON.Color3(0.15, 0.15, 0.15);
    healthBarBgMat.disableLighting = true;
    healthBarBg.material = healthBarBgMat;

    const healthBar = BABYLON.MeshBuilder.CreateBox('enemyHealthBar', { width: 1.1, height: 0.12, depth: 0.06 }, this.scene);
    healthBar.parent = healthBarContainer;
    healthBar.position.z = -0.01;
    const healthBarMat = new BABYLON.StandardMaterial('healthBarMat' + Math.random(), this.scene);
    healthBarMat.diffuseColor = new BABYLON.Color3(0.2, 1, 0.2);
    healthBarMat.emissiveColor = new BABYLON.Color3(0.1, 0.8, 0.1);
    healthBarMat.disableLighting = true;
    healthBar.material = healthBarMat;

    // 체력바 컨테이너를 카메라 방향으로 회전시키는 옵저버 등록
    healthBarContainer.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;

    // 물리
    const aggregate = new BABYLON.PhysicsAggregate(
      parent,
      BABYLON.PhysicsShapeType.CAPSULE,
      { mass: 50, restitution: 0.0, friction: 1.0 },
      this.scene
    );

    aggregate.body.setMassProperties({ inertia: new BABYLON.Vector3(0, 0, 0) });
    aggregate.body.setAngularDamping(1000);
    aggregate.body.setLinearDamping(0.8);

    parent.getChildMeshes().forEach(mesh => {
      this.shadowGenerator.addShadowCaster(mesh);
    });

    return { parent, aggregate, gun: enemyGun, healthBar, healthBarBg, healthBarContainer };
  }

  createHumanoidModel(radiusMultiplier, heightMultiplier) {
    const parent = BABYLON.MeshBuilder.CreateBox('humanoid', { size: 0.01 }, this.scene);
    const size = this.customization.size;

    const head = BABYLON.MeshBuilder.CreateSphere('head', { diameter: 0.4 * size }, this.scene);
    head.position.y = 1.7 * heightMultiplier * size;
    head.parent = parent;

    const faceMat = new BABYLON.PBRMaterial('faceMat', this.scene);
    faceMat.albedoColor = new BABYLON.Color3(1, 0.85, 0.7);
    faceMat.roughness = 0.6;
    head.material = faceMat;

    const torso = BABYLON.MeshBuilder.CreateCylinder('torso', {
      height: 0.6 * heightMultiplier * size,
      diameterTop: 0.5 * radiusMultiplier * size,
      diameterBottom: 0.45 * radiusMultiplier * size
    }, this.scene);
    torso.position.y = 1.1 * heightMultiplier * size;
    torso.parent = parent;

    const leftArm = BABYLON.MeshBuilder.CreateCylinder('leftArm', {
      height: 0.5 * size,
      diameter: 0.12 * radiusMultiplier * size
    }, this.scene);
    leftArm.rotation.z = Math.PI / 6;
    leftArm.position = new BABYLON.Vector3(-0.35 * radiusMultiplier * size, 1.1 * heightMultiplier * size, 0);
    leftArm.parent = parent;

    const rightArm = BABYLON.MeshBuilder.CreateCylinder('rightArm', {
      height: 0.5 * size,
      diameter: 0.12 * radiusMultiplier * size
    }, this.scene);
    rightArm.rotation.z = -Math.PI / 6;
    rightArm.position = new BABYLON.Vector3(0.35 * radiusMultiplier * size, 1.1 * heightMultiplier * size, 0);
    rightArm.parent = parent;

    const leftLeg = BABYLON.MeshBuilder.CreateCylinder('leftLeg', {
      height: 0.7 * heightMultiplier * size,
      diameter: 0.16 * radiusMultiplier * size
    }, this.scene);
    leftLeg.position = new BABYLON.Vector3(-0.12 * radiusMultiplier * size, 0.35 * heightMultiplier * size, 0);
    leftLeg.parent = parent;

    const rightLeg = BABYLON.MeshBuilder.CreateCylinder('rightLeg', {
      height: 0.7 * heightMultiplier * size,
      diameter: 0.16 * radiusMultiplier * size
    }, this.scene);
    rightLeg.position = new BABYLON.Vector3(0.12 * radiusMultiplier * size, 0.35 * heightMultiplier * size, 0);
    rightLeg.parent = parent;

    parent.getChildMeshes().forEach(mesh => {
      this.shadowGenerator.addShadowCaster(mesh);
    });

    return parent;
  }

  createPlayer() {
    let radiusMultiplier = 1.0;
    let heightMultiplier = 1.0;

    switch (this.customization.bodyType) {
      case 'slim':
        radiusMultiplier = 0.8;
        heightMultiplier = 1.1;
        break;
      case 'muscular':
        radiusMultiplier = 1.2;
        heightMultiplier = 0.95;
        break;
    }

    this.player = this.createHumanoidModel(radiusMultiplier, heightMultiplier);
    // 지형 높이를 고려해서 시작 위치를 더 높게 설정
    const startHeight = this.noise(0, 0) + 3;
    this.player.position = new BABYLON.Vector3(0, startHeight, 0);

    const hexToColor3 = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return new BABYLON.Color3(r, g, b);
    };

    const playerMat = new BABYLON.PBRMaterial('playerMat', this.scene);
    playerMat.albedoColor = hexToColor3(this.customization.color);
    playerMat.metallic = 0.2;
    playerMat.roughness = 0.4;

    this.player.getChildMeshes().forEach((mesh) => {
      if (mesh.name !== 'head') {
        mesh.material = playerMat;
      }
    });

    // 1인칭 모드에서는 플레이어 모델 숨김
    this.player.setEnabled(false);

    this.collisionCapsule = BABYLON.MeshBuilder.CreateCapsule('playerCollision', {
      height: 1.8 * heightMultiplier * this.customization.size,
      radius: 0.3 * radiusMultiplier * this.customization.size,
    }, this.scene);
    this.collisionCapsule.isVisible = false;
    this.collisionCapsule.position = new BABYLON.Vector3(0, startHeight, 0);

    this.playerAggregate = new BABYLON.PhysicsAggregate(
      this.collisionCapsule,
      BABYLON.PhysicsShapeType.CAPSULE,
      { mass: 70, restitution: 0.0, friction: 1.0 },
      this.scene
    );

    this.playerAggregate.body.setMassProperties({ inertia: new BABYLON.Vector3(0, 0, 0) });
    this.playerAggregate.body.setAngularDamping(1000);
    this.playerAggregate.body.setLinearDamping(0.5);

    this.shadowGenerator.addShadowCaster(this.player);
  }

  createGun() {
    this.isShooting = false;
    this.shootCooldown = 0;
    this.recoilAmount = 0;

    this.gunParent = new BABYLON.TransformNode('gunParent', this.scene);
    this.gunParent.parent = this.camera;
    this.gunParent.position = new BABYLON.Vector3(0.3, -0.28, 0.5);
    this.gunParent.scaling = new BABYLON.Vector3(2.2, 2.2, 2.2);

    const gunMetalMat = new BABYLON.PBRMaterial('gunMetalMat', this.scene);
    gunMetalMat.albedoColor = new BABYLON.Color3(0.1, 0.1, 0.12);
    gunMetalMat.metallic = 0.95;
    gunMetalMat.roughness = 0.2;

    const gunGripMat = new BABYLON.PBRMaterial('gunGripMat', this.scene);
    gunGripMat.albedoColor = new BABYLON.Color3(0.06, 0.04, 0.02);
    gunGripMat.roughness = 0.85;
    gunGripMat.metallic = 0.1;

    // 프레임
    const frame = BABYLON.MeshBuilder.CreateBox('gunFrame', {
      width: 0.035,
      height: 0.08,
      depth: 0.16
    }, this.scene);
    frame.position = new BABYLON.Vector3(0, 0, 0.02);
    frame.parent = this.gunParent;
    frame.material = gunMetalMat;

    // 슬라이드
    this.gunSlide = BABYLON.MeshBuilder.CreateBox('gunSlide', {
      width: 0.038,
      height: 0.045,
      depth: 0.18
    }, this.scene);
    this.gunSlide.position = new BABYLON.Vector3(0, 0.04, 0.03);
    this.gunSlide.parent = this.gunParent;
    this.gunSlide.material = gunMetalMat;

    // 슬라이드 홈
    const slideGroove = BABYLON.MeshBuilder.CreateBox('slideGroove', {
      width: 0.04,
      height: 0.01,
      depth: 0.12
    }, this.scene);
    slideGroove.position = new BABYLON.Vector3(0, 0.015, 0);
    slideGroove.parent = this.gunSlide;
    const grooveMat = new BABYLON.PBRMaterial('grooveMat', this.scene);
    grooveMat.albedoColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    grooveMat.metallic = 0.9;
    grooveMat.roughness = 0.3;
    slideGroove.material = grooveMat;

    // 총신
    const barrel = BABYLON.MeshBuilder.CreateCylinder('gunBarrel', {
      height: 0.1,
      diameter: 0.02
    }, this.scene);
    barrel.rotation.x = Math.PI / 2;
    barrel.position = new BABYLON.Vector3(0, 0.035, 0.17);
    barrel.parent = this.gunParent;
    const barrelMat = new BABYLON.PBRMaterial('barrelMat', this.scene);
    barrelMat.albedoColor = new BABYLON.Color3(0.03, 0.03, 0.03);
    barrelMat.metallic = 1.0;
    barrelMat.roughness = 0.1;
    barrel.material = barrelMat;

    // 총신 구멍
    const barrelHole = BABYLON.MeshBuilder.CreateCylinder('barrelHole', {
      height: 0.02,
      diameter: 0.014
    }, this.scene);
    barrelHole.rotation.x = Math.PI / 2;
    barrelHole.position = new BABYLON.Vector3(0, 0.035, 0.22);
    barrelHole.parent = this.gunParent;
    const holeMat = new BABYLON.StandardMaterial('holeMat', this.scene);
    holeMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    holeMat.specularColor = new BABYLON.Color3(0, 0, 0);
    barrelHole.material = holeMat;

    // 조준기
    const frontSight = BABYLON.MeshBuilder.CreateBox('frontSight', {
      width: 0.008,
      height: 0.015,
      depth: 0.008
    }, this.scene);
    frontSight.position = new BABYLON.Vector3(0, 0.075, 0.1);
    frontSight.parent = this.gunParent;
    const sightMat = new BABYLON.PBRMaterial('sightMat', this.scene);
    sightMat.albedoColor = new BABYLON.Color3(1, 1, 1);
    sightMat.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    frontSight.material = sightMat;

    const rearSightL = BABYLON.MeshBuilder.CreateBox('rearSightL', {
      width: 0.006,
      height: 0.012,
      depth: 0.008
    }, this.scene);
    rearSightL.position = new BABYLON.Vector3(-0.012, 0.072, -0.05);
    rearSightL.parent = this.gunParent;
    rearSightL.material = gunMetalMat;

    const rearSightR = BABYLON.MeshBuilder.CreateBox('rearSightR', {
      width: 0.006,
      height: 0.012,
      depth: 0.008
    }, this.scene);
    rearSightR.position = new BABYLON.Vector3(0.012, 0.072, -0.05);
    rearSightR.parent = this.gunParent;
    rearSightR.material = gunMetalMat;

    // 그립
    const grip = BABYLON.MeshBuilder.CreateBox('gunGrip', {
      width: 0.032,
      height: 0.1,
      depth: 0.038
    }, this.scene);
    grip.position = new BABYLON.Vector3(0, -0.06, -0.02);
    grip.rotation.x = 0.2;
    grip.parent = this.gunParent;
    grip.material = gunGripMat;

    // 그립 텍스처
    for (let i = 0; i < 6; i++) {
      const gripLine = BABYLON.MeshBuilder.CreateBox(`gripLine${i}`, {
        width: 0.034,
        height: 0.002,
        depth: 0.04
      }, this.scene);
      gripLine.position = new BABYLON.Vector3(0, -0.025 - i * 0.013, -0.02);
      gripLine.rotation.x = 0.2;
      gripLine.parent = this.gunParent;
      gripLine.material = gunMetalMat;
    }

    // 방아쇠
    const trigger = BABYLON.MeshBuilder.CreateBox('trigger', {
      width: 0.005,
      height: 0.025,
      depth: 0.01
    }, this.scene);
    trigger.position = new BABYLON.Vector3(0, -0.012, 0.01);
    trigger.rotation.x = 0.4;
    trigger.parent = this.gunParent;
    trigger.material = gunMetalMat;

    // 방아쇠 가드
    const triggerGuard = BABYLON.MeshBuilder.CreateTorus('triggerGuard', {
      diameter: 0.04,
      thickness: 0.004,
      tessellation: 16
    }, this.scene);
    triggerGuard.rotation.x = Math.PI / 2;
    triggerGuard.rotation.z = Math.PI;
    triggerGuard.position = new BABYLON.Vector3(0, -0.022, 0.015);
    triggerGuard.scaling = new BABYLON.Vector3(1, 0.6, 1);
    triggerGuard.parent = this.gunParent;
    triggerGuard.material = gunMetalMat;

    // 탄창
    this.magazine = BABYLON.MeshBuilder.CreateBox('magazine', {
      width: 0.025,
      height: 0.065,
      depth: 0.032
    }, this.scene);
    this.magazine.position = new BABYLON.Vector3(0, -0.09, -0.01);
    this.magazine.parent = this.gunParent;
    this.magazine.material = gunMetalMat;

    // 손
    const skinMat = new BABYLON.PBRMaterial('skinMat', this.scene);
    skinMat.albedoColor = new BABYLON.Color3(0.85, 0.68, 0.55);
    skinMat.roughness = 0.75;
    skinMat.metallic = 0;

    const palm = BABYLON.MeshBuilder.CreateBox('palm', {
      width: 0.065,
      height: 0.028,
      depth: 0.075
    }, this.scene);
    palm.position = new BABYLON.Vector3(0, -0.08, -0.01);
    palm.parent = this.gunParent;
    palm.material = skinMat;

    for (let i = 0; i < 4; i++) {
      const finger = BABYLON.MeshBuilder.CreateCylinder(`finger${i}`, {
        height: 0.055,
        diameter: 0.013
      }, this.scene);
      finger.rotation.x = Math.PI / 2 + 0.35;
      finger.position = new BABYLON.Vector3(-0.02 + i * 0.013, -0.068, 0.025);
      finger.parent = this.gunParent;
      finger.material = skinMat;
    }

    const thumb = BABYLON.MeshBuilder.CreateCylinder('thumb', {
      height: 0.04,
      diameter: 0.015
    }, this.scene);
    thumb.rotation.z = Math.PI / 3;
    thumb.position = new BABYLON.Vector3(0.04, -0.055, -0.01);
    thumb.parent = this.gunParent;
    thumb.material = skinMat;

    this.gunIdleTime = 0;

    // 모든 총 파츠를 렌더링 그룹 1로 설정 (항상 앞에 렌더링)
    this.gunParent.getChildMeshes().forEach(mesh => {
      mesh.renderingGroupId = 1;
    });

    // 머즐 플래시 (작은 크기로 수정)
    this.muzzleFlash = BABYLON.MeshBuilder.CreatePlane('muzzleFlash', { size: 0.03 }, this.scene);
    this.muzzleFlash.position = new BABYLON.Vector3(0, 0.035, 0.23);
    this.muzzleFlash.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    this.muzzleFlash.parent = this.gunParent;

    const flashMat = new BABYLON.StandardMaterial('flashMat', this.scene);
    flashMat.emissiveColor = new BABYLON.Color3(1, 0.9, 0.5);
    flashMat.disableLighting = true;
    flashMat.alpha = 0;
    flashMat.backFaceCulling = false;
    this.muzzleFlash.material = flashMat;
    this.muzzleFlash.renderingGroupId = 1;

    // 발사 이벤트
    this.scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
        if (pointerInfo.event.button === 0 && !this.isAutoFire) {
          this.shoot();
        }
      }
    });
  }

  reload() {
    if (this.isReloading || this.currentWeapon.reserveAmmo <= 0) return;

    this.isReloading = true;
    this.playReloadSound();

    // 재장전 애니메이션
    const startPos = this.gunParent.position.clone();
    const startRot = this.gunParent.rotation.clone();
    let reloadTime = 0;

    const reloadAnimation = () => {
      reloadTime += 0.016;

      if (reloadTime < 0.3) {
        // 총 내리기
        this.gunParent.position.y = startPos.y - reloadTime * 0.5;
        this.gunParent.rotation.x = startRot.x + reloadTime * 2;
      } else if (reloadTime < 0.8) {
        // 탄창 교체
        if (this.magazine) {
          this.magazine.position.y = -0.09 - (reloadTime - 0.3) * 0.3;
        }
      } else if (reloadTime < 1.0) {
        // 탄창 삽입
        if (this.magazine) {
          this.magazine.position.y = -0.09 - 0.15 + (reloadTime - 0.8) * 0.75;
        }
      } else if (reloadTime < 1.3) {
        // 슬라이드 당기기
        if (this.gunSlide) {
          this.gunSlide.position.z = 0.03 - (reloadTime - 1.0) * 0.2;
        }
      } else if (reloadTime < 1.5) {
        // 복귀
        this.gunParent.position.y = startPos.y - 0.15 + (reloadTime - 1.3) * 0.75;
        this.gunParent.rotation.x = startRot.x + 0.6 - (reloadTime - 1.3) * 3;
        if (this.gunSlide) {
          this.gunSlide.position.z = -0.03 + (reloadTime - 1.3) * 0.3;
        }
        if (this.magazine) {
          this.magazine.position.y = -0.09;
        }
      } else {
        // 완료
        this.gunParent.position = startPos;
        this.gunParent.rotation = startRot;
        if (this.gunSlide) this.gunSlide.position.z = 0.03;
        if (this.magazine) this.magazine.position.y = -0.09;

        const needed = this.currentWeapon.maxMagazine - this.currentWeapon.magazineAmmo;
        const toLoad = Math.min(needed, this.currentWeapon.reserveAmmo);
        this.currentWeapon.magazineAmmo += toLoad;
        this.currentWeapon.reserveAmmo -= toLoad;
        this.isReloading = false;
        return;
      }

      requestAnimationFrame(reloadAnimation);
    };

    reloadAnimation();
  }

  shoot() {
    if (this.shootCooldown > 0 || this.currentWeapon.magazineAmmo <= 0 || this.isReloading) return;

    // 특수 무기 타입 처리
    if (this.currentWeapon.type === 'grenade') {
      this.fireGrenade();
      return;
    }

    if (this.currentWeapon.type === 'rocket') {
      this.fireRocket();
      return;
    }

    if (this.currentWeapon.type === 'laser') {
      this.fireLaser();
      return;
    }

    this.currentWeapon.magazineAmmo--;
    this.shootCooldown = this.currentWeapon.fireRate;

    this.playGunSound();

    // 머즐 플래시 (작은 스케일)
    this.muzzleFlash.material.alpha = 0.9;
    const flashScale = 0.8 + Math.random() * 0.4;
    this.muzzleFlash.scaling = new BABYLON.Vector3(flashScale, flashScale, 1);

    setTimeout(() => {
      this.muzzleFlash.material.alpha = 0;
      this.muzzleFlash.scaling = new BABYLON.Vector3(1, 1, 1);
    }, 30);

    this.recoilAmount = this.currentWeapon.recoil;
    this.createShootShake();
    this.createMuzzleSparks();

    // 샷건은 여러 발 발사
    const pelletCount = this.currentWeapon.pellets || 1;

    for (let p = 0; p < pelletCount; p++) {
      // 총알 궤적 생성 (발사체가 날아가면서 충돌 검사)
      this.createBulletTracer();
    } // 펠릿 루프 종료

    this.ejectShell();

    // 자동 재장전
    if (this.currentWeapon.magazineAmmo <= 0 && this.currentWeapon.reserveAmmo > 0) {
      setTimeout(() => this.reload(), 300);
    }
  }

  createBulletTracer() {
    const forward = this.camera.getDirection(BABYLON.Vector3.Forward());
    // 스프레드 적용
    const spread = this.currentWeapon.spread * 0.5;
    forward.x += (Math.random() - 0.5) * spread;
    forward.y += (Math.random() - 0.5) * spread;
    forward.z += (Math.random() - 0.5) * spread;
    forward.normalize();

    const startPos = this.camera.position.add(forward.scale(1.5));
    startPos.y -= 0.05;

    // 매트릭스 스타일 총알 생성
    this.createMatrixBullet(startPos, forward, 'player');
  }

  createMatrixBullet(startPos, direction, owner, color = null) {
    // 총알 색상 설정
    const bulletColor = color || (owner === 'player'
      ? new BABYLON.Color3(1, 0.9, 0.3) // 노란색 (플레이어)
      : new BABYLON.Color3(1, 0.2, 0.1)); // 빨간색 (적)

    // 최적화된 총알 메시 (더 적은 폴리곤)
    const bullet = BABYLON.MeshBuilder.CreateSphere('matrixBullet', {
      diameter: 0.12,
      segments: 6
    }, this.scene);

    // 재사용 가능한 머티리얼 캐싱
    const matKey = owner === 'player' ? 'playerBulletMat' : 'enemyBulletMat';
    if (!this.bulletMaterials) this.bulletMaterials = {};
    if (!this.bulletMaterials[matKey]) {
      const bulletMat = new BABYLON.StandardMaterial(matKey, this.scene);
      bulletMat.emissiveColor = bulletColor;
      bulletMat.disableLighting = true;
      bulletMat.freeze();
      this.bulletMaterials[matKey] = bulletMat;
    }
    bullet.material = this.bulletMaterials[matKey];

    // 코어 (밝은 중심) - 더 작은 세그먼트
    const core = BABYLON.MeshBuilder.CreateSphere('bulletCore', {
      diameter: 0.06,
      segments: 4
    }, this.scene);
    if (!this.bulletMaterials['coreMat']) {
      const coreMat = new BABYLON.StandardMaterial('coreMat', this.scene);
      coreMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
      coreMat.disableLighting = true;
      coreMat.freeze();
      this.bulletMaterials['coreMat'] = coreMat;
    }
    core.material = this.bulletMaterials['coreMat'];
    core.parent = bullet;

    // 최적화된 트레일 (더 적은 파티클, 더 멋진 효과)
    const tailParts = [];
    const tailCount = 5; // 8에서 5로 감소
    for (let i = 0; i < tailCount; i++) {
      const tail = BABYLON.MeshBuilder.CreateSphere('tail' + i, {
        diameter: 0.1 - i * 0.015,
        segments: 4
      }, this.scene);
      const tailMatKey = `tailMat_${owner}_${i}`;
      if (!this.bulletMaterials[tailMatKey]) {
        const tailMat = new BABYLON.StandardMaterial(tailMatKey, this.scene);
        tailMat.emissiveColor = bulletColor;
        tailMat.alpha = 0.7 - i * 0.12;
        tailMat.disableLighting = true;
        this.bulletMaterials[tailMatKey] = tailMat;
      }
      tail.material = this.bulletMaterials[tailMatKey];
      tailParts.push({ mesh: tail, offset: i * 0.25 });
    }

    bullet.position = startPos.clone();

    // 더 느린 총알 속도 (매트릭스 스타일) - 더 잘 보이게
    const speed = 10 + Math.random() * 3; // 더 느리게!
    let distance = 0;
    const maxDistance = 70;
    let prevPositions = [startPos.clone()];

    // 총알 물리 데이터 저장
    const bulletData = {
      mesh: bullet,
      tailParts,
      startPos: startPos.clone(),
      direction: direction.clone(),
      speed,
      distance: 0,
      owner,
      active: true
    };

    if (!this.activeBullets) this.activeBullets = [];
    this.activeBullets.push(bulletData);

    // 총알 애니메이션 (최적화)
    const animateBullet = () => {
      if (!bulletData.active) return;

      distance += speed * 0.016;
      bulletData.distance = distance;
      const currentPos = startPos.add(direction.scale(distance));
      bullet.position = currentPos;

      // 총알 회전 효과 (심플)
      bullet.rotation.y += 0.3;

      // 꼬리 업데이트 (더 부드러운 트레일)
      prevPositions.unshift(currentPos.clone());
      if (prevPositions.length > 6) prevPositions.pop();

      tailParts.forEach((part, i) => {
        if (prevPositions[i + 1]) {
          part.mesh.position = prevPositions[i + 1];
          // 페이드 효과
          part.mesh.scaling.setAll(1 - i * 0.15);
        }
      });

      // 충돌 체크
      if (owner === 'enemy') {
        // 적 총알이 플레이어에게 명중 체크
        if (this.collisionCapsule) {
          const distToPlayer = BABYLON.Vector3.Distance(currentPos, this.collisionCapsule.position);
          if (distToPlayer < 0.8) {
            this.playerStats.health -= 8 + Math.floor(Math.random() * 7);
            this.showDamageEffect();
            this.createBulletImpact(currentPos, bulletColor);
            bulletData.active = false;

            if (this.playerStats.health <= 0) {
              this.gameOver();
            }
          }
        }
      } else {
        // 플레이어 총알이 적에게 명중 체크
        this.enemies.forEach(enemy => {
          if (enemy.mesh && !enemy.mesh.isDisposed() && bulletData.active) {
            const distToEnemy = BABYLON.Vector3.Distance(currentPos, enemy.mesh.position);
            if (distToEnemy < 1.5) {
              if (!enemy.health) enemy.health = 100;
              enemy.health -= this.currentWeapon.damage;
              this.createHitEffect(currentPos);
              this.createBulletImpact(currentPos, bulletColor);
              this.playHitSound();

              if (enemy.health <= 0) {
                this.killEnemy(enemy);
              }
              bulletData.active = false;
            }
          }
        });

        // 플레이어 총알이 차량에 명중 체크
        if (this.spawnedVehicles && bulletData.active) {
          this.spawnedVehicles.forEach(vehicle => {
            if (vehicle.parent && !vehicle.parent.isDisposed() && !vehicle.isDestroyed && bulletData.active) {
              const distToVehicle = BABYLON.Vector3.Distance(currentPos, vehicle.parent.position);
              const hitRadius = vehicle.type === 'helicopter' ? 4 : (vehicle.type === 'tank' ? 5 : 3);
              if (distToVehicle < hitRadius) {
                vehicle.health -= this.currentWeapon.damage;
                this.createHitEffect(currentPos);
                this.createBulletImpact(currentPos, new BABYLON.Color3(1, 0.5, 0.2));
                this.playHitSound();

                if (vehicle.health <= 0 && !vehicle.isDestroyed) {
                  this.destroyVehicle(vehicle);
                }
                bulletData.active = false;
              }
            }
          });
        }
      }

      // 지형 충돌 체크
      const ray = new BABYLON.Ray(currentPos, direction, 0.5);
      const groundHit = this.scene.pickWithRay(ray, (mesh) => {
        return mesh.name.includes('ground');
      });

      if (groundHit && groundHit.hit && groundHit.distance < 0.3) {
        this.createBulletImpact(currentPos, bulletColor);
        bulletData.active = false;
      }

      if (distance < maxDistance && bulletData.active) {
        requestAnimationFrame(animateBullet);
      } else {
        // 정리 (최적화)
        tailParts.forEach(part => part.mesh.dispose());
        core.dispose();
        bullet.dispose();

        const idx = this.activeBullets.indexOf(bulletData);
        if (idx > -1) this.activeBullets.splice(idx, 1);
      }
    };

    animateBullet();
  }

  createBulletImpact(position, color) {
    // 충돌 시 폭발 효과 (최적화: 파티클 수 감소, 라이트 제거)
    const impactParticles = [];
    const impactColor = color || new BABYLON.Color3(1, 0.8, 0.3);

    // 머티리얼 캐싱
    if (!this.impactMaterial) {
      this.impactMaterial = new BABYLON.StandardMaterial('impactMat', this.scene);
      this.impactMaterial.emissiveColor = new BABYLON.Color3(1, 0.8, 0.3);
      this.impactMaterial.disableLighting = true;
    }

    for (let i = 0; i < 6; i++) { // 12에서 6으로 감소
      const particle = BABYLON.MeshBuilder.CreateSphere('impact', { diameter: 0.08, segments: 4 }, this.scene);
      const mat = this.impactMaterial.clone('impactMat' + i);
      mat.emissiveColor = impactColor;
      particle.material = mat;
      particle.position = position.clone();

      const vel = new BABYLON.Vector3(
        (Math.random() - 0.5) * 6,
        Math.random() * 4,
        (Math.random() - 0.5) * 6
      );

      impactParticles.push({ mesh: particle, mat, vel, life: 0 });
    }

    const animateImpact = () => {
      let allDone = true;

      impactParticles.forEach(p => {
        p.life += 0.02;
        p.vel.y -= 12 * 0.016; // 중력
        p.mesh.position.addInPlace(p.vel.scale(0.016));
        p.mat.alpha = Math.max(0, 1 - p.life * 4);
        p.mesh.scaling.scaleInPlace(0.92);

        if (p.life < 0.4) allDone = false;
      });

      if (!allDone) {
        requestAnimationFrame(animateImpact);
      } else {
        impactParticles.forEach(p => {
          p.mat.dispose();
          p.mesh.dispose();
        });
      }
    };

    animateImpact();
  }

  // 수류탄 던지기 (G키)
  throwGrenade() {
    if (this.grenades <= 0) return;
    this.grenades--;

    const forward = this.camera.getDirection(BABYLON.Vector3.Forward());
    const startPos = this.camera.position.add(forward.scale(1));

    this.createGrenadeProjectile(startPos, forward, 25); // 던지는 속도
  }

  // 수류탄 발사 (5번 무기)
  fireGrenade() {
    this.currentWeapon.magazineAmmo--;
    this.shootCooldown = this.currentWeapon.fireRate;

    const forward = this.camera.getDirection(BABYLON.Vector3.Forward());
    const startPos = this.camera.position.add(forward.scale(1.5));

    this.createGrenadeProjectile(startPos, forward, 35); // 발사 속도
    this.recoilAmount = 0.05;
    this.createShootShake();
  }

  createGrenadeProjectile(startPos, direction, speed) {
    // 수류탄 메시
    const grenade = BABYLON.MeshBuilder.CreateSphere('grenade', { diameter: 0.3 }, this.scene);
    const grenadeMat = new BABYLON.StandardMaterial('grenadeMat', this.scene);
    grenadeMat.diffuseColor = new BABYLON.Color3(0.2, 0.3, 0.2);
    grenadeMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    grenade.material = grenadeMat;

    // 수류탄 디테일
    const ring = BABYLON.MeshBuilder.CreateTorus('ring', { diameter: 0.32, thickness: 0.03 }, this.scene);
    ring.parent = grenade;
    const ringMat = new BABYLON.StandardMaterial('ringMat', this.scene);
    ringMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.4);
    ring.material = ringMat;

    grenade.position = startPos.clone();

    let velocity = direction.scale(speed);
    velocity.y += 5; // 약간 위로 던지기
    let time = 0;
    const fuseTime = 2.5; // 3초 후 폭발

    // 깜박이는 불빛
    const light = BABYLON.MeshBuilder.CreateSphere('fuseLight', { diameter: 0.08 }, this.scene);
    const lightMat = new BABYLON.StandardMaterial('fuseMat', this.scene);
    lightMat.emissiveColor = new BABYLON.Color3(1, 0, 0);
    light.material = lightMat;
    light.parent = grenade;
    light.position.y = 0.15;

    const animateGrenade = () => {
      time += 0.016;

      // 물리 시뮬레이션
      velocity.y -= 15 * 0.016; // 중력
      grenade.position.addInPlace(velocity.scale(0.016));
      grenade.rotation.x += 0.1;
      grenade.rotation.z += 0.05;

      // 지면 충돌
      if (grenade.position.y < this.noise(grenade.position.x, grenade.position.z) + 0.2) {
        velocity.y = Math.abs(velocity.y) * 0.4;
        velocity.x *= 0.7;
        velocity.z *= 0.7;
        grenade.position.y = this.noise(grenade.position.x, grenade.position.z) + 0.2;
      }

      // 깜박임 (시간에 따라 빨라짐)
      const blinkRate = Math.min(20, 3 + time * 5);
      lightMat.emissiveColor = Math.sin(time * blinkRate) > 0
        ? new BABYLON.Color3(1, 0, 0)
        : new BABYLON.Color3(0.2, 0, 0);

      if (time < fuseTime) {
        requestAnimationFrame(animateGrenade);
      } else {
        // 폭발!
        this.createExplosion(grenade.position.clone(), this.currentWeapon.blastRadius || 8, this.currentWeapon.damage || 80);
        grenade.dispose();
      }
    };

    animateGrenade();
  }

  // 로켓 발사
  fireRocket() {
    this.currentWeapon.magazineAmmo--;
    this.shootCooldown = this.currentWeapon.fireRate;
    this.recoilAmount = 0.15;
    this.createShootShake();

    const forward = this.camera.getDirection(BABYLON.Vector3.Forward());
    const startPos = this.camera.position.add(forward.scale(1.5));

    // 로켓 메시
    const rocket = BABYLON.MeshBuilder.CreateCylinder('rocket', {
      height: 0.8,
      diameterTop: 0.08,
      diameterBottom: 0.15
    }, this.scene);
    const rocketMat = new BABYLON.StandardMaterial('rocketMat', this.scene);
    rocketMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    rocketMat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    rocket.material = rocketMat;

    // 로켓 날개
    for (let i = 0; i < 4; i++) {
      const fin = BABYLON.MeshBuilder.CreateBox('fin', { width: 0.2, height: 0.15, depth: 0.02 }, this.scene);
      fin.rotation.y = i * Math.PI / 2;
      fin.position.y = -0.3;
      fin.parent = rocket;
      fin.material = rocketMat;
    }

    // 불꽃 효과
    const flame = BABYLON.MeshBuilder.CreateCylinder('flame', {
      height: 0.5,
      diameterTop: 0.15,
      diameterBottom: 0.02
    }, this.scene);
    const flameMat = new BABYLON.StandardMaterial('flameMat', this.scene);
    flameMat.emissiveColor = new BABYLON.Color3(1, 0.5, 0);
    flameMat.alpha = 0.8;
    flame.material = flameMat;
    flame.position.y = -0.6;
    flame.parent = rocket;

    rocket.position = startPos.clone();

    // 방향 설정
    const target = startPos.add(forward.scale(100));
    rocket.lookAt(target);
    rocket.rotation.x += Math.PI / 2;

    const speed = 25; // 느린 로켓
    let distance = 0;
    const maxDistance = 100;

    // 연기 트레일
    const smokeTrail = [];

    const animateRocket = () => {
      distance += speed * 0.016;
      rocket.position = startPos.add(forward.scale(distance));

      // 불꽃 애니메이션
      flame.scaling.y = 0.8 + Math.random() * 0.4;
      flameMat.emissiveColor = new BABYLON.Color3(
        1,
        0.3 + Math.random() * 0.4,
        Math.random() * 0.2
      );

      // 연기 생성
      if (Math.random() < 0.3) {
        const smoke = BABYLON.MeshBuilder.CreateSphere('smoke', { diameter: 0.3 + Math.random() * 0.2 }, this.scene);
        const smokeMat = new BABYLON.StandardMaterial('smokeMat', this.scene);
        smokeMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        smokeMat.alpha = 0.6;
        smoke.material = smokeMat;
        smoke.position = rocket.position.clone();
        smokeTrail.push({ mesh: smoke, mat: smokeMat, life: 0 });
      }

      // 연기 업데이트
      smokeTrail.forEach((s, idx) => {
        s.life += 0.016;
        s.mat.alpha -= 0.02;
        s.mesh.scaling.scaleInPlace(1.02);
        if (s.mat.alpha <= 0) {
          s.mesh.dispose();
          smokeTrail.splice(idx, 1);
        }
      });

      // 적 충돌 체크
      let hit = false;
      this.enemies.forEach(enemy => {
        if (enemy.mesh && !enemy.mesh.isDisposed()) {
          const dist = BABYLON.Vector3.Distance(rocket.position, enemy.mesh.position);
          if (dist < 2) {
            hit = true;
          }
        }
      });

      // 지면 충돌 체크
      if (rocket.position.y < this.noise(rocket.position.x, rocket.position.z) + 0.5) {
        hit = true;
      }

      if (hit || distance > maxDistance) {
        // 폭발!
        this.createExplosion(rocket.position.clone(), this.currentWeapon.blastRadius || 12, this.currentWeapon.damage || 120);
        smokeTrail.forEach(s => s.mesh.dispose());
        rocket.dispose();
      } else {
        requestAnimationFrame(animateRocket);
      }
    };

    animateRocket();

    // 발사 소리
    this.playRocketSound();
  }

  // 레이저 발사
  fireLaser() {
    this.currentWeapon.magazineAmmo--;
    this.shootCooldown = this.currentWeapon.fireRate;

    const forward = this.camera.getDirection(BABYLON.Vector3.Forward());
    const startPos = this.camera.position.add(forward.scale(1));

    // 레이저 빔
    const laser = BABYLON.MeshBuilder.CreateCylinder('laser', {
      height: 100,
      diameter: 0.05
    }, this.scene);
    const laserMat = new BABYLON.StandardMaterial('laserMat', this.scene);
    laserMat.emissiveColor = new BABYLON.Color3(0, 1, 0.5);
    laserMat.alpha = 0.8;
    laserMat.disableLighting = true;
    laser.material = laserMat;

    // 외부 글로우
    const glow = BABYLON.MeshBuilder.CreateCylinder('laserGlow', {
      height: 100,
      diameter: 0.15
    }, this.scene);
    const glowMat = new BABYLON.StandardMaterial('glowMat', this.scene);
    glowMat.emissiveColor = new BABYLON.Color3(0, 0.5, 0.3);
    glowMat.alpha = 0.3;
    glowMat.disableLighting = true;
    glow.material = glowMat;
    glow.parent = laser;

    laser.position = startPos.add(forward.scale(50));
    const target = startPos.add(forward.scale(100));
    laser.lookAt(target);
    laser.rotation.x += Math.PI / 2;

    // 즉시 레이캐스트로 충돌 체크
    this.enemies.forEach(enemy => {
      if (enemy.mesh && !enemy.mesh.isDisposed()) {
        const dist = BABYLON.Vector3.Distance(
          startPos.add(forward.scale(BABYLON.Vector3.Distance(startPos, enemy.mesh.position))),
          enemy.mesh.position
        );
        if (dist < 2) {
          enemy.health -= this.currentWeapon.damage;
          this.createBulletImpact(enemy.mesh.position, new BABYLON.Color3(0, 1, 0.5));

          if (enemy.health <= 0) {
            this.killEnemy(enemy);
          }
        }
      }
    });

    // 레이저 페이드 아웃
    let laserLife = 0;
    const fadeLaser = () => {
      laserLife += 0.016;
      laserMat.alpha = 0.8 - laserLife * 8;
      glowMat.alpha = 0.3 - laserLife * 3;

      if (laserLife < 0.1) {
        requestAnimationFrame(fadeLaser);
      } else {
        laser.dispose();
      }
    };
    fadeLaser();

    // 레이저 사운드
    this.playLaserSound();
  }

  // 폭발 효과
  createExplosion(position, radius, damage) {
    // 폭발 구체
    const explosion = BABYLON.MeshBuilder.CreateSphere('explosion', { diameter: 0.5, segments: 16 }, this.scene);
    const explosionMat = new BABYLON.StandardMaterial('explosionMat', this.scene);
    explosionMat.emissiveColor = new BABYLON.Color3(1, 0.6, 0);
    explosionMat.alpha = 0.9;
    explosion.material = explosionMat;
    explosion.position = position;

    // 폭발 빛
    const explosionLight = new BABYLON.PointLight('explosionLight', position, this.scene);
    explosionLight.diffuse = new BABYLON.Color3(1, 0.5, 0);
    explosionLight.intensity = 10;
    explosionLight.range = radius * 2;

    // 폭발 파티클
    const particles = [];
    for (let i = 0; i < 30; i++) {
      const particle = BABYLON.MeshBuilder.CreateSphere('expParticle', { diameter: 0.2 + Math.random() * 0.3 }, this.scene);
      const mat = new BABYLON.StandardMaterial('expMat', this.scene);
      mat.emissiveColor = new BABYLON.Color3(1, 0.3 + Math.random() * 0.5, 0);
      mat.disableLighting = true;
      particle.material = mat;
      particle.position = position.clone();

      const vel = new BABYLON.Vector3(
        (Math.random() - 0.5) * 20,
        Math.random() * 15,
        (Math.random() - 0.5) * 20
      );

      particles.push({ mesh: particle, mat, vel, life: 0 });
    }

    // 연기 파티클
    const smokeParticles = [];
    for (let i = 0; i < 15; i++) {
      const smoke = BABYLON.MeshBuilder.CreateSphere('smoke', { diameter: 0.5 + Math.random() * 0.5 }, this.scene);
      const smokeMat = new BABYLON.StandardMaterial('smokeMat', this.scene);
      smokeMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
      smokeMat.alpha = 0.7;
      smoke.material = smokeMat;
      smoke.position = position.clone();

      const vel = new BABYLON.Vector3(
        (Math.random() - 0.5) * 5,
        2 + Math.random() * 3,
        (Math.random() - 0.5) * 5
      );

      smokeParticles.push({ mesh: smoke, mat: smokeMat, vel, life: 0 });
    }

    // 데미지 적용
    this.enemies.forEach(enemy => {
      if (enemy.mesh && !enemy.mesh.isDisposed()) {
        const dist = BABYLON.Vector3.Distance(position, enemy.mesh.position);
        if (dist < radius) {
          const damageFalloff = 1 - (dist / radius);
          enemy.health -= damage * damageFalloff;

          // 넉백
          if (enemy.aggregate) {
            const knockbackDir = enemy.mesh.position.subtract(position);
            knockbackDir.y = 2;
            knockbackDir.normalize();
            enemy.aggregate.body.applyImpulse(
              knockbackDir.scale(500 * damageFalloff),
              enemy.mesh.position
            );
          }

          if (enemy.health <= 0) {
            this.killEnemy(enemy);
          }
        }
      }
    });

    // 플레이어 데미지
    if (this.collisionCapsule) {
      const distToPlayer = BABYLON.Vector3.Distance(position, this.collisionCapsule.position);
      if (distToPlayer < radius) {
        const damageFalloff = 1 - (distToPlayer / radius);
        this.playerStats.health -= Math.floor(damage * damageFalloff * 0.3); // 자폭 방지용 감소
        this.showDamageEffect();
        this.createShootShake();

        if (this.playerStats.health <= 0) {
          this.gameOver();
        }
      }
    }

    // 애니메이션
    let time = 0;
    const animateExplosion = () => {
      time += 0.016;

      // 폭발 구체 확장
      const scale = 1 + time * 20;
      explosion.scaling = new BABYLON.Vector3(scale, scale, scale);
      explosionMat.alpha = Math.max(0, 0.9 - time * 3);

      // 빛 감소
      explosionLight.intensity = Math.max(0, 10 - time * 30);

      // 파티클 업데이트
      particles.forEach(p => {
        p.life += 0.016;
        p.vel.y -= 20 * 0.016;
        p.mesh.position.addInPlace(p.vel.scale(0.016));
        p.mat.alpha = Math.max(0, 1 - p.life * 2);
        p.mesh.scaling.scaleInPlace(0.97);
      });

      // 연기 업데이트
      smokeParticles.forEach(s => {
        s.life += 0.016;
        s.mesh.position.addInPlace(s.vel.scale(0.016));
        s.mat.alpha = Math.max(0, 0.7 - s.life * 0.5);
        s.mesh.scaling.scaleInPlace(1.02);
      });

      if (time < 1.5) {
        requestAnimationFrame(animateExplosion);
      } else {
        explosion.dispose();
        explosionLight.dispose();
        particles.forEach(p => p.mesh.dispose());
        smokeParticles.forEach(s => s.mesh.dispose());
      }
    };

    animateExplosion();
    this.playExplosionSound();
  }

  playRocketSound() {
    if (!this.audioContext) return;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.3);
    gain.gain.setValueAtTime(0.4, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.3);
  }

  playLaserSound() {
    if (!this.audioContext) return;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.1);
  }

  playExplosionSound() {
    if (!this.audioContext) return;
    // 저음 폭발음
    const osc1 = this.audioContext.createOscillator();
    const gain1 = this.audioContext.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(60, this.audioContext.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(20, this.audioContext.currentTime + 0.5);
    gain1.gain.setValueAtTime(0.5, this.audioContext.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
    osc1.connect(gain1);
    gain1.connect(this.audioContext.destination);
    osc1.start();
    osc1.stop(this.audioContext.currentTime + 0.5);

    // 노이즈
    const bufferSize = this.audioContext.sampleRate * 0.3;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize / 3));
    }
    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.4, this.audioContext.currentTime);
    noise.connect(noiseGain);
    noiseGain.connect(this.audioContext.destination);
    noise.start();
  }

  createTracerSparks(startPos, forward) {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const spark = BABYLON.MeshBuilder.CreateSphere('spark', { diameter: 0.02 }, this.scene);
        const sparkMat = new BABYLON.StandardMaterial('sparkMat', this.scene);
        sparkMat.emissiveColor = new BABYLON.Color3(1, 0.8, 0.3);
        sparkMat.disableLighting = true;
        spark.material = sparkMat;

        spark.position = startPos.add(forward.scale(2 + i * 3));
        spark.position.x += (Math.random() - 0.5) * 0.1;
        spark.position.y += (Math.random() - 0.5) * 0.1;

        let sparkLife = 0;
        const animateSpark = () => {
          sparkLife += 0.016;
          sparkMat.alpha = 1 - sparkLife * 5;
          spark.scaling.scaleInPlace(0.95);

          if (sparkLife < 0.2) {
            requestAnimationFrame(animateSpark);
          } else {
            spark.dispose();
          }
        };
        animateSpark();
      }, i * 10);
    }
  }

  createScreenFlash() {
    let flashOverlay = document.getElementById('shoot-flash');
    if (!flashOverlay) {
      flashOverlay = document.createElement('div');
      flashOverlay.id = 'shoot-flash';
      flashOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle at 70% 60%, rgba(255, 200, 100, 0.25) 0%, transparent 40%);
        pointer-events: none;
        z-index: 999;
        opacity: 0;
        transition: opacity 0.03s;
      `;
      document.body.appendChild(flashOverlay);
    }

    flashOverlay.style.opacity = '1';
    setTimeout(() => {
      flashOverlay.style.opacity = '0';
    }, 30);
  }

  createShootShake() {
    if (!this.camera) return;

    const shakeIntensity = 0.015;
    let shakeTime = 0;

    const shake = () => {
      shakeTime += 0.016;
      if (shakeTime < 0.06) {
        this.camera.rotation.x += (Math.random() - 0.5) * shakeIntensity;
        this.camera.rotation.y += (Math.random() - 0.5) * shakeIntensity * 0.3;
        requestAnimationFrame(shake);
      }
    };
    shake();
  }

  createMuzzleSparks() {
    const forward = this.camera.getDirection(BABYLON.Vector3.Forward());
    const right = this.camera.getDirection(BABYLON.Vector3.Right());
    const sparkPos = this.camera.position.add(forward.scale(0.6)).add(right.scale(0.2));
    sparkPos.y -= 0.15;

    const sparks = new BABYLON.ParticleSystem('muzzleSparks', 25, this.scene);
    sparks.emitter = sparkPos;
    sparks.minSize = 0.008;
    sparks.maxSize = 0.025;
    sparks.minLifeTime = 0.03;
    sparks.maxLifeTime = 0.1;
    sparks.emitRate = 400;
    sparks.manualEmitCount = 15;
    sparks.direction1 = forward.add(new BABYLON.Vector3(-0.2, 0.2, -0.2));
    sparks.direction2 = forward.add(new BABYLON.Vector3(0.2, 0.4, 0.2));
    sparks.minEmitPower = 8;
    sparks.maxEmitPower = 15;
    sparks.color1 = new BABYLON.Color4(1, 0.95, 0.4, 1);
    sparks.color2 = new BABYLON.Color4(1, 0.6, 0.2, 1);
    sparks.colorDead = new BABYLON.Color4(0.6, 0.2, 0.1, 0);
    sparks.gravity = new BABYLON.Vector3(0, -2, 0);
    sparks.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    sparks.start();

    setTimeout(() => {
      sparks.stop();
      setTimeout(() => sparks.dispose(), 150);
    }, 40);

    const smoke = new BABYLON.ParticleSystem('muzzleSmoke', 8, this.scene);
    smoke.emitter = sparkPos;
    smoke.minSize = 0.03;
    smoke.maxSize = 0.1;
    smoke.minLifeTime = 0.15;
    smoke.maxLifeTime = 0.4;
    smoke.emitRate = 80;
    smoke.manualEmitCount = 4;
    smoke.direction1 = forward.add(new BABYLON.Vector3(-0.15, 0.2, -0.15));
    smoke.direction2 = forward.add(new BABYLON.Vector3(0.15, 0.4, 0.15));
    smoke.minEmitPower = 0.5;
    smoke.maxEmitPower = 2;
    smoke.color1 = new BABYLON.Color4(0.5, 0.5, 0.5, 0.25);
    smoke.color2 = new BABYLON.Color4(0.35, 0.35, 0.35, 0.15);
    smoke.colorDead = new BABYLON.Color4(0.2, 0.2, 0.2, 0);
    smoke.gravity = new BABYLON.Vector3(0, 0.8, 0);
    smoke.start();

    setTimeout(() => {
      smoke.stop();
      setTimeout(() => smoke.dispose(), 500);
    }, 80);
  }

  createDustEffect(position) {
    const dust = new BABYLON.ParticleSystem('dust', 12, this.scene);
    dust.emitter = position;
    dust.minSize = 0.04;
    dust.maxSize = 0.12;
    dust.minLifeTime = 0.25;
    dust.maxLifeTime = 0.5;
    dust.emitRate = 80;
    dust.manualEmitCount = 8;
    dust.direction1 = new BABYLON.Vector3(-0.8, 0.8, -0.8);
    dust.direction2 = new BABYLON.Vector3(0.8, 1.5, 0.8);
    dust.minEmitPower = 0.8;
    dust.maxEmitPower = 2.5;
    dust.color1 = new BABYLON.Color4(0.55, 0.45, 0.35, 0.45);
    dust.color2 = new BABYLON.Color4(0.4, 0.35, 0.3, 0.3);
    dust.colorDead = new BABYLON.Color4(0.3, 0.25, 0.2, 0);
    dust.gravity = new BABYLON.Vector3(0, -1.5, 0);
    dust.start();

    setTimeout(() => {
      dust.stop();
      setTimeout(() => dust.dispose(), 600);
    }, 80);
  }

  killEnemy(enemy) {
    if (!enemy.mesh) return;

    const deathPos = enemy.mesh.position.clone();

    const explosion = new BABYLON.ParticleSystem('explosion', 40, this.scene);
    explosion.emitter = deathPos;
    explosion.minSize = 0.08;
    explosion.maxSize = 0.25;
    explosion.minLifeTime = 0.25;
    explosion.maxLifeTime = 0.7;
    explosion.emitRate = 180;
    explosion.manualEmitCount = 35;
    explosion.direction1 = new BABYLON.Vector3(-1.5, 1.5, -1.5);
    explosion.direction2 = new BABYLON.Vector3(1.5, 4, 1.5);
    explosion.minEmitPower = 1.5;
    explosion.maxEmitPower = 5;
    explosion.color1 = new BABYLON.Color4(1, 0.35, 0.1, 1);
    explosion.color2 = new BABYLON.Color4(1, 0.55, 0.2, 1);
    explosion.colorDead = new BABYLON.Color4(0.25, 0.1, 0.05, 0);
    explosion.gravity = new BABYLON.Vector3(0, -4, 0);
    explosion.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    explosion.start();

    setTimeout(() => {
      explosion.stop();
      setTimeout(() => explosion.dispose(), 800);
    }, 180);

    if (enemy.aggregate) {
      enemy.aggregate.dispose();
    }
    enemy.mesh.dispose();

    const index = this.enemies.indexOf(enemy);
    if (index > -1) {
      this.enemies.splice(index, 1);
    }
  }

  destroyVehicle(vehicle) {
    if (!vehicle.parent || vehicle.isDestroyed) return;

    vehicle.isDestroyed = true;
    vehicle.canMount = false;
    const deathPos = vehicle.parent.position.clone();

    // 탑승 중이면 하차
    if (this.mountedVehicle === vehicle) {
      this.dismountVehicle();
    }

    // 큰 폭발 효과
    this.createExplosion(deathPos, 15, 80);

    // 추가 파편 효과
    for (let i = 0; i < 15; i++) {
      const debris = BABYLON.MeshBuilder.CreateBox('debris' + i, {
        width: 0.3 + Math.random() * 0.5,
        height: 0.2 + Math.random() * 0.3,
        depth: 0.3 + Math.random() * 0.5
      }, this.scene);
      debris.position = deathPos.clone();
      debris.position.y += 1;

      const debrisMat = new BABYLON.StandardMaterial('debrisMat' + i, this.scene);
      debrisMat.diffuseColor = new BABYLON.Color3(0.2 + Math.random() * 0.2, 0.2, 0.2);
      debris.material = debrisMat;

      const vel = new BABYLON.Vector3(
        (Math.random() - 0.5) * 20,
        5 + Math.random() * 10,
        (Math.random() - 0.5) * 20
      );
      const rotVel = new BABYLON.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      );

      let life = 0;
      const animateDebris = () => {
        life += 0.016;
        vel.y -= 15 * 0.016;
        debris.position.addInPlace(vel.scale(0.016));
        debris.rotation.addInPlace(rotVel.scale(0.016));

        if (debris.position.y < this.noise(debris.position.x, debris.position.z)) {
          debris.position.y = this.noise(debris.position.x, debris.position.z);
          vel.y = 0;
          vel.x *= 0.8;
          vel.z *= 0.8;
        }

        if (life < 3) {
          requestAnimationFrame(animateDebris);
        } else {
          debris.dispose();
        }
      };
      animateDebris();
    }

    // 차량 메시 숨기기 및 정리
    if (vehicle.healthBarContainer) vehicle.healthBarContainer.dispose();
    if (vehicle.healthBar) vehicle.healthBar.dispose();
    if (vehicle.healthBarBg) vehicle.healthBarBg.dispose();
    if (vehicle.indicator) vehicle.indicator.dispose();

    // 차량의 모든 자식 메시 제거
    vehicle.parent.getChildMeshes().forEach(mesh => {
      mesh.dispose();
    });
    vehicle.parent.dispose();

    // 배열에서 제거
    const index = this.spawnedVehicles.indexOf(vehicle);
    if (index > -1) {
      this.spawnedVehicles.splice(index, 1);
    }

    console.log(`${vehicle.type} 파괴됨!`);
  }

  updateVehicleHealthBars() {
    if (!this.spawnedVehicles) return;

    this.spawnedVehicles.forEach(vehicle => {
      if (vehicle.healthBar && vehicle.maxHealth && !vehicle.isDestroyed) {
        const healthPercent = Math.max(0, vehicle.health / vehicle.maxHealth);
        vehicle.healthBar.scaling.x = healthPercent;
        vehicle.healthBar.position.x = -(1 - healthPercent) * 1.4;

        // 체력에 따라 색상 변경
        const healthBarMat = vehicle.healthBar.material;
        if (healthPercent > 0.6) {
          healthBarMat.diffuseColor = new BABYLON.Color3(0.1, 0.8, 0.9);
          healthBarMat.emissiveColor = new BABYLON.Color3(0.1, 0.5, 0.6);
        } else if (healthPercent > 0.3) {
          healthBarMat.diffuseColor = new BABYLON.Color3(0.9, 0.7, 0.1);
          healthBarMat.emissiveColor = new BABYLON.Color3(0.6, 0.5, 0.1);
        } else {
          healthBarMat.diffuseColor = new BABYLON.Color3(0.9, 0.2, 0.1);
          healthBarMat.emissiveColor = new BABYLON.Color3(0.6, 0.1, 0.1);
        }
      }
    });
  }

  createHitEffect(position) {
    const sparks = new BABYLON.ParticleSystem('hitSparks', 35, this.scene);
    sparks.emitter = position;
    sparks.minSize = 0.015;
    sparks.maxSize = 0.06;
    sparks.minLifeTime = 0.08;
    sparks.maxLifeTime = 0.35;
    sparks.emitRate = 250;
    sparks.manualEmitCount = 25;
    sparks.direction1 = new BABYLON.Vector3(-1.5, 0.8, -1.5);
    sparks.direction2 = new BABYLON.Vector3(1.5, 2.5, 1.5);
    sparks.minEmitPower = 2.5;
    sparks.maxEmitPower = 7;
    sparks.color1 = new BABYLON.Color4(1, 0.9, 0.35, 1);
    sparks.color2 = new BABYLON.Color4(1, 0.45, 0.12, 1);
    sparks.colorDead = new BABYLON.Color4(0.45, 0.1, 0, 0);
    sparks.gravity = new BABYLON.Vector3(0, -7, 0);
    sparks.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    sparks.start();

    setTimeout(() => {
      sparks.stop();
      setTimeout(() => sparks.dispose(), 400);
    }, 80);

    const blood = new BABYLON.ParticleSystem('blood', 20, this.scene);
    blood.emitter = position;
    blood.minSize = 0.025;
    blood.maxSize = 0.1;
    blood.minLifeTime = 0.15;
    blood.maxLifeTime = 0.5;
    blood.emitRate = 160;
    blood.manualEmitCount = 15;
    blood.direction1 = new BABYLON.Vector3(-1.2, 0.4, -1.2);
    blood.direction2 = new BABYLON.Vector3(1.2, 1.8, 1.2);
    blood.minEmitPower = 1.5;
    blood.maxEmitPower = 4;
    blood.color1 = new BABYLON.Color4(0.75, 0, 0, 1);
    blood.color2 = new BABYLON.Color4(0.45, 0, 0, 0.75);
    blood.colorDead = new BABYLON.Color4(0.25, 0, 0, 0);
    blood.gravity = new BABYLON.Vector3(0, -9, 0);
    blood.start();

    setTimeout(() => {
      blood.stop();
      setTimeout(() => blood.dispose(), 600);
    }, 120);

    const flash = BABYLON.MeshBuilder.CreateSphere('hitFlash', { diameter: 0.4 }, this.scene);
    flash.position = position.clone();
    const flashMat = new BABYLON.StandardMaterial('hitFlashMat', this.scene);
    flashMat.emissiveColor = new BABYLON.Color3(1, 0.8, 0.35);
    flashMat.alpha = 0.75;
    flash.material = flashMat;

    let flashScale = 1;
    const animateFlash = () => {
      flashScale -= 0.18;
      flash.scaling = new BABYLON.Vector3(flashScale, flashScale, flashScale);
      flashMat.alpha = flashScale * 0.75;

      if (flashScale > 0.1) {
        requestAnimationFrame(animateFlash);
      } else {
        flash.dispose();
      }
    };
    animateFlash();
  }

  ejectShell() {
    const shell = BABYLON.MeshBuilder.CreateCylinder('shell', {
      height: 0.022,
      diameter: 0.009
    }, this.scene);

    const shellMat = new BABYLON.PBRMaterial('shellMat', this.scene);
    shellMat.albedoColor = new BABYLON.Color3(0.85, 0.65, 0.2);
    shellMat.metallic = 0.9;
    shellMat.roughness = 0.15;
    shell.material = shellMat;

    const right = this.camera.getDirection(BABYLON.Vector3.Right());
    const forward = this.camera.getDirection(BABYLON.Vector3.Forward());

    shell.position = this.camera.position.clone();
    shell.position.x += right.x * 0.35 + forward.x * 0.25;
    shell.position.y -= 0.12;
    shell.position.z += right.z * 0.35 + forward.z * 0.25;

    const velocity = {
      x: right.x * 3.5 + (Math.random() - 0.5) * 0.8,
      y: 0.8 + Math.random() * 0.4,
      z: right.z * 3.5 + (Math.random() - 0.5) * 0.8
    };

    let time = 0;
    const animateShell = () => {
      time += 0.016;
      shell.position.x += velocity.x * 0.016;
      shell.position.y += velocity.y * 0.016;
      shell.position.z += velocity.z * 0.016;
      velocity.y -= 9.8 * 0.016;

      shell.rotation.x += 0.45;
      shell.rotation.z += 0.3;
      shell.rotation.y += 0.2;

      if (time < 1.5 && shell.position.y > -10) {
        requestAnimationFrame(animateShell);
      } else {
        shell.dispose();
      }
    };
    animateShell();
  }

  setupControls() {
    this.scene.onBeforeRenderObservable.add(() => {
      if (!this.player || !this.playerAggregate) return;

      const deltaTime = this.engine.getDeltaTime() / 1000;
      const speed = 8;
      let moveX = 0;
      let moveZ = 0;

      const forward = this.camera.getDirection(BABYLON.Vector3.Forward());
      forward.y = 0;
      forward.normalize();

      const right = this.camera.getDirection(BABYLON.Vector3.Right());
      right.y = 0;
      right.normalize();

      if (this.inputMap['w']) {
        moveX += forward.x * speed;
        moveZ += forward.z * speed;
      }
      if (this.inputMap['s']) {
        moveX -= forward.x * speed;
        moveZ -= forward.z * speed;
      }
      if (this.inputMap['a']) {
        moveX -= right.x * speed;
        moveZ -= right.z * speed;
      }
      if (this.inputMap['d']) {
        moveX += right.x * speed;
        moveZ += right.z * speed;
      }

      const currentVelocity = this.playerAggregate.body.getLinearVelocity();

      if (moveX !== 0 || moveZ !== 0) {
        this.playerAggregate.body.setLinearVelocity(new BABYLON.Vector3(
          moveX,
          currentVelocity.y,
          moveZ
        ));
      } else {
        this.playerAggregate.body.setLinearVelocity(new BABYLON.Vector3(
          currentVelocity.x * 0.9,
          currentVelocity.y,
          currentVelocity.z * 0.9
        ));
      }

      if (this.inputMap[' ']) {
        const vel = this.playerAggregate.body.getLinearVelocity();
        if (Math.abs(vel.y) < 0.5) {
          this.playerAggregate.body.applyImpulse(
            new BABYLON.Vector3(0, 400, 0),
            this.collisionCapsule.position
          );
          this.inputMap[' '] = false;
        }
      }

      const capsulePos = this.collisionCapsule.position;
      this.player.position.x = capsulePos.x;
      this.player.position.y = capsulePos.y - 0.9;
      this.player.position.z = capsulePos.z;

      // 카메라 위치 (1인칭/3인칭)
      const eyeHeight = 1.6 * this.customization.size;
      if (this.isFirstPerson) {
        this.camera.position = new BABYLON.Vector3(
          capsulePos.x,
          capsulePos.y + eyeHeight - 0.9,
          capsulePos.z
        );
      } else {
        // 3인칭 카메라
        const behind = this.camera.getDirection(BABYLON.Vector3.Backward());
        this.camera.position = new BABYLON.Vector3(
          capsulePos.x + behind.x * 5,
          capsulePos.y + eyeHeight + 1,
          capsulePos.z + behind.z * 5
        );
        this.player.rotation.y = Math.atan2(
          this.camera.getDirection(BABYLON.Vector3.Forward()).x,
          this.camera.getDirection(BABYLON.Vector3.Forward()).z
        );
      }

      // 쿨다운
      if (this.shootCooldown > 0) {
        this.shootCooldown -= deltaTime;
      }

      // 연사 처리
      if (this.isAutoFire && this.isMouseDown && this.shootCooldown <= 0 && !this.isReloading) {
        this.shoot();
      }

      // 반동 복구
      if (this.recoilAmount > 0) {
        this.recoilAmount -= deltaTime * 0.4;
        if (this.recoilAmount < 0) this.recoilAmount = 0;
      }

      if (this.gunSlide && !this.isReloading) {
        this.gunSlide.position.z = 0.03 - this.recoilAmount * 0.6;
      }

      if (this.gunParent && !this.isReloading) {
        this.gunIdleTime += deltaTime;

        // ADS 전환 애니메이션
        const aimSpeed = 8;
        if (this.isAiming) {
          this.aimTransition = Math.min(1, this.aimTransition + deltaTime * aimSpeed);
        } else {
          this.aimTransition = Math.max(0, this.aimTransition - deltaTime * aimSpeed);
        }

        // FOV 조정 (저격총은 스코프 줌 적용)
        const targetFOV = this.isAiming
          ? (this.currentWeapon.scopeZoom ? this.normalFOV / this.currentWeapon.scopeZoom : this.aimFOV)
          : this.normalFOV;
        this.camera.fov = BABYLON.Tools.ToRadians(
          this.normalFOV + (targetFOV - this.normalFOV) * this.aimTransition
        );

        // 조준시 반동/흔들림 감소
        const aimMultiplier = 1 - this.aimTransition * 0.7;
        const breathSway = Math.sin(this.gunIdleTime * 2) * 0.003 * aimMultiplier;
        const walkBob = (Math.abs(moveX) > 0 || Math.abs(moveZ) > 0)
          ? Math.sin(this.gunIdleTime * 15) * 0.01 * aimMultiplier
          : 0;

        // 총 위치 보간 (ADS 시 화면 중앙으로)
        const normalPos = this.normalGunPos;
        const aimPos = this.currentWeapon.type === 'sniper'
          ? new BABYLON.Vector3(0, -0.05, 0.3) // 저격총 스코프 위치
          : this.aimGunPos;

        this.gunParent.position.x = normalPos.x + (aimPos.x - normalPos.x) * this.aimTransition + Math.sin(this.gunIdleTime * 2.5) * 0.002 * aimMultiplier;
        this.gunParent.position.y = normalPos.y + (aimPos.y - normalPos.y) * this.aimTransition + breathSway + walkBob - this.recoilAmount * 2.5 * aimMultiplier;
        this.gunParent.position.z = normalPos.z + (aimPos.z - normalPos.z) * this.aimTransition;
        this.gunParent.rotation.x = -this.recoilAmount * 3.5 * aimMultiplier;

        // 저격총 스코프 오버레이
        this.updateScopeOverlay();
      }

      // 지형 청크 업데이트
      this.updateTerrainChunks(capsulePos);

      // 탄약 픽업
      this.checkAmmoPickups(capsulePos);

      // 체력 픽업
      this.checkHealthPickups(capsulePos);

      // 점프대 체크
      this.checkJumpPads(capsulePos);

      // 폭발 배럴 체크 (총알 충돌)
      this.checkExplosiveBarrels();

      // 탈것 조작
      this.updateVehicleControls(deltaTime);

      // 차량 체력바 업데이트
      this.updateVehicleHealthBars();

      // 적 AI
      this.updateEnemies();

      // 적 스폰
      this.enemySpawnTimer += deltaTime;
      if (this.enemySpawnTimer > 5) {
        this.spawnRandomEnemy();
        this.enemySpawnTimer = 0;
      }

      // UI
      this.updateUI();
    });
  }

  checkAmmoPickups(playerPos) {
    if (!this.ammoPickups) return;

    for (let i = this.ammoPickups.length - 1; i >= 0; i--) {
      const pickup = this.ammoPickups[i];
      if (!pickup.box || pickup.box.isDisposed()) continue;

      const distance = BABYLON.Vector3.Distance(playerPos, pickup.box.position);

      if (distance < 2) {
        // 현재 무기에 탄약 추가
        this.currentWeapon.reserveAmmo += pickup.ammoAmount;
        pickup.box.dispose();
        pickup.decor.dispose();
        this.ammoPickups.splice(i, 1);
        console.log(`탄약 획득! +${pickup.ammoAmount} (예비: ${this.currentWeapon.reserveAmmo})`);
      }
    }
  }

  checkHealthPickups(playerPos) {
    if (!this.healthPickups) return;

    for (let i = this.healthPickups.length - 1; i >= 0; i--) {
      const pickup = this.healthPickups[i];
      if (!pickup.mesh || pickup.mesh.isDisposed()) {
        this.healthPickups.splice(i, 1);
        continue;
      }

      const distance = BABYLON.Vector3.Distance(playerPos, pickup.mesh.position);

      if (distance < 2 && this.playerStats.health < 100) {
        this.playerStats.health = Math.min(100, this.playerStats.health + pickup.healAmount);
        pickup.mesh.dispose();
        this.healthPickups.splice(i, 1);
        console.log(`체력 회복! +${pickup.healAmount} (체력: ${this.playerStats.health})`);

        // 회복 효과
        this.showHealEffect();
      }
    }
  }

  showHealEffect() {
    let healOverlay = document.getElementById('heal-overlay');
    if (!healOverlay) {
      healOverlay = document.createElement('div');
      healOverlay.id = 'heal-overlay';
      healOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle, transparent 30%, rgba(0, 255, 100, 0.3) 100%);
        pointer-events: none;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.1s;
      `;
      document.body.appendChild(healOverlay);
    }

    healOverlay.style.opacity = '1';
    setTimeout(() => {
      healOverlay.style.opacity = '0';
    }, 200);
  }

  updateScopeOverlay() {
    // 저격총 스코프 오버레이
    let scopeOverlay = document.getElementById('scope-overlay');

    if (this.currentWeapon.type === 'sniper' && this.aimTransition > 0.8) {
      if (!scopeOverlay) {
        scopeOverlay = document.createElement('div');
        scopeOverlay.id = 'scope-overlay';
        scopeOverlay.innerHTML = `
          <div class="scope-circle"></div>
          <div class="scope-crosshair-h"></div>
          <div class="scope-crosshair-v"></div>
          <div class="scope-mil-dots"></div>
        `;
        scopeOverlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 999;
          display: flex;
          align-items: center;
          justify-content: center;
        `;

        const style = document.createElement('style');
        style.textContent = `
          .scope-circle {
            position: absolute;
            width: 80vh;
            height: 80vh;
            border: 3px solid black;
            border-radius: 50%;
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.95);
          }
          .scope-crosshair-h {
            position: absolute;
            width: 80vh;
            height: 2px;
            background: black;
          }
          .scope-crosshair-v {
            position: absolute;
            width: 2px;
            height: 80vh;
            background: black;
          }
          .scope-mil-dots {
            position: absolute;
            width: 80vh;
            height: 80vh;
          }
        `;
        document.head.appendChild(style);
        document.body.appendChild(scopeOverlay);
      }
      scopeOverlay.style.opacity = (this.aimTransition - 0.8) * 5;
      scopeOverlay.style.display = 'flex';
    } else if (scopeOverlay) {
      scopeOverlay.style.display = 'none';
    }
  }

  checkJumpPads(playerPos) {
    if (!this.jumpPads) return;

    this.jumpPads.forEach(pad => {
      if (!pad.mesh || pad.mesh.isDisposed()) return;

      const distance = BABYLON.Vector3.Distance(playerPos, pad.position);

      if (distance < 1.5 && this.playerAggregate) {
        // 플레이어를 위로 발사
        const velocity = this.playerAggregate.body.getLinearVelocity();
        if (velocity.y < 5) { // 이미 점프 중이 아닐 때만
          this.playerAggregate.body.setLinearVelocity(new BABYLON.Vector3(
            velocity.x,
            pad.power,
            velocity.z
          ));

          // 점프 효과
          this.createJumpPadEffect(pad.position);
        }
      }
    });
  }

  createJumpPadEffect(position) {
    // 점프 파티클
    for (let i = 0; i < 10; i++) {
      const particle = BABYLON.MeshBuilder.CreateSphere('jumpParticle', { diameter: 0.1 }, this.scene);
      const mat = new BABYLON.StandardMaterial('jumpMat', this.scene);
      mat.emissiveColor = new BABYLON.Color3(0, 1, 1);
      mat.disableLighting = true;
      particle.material = mat;
      particle.position = position.clone();
      particle.position.y += 0.3;

      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      const vel = new BABYLON.Vector3(
        Math.cos(angle) * speed,
        3 + Math.random() * 2,
        Math.sin(angle) * speed
      );

      let life = 0;
      const animate = () => {
        life += 0.016;
        particle.position.addInPlace(vel.scale(0.016));
        vel.y -= 5 * 0.016;
        mat.alpha = 1 - life * 2;

        if (life < 0.5) {
          requestAnimationFrame(animate);
        } else {
          particle.dispose();
        }
      };
      animate();
    }
  }

  checkExplosiveBarrels() {
    if (!this.explosiveBarrels || !this.activeBullets) return;

    // 총알과 배럴 충돌 체크
    this.activeBullets.forEach(bullet => {
      if (!bullet.active) return;

      this.explosiveBarrels.forEach(barrel => {
        if (barrel.exploded || !barrel.mesh || barrel.mesh.isDisposed()) return;

        const dist = BABYLON.Vector3.Distance(bullet.mesh.position, barrel.mesh.position);
        if (dist < 1.5) {
          barrel.health -= 10;

          if (barrel.health <= 0 && !barrel.exploded) {
            barrel.exploded = true;
            const pos = barrel.mesh.position.clone();
            barrel.mesh.dispose();
            this.createExplosion(pos, 10, 60);
          }
        }
      });
    });
  }

  updateEnemies() {
    if (!this.player) return;

    const deltaTime = this.engine.getDeltaTime() / 1000;

    if (!this.enemyAttackCooldown) this.enemyAttackCooldown = 0;
    this.enemyAttackCooldown -= deltaTime;

    this.enemies.forEach(enemy => {
      if (!enemy.mesh || !enemy.aggregate) return;

      const enemyPos = enemy.mesh.position;
      const playerPos = this.collisionCapsule ? this.collisionCapsule.position : this.player.position;
      const distanceToPlayer = BABYLON.Vector3.Distance(enemyPos, playerPos);

      if (distanceToPlayer < enemy.detectionRange) {
        enemy.state = 'chase';
      } else if (distanceToPlayer > enemy.detectionRange * 1.5) {
        enemy.state = 'patrol';
      }

      let targetDir;
      let currentSpeed;

      if (enemy.state === 'chase') {
        targetDir = playerPos.subtract(enemyPos);
        targetDir.y = 0;
        targetDir.normalize();
        currentSpeed = enemy.chaseSpeed;

        // 적 사격 쿨다운 감소
        if (enemy.shootCooldown > 0) {
          enemy.shootCooldown -= deltaTime;
        }

        // 원거리 사격 (attackRange 내에서)
        if (distanceToPlayer < enemy.attackRange && distanceToPlayer > 3 && enemy.shootCooldown <= 0) {
          enemy.shootCooldown = enemy.shootInterval;
          this.enemyShoot(enemy, playerPos);
        }

        // 근접 공격
        if (distanceToPlayer < 2.0 && this.enemyAttackCooldown <= 0) {
          this.enemyAttackCooldown = 1.0;
          this.playerStats.health -= 10;
          this.showDamageEffect();
          console.log(`공격당함! 체력: ${this.playerStats.health}`);

          if (this.playerAggregate) {
            const knockbackDir = this.collisionCapsule.position.subtract(enemyPos);
            knockbackDir.y = 0.5;
            knockbackDir.normalize();
            this.playerAggregate.body.applyImpulse(
              knockbackDir.scale(200),
              this.collisionCapsule.position
            );
          }

          if (this.playerStats.health <= 0) {
            this.gameOver();
          }
        }
      } else {
        enemy.patrolAngle += deltaTime * 0.3;
        const patrolX = enemy.initialPosition.x + Math.cos(enemy.patrolAngle) * enemy.patrolRadius;
        const patrolZ = enemy.initialPosition.z + Math.sin(enemy.patrolAngle) * enemy.patrolRadius;

        targetDir = new BABYLON.Vector3(patrolX - enemyPos.x, 0, patrolZ - enemyPos.z);
        if (targetDir.length() > 0.1) {
          targetDir.normalize();
        }
        currentSpeed = enemy.speed;
      }

      if (targetDir && targetDir.length() > 0) {
        const currentVelocity = enemy.aggregate.body.getLinearVelocity();
        enemy.aggregate.body.setLinearVelocity(new BABYLON.Vector3(
          targetDir.x * currentSpeed,
          currentVelocity.y,
          targetDir.z * currentSpeed
        ));

        const angle = Math.atan2(targetDir.x, targetDir.z);
        enemy.mesh.rotation.y = angle;
      }

      // 우스꽝스러운 애니메이션
      const time = Date.now() * (enemy.state === 'chase' ? 0.015 : 0.008);
      const armSwing = enemy.state === 'chase' ? 0.6 : 0.3;

      // 팔 흔들기 (과장된 동작)
      const leftArm = enemy.mesh.getChildMeshes().find(m => m.name === 'leftArm');
      const rightArm = enemy.mesh.getChildMeshes().find(m => m.name === 'rightArm');
      if (leftArm) {
        leftArm.rotation.x = Math.PI / 2.5 + Math.sin(time) * armSwing;
        leftArm.rotation.z = 0.3 + Math.sin(time * 0.5) * 0.2;
      }
      if (rightArm) {
        rightArm.rotation.x = Math.PI / 2.5 + Math.cos(time) * armSwing;
        rightArm.rotation.z = -0.3 - Math.sin(time * 0.5) * 0.2;
      }

      // 다리 흔들기 (뒤뚱뒤뚱)
      const leftLeg = enemy.mesh.getChildMeshes().find(m => m.name === 'leftLeg');
      const rightLeg = enemy.mesh.getChildMeshes().find(m => m.name === 'rightLeg');
      const legSwing = enemy.state === 'chase' ? 0.4 : 0.2;
      if (leftLeg) leftLeg.rotation.x = Math.sin(time) * legSwing;
      if (rightLeg) rightLeg.rotation.x = Math.cos(time) * legSwing;

      // 발 흔들기
      const leftFoot = enemy.mesh.getChildMeshes().find(m => m.name === 'leftFoot');
      const rightFoot = enemy.mesh.getChildMeshes().find(m => m.name === 'rightFoot');
      if (leftFoot) leftFoot.rotation.x = Math.sin(time) * 0.3;
      if (rightFoot) rightFoot.rotation.x = Math.cos(time) * 0.3;

      // 몸통 좌우로 흔들기 (펭귄처럼 뒤뚱뒤뚱)
      const body = enemy.mesh.getChildMeshes().find(m => m.name === 'enemyBody');
      if (body) {
        const waddle = enemy.state === 'chase' ? 0.15 : 0.08;
        body.rotation.z = Math.sin(time * 2) * waddle;
      }

      // 머리 애니메이션 (더 크고 과장된 움직임)
      const head = enemy.mesh.getChildMeshes().find(m => m.name === 'enemyHead');
      if (head) {
        const bobTime = Date.now() * 0.004;
        // 위아래로 더 많이 흔들림
        head.position.y = 1.7 + Math.sin(bobTime * 3) * 0.15;
        // 좌우로도 흔들림
        head.position.x = Math.sin(bobTime * 2) * 0.1;
        // 크기 변화 (놀랄 때 더 커짐)
        const baseScale = enemy.state === 'chase' ? 1.2 : 1.0;
        const scaleWobble = Math.sin(bobTime * 4) * 0.15;
        head.scaling = new BABYLON.Vector3(baseScale + scaleWobble, baseScale + scaleWobble, 1);
      }

      // 배꼽 부분 흔들기
      const belly = enemy.mesh.getChildMeshes().find(m => m.name === 'belly');
      if (belly) {
        belly.scaling.x = 1 + Math.sin(time * 3) * 0.1;
        belly.scaling.y = 1 + Math.cos(time * 3) * 0.1;
      }

      // 적 체력바 업데이트
      if (enemy.healthBar && enemy.maxHealth) {
        const healthPercent = Math.max(0, enemy.health / enemy.maxHealth);
        enemy.healthBar.scaling.x = healthPercent;
        enemy.healthBar.position.x = -(1 - healthPercent) * 0.55;

        // 체력에 따라 색상 변경
        const healthBarMat = enemy.healthBar.material;
        if (healthPercent > 0.6) {
          healthBarMat.diffuseColor = new BABYLON.Color3(0.1, 0.9, 0.1);
          healthBarMat.emissiveColor = new BABYLON.Color3(0.1, 0.6, 0.1);
        } else if (healthPercent > 0.3) {
          healthBarMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.1);
          healthBarMat.emissiveColor = new BABYLON.Color3(0.6, 0.6, 0.1);
        } else {
          healthBarMat.diffuseColor = new BABYLON.Color3(0.9, 0.1, 0.1);
          healthBarMat.emissiveColor = new BABYLON.Color3(0.6, 0.1, 0.1);
        }
      }
    });
  }

  enemyShoot(enemy, targetPos) {
    if (!enemy.mesh) return;

    const enemyPos = enemy.mesh.position.clone();
    enemyPos.y += 0.8; // 총 높이

    // 타겟 방향 (약간의 부정확성 추가)
    const direction = targetPos.subtract(enemyPos);
    direction.x += (Math.random() - 0.5) * 0.4;
    direction.y += (Math.random() - 0.5) * 0.3;
    direction.z += (Math.random() - 0.5) * 0.4;
    direction.normalize();

    // 머즐 플래시 효과
    const flash = BABYLON.MeshBuilder.CreateSphere('enemyFlash', { diameter: 0.2 }, this.scene);
    const flashMat = new BABYLON.StandardMaterial('enemyFlashMat', this.scene);
    flashMat.emissiveColor = new BABYLON.Color3(1, 0.4, 0.1);
    flashMat.disableLighting = true;
    flash.material = flashMat;
    flash.position = enemyPos.clone();

    setTimeout(() => flash.dispose(), 60);

    // 매트릭스 스타일 총알 발사
    this.createMatrixBullet(enemyPos, direction, 'enemy');

    // 사격 소리
    this.playEnemyGunSound(enemy.mesh.position);
  }

  playEnemyGunSound(enemyPos) {
    if (!this.audioContext) return;

    const playerPos = this.collisionCapsule ? this.collisionCapsule.position : this.player.position;
    const distance = BABYLON.Vector3.Distance(enemyPos, playerPos);
    const volume = Math.max(0, 0.3 - distance / 100);

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.1);

    gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.15);
  }

  showDamageEffect() {
    let damageOverlay = document.getElementById('damage-overlay');
    if (!damageOverlay) {
      damageOverlay = document.createElement('div');
      damageOverlay.id = 'damage-overlay';
      damageOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle, transparent 30%, rgba(255, 0, 0, 0.55) 100%);
        pointer-events: none;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.08s;
      `;
      document.body.appendChild(damageOverlay);
    }

    damageOverlay.style.opacity = '1';
    setTimeout(() => {
      damageOverlay.style.opacity = '0';
    }, 120);

    if (this.camera) {
      const shakeIntensity = 0.12;
      let shakeTime = 0;

      const shake = () => {
        shakeTime += 0.016;
        if (shakeTime < 0.15) {
          this.camera.rotation.x += (Math.random() - 0.5) * shakeIntensity;
          this.camera.rotation.y += (Math.random() - 0.5) * shakeIntensity * 0.5;
          requestAnimationFrame(shake);
        }
      };
      shake();
    }
  }

  gameOver() {
    let gameOverUI = document.getElementById('game-over');
    if (!gameOverUI) {
      gameOverUI = document.createElement('div');
      gameOverUI.id = 'game-over';
      gameOverUI.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 2000;
        color: white;
        font-family: Arial, sans-serif;
      `;
      gameOverUI.innerHTML = `
        <h1 style="font-size: 64px; color: #ff3333; margin-bottom: 20px; text-shadow: 0 0 20px #ff0000;">GAME OVER</h1>
        <p style="font-size: 24px; margin-bottom: 40px;">당신은 쓰러졌습니다...</p>
        <button id="restart-btn" style="
          padding: 15px 40px;
          font-size: 20px;
          background: #ff4444;
          border: none;
          color: white;
          cursor: pointer;
          border-radius: 10px;
          transition: all 0.3s;
        ">다시 시작</button>
      `;
      document.body.appendChild(gameOverUI);

      document.getElementById('restart-btn').addEventListener('click', () => {
        location.reload();
      });
    }

    document.exitPointerLock();
  }

  updateUI() {
    const fpsElement = document.getElementById('fps');
    const posElement = document.getElementById('position');

    if (fpsElement) {
      fpsElement.textContent = this.engine.getFps().toFixed(0);
    }

    if (posElement && this.player) {
      const pos = this.player.position;
      posElement.textContent = `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
    }

    // 탄약 UI
    let ammoElement = document.getElementById('ammo-display');
    if (!ammoElement) {
      ammoElement = document.createElement('div');
      ammoElement.id = 'ammo-display';
      ammoElement.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0,0,0,0.75);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: 'Arial', sans-serif;
        font-size: 22px;
        font-weight: bold;
        z-index: 100;
        border: 2px solid #444;
      `;
      document.body.appendChild(ammoElement);
    }

    const reloadText = this.isReloading ? ' (재장전중...)' : '';
    const modeText = this.currentWeapon.autoFire ? (this.isAutoFire ? '[연사]' : '[단발]') : '[단발]';
    const weaponName = this.currentWeapon.name;
    ammoElement.innerHTML = `${weaponName} ${modeText} ${this.currentWeapon.magazineAmmo} / ${this.currentWeapon.reserveAmmo}${reloadText}`;

    // 크로스헤어
    let crosshair = document.getElementById('crosshair');
    if (!crosshair) {
      crosshair = document.createElement('div');
      crosshair.id = 'crosshair';
      crosshair.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 3px;
        height: 3px;
        background: rgba(255,255,255,0.9);
        border-radius: 50%;
        z-index: 100;
        box-shadow: 0 0 2px rgba(0,0,0,0.6);
      `;
      document.body.appendChild(crosshair);
    }

    // 조작 힌트
    let hints = document.getElementById('control-hints');
    if (!hints) {
      hints = document.createElement('div');
      hints.id = 'control-hints';
      hints.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.7);
        color: #fff;
        padding: 12px 20px;
        border-radius: 10px;
        font-family: Arial, sans-serif;
        font-size: 11px;
        z-index: 100;
        border: 1px solid rgba(255,255,255,0.2);
      `;
      hints.innerHTML = `
        <div>R: 재장전 | V: 시점전환 | B: 연사/단발 | T: 탑승 | F: 전체화면 | ESC: 마우스 해제</div>
      `;
      document.body.appendChild(hints);
    }

    this.updateMinimap();
    this.updateSurvivalStats();
  }

  updateMinimap() {
    // 미니맵 컨테이너 생성
    let minimapContainer = document.getElementById('minimap-container');
    if (!minimapContainer) {
      minimapContainer = document.createElement('div');
      minimapContainer.id = 'minimap-container';
      minimapContainer.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        width: 180px;
        height: 180px;
        border-radius: 50%;
        overflow: hidden;
        border: 3px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.7), inset 0 0 30px rgba(0, 0, 0, 0.5);
        z-index: 100;
        background: rgba(20, 30, 20, 0.85);
      `;
      document.body.appendChild(minimapContainer);

      // 미니맵 캔버스
      const minimapCanvas = document.createElement('canvas');
      minimapCanvas.id = 'minimap-canvas';
      minimapCanvas.width = 180;
      minimapCanvas.height = 180;
      minimapCanvas.style.cssText = `
        width: 100%;
        height: 100%;
      `;
      minimapContainer.appendChild(minimapCanvas);

      // 플레이어 방향 화살표 (고정, 중앙)
      const playerArrow = document.createElement('div');
      playerArrow.id = 'minimap-player';
      playerArrow.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-bottom: 16px solid #00ff00;
        filter: drop-shadow(0 0 3px #00ff00);
        z-index: 10;
      `;
      minimapContainer.appendChild(playerArrow);

      // 나침반 방향 표시
      const compassN = document.createElement('div');
      compassN.id = 'minimap-compass-n';
      compassN.style.cssText = `
        position: absolute;
        top: 5px;
        left: 50%;
        transform: translateX(-50%);
        color: #ff4444;
        font-size: 12px;
        font-weight: bold;
        text-shadow: 0 0 3px #000;
        z-index: 5;
      `;
      compassN.textContent = 'N';
      minimapContainer.appendChild(compassN);

      // 외곽 링
      const outerRing = document.createElement('div');
      outerRing.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        border: 2px solid rgba(100, 100, 100, 0.5);
        pointer-events: none;
        box-sizing: border-box;
      `;
      minimapContainer.appendChild(outerRing);
    }

    if (!this.player) return;

    const canvas = document.getElementById('minimap-canvas');
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = 2.5; // 미니맵 스케일 (1 = 1 unit per pixel)

    // 플레이어 위치와 회전
    const playerPos = this.player.position;
    const playerRotY = this.camera ? this.camera.rotation.y : 0;

    // 캔버스 클리어
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 배경 그라데이션
    const bgGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 90);
    bgGradient.addColorStop(0, 'rgba(40, 60, 40, 0.9)');
    bgGradient.addColorStop(1, 'rgba(20, 30, 20, 0.95)');
    ctx.fillStyle = bgGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 90, 0, Math.PI * 2);
    ctx.fill();

    // 격자 그리기
    ctx.strokeStyle = 'rgba(100, 150, 100, 0.2)';
    ctx.lineWidth = 1;
    for (let r = 30; r <= 90; r += 30) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 십자선
    ctx.beginPath();
    ctx.moveTo(centerX - 85, centerY);
    ctx.lineTo(centerX + 85, centerY);
    ctx.moveTo(centerX, centerY - 85);
    ctx.lineTo(centerX, centerY + 85);
    ctx.stroke();

    // 지형 청크 그리기 (로드된 청크들)
    ctx.fillStyle = 'rgba(60, 100, 60, 0.4)';
    this.loadedChunks.forEach(key => {
      const [cx, cz] = key.split(',').map(Number);
      const chunkWorldX = cx * this.chunkSize;
      const chunkWorldZ = cz * this.chunkSize;

      // 플레이어 기준 상대 위치
      const relX = chunkWorldX - playerPos.x;
      const relZ = chunkWorldZ - playerPos.z;

      // 회전 적용 (플레이어 방향이 위를 향하도록)
      const rotatedX = relX * Math.cos(-playerRotY) - relZ * Math.sin(-playerRotY);
      const rotatedZ = relX * Math.sin(-playerRotY) + relZ * Math.cos(-playerRotY);

      const screenX = centerX + rotatedX / scale;
      const screenY = centerY + rotatedZ / scale;
      const chunkScreenSize = this.chunkSize / scale;

      // 미니맵 범위 내에 있으면 그리기
      if (Math.abs(screenX - centerX) < 100 && Math.abs(screenY - centerY) < 100) {
        ctx.fillRect(screenX - chunkScreenSize / 2, screenY - chunkScreenSize / 2, chunkScreenSize, chunkScreenSize);
      }
    });

    // 건물 그리기
    if (this.buildings) {
      this.buildings.forEach(building => {
        const bPos = building.parent.position;
        const relX = bPos.x - playerPos.x;
        const relZ = bPos.z - playerPos.z;

        const rotatedX = relX * Math.cos(-playerRotY) - relZ * Math.sin(-playerRotY);
        const rotatedZ = relX * Math.sin(-playerRotY) + relZ * Math.cos(-playerRotY);

        const screenX = centerX + rotatedX / scale;
        const screenY = centerY + rotatedZ / scale;

        const dist = Math.sqrt(rotatedX * rotatedX + rotatedZ * rotatedZ) / scale;
        if (dist < 85) {
          // 건물 타입에 따른 색상
          let color = '#888888';
          let size = 6;
          if (building.type === 'apartment') {
            color = '#6688aa';
            size = 8;
          } else if (building.type === 'house') {
            color = '#aa8866';
            size = 5;
          } else if (building.type === 'tower') {
            color = '#666699';
            size = 7;
          }

          ctx.fillStyle = color;
          ctx.fillRect(screenX - size / 2, screenY - size / 2, size, size);
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.lineWidth = 1;
          ctx.strokeRect(screenX - size / 2, screenY - size / 2, size, size);
        }
      });
    }

    // 탄약 상자 그리기
    if (this.ammoPickups) {
      this.ammoPickups.forEach(pickup => {
        if (!pickup.mesh || pickup.mesh.isDisposed()) return;

        const aPos = pickup.mesh.position;
        const relX = aPos.x - playerPos.x;
        const relZ = aPos.z - playerPos.z;

        const rotatedX = relX * Math.cos(-playerRotY) - relZ * Math.sin(-playerRotY);
        const rotatedZ = relX * Math.sin(-playerRotY) + relZ * Math.cos(-playerRotY);

        const screenX = centerX + rotatedX / scale;
        const screenY = centerY + rotatedZ / scale;

        const dist = Math.sqrt(rotatedX * rotatedX + rotatedZ * rotatedZ) / scale;
        if (dist < 85) {
          ctx.fillStyle = '#ffcc00';
          ctx.beginPath();
          ctx.arc(screenX, screenY, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // 탈것 그리기
    if (this.vehicles) {
      this.vehicles.forEach(vehicle => {
        if (!vehicle.body) return;

        const vPos = vehicle.body.position;
        const relX = vPos.x - playerPos.x;
        const relZ = vPos.z - playerPos.z;

        const rotatedX = relX * Math.cos(-playerRotY) - relZ * Math.sin(-playerRotY);
        const rotatedZ = relX * Math.sin(-playerRotY) + relZ * Math.cos(-playerRotY);

        const screenX = centerX + rotatedX / scale;
        const screenY = centerY + rotatedZ / scale;

        const dist = Math.sqrt(rotatedX * rotatedX + rotatedZ * rotatedZ) / scale;
        if (dist < 85) {
          ctx.fillStyle = '#00aaff';
          ctx.beginPath();
          // 차량 아이콘 (작은 사각형)
          ctx.fillRect(screenX - 4, screenY - 3, 8, 6);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.strokeRect(screenX - 4, screenY - 3, 8, 6);
        }
      });
    }

    // 적 그리기
    if (this.enemies) {
      this.enemies.forEach(enemy => {
        if (!enemy.mesh || enemy.isDead) return;

        const ePos = enemy.mesh.position;
        const relX = ePos.x - playerPos.x;
        const relZ = ePos.z - playerPos.z;

        const rotatedX = relX * Math.cos(-playerRotY) - relZ * Math.sin(-playerRotY);
        const rotatedZ = relX * Math.sin(-playerRotY) + relZ * Math.cos(-playerRotY);

        const screenX = centerX + rotatedX / scale;
        const screenY = centerY + rotatedZ / scale;

        const dist = Math.sqrt(rotatedX * rotatedX + rotatedZ * rotatedZ) / scale;
        if (dist < 85) {
          // 적 빨간 점
          ctx.fillStyle = '#ff3333';
          ctx.beginPath();
          ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
          ctx.fill();

          // 외곽선
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(screenX, screenY, 5, 0, Math.PI * 2);
          ctx.stroke();

          // 깜빡임 효과 (가까운 적)
          const actualDist = Math.sqrt(relX * relX + relZ * relZ);
          if (actualDist < 30) {
            ctx.strokeStyle = `rgba(255, 0, 0, ${0.5 + 0.5 * Math.sin(Date.now() / 200)})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(screenX, screenY, 7, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      });
    }

    // 원형 마스크 (클리핑)
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 88, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // 나침반 회전 업데이트
    const compassN = document.getElementById('minimap-compass-n');
    if (compassN) {
      // 북쪽 방향 계산
      const northAngle = -playerRotY;
      const northX = centerX + Math.sin(northAngle) * 75;
      const northY = centerY - Math.cos(northAngle) * 75;
      compassN.style.left = `${northX}px`;
      compassN.style.top = `${northY}px`;
      compassN.style.transform = 'translate(-50%, -50%)';
    }
  }

  updateSurvivalStats() {
    const deltaTime = this.engine.getDeltaTime() / 1000;
    this.playerStats.hunger = Math.max(0, this.playerStats.hunger - deltaTime * 0.5);
    this.playerStats.thirst = Math.max(0, this.playerStats.thirst - deltaTime * 0.8);

    const velocity = this.playerAggregate?.body.getLinearVelocity();
    if (velocity && (Math.abs(velocity.x) > 0.1 || Math.abs(velocity.z) > 0.1)) {
      this.playerStats.stamina = Math.max(0, this.playerStats.stamina - deltaTime * 2);
    } else {
      this.playerStats.stamina = Math.min(100, this.playerStats.stamina + deltaTime * 5);
    }

    if (this.playerStats.hunger <= 0 || this.playerStats.thirst <= 0) {
      this.playerStats.health = Math.max(0, this.playerStats.health - deltaTime * 5);
    }

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

    this.dayTime += deltaTime * 0.1;
    const timeElement = document.getElementById('time');
    const dayPhase = (this.dayTime % 100) / 100;

    if (timeElement) {
      if (dayPhase < 0.25) {
        timeElement.textContent = '새벽';
      } else if (dayPhase < 0.5) {
        timeElement.textContent = '낮';
      } else if (dayPhase < 0.75) {
        timeElement.textContent = '저녁';
      } else {
        timeElement.textContent = '밤';
      }
    }
  }

  hideLoading() {
    const loading = document.getElementById('loading');
    const ui = document.getElementById('ui');
    const controls = document.getElementById('controls');

    if (loading) loading.classList.add('hidden');
    if (ui) ui.classList.remove('hidden');
    if (controls) controls.classList.remove('hidden');
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

// 게임 시작
new Game();
