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

const reachTextEl = document.getElementById('reach-text');

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

// ゲームモード管理 ('normal' | 'tanjun' | 'st')
let gameMode = 'normal';
let modeSpinsLeft = 0;

// ★ テスト用大当たり確率（そのまま活かします！）
const JACKPOT_PROB_NORMAL = 1 / 2;
const JACKPOT_PROB_ST     = 1 / 99;

// 保留データを「ヘソ」と「電チュー」に分割
let hesoReserves = []; 
let denchuReserves = []; 
const MAX_RESERVE = 4;  
let currentPower = 50;
let currentSpinType = null; // 今どっちの保留を消化しているか記憶する

// ラウンド管理
let currentRound = 0;
let currentCount = 0;
const MAX_ROUND = 5; 
const MAX_COUNT = 3; 
let roundTimer;       
// --- DOM参照 ---
const jackpotOverlayEl  = document.getElementById('jackpot-overlay');
const flashOverlayEl    = document.getElementById('flash-overlay');
const roundDisplayEl    = document.getElementById('round-display');
const countDisplayEl    = document.getElementById('count-display');
const jackpotInfoEl     = document.getElementById('jackpot-info');
const ballCountEl       = document.getElementById('ball-count');
const startCountEl      = document.getElementById('start-count');
const powerBarFill      = document.getElementById('power-bar-fill');
const jackpotMsgEl      = document.getElementById('jackpot-message');
const modeDisplayEl     = document.getElementById('mode-display');
const modeNameEl        = document.getElementById('mode-name');
const modeSpinsLeftEl   = document.getElementById('mode-spins-left');
const longinusOverlayEl = document.getElementById('longinus-overlay');

// 保留アイコンの取得を2つに分割
const hesoIcons   = document.querySelectorAll('.heso-icon'); 
const denchuIcons = document.querySelectorAll('.denchu-icon');

const slotEls = [
    document.getElementById('slot-1'),
    document.getElementById('slot-2'),
    document.getElementById('slot-3')
];

function getJackpotProbability() {
    return gameMode === 'st' ? JACKPOT_PROB_ST : JACKPOT_PROB_NORMAL;
}

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

function countDownSpin() {
    if (gameMode === 'normal') return;
    modeSpinsLeft--;
    if (modeSpinsLeftEl) modeSpinsLeftEl.innerText = modeSpinsLeft;
    if (modeSpinsLeft <= 0) endMode();
}

function endMode() {
    gameMode = 'normal';
    modeSpinsLeft = 0;
    board.denchuLid.isSensor = false;
    board.denchuLid.render.visible = true;
    applyModeVisuals();
}

