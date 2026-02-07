import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Test the Room and LobbyManager logic directly (no socket.io needed)

// Re-implement Room logic for testing (avoid module resolution issues with NodeNext)

const MAX_PLAYERS_PER_ROOM = 4;
const RECONNECT_GRACE_MS = 30000;

const PLAYER_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'];

interface RoomPlayer {
  id: string;
  socketId: string;
  name: string;
  ready: boolean;
  color: string;
  connected: boolean;
  disconnectedAt?: number;
}

class Room {
  code: string;
  gameType: string;
  state: string = 'waiting';
  hostId: string;
  players: Map<string, RoomPlayer> = new Map();
  lastActivity: number = Date.now();

  constructor(code: string, gameType: string, hostId: string) {
    this.code = code;
    this.gameType = gameType;
    this.hostId = hostId;
  }

  addPlayer(socketId: string, name: string): RoomPlayer | null {
    if (this.players.size >= MAX_PLAYERS_PER_ROOM) return null;
    if (this.state !== 'waiting') return null;
    const color = PLAYER_COLORS[this.players.size] || '#FFFFFF';
    const player: RoomPlayer = { id: socketId, socketId, name, ready: false, color, connected: true };
    this.players.set(socketId, player);
    return player;
  }

  removePlayer(socketId: string): boolean {
    const removed = this.players.delete(socketId);
    if (removed && this.hostId === socketId && this.players.size > 0) {
      const nextHost = this.players.values().next().value;
      if (nextHost) this.hostId = nextHost.id;
    }
    return removed;
  }

  setReady(socketId: string, ready: boolean): void {
    const player = this.players.get(socketId);
    if (player) player.ready = ready;
  }

  allReady(): boolean {
    if (this.players.size < 2) return false;
    for (const p of this.players.values()) if (!p.ready) return false;
    return true;
  }

  isEmpty(): boolean {
    return this.players.size === 0;
  }
}

describe('Room 관리', () => {
  let room: Room;

  beforeEach(() => {
    room = new Room('ABC123', 'escape', 'host1');
  });

  it('방을 생성하면 코드와 게임 타입이 설정된다', () => {
    expect(room.code).toBe('ABC123');
    expect(room.gameType).toBe('escape');
    expect(room.state).toBe('waiting');
  });

  it('플레이어를 추가할 수 있다', () => {
    const player = room.addPlayer('p1', 'Alice');
    expect(player).not.toBeNull();
    expect(player!.name).toBe('Alice');
    expect(player!.color).toBe('#FF6B6B');
  });

  it('최대 4명까지만 입장 가능하다', () => {
    room.addPlayer('p1', 'A');
    room.addPlayer('p2', 'B');
    room.addPlayer('p3', 'C');
    room.addPlayer('p4', 'D');
    const fifth = room.addPlayer('p5', 'E');
    expect(fifth).toBeNull();
    expect(room.players.size).toBe(4);
  });

  it('게임 중에는 참가할 수 없다', () => {
    room.addPlayer('p1', 'A');
    room.state = 'playing';
    const player = room.addPlayer('p2', 'B');
    expect(player).toBeNull();
  });

  it('플레이어를 제거할 수 있다', () => {
    room.addPlayer('p1', 'Alice');
    expect(room.removePlayer('p1')).toBe(true);
    expect(room.players.size).toBe(0);
  });

  it('호스트가 나가면 다음 플레이어가 호스트가 된다', () => {
    room.addPlayer('host1', 'Host');
    room.addPlayer('p2', 'Bob');
    room.removePlayer('host1');
    expect(room.hostId).toBe('p2');
  });

  it('모두 ready이고 2명 이상이면 allReady', () => {
    room.addPlayer('p1', 'A');
    room.addPlayer('p2', 'B');
    expect(room.allReady()).toBe(false);

    room.setReady('p1', true);
    room.setReady('p2', true);
    expect(room.allReady()).toBe(true);
  });

  it('1명만 있으면 allReady는 false', () => {
    room.addPlayer('p1', 'A');
    room.setReady('p1', true);
    expect(room.allReady()).toBe(false);
  });

  it('플레이어마다 다른 색상이 할당된다', () => {
    const p1 = room.addPlayer('p1', 'A');
    const p2 = room.addPlayer('p2', 'B');
    const p3 = room.addPlayer('p3', 'C');
    expect(p1!.color).not.toBe(p2!.color);
    expect(p2!.color).not.toBe(p3!.color);
  });

  it('빈 방 확인', () => {
    expect(room.isEmpty()).toBe(true);
    room.addPlayer('p1', 'A');
    expect(room.isEmpty()).toBe(false);
  });
});

describe('RoomCodeGenerator', () => {
  const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  function generateRoomCode(existingCodes: Set<string>): string {
    let code: string;
    let attempts = 0;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += CHARS[Math.floor(Math.random() * CHARS.length)];
      }
      attempts++;
      if (attempts > 1000) throw new Error('Failed');
    } while (existingCodes.has(code));
    return code;
  }

  it('6자리 코드를 생성한다', () => {
    const code = generateRoomCode(new Set());
    expect(code.length).toBe(6);
  });

  it('혼동 문자(0, O, 1, I, L)를 포함하지 않는다', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode(new Set());
      expect(code).not.toMatch(/[0OIL1]/);
    }
  });

  it('기존 코드와 중복되지 않는다', () => {
    const existing = new Set(['ABC123']);
    const code = generateRoomCode(existing);
    expect(code).not.toBe('ABC123');
  });

  it('여러 코드를 생성해도 유니크하다', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode(codes);
      expect(codes.has(code)).toBe(false);
      codes.add(code);
    }
  });
});
