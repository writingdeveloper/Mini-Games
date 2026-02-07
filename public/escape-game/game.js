// Escape Game - Class-based refactoring with multiplayer support

const GRID_SIZE = 20;
const PLAYER_EMOJIS = ['🚗', '🚙', '🏎️', '🚕'];
const POLICE_COLORS = ['#4dabf7', '#ff6b6b', '#ffd43b', '#69db7c'];

class EscapeGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.tileSize = this.canvas.width / GRID_SIZE;

    // DOM elements
    this.startScreen = document.getElementById('startScreen');
    this.gameScreen = document.getElementById('gameScreen');
    this.gameOverScreen = document.getElementById('gameOverScreen');
    this.scoreElement = document.getElementById('score');
    this.speedElement = document.getElementById('speed');
    this.finalScoreElement = document.getElementById('finalScore');
    this.gameOverReasonElement = document.getElementById('gameOverReason');

    // Game state
    this.car = { x: 10, y: 10 };
    this.policeCars = [];
    this.pedestrian = { x: 0, y: 0 };
    this.direction = { x: 0, y: 0 };
    this.nextDirection = { x: 0, y: 0 };
    this.gameLoop = null;
    this.score = 0;
    this.speed = 1;
    this.gameSpeed = 200;

    // Multiplayer state
    this.isMultiplayer = false;
    this.networkClient = null;
    this.remotePlayers = {};  // { id: { position, direction, policeCars, score, speed, alive, color } }
    this.myPlayerId = null;
    this.myColor = '#51cf66';
    this.myEmoji = '🚗';

    // Setup events
    this._keydownHandler = (e) => this._handleKeydown(e);
    document.addEventListener('keydown', this._keydownHandler);

    document.getElementById('startButton').addEventListener('click', () => this.startSinglePlayer());
    document.getElementById('restartButton').addEventListener('click', () => this.startSinglePlayer());
  }

  // ---- Single Player ----

  startSinglePlayer() {
    this.isMultiplayer = false;
    this._initGame();
    this._showScreen('game');
    this.draw();
    this.gameLoop = setInterval(() => this._gameStep(), this.gameSpeed);
  }

  // ---- Multiplayer ----

  async startMultiplayer(gameClient) {
    this.isMultiplayer = true;
    this.networkClient = gameClient;
    this.myPlayerId = gameClient.playerId;

    // Find our color from room info
    const room = gameClient.room;
    if (room) {
      const me = room.players.find(p => p.id === this.myPlayerId);
      if (me) {
        this.myColor = me.color;
        const idx = room.players.indexOf(me);
        this.myEmoji = PLAYER_EMOJIS[idx] || '🚗';
      }
    }

    this._initGame();
    this._showScreen('game');

    // Listen for server state
    gameClient.on('gameState', (data) => this._onServerState(data));
    gameClient.on('gameEvent', (data) => this._onServerEvent(data));
    gameClient.on('gameEnd', (data) => this._onGameEnd(data));

    // Start render loop (input-driven, no local update in multiplayer)
    this._multiplayerRender();
  }

  _onServerState(data) {
    if (!data.players) return;

    // Update remote players
    this.remotePlayers = {};
    for (const [id, state] of Object.entries(data.players)) {
      if (id === this.myPlayerId) {
        // Update own state from server (authoritative)
        this.car = state.position;
        this.policeCars = state.policeCars || [];
        this.score = state.score;
        this.speed = state.speed;
        if (!state.alive && this.gameLoop !== null) {
          // We died
        }
      } else {
        this.remotePlayers[id] = state;
      }
    }

    if (data.pedestrian) {
      this.pedestrian = data.pedestrian;
    }

    this._updateUI();
  }

  _onServerEvent(data) {
    if (data.type === 'player_died' && data.playerId === this.myPlayerId) {
      let reason = '게임 오버!';
      if (data.reason === 'wall') reason = '벽에 충돌했습니다!';
      if (data.reason === 'own_police') reason = '경찰차에 잡혔습니다!';
      if (data.reason === 'other_police') reason = '다른 플레이어의 경찰차에 잡혔습니다!';
      // Don't end game yet - show spectator mode
      this.gameOverReasonElement.textContent = reason;
    }
    if (data.type === 'pedestrian_hit') {
      this._flashScreen();
    }
  }

  _onGameEnd(data) {
    this._endGame(
      data.winner === this.myPlayerId
        ? '승리! 최후의 생존자!'
        : `패배! 승자: ${data.winner || '없음'}`,
    );
  }

  _multiplayerRender() {
    if (!this.isMultiplayer) return;
    this.draw();
    requestAnimationFrame(() => this._multiplayerRender());
  }

  // ---- Core Game Logic (used in single player) ----

  _initGame() {
    this.car = { x: 10, y: 10 };
    this.policeCars = [];
    this.direction = { x: 0, y: 0 };
    this.nextDirection = { x: 0, y: 0 };
    this.score = 0;
    this.speed = 1;
    this.gameSpeed = 200;
    this.remotePlayers = {};

    if (!this.isMultiplayer) {
      this._spawnPedestrian();
    }
    this._updateUI();
  }

  _handleKeydown(e) {
    let dir = null;
    switch (e.key) {
      case 'ArrowUp':
        if (this.direction.y === 0) dir = { x: 0, y: -1 };
        e.preventDefault();
        break;
      case 'ArrowDown':
        if (this.direction.y === 0) dir = { x: 0, y: 1 };
        e.preventDefault();
        break;
      case 'ArrowLeft':
        if (this.direction.x === 0) dir = { x: -1, y: 0 };
        e.preventDefault();
        break;
      case 'ArrowRight':
        if (this.direction.x === 0) dir = { x: 1, y: 0 };
        e.preventDefault();
        break;
    }

    if (dir) {
      this.nextDirection = dir;
      if (this.isMultiplayer && this.networkClient) {
        this.networkClient.sendInput({ direction: dir });
      }
    }
  }

  _update() {
    this.direction = { ...this.nextDirection };
    if (this.direction.x === 0 && this.direction.y === 0) return;

    for (let i = this.policeCars.length - 1; i > 0; i--) {
      this.policeCars[i] = { ...this.policeCars[i - 1] };
    }
    if (this.policeCars.length > 0) {
      this.policeCars[0] = { x: this.car.x, y: this.car.y };
    }

    this.car.x += this.direction.x;
    this.car.y += this.direction.y;

    if (this.car.x < 0 || this.car.x >= GRID_SIZE || this.car.y < 0 || this.car.y >= GRID_SIZE) {
      this._endGame('벽에 충돌했습니다!');
      return;
    }

    for (const police of this.policeCars) {
      if (this.car.x === police.x && this.car.y === police.y) {
        this._endGame('경찰차에 잡혔습니다!');
        return;
      }
    }

    if (this.car.x === this.pedestrian.x && this.car.y === this.pedestrian.y) {
      this.score++;
      this.policeCars.push({ x: this.car.x, y: this.car.y });
      this._spawnPedestrian();

      if (this.score % 5 === 0) {
        this.speed++;
        this.gameSpeed = Math.max(50, 200 - (this.speed - 1) * 15);
        clearInterval(this.gameLoop);
        this.gameLoop = setInterval(() => this._gameStep(), this.gameSpeed);
      }

      this._updateUI();
      this._flashScreen();
    }
  }

  _spawnPedestrian() {
    let valid = false;
    while (!valid) {
      this.pedestrian = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      valid = true;
      if (this.pedestrian.x === this.car.x && this.pedestrian.y === this.car.y) valid = false;
      for (const p of this.policeCars) {
        if (this.pedestrian.x === p.x && this.pedestrian.y === p.y) { valid = false; break; }
      }
    }
  }

  _gameStep() {
    this._update();
    this.draw();
  }

  // ---- Rendering ----

  draw() {
    const ctx = this.ctx;
    const ts = this.tileSize;

    // Background
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Grid
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * ts, 0);
      ctx.lineTo(i * ts, this.canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * ts);
      ctx.lineTo(this.canvas.width, i * ts);
      ctx.stroke();
    }

    ctx.font = `${ts * 0.8}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Pedestrian
    ctx.fillText('🚶', this.pedestrian.x * ts + ts / 2, this.pedestrian.y * ts + ts / 2);

    // Own police cars
    for (const police of this.policeCars) {
      ctx.fillText('🚓', police.x * ts + ts / 2, police.y * ts + ts / 2);
    }

    // Own car
    ctx.fillText(this.myEmoji, this.car.x * ts + ts / 2, this.car.y * ts + ts / 2);

    // Remote players (multiplayer)
    if (this.isMultiplayer) {
      let remoteIdx = 1;
      for (const [id, state] of Object.entries(this.remotePlayers)) {
        if (!state.alive) continue;

        // Remote police cars with different color
        const policeColor = POLICE_COLORS[remoteIdx % POLICE_COLORS.length];
        ctx.save();
        for (const police of (state.policeCars || [])) {
          // Draw colored circle behind police emoji
          ctx.fillStyle = policeColor;
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.arc(police.x * ts + ts / 2, police.y * ts + ts / 2, ts * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillText('🚓', police.x * ts + ts / 2, police.y * ts + ts / 2);
        }
        ctx.restore();

        // Remote car
        const emoji = PLAYER_EMOJIS[remoteIdx % PLAYER_EMOJIS.length];
        ctx.fillText(emoji, state.position.x * ts + ts / 2, state.position.y * ts + ts / 2);

        // Name tag
        ctx.fillStyle = state.color || '#ffffff';
        ctx.font = '10px Arial';
        ctx.fillText(
          id.substring(0, 6),
          state.position.x * ts + ts / 2,
          state.position.y * ts - 2,
        );
        ctx.font = `${ts * 0.8}px Arial`;

        remoteIdx++;
      }
    }
  }

  // ---- UI ----

  _updateUI() {
    this.scoreElement.textContent = this.score;
    this.speedElement.textContent = this.speed;
  }

  _flashScreen() {
    this.canvas.style.opacity = '0.5';
    setTimeout(() => { this.canvas.style.opacity = '1'; }, 100);
  }

  _showScreen(screen) {
    this.startScreen.classList.add('hidden');
    this.gameScreen.classList.add('hidden');
    this.gameOverScreen.classList.add('hidden');

    if (screen === 'start') this.startScreen.classList.remove('hidden');
    if (screen === 'game') this.gameScreen.classList.remove('hidden');
    if (screen === 'gameover') this.gameOverScreen.classList.remove('hidden');
  }

  _endGame(reason) {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
    this.finalScoreElement.textContent = this.score;
    this.gameOverReasonElement.textContent = reason;
    this._showScreen('gameover');
  }

  // ---- Cleanup ----

  destroy() {
    if (this.gameLoop) clearInterval(this.gameLoop);
    document.removeEventListener('keydown', this._keydownHandler);
    if (this.networkClient) {
      this.networkClient.off('gameState');
      this.networkClient.off('gameEvent');
      this.networkClient.off('gameEnd');
    }
  }
}

// ---- Initialize ----
const game = new EscapeGame();

// Check for multiplayer mode via URL params or lobby
const urlParams = new URLSearchParams(window.location.search);
const serverUrl = urlParams.get('server');
const mode = urlParams.get('mode');

if (mode === 'multi' && serverUrl) {
  // Multiplayer mode - will be started by LobbyUI
  import('/shared/networking/GameClient.js').then(({ GameClient }) => {
    import('/shared/lobby/LobbyUI.js').then(({ LobbyUI }) => {
      // Load CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/shared/lobby/LobbyUI.css';
      document.head.appendChild(link);

      // Load socket.io client
      const script = document.createElement('script');
      script.src = serverUrl + '/socket.io/socket.io.js';
      script.onload = () => {
        const client = new GameClient(serverUrl);
        const lobby = new LobbyUI(client, {
          gameType: 'escape',
          gameName: '도주 게임',
          onSinglePlayer: () => game.startSinglePlayer(),
          onGameStart: () => game.startMultiplayer(client),
        });
        lobby.show();
      };
      document.head.appendChild(script);
    });
  });
} else {
  // Default: show start screen for single player
  document.getElementById('startScreen').classList.remove('hidden');
}
