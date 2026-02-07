// AudioManager - 오디오 관련 모든 기능 관리

export class AudioManager {
  constructor() {
    this.audioContext = null;
  }

  init() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const resumeAudio = () => {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
    };
    document.addEventListener('click', resumeAudio, { once: true });
  }

  destroy() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
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

  playEnemyGunSound(enemyPos, playerPos) {
    if (!this.audioContext) return;

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
}
