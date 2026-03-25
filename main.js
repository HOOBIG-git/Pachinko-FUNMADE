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

// ★ ゲームモード管理 ('normal' | 'tanjun' | 'st')
let gameMode = 'normal';
let modeSpinsLeft = 0;

// ★ 大当たり確率
const JACKPOT_PROB_NORMAL = 1 / 319;
const JACKPOT_PROB_ST     = 1 / 99;

// 保留データを管理する配列
let reserves = []; 
const MAX_RESERVE = 4;  
let currentPower = 50;

// ラウンド管理
let currentRound = 0;
let currentCount = 0;
const MAX_ROUND = 15; 
const MAX_COUNT = 10; 
let roundTimer;       

// --- DOM参照 ---
const jackpotOverlayEl  = document.getElementById('jackpot-overlay');
const flashOverlayEl    = document.getElementById('flash-overlay');
const roundDisplayEl    = document.getElementById('round-display');
const countDisplayEl    = document.getElementById('count-display');
const jackpotInfoEl     = document.getElementById('jackpot-info');
const ballCountEl       = document.getElementById('ball-count');
const startCountEl      = document.getElementById('start-count');
const reserveIcons      = document.querySelectorAll('.reserve-icon'); 
const powerBarFill      = document.getElementById('power-bar-fill');
const jackpotMsgEl      = document.getElementById('jackpot-message');
const canvasEl          = document.querySelector('canvas');
// ★ 追加DOM
const modeDisplayEl     = document.getElementById('mode-display');
const modeNameEl        = document.getElementById('mode-name');
const modeSpinsLeftEl   = document.getElementById('mode-spins-left');

const slotEls = [
    document.getElementById('slot-1'),
    document.getElementById('slot-2'),
    document.getElementById('slot-3')
];

// ★ 大当たり確率をモードに応じて返す
function getJackpotProbability() {
    return gameMode === 'st' ? JACKPOT_PROB_ST : JACKPOT_PROB_NORMAL;
}

// ★ モードに応じて盤面・パネルの見た目を切り替える
function applyModeVisuals() {
    document.body.classList.remove('mode-st', 'mode-tanjun');
    if (jackpotOverlayEl) {
        jackpotOverlayEl.classList.remove('rainbow-effect', 'st-effect', 'tanjun-effect');
        jackpotOverlayEl.style.display = 'none';
    }

    if (gameMode === 'st') {
        document.body.classList.add('mode-st');
        if (jackpotOverlayEl) {
            jackpotOverlayEl.classList.add('st-effect');
            jackpotOverlayEl.style.display = 'block';
        }
        if (modeNameEl)     modeNameEl.innerText = '🔥 IMPACT MODE';
        if (modeDisplayEl)  modeDisplayEl.style.display = 'block';
    } else if (gameMode === 'tanjun') {
        document.body.classList.add('mode-tanjun');
        if (jackpotOverlayEl) {
            jackpotOverlayEl.classList.add('tanjun-effect');
            jackpotOverlayEl.style.display = 'block';
        }
        if (modeNameEl)     modeNameEl.innerText = '⚡ TIME SAVING';
        if (modeDisplayEl)  modeDisplayEl.style.display = 'block';
    } else {
        if (modeDisplayEl)  modeDisplayEl.style.display = 'none';
    }
}

// ★ 残り回転数を1減らし、0になったらモード終了
function countDownSpin() {
    if (gameMode === 'normal') return;
    modeSpinsLeft--;
    if (modeSpinsLeftEl) modeSpinsLeftEl.innerText = modeSpinsLeft;
    if (modeSpinsLeft <= 0) endMode();
}

// ★ モード終了処理
function endMode() {
    gameMode = 'normal';
    modeSpinsLeft = 0;
    // 電チューのフタを閉じる
    board.denchuLid.isSensor = false;
    board.denchuLid.render.visible = true;
    applyModeVisuals();
}

