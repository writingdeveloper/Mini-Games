// Sky Explorer - 3D Flight Game
// Using CesiumJS for globe rendering

// Cesium Ion Access Token - Injected at build time
Cesium.Ion.defaultAccessToken = '__CESIUM_TOKEN_PLACEHOLDER__';

// ==================== Internationalization ====================
const i18n = {
    ko: {
        gameTitle: 'SKY EXPLORER',
        gameSubtitle: '3D 비행 시뮬레이터',
        selectLocation: '출발 위치 선택',
        gameMode: '게임 모드',
        freeMode: '자유 비행',
        checkpointMode: '체크포인트',
        survivalMode: '서바이벌',
        startFlight: '비행 시작',
        controls: '조작법',
        paused: '일시정지',
        resume: '계속하기',
        restart: '다시 시작',
        quitToMenu: '메뉴로',
        gameOver: '게임 오버',
        score: '점수',
        distance: '거리',
        flightTime: '비행 시간',
        tryAgain: '다시 도전',
        mainMenu: '메인 메뉴',
        loading: '로딩 중...',
        freeFlightMode: '자유 비행 모드',
        checkpointRace: '체크포인트 통과!',
        survivalModeObj: '서바이벌 - 최대한 멀리!',
        thirdPerson: '📷 3인칭',
        cockpitView: '📷 조종석',
        showControls: '조작법 보기',
        hideControls: '조작법 숨기기',
        controlsHelp: {
            pitchUpDown: '상승/하강',
            rollLeftRight: '좌/우 기울기',
            yawLeftRight: '좌/우 회전',
            throttle: '스로틀 증가/감소',
            camera: '카메라 전환',
            minimap: '미니맵 토글',
            pause: '일시정지',
            controls: '조작법 토글',
            shoot: '발사'
        },
        ammo: '탄약',
        targetDestroyed: '타겟 파괴!'
    },
    en: {
        gameTitle: 'SKY EXPLORER',
        gameSubtitle: '3D Flight Simulator',
        selectLocation: 'Select Starting Location',
        gameMode: 'Game Mode',
        freeMode: 'Free Flight',
        checkpointMode: 'Checkpoint',
        survivalMode: 'Survival',
        startFlight: 'START FLIGHT',
        controls: 'Controls',
        paused: 'PAUSED',
        resume: 'Resume',
        restart: 'Restart',
        quitToMenu: 'Quit to Menu',
        gameOver: 'GAME OVER',
        score: 'Score',
        distance: 'Distance',
        flightTime: 'Flight Time',
        tryAgain: 'Try Again',
        mainMenu: 'Main Menu',
        loading: 'Loading...',
        freeFlightMode: 'Free Flight Mode',
        checkpointRace: 'Pass through the rings!',
        survivalModeObj: 'Survival - Fly as far as possible!',
        thirdPerson: '📷 Third Person',
        cockpitView: '📷 Cockpit View',
        showControls: 'Show Controls',
        hideControls: 'Hide Controls',
        controlsHelp: {
            pitchUpDown: 'Pitch Up/Down',
            rollLeftRight: 'Roll Left/Right',
            yawLeftRight: 'Yaw Left/Right',
            throttle: 'Throttle Up/Down',
            camera: 'Toggle Camera',
            minimap: 'Toggle Minimap',
            pause: 'Pause',
            controls: 'Toggle Controls',
            shoot: 'Fire'
        },
        ammo: 'Ammo',
        targetDestroyed: 'Target Destroyed!'
    }
};

let currentLang = navigator.language.startsWith('ko') ? 'ko' : 'en';

function t(key) {
    const keys = key.split('.');
    let value = i18n[currentLang];
    for (const k of keys) {
        value = value?.[k];
    }
    return value || key;
}

function setLanguage(lang) {
    currentLang = lang;
    updateUILanguage();
}

// ==================== Constants ====================
const PHYSICS = {
    GRAVITY: 9.81,
    AIR_DENSITY: 1.225,
    AIRCRAFT: {
        MASS: 1500,
        WING_AREA: 25,
        MAX_THRUST: 40000,
        LIFT_COEFFICIENT: 0.8,
        DRAG_COEFFICIENT: 0.04,
        MIN_SPEED: 40,
        MAX_SPEED: 350,
        CRUISE_SPEED: 120,
        PITCH_RATE: 0.6,
        ROLL_RATE: 1.2,
        YAW_RATE: 0.4,
        MIN_ALTITUDE: 10,
        MAX_ALTITUDE: 15000,
        MAX_FUEL: 100,
        FUEL_CONSUMPTION_RATE: 0.015,
    }
};

const GAME_CONFIG = {
    SCORE: {
        CHECKPOINT: 100,
        DISTANCE_PER_100M: 1,
        COMBO_MULTIPLIERS: [1, 1.5, 2, 2.5, 3],
    },
    CHECKPOINT: {
        RING_RADIUS: 50,
        SPAWN_DISTANCE: 2000,
        COUNT_PER_LEVEL: 10,
    },
    WARNINGS: {
        LOW_FUEL_THRESHOLD: 20,
        LOW_ALTITUDE_THRESHOLD: 100,
        STALL_SPEED_THRESHOLD: 50,
    },
    CAMERA: {
        THIRD_PERSON_DISTANCE: 60,
        THIRD_PERSON_HEIGHT: 20,
        SMOOTH_FACTOR: 0.1,
    }
};

const KEYS = {
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
    TOGGLE_CONTROLS: ['KeyH'],
    PAUSE: ['Escape'],
    FIRE: ['Space'],
    FIRE_MISSILE: ['KeyF'],
    FIRE_FLARE: ['KeyG'],
    FIRE_NUKE: ['KeyN'],
};

// Weapon Config
const WEAPON_CONFIG = {
    MAX_AMMO: 100,
    FIRE_RATE: 0.1, // seconds between shots
    BULLET_SPEED: 800, // m/s
    BULLET_LIFETIME: 3, // seconds
    DAMAGE: 25,
    TARGET_RADIUS: 30,
    TARGET_SPAWN_DISTANCE: 1500,
    SCORE_PER_HIT: 50,
    // Ammo recharge system
    AMMO_RECHARGE_RATE: 5, // ammo per second when not firing
    AMMO_RECHARGE_DELAY: 2, // seconds after firing before recharge starts
    // Missile system for player
    MAX_MISSILES: 6,
    MISSILE_DAMAGE: 100,
    MISSILE_SPEED: 300,
    MISSILE_LIFETIME: 8,
    MISSILE_RECHARGE_TIME: 10, // seconds to recharge one missile
    // Flare defense system
    MAX_FLARES: 10,
    FLARE_SPEED: 50,
    FLARE_LIFETIME: 4, // seconds
    FLARE_ATTRACT_RADIUS: 200, // meters - radius to attract missiles
    FLARE_RECHARGE_TIME: 15, // seconds to recharge one flare
    // Nuclear bomb
    MAX_NUKES: 3,
    NUKE_SPEED: 100,
    NUKE_LIFETIME: 10,
    NUKE_DAMAGE: 1000,
    NUKE_BLAST_RADIUS: 800, // meters - bigger blast
    NUKE_RECHARGE_TIME: 25, // seconds to recharge - faster
};

// ==================== Flight Physics ====================
class FlightPhysics {
    constructor(initialAltitude = 500) {
        this.config = PHYSICS.AIRCRAFT;
        this.reset(initialAltitude);
    }

    reset(altitude = 500) {
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
            verticalSpeed: 0,
        };
    }

    getState() {
        return { ...this.state };
    }

    update(input, deltaTime) {
        const dt = Math.min(deltaTime, 0.1); // Cap delta time

        // Update throttle
        this.updateThrottle(input, dt);

        // Update orientation
        this.updateOrientation(input, dt);

        // Update flight dynamics
        this.updateFlightDynamics(dt);

        // Update fuel
        this.updateFuel(dt);

        return this.getState();
    }

    updateThrottle(input, dt) {
        const throttleRate = 0.5;
        if (input.throttleUp && this.state.fuel > 0) {
            this.state.throttle = Math.min(1, this.state.throttle + throttleRate * dt);
        }
        if (input.throttleDown) {
            this.state.throttle = Math.max(0, this.state.throttle - throttleRate * dt);
        }
    }

    updateOrientation(input, dt) {
        const speedRatio = Math.min(1, this.state.speed / this.config.CRUISE_SPEED);
        const controlEffectiveness = Math.max(0.2, speedRatio);

        // Pitch control
        if (input.pitchUp) {
            this.state.pitch += this.config.PITCH_RATE * controlEffectiveness * dt;
        }
        if (input.pitchDown) {
            this.state.pitch -= this.config.PITCH_RATE * controlEffectiveness * dt;
        }

        // Auto-stabilize pitch when no input
        if (!input.pitchUp && !input.pitchDown) {
            this.state.pitch *= 0.98;
        }

        // Roll control
        if (input.rollLeft) {
            this.state.roll += this.config.ROLL_RATE * controlEffectiveness * dt;
        }
        if (input.rollRight) {
            this.state.roll -= this.config.ROLL_RATE * controlEffectiveness * dt;
        }

        // Auto-level roll when no input
        if (!input.rollLeft && !input.rollRight) {
            this.state.roll *= 0.95;
        }

        // Yaw from roll (coordinated turn)
        const rollYaw = Math.sin(this.state.roll) * 0.5 * dt;

        // Direct yaw control
        if (input.yawLeft) {
            this.state.heading -= this.config.YAW_RATE * controlEffectiveness * dt;
        }
        if (input.yawRight) {
            this.state.heading += this.config.YAW_RATE * controlEffectiveness * dt;
        }
        this.state.heading += rollYaw;

        // Clamp values
        this.state.pitch = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, this.state.pitch));
        this.state.roll = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.state.roll));

        // Normalize heading
        while (this.state.heading > Math.PI) this.state.heading -= 2 * Math.PI;
        while (this.state.heading < -Math.PI) this.state.heading += 2 * Math.PI;
    }

    updateFlightDynamics(dt) {
        // Thrust
        const thrust = this.state.fuel > 0 ? this.config.MAX_THRUST * this.state.throttle : 0;

        // Drag increases with speed squared
        const dragForce = 0.5 * PHYSICS.AIR_DENSITY * this.state.speed * this.state.speed *
                         this.config.WING_AREA * this.config.DRAG_COEFFICIENT;

        // Net horizontal acceleration
        const netForce = thrust - dragForce;
        const acceleration = netForce / this.config.MASS;

        // Update speed
        this.state.speed += acceleration * dt;
        this.state.speed = Math.max(20, Math.min(this.config.MAX_SPEED, this.state.speed));

        // Vertical dynamics based on pitch
        // Positive pitch = nose up = climb
        const climbRate = Math.sin(this.state.pitch) * this.state.speed;

        // Lift effect (more speed = more lift capability)
        const liftFactor = Math.min(1, (this.state.speed / this.config.CRUISE_SPEED));

        // Gravity always pulls down
        const gravityEffect = -5; // m/s base sink rate

        // Net vertical speed
        this.state.verticalSpeed = (climbRate * liftFactor) + gravityEffect * (1 - this.state.throttle * 0.5);

        // Stall condition - if too slow with nose up, sink faster
        if (this.state.speed < this.config.MIN_SPEED && this.state.pitch > 0) {
            this.state.verticalSpeed -= 10 * dt * (1 - this.state.speed / this.config.MIN_SPEED);
        }

        // Update altitude
        this.state.altitude += this.state.verticalSpeed * dt;
        this.state.altitude = Math.max(
            this.config.MIN_ALTITUDE,
            Math.min(this.config.MAX_ALTITUDE, this.state.altitude)
        );

        // Calculate velocity components for position update
        const cosHeading = Math.cos(this.state.heading);
        const sinHeading = Math.sin(this.state.heading);
        const horizontalSpeed = this.state.speed * Math.cos(this.state.pitch);

        this.state.velocity = {
            x: horizontalSpeed * sinHeading,
            y: horizontalSpeed * cosHeading,
            z: this.state.verticalSpeed,
        };
    }

    updateFuel(dt) {
        if (this.state.throttle > 0 && this.state.fuel > 0) {
            const consumption = this.config.FUEL_CONSUMPTION_RATE * this.state.throttle * dt;
            this.state.fuel = Math.max(0, this.state.fuel - consumption);
        }
    }

    isStalling() {
        return this.state.speed < this.config.MIN_SPEED;
    }

    isLowFuel() {
        return this.state.fuel < 20;
    }

    getSpeedKmh() {
        return Math.round(this.state.speed * 3.6);
    }
}

// ==================== HUD ====================
class HUD {
    constructor() {
        this.elements = {
            speedValue: document.getElementById('speed-value'),
            scoreValue: document.getElementById('score-value'),
            altitudeValue: document.getElementById('altitude-value'),
            altitudeFill: document.getElementById('altitude-fill'),
            fuelFill: document.getElementById('fuel-fill'),
            fuelPercent: document.getElementById('fuel-percent'),
            throttleFill: document.getElementById('throttle-fill'),
            throttlePercent: document.getElementById('throttle-percent'),
            compassRing: document.getElementById('compass-ring'),
            flightTime: document.getElementById('flight-time'),
            objectiveText: document.getElementById('objective-text'),
            cameraMode: document.getElementById('camera-mode'),
            stallWarning: document.getElementById('stall-warning'),
            fuelWarning: document.getElementById('fuel-warning'),
            altitudeWarning: document.getElementById('altitude-warning'),
            minimapPlane: document.getElementById('minimap-plane'),
            checkpointDistance: document.getElementById('checkpoint-distance'),
            checkpointArrow: document.getElementById('checkpoint-arrow'),
            checkpointIndicator: document.getElementById('checkpoint-indicator'),
            verticalSpeed: document.getElementById('vertical-speed'),
            ammoValue: document.getElementById('ammo-value'),
            ammoFill: document.getElementById('ammo-fill'),
            missileCount: document.getElementById('missile-count'),
        };
        this.score = 0;
        this.flightTimeSeconds = 0;
        this.distanceTraveled = 0;
    }

    update(state, deltaTime) {
        this.flightTimeSeconds += deltaTime;

        // Speed
        const speedKmh = Math.round(state.speed * 3.6);
        this.updateElement(this.elements.speedValue, speedKmh.toString());

        // Altitude
        this.updateElement(this.elements.altitudeValue, Math.round(state.altitude).toString());

        const altPercent = Math.min(100, (state.altitude / 10000) * 100);
        if (this.elements.altitudeFill) {
            this.elements.altitudeFill.style.height = `${altPercent}%`;
        }

        // Vertical speed indicator
        if (this.elements.verticalSpeed) {
            const vs = Math.round(state.verticalSpeed);
            const vsText = vs >= 0 ? `+${vs}` : `${vs}`;
            this.elements.verticalSpeed.textContent = `${vsText} m/s`;
            this.elements.verticalSpeed.style.color = vs >= 0 ? '#00ff88' : '#ff4444';
        }

        // Fuel
        const fuelPercent = Math.round(state.fuel);
        if (this.elements.fuelFill) {
            this.elements.fuelFill.style.width = `${fuelPercent}%`;
        }
        this.updateElement(this.elements.fuelPercent, `${fuelPercent}%`);

        // Throttle
        const throttlePercent = Math.round(state.throttle * 100);
        if (this.elements.throttleFill) {
            this.elements.throttleFill.style.width = `${throttlePercent}%`;
        }
        this.updateElement(this.elements.throttlePercent, `${throttlePercent}%`);

        // Compass
        const headingDeg = ((state.heading * 180 / Math.PI) + 360) % 360;
        if (this.elements.compassRing) {
            this.elements.compassRing.style.transform = `rotate(${-headingDeg}deg)`;
        }

        // Flight time
        this.updateElement(this.elements.flightTime, this.formatTime(this.flightTimeSeconds));

        // Minimap plane rotation
        if (this.elements.minimapPlane) {
            this.elements.minimapPlane.style.transform = `translate(-50%, -50%) rotate(${headingDeg}deg)`;
        }

        // Score
        this.updateElement(this.elements.scoreValue, this.score.toString());

        // Warnings
        this.updateWarnings(state);
    }

    updateWarnings(state) {
        const isStalling = state.speed < GAME_CONFIG.WARNINGS.STALL_SPEED_THRESHOLD;
        this.toggleWarning(this.elements.stallWarning, isStalling);

        const isLowFuel = state.fuel < GAME_CONFIG.WARNINGS.LOW_FUEL_THRESHOLD;
        this.toggleWarning(this.elements.fuelWarning, isLowFuel);

        const isLowAltitude = state.altitude < GAME_CONFIG.WARNINGS.LOW_ALTITUDE_THRESHOLD;
        this.toggleWarning(this.elements.altitudeWarning, isLowAltitude);
    }

    toggleWarning(element, show) {
        if (element) {
            element.classList.toggle('hidden', !show);
        }
    }

