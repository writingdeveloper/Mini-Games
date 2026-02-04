export class Minimap {
    private canvas: HTMLCanvasElement | null;
    private ctx: CanvasRenderingContext2D | null;
    private centerLon: number = 0;
    private centerLat: number = 0;
    private scale: number = 0.0001; // degrees per pixel

    constructor() {
        this.canvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
        this.ctx = this.canvas?.getContext('2d') || null;

        if (this.canvas) {
            // Set canvas resolution
            this.canvas.width = 150;
            this.canvas.height = 150;
        }
    }

    public setCenter(longitude: number, latitude: number): void {
        this.centerLon = longitude;
        this.centerLat = latitude;
    }

    public render(
        aircraftLon: number,
        aircraftLat: number,
        heading: number,
        checkpoints: Array<{ longitude: number; latitude: number; passed: boolean }>
    ): void {
        if (!this.ctx || !this.canvas) return;

        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;

        // Clear canvas
        this.ctx.fillStyle = 'rgba(0, 20, 40, 0.9)';
        this.ctx.fillRect(0, 0, width, height);

        // Draw grid
        this.drawGrid(width, height);

        // Draw checkpoints
        checkpoints.forEach(cp => {
            const x = centerX + (cp.longitude - aircraftLon) / this.scale;
            const y = centerY - (cp.latitude - aircraftLat) / this.scale;

            if (x >= 0 && x <= width && y >= 0 && y <= height) {
                this.ctx!.beginPath();
                this.ctx!.arc(x, y, 5, 0, Math.PI * 2);
                this.ctx!.fillStyle = cp.passed ? '#00ff88' : '#ff4444';
                this.ctx!.fill();
                this.ctx!.strokeStyle = '#fff';
                this.ctx!.lineWidth = 1;
                this.ctx!.stroke();
            }
        });

        // Draw aircraft trail (simplified - just show direction line)
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, centerY);
        const trailLength = 30;
        const trailX = centerX + Math.sin(heading) * trailLength;
        const trailY = centerY - Math.cos(heading) * trailLength;
        this.ctx.lineTo(trailX, trailY);
        this.ctx.strokeStyle = 'rgba(0, 212, 255, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw border
        this.ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(0, 0, width, height);
    }

    private drawGrid(width: number, height: number): void {
        if (!this.ctx) return;

        this.ctx.strokeStyle = 'rgba(0, 212, 255, 0.1)';
        this.ctx.lineWidth = 1;

        // Vertical lines
        for (let x = 0; x <= width; x += 30) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }

        // Horizontal lines
        for (let y = 0; y <= height; y += 30) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }

        // Center crosshair
        const centerX = width / 2;
        const centerY = height / 2;

        this.ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
        this.ctx.beginPath();
        this.ctx.moveTo(centerX - 10, centerY);
        this.ctx.lineTo(centerX + 10, centerY);
        this.ctx.moveTo(centerX, centerY - 10);
        this.ctx.lineTo(centerX, centerY + 10);
        this.ctx.stroke();
    }

    public setScale(scale: number): void {
        this.scale = scale;
    }

    public show(): void {
        const minimap = document.getElementById('minimap');
        if (minimap) {
            minimap.style.display = 'block';
        }
    }

    public hide(): void {
        const minimap = document.getElementById('minimap');
        if (minimap) {
            minimap.style.display = 'none';
        }
    }

    public toggle(): void {
        const minimap = document.getElementById('minimap');
        if (minimap) {
            const isHidden = minimap.style.display === 'none';
            minimap.style.display = isHidden ? 'block' : 'none';
        }
    }
}
