// UIManager - UI 관련 기능 관리

export class UIManager {
  constructor(game) {
    this.game = game;
  }

  setupMenu() {
    // 캐릭터 선택
    document.querySelectorAll('.character-option').forEach(option => {
      option.addEventListener('click', () => {
        document.querySelectorAll('.character-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        this.game.customization.characterType = option.getAttribute('data-character');
      });
    });

    // 색상 선택
    document.querySelectorAll('.color-option').forEach(option => {
      option.addEventListener('click', () => {
        document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        this.game.customization.color = option.getAttribute('data-color');
      });
    });

    // 크기 선택
    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.game.customization.size = parseFloat(btn.getAttribute('data-size'));
      });
    });

    // 체형 선택
    document.querySelectorAll('.body-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.body-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.game.customization.bodyType = btn.getAttribute('data-body');
      });
    });

    // 게임 시작 버튼
    const startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        const menu = document.getElementById('mainMenu');
        if (menu) menu.style.display = 'none';
        this.game.init();
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
        if (this.game.camera) {
          this.game.camera.angularSensibility = 2000 / parseFloat(mouseSensitivity.value);
        }
      });
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

  updateUI() {
    const fpsElement = document.getElementById('fps');
    const posElement = document.getElementById('position');

    if (fpsElement) {
      fpsElement.textContent = this.game.engine.getFps().toFixed(0);
    }

    if (posElement && this.game.player) {
      const pos = this.game.player.position;
      posElement.textContent = `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
    }

    // 저격총 스코프 줌 상태 확인
    const weapon = this.game.weaponSystem;
    const isScoping = weapon.currentWeapon.type === 'sniper' && weapon.aimTransition > 0.5;

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

    const currentWeapon = weapon.currentWeapon;
    const reloadText = weapon.isReloading ? ' (재장전중...)' : '';
    const modeText = currentWeapon.autoFire ? (weapon.isAutoFire ? '[연사]' : '[단발]') : '[단발]';
    const weaponName = currentWeapon.name;
    ammoElement.innerHTML = `${weaponName} ${modeText} ${currentWeapon.magazineAmmo} / ${currentWeapon.reserveAmmo}${reloadText}`;
    // 스코프 줌 시 탄약 UI 숨김
    ammoElement.style.display = isScoping ? 'none' : 'block';

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
    // 스코프 줌 시 크로스헤어 숨김
    crosshair.style.display = isScoping ? 'none' : 'block';

    // 무기 선택 UI
    this.updateWeaponSelector(isScoping);

    // 조작 힌트
    this.updateControlHints(isScoping);

    this.updateMinimap(isScoping);
    this.updateSurvivalStats(isScoping);
  }

  updateWeaponSelector(isScoping = false) {
    let weaponSelector = document.getElementById('weapon-selector');
    if (!weaponSelector) {
      weaponSelector = document.createElement('div');
      weaponSelector.id = 'weapon-selector';
      weaponSelector.style.cssText = `
        position: fixed;
        bottom: 220px;
        left: 20px;
        background: rgba(0,0,0,0.75);
        padding: 10px;
        border-radius: 10px;
        z-index: 100;
        border: 2px solid rgba(255,255,255,0.3);
      `;
      document.body.appendChild(weaponSelector);
    }

    // 스코프 줌 시 숨김
    weaponSelector.style.display = isScoping ? 'none' : 'block';
    if (isScoping) return;

    const weapons = this.game.weaponSystem.weapons;
    const currentIndex = this.game.weaponSystem.currentWeaponIndex;

    let html = '<div style="color: #aaa; font-size: 10px; margin-bottom: 8px; text-align: center;">무기 선택 (1-8 / Q,E)</div>';
    html += '<div style="display: flex; flex-wrap: wrap; gap: 5px; max-width: 200px;">';

    weapons.forEach((weapon, index) => {
      const isSelected = index === currentIndex;
      const hasAmmo = weapon.magazineAmmo > 0 || weapon.reserveAmmo > 0;

      // 무기 타입별 아이콘/색상
      let icon = '';
      let bgColor = 'rgba(60,60,60,0.8)';
      switch(weapon.type) {
        case 'pistol': icon = '🔫'; bgColor = isSelected ? '#446644' : 'rgba(60,60,60,0.8)'; break;
        case 'rifle': icon = '🎯'; bgColor = isSelected ? '#446644' : 'rgba(60,60,60,0.8)'; break;
        case 'shotgun': icon = '💥'; bgColor = isSelected ? '#446644' : 'rgba(60,60,60,0.8)'; break;
        case 'smg': icon = '⚡'; bgColor = isSelected ? '#446644' : 'rgba(60,60,60,0.8)'; break;
        case 'grenade': icon = '💣'; bgColor = isSelected ? '#446644' : 'rgba(60,60,60,0.8)'; break;
        case 'rocket': icon = '🚀'; bgColor = isSelected ? '#446644' : 'rgba(60,60,60,0.8)'; break;
        case 'laser': icon = '✨'; bgColor = isSelected ? '#446644' : 'rgba(60,60,60,0.8)'; break;
        case 'sniper': icon = '🎯'; bgColor = isSelected ? '#446644' : 'rgba(60,60,60,0.8)'; break;
        default: icon = '•';
      }

      const borderColor = isSelected ? '#00ff00' : (hasAmmo ? '#666' : '#ff4444');
      const opacity = hasAmmo ? '1' : '0.5';

      html += `
        <div style="
          width: 40px;
          height: 50px;
          background: ${bgColor};
          border: 2px solid ${borderColor};
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          opacity: ${opacity};
          ${isSelected ? 'box-shadow: 0 0 10px #00ff00;' : ''}
        ">
          <div style="font-size: 16px;">${icon}</div>
          <div style="color: #fff; font-size: 9px; font-weight: bold;">${index + 1}</div>
          <div style="color: ${hasAmmo ? '#8f8' : '#f88'}; font-size: 8px;">${weapon.magazineAmmo}</div>
        </div>
      `;
    });

    html += '</div>';

    // 현재 무기 상세 정보
    const current = weapons[currentIndex];
    html += `
      <div style="
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px solid rgba(255,255,255,0.2);
        color: #fff;
        font-size: 11px;
      ">
        <div style="color: #00ff00; font-weight: bold; margin-bottom: 4px;">${current.name}</div>
        <div style="color: #aaa;">데미지: <span style="color: #ff8844;">${current.damage}</span></div>
        <div style="color: #aaa;">발사속도: <span style="color: #44aaff;">${(1/current.fireRate).toFixed(1)}/s</span></div>
        ${current.autoFire ? '<div style="color: #ffaa00;">연사 가능</div>' : ''}
        ${current.explosive ? '<div style="color: #ff4444;">폭발성</div>' : ''}
      </div>
    `;

    weaponSelector.innerHTML = html;
  }

  updateControlHints(isScoping = false) {
    let hints = document.getElementById('control-hints');
    if (!hints) {
      hints = document.createElement('div');
      hints.id = 'control-hints';
      hints.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.8);
        color: #fff;
        padding: 12px 20px;
        border-radius: 10px;
        font-family: Arial, sans-serif;
        font-size: 11px;
        z-index: 100;
        border: 1px solid rgba(255,255,255,0.2);
        max-width: 600px;
      `;
      document.body.appendChild(hints);
    }

    // 스코프 줌 시 숨김
    hints.style.display = isScoping ? 'none' : 'block';
    if (isScoping) return;

    hints.innerHTML = `
      <div style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center;">
        <div style="text-align: center;">
          <div style="color: #88ff88; font-weight: bold; margin-bottom: 4px;">이동</div>
          <div><span style="background: #444; padding: 2px 6px; border-radius: 3px; margin: 0 2px;">W</span><span style="background: #444; padding: 2px 6px; border-radius: 3px; margin: 0 2px;">A</span><span style="background: #444; padding: 2px 6px; border-radius: 3px; margin: 0 2px;">S</span><span style="background: #444; padding: 2px 6px; border-radius: 3px; margin: 0 2px;">D</span></div>
        </div>
        <div style="text-align: center;">
          <div style="color: #88ff88; font-weight: bold; margin-bottom: 4px;">점프</div>
          <div><span style="background: #444; padding: 2px 6px; border-radius: 3px;">Space</span></div>
        </div>
        <div style="text-align: center;">
          <div style="color: #ffaa44; font-weight: bold; margin-bottom: 4px;">사격</div>
          <div><span style="background: #444; padding: 2px 6px; border-radius: 3px;">좌클릭</span></div>
        </div>
        <div style="text-align: center;">
          <div style="color: #ffaa44; font-weight: bold; margin-bottom: 4px;">조준</div>
          <div><span style="background: #444; padding: 2px 6px; border-radius: 3px;">우클릭</span></div>
        </div>
        <div style="text-align: center;">
          <div style="color: #44aaff; font-weight: bold; margin-bottom: 4px;">재장전</div>
          <div><span style="background: #444; padding: 2px 6px; border-radius: 3px;">R</span></div>
        </div>
        <div style="text-align: center;">
          <div style="color: #44aaff; font-weight: bold; margin-bottom: 4px;">무기변경</div>
          <div><span style="background: #444; padding: 2px 6px; border-radius: 3px;">1-8</span> / <span style="background: #444; padding: 2px 6px; border-radius: 3px;">Q</span><span style="background: #444; padding: 2px 6px; border-radius: 3px;">E</span></div>
        </div>
        <div style="text-align: center;">
          <div style="color: #ff88ff; font-weight: bold; margin-bottom: 4px;">수류탄</div>
          <div><span style="background: #444; padding: 2px 6px; border-radius: 3px;">G</span></div>
        </div>
        <div style="text-align: center;">
          <div style="color: #aaaaaa; font-weight: bold; margin-bottom: 4px;">기타</div>
          <div><span style="background: #444; padding: 2px 6px; border-radius: 3px;">V</span>시점 <span style="background: #444; padding: 2px 6px; border-radius: 3px;">B</span>연사 <span style="background: #444; padding: 2px 6px; border-radius: 3px;">T</span>탑승</div>
        </div>
      </div>
    `;
  }

  updateMinimap(isScoping = false) {
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

    // 스코프 줌 시 숨김
    minimapContainer.style.display = isScoping ? 'none' : 'block';
    if (isScoping) return;

    if (!this.game.player) return;

    const canvas = document.getElementById('minimap-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = 2.5; // 미니맵 스케일

    // 플레이어 위치와 회전
    const playerPos = this.game.player.position;
    const playerRotY = this.game.camera ? this.game.camera.rotation.y : 0;

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

    // 지형 청크 그리기
    const terrainSystem = this.game.terrainSystem;
    if (terrainSystem && terrainSystem.loadedChunks) {
      ctx.fillStyle = 'rgba(60, 100, 60, 0.4)';
      terrainSystem.loadedChunks.forEach(key => {
        const [cx, cz] = key.split(',').map(Number);
        const chunkWorldX = cx * terrainSystem.chunkSize;
        const chunkWorldZ = cz * terrainSystem.chunkSize;

        const relX = chunkWorldX - playerPos.x;
        const relZ = chunkWorldZ - playerPos.z;

        const rotatedX = relX * Math.cos(-playerRotY) - relZ * Math.sin(-playerRotY);
        const rotatedZ = relX * Math.sin(-playerRotY) + relZ * Math.cos(-playerRotY);

        const screenX = centerX + rotatedX / scale;
        const screenY = centerY + rotatedZ / scale;
        const chunkScreenSize = terrainSystem.chunkSize / scale;

        if (Math.abs(screenX - centerX) < 100 && Math.abs(screenY - centerY) < 100) {
          ctx.fillRect(screenX - chunkScreenSize / 2, screenY - chunkScreenSize / 2, chunkScreenSize, chunkScreenSize);
        }
      });
    }

    // 건물 그리기
    if (terrainSystem && terrainSystem.buildings) {
      terrainSystem.buildings.forEach(building => {
        if (!building.parent) return;
        const bPos = building.parent.position;
        const relX = bPos.x - playerPos.x;
        const relZ = bPos.z - playerPos.z;

        const rotatedX = relX * Math.cos(-playerRotY) - relZ * Math.sin(-playerRotY);
        const rotatedZ = relX * Math.sin(-playerRotY) + relZ * Math.cos(-playerRotY);

        const screenX = centerX + rotatedX / scale;
        const screenY = centerY + rotatedZ / scale;

        const dist = Math.sqrt(rotatedX * rotatedX + rotatedZ * rotatedZ) / scale;
        if (dist < 85) {
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
    if (terrainSystem && terrainSystem.ammoPickups) {
      terrainSystem.ammoPickups.forEach(pickup => {
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
    const vehicleSystem = this.game.vehicleSystem;
    if (vehicleSystem && vehicleSystem.spawnedVehicles) {
      vehicleSystem.spawnedVehicles.forEach(vehicle => {
        if (!vehicle.parent || vehicle.parent.isDisposed()) return;

        const vPos = vehicle.parent.position;
        const relX = vPos.x - playerPos.x;
        const relZ = vPos.z - playerPos.z;

        const rotatedX = relX * Math.cos(-playerRotY) - relZ * Math.sin(-playerRotY);
        const rotatedZ = relX * Math.sin(-playerRotY) + relZ * Math.cos(-playerRotY);

        const screenX = centerX + rotatedX / scale;
        const screenY = centerY + rotatedZ / scale;

        const dist = Math.sqrt(rotatedX * rotatedX + rotatedZ * rotatedZ) / scale;
        if (dist < 85) {
          ctx.fillStyle = '#00aaff';
          ctx.fillRect(screenX - 4, screenY - 3, 8, 6);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.strokeRect(screenX - 4, screenY - 3, 8, 6);
        }
      });
    }

    // 적 그리기
    const enemySystem = this.game.enemySystem;
    if (enemySystem && enemySystem.enemies) {
      enemySystem.enemies.forEach(enemy => {
        // 유효하지 않은 적 필터링: mesh가 없거나, dispose되었거나, aggregate가 없는 경우
        if (!enemy.mesh || enemy.mesh.isDisposed() || !enemy.aggregate || enemy.isDead) return;
        // 체력이 0 이하인 적도 필터링
        if (enemy.health <= 0) return;

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

    // 원형 마스크
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 88, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // 나침반 회전 업데이트
    const compassN = document.getElementById('minimap-compass-n');
    if (compassN) {
      const northAngle = -playerRotY;
      const northX = centerX + Math.sin(northAngle) * 75;
      const northY = centerY - Math.cos(northAngle) * 75;
      compassN.style.left = `${northX}px`;
      compassN.style.top = `${northY}px`;
      compassN.style.transform = 'translate(-50%, -50%)';
    }
  }

  updateSurvivalStats(isScoping = false) {
    const deltaTime = this.game.engine.getDeltaTime() / 1000;
    this.game.playerStats.hunger = Math.max(0, this.game.playerStats.hunger - deltaTime * 0.5);
    this.game.playerStats.thirst = Math.max(0, this.game.playerStats.thirst - deltaTime * 0.8);

    const velocity = this.game.playerAggregate?.body.getLinearVelocity();
    if (velocity && (Math.abs(velocity.x) > 0.1 || Math.abs(velocity.z) > 0.1)) {
      this.game.playerStats.stamina = Math.max(0, this.game.playerStats.stamina - deltaTime * 2);
    } else {
      this.game.playerStats.stamina = Math.min(100, this.game.playerStats.stamina + deltaTime * 5);
    }

    if (this.game.playerStats.hunger <= 0 || this.game.playerStats.thirst <= 0) {
      this.game.playerStats.health = Math.max(0, this.game.playerStats.health - deltaTime * 5);
    }

    // 왼쪽 상단 UI 숨김 처리
    const uiElement = document.getElementById('ui');
    if (uiElement) {
      uiElement.style.opacity = isScoping ? '0' : '1';
    }

    // 스코프 줌 시 업데이트 스킵
    if (isScoping) return;

    const healthBar = document.getElementById('health-bar');
    const staminaBar = document.getElementById('stamina-bar');
    const hungerBar = document.getElementById('hunger-bar');
    const thirstBar = document.getElementById('thirst-bar');

    if (healthBar) healthBar.style.width = `${this.game.playerStats.health}%`;
    if (staminaBar) staminaBar.style.width = `${this.game.playerStats.stamina}%`;
    if (hungerBar) hungerBar.style.width = `${this.game.playerStats.hunger}%`;
    if (thirstBar) thirstBar.style.width = `${this.game.playerStats.thirst}%`;

    const healthText = document.getElementById('health-text');
    const staminaText = document.getElementById('stamina-text');
    const hungerText = document.getElementById('hunger-text');
    const thirstText = document.getElementById('thirst-text');

    if (healthText) healthText.textContent = this.game.playerStats.health.toFixed(0);
    if (staminaText) staminaText.textContent = this.game.playerStats.stamina.toFixed(0);
    if (hungerText) hungerText.textContent = this.game.playerStats.hunger.toFixed(0);
    if (thirstText) thirstText.textContent = this.game.playerStats.thirst.toFixed(0);

    this.game.dayTime += deltaTime * 0.1;
    const timeElement = document.getElementById('time');
    const dayPhase = (this.game.dayTime % 100) / 100;

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

  updateScopeOverlay() {
    let scopeOverlay = document.getElementById('scope-overlay');
    const weapon = this.game.weaponSystem;

    if (weapon.currentWeapon.type === 'sniper' && weapon.aimTransition > 0.8) {
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
      scopeOverlay.style.opacity = (weapon.aimTransition - 0.8) * 5;
      scopeOverlay.style.display = 'flex';
    } else if (scopeOverlay) {
      scopeOverlay.style.display = 'none';
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
}
