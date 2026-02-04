import { FlightGame } from './game/FlightGame';

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Sky Explorer - Initializing...');

    // Create and initialize game
    const game = new FlightGame();

    try {
        await game.initialize();
        console.log('Game initialized successfully!');
    } catch (error) {
        console.error('Failed to initialize game:', error);
    }

    // Handle page unload
    window.addEventListener('beforeunload', () => {
        game.destroy();
    });
});