function updateReserveUI() {
    hesoIcons.forEach((icon, index) => {
        icon.className = 'reserve-icon heso-icon';
        if (index < hesoReserves.length) icon.classList.add(`res-${hesoReserves[index].color}`);
    });
    denchuIcons.forEach((icon, index) => {
        icon.className = 'reserve-icon denchu-icon';
        if (index < denchuReserves.length) icon.classList.add(`res-${denchuReserves[index].color}`);
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

// 引数で「heso」か「denchu」を受け取り、別々の配列に積む
function addReserve(type) {
    const targetArray = (type === 'denchu') ? denchuReserves : hesoReserves;

    if (targetArray.length >= MAX_RESERVE || isJackpot) return;

    const isWin = Math.random() < getJackpotProbability();
    let color = 'white';
    let shake = false;

    if (isWin) {
        const r = Math.random();
        if (r < 0.05)       { color = 'rainbow'; }           
        else if (r < 0.20)  { color = 'shoki'; }             
        else if (r < 0.50)  { color = 'red'; }               
        else                { color = 'green'; }              
        if (Math.random() < 0.3) shake = true;               
    } else {
        const r = Math.random();
        if (r < 0.02)       { color = 'shoki'; }             
        else if (r < 0.05)  { color = 'rainbow'; shake = true; } 
        else if (r < 0.10)  { color = 'red'; }               
        else if (r < 0.20)  { color = 'green'; }             
        else if (r < 0.40)  { color = 'blue'; }              
    }

    targetArray.push({ isWin, color, shake });
    updateReserveUI();
    checkAndSpin();
}

function checkAndSpin() {
    if (isSpinning || isJackpot || (hesoReserves.length === 0 && denchuReserves.length === 0)) return;

    let currentData = null;

    // 電チュー保留を「絶対に」優先して消化する
    if (denchuReserves.length > 0) {
        currentData = denchuReserves.shift();
        currentSpinType = 'denchu';
    } else if (hesoReserves.length > 0) {
        currentData = hesoReserves.shift();
        currentSpinType = 'heso';
    }

    updateReserveUI(); 
    isSpinning = true;

    countDownSpin();
    
    const isRush = (gameMode === 'st' || gameMode === 'tanjun');
    const isWin = currentData.isWin;

    // ★修正：古い reserves 変数を削除して配列の中身をチェック
    if (hesoReserves.length > 0 || denchuReserves.length > 0) {
        const changeProb = isWin ? 0.4 : 0.05;
        if (Math.random() < changeProb) {
            const delay = isRush ? 500 + Math.random() * 1000 : 1500 + Math.random() * 2000;
            setTimeout(() => triggerLonginusChange(isWin), delay);
        }
    }

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

    // 個別に止まるようにフラグ管理
    let spinning = [true, true, true];

    let shuffleInterval = setInterval(() => {
        if (spinning[0]) slotEls[0].innerText = Math.floor(Math.random() * 9) + 1;
        if (spinning[1]) slotEls[1].innerText = Math.floor(Math.random() * 9) + 1;
        if (spinning[2]) slotEls[2].innerText = Math.floor(Math.random() * 9) + 1;
    }, 50);

    const leftStopTime   = isRush ? 400 : 1000;
    const rightStopTime  = isRush ? 800 : 2000;
    const reachWaitTime  = isRush ? 2500 : 6000; 
    const hazureWaitTime = isRush ? 1200 : 2500;

    setTimeout(() => { 
        spinning[0] = false; 
        slotEls[0].innerText = leftNum; 
    }, leftStopTime);

    setTimeout(() => {
        spinning[2] = false;
        slotEls[2].innerText = rightNum;

        if (leftNum === rightNum) {
            slotEls[1].style.color = '#ff0055';
            if(typeof sound !== 'undefined' && typeof sound.playReach === 'function') sound.playReach();

            const isZenkaiten = isWin && Math.random() < 0.05;
            let reachType = 'normal';
            if (!isZenkaiten) {
                const r = Math.random();
                if (r < 0.12)      reachType = 'supersp'; 
                else if (r < 0.42) reachType = 'sp';      
                else               reachType = 'normal';  
            } else {
                reachType = 'zenkaiten';
            }

            if (isZenkaiten) {
                clearInterval(shuffleInterval);
                shuffleInterval = setInterval(() => {
                    const n = Math.floor(Math.random() * 9) + 1;
                    slotEls.forEach(el => el.innerText = n);
                }, 80);
            }

            applyReachClass(reachType);

            setTimeout(() => {
                clearInterval(shuffleInterval);
                spinning[1] = false;
                slotEls[0].innerText = leftNum;
                slotEls[2].innerText = rightNum;
                slotEls[1].innerText = centerNum;
                slotEls[1].style.color = '#fff';
                clearReachClass();
                finishSpin(isWin);
            }, reachWaitTime);        
        } else {
            setTimeout(() => {
                clearInterval(shuffleInterval);
                spinning[1] = false;
                slotEls[1].innerText = centerNum;
                finishSpin(isWin);
            }, hazureWaitTime);
        }
    }, rightStopTime);
}

function applyReachClass(type) {
    const textMap = {
        normal:   '',
        sp:       '⚠ 使徒襲来 ⚠',
        supersp:  '★ EVANGELION ★',
        zenkaiten:'⚡ IMPACT !!! ⚡'
    };
    document.body.classList.add(`reach-${type}`);
    if (reachTextEl) {
        const text = textMap[type];
        reachTextEl.innerText = text;
        reachTextEl.style.display = text ? 'block' : 'none';
    }
}

function clearReachClass() {
    document.body.classList.remove('reach-normal', 'reach-sp', 'reach-supersp', 'reach-zenkaiten');
    if (reachTextEl) {
        reachTextEl.style.display = 'none';
        reachTextEl.innerText = '';
    }
}

function triggerLonginusChange(isWin) {
    // ★修正：古い reserves 変数を削除
    if (hesoReserves.length === 0 && denchuReserves.length === 0) return;

    if (longinusOverlayEl) {
        const line = document.createElement('div');
        line.classList.add('longinus-line');
        longinusOverlayEl.appendChild(line);
        longinusOverlayEl.style.display = 'block';

        setTimeout(() => {
            longinusOverlayEl.innerHTML = '';
            const flash = document.createElement('div');
            flash.classList.add('longinus-flash');
            longinusOverlayEl.appendChild(flash);

            upgradeReserve(isWin);

            setTimeout(() => {
                longinusOverlayEl.style.display = 'none';
                longinusOverlayEl.innerHTML = '';
            }, 500);
        }, 300);
    }
}

function upgradeReserve(isWin) {
    // ★修正：電チューを優先して昇格対象にする
    let targetArray = null;
    if (denchuReserves.length > 0) targetArray = denchuReserves;
    else if (hesoReserves.length > 0) targetArray = hesoReserves;

    if (!targetArray) return;

    const upgradeMap = {
        white:   'blue',
        blue:    'green',
        green:   isWin ? 'red'   : 'green', 
        red:     isWin ? 'shoki' : 'red',
        shoki:   isWin ? 'rainbow' : 'shoki',
        rainbow: 'rainbow' 
    };

    const target = targetArray[0];
    const nextColor = upgradeMap[target.color] || target.color;

    if (nextColor !== target.color) {
        target.color = nextColor;
        if (isWin && Math.random() < 0.4) target.shake = true; 
        updateReserveUI();
    }
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

    if (jackpotOverlayEl) {
        jackpotOverlayEl.classList.remove('st-effect', 'tanjun-effect');
        jackpotOverlayEl.style.display = 'none';
    }

    document.body.classList.add('mega-shake');
    if (flashOverlayEl) flashOverlayEl.classList.add('flash-effect');
    if (flashOverlayEl) flashOverlayEl.style.display = 'block';

    jackpotMsgEl.style.display = 'block';
    jackpotInfoEl.style.display = 'none'; 
    
    if(typeof sound !== 'undefined' && typeof sound.playMegaJackpot === 'function') sound.playMegaJackpot();
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
        setTimeout(() => {
            isJackpot = false;
            isSpinning = false;
            jackpotMsgEl.style.display = 'none';
            jackpotInfoEl.style.display = 'none';
            slotEls.forEach(el => el.innerText = '0');

            if (currentSpinType === 'denchu') {
                gameMode = 'st';
                modeSpinsLeft = 163;
            } else {
                if (Math.random() < 0.59) {
                    gameMode = 'st';
                    modeSpinsLeft = 163;
                } else {
                    gameMode = 'tanjun';
                    modeSpinsLeft = 100;
                }
            }

            board.denchuLid.isSensor = true;
            board.denchuLid.render.visible = false;

            if (modeSpinsLeftEl) modeSpinsLeftEl.innerText = modeSpinsLeft;
            applyModeVisuals();
            checkAndSpin(); 
        }, 3000); 
    }
}

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

let touchStartY = 0;
window.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    isShooting = true;
    if(typeof sound !== 'undefined') sound.init();
}, { passive: true });
window.addEventListener('touchend', () => {
    isShooting = false;
});
window.addEventListener('touchmove', (e) => {
    const currentY = e.touches[0].clientY;
    const deltaY = touchStartY - currentY;
    if (Math.abs(deltaY) > 10) {
        updatePower(deltaY > 0 ? 3 : -3);
        touchStartY = currentY; 
    }
}, { passive: true });