    updateCheckpointIndicator(distance, direction, aircraftHeading) {
        if (distance < 0) {
            this.hideCheckpointIndicator();
            return;
        }
        this.showCheckpointIndicator();
        const distanceKm = (distance / 1000).toFixed(1);
        this.updateElement(this.elements.checkpointDistance, `${distanceKm} km`);
        const relativeAngle = ((direction - aircraftHeading) * 180 / Math.PI + 360) % 360;
        if (this.elements.checkpointArrow) {
            this.elements.checkpointArrow.style.transform = `rotate(${relativeAngle}deg)`;
        }
    }

    showCheckpointIndicator() {
        this.elements.checkpointIndicator?.classList.remove('hidden');
    }

    hideCheckpointIndicator() {
        this.elements.checkpointIndicator?.classList.add('hidden');
    }

    updateObjective(text) {
        this.updateElement(this.elements.objectiveText, text);
    }

    updateCameraMode(mode) {
        this.updateElement(this.elements.cameraMode, mode);
    }

    updateAmmo(current, max) {
        this.updateElement(this.elements.ammoValue, Math.floor(current).toString());
        if (this.elements.ammoFill) {
            const percent = (current / max) * 100;
            this.elements.ammoFill.style.width = `${percent}%`;
            // Change color based on ammo level
            if (percent < 20) {
                this.elements.ammoFill.style.background = 'linear-gradient(90deg, #ff4444, #ff6666)';
            } else if (percent < 50) {
                this.elements.ammoFill.style.background = 'linear-gradient(90deg, #ffaa00, #ffcc00)';
            } else {
                this.elements.ammoFill.style.background = 'linear-gradient(90deg, #00d4ff, #7c3aed)';
            }
        }
    }

    updateMissileCount(count) {
        if (this.elements.missileCount) {
            this.elements.missileCount.textContent = count.toString();
            // Change color based on count
            if (count === 0) {
                this.elements.missileCount.style.color = '#ff4444';
            } else if (count <= 2) {
                this.elements.missileCount.style.color = '#ffaa00';
            } else {
                this.elements.missileCount.style.color = '#ff6644';
            }
        }
    }

    updateFlareCount(count) {
        const flareEl = document.getElementById('flare-count');
        if (flareEl) {
            flareEl.textContent = count.toString();
            if (count === 0) {
                flareEl.style.color = '#ff4444';
            } else if (count <= 3) {
                flareEl.style.color = '#ffaa00';
            } else {
                flareEl.style.color = '#ffdd44';
            }
        }
    }

    updateNukeCount(count) {
        const nukeEl = document.getElementById('nuke-count');
        if (nukeEl) {
            nukeEl.textContent = count.toString();
            if (count === 0) {
                nukeEl.style.color = '#666666';
            } else {
                nukeEl.style.color = '#ff0000';
                nukeEl.style.textShadow = '0 0 10px rgba(255, 0, 0, 0.8)';
            }
        }
    }

    addScore(points) {
        this.score += points;
    }

    getScore() { return this.score; }
    getFlightTime() { return this.flightTimeSeconds; }
    getDistanceTraveled() { return this.distanceTraveled; }

    addDistance(meters) {
        this.distanceTraveled += meters;
    }

    show() {
        const hud = document.getElementById('hud');
        if (hud) hud.classList.remove('hidden');
    }

    hide() {
        const hud = document.getElementById('hud');
        if (hud) hud.classList.add('hidden');
    }

    reset() {
        this.score = 0;
        this.flightTimeSeconds = 0;
        this.distanceTraveled = 0;
    }

    updateElement(element, value) {
        if (element) element.textContent = value;
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// ==================== Minimap ====================
class Minimap {
    constructor() {
        this.canvas = document.getElementById('minimap-canvas');
        this.ctx = this.canvas?.getContext('2d');
        this.scale = 0.00004;
        this.scanAngle = 0;
        this.scanSpeed = 0.03;
        this.enemies = [];
        this.bullets = [];
        this.playerMissiles = [];
        this.enemyMissiles = [];
        this.flares = [];
        this.groundEnemies = [];
        if (this.canvas) {
            this.canvas.width = 180;
            this.canvas.height = 180;
        }
    }

    setEnemies(enemies) {
        this.enemies = enemies || [];
    }

    setProjectiles(bullets, playerMissiles, enemyMissiles, flares) {
        this.bullets = bullets || [];
        this.playerMissiles = playerMissiles || [];
        this.enemyMissiles = enemyMissiles || [];
        this.flares = flares || [];
    }

    setGroundEnemies(groundEnemies) {
        this.groundEnemies = groundEnemies || [];
    }

    render(aircraftLon, aircraftLat, heading, checkpoints = []) {
        if (!this.ctx || !this.canvas) return;

        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - 5;

        // Clear with dark background
        this.ctx.fillStyle = 'rgba(0, 15, 30, 0.95)';
        this.ctx.fillRect(0, 0, width, height);

        // Circular radar mask
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.clip();

        // Radar background gradient
        const bgGradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        bgGradient.addColorStop(0, 'rgba(0, 40, 60, 0.9)');
        bgGradient.addColorStop(0.7, 'rgba(0, 25, 40, 0.95)');
        bgGradient.addColorStop(1, 'rgba(0, 10, 20, 1)');
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(0, 0, width, height);

        // Draw radar rings
        this.drawRadarRings(centerX, centerY, radius);

        // Draw grid lines
        this.drawRadarGrid(centerX, centerY, radius, heading);

        // Draw radar sweep
        this.drawRadarSweep(centerX, centerY, radius, heading);

        // Draw checkpoints
        checkpoints.forEach(cp => {
            const relX = (cp.longitude - aircraftLon) / this.scale;
            const relY = -(cp.latitude - aircraftLat) / this.scale;
            // Rotate relative to heading
            const rotX = relX * Math.cos(-heading) - relY * Math.sin(-heading);
            const rotY = relX * Math.sin(-heading) + relY * Math.cos(-heading);
            const x = centerX + rotX;
            const y = centerY + rotY;
            const dist = Math.sqrt(rotX * rotX + rotY * rotY);

            if (dist < radius - 5) {
                // Checkpoint glow
                const cpGlow = this.ctx.createRadialGradient(x, y, 0, x, y, 8);
                cpGlow.addColorStop(0, cp.passed ? 'rgba(0, 255, 136, 0.8)' : 'rgba(255, 100, 100, 0.8)');
                cpGlow.addColorStop(1, 'transparent');
                this.ctx.fillStyle = cpGlow;
                this.ctx.beginPath();
                this.ctx.arc(x, y, 8, 0, Math.PI * 2);
                this.ctx.fill();

                // Checkpoint dot
                this.ctx.beginPath();
                this.ctx.arc(x, y, 4, 0, Math.PI * 2);
                this.ctx.fillStyle = cp.passed ? '#00ff88' : '#ff6666';
                this.ctx.fill();
            }
        });

        // Draw enemies
        this.enemies.forEach(enemy => {
            const relX = (enemy.longitude - aircraftLon) / this.scale;
            const relY = -(enemy.latitude - aircraftLat) / this.scale;
            // Rotate relative to heading
            const rotX = relX * Math.cos(-heading) - relY * Math.sin(-heading);
            const rotY = relX * Math.sin(-heading) + relY * Math.cos(-heading);
            const x = centerX + rotX;
            const y = centerY + rotY;
            const dist = Math.sqrt(rotX * rotX + rotY * rotY);

            if (dist < radius - 5) {
                // Enemy threat glow (pulsing)
                const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
                const enemyGlow = this.ctx.createRadialGradient(x, y, 0, x, y, 12);
                enemyGlow.addColorStop(0, `rgba(255, 50, 50, ${0.6 + pulse * 0.4})`);
                enemyGlow.addColorStop(1, 'transparent');
                this.ctx.fillStyle = enemyGlow;
                this.ctx.beginPath();
                this.ctx.arc(x, y, 12, 0, Math.PI * 2);
                this.ctx.fill();

                // Enemy triangle marker
                this.ctx.save();
                this.ctx.translate(x, y);
                const enemyDir = Math.atan2(enemy.longitude - aircraftLon, enemy.latitude - aircraftLat) - heading;
                this.ctx.rotate(enemyDir);
                this.ctx.beginPath();
                this.ctx.moveTo(0, -6);
                this.ctx.lineTo(-4, 4);
                this.ctx.lineTo(4, 4);
                this.ctx.closePath();
                this.ctx.fillStyle = '#ff3333';
                this.ctx.fill();
                this.ctx.strokeStyle = '#ff6666';
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
                this.ctx.restore();
            }
        });

        // Draw bullets (small cyan dots)
        this.bullets.forEach(bullet => {
            if (!bullet.position) return;
            const cartographic = Cesium.Cartographic.fromCartesian(bullet.position);
            const bulletLon = Cesium.Math.toDegrees(cartographic.longitude);
            const bulletLat = Cesium.Math.toDegrees(cartographic.latitude);

            const relX = (bulletLon - aircraftLon) / this.scale;
            const relY = -(bulletLat - aircraftLat) / this.scale;
            const rotX = relX * Math.cos(-heading) - relY * Math.sin(-heading);
            const rotY = relX * Math.sin(-heading) + relY * Math.cos(-heading);
            const x = centerX + rotX;
            const y = centerY + rotY;
            const dist = Math.sqrt(rotX * rotX + rotY * rotY);

            if (dist < radius - 5) {
                this.ctx.beginPath();
                this.ctx.arc(x, y, 2, 0, Math.PI * 2);
                this.ctx.fillStyle = '#00ffff';
                this.ctx.fill();
            }
        });

        // Draw player missiles (yellow triangles)
        this.playerMissiles.forEach(missile => {
            if (!missile.position) return;
            const cartographic = Cesium.Cartographic.fromCartesian(missile.position);
            const missileLon = Cesium.Math.toDegrees(cartographic.longitude);
            const missileLat = Cesium.Math.toDegrees(cartographic.latitude);

            const relX = (missileLon - aircraftLon) / this.scale;
            const relY = -(missileLat - aircraftLat) / this.scale;
            const rotX = relX * Math.cos(-heading) - relY * Math.sin(-heading);
            const rotY = relX * Math.sin(-heading) + relY * Math.cos(-heading);
            const x = centerX + rotX;
            const y = centerY + rotY;
            const dist = Math.sqrt(rotX * rotX + rotY * rotY);

            if (dist < radius - 5) {
                // Missile glow
                const missileGlow = this.ctx.createRadialGradient(x, y, 0, x, y, 6);
                missileGlow.addColorStop(0, 'rgba(255, 255, 0, 0.6)');
                missileGlow.addColorStop(1, 'transparent');
                this.ctx.fillStyle = missileGlow;
                this.ctx.beginPath();
                this.ctx.arc(x, y, 6, 0, Math.PI * 2);
                this.ctx.fill();

                // Missile marker
                this.ctx.beginPath();
                this.ctx.arc(x, y, 3, 0, Math.PI * 2);
                this.ctx.fillStyle = '#ffff00';
                this.ctx.fill();
            }
        });

        // Draw enemy missiles (red blinking - DANGER!)
        this.enemyMissiles.forEach(missile => {
            if (!missile.position) return;
            const cartographic = Cesium.Cartographic.fromCartesian(missile.position);
            const missileLon = Cesium.Math.toDegrees(cartographic.longitude);
            const missileLat = Cesium.Math.toDegrees(cartographic.latitude);

            const relX = (missileLon - aircraftLon) / this.scale;
            const relY = -(missileLat - aircraftLat) / this.scale;
            const rotX = relX * Math.cos(-heading) - relY * Math.sin(-heading);
            const rotY = relX * Math.sin(-heading) + relY * Math.cos(-heading);
            const x = centerX + rotX;
            const y = centerY + rotY;
            const dist = Math.sqrt(rotX * rotX + rotY * rotY);

            if (dist < radius - 5) {
                // Intense blinking for incoming missiles
                const blink = Math.sin(Date.now() / 100) > 0;

                // Danger glow
                const dangerGlow = this.ctx.createRadialGradient(x, y, 0, x, y, 10);
                dangerGlow.addColorStop(0, blink ? 'rgba(255, 0, 0, 0.8)' : 'rgba(255, 100, 0, 0.8)');
                dangerGlow.addColorStop(1, 'transparent');
                this.ctx.fillStyle = dangerGlow;
                this.ctx.beginPath();
                this.ctx.arc(x, y, 10, 0, Math.PI * 2);
                this.ctx.fill();

                // Missile marker (diamond shape)
                this.ctx.save();
                this.ctx.translate(x, y);
                this.ctx.rotate(Math.PI / 4);
                this.ctx.fillStyle = blink ? '#ff0000' : '#ff6600';
                this.ctx.fillRect(-3, -3, 6, 6);
                this.ctx.restore();
            }
        });

        // Draw flares (bright white/yellow bursts)
        this.flares.forEach(flare => {
            if (!flare.position) return;
            const cartographic = Cesium.Cartographic.fromCartesian(flare.position);
            const flareLon = Cesium.Math.toDegrees(cartographic.longitude);
            const flareLat = Cesium.Math.toDegrees(cartographic.latitude);

            const relX = (flareLon - aircraftLon) / this.scale;
            const relY = -(flareLat - aircraftLat) / this.scale;
            const rotX = relX * Math.cos(-heading) - relY * Math.sin(-heading);
            const rotY = relX * Math.sin(-heading) + relY * Math.cos(-heading);
            const x = centerX + rotX;
            const y = centerY + rotY;
            const dist = Math.sqrt(rotX * rotX + rotY * rotY);

            if (dist < radius - 5) {
                // Flare burst effect
                const flareGlow = this.ctx.createRadialGradient(x, y, 0, x, y, 8);
                flareGlow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
                flareGlow.addColorStop(0.5, 'rgba(255, 200, 100, 0.6)');
                flareGlow.addColorStop(1, 'transparent');
                this.ctx.fillStyle = flareGlow;
                this.ctx.beginPath();
                this.ctx.arc(x, y, 8, 0, Math.PI * 2);
                this.ctx.fill();
            }
        });

        // Draw ground enemies (turrets and infantry)
        this.groundEnemies.forEach(groundEnemy => {
            const relX = (groundEnemy.longitude - aircraftLon) / this.scale;
            const relY = -(groundEnemy.latitude - aircraftLat) / this.scale;
            const rotX = relX * Math.cos(-heading) - relY * Math.sin(-heading);
            const rotY = relX * Math.sin(-heading) + relY * Math.cos(-heading);
            const x = centerX + rotX;
            const y = centerY + rotY;
            const dist = Math.sqrt(rotX * rotX + rotY * rotY);

            if (dist < radius - 5) {
                if (groundEnemy.type === 'turret') {
                    // Missile turret - square with X
                    this.ctx.fillStyle = 'rgba(200, 50, 50, 0.8)';
                    this.ctx.fillRect(x - 4, y - 4, 8, 8);
                    this.ctx.strokeStyle = '#ffff00';
                    this.ctx.lineWidth = 1;
                    this.ctx.beginPath();
                    this.ctx.moveTo(x - 3, y - 3);
                    this.ctx.lineTo(x + 3, y + 3);
                    this.ctx.moveTo(x + 3, y - 3);
                    this.ctx.lineTo(x - 3, y + 3);
                    this.ctx.stroke();
                } else {
                    // Infantry - small green dot
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, 3, 0, Math.PI * 2);
                    this.ctx.fillStyle = 'rgba(150, 200, 50, 0.8)';
                    this.ctx.fill();
                }
            }
        });

        // Draw player aircraft
        this.drawPlayerMarker(centerX, centerY);

        this.ctx.restore();

        // Draw radar border
        this.drawRadarBorder(centerX, centerY, radius);

        // Draw compass directions
        this.drawCompass(centerX, centerY, radius, heading);

        // Update scan angle
        this.scanAngle += this.scanSpeed;
        if (this.scanAngle > Math.PI * 2) this.scanAngle -= Math.PI * 2;
    }

    drawRadarRings(cx, cy, radius) {
        this.ctx.strokeStyle = 'rgba(0, 180, 220, 0.2)';
        this.ctx.lineWidth = 1;
        for (let i = 1; i <= 3; i++) {
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, (radius / 3) * i, 0, Math.PI * 2);
            this.ctx.stroke();
        }
    }

