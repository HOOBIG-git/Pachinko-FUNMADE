// main.js
import { Board } from './Board.js';
import { Shooter } from './shooter.js'; 
import { Sound } from './sound.js'; 

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
const sound = new Sound(); 

let isShooting = false;
let lastShotTime = 0;
let ballCount = 100;
let startCount = 0;
let isJackpot = false;
let isSpinning = false; 

// 保留データ（当たりかハズレか、何色か）を管理する配列
let reserves = []; 
const MAX_RESERVE = 4;  
const jackpotProbability = 0.1; 
let currentPower = 50;

// ラウンド管理用の変数
let currentRound = 0;
let currentCount = 0;
const MAX_ROUND = 15; 
const MAX_COUNT = 10; 
let roundTimer;       

const jackpotOverlayEl = document.getElementById('jackpot-overlay');
const flashOverlayEl = document.getElementById('flash-overlay');
const roundDisplayEl = document.getElementById('round-display');
const countDisplayEl = document.getElementById('count-display');
const jackpotInfoEl = document.getElementById('jackpot-info');
const ballCountEl = document.getElementById('ball-count');
const startCountEl = document.getElementById('start-count');
const reserveIcons = document.querySelectorAll('.reserve-icon'); 
const powerBarFill = document.getElementById('power-bar-fill');
const slotEls = [
    document.getElementById('slot-1'),
    document.getElementById('slot-2'),
    document.getElementById('slot-3')
];
const jackpotMsgEl = document.getElementById('jackpot-message');

// 保留配列の中身に合わせてランプの色を更新する関数
function updateReserveUI() {
    reserveIcons.forEach((icon, index) => {
        icon.className = 'reserve-icon'; // 一旦リセット
        if (index < reserves.length) {
            icon.classList.add(`res-${reserves[index].color}`);
        }
    });
}

function updatePower(change) {
    currentPower += change;
    if (currentPower < 0) currentPower = 0;
    if (currentPower > 100) currentPower = 100;
    if (powerBarFill) powerBarFill.style.height = currentPower + '%';
}

function handleFire() {
    const now = Date.now();
    if (now - lastShotTime < shooter.SHOOT_COOLDOWN) return;
    
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

// 先読み抽選結果を使ってスロットを回す
function checkAndSpin() {
    if (isSpinning || isJackpot || reserves.length === 0) return;

    // 保留配列の先頭を取り出してUIを更新
    const currentData = reserves.shift(); 
    updateReserveUI(); 
    
    isSpinning = true;
    const isWin = currentData.isWin; 

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
            // ★★★ リーチ（テンパイ）の瞬間！演出発動！ ★★★
            slotEls[1].style.color = '#ff0055'; 
            
            // リーチ音（キーン！＋心音）を鳴らす
            if(typeof sound !== 'undefined' && typeof sound.playReach === 'function') {
                sound.playReach();
            }
            
            // 盤面と液晶を真っ赤に染める（CSSクラスを追加）
            document.getElementById('game-container').classList.add('reach-board-effect');
            document.getElementById('digital-screen').classList.add('reach-slot-effect');

            setTimeout(() => {
                clearInterval(shuffleInterval);
                slotEls[1].innerText = centerNum;
                slotEls[1].style.color = '#fff'; 
                
                // ★ 真ん中が止まったら、真っ赤な演出を解除する（元に戻す）
                document.getElementById('game-container').classList.remove('reach-board-effect');
                document.getElementById('digital-screen').classList.remove('reach-slot-effect');

                finishSpin(isWin);
            }, 8000); 
        } else {
            // ハズレ（テンパイしなかった時）
            setTimeout(() => {
                clearInterval(shuffleInterval);
                slotEls[1].innerText = centerNum;
                finishSpin(isWin);
            }, 2500);
        }
    }, 2000);
}

// main.js の finishSpin 関数を上書き

function finishSpin(isWin) {
    if (isWin) {
        triggerJackpot();
    } else {
        // ★大正解の修正：ハズレ確定後、1秒間（1000ミリ秒）数字を見せてから次へ進む
        setTimeout(() => {
            isSpinning = false;
            checkAndSpin(); 
        }, 1000); // ここを 1500 などにすればさらに長く待てます
    }
}
function triggerJackpot() {
    isJackpot = true;
    document.body.classList.add('mega-shake');
    if (flashOverlayEl) flashOverlayEl.classList.add('flash-effect');
    if (flashOverlayEl) flashOverlayEl.style.display = 'block';

    jackpotMsgEl.style.display = 'block';
    jackpotInfoEl.style.display = 'none'; 
    
    if(typeof sound !== 'undefined') sound.playMegaJackpot();
    currentRound = 1;

    setTimeout(() => {
        jackpotMsgEl.style.display = 'none';
        jackpotInfoEl.style.display = 'block'; 
        
        document.body.classList.remove('mega-shake');
        if (flashOverlayEl) flashOverlayEl.classList.remove('flash-effect');
        if (flashOverlayEl) flashOverlayEl.style.display = 'none';

        startRound(); 
    }, 3000); 
}

function startRound() {
    currentCount = 0; 
    roundDisplayEl.innerText = currentRound;
    countDisplayEl.innerText = currentCount;

    if (jackpotOverlayEl) jackpotOverlayEl.style.display = 'block';

    board.attackerLid.isSensor = true;
    board.attackerLid.render.visible = false;

    roundTimer = setTimeout(endRound, 15000);
}