const btnPowerUp   = document.getElementById('btn-power-up');
const btnPowerDown = document.getElementById('btn-power-down');
if (btnPowerUp)   btnPowerUp.addEventListener('mousedown',   () => { updatePower(5);  });
if (btnPowerDown) btnPowerDown.addEventListener('mousedown', () => { updatePower(-5); });

Events.on(engine, 'beforeUpdate', () => {
    if (isShooting) handleFire();
});

Events.on(engine, 'collisionStart', function(event) {
    event.pairs.forEach((pair) => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        if ((bodyA.label === 'ball' && bodyB.label === 'peg') ||
            (bodyB.label === 'ball' && bodyA.label === 'peg')) {
            if(typeof sound !== 'undefined' && typeof sound.playPegHit === 'function') sound.playPegHit();
        }

        // --- ★修正：引数「'heso'」を追加 ---
        if ((bodyA.label === 'ball' && bodyB.label === 'chucker') ||
            (bodyB.label === 'ball' && bodyA.label === 'chucker')) {
            if(typeof sound !== 'undefined' && typeof sound.playChuckerIn === 'function') sound.playChuckerIn();
            startCount++;
            if (startCountEl) startCountEl.innerText = startCount;
            ballCount += 3; 
            if (ballCountEl) ballCountEl.innerText = ballCount;
            
            addReserve('heso'); 

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
            if (gameMode === 'normal') {
                board.denchuLid.isSensor = true;
                board.denchuLid.render.visible = false;
                if(typeof sound !== 'undefined' && typeof sound.playChuckerIn === 'function') sound.playChuckerIn();
                setTimeout(() => {
                    board.denchuLid.isSensor = false;
                    board.denchuLid.render.visible = true;
                }, 1500);
            }
        }
        
        // --- ★修正：引数「'denchu'」を追加 ---
// --- ★修正：引数「'denchu'」を追加 --- の部分を探す
        if ((bodyA.label === 'ball' && bodyB.label === 'denchu') ||
            (bodyB.label === 'ball' && bodyA.label === 'denchu')) {
            
            if (flashOverlayEl) {
                flashOverlayEl.style.display = 'block';
                setTimeout(() => { flashOverlayEl.style.display = 'none'; }, 100);
            }

            if (isJackpot) return;

            ballCount += 1;
            if (ballCountEl) ballCountEl.innerText = ballCount;
            if(typeof sound !== 'undefined' && typeof sound.playChuckerIn === 'function') sound.playChuckerIn();

            // ↓↓↓ ここから書き換え ↓↓↓
            
            // ★大正解の修正：通常時はヘソ保留、ST/時短中は電チュー保留として扱う！
            if (gameMode === 'normal') {
                addReserve('heso');
            } else {
                addReserve('denchu'); 
            }

            // ↑↑↑ ここまで書き換え ↑↑↑

            const ballToRemove = bodyA.label === 'ball' ? bodyA : bodyB;
            if (ballToRemove) Composite.remove(engine.world, ballToRemove);
        }
        if ((bodyA.label === 'ball' && bodyB.label === 'attacker') ||
            (bodyB.label === 'ball' && bodyA.label === 'attacker')) {
            
            if (flashOverlayEl) {
                flashOverlayEl.style.display = 'block';
                setTimeout(() => { flashOverlayEl.style.display = 'none'; }, 100);
            }

            ballCount += 100; 
            if (ballCountEl) ballCountEl.innerText = ballCount;
            if(typeof sound !== 'undefined' && typeof sound.playAttackerHit === 'function') sound.playAttackerHit();
            
            if (isJackpot) {
                currentCount++;
                if (countDisplayEl) countDisplayEl.innerText = currentCount;
                if (currentCount >= MAX_COUNT) {
                    clearTimeout(roundTimer); 
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