    drawRadarGrid(cx, cy, radius, heading) {
        this.ctx.strokeStyle = 'rgba(0, 180, 220, 0.15)';
        this.ctx.lineWidth = 1;
        // Draw crosshair lines
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            this.ctx.beginPath();
            this.ctx.moveTo(cx, cy);
            this.ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
            this.ctx.stroke();
        }
    }

    drawRadarSweep(cx, cy, radius, heading) {
        // Radar sweep effect
        const sweepAngle = this.scanAngle;
        const sweepGradient = this.ctx.createConicGradient(sweepAngle, cx, cy);
        sweepGradient.addColorStop(0, 'rgba(0, 255, 200, 0.3)');
        sweepGradient.addColorStop(0.1, 'rgba(0, 255, 200, 0.1)');
        sweepGradient.addColorStop(0.15, 'transparent');
        sweepGradient.addColorStop(1, 'transparent');

        this.ctx.fillStyle = sweepGradient;
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy);
        this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Sweep line
        this.ctx.strokeStyle = 'rgba(0, 255, 200, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy);
        this.ctx.lineTo(cx + Math.cos(sweepAngle) * radius, cy + Math.sin(sweepAngle) * radius);
        this.ctx.stroke();
    }

    drawPlayerMarker(cx, cy) {
        // Player glow
        const playerGlow = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, 15);
        playerGlow.addColorStop(0, 'rgba(0, 220, 255, 0.6)');
        playerGlow.addColorStop(1, 'transparent');
        this.ctx.fillStyle = playerGlow;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, 15, 0, Math.PI * 2);
        this.ctx.fill();

        // Player aircraft icon (always pointing up)
        this.ctx.fillStyle = '#00ddff';
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy - 8);
        this.ctx.lineTo(cx - 5, cy + 6);
        this.ctx.lineTo(cx, cy + 3);
        this.ctx.lineTo(cx + 5, cy + 6);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.strokeStyle = '#00ffff';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }

    drawRadarBorder(cx, cy, radius) {
        // Outer glow
        this.ctx.strokeStyle = 'rgba(0, 200, 255, 0.3)';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
        this.ctx.stroke();

        // Main border
        this.ctx.strokeStyle = 'rgba(0, 200, 255, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    drawCompass(cx, cy, radius, heading) {
        const directions = ['N', 'E', 'S', 'W'];
        this.ctx.font = 'bold 10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI / 2) - heading - Math.PI / 2;
            const x = cx + Math.cos(angle) * (radius + 12);
            const y = cy + Math.sin(angle) * (radius + 12);

            // Direction letter
            this.ctx.fillStyle = directions[i] === 'N' ? '#ff6666' : 'rgba(0, 200, 255, 0.8)';
            this.ctx.fillText(directions[i], x, y);
        }
    }

    toggle() {
        const minimap = document.getElementById('minimap');
        if (minimap) {
            const isHidden = minimap.style.display === 'none';
            minimap.style.display = isHidden ? 'block' : 'none';
        }
    }
}

// ==================== Checkpoint System ====================
class CheckpointSystem {
    constructor(viewer) {
        this.viewer = viewer;
        this.checkpoints = [];
        this.currentIndex = 0;
        this.combo = 0;
        this.onCheckpointPassed = null;
    }

    generateCheckpoints(startLon, startLat, count = 10) {
        this.clearCheckpoints();

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
            const distance = GAME_CONFIG.CHECKPOINT.SPAWN_DISTANCE * (0.5 + i * 0.3);

            const lon = startLon + (Math.cos(angle) * distance) / 111000;
            const lat = startLat + (Math.sin(angle) * distance) / 111000;
            const alt = 200 + Math.random() * 800;

            this.addCheckpoint(lon, lat, alt, i);
        }
    }

    addCheckpoint(longitude, latitude, altitude, id) {
        const position = Cesium.Cartesian3.fromDegrees(longitude, latitude, altitude);

        const entity = this.viewer.entities.add({
            name: `Checkpoint ${id}`,
            position: position,
            ellipse: {
                semiMajorAxis: GAME_CONFIG.CHECKPOINT.RING_RADIUS,
                semiMinorAxis: GAME_CONFIG.CHECKPOINT.RING_RADIUS,
                height: altitude,
                material: Cesium.Color.RED.withAlpha(0.3),
                outline: true,
                outlineColor: Cesium.Color.RED,
                outlineWidth: 3,
            },
            cylinder: {
                length: 10,
                topRadius: GAME_CONFIG.CHECKPOINT.RING_RADIUS,
                bottomRadius: GAME_CONFIG.CHECKPOINT.RING_RADIUS,
                material: Cesium.Color.RED.withAlpha(0.2),
                outline: true,
                outlineColor: Cesium.Color.RED,
            },
            label: {
                text: `${id + 1}`,
                font: '24px sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            }
        });

        this.checkpoints.push({
            id,
            position: { longitude, latitude, altitude },
            passed: false,
            entity
        });
    }

    checkCollision(aircraftLon, aircraftLat, aircraftAlt) {
        const current = this.checkpoints[this.currentIndex];
        if (!current || current.passed) return null;

        const distance = this.calculateDistance(
            aircraftLon, aircraftLat, aircraftAlt,
            current.position.longitude, current.position.latitude, current.position.altitude
        );

        if (distance < GAME_CONFIG.CHECKPOINT.RING_RADIUS) {
            this.passCheckpoint(current);
            return current;
        }
        return null;
    }

    calculateDistance(lon1, lat1, alt1, lon2, lat2, alt2) {
        const dLon = (lon2 - lon1) * 111000 * Math.cos(lat1 * Math.PI / 180);
        const dLat = (lat2 - lat1) * 111000;
        const dAlt = alt2 - alt1;
        return Math.sqrt(dLon ** 2 + dLat ** 2 + dAlt ** 2);
    }

    passCheckpoint(checkpoint) {
        checkpoint.passed = true;
        this.combo++;
        this.currentIndex++;

        if (checkpoint.entity) {
            checkpoint.entity.ellipse.material = Cesium.Color.GREEN.withAlpha(0.3);
            checkpoint.entity.ellipse.outlineColor = Cesium.Color.GREEN;
            checkpoint.entity.cylinder.material = Cesium.Color.GREEN.withAlpha(0.2);
            checkpoint.entity.cylinder.outlineColor = Cesium.Color.GREEN;
        }

        if (this.onCheckpointPassed) {
            this.onCheckpointPassed(checkpoint, this.combo);
        }
    }

    getNextCheckpoint() {
        return this.checkpoints[this.currentIndex] || null;
    }

    getDistanceToNext(aircraftLon, aircraftLat, aircraftAlt) {
        const next = this.getNextCheckpoint();
        if (!next) return -1;
        return this.calculateDistance(
            aircraftLon, aircraftLat, aircraftAlt,
            next.position.longitude, next.position.latitude, next.position.altitude
        );
    }

    getDirectionToNext(aircraftLon, aircraftLat) {
        const next = this.getNextCheckpoint();
        if (!next) return 0;
        const dLon = next.position.longitude - aircraftLon;
        const dLat = next.position.latitude - aircraftLat;
        return Math.atan2(dLon, dLat);
    }

    setOnCheckpointPassed(callback) {
        this.onCheckpointPassed = callback;
    }

    getProgress() {
        return {
            passed: this.checkpoints.filter(c => c.passed).length,
            total: this.checkpoints.length
        };
    }

    isComplete() {
        return this.currentIndex >= this.checkpoints.length;
    }

    getCheckpointsData() {
        return this.checkpoints.map(c => ({
            longitude: c.position.longitude,
            latitude: c.position.latitude,
            passed: c.passed
        }));
    }

    clearCheckpoints() {
        this.checkpoints.forEach(cp => {
            if (cp.entity) this.viewer.entities.remove(cp.entity);
        });
        this.checkpoints = [];
        this.currentIndex = 0;
        this.combo = 0;
    }

    reset() {
        this.clearCheckpoints();
    }
}

// ==================== Controls Modal ====================
class ControlsModal {
    constructor() {
        this.isVisible = false;
        this.createModal();
    }

