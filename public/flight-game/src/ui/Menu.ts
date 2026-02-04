import { GameMode } from '../utils/Constants';

export interface MenuCallbacks {
    onStart: (location: { lat: number; lon: number; name: string }, mode: GameMode) => void;
    onResume: () => void;
    onRestart: () => void;
    onQuit: () => void;
}

export class Menu {
    private startMenu: HTMLElement | null;
    private pauseMenu: HTMLElement | null;
    private gameoverScreen: HTMLElement | null;
    private loadingScreen: HTMLElement | null;

    private selectedLocation: { lat: number; lon: number; name: string };
    private selectedMode: GameMode;
    private callbacks: MenuCallbacks | null = null;

    constructor() {
        this.startMenu = document.getElementById('start-menu');
        this.pauseMenu = document.getElementById('pause-menu');
        this.gameoverScreen = document.getElementById('gameover-screen');
        this.loadingScreen = document.getElementById('loading-screen');

        this.selectedLocation = { lat: 37.5665, lon: 126.9780, name: 'Seoul' };
        this.selectedMode = 'free';

        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Location buttons
        document.querySelectorAll('.location-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;

                // Remove selected from all
                document.querySelectorAll('.location-btn').forEach(b =>
                    b.classList.remove('selected')
                );

                // Add selected to clicked
                target.classList.add('selected');

                // Store selection
                this.selectedLocation = {
                    lat: parseFloat(target.dataset.lat || '0'),
                    lon: parseFloat(target.dataset.lon || '0'),
                    name: target.dataset.name || 'Unknown'
                };
            });
        });

        // Mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;

                // Remove selected from all
                document.querySelectorAll('.mode-btn').forEach(b =>
                    b.classList.remove('selected')
                );

                // Add selected to clicked
                target.classList.add('selected');

                // Store selection
                this.selectedMode = target.dataset.mode as GameMode || 'free';
            });
        });

        // Start button
        const startBtn = document.getElementById('start-btn');
        startBtn?.addEventListener('click', () => {
            if (this.callbacks?.onStart) {
                this.callbacks.onStart(this.selectedLocation, this.selectedMode);
            }
        });

        // Pause menu buttons
        const resumeBtn = document.getElementById('resume-btn');
        resumeBtn?.addEventListener('click', () => {
            if (this.callbacks?.onResume) {
                this.callbacks.onResume();
            }
        });

        const restartBtn = document.getElementById('restart-btn');
        restartBtn?.addEventListener('click', () => {
            if (this.callbacks?.onRestart) {
                this.callbacks.onRestart();
            }
        });

        const quitBtn = document.getElementById('quit-btn');
        quitBtn?.addEventListener('click', () => {
            if (this.callbacks?.onQuit) {
                this.callbacks.onQuit();
            }
        });

        // Game over buttons
        const retryBtn = document.getElementById('retry-btn');
        retryBtn?.addEventListener('click', () => {
            if (this.callbacks?.onRestart) {
                this.callbacks.onRestart();
            }
        });

        const menuBtn = document.getElementById('menu-btn');
        menuBtn?.addEventListener('click', () => {
            if (this.callbacks?.onQuit) {
                this.callbacks.onQuit();
            }
        });
    }

    public setCallbacks(callbacks: MenuCallbacks): void {
        this.callbacks = callbacks;
    }

    public showStartMenu(): void {
        this.hideAll();
        this.startMenu?.classList.remove('hidden');
    }

    public hideStartMenu(): void {
        this.startMenu?.classList.add('hidden');
    }

    public showPauseMenu(): void {
        this.pauseMenu?.classList.remove('hidden');
    }

    public hidePauseMenu(): void {
        this.pauseMenu?.classList.add('hidden');
    }

    public showGameOver(score: number, distance: number, time: number): void {
        this.hideAll();

        // Update stats
        const finalScore = document.getElementById('final-score');
        const finalDistance = document.getElementById('final-distance');
        const finalTime = document.getElementById('final-time');

        if (finalScore) finalScore.textContent = score.toString();
        if (finalDistance) finalDistance.textContent = (distance / 1000).toFixed(1);
        if (finalTime) finalTime.textContent = this.formatTime(time);

        this.gameoverScreen?.classList.remove('hidden');
    }

    public hideGameOver(): void {
        this.gameoverScreen?.classList.add('hidden');
    }

    public showLoading(): void {
        this.loadingScreen?.classList.remove('hidden');
    }

    public hideLoading(): void {
        this.loadingScreen?.classList.add('hidden');
    }

    public updateLoadingProgress(percent: number): void {
        const progress = document.getElementById('loading-progress');
        if (progress) {
            progress.style.width = `${percent}%`;
        }
    }

    public hideAll(): void {
        this.startMenu?.classList.add('hidden');
        this.pauseMenu?.classList.add('hidden');
        this.gameoverScreen?.classList.add('hidden');
    }

    public getSelectedLocation(): { lat: number; lon: number; name: string } {
        return this.selectedLocation;
    }

    public getSelectedMode(): GameMode {
        return this.selectedMode;
    }

    private formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}
