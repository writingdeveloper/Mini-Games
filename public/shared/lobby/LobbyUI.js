/**
 * LobbyUI - Reusable lobby interface for all games
 * Handles mode selection, room creation/joining, waiting room, and countdown
 */
export class LobbyUI {
  /**
   * @param {import('../networking/GameClient.js').GameClient} gameClient
   * @param {object} options
   * @param {string} options.gameType - 'escape' | 'flight' | 'survival'
   * @param {string} options.gameName - Display name for the game
   * @param {function} options.onSinglePlayer - Called when singleplayer is chosen
   * @param {function} options.onGameStart - Called when multiplayer game starts
   */
  constructor(gameClient, options) {
    this.client = gameClient;
    this.gameType = options.gameType;
    this.gameName = options.gameName;
    this.onSinglePlayer = options.onSinglePlayer;
    this.onGameStart = options.onGameStart;
    this.playerName = 'Player' + Math.floor(Math.random() * 1000);

    this.overlay = null;
    this.currentView = 'mode-select'; // mode-select, create-join, waiting, countdown
    this._build();
    this._setupEvents();
  }

  _build() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'lobby-overlay';
    this.overlay.innerHTML = `
      <div class="lobby-panel" id="lobbyPanel">
        <div class="lobby-ping" id="lobbyPing"></div>
        <!-- Mode Select View -->
        <div id="viewModeSelect">
          <h2 class="lobby-title">${this.gameName}</h2>
          <div class="lobby-input-group">
            <label class="lobby-label">닉네임</label>
            <input class="lobby-input" id="lobbyPlayerName" value="${this.playerName}"
                   placeholder="이름 입력" style="letter-spacing: normal; text-align: left;">
          </div>
          <div class="lobby-mode-select">
            <button class="lobby-mode-btn" id="btnSinglePlayer">
              싱글플레이어
            </button>
            <button class="lobby-mode-btn" id="btnMultiPlayer">
              멀티플레이어
            </button>
          </div>
        </div>

        <!-- Create/Join View -->
        <div id="viewCreateJoin" style="display:none">
          <h2 class="lobby-title">멀티플레이어</h2>
          <button class="lobby-btn lobby-btn-primary" id="btnCreateRoom">
            방 만들기
          </button>
          <div style="text-align:center; margin: 12px 0; color: rgba(255,255,255,0.3)">또는</div>
          <div class="lobby-input-group">
            <label class="lobby-label">방 코드</label>
            <input class="lobby-input" id="lobbyRoomCode" placeholder="6자리 코드 입력" maxlength="6">
          </div>
          <button class="lobby-btn lobby-btn-primary" id="btnJoinRoom">
            방 참가
          </button>
          <div class="lobby-error" id="lobbyError"></div>
          <button class="lobby-btn lobby-btn-secondary" id="btnBackToMode" style="margin-top:12px">
            뒤로
          </button>
        </div>

        <!-- Waiting Room View -->
        <div id="viewWaiting" style="display:none">
          <h2 class="lobby-title">대기실</h2>
          <div class="lobby-room-code">
            <div class="lobby-room-code-label">방 코드</div>
            <div class="lobby-room-code-value" id="lobbyCodeDisplay">------</div>
          </div>
          <ul class="lobby-player-list" id="lobbyPlayerList"></ul>
          <button class="lobby-btn lobby-btn-primary" id="btnReady">
            준비 완료
          </button>
          <button class="lobby-btn lobby-btn-primary" id="btnStartGame" style="display:none">
            게임 시작
          </button>
          <button class="lobby-btn lobby-btn-secondary" id="btnLeaveRoom">
            방 나가기
          </button>
          <div class="lobby-status" id="lobbyWaitStatus">다른 플레이어를 기다리는 중...</div>
        </div>

        <!-- Countdown View -->
        <div id="viewCountdown" style="display:none">
          <h2 class="lobby-title">게임 시작!</h2>
          <div class="lobby-countdown" id="lobbyCountdown">3</div>
        </div>
      </div>
    `;
    document.body.appendChild(this.overlay);
  }

  _setupEvents() {
    const $ = (id) => this.overlay.querySelector('#' + id);

    // Name input
    $('lobbyPlayerName').addEventListener('input', (e) => {
      this.playerName = e.target.value.trim() || 'Player';
    });

    // Mode selection
    $('btnSinglePlayer').addEventListener('click', () => {
      this.hide();
      if (this.onSinglePlayer) this.onSinglePlayer();
    });

    $('btnMultiPlayer').addEventListener('click', () => {
      this._showView('create-join');
    });

    // Create/Join
    $('btnCreateRoom').addEventListener('click', async () => {
      this._setError('');
      try {
        if (!this.client.isConnected()) {
          await this.client.connect();
        }
        const room = await this.client.createRoom(this.gameType, this.playerName);
        this._showWaiting(room);
      } catch (e) {
        this._setError('방 생성 실패: ' + e.message);
      }
    });

    $('btnJoinRoom').addEventListener('click', async () => {
      const code = $('lobbyRoomCode').value.trim().toUpperCase();
      if (code.length !== 6) {
        this._setError('6자리 코드를 입력하세요');
        return;
      }
      this._setError('');
      try {
        if (!this.client.isConnected()) {
          await this.client.connect();
        }
        const room = await this.client.joinRoom(code, this.playerName);
        this._showWaiting(room);
      } catch (e) {
        this._setError('방 참가 실패: ' + e.message);
      }
    });

    $('btnBackToMode').addEventListener('click', () => {
      this._showView('mode-select');
    });

    // Waiting room
    let isReady = false;
    $('btnReady').addEventListener('click', () => {
      isReady = !isReady;
      this.client.setReady(isReady);
      $('btnReady').textContent = isReady ? '준비 취소' : '준비 완료';
    });

    $('btnStartGame').addEventListener('click', () => {
      this.client.startGame();
    });

    $('btnLeaveRoom').addEventListener('click', () => {
      this.client.leaveRoom();
      isReady = false;
      $('btnReady').textContent = '준비 완료';
      this._showView('create-join');
    });

    // Client events
    this.client.on('roomUpdate', (room) => {
      this._updateWaitingRoom(room);
    });

    this.client.on('countdown', (seconds) => {
      this._showView('countdown');
      this.overlay.querySelector('#lobbyCountdown').textContent = seconds;
      if (seconds <= 0) {
        this.hide();
      }
    });

    this.client.on('gameStart', () => {
      this.hide();
      if (this.onGameStart) this.onGameStart();
    });

    this.client.on('roomError', (message) => {
      this._setError(message);
    });

    this.client.on('disconnected', () => {
      this._setError('서버 연결이 끊겼습니다');
    });

    // Ping display
    setInterval(() => {
      if (this.client.isConnected()) {
        $('lobbyPing').textContent = `${this.client.ping}ms`;
      }
    }, 1000);
  }

  _showView(view) {
    this.currentView = view;
    const views = ['viewModeSelect', 'viewCreateJoin', 'viewWaiting', 'viewCountdown'];
    const mapping = {
      'mode-select': 'viewModeSelect',
      'create-join': 'viewCreateJoin',
      'waiting': 'viewWaiting',
      'countdown': 'viewCountdown',
    };

    for (const v of views) {
      const el = this.overlay.querySelector('#' + v);
      if (el) el.style.display = v === mapping[view] ? 'block' : 'none';
    }
  }

  _showWaiting(room) {
    this._showView('waiting');
    this._updateWaitingRoom(room);
  }

  _updateWaitingRoom(room) {
    if (!room) return;
    const $ = (id) => this.overlay.querySelector('#' + id);

    $('lobbyCodeDisplay').textContent = room.code;

    // Player list
    const list = $('lobbyPlayerList');
    list.innerHTML = '';
    for (const player of room.players) {
      const li = document.createElement('li');
      li.className = 'lobby-player-item';
      li.innerHTML = `
        <span class="lobby-player-color" style="background:${player.color}"></span>
        <span class="lobby-player-name">${player.name}</span>
        ${player.id === room.hostId ? '<span class="lobby-player-badge">HOST</span>' : ''}
        <span class="lobby-player-ready ${player.ready ? 'ready' : 'not-ready'}">
          ${player.ready ? '준비됨' : '대기중'}
        </span>
      `;
      list.appendChild(li);
    }

    // Show start button only for host when all ready
    const isHost = this.client.isHost();
    const allReady = room.players.length >= 2 && room.players.every(p => p.ready);
    $('btnStartGame').style.display = isHost && allReady ? 'block' : 'none';
    $('btnReady').style.display = isHost ? 'none' : 'block';

    // If host, always show ready as true
    if (isHost) {
      this.client.setReady(true);
    }

    const status = room.players.length < 2
      ? '다른 플레이어를 기다리는 중...'
      : allReady
        ? isHost ? '게임을 시작하세요!' : '호스트가 게임을 시작할 때까지 대기중...'
        : '모든 플레이어가 준비될 때까지 대기중...';
    $('lobbyWaitStatus').textContent = status;
  }

  _setError(msg) {
    const el = this.overlay.querySelector('#lobbyError');
    if (el) el.textContent = msg;
  }

  show() {
    this.overlay.classList.remove('hidden');
    this._showView('mode-select');
  }

  hide() {
    this.overlay.classList.add('hidden');
  }

  destroy() {
    this.client.off('roomUpdate');
    this.client.off('countdown');
    this.client.off('gameStart');
    this.client.off('roomError');
    this.client.off('disconnected');
    if (this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  }
}