    createModal() {
        this.modal = document.createElement('div');
        this.modal.id = 'controls-modal';
        this.modal.className = 'controls-modal hidden';
        this.modal.innerHTML = `
            <div class="controls-modal-content">
                <div class="controls-modal-header">
                    <h3 id="controls-modal-title">${t('controls')}</h3>
                    <button id="close-controls-modal" class="close-btn">&times;</button>
                </div>
                <div class="controls-modal-body">
                    <div class="control-row">
                        <span class="control-key">W / ↑</span>
                        <span class="control-desc" data-i18n="controlsHelp.pitchUpDown">${t('controlsHelp.pitchUpDown')}</span>
                    </div>
                    <div class="control-row">
                        <span class="control-key">S / ↓</span>
                        <span class="control-desc">${currentLang === 'ko' ? '하강 (피치 다운)' : 'Pitch Down (Descend)'}</span>
                    </div>
                    <div class="control-row">
                        <span class="control-key">A / ←</span>
                        <span class="control-desc">${currentLang === 'ko' ? '좌측 기울기 (롤)' : 'Roll Left'}</span>
                    </div>
                    <div class="control-row">
                        <span class="control-key">D / →</span>
                        <span class="control-desc">${currentLang === 'ko' ? '우측 기울기 (롤)' : 'Roll Right'}</span>
                    </div>
                    <div class="control-row">
                        <span class="control-key">Q / E</span>
                        <span class="control-desc" data-i18n="controlsHelp.yawLeftRight">${t('controlsHelp.yawLeftRight')}</span>
                    </div>
                    <div class="control-row">
                        <span class="control-key">Shift / Ctrl</span>
                        <span class="control-desc" data-i18n="controlsHelp.throttle">${t('controlsHelp.throttle')}</span>
                    </div>
                    <div class="control-row">
                        <span class="control-key">C</span>
                        <span class="control-desc" data-i18n="controlsHelp.camera">${t('controlsHelp.camera')}</span>
                    </div>
                    <div class="control-row">
                        <span class="control-key">M</span>
                        <span class="control-desc" data-i18n="controlsHelp.minimap">${t('controlsHelp.minimap')}</span>
                    </div>
                    <div class="control-row">
                        <span class="control-key">H</span>
                        <span class="control-desc" data-i18n="controlsHelp.controls">${t('controlsHelp.controls')}</span>
                    </div>
                    <div class="control-row">
                        <span class="control-key">Space</span>
                        <span class="control-desc">${currentLang === 'ko' ? '기관총 발사' : 'Fire Machine Gun'}</span>
                    </div>
                    <div class="control-row">
                        <span class="control-key">F</span>
                        <span class="control-desc">${currentLang === 'ko' ? '미사일 발사 (적 추적)' : 'Fire Missile (Homing)'}</span>
                    </div>
                    <div class="control-row">
                        <span class="control-key">G</span>
                        <span class="control-desc">${currentLang === 'ko' ? '플레어 발사 (미사일 방어)' : 'Deploy Flares (Missile Defense)'}</span>
                    </div>
                    <div class="control-row">
                        <span class="control-key">N</span>
                        <span class="control-desc">${currentLang === 'ko' ? '핵폭탄 투하 (광역 공격)' : 'Drop Nuclear Bomb (Area Attack)'}</span>
                    </div>
                    <div class="control-row">
                        <span class="control-key">ESC</span>
                        <span class="control-desc" data-i18n="controlsHelp.pause">${t('controlsHelp.pause')}</span>
                    </div>
                    <div class="control-row control-section">
                        <span class="control-key">Mouse</span>
                        <span class="control-desc">${currentLang === 'ko' ? '마우스로 비행기 조종 (클릭으로 활성화)' : 'Mouse Control (Click to Activate)'}</span>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.modal);

        // Close button event
        document.getElementById('close-controls-modal').addEventListener('click', () => this.hide());
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    show() {
        this.modal.classList.remove('hidden');
        this.isVisible = true;
    }

    hide() {
        this.modal.classList.add('hidden');
        this.isVisible = false;
    }
}

// ==================== Menu ====================
class Menu {
    constructor() {
        this.startMenu = document.getElementById('start-menu');
        this.pauseMenu = document.getElementById('pause-menu');
        this.gameoverScreen = document.getElementById('gameover-screen');
        this.loadingScreen = document.getElementById('loading-screen');

        this.selectedLocation = { lat: 37.5665, lon: 126.9780, name: 'Seoul' };
        this.selectedMode = 'free';
        this.callbacks = null;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Language toggle
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                setLanguage(e.currentTarget.dataset.lang);
            });
        });

        // Location buttons
        document.querySelectorAll('.location-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.location-btn').forEach(b => b.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                this.selectedLocation = {
                    lat: parseFloat(e.currentTarget.dataset.lat || '0'),
                    lon: parseFloat(e.currentTarget.dataset.lon || '0'),
                    name: e.currentTarget.dataset.name || 'Unknown'
                };
            });
        });

        // Mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                this.selectedMode = e.currentTarget.dataset.mode || 'free';
            });
        });

        // Start button
        document.getElementById('start-btn')?.addEventListener('click', () => {
            if (this.callbacks?.onStart) {
                this.callbacks.onStart(this.selectedLocation, this.selectedMode);
            }
        });

        // Pause menu buttons
        document.getElementById('resume-btn')?.addEventListener('click', () => {
            this.callbacks?.onResume?.();
        });
        document.getElementById('restart-btn')?.addEventListener('click', () => {
            this.callbacks?.onRestart?.();
        });
        document.getElementById('quit-btn')?.addEventListener('click', () => {
            this.callbacks?.onQuit?.();
        });

        // Game over buttons
        document.getElementById('retry-btn')?.addEventListener('click', () => {
            this.callbacks?.onRestart?.();
        });
        document.getElementById('menu-btn')?.addEventListener('click', () => {
            this.callbacks?.onQuit?.();
        });
    }

    setCallbacks(callbacks) {
        this.callbacks = callbacks;
    }

    showStartMenu() {
        this.hideAll();
        this.startMenu?.classList.remove('hidden');
    }

    hideStartMenu() {
        this.startMenu?.classList.add('hidden');
    }

    showPauseMenu() {
        this.pauseMenu?.classList.remove('hidden');
    }

    hidePauseMenu() {
        this.pauseMenu?.classList.add('hidden');
    }

    showGameOver(score, distance, time) {
        this.hideAll();
        const finalScore = document.getElementById('final-score');
        const finalDistance = document.getElementById('final-distance');
        const finalTime = document.getElementById('final-time');

        if (finalScore) finalScore.textContent = score.toString();
        if (finalDistance) finalDistance.textContent = (distance / 1000).toFixed(1);
        if (finalTime) finalTime.textContent = this.formatTime(time);

        this.gameoverScreen?.classList.remove('hidden');
    }

    showLoading() {
        this.loadingScreen?.classList.remove('hidden');
    }

    hideLoading() {
        this.loadingScreen?.classList.add('hidden');
    }

    updateLoadingProgress(percent) {
        const progress = document.getElementById('loading-progress');
        if (progress) progress.style.width = `${percent}%`;
    }

    hideAll() {
        this.startMenu?.classList.add('hidden');
        this.pauseMenu?.classList.add('hidden');
        this.gameoverScreen?.classList.add('hidden');
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// ==================== Update UI Language ====================
function updateUILanguage() {
    // Update all translatable elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        el.textContent = t(key);
    });

    // Update specific elements
    const elements = {
        'game-title': t('gameTitle'),
        'game-subtitle': t('gameSubtitle'),
        'select-location-title': t('selectLocation'),
        'game-mode-title': t('gameMode'),
        'start-btn': t('startFlight'),
        'controls-title': t('controls'),
        'pause-title': t('paused'),
        'resume-btn': t('resume'),
        'restart-btn': t('restart'),
        'quit-btn': t('quitToMenu'),
        'gameover-title': t('gameOver'),
        'retry-btn': t('tryAgain'),
        'menu-btn': t('mainMenu'),
    };

    for (const [id, text] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    // Update mode buttons
    document.querySelector('[data-mode="free"]')?.setAttribute('data-text', t('freeMode'));
    document.querySelector('[data-mode="checkpoint"]')?.setAttribute('data-text', t('checkpointMode'));
    document.querySelector('[data-mode="survival"]')?.setAttribute('data-text', t('survivalMode'));
}

// ==================== Main Game ====================
class FlightGame {
    constructor() {
        this.viewer = null;
        this.aircraftEntity = null;
        this.physics = new FlightPhysics(500);
        this.hud = new HUD();
        this.minimap = new Minimap();
        this.menu = new Menu();
        this.checkpoints = null;
        this.controlsModal = null;

        this.isRunning = false;
        this.isPaused = false;
        this.gameMode = 'free';

        this.currentLon = 126.9780;
        this.currentLat = 37.5665;
        this.startingAltitude = 500;

        this.inputState = {
            pitchUp: false,
            pitchDown: false,
            rollLeft: false,
            rollRight: false,
            yawLeft: false,
            yawRight: false,
            throttleUp: false,
            throttleDown: false,
        };

        this.cameraMode = 'third-person';
        this.lastTime = 0;
        this.animationFrameId = 0;

        // Weapon system
        this.ammo = WEAPON_CONFIG.MAX_AMMO;
        this.lastFireTime = 0;
        this.bullets = [];
        this.targets = [];
        this.isFiring = false;
        this.bulletTrails = []; // For visual trails

        // Player missiles
        this.playerMissiles = [];
        this.missileCount = WEAPON_CONFIG.MAX_MISSILES;
        this.lastMissileRecharge = 0;
        this.isFiringMissile = false;

        // Ammo recharge
        this.lastAmmoRecharge = 0;

        // Mouse control
        this.mouseControl = {
            enabled: true,
            sensitivity: 0.002,
            deltaX: 0,
            deltaY: 0,
            isLocked: false
        };

        // Speed effects
        this.speedEffects = {
            shake: 0,
            fovOffset: 0,
            lastSpeed: 0
        };

        // Enemy system (air)
        this.enemies = [];
        this.enemyMissiles = [];
        this.lastEnemySpawn = 0;
        this.warningActive = false;

        // Ground enemy system
        this.groundEnemies = [];
        this.lastGroundEnemySpawn = 0;

        // Flare defense system
        this.flares = [];
        this.flareCount = WEAPON_CONFIG.MAX_FLARES;
        this.lastFlareRecharge = 0;
        this.isFiringFlare = false;

        // Nuclear bomb
        this.nukes = [];
        this.nukeCount = WEAPON_CONFIG.MAX_NUKES;
        this.lastNukeRecharge = 0;
        this.isFiringNuke = false;

        this.setupMenuCallbacks();
    }

    async initialize() {
        this.menu.showLoading();
        this.menu.updateLoadingProgress(10);

        try {
            await this.initializeCesium();
            this.menu.updateLoadingProgress(50);

            this.setupInputHandlers();
            this.menu.updateLoadingProgress(70);

            this.createAircraft();
            this.checkpoints = new CheckpointSystem(this.viewer);
            this.controlsModal = new ControlsModal();
            this.menu.updateLoadingProgress(90);

            this.checkpoints.setOnCheckpointPassed((cp, combo) => {
                const multiplier = GAME_CONFIG.SCORE.COMBO_MULTIPLIERS[
                    Math.min(combo - 1, GAME_CONFIG.SCORE.COMBO_MULTIPLIERS.length - 1)
                ];
                const points = Math.round(GAME_CONFIG.SCORE.CHECKPOINT * multiplier);
                this.hud.addScore(points);
                const progress = this.checkpoints.getProgress();
                this.hud.updateObjective(`Checkpoint ${progress.passed}/${progress.total} - Combo x${multiplier}`);
            });

            // Add click event for controls help button
            const controlsHelpBtn = document.getElementById('controls-help-btn');
            if (controlsHelpBtn) {
                controlsHelpBtn.addEventListener('click', () => {
                    this.controlsModal?.toggle();
                });
            }

            this.menu.updateLoadingProgress(100);

            setTimeout(() => {
                this.menu.hideLoading();
                this.menu.showStartMenu();
                updateUILanguage();
            }, 500);

        } catch (error) {
            console.error('Failed to initialize game:', error);
            alert('Failed to initialize game. Please check console for details.');
        }
    }

    async initializeCesium() {
        // Use Cesium Ion for high-quality imagery and 3D terrain
        this.viewer = new Cesium.Viewer('cesiumContainer', {
            baseLayerPicker: false,
            geocoder: false,
            homeButton: false,
            sceneModePicker: false,
            selectionIndicator: false,
            timeline: false,
            animation: false,
            navigationHelpButton: false,
            fullscreenButton: false,
            vrButton: false,
            infoBox: false,
            terrainProvider: await Cesium.createWorldTerrainAsync({
                requestWaterMask: true,
                requestVertexNormals: true
            }),
        });

        // Add Bing Maps Aerial imagery for better visuals
        try {
            const imageryProvider = await Cesium.IonImageryProvider.fromAssetId(2);
            this.viewer.imageryLayers.addImageryProvider(imageryProvider);
        } catch (e) {
            console.warn('Could not load Bing imagery, using default');
        }

        // Enable 3D buildings (OSM Buildings)
        try {
            const osmBuildings = await Cesium.createOsmBuildingsAsync();
            this.viewer.scene.primitives.add(osmBuildings);
        } catch (e) {
            console.warn('Could not load OSM Buildings');
        }

        // Globe and atmosphere settings
        this.viewer.scene.globe.enableLighting = true;
        this.viewer.scene.globe.maximumScreenSpaceError = 2;
        this.viewer.scene.globe.depthTestAgainstTerrain = true;

        // Add atmosphere effect
        this.viewer.scene.skyAtmosphere = new Cesium.SkyAtmosphere();

        // Fog for depth effect
        this.viewer.scene.fog.enabled = true;
        this.viewer.scene.fog.density = 0.0001;

        // Hide credits
        if (this.viewer.cesiumWidget.creditContainer) {
            this.viewer.cesiumWidget.creditContainer.style.display = 'none';
        }

        // Disable default controls
        const scene = this.viewer.scene;
        scene.screenSpaceCameraController.enableRotate = false;
        scene.screenSpaceCameraController.enableTranslate = false;
        scene.screenSpaceCameraController.enableZoom = false;
        scene.screenSpaceCameraController.enableTilt = false;
        scene.screenSpaceCameraController.enableLook = false;
    }

    createAircraft() {
        const position = Cesium.Cartesian3.fromDegrees(this.currentLon, this.currentLat, this.startingAltitude);

        // Create player aircraft canvas image (cached)
        if (!this._playerAircraftImage) {
            this._playerAircraftImage = this.createPlayerAircraftCanvas();
        }

        // Simple billboard-based player aircraft (much more efficient)
        this.playerAircraftEntity = this.viewer.entities.add({
            name: 'Player Aircraft',
            position: position,
            billboard: {
                image: this._playerAircraftImage,
                scale: 0.5,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                verticalOrigin: Cesium.VerticalOrigin.CENTER
            }
        });

        // Engine flame effect (single point)
        this.flameEntity = this.viewer.entities.add({
            name: 'Engine Flame',
            position: position,
            point: {
                pixelSize: 12,
                color: Cesium.Color.ORANGE,
                outlineColor: Cesium.Color.YELLOW,
                outlineWidth: 4,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
        });
    }

    createPlayerAircraftCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 200, 200);
        ctx.save();
        ctx.translate(100, 100);

        // Player fuselage - light gray/white
        ctx.fillStyle = '#e8e8e8';
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 50, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Wings - swept back
        ctx.fillStyle = '#d0d0d0';
        ctx.beginPath();
        ctx.moveTo(-60, 10);
        ctx.lineTo(-55, -5);
        ctx.lineTo(0, -8);
        ctx.lineTo(55, -5);
        ctx.lineTo(60, 10);
        ctx.lineTo(0, 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Tail
        ctx.fillStyle = '#ff6644';
        ctx.beginPath();
        ctx.moveTo(-18, 45);
        ctx.lineTo(0, 35);
        ctx.lineTo(18, 45);
        ctx.lineTo(0, 55);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Vertical stabilizer
        ctx.beginPath();
        ctx.moveTo(0, 35);
        ctx.lineTo(-5, 55);
        ctx.lineTo(5, 55);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cockpit
        ctx.fillStyle = 'rgba(0, 212, 255, 0.8)';
        ctx.beginPath();
        ctx.ellipse(0, -25, 8, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Engine glow
        ctx.fillStyle = 'rgba(255, 150, 0, 0.6)';
        ctx.beginPath();
        ctx.arc(-25, 25, 10, 0, Math.PI * 2);
        ctx.arc(25, 25, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        return canvas.toDataURL();
    }

    updateAircraftParts(position, hpr) {
        // Update billboard-based player aircraft position
        if (this.playerAircraftEntity) {
            this.playerAircraftEntity.position = position;
        }

        // Update flame position (offset behind aircraft)
        if (this.flameEntity) {
            const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);
            const rotationMatrix = Cesium.Matrix3.fromQuaternion(orientation);
            const flameOffset = Cesium.Matrix3.multiplyByVector(
                rotationMatrix,
                new Cesium.Cartesian3(0, -25, 0),
                new Cesium.Cartesian3()
            );
            const flamePos = Cesium.Cartesian3.add(position, flameOffset, new Cesium.Cartesian3());
            this.flameEntity.position = flamePos;
        }
    }

    setupMenuCallbacks() {
        this.menu.setCallbacks({
            onStart: (location, mode) => this.startGame(location.lon, location.lat, mode),
            onResume: () => this.resume(),
            onRestart: () => this.restart(),
            onQuit: () => this.quitToMenu(),
        });
    }

    setupInputHandlers() {
        window.addEventListener('keydown', (e) => {
            if (!this.isRunning) return;

            if (KEYS.PAUSE.includes(e.code)) {
                this.isPaused ? this.resume() : this.pause();
                return;
            }

            if (this.isPaused) return;

            if (KEYS.TOGGLE_CAMERA.includes(e.code)) {
                this.toggleCamera();
                return;
            }

            if (KEYS.TOGGLE_MINIMAP.includes(e.code)) {
                this.minimap.toggle();
                return;
            }

            if (KEYS.TOGGLE_CONTROLS.includes(e.code)) {
                this.controlsModal?.toggle();
                return;
            }

            // Fire weapon
            if (KEYS.FIRE.includes(e.code)) {
                this.isFiring = true;
                e.preventDefault();
                return;
            }

            // Fire missile
            if (KEYS.FIRE_MISSILE.includes(e.code)) {
                this.isFiringMissile = true;
                e.preventDefault();
                return;
            }

            // Fire flare (defense against missiles)
            if (KEYS.FIRE_FLARE.includes(e.code)) {
                this.isFiringFlare = true;
                e.preventDefault();
                return;
            }

            // Fire nuclear bomb
            if (KEYS.FIRE_NUKE.includes(e.code)) {
                this.isFiringNuke = true;
                e.preventDefault();
                return;
            }

            this.updateInputState(e.code, true);
        });

        window.addEventListener('keyup', (e) => {
            // Stop firing
            if (KEYS.FIRE.includes(e.code)) {
                this.isFiring = false;
            }
            this.updateInputState(e.code, false);
        });

        window.addEventListener('keydown', (e) => {
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }
        });

        // Mouse controls for camera/aiming
        const cesiumContainer = document.getElementById('cesiumContainer');

        cesiumContainer?.addEventListener('click', () => {
            if (this.isRunning && !this.isPaused) {
                cesiumContainer.requestPointerLock?.();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.mouseControl.isLocked = document.pointerLockElement === cesiumContainer;
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isRunning || this.isPaused || !this.mouseControl.isLocked) return;

            this.mouseControl.deltaX += e.movementX * this.mouseControl.sensitivity;
            this.mouseControl.deltaY += e.movementY * this.mouseControl.sensitivity;

            // Clamp vertical look
            this.mouseControl.deltaY = Math.max(-0.5, Math.min(0.5, this.mouseControl.deltaY));
        });

        // Mouse click to fire
        document.addEventListener('mousedown', (e) => {
            if (!this.isRunning || this.isPaused) return;
            if (e.button === 0) { // Left click
                this.isFiring = true;
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.isFiring = false;
            }
        });
    }

    updateInputState(code, pressed) {
        if (KEYS.PITCH_UP.includes(code)) this.inputState.pitchUp = pressed;
        if (KEYS.PITCH_DOWN.includes(code)) this.inputState.pitchDown = pressed;
        if (KEYS.ROLL_LEFT.includes(code)) this.inputState.rollLeft = pressed;
        if (KEYS.ROLL_RIGHT.includes(code)) this.inputState.rollRight = pressed;
        if (KEYS.YAW_LEFT.includes(code)) this.inputState.yawLeft = pressed;
        if (KEYS.YAW_RIGHT.includes(code)) this.inputState.yawRight = pressed;
        if (KEYS.THROTTLE_UP.includes(code)) this.inputState.throttleUp = pressed;
        if (KEYS.THROTTLE_DOWN.includes(code)) this.inputState.throttleDown = pressed;
    }

    toggleCamera() {
        this.cameraMode = this.cameraMode === 'third-person' ? 'first-person' : 'third-person';
        this.hud.updateCameraMode(this.cameraMode === 'third-person' ? t('thirdPerson') : t('cockpitView'));
    }

    async startGame(lon, lat, mode) {
        this.currentLon = lon;
        this.currentLat = lat;
        this.gameMode = mode;

        this.physics.reset(this.startingAltitude);
        this.hud.reset();
        this.checkpoints?.reset();
        this.clearWeapons();
        this.lastEnemySpawn = 0;

        if (mode === 'checkpoint') {
            this.checkpoints?.generateCheckpoints(lon, lat);
            this.hud.updateObjective(t('checkpointRace'));
        } else if (mode === 'survival') {
            this.hud.updateObjective(t('survivalModeObj'));
        } else {
            this.hud.updateObjective(t('freeFlightMode'));
        }

        this.menu.hideStartMenu();
        this.hud.show();
        this.hud.updateCameraMode(t('thirdPerson'));

        // Fly to starting position
        await this.flyToPosition(lon, lat, this.startingAltitude);

        this.isRunning = true;
        this.isPaused = false;
        this.lastTime = performance.now();
        this.gameLoop();
    }

    flyToPosition(lon, lat, alt) {
        return new Promise((resolve) => {
            this.viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(lon, lat, alt + 100),
                orientation: {
                    heading: 0,
                    pitch: Cesium.Math.toRadians(-20),
                    roll: 0
                },
                duration: 2,
                complete: resolve
            });
        });
    }

    gameLoop() {
        if (!this.isRunning) return;

        const currentTime = performance.now();
        const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;

        if (!this.isPaused) {
            this.update(deltaTime);
        }

        this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
    }

    update(deltaTime) {
        // Apply mouse control to physics state
        if (this.mouseControl.isLocked) {
            // Mouse X controls yaw/heading
            this.physics.state.heading += this.mouseControl.deltaX;
            // Mouse Y controls pitch
            this.physics.state.pitch -= this.mouseControl.deltaY * 0.5;
            this.physics.state.pitch = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, this.physics.state.pitch));

            // Gradually reset mouse delta
            this.mouseControl.deltaX *= 0.8;
            this.mouseControl.deltaY *= 0.8;
        }

        const state = this.physics.update(this.inputState, deltaTime);

        // Update position
        const metersPerDegreeLon = 111000 * Math.cos(this.currentLat * Math.PI / 180);
        const metersPerDegreeLat = 111000;

        this.currentLon += (state.velocity.x * deltaTime) / metersPerDegreeLon;
        this.currentLat += (state.velocity.y * deltaTime) / metersPerDegreeLat;

        // Update aircraft entity
        const position = Cesium.Cartesian3.fromDegrees(this.currentLon, this.currentLat, state.altitude);
        const hpr = new Cesium.HeadingPitchRoll(state.heading, state.pitch, state.roll);

        // Update all aircraft parts
        this.updateAircraftParts(position, hpr);

        // Update speed effects (FOV, shake)
        this.updateSpeedEffects(state, deltaTime);

        // Update camera
        this.updateCamera(position, state);

        // Update weapon system
        this.updateWeapons(deltaTime, position, state);

        // Update enemy system
        this.updateEnemies(deltaTime, position, state);

        // Update HUD ammo and missile display
        this.hud.updateAmmo(this.ammo, WEAPON_CONFIG.MAX_AMMO);
        this.hud.updateMissileCount(this.missileCount);
        this.hud.updateFlareCount(this.flareCount);
        this.hud.updateNukeCount(this.nukeCount);

        // Update HUD
        this.hud.update(state, deltaTime);

        // Update minimap with enemy positions and projectiles
        this.minimap.setEnemies(this.enemies);
        this.minimap.setGroundEnemies(this.groundEnemies);
        this.minimap.setProjectiles(this.bullets, this.playerMissiles, this.enemyMissiles, this.flares);
        this.minimap.render(
            this.currentLon,
            this.currentLat,
            state.heading,
            this.checkpoints?.getCheckpointsData() || []
        );

        // Check checkpoints
        if (this.gameMode === 'checkpoint') {
            this.checkpoints?.checkCollision(this.currentLon, this.currentLat, state.altitude);

            const distance = this.checkpoints?.getDistanceToNext(this.currentLon, this.currentLat, state.altitude) ?? -1;
            const direction = this.checkpoints?.getDirectionToNext(this.currentLon, this.currentLat) ?? 0;
            this.hud.updateCheckpointIndicator(distance, direction, state.heading);

            if (this.checkpoints?.isComplete()) {
                this.gameOver();
            }
        }

        // Check game over conditions
        if (state.altitude <= 15) {
            this.gameOver();
        }

        if (this.gameMode === 'survival' && state.fuel <= 0 && state.speed < 30) {
            this.gameOver();
        }

        // Check missile collision with player
        this.checkMissileCollision(position);

        // Track distance
        const horizontalSpeed = Math.sqrt(state.velocity.x ** 2 + state.velocity.y ** 2);
        this.hud.addDistance(horizontalSpeed * deltaTime);
    }

    updateSpeedEffects(state, deltaTime) {
        const speedRatio = state.speed / PHYSICS.AIRCRAFT.MAX_SPEED;

        // Camera shake at high speed
        if (speedRatio > 0.7) {
            this.speedEffects.shake = (speedRatio - 0.7) * 0.3;
        } else {
            this.speedEffects.shake *= 0.9;
        }

        // FOV increase with speed (sense of acceleration)
        const targetFov = 60 + speedRatio * 30; // 60 to 90 degrees
        this.speedEffects.fovOffset += (targetFov - 60 - this.speedEffects.fovOffset) * 0.1;

        // Apply FOV
        this.viewer.camera.frustum.fov = Cesium.Math.toRadians(60 + this.speedEffects.fovOffset);

        // Speed lines effect (CSS)
        const speedLinesOpacity = Math.max(0, (speedRatio - 0.5) * 2);
        document.documentElement.style.setProperty('--speed-lines-opacity', speedLinesOpacity.toString());

        // Acceleration feedback
        const speedDelta = state.speed - this.speedEffects.lastSpeed;
        if (speedDelta > 5) {
            // Accelerating - brief red tint
            this.showAccelerationEffect();
        }
        this.speedEffects.lastSpeed = state.speed;
    }

    showAccelerationEffect() {
        const overlay = document.getElementById('speed-overlay');
        if (overlay) {
            overlay.style.opacity = '0.1';
            setTimeout(() => {
                overlay.style.opacity = '0';
            }, 100);
        }
    }

    updateCamera(position, state) {
        const camera = this.viewer.camera;

        // Add camera shake
        let shakeX = 0, shakeY = 0, shakeZ = 0;
        if (this.speedEffects.shake > 0.01) {
            shakeX = (Math.random() - 0.5) * this.speedEffects.shake * 2;
            shakeY = (Math.random() - 0.5) * this.speedEffects.shake * 2;
            shakeZ = (Math.random() - 0.5) * this.speedEffects.shake;
        }

        if (this.cameraMode === 'third-person') {
            const { THIRD_PERSON_DISTANCE } = GAME_CONFIG.CAMERA;

            // Show aircraft in third person
            this.setAircraftVisibility(true);

            // Camera behind and above the aircraft
            const cameraDistance = THIRD_PERSON_DISTANCE + (state.speed / PHYSICS.AIRCRAFT.MAX_SPEED) * 20;
            const cameraPitch = Cesium.Math.toRadians(-15) - state.pitch * 0.3;

            camera.lookAt(
                position,
                new Cesium.HeadingPitchRange(
                    state.heading + Math.PI + shakeX * 0.1,
                    cameraPitch + shakeY * 0.05,
                    cameraDistance
                )
            );
        } else {
            // First person - hide aircraft
            this.setAircraftVisibility(false);

            // Cockpit view with shake
            camera.setView({
                destination: position,
                orientation: {
                    heading: state.heading + shakeX * 0.02,
                    pitch: state.pitch + shakeY * 0.02,
                    roll: state.roll + shakeZ * 0.02
                }
            });
        }
    }

    setAircraftVisibility(visible) {
        // Show/hide billboard-based player aircraft
        if (this.playerAircraftEntity) this.playerAircraftEntity.show = visible;
        if (this.flameEntity) this.flameEntity.show = visible;
    }

    // ==================== Weapon System ====================
    updateWeapons(deltaTime, position, state) {
        const currentTime = performance.now() / 1000;

        // Handle firing bullets
        if (this.isFiring && this.ammo > 0 && currentTime - this.lastFireTime >= WEAPON_CONFIG.FIRE_RATE) {
            this.fireBullet(position, state);
            this.lastFireTime = currentTime;
            this.lastAmmoRecharge = currentTime; // Reset recharge timer when firing
        }

        // Handle firing player missiles
        if (this.isFiringMissile && this.missileCount > 0) {
            this.firePlayerMissile(position, state);
            this.isFiringMissile = false;
        }

        // Handle firing flares (defense)
        if (this.isFiringFlare && this.flareCount > 0) {
            this.fireFlare(position, state);
            this.isFiringFlare = false;
        }

        // Handle firing nuclear bomb
        if (this.isFiringNuke && this.nukeCount > 0) {
            this.fireNuke(position, state);
            this.isFiringNuke = false;
        }

        // Ammo recharge system
        if (!this.isFiring && this.ammo < WEAPON_CONFIG.MAX_AMMO) {
            if (currentTime - this.lastAmmoRecharge >= WEAPON_CONFIG.AMMO_RECHARGE_DELAY) {
                this.ammo = Math.min(WEAPON_CONFIG.MAX_AMMO,
                    this.ammo + WEAPON_CONFIG.AMMO_RECHARGE_RATE * deltaTime);
            }
        }

        // Missile recharge system
        if (this.missileCount < WEAPON_CONFIG.MAX_MISSILES) {
            if (currentTime - this.lastMissileRecharge >= WEAPON_CONFIG.MISSILE_RECHARGE_TIME) {
                this.missileCount++;
                this.lastMissileRecharge = currentTime;
                this.showMessage(currentLang === 'ko' ? '🚀 미사일 충전됨!' : '🚀 Missile Recharged!', '#00ffff');
            }
        }

        // Flare recharge system
        if (this.flareCount < WEAPON_CONFIG.MAX_FLARES) {
            if (currentTime - this.lastFlareRecharge >= WEAPON_CONFIG.FLARE_RECHARGE_TIME) {
                this.flareCount++;
                this.lastFlareRecharge = currentTime;
                this.showMessage(currentLang === 'ko' ? '🔥 플레어 충전됨!' : '🔥 Flare Recharged!', '#ffaa00');
            }
        }

        // Nuke recharge system
        if (this.nukeCount < WEAPON_CONFIG.MAX_NUKES) {
            if (currentTime - this.lastNukeRecharge >= WEAPON_CONFIG.NUKE_RECHARGE_TIME) {
                this.nukeCount++;
                this.lastNukeRecharge = currentTime;
                this.showMessage(currentLang === 'ko' ? '☢️ 핵폭탄 준비 완료!' : '☢️ Nuke Ready!', '#ff0000');
            }
        }

        // Update bullets with trails
        this.updateBullets(deltaTime);

        // Update player missiles
        this.updatePlayerMissiles(deltaTime);

        // Update flares
        this.updateFlares(deltaTime);

        // Update nukes
        this.updateNukes(deltaTime);

        // Update targets
        this.updateTargets(position);

        // Check bullet-target collisions
        this.checkBulletCollisions();

        // Check player missile collisions
        this.checkPlayerMissileCollisions();

        // Spawn targets if needed
        if (this.targets.length < 5) {
            this.spawnTarget();
        }
    }

    fireBullet(position, state) {
        if (this.ammo <= 0) return;
        // Limit bullets to prevent performance issues
        if (this.bullets.length >= 30) return;

        this.ammo--;

        // Calculate bullet direction based on aircraft heading and pitch
        const bulletDirection = {
            x: Math.sin(state.heading) * Math.cos(state.pitch),
            y: Math.cos(state.heading) * Math.cos(state.pitch),
            z: Math.sin(state.pitch)
        };

        // Create bullet entity with tracer effect
        const bulletEntity = this.viewer.entities.add({
            position: position,
            point: {
                pixelSize: 10,
                color: Cesium.Color.YELLOW,
                outlineColor: Cesium.Color.ORANGE,
                outlineWidth: 3,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
        });

        this.bullets.push({
            entity: bulletEntity,
            position: Cesium.Cartesian3.clone(position),
            velocity: {
                x: bulletDirection.x * WEAPON_CONFIG.BULLET_SPEED + state.velocity.x,
                y: bulletDirection.y * WEAPON_CONFIG.BULLET_SPEED + state.velocity.y,
                z: bulletDirection.z * WEAPON_CONFIG.BULLET_SPEED
            },
            lifetime: WEAPON_CONFIG.BULLET_LIFETIME
        });

        // Muzzle flash effect
        this.showMuzzleFlash();
    }

    firePlayerMissile(position, state) {
        if (this.missileCount <= 0) return;
        // Limit active missiles to prevent performance issues
        if (this.playerMissiles.length >= 6) return;

        this.missileCount--;
        this.lastMissileRecharge = performance.now() / 1000;

        // Find nearest enemy to lock onto
        let targetEnemy = null;
        let minDistance = Infinity;

        for (const enemy of this.enemies) {
            const dist = Cesium.Cartesian3.distance(position, enemy.position);
            if (dist < minDistance && dist < 5000) {
                minDistance = dist;
                targetEnemy = enemy;
            }
        }

        const missileDirection = {
            x: Math.sin(state.heading) * Math.cos(state.pitch),
            y: Math.cos(state.heading) * Math.cos(state.pitch),
            z: Math.sin(state.pitch)
        };

        // Create missile entity
        const missileEntity = this.viewer.entities.add({
            position: position,
            billboard: {
                image: this._playerMissileImage || (this._playerMissileImage = this.createMissileCanvas()),
                scale: 0.08,
                rotation: -state.heading,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            point: {
                pixelSize: 12,
                color: Cesium.Color.CYAN,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
        });

        this.playerMissiles.push({
            entity: missileEntity,
            position: Cesium.Cartesian3.clone(position),
            velocity: {
                x: missileDirection.x * WEAPON_CONFIG.MISSILE_SPEED,
                y: missileDirection.y * WEAPON_CONFIG.MISSILE_SPEED,
                z: missileDirection.z * WEAPON_CONFIG.MISSILE_SPEED * 0.5
            },
            target: targetEnemy,
            lifetime: WEAPON_CONFIG.MISSILE_LIFETIME
        });

        // Launch sound/effect
        this.showMessage(currentLang === 'ko' ? '🚀 미사일 발사!' : '🚀 Missile Away!', '#00ffff');
        this.playMissileLaunchSound();
    }

    createMissileCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 100, 100);
        ctx.save();
        ctx.translate(50, 50);

        // Missile body
        ctx.fillStyle = '#00ccff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Nose cone
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.moveTo(-5, -25);
        ctx.lineTo(0, -35);
        ctx.lineTo(5, -25);
        ctx.closePath();
        ctx.fill();

        // Fins
        ctx.fillStyle = '#0088cc';
        ctx.beginPath();
        ctx.moveTo(-12, 20);
        ctx.lineTo(-5, 15);
        ctx.lineTo(-5, 25);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(12, 20);
        ctx.lineTo(5, 15);
        ctx.lineTo(5, 25);
        ctx.closePath();
        ctx.fill();

        // Flame trail
        ctx.fillStyle = 'rgba(255, 150, 0, 0.8)';
        ctx.beginPath();
        ctx.moveTo(-4, 25);
        ctx.lineTo(0, 40);
        ctx.lineTo(4, 25);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
        return canvas.toDataURL();
    }

    playMissileLaunchSound() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3);
            oscillator.type = 'sawtooth';
            gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.3);
        } catch (e) {
            // Audio not supported
        }
    }

    // ==================== Flare Defense System ====================
    fireFlare(position, state) {
        if (this.flareCount <= 0) return;

        this.flareCount--;
        this.lastFlareRecharge = performance.now() / 1000;

        // Drop flares behind the aircraft (multiple flares for better effect)
        for (let i = 0; i < 3; i++) {
            const offsetAngle = (i - 1) * 0.3; // Spread flares
            const dropDirection = {
                x: -Math.sin(state.heading + offsetAngle) * 0.5,
                y: -Math.cos(state.heading + offsetAngle) * 0.5,
                z: -0.3 - Math.random() * 0.2
            };

            // Create flare entity with bright glow
            const flareEntity = this.viewer.entities.add({
                position: position,
                point: {
                    pixelSize: 20,
                    color: Cesium.Color.fromCssColorString('#ffff88'),
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 4,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                },
            });

            // Disable trail for performance
            const trailEntity = null;

            this.flares.push({
                entity: flareEntity,
                trailEntity: trailEntity,
                position: Cesium.Cartesian3.clone(position),
                velocity: {
                    x: dropDirection.x * WEAPON_CONFIG.FLARE_SPEED + (Math.random() - 0.5) * 20,
                    y: dropDirection.y * WEAPON_CONFIG.FLARE_SPEED + (Math.random() - 0.5) * 20,
                    z: dropDirection.z * WEAPON_CONFIG.FLARE_SPEED
                },
                lifetime: WEAPON_CONFIG.FLARE_LIFETIME,
                brightness: 1.0
            });
        }

        this.showMessage(currentLang === 'ko' ? '🔥 플레어 발사!' : '🔥 Flare Deployed!', '#ffaa00');
        this.playFlareSound();
    }

    playFlareSound() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.5);
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.5);
        } catch (e) {
            // Audio not supported
        }
    }

    updateFlares(deltaTime) {
        const metersPerDegreeLon = 111000 * Math.cos(this.currentLat * Math.PI / 180);
        const metersPerDegreeLat = 111000;

        for (let i = this.flares.length - 1; i >= 0; i--) {
            const flare = this.flares[i];

            // Update position
            const cartographic = Cesium.Cartographic.fromCartesian(flare.position);
            const newLon = Cesium.Math.toDegrees(cartographic.longitude) + (flare.velocity.x * deltaTime) / metersPerDegreeLon;
            const newLat = Cesium.Math.toDegrees(cartographic.latitude) + (flare.velocity.y * deltaTime) / metersPerDegreeLat;
            const newAlt = Math.max(50, cartographic.height + flare.velocity.z * deltaTime);

            flare.position = Cesium.Cartesian3.fromDegrees(newLon, newLat, newAlt);
            flare.entity.position = flare.position;

            // Decrease velocity (gravity and drag)
            flare.velocity.z -= 15 * deltaTime;
            flare.velocity.x *= 0.98;
            flare.velocity.y *= 0.98;

            // Decrease lifetime
            flare.lifetime -= deltaTime;
            flare.brightness = flare.lifetime / WEAPON_CONFIG.FLARE_LIFETIME;

            // Attract enemy missiles
            this.attractMissilesToFlare(flare);

            // Remove expired flares
            if (flare.lifetime <= 0 || newAlt <= 50) {
                this.viewer.entities.remove(flare.entity);
                if (flare.trailEntity) this.viewer.entities.remove(flare.trailEntity);
                this.flares.splice(i, 1);
            }
        }
    }

    attractMissilesToFlare(flare) {
        // Redirect enemy missiles towards the flare
        for (const missile of this.enemyMissiles) {
            const distance = Cesium.Cartesian3.distance(flare.position, missile.position);

            if (distance < WEAPON_CONFIG.FLARE_ATTRACT_RADIUS) {
                // Calculate direction to flare
                const direction = Cesium.Cartesian3.subtract(flare.position, missile.position, new Cesium.Cartesian3());
                Cesium.Cartesian3.normalize(direction, direction);

                // Strong attraction - redirect missile velocity towards flare
                const attractStrength = 0.3 * (1 - distance / WEAPON_CONFIG.FLARE_ATTRACT_RADIUS);
                missile.velocity.x += direction.x * attractStrength * 50;
                missile.velocity.y += direction.y * attractStrength * 50;
                missile.velocity.z += direction.z * attractStrength * 50;

                // Mark missile as distracted (won't track player anymore)
                missile.distracted = true;
            }
        }
    }

    // ==================== Nuclear Bomb System ====================
    fireNuke(position, state) {
        if (this.nukeCount <= 0) return;

        this.nukeCount--;
        this.lastNukeRecharge = performance.now() / 1000;

        // Drop nuke downward
        const nukeDirection = {
            x: Math.sin(state.heading) * 0.3,
            y: Math.cos(state.heading) * 0.3,
            z: -1.0
        };

        // Create nuke entity (big, menacing)
        const nukeEntity = this.viewer.entities.add({
            position: position,
            billboard: {
                image: this.createNukeCanvas(),
                scale: 0.15,
                rotation: -state.heading,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            point: {
                pixelSize: 20,
                color: Cesium.Color.fromCssColorString('#ff0000'),
                outlineColor: Cesium.Color.YELLOW,
                outlineWidth: 3,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            }
        });

        this.nukes.push({
            entity: nukeEntity,
            position: Cesium.Cartesian3.clone(position),
            velocity: {
                x: nukeDirection.x * WEAPON_CONFIG.NUKE_SPEED,
                y: nukeDirection.y * WEAPON_CONFIG.NUKE_SPEED,
                z: nukeDirection.z * WEAPON_CONFIG.NUKE_SPEED
            },
            lifetime: WEAPON_CONFIG.NUKE_LIFETIME,
            exploded: false
        });

        this.showMessage(currentLang === 'ko' ? '☢️ 핵폭탄 투하!' : '☢️ NUKE AWAY!', '#ff0000');
        this.playNukeLaunchSound();
    }

    createNukeCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 100, 100);
        ctx.save();
        ctx.translate(50, 50);

        // Bomb body
        ctx.fillStyle = '#333333';
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 30, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Radiation symbol
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('☢', 0, 0);

        // Fins
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.moveTo(-15, 25);
        ctx.lineTo(-8, 20);
        ctx.lineTo(-8, 30);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(15, 25);
        ctx.lineTo(8, 20);
        ctx.lineTo(8, 30);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
        return canvas.toDataURL();
    }

    playNukeLaunchSound() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.frequency.setValueAtTime(100, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.5);
            oscillator.type = 'sawtooth';
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.5);
        } catch (e) {
            // Audio not supported
        }
    }

    updateNukes(deltaTime) {
        const metersPerDegreeLon = 111000 * Math.cos(this.currentLat * Math.PI / 180);
        const metersPerDegreeLat = 111000;

        for (let i = this.nukes.length - 1; i >= 0; i--) {
            const nuke = this.nukes[i];

            // Update position
            const cartographic = Cesium.Cartographic.fromCartesian(nuke.position);
            const newLon = Cesium.Math.toDegrees(cartographic.longitude) + (nuke.velocity.x * deltaTime) / metersPerDegreeLon;
            const newLat = Cesium.Math.toDegrees(cartographic.latitude) + (nuke.velocity.y * deltaTime) / metersPerDegreeLat;
            const newAlt = cartographic.height + nuke.velocity.z * deltaTime;

            nuke.position = Cesium.Cartesian3.fromDegrees(newLon, newLat, newAlt);
            nuke.entity.position = nuke.position;

            // Gravity
            nuke.velocity.z -= 20 * deltaTime;

            // Decrease lifetime
            nuke.lifetime -= deltaTime;

            // Check for ground impact or timeout - EXPLODE!
            if (newAlt <= 100 || nuke.lifetime <= 0) {
                this.detonateNuke(nuke);
                this.viewer.entities.remove(nuke.entity);
                this.nukes.splice(i, 1);
            }
        }
    }

    detonateNuke(nuke) {
        // NUCLEAR EXPLOSION!
        this.showMessage(currentLang === 'ko' ? '💥 핵폭발!!!' : '💥 NUCLEAR DETONATION!!!', '#ff0000');

        // Create massive explosion effect
        const explosionEntity = this.viewer.entities.add({
            position: nuke.position,
            ellipsoid: {
                radii: new Cesium.Cartesian3(50, 50, 50),
                material: Cesium.Color.YELLOW.withAlpha(0.8),
            }
        });

        // Animate explosion expansion
        let explosionSize = 50;
        const explosionInterval = setInterval(() => {
            explosionSize += 100;
            if (explosionSize < WEAPON_CONFIG.NUKE_BLAST_RADIUS) {
                explosionEntity.ellipsoid.radii = new Cesium.Cartesian3(explosionSize, explosionSize, explosionSize * 0.5);
                explosionEntity.ellipsoid.material = Cesium.Color.ORANGE.withAlpha(0.8 - (explosionSize / WEAPON_CONFIG.NUKE_BLAST_RADIUS) * 0.6);
            } else {
                clearInterval(explosionInterval);
                setTimeout(() => {
                    this.viewer.entities.remove(explosionEntity);
                }, 500);
            }
        }, 50);

        // Play explosion sound
        this.playNukeExplosionSound();

        // Damage all enemies in blast radius
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            const distance = Cesium.Cartesian3.distance(nuke.position, enemy.position);

            if (distance < WEAPON_CONFIG.NUKE_BLAST_RADIUS) {
                // Instant kill all enemies in range
                this.hud.addScore(500); // Big score bonus
                this.showMessage(currentLang === 'ko' ? `💀 적 격추!` : `💀 Enemy Destroyed!`, '#ff0000');
                this.removeEnemyEntities(enemy);
                this.enemies.splice(i, 1);
            }
        }

        // Destroy all enemy missiles in range
        for (let i = this.enemyMissiles.length - 1; i >= 0; i--) {
            const missile = this.enemyMissiles[i];
            const distance = Cesium.Cartesian3.distance(nuke.position, missile.position);

            if (distance < WEAPON_CONFIG.NUKE_BLAST_RADIUS) {
                this.viewer.entities.remove(missile.entity);
                if (missile.trailEntity) this.viewer.entities.remove(missile.trailEntity);
                this.enemyMissiles.splice(i, 1);
            }
        }

        // Destroy all ground enemies in range
        for (let i = this.groundEnemies.length - 1; i >= 0; i--) {
            const groundEnemy = this.groundEnemies[i];
            const groundPos = Cesium.Cartesian3.fromDegrees(groundEnemy.longitude, groundEnemy.latitude, groundEnemy.altitude);
            const distance = Cesium.Cartesian3.distance(nuke.position, groundPos);

            if (distance < WEAPON_CONFIG.NUKE_BLAST_RADIUS) {
                const points = groundEnemy.type === 'turret' ? 300 : 100;
                this.hud.addScore(points);
                if (groundEnemy.entity) this.viewer.entities.remove(groundEnemy.entity);
                if (groundEnemy.labelEntity) this.viewer.entities.remove(groundEnemy.labelEntity);
                this.groundEnemies.splice(i, 1);
            }
        }

        // Screen shake effect
        this.triggerScreenShake(2.0);
    }

    playNukeExplosionSound() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

            // Deep rumble
            const oscillator1 = audioCtx.createOscillator();
            const gainNode1 = audioCtx.createGain();
            oscillator1.connect(gainNode1);
            gainNode1.connect(audioCtx.destination);
            oscillator1.frequency.setValueAtTime(40, audioCtx.currentTime);
            oscillator1.type = 'sawtooth';
            gainNode1.gain.setValueAtTime(0.4, audioCtx.currentTime);
            gainNode1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 2);
            oscillator1.start();
            oscillator1.stop(audioCtx.currentTime + 2);

            // High crack
            const oscillator2 = audioCtx.createOscillator();
            const gainNode2 = audioCtx.createGain();
            oscillator2.connect(gainNode2);
            gainNode2.connect(audioCtx.destination);
            oscillator2.frequency.setValueAtTime(2000, audioCtx.currentTime);
            oscillator2.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.5);
            oscillator2.type = 'square';
            gainNode2.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            oscillator2.start();
            oscillator2.stop(audioCtx.currentTime + 0.5);
        } catch (e) {
            // Audio not supported
        }
    }

    triggerScreenShake(intensity) {
        const container = document.getElementById('cesiumContainer');
        if (!container) return;

        let shakeTime = 0;
        const shakeDuration = 1.0;
        const shakeInterval = setInterval(() => {
            shakeTime += 0.05;
            if (shakeTime < shakeDuration) {
                const x = (Math.random() - 0.5) * intensity * 20;
                const y = (Math.random() - 0.5) * intensity * 20;
                container.style.transform = `translate(${x}px, ${y}px)`;
            } else {
                clearInterval(shakeInterval);
                container.style.transform = '';
            }
        }, 50);
    }

    showMuzzleFlash() {
        const crosshair = document.querySelector('.crosshair');
        if (crosshair) {
            crosshair.style.color = '#ffff00';
            crosshair.style.textShadow = '0 0 20px #ff8800';
            setTimeout(() => {
                crosshair.style.color = 'rgba(255, 255, 255, 0.4)';
                crosshair.style.textShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
            }, 50);
        }
    }

    updateBullets(deltaTime) {
        const metersPerDegreeLon = 111000 * Math.cos(this.currentLat * Math.PI / 180);
        const metersPerDegreeLat = 111000;

        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.lifetime -= deltaTime;

            if (bullet.lifetime <= 0) {
                this.viewer.entities.remove(bullet.entity);
                if (bullet.trailEntity) {
                    this.viewer.entities.remove(bullet.trailEntity);
                }
                this.bullets.splice(i, 1);
                continue;
            }

            // Update bullet position
            const cartographic = Cesium.Cartographic.fromCartesian(bullet.position);
            const lon = Cesium.Math.toDegrees(cartographic.longitude);
            const lat = Cesium.Math.toDegrees(cartographic.latitude);
            const alt = cartographic.height;

            const newLon = lon + (bullet.velocity.x * deltaTime) / metersPerDegreeLon;
            const newLat = lat + (bullet.velocity.y * deltaTime) / metersPerDegreeLat;
            const newAlt = alt + bullet.velocity.z * deltaTime;

            // Apply gravity to bullet
            bullet.velocity.z -= 9.81 * deltaTime;

            bullet.position = Cesium.Cartesian3.fromDegrees(newLon, newLat, Math.max(0, newAlt));
            bullet.entity.position = bullet.position;

            // Remove if hit ground
            if (newAlt <= 0) {
                this.viewer.entities.remove(bullet.entity);
                if (bullet.trailEntity) {
                    this.viewer.entities.remove(bullet.trailEntity);
                }
                this.bullets.splice(i, 1);
            }
        }
    }

    updatePlayerMissiles(deltaTime) {
        const metersPerDegreeLon = 111000 * Math.cos(this.currentLat * Math.PI / 180);
        const metersPerDegreeLat = 111000;

        for (let i = this.playerMissiles.length - 1; i >= 0; i--) {
            const missile = this.playerMissiles[i];
            missile.lifetime -= deltaTime;

            if (missile.lifetime <= 0) {
                this.viewer.entities.remove(missile.entity);
                if (missile.trailEntity) {
                    this.viewer.entities.remove(missile.trailEntity);
                }
                this.playerMissiles.splice(i, 1);
                continue;
            }

            // Get current position
            const cartographic = Cesium.Cartographic.fromCartesian(missile.position);
            const missileLon = Cesium.Math.toDegrees(cartographic.longitude);
            const missileLat = Cesium.Math.toDegrees(cartographic.latitude);
            const missileAlt = cartographic.height;

            // Homing towards target if exists
            if (missile.target && missile.target.entity) {
                const targetPos = missile.target.position;
                const targetCartographic = Cesium.Cartographic.fromCartesian(targetPos);
                const targetLon = Cesium.Math.toDegrees(targetCartographic.longitude);
                const targetLat = Cesium.Math.toDegrees(targetCartographic.latitude);
                const targetAlt = targetCartographic.height;

                // Direction to target
                const dx = (targetLon - missileLon) * metersPerDegreeLon;
                const dy = (targetLat - missileLat) * metersPerDegreeLat;
                const dz = targetAlt - missileAlt;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (dist > 1) {
                    // Homing - adjust velocity towards target
                    const homingStrength = 3;
                    missile.velocity.x += (dx / dist) * homingStrength;
                    missile.velocity.y += (dy / dist) * homingStrength;
                    missile.velocity.z += (dz / dist) * homingStrength;

                    // Normalize speed
                    const speed = Math.sqrt(
                        missile.velocity.x ** 2 +
                        missile.velocity.y ** 2 +
                        missile.velocity.z ** 2
                    );
                    const targetSpeed = WEAPON_CONFIG.MISSILE_SPEED;
                    missile.velocity.x *= targetSpeed / speed;
                    missile.velocity.y *= targetSpeed / speed;
                    missile.velocity.z *= targetSpeed / speed;
                }
            }

            // Update position
            const newLon = missileLon + (missile.velocity.x * deltaTime) / metersPerDegreeLon;
            const newLat = missileLat + (missile.velocity.y * deltaTime) / metersPerDegreeLat;
            const newAlt = Math.max(50, missileAlt + missile.velocity.z * deltaTime);

            missile.position = Cesium.Cartesian3.fromDegrees(newLon, newLat, newAlt);
            missile.entity.position = missile.position;

            // Update billboard rotation
            const heading = Math.atan2(missile.velocity.x, missile.velocity.y);
            if (missile.entity.billboard) {
                missile.entity.billboard.rotation = -heading;
            }
        }
    }

    checkPlayerMissileCollisions() {
        for (let i = this.playerMissiles.length - 1; i >= 0; i--) {
            const missile = this.playerMissiles[i];

            // Check collision with enemies
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const enemy = this.enemies[j];
                const distance = Cesium.Cartesian3.distance(missile.position, enemy.position);

                if (distance < 50) {
                    // Direct hit!
                    this.destroyEnemy(enemy, j);
                    this.hud.addScore(300);
                    this.showMessage(currentLang === 'ko' ? '💥 미사일 명중!' : '💥 Missile Hit!', '#ff6600');

                    // Remove missile
                    this.viewer.entities.remove(missile.entity);
                    if (missile.trailEntity) {
                        this.viewer.entities.remove(missile.trailEntity);
                    }
                    this.playerMissiles.splice(i, 1);
                    break;
                }
            }

            // Check collision with targets
            for (let k = this.targets.length - 1; k >= 0; k--) {
                const target = this.targets[k];
                const distance = Cesium.Cartesian3.distance(missile.position, target.position);

                if (distance < WEAPON_CONFIG.TARGET_RADIUS + 20) {
                    this.destroyTarget(target, k);
                    this.hud.addScore(100);
                    this.showHitMessage();

                    this.viewer.entities.remove(missile.entity);
                    if (missile.trailEntity) {
                        this.viewer.entities.remove(missile.trailEntity);
                    }
                    this.playerMissiles.splice(i, 1);
                    break;
                }
            }
        }
    }

    spawnTarget() {
        // Random angle and distance from player
        const angle = Math.random() * Math.PI * 2;
        const distance = WEAPON_CONFIG.TARGET_SPAWN_DISTANCE + Math.random() * 1000;

        const metersPerDegreeLon = 111000 * Math.cos(this.currentLat * Math.PI / 180);
        const metersPerDegreeLat = 111000;

        const targetLon = this.currentLon + (Math.cos(angle) * distance) / metersPerDegreeLon;
        const targetLat = this.currentLat + (Math.sin(angle) * distance) / metersPerDegreeLat;
        const targetAlt = this.physics.state.altitude + (Math.random() - 0.5) * 200;

        const position = Cesium.Cartesian3.fromDegrees(targetLon, targetLat, Math.max(100, targetAlt));

        // Create target entity - red balloon/sphere
        const targetEntity = this.viewer.entities.add({
            position: position,
            ellipsoid: {
                radii: new Cesium.Cartesian3(
                    WEAPON_CONFIG.TARGET_RADIUS,
                    WEAPON_CONFIG.TARGET_RADIUS,
                    WEAPON_CONFIG.TARGET_RADIUS
                ),
                material: Cesium.Color.RED.withAlpha(0.8),
                outline: true,
                outlineColor: Cesium.Color.DARKRED,
                outlineWidth: 2,
            },
            label: {
                text: '🎯',
                font: '32px sans-serif',
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            }
        });

        this.targets.push({
            entity: targetEntity,
            position: position,
            health: 100,
            longitude: targetLon,
            latitude: targetLat,
            altitude: Math.max(100, targetAlt)
        });
    }

    updateTargets(aircraftPosition) {
        const maxDistance = 5000; // Remove targets too far away

        for (let i = this.targets.length - 1; i >= 0; i--) {
            const target = this.targets[i];
            const distance = Cesium.Cartesian3.distance(aircraftPosition, target.position);

            if (distance > maxDistance) {
                this.viewer.entities.remove(target.entity);
                this.targets.splice(i, 1);
            }
        }
    }

    checkBulletCollisions() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];

            for (let j = this.targets.length - 1; j >= 0; j--) {
                const target = this.targets[j];
                const distance = Cesium.Cartesian3.distance(bullet.position, target.position);

                if (distance < WEAPON_CONFIG.TARGET_RADIUS + 5) {
                    // Hit!
                    target.health -= WEAPON_CONFIG.DAMAGE;

                    // Remove bullet
                    this.viewer.entities.remove(bullet.entity);
                    this.bullets.splice(i, 1);

                    if (target.health <= 0) {
                        // Target destroyed
                        this.destroyTarget(target, j);
                        this.hud.addScore(WEAPON_CONFIG.SCORE_PER_HIT);
                        this.showHitMessage();
                    } else {
                        // Target damaged - flash
                        target.entity.ellipsoid.material = Cesium.Color.ORANGE.withAlpha(0.8);
                        setTimeout(() => {
                            if (target.entity && target.entity.ellipsoid) {
                                target.entity.ellipsoid.material = Cesium.Color.RED.withAlpha(0.8);
                            }
                        }, 100);
                    }
                    break;
                }
            }
        }
    }

    destroyTarget(target, index) {
        // Create explosion effect
        const explosionPosition = target.position;

        // Explosion particles
        for (let i = 0; i < 8; i++) {
            const particle = this.viewer.entities.add({
                position: explosionPosition,
                point: {
                    pixelSize: 15 - i,
                    color: i % 2 === 0 ? Cesium.Color.ORANGE : Cesium.Color.YELLOW,
                }
            });

            setTimeout(() => {
                this.viewer.entities.remove(particle);
            }, 200 + i * 50);
        }

        // Remove target
        this.viewer.entities.remove(target.entity);
        this.targets.splice(index, 1);
    }

    showHitMessage() {
        const message = document.createElement('div');
        message.className = 'hit-message';
        message.textContent = t('targetDestroyed');
        document.body.appendChild(message);

        setTimeout(() => {
            message.remove();
        }, 1500);
    }

    // ==================== Enemy System ====================
    updateEnemies(deltaTime, playerPosition, playerState) {
        const currentTime = performance.now() / 1000;

        // Spawn enemies periodically - balanced for performance
        if (currentTime - this.lastEnemySpawn > 10 && this.enemies.length < 4) {
            this.spawnEnemy();
            this.lastEnemySpawn = currentTime;
        }

        // Update each enemy
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];

            // Enemy AI - chase player
            const toPlayer = {
                x: this.currentLon - enemy.longitude,
                y: this.currentLat - enemy.latitude,
                z: playerState.altitude - enemy.altitude
            };

            // Calculate heading towards player
            const targetHeading = Math.atan2(toPlayer.x, toPlayer.y);
            const headingDiff = targetHeading - enemy.heading;

            // Smoothly turn towards player
            enemy.heading += Math.sign(headingDiff) * Math.min(Math.abs(headingDiff), 0.02);

            // Move enemy forward
            const enemySpeed = 100; // m/s
            const metersPerDegreeLon = 111000 * Math.cos(enemy.latitude * Math.PI / 180);
            const metersPerDegreeLat = 111000;

            enemy.longitude += Math.sin(enemy.heading) * enemySpeed * deltaTime / metersPerDegreeLon;
            enemy.latitude += Math.cos(enemy.heading) * enemySpeed * deltaTime / metersPerDegreeLat;

            // Adjust altitude towards player
            const altDiff = playerState.altitude - enemy.altitude;
            enemy.altitude += Math.sign(altDiff) * Math.min(Math.abs(altDiff) * 0.1, 5);

            // Update enemy position
            const enemyPos = Cesium.Cartesian3.fromDegrees(enemy.longitude, enemy.latitude, enemy.altitude);
            enemy.position = enemyPos;

            // Update all enemy parts with proper orientation
            this.updateEnemyParts(enemy, enemyPos, enemy.heading);

            // Fire missile at player
            const distanceToPlayer = Cesium.Cartesian3.distance(enemyPos, playerPosition);
            if (distanceToPlayer < 3000 && currentTime - enemy.lastFireTime > 5) {
                this.fireEnemyMissile(enemy, playerPosition);
                enemy.lastFireTime = currentTime;
            }

            // Remove if too far
            if (distanceToPlayer > 8000) {
                this.removeEnemyEntities(enemy);
                this.enemies.splice(i, 1);
            }

            // Check if player shot down enemy
            for (let j = this.bullets.length - 1; j >= 0; j--) {
                const bullet = this.bullets[j];
                const hitDist = Cesium.Cartesian3.distance(bullet.position, enemyPos);
                if (hitDist < 30) {
                    enemy.health -= WEAPON_CONFIG.DAMAGE;
                    this.viewer.entities.remove(bullet.entity);
                    this.bullets.splice(j, 1);

                    if (enemy.health <= 0) {
                        this.destroyEnemy(enemy, i);
                        this.hud.addScore(200);
                        this.showMessage(currentLang === 'ko' ? '적 격추!' : 'Enemy Down!', '#00ff88');
                    }
                    break;
                }
            }
        }

        // Update missiles
        this.updateEnemyMissiles(deltaTime, playerPosition);

        // Update ground enemies
        this.updateGroundEnemies(deltaTime, playerPosition, playerState);
    }

    // ==================== Ground Enemy System ====================
    updateGroundEnemies(deltaTime, playerPosition, playerState) {
        const currentTime = performance.now() / 1000;

        // Spawn ground enemies periodically - balanced for performance
        if (currentTime - this.lastGroundEnemySpawn > 6 && this.groundEnemies.length < 10) {
            this.spawnGroundEnemy();
            this.lastGroundEnemySpawn = currentTime;
        }

        // Update each ground enemy
        for (let i = this.groundEnemies.length - 1; i >= 0; i--) {
            const groundEnemy = this.groundEnemies[i];
            const groundPos = Cesium.Cartesian3.fromDegrees(groundEnemy.longitude, groundEnemy.latitude, groundEnemy.altitude);
            const distanceToPlayer = Cesium.Cartesian3.distance(groundPos, playerPosition);

            // Update position for infantry (walking enemies)
            if (groundEnemy.type === 'infantry') {
                // Random walking movement
                groundEnemy.walkTimer += deltaTime;
                if (groundEnemy.walkTimer > 3) {
                    groundEnemy.walkDirection = Math.random() * Math.PI * 2;
                    groundEnemy.walkTimer = 0;
                }

                const walkSpeed = 2; // m/s
                const metersPerDegreeLon = 111000 * Math.cos(groundEnemy.latitude * Math.PI / 180);
                const metersPerDegreeLat = 111000;

                groundEnemy.longitude += Math.cos(groundEnemy.walkDirection) * walkSpeed * deltaTime / metersPerDegreeLon;
                groundEnemy.latitude += Math.sin(groundEnemy.walkDirection) * walkSpeed * deltaTime / metersPerDegreeLat;

                // Update entity position
                const newPos = Cesium.Cartesian3.fromDegrees(groundEnemy.longitude, groundEnemy.latitude, groundEnemy.altitude);
                groundEnemy.position = newPos;
                if (groundEnemy.entity) {
                    groundEnemy.entity.position = newPos;
                }
            }

            // Turret fires missiles at player
            if (groundEnemy.type === 'turret') {
                if (distanceToPlayer < 2500 && currentTime - groundEnemy.lastFireTime > 6) {
                    this.fireGroundMissile(groundEnemy, playerPosition);
                    groundEnemy.lastFireTime = currentTime;
                }
            }

            // Remove if too far
            if (distanceToPlayer > 5000) {
                if (groundEnemy.entity) this.viewer.entities.remove(groundEnemy.entity);
                if (groundEnemy.labelEntity) this.viewer.entities.remove(groundEnemy.labelEntity);
                this.groundEnemies.splice(i, 1);
                continue;
            }

            // Check if player shot ground enemy
            for (let j = this.bullets.length - 1; j >= 0; j--) {
                const bullet = this.bullets[j];
                const hitDist = Cesium.Cartesian3.distance(bullet.position, groundPos);
                if (hitDist < 25) {
                    groundEnemy.health -= WEAPON_CONFIG.DAMAGE;
                    this.viewer.entities.remove(bullet.entity);
                    if (bullet.trailEntity) this.viewer.entities.remove(bullet.trailEntity);
                    this.bullets.splice(j, 1);

                    if (groundEnemy.health <= 0) {
                        this.destroyGroundEnemy(groundEnemy, i);
                        this.hud.addScore(groundEnemy.type === 'turret' ? 150 : 50);
                        this.showMessage(
                            currentLang === 'ko'
                                ? (groundEnemy.type === 'turret' ? '미사일 포대 파괴!' : '적 보병 사살!')
                                : (groundEnemy.type === 'turret' ? 'SAM Site Destroyed!' : 'Infantry Down!'),
                            '#00ff88'
                        );
                    }
                    break;
                }
            }
        }
    }

    spawnGroundEnemy() {
        try {
            // Safety check - don't spawn if too many entities
            if (this.groundEnemies.length >= 10) return;

            const angle = Math.random() * Math.PI * 2;
            const distance = 800 + Math.random() * 1500;

            const metersPerDegreeLon = 111000 * Math.cos(this.currentLat * Math.PI / 180);
            const metersPerDegreeLat = 111000;

            const enemyLon = this.currentLon + (Math.cos(angle) * distance) / metersPerDegreeLon;
            const enemyLat = this.currentLat + (Math.sin(angle) * distance) / metersPerDegreeLat;
            const enemyAlt = 5; // Ground level

            const position = Cesium.Cartesian3.fromDegrees(enemyLon, enemyLat, enemyAlt);

            // Randomly choose between turret and infantry
            const type = Math.random() < 0.4 ? 'turret' : 'infantry';

            let entity, labelEntity;

            // Cache canvas images to avoid repeated creation
            if (!this._turretImage) {
                this._turretImage = this.createTurretCanvas();
            }
            if (!this._infantryImage) {
                this._infantryImage = this.createInfantryCanvas();
            }

            if (type === 'turret') {
                // SAM turret - larger and visible
                entity = this.viewer.entities.add({
                    name: 'SAM Turret',
                    position: position,
                    billboard: {
                        image: this._turretImage,
                        scale: 0.35,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM
                    }
                });

                labelEntity = this.viewer.entities.add({
                    position: position,
                    label: {
                        text: 'SAM',
                        font: 'bold 14px sans-serif',
                        fillColor: Cesium.Color.RED,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -45),
                        disableDepthTestDistance: Number.POSITIVE_INFINITY
                    }
                });
            } else {
                // Infantry - visible soldier
                entity = this.viewer.entities.add({
                    name: 'Infantry',
                    position: position,
                    billboard: {
                        image: this._infantryImage,
                        scale: 0.2,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM
                    }
                });

                // No label for infantry to reduce entity count
                labelEntity = null;
            }

            this.groundEnemies.push({
                type: type,
                entity: entity,
                labelEntity: labelEntity,
                position: position,
                longitude: enemyLon,
                latitude: enemyLat,
                altitude: enemyAlt,
                health: type === 'turret' ? 100 : 30,
                lastFireTime: 0,
                walkDirection: Math.random() * Math.PI * 2,
                walkTimer: 0
            });
        } catch (e) {
            console.warn('Failed to spawn ground enemy:', e);
        }
    }

    createTurretCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 120, 120);
        ctx.save();
        ctx.translate(60, 110);

        // Ground shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 5, 35, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Base platform - larger
        ctx.fillStyle = '#3a3a3a';
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.fillRect(-30, -8, 60, 15);
        ctx.strokeRect(-30, -8, 60, 15);

        // Turret body - bigger and more detailed
        ctx.fillStyle = '#2a5a2a';
        ctx.strokeStyle = '#1a3a1a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-25, -8);
        ctx.lineTo(-20, -45);
        ctx.lineTo(20, -45);
        ctx.lineTo(25, -8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Camo pattern
        ctx.fillStyle = '#3a6a3a';
        ctx.beginPath();
        ctx.ellipse(-8, -25, 8, 10, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(10, -30, 6, 8, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Missile launcher tubes (4 tubes)
        ctx.fillStyle = '#222';
        ctx.strokeStyle = '#444';
        for (let i = -1.5; i <= 1.5; i++) {
            ctx.fillRect(-18 + i * 12, -70, 8, 30);
            ctx.strokeRect(-18 + i * 12, -70, 8, 30);
        }

        // Radar dish on top
        ctx.fillStyle = '#888';
        ctx.strokeStyle = '#666';
        ctx.beginPath();
        ctx.ellipse(0, -50, 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Radar antenna
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -50);
        ctx.lineTo(0, -65);
        ctx.stroke();

        // Warning light (red beacon)
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, -75, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore();
        return canvas.toDataURL();
    }

    createInfantryCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = 80;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 80, 100);
        ctx.save();
        ctx.translate(40, 95);

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 2, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Boots
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-10, -8, 8, 8);
        ctx.fillRect(2, -8, 8, 8);

        // Legs
        ctx.fillStyle = '#2a3a2a';
        ctx.fillRect(-9, -28, 7, 22);
        ctx.fillRect(2, -28, 7, 22);

        // Body/Vest
        ctx.fillStyle = '#3a4a3a';
        ctx.fillRect(-12, -55, 24, 30);

        // Tactical vest details
        ctx.fillStyle = '#4a5a4a';
        ctx.fillRect(-10, -50, 6, 10);
        ctx.fillRect(4, -50, 6, 10);

        // Arms
        ctx.fillStyle = '#3a4a3a';
        ctx.fillRect(-16, -50, 5, 20);
        ctx.fillRect(11, -50, 5, 20);

        // Hands
        ctx.fillStyle = '#c4956a';
        ctx.beginPath();
        ctx.arc(-13, -28, 4, 0, Math.PI * 2);
        ctx.arc(13, -28, 4, 0, Math.PI * 2);
        ctx.fill();

        // Neck
        ctx.fillStyle = '#c4956a';
        ctx.fillRect(-4, -60, 8, 6);

        // Head
        ctx.fillStyle = '#c4956a';
        ctx.beginPath();
        ctx.arc(0, -68, 10, 0, Math.PI * 2);
        ctx.fill();

        // Helmet
        ctx.fillStyle = '#2a3a2a';
        ctx.beginPath();
        ctx.arc(0, -70, 11, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-11, -70, 22, 3);

        // Weapon (rifle)
        ctx.fillStyle = '#1a1a1a';
        ctx.save();
        ctx.translate(16, -40);
        ctx.rotate(0.2);
        ctx.fillRect(-2, -25, 4, 35);
        // Barrel
        ctx.fillRect(-1, -30, 2, 8);
        ctx.restore();

        ctx.restore();
        return canvas.toDataURL();
    }

    fireGroundMissile(groundEnemy, playerPosition) {
        try {
            // Limit enemy missiles to prevent performance issues
            if (this.enemyMissiles.length >= 8) return;

            const startPos = Cesium.Cartesian3.fromDegrees(
                groundEnemy.longitude,
                groundEnemy.latitude,
                groundEnemy.altitude + 10
            );

            // Calculate direction to player
            const toPlayer = Cesium.Cartesian3.subtract(playerPosition, startPos, new Cesium.Cartesian3());
            Cesium.Cartesian3.normalize(toPlayer, toPlayer);

            // Create ground-to-air missile entity
            const missileEntity = this.viewer.entities.add({
                position: startPos,
                point: {
                    pixelSize: 10,
                    color: Cesium.Color.fromCssColorString('#ff4400'),
                    outlineColor: Cesium.Color.YELLOW,
                    outlineWidth: 3,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                },
            });

            // Create trail (static positions, updated in updateEnemyMissiles)
            const trailEntity = null; // Disable trail for performance

            const speed = 250; // Ground missiles are fast
            this.enemyMissiles.push({
                entity: missileEntity,
                position: Cesium.Cartesian3.clone(startPos),
                velocity: {
                    x: toPlayer.x * speed,
                    y: toPlayer.y * speed,
                    z: toPlayer.z * speed
                },
                lifetime: 10,
                speed: speed,
                fromGround: true // Mark as ground-launched
            });

            this.showMessage(currentLang === 'ko' ? '⚠️ 지대공 미사일!' : '⚠️ SAM LAUNCH!', '#ff6600');
        } catch (e) {
            console.warn('Failed to fire ground missile:', e);
        }
    }

    destroyGroundEnemy(groundEnemy, index) {
        // Create explosion effect
        const explosionPos = Cesium.Cartesian3.fromDegrees(
            groundEnemy.longitude,
            groundEnemy.latitude,
            groundEnemy.altitude + 5
        );

        const explosionEntity = this.viewer.entities.add({
            position: explosionPos,
            billboard: {
                image: this.createExplosionCanvas(),
                scale: groundEnemy.type === 'turret' ? 0.3 : 0.15,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            }
        });

        // Remove explosion after animation
        setTimeout(() => {
            this.viewer.entities.remove(explosionEntity);
        }, 500);

        // Remove enemy entities
        if (groundEnemy.entity) this.viewer.entities.remove(groundEnemy.entity);
        if (groundEnemy.labelEntity) this.viewer.entities.remove(groundEnemy.labelEntity);

        this.groundEnemies.splice(index, 1);
    }

    createExplosionCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');

        // Explosion gradient
        const gradient = ctx.createRadialGradient(50, 50, 0, 50, 50, 50);
        gradient.addColorStop(0, 'rgba(255, 255, 200, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 150, 50, 0.9)');
        gradient.addColorStop(0.6, 'rgba(255, 50, 0, 0.7)');
        gradient.addColorStop(1, 'rgba(100, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(50, 50, 50, 0, Math.PI * 2);
        ctx.fill();

        return canvas.toDataURL();
    }

    spawnEnemy() {
        try {
            // Safety check - don't spawn if too many enemies
            if (this.enemies.length >= 4) return;

            const angle = Math.random() * Math.PI * 2;
            const distance = 2000 + Math.random() * 1000;

            const metersPerDegreeLon = 111000 * Math.cos(this.currentLat * Math.PI / 180);
            const metersPerDegreeLat = 111000;

            const enemyLon = this.currentLon + (Math.cos(angle) * distance) / metersPerDegreeLon;
            const enemyLat = this.currentLat + (Math.sin(angle) * distance) / metersPerDegreeLat;
            const enemyAlt = this.physics.state.altitude + (Math.random() - 0.5) * 300;

            const position = Cesium.Cartesian3.fromDegrees(enemyLon, enemyLat, enemyAlt);

            // Cache enemy aircraft canvas
            if (!this._enemyAircraftImage) {
                this._enemyAircraftImage = this.createEnemyAircraftCanvas();
            }

            // Simple billboard-based enemy (much more efficient than polygons)
            const enemyEntity = this.viewer.entities.add({
                name: 'Enemy Aircraft',
                position: position,
                billboard: {
                    image: this._enemyAircraftImage,
                    scale: 0.4,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    verticalOrigin: Cesium.VerticalOrigin.CENTER
                },
                label: {
                    text: 'ENEMY',
                    font: 'bold 12px sans-serif',
                    fillColor: Cesium.Color.RED,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -35),
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                }
            });

            this.enemies.push({
                entity: enemyEntity,
                position: position,
                longitude: enemyLon,
                latitude: enemyLat,
                altitude: enemyAlt,
                heading: angle + Math.PI,
                health: 100,
                lastFireTime: 0
            });

        // Warning alert
        this.showWarning(currentLang === 'ko' ? '⚠️ 경고: 적 접근!' : '⚠️ WARNING: Enemy Approaching!');
        } catch (e) {
            console.warn('Failed to spawn enemy:', e);
        }
    }

    updateEnemyParts(enemy, position, heading) {
        // For new billboard-based enemies, just update position
        if (enemy.entity) {
            enemy.entity.position = position;
            return;
        }

        // Legacy polygon-based enemy update (kept for backwards compatibility)
        const hpr = new Cesium.HeadingPitchRoll(heading, 0, 0);
        const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);
        const rotationMatrix = Cesium.Matrix3.fromQuaternion(orientation);

        const offsetPosition = (localOffset) => {
            const rotatedOffset = Cesium.Matrix3.multiplyByVector(
                rotationMatrix,
                new Cesium.Cartesian3(localOffset.x, localOffset.y, localOffset.z),
                new Cesium.Cartesian3()
            );
            return Cesium.Cartesian3.add(position, rotatedOffset, new Cesium.Cartesian3());
        };

        // Enemy aircraft scale
        const scale = 1.2;

        // Fuselage polygon (diamond shape)
        const nosePos = offsetPosition({ x: 0, y: 18 * scale, z: 0 });
        const fuselageLeft = offsetPosition({ x: -2.5 * scale, y: 0, z: 0 });
        const fuselageRight = offsetPosition({ x: 2.5 * scale, y: 0, z: 0 });
        const tailCenter = offsetPosition({ x: 0, y: -16 * scale, z: 0 });

        if (enemy.polygonPositions) {
            enemy.polygonPositions.fuselage = [nosePos, fuselageRight, tailCenter, fuselageLeft];

            // Left Wing polygon (swept back)
            const leftWingTip = offsetPosition({ x: -24 * scale, y: -4 * scale, z: 0 });
            const leftWingFront = offsetPosition({ x: -3 * scale, y: 2 * scale, z: 0 });
            const leftWingBack = offsetPosition({ x: -3 * scale, y: -8 * scale, z: 0 });
            const leftWingInner = offsetPosition({ x: -6 * scale, y: -6 * scale, z: 0 });
            enemy.polygonPositions.leftWing = [leftWingFront, leftWingTip, leftWingInner, leftWingBack];

            // Right Wing polygon (swept back)
            const rightWingTip = offsetPosition({ x: 24 * scale, y: -4 * scale, z: 0 });
            const rightWingFront = offsetPosition({ x: 3 * scale, y: 2 * scale, z: 0 });
            const rightWingBack = offsetPosition({ x: 3 * scale, y: -8 * scale, z: 0 });
            const rightWingInner = offsetPosition({ x: 6 * scale, y: -6 * scale, z: 0 });
            enemy.polygonPositions.rightWing = [rightWingFront, rightWingTip, rightWingInner, rightWingBack];

            // Vertical Tail
            const tailTop = offsetPosition({ x: 0, y: -13 * scale, z: 7 * scale });
            const tailBaseLeft = offsetPosition({ x: -1 * scale, y: -16 * scale, z: 0 });
            const tailBaseRight = offsetPosition({ x: 1 * scale, y: -16 * scale, z: 0 });
            enemy.polygonPositions.tailVert = [tailTop, tailBaseRight, tailBaseLeft];

            // Horizontal Tail
            const hTailLeft = offsetPosition({ x: -10 * scale, y: -14 * scale, z: 1 * scale });
            const hTailRight = offsetPosition({ x: 10 * scale, y: -14 * scale, z: 1 * scale });
            const hTailFrontLeft = offsetPosition({ x: -2.5 * scale, y: -12 * scale, z: 1 * scale });
            const hTailFrontRight = offsetPosition({ x: 2.5 * scale, y: -12 * scale, z: 1 * scale });
            enemy.polygonPositions.tailHoriz = [hTailFrontLeft, hTailLeft, hTailRight, hTailFrontRight];
        }

        // Update label position
        if (enemy.labelEntity) {
            enemy.labelEntity.position = position;
        }

        // Update flame position and trail
        const flamePos = offsetPosition({ x: 0, y: -12 * scale, z: 0 });
        const flameEnd = offsetPosition({ x: 0, y: -18 * scale, z: 0 });
        if (enemy.flameEntity) enemy.flameEntity.position = flamePos;
        if (enemy.flameTrailPositions) {
            enemy.flameTrailPositions.start = flamePos;
            enemy.flameTrailPositions.end = flameEnd;
        }
    }

    removeEnemyEntities(enemy) {
        // Remove billboard entity (new simple version)
        if (enemy.entity) this.viewer.entities.remove(enemy.entity);
        // Remove legacy polygon entities (for backwards compatibility)
        if (enemy.fuselageEntity) this.viewer.entities.remove(enemy.fuselageEntity);
        if (enemy.leftWingEntity) this.viewer.entities.remove(enemy.leftWingEntity);
        if (enemy.rightWingEntity) this.viewer.entities.remove(enemy.rightWingEntity);
        if (enemy.tailVertEntity) this.viewer.entities.remove(enemy.tailVertEntity);
        if (enemy.tailHorizEntity) this.viewer.entities.remove(enemy.tailHorizEntity);
        if (enemy.labelEntity) this.viewer.entities.remove(enemy.labelEntity);
        if (enemy.flameEntity) this.viewer.entities.remove(enemy.flameEntity);
        if (enemy.flameTrail) this.viewer.entities.remove(enemy.flameTrail);
    }

    createEnemyAircraftCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 200, 200);
        ctx.save();
        ctx.translate(100, 100);

        // Enemy fuselage - dark red
        ctx.fillStyle = '#8B0000';
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Enemy wings - aggressive swept back
        ctx.fillStyle = '#660000';
        ctx.beginPath();
        ctx.moveTo(-55, 15);
        ctx.lineTo(-50, 0);
        ctx.lineTo(0, -5);
        ctx.lineTo(50, 0);
        ctx.lineTo(55, 15);
        ctx.lineTo(0, 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Enemy tail
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.moveTo(-15, 40);
        ctx.lineTo(0, 30);
        ctx.lineTo(15, 40);
        ctx.lineTo(0, 48);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Vertical tail
        ctx.beginPath();
        ctx.moveTo(0, 30);
        ctx.lineTo(-4, 50);
        ctx.lineTo(4, 50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Enemy cockpit - dark
        ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
        ctx.beginPath();
        ctx.ellipse(0, -20, 7, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ff0000';
        ctx.stroke();

        // Engine flames
        ctx.fillStyle = 'rgba(255, 100, 0, 0.8)';
        ctx.beginPath();
        ctx.arc(-20, 20, 8, 0, Math.PI * 2);
        ctx.arc(20, 20, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        return canvas.toDataURL();
    }

    fireEnemyMissile(enemy, playerPosition) {
        try {
            // Limit enemy missiles to prevent performance issues
            if (this.enemyMissiles.length >= 8) return;

            // Cache enemy missile canvas
            if (!this._enemyMissileImage) {
                this._enemyMissileImage = this.createEnemyMissileCanvas();
            }

            const missileEntity = this.viewer.entities.add({
                position: enemy.position,
                billboard: {
                    image: this._enemyMissileImage,
                    scale: 0.06,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                },
                point: {
                    pixelSize: 10,
                    color: Cesium.Color.RED,
                    outlineColor: Cesium.Color.ORANGE,
                    outlineWidth: 2,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                },
            });

            this.enemyMissiles.push({
                entity: missileEntity,
                position: Cesium.Cartesian3.clone(enemy.position),
                target: playerPosition,
                speed: 200,
                lifetime: 10
            });

            // Missile warning
            this.showWarning(currentLang === 'ko' ? '🚀 미사일 발사!' : '🚀 MISSILE INCOMING!');
            this.playWarningSound();
        } catch (e) {
            console.warn('Failed to fire enemy missile:', e);
        }
    }

    createEnemyMissileCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = 80;
        canvas.height = 80;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 80, 80);
        ctx.save();
        ctx.translate(40, 40);

        // Missile body - red/orange
        ctx.fillStyle = '#ff4400';
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 6, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Nose
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.moveTo(-4, -20);
        ctx.lineTo(0, -30);
        ctx.lineTo(4, -20);
        ctx.closePath();
        ctx.fill();

        // Fins
        ctx.fillStyle = '#cc0000';
        ctx.beginPath();
        ctx.moveTo(-10, 15);
        ctx.lineTo(-4, 10);
        ctx.lineTo(-4, 20);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(10, 15);
        ctx.lineTo(4, 10);
        ctx.lineTo(4, 20);
        ctx.closePath();
        ctx.fill();

        // Flame
        ctx.fillStyle = 'rgba(255, 200, 0, 0.9)';
        ctx.beginPath();
        ctx.moveTo(-3, 20);
        ctx.lineTo(0, 35);
        ctx.lineTo(3, 20);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
        return canvas.toDataURL();
    }

    updateEnemyMissiles(deltaTime, playerPosition) {
        const metersPerDegreeLon = 111000 * Math.cos(this.currentLat * Math.PI / 180);
        const metersPerDegreeLat = 111000;

        for (let i = this.enemyMissiles.length - 1; i >= 0; i--) {
            const missile = this.enemyMissiles[i];
            missile.lifetime -= deltaTime;

            if (missile.lifetime <= 0) {
                this.viewer.entities.remove(missile.entity);
                if (missile.trailEntity) {
                    this.viewer.entities.remove(missile.trailEntity);
                }
                this.enemyMissiles.splice(i, 1);
                continue;
            }

            // Homing towards player
            const cartographic = Cesium.Cartographic.fromCartesian(missile.position);
            const missileLon = Cesium.Math.toDegrees(cartographic.longitude);
            const missileLat = Cesium.Math.toDegrees(cartographic.latitude);
            const missileAlt = cartographic.height;

            const playerCartographic = Cesium.Cartographic.fromCartesian(playerPosition);
            const playerLon = Cesium.Math.toDegrees(playerCartographic.longitude);
            const playerLat = Cesium.Math.toDegrees(playerCartographic.latitude);
            const playerAlt = playerCartographic.height;

            // Direction to player
            const dx = playerLon - missileLon;
            const dy = playerLat - missileLat;
            const dz = playerAlt - missileAlt;
            const dist = Math.sqrt(dx * dx * metersPerDegreeLon * metersPerDegreeLon +
                                   dy * dy * metersPerDegreeLat * metersPerDegreeLat +
                                   dz * dz);

            if (dist > 1) {
                const vx = (dx / dist) * missile.speed * deltaTime / metersPerDegreeLon * metersPerDegreeLon;
                const vy = (dy / dist) * missile.speed * deltaTime / metersPerDegreeLat * metersPerDegreeLat;
                const vz = (dz / dist) * missile.speed * deltaTime;

                const newLon = missileLon + vx / metersPerDegreeLon;
                const newLat = missileLat + vy / metersPerDegreeLat;
                const newAlt = Math.max(50, missileAlt + vz);

                missile.position = Cesium.Cartesian3.fromDegrees(newLon, newLat, newAlt);
                missile.entity.position = missile.position;
            }

            // Update billboard rotation
            const missileHeading = Math.atan2(dx, dy);
            if (missile.entity.billboard) {
                missile.entity.billboard.rotation = -missileHeading;
            }
        }
    }

    checkMissileCollision(playerPosition) {
        for (let i = this.enemyMissiles.length - 1; i >= 0; i--) {
            const missile = this.enemyMissiles[i];
            const distance = Cesium.Cartesian3.distance(missile.position, playerPosition);

            if (distance < 20) {
                // Hit by missile!
                this.viewer.entities.remove(missile.entity);
                if (missile.trailEntity) {
                    this.viewer.entities.remove(missile.trailEntity);
                }
                this.enemyMissiles.splice(i, 1);

                // Damage player
                this.physics.state.fuel -= 30;
                this.physics.state.speed *= 0.7;

                this.showMessage(currentLang === 'ko' ? '💥 피격!' : '💥 HIT!', '#ff4444');

                // Screen shake
                this.speedEffects.shake = 1;

                // Game over if too much damage
                if (this.physics.state.fuel <= 0) {
                    this.gameOver();
                }
            }
        }
    }

    destroyEnemy(enemy, index) {
        // Explosion effect
        for (let i = 0; i < 12; i++) {
            const particle = this.viewer.entities.add({
                position: enemy.position,
                point: {
                    pixelSize: 20 - i,
                    color: i % 2 === 0 ? Cesium.Color.ORANGE : Cesium.Color.RED,
                }
            });

            setTimeout(() => {
                this.viewer.entities.remove(particle);
            }, 300 + i * 50);
        }

        // Remove all enemy entities
        this.removeEnemyEntities(enemy);
        this.enemies.splice(index, 1);
    }

    showWarning(text) {
        const warning = document.getElementById('missile-warning');
        if (warning) {
            warning.textContent = text;
            warning.classList.remove('hidden');
            warning.classList.add('flash');

            setTimeout(() => {
                warning.classList.add('hidden');
                warning.classList.remove('flash');
            }, 3000);
        }
    }

    showMessage(text, color = '#ffffff') {
        const message = document.createElement('div');
        message.className = 'game-message';
        message.textContent = text;
        message.style.color = color;
        document.body.appendChild(message);

        setTimeout(() => {
            message.remove();
        }, 2000);
    }

    playWarningSound() {
        // Create beeping warning sound using Web Audio API
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'square';
            gainNode.gain.value = 0.1;

            oscillator.start();

            // Beep pattern
            setTimeout(() => gainNode.gain.value = 0, 100);
            setTimeout(() => gainNode.gain.value = 0.1, 200);
            setTimeout(() => gainNode.gain.value = 0, 300);
            setTimeout(() => gainNode.gain.value = 0.1, 400);
            setTimeout(() => {
                oscillator.stop();
                audioCtx.close();
            }, 500);
        } catch (e) {
            // Audio not supported
        }
    }

    clearEnemies() {
        // Clear air enemies
        this.enemies.forEach(e => this.removeEnemyEntities(e));
        this.enemies = [];

        // Clear ground enemies
        this.groundEnemies.forEach(g => {
            if (g.entity) this.viewer.entities.remove(g.entity);
            if (g.labelEntity) this.viewer.entities.remove(g.labelEntity);
        });
        this.groundEnemies = [];

        // Clear enemy missiles
        this.enemyMissiles.forEach(m => {
            this.viewer.entities.remove(m.entity);
            if (m.trailEntity) this.viewer.entities.remove(m.trailEntity);
        });
        this.enemyMissiles = [];
    }

    clearWeapons() {
        // Clear all bullets and their trails
        this.bullets.forEach(b => {
            this.viewer.entities.remove(b.entity);
            if (b.trailEntity) this.viewer.entities.remove(b.trailEntity);
        });
        this.bullets = [];

        // Clear all player missiles and their trails
        this.playerMissiles.forEach(m => {
            this.viewer.entities.remove(m.entity);
            if (m.trailEntity) this.viewer.entities.remove(m.trailEntity);
        });
        this.playerMissiles = [];

        // Clear all targets
        this.targets.forEach(t => this.viewer.entities.remove(t.entity));
        this.targets = [];

        // Clear all flares and their trails
        this.flares.forEach(f => {
            this.viewer.entities.remove(f.entity);
            if (f.trailEntity) this.viewer.entities.remove(f.trailEntity);
        });
        this.flares = [];

        // Clear all nukes
        this.nukes.forEach(n => {
            this.viewer.entities.remove(n.entity);
        });
        this.nukes = [];

        // Reset ammo and missiles
        this.ammo = WEAPON_CONFIG.MAX_AMMO;
        this.missileCount = WEAPON_CONFIG.MAX_MISSILES;
        this.flareCount = WEAPON_CONFIG.MAX_FLARES;
        this.nukeCount = WEAPON_CONFIG.MAX_NUKES;
        this.lastMissileRecharge = 0;
        this.lastAmmoRecharge = 0;
        this.lastFlareRecharge = 0;
        this.lastNukeRecharge = 0;

        // Clear enemies too
        this.clearEnemies();
    }

    pause() {
        this.isPaused = true;
        this.menu.showPauseMenu();
    }

    resume() {
        this.isPaused = false;
        this.menu.hidePauseMenu();
        this.controlsModal?.hide();
        this.lastTime = performance.now();
    }

    restart() {
        this.menu.hidePauseMenu();
        this.menu.hideAll();
        this.startGame(this.currentLon, this.currentLat, this.gameMode);
    }

    quitToMenu() {
        this.isRunning = false;
        this.isPaused = false;
        cancelAnimationFrame(this.animationFrameId);

        this.hud.hide();
        this.menu.hideAll();
        this.menu.showStartMenu();
        this.controlsModal?.hide();
    }

    gameOver() {
        this.isRunning = false;
        cancelAnimationFrame(this.animationFrameId);

        this.hud.hide();
        this.menu.showGameOver(
            this.hud.getScore(),
            this.hud.getDistanceTraveled(),
            this.hud.getFlightTime()
        );
    }
}

// ==================== Initialize ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Sky Explorer - Initializing...');
    const game = new FlightGame();
    await game.initialize();
    console.log('Game ready!');
});
