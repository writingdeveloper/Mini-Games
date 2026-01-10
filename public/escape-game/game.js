const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const gameScreen = document.getElementById('gameScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');
const scoreElement = document.getElementById('score');
const speedElement = document.getElementById('speed');
const finalScoreElement = document.getElementById('finalScore');
const gameOverReasonElement = document.getElementById('gameOverReason');

const GRID_SIZE = 20;
const TILE_SIZE = canvas.width / GRID_SIZE;

let car;
let policeCars;
let pedestrian;
let direction;
let nextDirection;
let gameLoop;
let score;
let speed;
let gameSpeed;

// 게임 초기화
function initGame() {
    car = { x: 10, y: 10 };
    policeCars = [];
    direction = { x: 0, y: 0 };
    nextDirection = { x: 0, y: 0 };
    score = 0;
    speed = 1;
    gameSpeed = 200;

    spawnPedestrian();
    updateUI();
}

// 행인 생성
function spawnPedestrian() {
    let validPosition = false;

    while (!validPosition) {
        pedestrian = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE)
        };

        // 자동차와 경찰차 위치가 아닌지 확인
        validPosition = true;
        if (pedestrian.x === car.x && pedestrian.y === car.y) {
            validPosition = false;
        }

        for (let police of policeCars) {
            if (pedestrian.x === police.x && pedestrian.y === police.y) {
                validPosition = false;
                break;
            }
        }
    }
}

// 키보드 입력 처리
document.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'ArrowUp':
            if (direction.y === 0) {
                nextDirection = { x: 0, y: -1 };
            }
            e.preventDefault();
            break;
        case 'ArrowDown':
            if (direction.y === 0) {
                nextDirection = { x: 0, y: 1 };
            }
            e.preventDefault();
            break;
        case 'ArrowLeft':
            if (direction.x === 0) {
                nextDirection = { x: -1, y: 0 };
            }
            e.preventDefault();
            break;
        case 'ArrowRight':
            if (direction.x === 0) {
                nextDirection = { x: 1, y: 0 };
            }
            e.preventDefault();
            break;
    }
});

// 게임 업데이트
function update() {
    // 방향 업데이트
    direction = nextDirection;

    // 움직이지 않으면 업데이트 안함
    if (direction.x === 0 && direction.y === 0) {
        return;
    }

    // 경찰차 업데이트 (뒤에서부터)
    for (let i = policeCars.length - 1; i > 0; i--) {
        policeCars[i] = { ...policeCars[i - 1] };
    }

    if (policeCars.length > 0) {
        policeCars[0] = { x: car.x, y: car.y };
    }

    // 자동차 이동
    car.x += direction.x;
    car.y += direction.y;

    // 벽 충돌 체크
    if (car.x < 0 || car.x >= GRID_SIZE || car.y < 0 || car.y >= GRID_SIZE) {
        endGame('벽에 충돌했습니다!');
        return;
    }

    // 경찰차 충돌 체크
    for (let police of policeCars) {
        if (car.x === police.x && car.y === police.y) {
            endGame('경찰차에 잡혔습니다!');
            return;
        }
    }

    // 행인과 충돌 체크
    if (car.x === pedestrian.x && car.y === pedestrian.y) {
        score++;
        policeCars.push({ x: car.x, y: car.y });
        spawnPedestrian();

        // 속도 증가 (5점마다)
        if (score % 5 === 0) {
            speed++;
            gameSpeed = Math.max(50, 200 - (speed - 1) * 15);
            clearInterval(gameLoop);
            gameLoop = setInterval(gameStep, gameSpeed);
        }

        updateUI();
        flashScreen();
    }
}

// 화면 깜빡임 효과
function flashScreen() {
    canvas.style.opacity = '0.5';
    setTimeout(() => {
        canvas.style.opacity = '1';
    }, 100);
}

// 그리기
function draw() {
    // 배경
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 그리드
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * TILE_SIZE, 0);
        ctx.lineTo(i * TILE_SIZE, canvas.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * TILE_SIZE);
        ctx.lineTo(canvas.width, i * TILE_SIZE);
        ctx.stroke();
    }

    // 행인 (🚶)
    ctx.fillStyle = '#ff6b6b';
    ctx.font = `${TILE_SIZE * 0.8}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚶',
        pedestrian.x * TILE_SIZE + TILE_SIZE / 2,
        pedestrian.y * TILE_SIZE + TILE_SIZE / 2
    );

    // 경찰차 (🚓)
    ctx.fillStyle = '#4dabf7';
    for (let police of policeCars) {
        ctx.fillText('🚓',
            police.x * TILE_SIZE + TILE_SIZE / 2,
            police.y * TILE_SIZE + TILE_SIZE / 2
        );
    }

    // 자동차 (🚗)
    ctx.fillStyle = '#51cf66';
    ctx.fillText('🚗',
        car.x * TILE_SIZE + TILE_SIZE / 2,
        car.y * TILE_SIZE + TILE_SIZE / 2
    );
}

// 게임 스텝
function gameStep() {
    update();
    draw();
}

// UI 업데이트
function updateUI() {
    scoreElement.textContent = score;
    speedElement.textContent = speed;
}

// 게임 종료
function endGame(reason) {
    clearInterval(gameLoop);
    finalScoreElement.textContent = score;
    gameOverReasonElement.textContent = reason;

    gameScreen.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
}

// 게임 시작
function startGame() {
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    initGame();
    draw();
    gameLoop = setInterval(gameStep, gameSpeed);
}

// 이벤트 리스너
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);

// 초기 화면
startScreen.classList.remove('hidden');