function endRound() {
    clearTimeout(roundTimer); 

    if (jackpotOverlayEl) jackpotOverlayEl.style.display = 'none';

    board.attackerLid.isSensor = false;
    board.attackerLid.render.visible = true;

    if (currentRound < MAX_ROUND) {
        currentRound++;
        setTimeout(startRound, 2000); 
    } 
    else {
        setTimeout(() => {
            isJackpot = false;
            isSpinning = false;
            jackpotMsgEl.style.display = 'none';
            jackpotInfoEl.style.display = 'none';
            slotEls.forEach(el => el.innerText = '0');
            checkAndSpin(); 
        }, 3000); 
    }
}

// 操作関連（スマホタッチ対応版）
window.addEventListener('mousedown', (e) => { 
    if(e.button === 0) isShooting = true;
    if(typeof sound !== 'undefined') sound.init();
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

const btnShoot = document.getElementById('btn-shoot');
const btnPowerUp = document.getElementById('btn-power-up');
const btnPowerDown = document.getElementById('btn-power-down');

if (btnShoot) {
    btnShoot.addEventListener('touchstart', (e) => {
        e.preventDefault(); 
        isShooting = true;
        if(typeof sound !== 'undefined') sound.init();
    });
    btnShoot.addEventListener('touchend', (e) => {
        e.preventDefault();
        isShooting = false;
    });
}
if (btnPowerUp) {
    btnPowerUp.addEventListener('touchstart', (e) => { e.preventDefault(); updatePower(5); });
    btnPowerUp.addEventListener('mousedown', () => { updatePower(5); }); 
}
if (btnPowerDown) {
    btnPowerDown.addEventListener('touchstart', (e) => { e.preventDefault(); updatePower(-5); });
    btnPowerDown.addEventListener('mousedown', () => { updatePower(-5); }); 
}

// 毎フレームの更新イベント
Events.on(engine, 'beforeUpdate', () => {
    if (isShooting) handleFire();
});

// 衝突判定イベント
Events.on(engine, 'collisionStart', function(event) {
    event.pairs.forEach((pair) => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        if ((bodyA.label === 'ball' && bodyB.label === 'peg') ||
            (bodyB.label === 'ball' && bodyA.label === 'peg')) {
            if(typeof sound !== 'undefined') sound.playPegHit();
        }

        // --- チャッカー（ヘソ）入賞 ---
        if ((bodyA.label === 'ball' && bodyB.label === 'chucker') ||
            (bodyB.label === 'ball' && bodyA.label === 'chucker')) {
            if(typeof sound !== 'undefined') sound.playChuckerIn();
            startCount++;
            if (startCountEl) startCountEl.innerText = startCount;
            ballCount += 3; 
            if (ballCountEl) ballCountEl.innerText = ballCount;
            
            // 先読み抽選と保留変化システム
            if (reserves.length < MAX_RESERVE) {
                const isWin = Math.random() < jackpotProbability;
                let color = 'white'; 
                
                if (isWin) {
                    color = Math.random() < 0.7 ? 'red' : 'green';
                } else {
                    const r = Math.random();
                    if (r < 0.05) color = 'green';
                    else if (r < 0.20) color = 'blue';
                }
                
                reserves.push({ isWin: isWin, color: color });
                updateReserveUI(); 
                checkAndSpin(); 
            }
            
            const ballToRemove = bodyA.label === 'ball' ? bodyA : bodyB;
            if (ballToRemove) Composite.remove(engine.world, ballToRemove);
        }

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

        if ((bodyA.label === 'ball' && bodyB.label === 'through') ||
            (bodyB.label === 'ball' && bodyA.label === 'through')) {
            
            board.denchuLid.isSensor = true;
            board.denchuLid.render.visible = false;
            if(typeof sound !== 'undefined') sound.playChuckerIn();

            setTimeout(() => {
                board.denchuLid.isSensor = false;
                board.denchuLid.render.visible = true;
            }, 1500);
        }
        
        if ((bodyA.label === 'ball' && bodyB.label === 'denchu') ||
            (bodyB.label === 'ball' && bodyA.label === 'denchu')) {
            
            if (flashOverlayEl) flashOverlayEl.style.display = 'block';
            setTimeout(() => {
                if (flashOverlayEl) flashOverlayEl.style.display = 'none';
            }, 100);

            if (isJackpot) return;

            ballCount += 1;
            if (ballCountEl) ballCountEl.innerText = ballCount;
            if(typeof sound !== 'undefined') sound.playChuckerIn();

            if (!isJackpot && Math.random() < 0.81) {
                triggerJackpot(); 
            }

            const ballToRemove = bodyA.label === 'ball' ? bodyA : bodyB;
            if (ballToRemove) Composite.remove(engine.world, ballToRemove);
        }    

        if ((bodyA.label === 'ball' && bodyB.label === 'attacker') ||
            (bodyB.label === 'ball' && bodyA.label === 'attacker')) {
            
            if (flashOverlayEl) flashOverlayEl.style.display = 'block';
            setTimeout(() => {
                if (flashOverlayEl) flashOverlayEl.style.display = 'none';
            }, 100);

            ballCount += 15; 
            if (ballCountEl) ballCountEl.innerText = ballCount;
            if(typeof sound !== 'undefined') sound.playAttackerHit();
            
            if (isJackpot) {
                currentCount++;
                if (countDisplayEl) countDisplayEl.innerText = currentCount;

                if (currentCount >= MAX_COUNT) {
                    endRound();
                }
            }

            if (ballCountEl) ballCountEl.style.textShadow = '0 0 15px #ffcc00, 0 0 30px #ffcc00';
            setTimeout(() => {
                if (ballCountEl) ballCountEl.style.textShadow = ''; 
            }, 100);

            const ballToRemove = bodyA.label === 'ball' ? bodyA : bodyB;
            if (ballToRemove) Composite.remove(engine.world, ballToRemove);
        }
    });
});

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);