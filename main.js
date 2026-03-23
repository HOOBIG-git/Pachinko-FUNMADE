// main.js
import { Board } from './Board.js';
import { Shooter } from './shooter.js'; // ★Shooter.jsファイル名の大文字小文字に注意してください
import { Sound } from './sound.js'; // ★追加：Soundクラスをインポート

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
const sound = new Sound(); // ★追加：サウンドエンジンを生成

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

// main.js の triggerJackpot() 関数を上書き

// 大当たり演出
function triggerJackpot() {
    isJackpot = true;
    jackpotMsgEl.style.display = 'block';
    if(typeof sound !== 'undefined') sound.playJackpot();

    // ★アタッカーを開く（フタを画面外へ消し飛ばす）
    Matter.Body.setPosition(board.attackerLid, { x: -1000, y: -1000 }); 

    setTimeout(() => {
        jackpotMsgEl.style.display = 'none';
        isJackpot = false;
        isSpinning = false;
        slotEls.forEach(el => el.innerText = '0');

        // ★アタッカーを閉じる（元の座標 x: 415, y: 580 に戻す）
        // ※Board.jsで設定した元のY座標が580なら580、585なら585に合わせてください
        Matter.Body.setPosition(board.attackerLid, { x: 415, y: 580 });

        checkAndSpin(); // 大当たり終了後に保留があれば回す
    }, 10000); 
}
// 操作関連
window.addEventListener('mousedown', (e) => { 
    if(e.button === 0) isShooting = true;
    sound.init(); // ★追加：クリックで音声エンジンを起動（ブラウザの仕様対策）
 });
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

        // ★追加：玉が釘（peg）に当たったら音を鳴らす
        if ((bodyA.label === 'ball' && bodyB.label === 'peg') ||
            (bodyB.label === 'ball' && bodyA.label === 'peg')) {
            sound.playPegHit();
        }

        // チャッカー（ヘソ）入賞
        if ((bodyA.label === 'ball' && bodyB.label === 'chucker') ||
            (bodyB.label === 'ball' && bodyA.label === 'chucker')) {
            sound.playChuckerIn(); // ★追加：チャッカー入賞音を鳴らす
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

        // main.js の collisionStart イベント内に追加

        // --- スルーチャッカー通過（電チューを開く＝フタを消す） ---
        if ((bodyA.label === 'ball' && bodyB.label === 'through') ||
            (bodyB.label === 'ball' && bodyA.label === 'through')) {
            
            // ★フタを画面外に飛ばして物理的に「消す」
            Matter.Body.setPosition(board.denchuLid, { x: -1000, y: -1000 });
            if(typeof sound !== 'undefined') sound.playChuckerIn();

            // 1.5秒後に元の位置（x: 415, y: 450）に戻して「閉じる」
            setTimeout(() => {
                Matter.Body.setPosition(board.denchuLid, { x: 415, y: 450 });
            }, 1500);
        }
        // --- ★新規追加：電チュー入賞（RUSHの大当たり判定） ---
        if ((bodyA.label === 'ball' && bodyB.label === 'denchu') ||
            (bodyB.label === 'ball' && bodyA.label === 'denchu')) {
            
            ballCount += 1; // 電チュー自体の賞球は1個
            if (ballCountEl) ballCountEl.innerText = ballCount;
            sound.playChuckerIn();

            // ★RUSH中の大当たり抽選（エヴァ15なら継続率約81%！）
            if (!isJackpot && Math.random() < 0.81) {
                // アタッカーを即座に開く
                triggerJackpot();
            }

            const ballToRemove = bodyA.label === 'ball' ? bodyA : bodyB;
            if (ballToRemove) Composite.remove(engine.world, ballToRemove);
        }

        // （※この下に元からある「アタッカー入賞」「アウト穴」の処理が続きます）
    });
});

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);