// 保留UIの更新
function updateReserveUI() {
    reserveIcons.forEach((icon, index) => {
        icon.className = 'reserve-icon';
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

// ★ 保留を積む共通処理（ヘソ・電チュー両方から呼ぶ）
function addReserve() {
    if (reserves.length >= MAX_RESERVE || isJackpot) return;

    const isWin = Math.random() < getJackpotProbability();
    let color = 'white'; 
    
    if (isWin) {
        color = Math.random() < 0.7 ? 'red' : 'green';
    } else {
        const r = Math.random();
        if (r < 0.05)       color = 'green';
        else if (r < 0.20)  color = 'blue';
    }
    
    reserves.push({ isWin, color });
    updateReserveUI(); 
    checkAndSpin(); 
}

function checkAndSpin() {
    if (isSpinning || isJackpot || reserves.length === 0) return;

    const currentData = reserves.shift(); 
    updateReserveUI(); 
    
    isSpinning = true;

    // ★ 変動のたびに残り回転数を減らす
    countDownSpin();

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

// ★ モードに応じて変動時間を切り替える
    const isRush = (gameMode === 'st' || gameMode === 'tanjun');
    const leftStopTime  = isRush ? 500  : 1000; // 左図柄が止まるまでの時間
    const rightStopTime = isRush ? 1000 : 2000; // 右図柄が止まるまでの時間
    const reachWaitTime = isRush ? 3000 : 8000; // リーチ後に中図柄が止まるまでの時間
    const hazureWaitTime= isRush ? 1000 : 2500; // ハズレ確定までの時間

    setTimeout(() => { slotEls[0].innerText = leftNum; }, leftStopTime);
    setTimeout(() => {
        slotEls[2].innerText = rightNum;
        if (leftNum === rightNum) {
            slotEls[1].style.color = '#ff0055'; 
            sound.playReach();
            document.getElementById('game-container').classList.add('reach-board-effect');
            document.getElementById('digital-screen').classList.add('reach-slot-effect');
            setTimeout(() => {
                clearInterval(shuffleInterval);
                slotEls[1].innerText = centerNum;
                slotEls[1].style.color = '#fff'; 
                document.getElementById('game-container').classList.remove('reach-board-effect');
                document.getElementById('digital-screen').classList.remove('reach-slot-effect');
                finishSpin(isWin);
            }, reachWaitTime); 
        } else {
            setTimeout(() => {
                clearInterval(shuffleInterval);
                slotEls[1].innerText = centerNum;
                finishSpin(isWin);
            }, hazureWaitTime);
        }
    }, rightStopTime);
}

function finishSpin(isWin) {
    if (isWin) {
        triggerJackpot();
    } else {
        setTimeout(() => {
            isSpinning = false;
            checkAndSpin(); 
        }, 1000);
    }
}

function triggerJackpot() {
    isJackpot = true;

    // ★ 大当たり中はモードオーバーレイを一旦消す
    if (jackpotOverlayEl) {
        jackpotOverlayEl.classList.remove('st-effect', 'tanjun-effect');
        jackpotOverlayEl.style.display = 'none';
    }

    document.body.classList.add('mega-shake');
    if (flashOverlayEl) flashOverlayEl.classList.add('flash-effect');
    if (flashOverlayEl) flashOverlayEl.style.display = 'block';

    jackpotMsgEl.style.display = 'block';
    jackpotInfoEl.style.display = 'none'; 
    
    sound.playMegaJackpot();
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

    if (jackpotOverlayEl) {
        jackpotOverlayEl.classList.remove('st-effect', 'tanjun-effect');
        jackpotOverlayEl.classList.add('rainbow-effect');
        jackpotOverlayEl.style.display = 'block';
    }

    board.attackerLid.isSensor = true;
    board.attackerLid.render.visible = false;

    roundTimer = setTimeout(endRound, 15000);
}

function endRound() {
    clearTimeout(roundTimer); 

    if (jackpotOverlayEl) {
        jackpotOverlayEl.classList.remove('rainbow-effect');
        jackpotOverlayEl.style.display = 'none';
    }

    board.attackerLid.isSensor = false;
    board.attackerLid.render.visible = true;

    if (currentRound < MAX_ROUND) {
        currentRound++;
        setTimeout(startRound, 2000); 
    } else {
        // ★ 全ラウンド終了 → 59%で確変(ST)、41%で時短に分岐
        setTimeout(() => {
            isJackpot = false;
            isSpinning = false;
            jackpotMsgEl.style.display = 'none';
            jackpotInfoEl.style.display = 'none';
            slotEls.forEach(el => el.innerText = '0');

            if (Math.random() < 0.59) {
                gameMode = 'st';
                modeSpinsLeft = 163;
            } else {
                gameMode = 'tanjun';
                modeSpinsLeft = 100;
            }

            // ★ ST/時短中は電チューを常時開放
            board.denchuLid.isSensor = true;
            board.denchuLid.render.visible = false;

            if (modeSpinsLeftEl) modeSpinsLeftEl.innerText = modeSpinsLeft;
            applyModeVisuals();
            checkAndSpin(); 
        }, 3000); 
    }
}

// --- 操作イベント ---
window.addEventListener('mousedown', (e) => { 
    if(e.button === 0) isShooting = true;
    sound.init();
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

// --- タッチ操作（スマホ用） ---
let touchStartY = 0;

// 画面タップ長押し → 発射
window.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    isShooting = true;
    sound.init();
}, { passive: true });

window.addEventListener('touchend', () => {
    isShooting = false;
});

// 上下スワイプ → パワー調整
window.addEventListener('touchmove', (e) => {
    const currentY = e.touches[0].clientY;
    const deltaY = touchStartY - currentY; // 上スワイプ = 正の値

    if (Math.abs(deltaY) > 10) {
        updatePower(deltaY > 0 ? 3 : -3);
        touchStartY = currentY; // 基準点を更新（連続スワイプ対応）
    }
}, { passive: true });

// PCボタンは念のため残す（スマホでは非表示）
const btnPowerUp   = document.getElementById('btn-power-up');
const btnPowerDown = document.getElementById('btn-power-down');
if (btnPowerUp)   btnPowerUp.addEventListener('mousedown',   () => { updatePower(5);  });
if (btnPowerDown) btnPowerDown.addEventListener('mousedown', () => { updatePower(-5); });
Events.on(engine, 'beforeUpdate', () => {
    if (isShooting) handleFire();
});

// --- 衝突判定 ---
Events.on(engine, 'collisionStart', function(event) {
    event.pairs.forEach((pair) => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        if ((bodyA.label === 'ball' && bodyB.label === 'peg') ||
            (bodyB.label === 'ball' && bodyA.label === 'peg')) {
            sound.playPegHit();
        }

        // ヘソ入賞
        if ((bodyA.label === 'ball' && bodyB.label === 'chucker') ||
            (bodyB.label === 'ball' && bodyA.label === 'chucker')) {
            sound.playChuckerIn();
            startCount++;
            if (startCountEl) startCountEl.innerText = startCount;
            ballCount += 3; 
            if (ballCountEl) ballCountEl.innerText = ballCount;
            addReserve();

            const ballToRemove = bodyA.label === 'ball' ? bodyA : bodyB;
            if (ballToRemove) Composite.remove(engine.world, ballToRemove);
        }

        // アウト処理
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

        // スルーチャッカー
        if ((bodyA.label === 'ball' && bodyB.label === 'through') ||
            (bodyB.label === 'ball' && bodyA.label === 'through')) {
            // ★ ST/時短中は電チューが常時開放なので処理不要
            if (gameMode === 'normal') {
                board.denchuLid.isSensor = true;
                board.denchuLid.render.visible = false;
                sound.playChuckerIn();
                setTimeout(() => {
                    board.denchuLid.isSensor = false;
                    board.denchuLid.render.visible = true;
                }, 1500);
            }
        }
        
        // 電チュー入賞
        if ((bodyA.label === 'ball' && bodyB.label === 'denchu') ||
            (bodyB.label === 'ball' && bodyA.label === 'denchu')) {
            
            if (flashOverlayEl) {
                flashOverlayEl.style.display = 'block';
                setTimeout(() => { flashOverlayEl.style.display = 'none'; }, 100);
            }

            if (isJackpot) return;

            ballCount += 1;
            if (ballCountEl) ballCountEl.innerText = ballCount;
            sound.playChuckerIn();

            // ★ ヘソと同じく保留を積んでスロットを回す
            addReserve();

            const ballToRemove = bodyA.label === 'ball' ? bodyA : bodyB;
            if (ballToRemove) Composite.remove(engine.world, ballToRemove);
        }    

        // アタッカー入賞
        if ((bodyA.label === 'ball' && bodyB.label === 'attacker') ||
            (bodyB.label === 'ball' && bodyA.label === 'attacker')) {
            
            if (flashOverlayEl) {
                flashOverlayEl.style.display = 'block';
                setTimeout(() => { flashOverlayEl.style.display = 'none'; }, 100);
            }

            ballCount += 15; 
            if (ballCountEl) ballCountEl.innerText = ballCount;
            sound.playAttackerHit();
            
            if (isJackpot) {
                currentCount++;
                if (countDisplayEl) countDisplayEl.innerText = currentCount;
                if (currentCount >= MAX_COUNT) {
                    clearTimeout(roundTimer); // ★ タイマー二重実行を防ぐ
                    endRound();
                }
            }

            if (ballCountEl) {
                ballCountEl.style.textShadow = '0 0 15px #ffcc00, 0 0 30px #ffcc00';
                setTimeout(() => { ballCountEl.style.textShadow = ''; }, 100);
            }

            const ballToRemove = bodyA.label === 'ball' ? bodyA : bodyB;
            if (ballToRemove) Composite.remove(engine.world, ballToRemove);
        }
    });
});

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);