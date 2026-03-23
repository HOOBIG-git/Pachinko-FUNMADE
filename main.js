// main.js
import { Board } from './Board.js';
import { Shooter } from './shooter.js'; // ★Shooter.jsファイル名の大文字小文字に注意してください

const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Events = Matter.Events,
      Composite = Matter.Composite;

const engine = Engine.create();
const canvasWidth = 500;
const canvasHeight = 700;

const render = Render.create({
    element: document.getElementById('game-container'),
    engine: engine,
    options: {
        width: canvasWidth,
        height: canvasHeight,
        wireframes: false,
        background: 'transparent',
        pixelRatio: window.devicePixelRatio
    }
});

const board = new Board(engine.world, canvasWidth, canvasHeight);
board.build();

const shooter = new Shooter(engine.world, 32, 650); 

let isShooting = false;
let lastShotTime = 0;
let ballCount = 100;
let startCount = 0;
let isJackpot = false;
let isSpinning = false; 
let reserveCount = 0;   
const MAX_RESERVE = 4;  
const jackpotProbability = 0.1; 
let currentPower = 50;

const ballCountEl = document.getElementById('ball-count');
const startCountEl = document.getElementById('start-count');
const reserveCountEl = document.getElementById('reserve-count'); 
const powerBarFill = document.getElementById('power-bar-fill');
const slotEls = [
    document.getElementById('slot-1'),
    document.getElementById('slot-2'),
    document.getElementById('slot-3')
];
const jackpotMsgEl = document.getElementById('jackpot-message');

function updatePower(change) {
    currentPower += change;
    if (currentPower < 0) currentPower = 0;
    if (currentPower > 100) currentPower = 100;
    if (powerBarFill) powerBarFill.style.height = currentPower + '%';
}

function handleFire() {
    const now = Date.now();
    if (now - lastShotTime < shooter.SHOOT_COOLDOWN) return;
    
    // 発射レーンに玉がないかチェック
    const balls = Composite.allBodies(engine.world).filter(b => b.label === 'ball');
    const isBallInLane = balls.some(b => b.position.x < 60 && b.position.y > 20);

    if (!isBallInLane) {
        const result = shooter.fire(currentPower, ballCount);
        if (result.fired) {
            ballCount -= result.ballsUsed;
            if (ballCountEl) ballCountEl.innerText = ballCount;
            lastShotTime = now;
        }
    }
}

function checkAndSpin() {
    if (isSpinning || isJackpot || reserveCount <= 0) return;

    reserveCount--;
    reserveCountEl.innerText = reserveCount;
    isSpinning = true;

    const isWin = Math.random() < jackpotProbability;
    let leftNum, rightNum, centerNum;

    if (isWin) {
        leftNum = Math.floor(Math.random() * 9) + 1;
        rightNum = leftNum;
        centerNum = leftNum;
    } else {
        leftNum = Math.floor(Math.random() * 9) + 1;
        if (Math.random() < 0.2) {
            rightNum = leftNum;
            do { centerNum = Math.floor(Math.random() * 9) + 1; } while (centerNum === leftNum);
        } else {
            do { rightNum = Math.floor(Math.random() * 9) + 1; } while (rightNum === leftNum);
            centerNum = Math.floor(Math.random() * 9) + 1;
        }
    }

    let shuffleInterval = setInterval(() => {
        slotEls.forEach(el => el.innerText = Math.floor(Math.random() * 9) + 1);
    }, 50);

    setTimeout(() => { slotEls[0].innerText = leftNum; }, 1000);
    setTimeout(() => {
        slotEls[2].innerText = rightNum;
        if (leftNum === rightNum) {
            slotEls[1].style.color = '#ff0055'; 
            setTimeout(() => {
                clearInterval(shuffleInterval);
                slotEls[1].innerText = centerNum;
                slotEls[1].style.color = '#fff'; 
                finishSpin(isWin);
            }, 4500); 
        } else {
            setTimeout(() => {
                clearInterval(shuffleInterval);
                slotEls[1].innerText = centerNum;
                finishSpin(isWin);
            }, 2500);
        }
    }, 2000);
}

function finishSpin(isWin) {
    if (isWin) {
        triggerJackpot();
    } else {
        isSpinning = false;
        checkAndSpin(); 
    }
}

function triggerJackpot() {
    isJackpot = true;
    jackpotMsgEl.style.display = 'block';

    // ★アタッカーを開く
    Matter.Body.setAngle(board.attackerLid, Math.PI / 180 * 45);
    board.attackerLid.render.fillStyle = '#ff0000';

    setTimeout(() => {
        jackpotMsgEl.style.display = 'none';
        isJackpot = false;
        isSpinning = false;
        slotEls.forEach(el => el.innerText = '0');

        // ★アタッカーを閉じる
        Matter.Body.setAngle(board.attackerLid, 0);
        board.attackerLid.render.fillStyle = '#00ff00';

        checkAndSpin(); 
    }, 10000); 
}

// 操作関連
window.addEventListener('mousedown', (e) => { if(e.button === 0) isShooting = true; });
window.addEventListener('mouseup', (e) => { if(e.button === 0) isShooting = false; });
window.addEventListener('mouseleave', () => { isShooting = false; });
window.addEventListener('wheel', (event) => {
    if (event.deltaY < 0) updatePower(5); else updatePower(-5);
});
window.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') isShooting = true;
    else if (event.key === 'ArrowUp') { updatePower(5); event.preventDefault(); }
    else if (event.key === 'ArrowDown') { updatePower(-5); event.preventDefault(); }
});
window.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') isShooting = false;
});

Events.on(engine, 'beforeUpdate', () => {
    if (isShooting) handleFire();
});

Events.on(engine, 'collisionStart', function(event) {
    event.pairs.forEach((pair) => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        // チャッカー（ヘソ）入賞
        if ((bodyA.label === 'ball' && bodyB.label === 'chucker') ||
            (bodyB.label === 'ball' && bodyA.label === 'chucker')) {
            startCount++;
            if (startCountEl) startCountEl.innerText = startCount;
            ballCount += 3; 
            if (ballCountEl) ballCountEl.innerText = ballCount;
            if (reserveCount < MAX_RESERVE) {
                reserveCount++;
                reserveCountEl.innerText = reserveCount;
                checkAndSpin(); 
            }
            const ballToRemove = bodyA.label === 'ball' ? bodyA : bodyB;
            if (ballToRemove) Composite.remove(engine.world, ballToRemove);
        }

        // アタッカー（右打ち）入賞
        if ((bodyA.label === 'ball' && bodyB.label === 'attacker') ||
            (bodyB.label === 'ball' && bodyA.label === 'attacker')) {
            ballCount += 15; // 15発の賞球
            if (ballCountEl) ballCountEl.innerText = ballCount;
            const ballToRemove = bodyA.label === 'ball' ? bodyA : bodyB;
            if (ballToRemove) Composite.remove(engine.world, ballToRemove);
        }

        // アウト穴
        if (bodyA.label === 'out' || bodyB.label === 'out') {
            const ballToRemove = bodyA.label === 'ball' ? bodyA : bodyB;
            if (ballToRemove) {
                Composite.remove(engine.world, ballToRemove);
                if (ballToRemove.position.x < 100) {
                    ballCount++; 
                    if (ballCountEl) ballCountEl.innerText = ballCount;
                }
            }
        }
    });
});

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);