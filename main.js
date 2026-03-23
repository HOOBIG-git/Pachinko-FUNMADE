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

// ★新規追加：ラウンド管理用の変数
let currentRound = 0;
let currentCount = 0;
const MAX_ROUND = 15; // 15ラウンドまで
const MAX_COUNT = 10; // 1ラウンド10個まで
let roundTimer;       // ラウンドの制限時間（パンク防止）

const jackpotOverlayEl = document.getElementById('jackpot-overlay');
const flashOverlayEl = document.getElementById('flash-overlay');
const roundDisplayEl = document.getElementById('round-display');
const countDisplayEl = document.getElementById('count-display');
const jackpotInfoEl = document.getElementById('jackpot-info');
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

// 大当たり演出の開始
function triggerJackpot() {
    isJackpot = true;

    // ★脳汁全開演出！：大当たり時に全体を激しく揺らす（MEGA SHAKE）
    document.body.classList.add('mega-shake');
    // 大当たりファンファーレ中は電撃オーバーレイを点滅させる
    if (flashOverlayEl) flashOverlayEl.classList.add('flash-effect');
    if (flashOverlayEl) flashOverlayEl.style.display = 'block';

    jackpotMsgEl.style.display = 'block';
    jackpotInfoEl.style.display = 'none'; // ラウンド表示UIはまだ隠しておく
    
    // ファンファーレを鳴らす
    if(typeof sound !== 'undefined') sound.playMegaJackpot();
    currentRound = 1;

    // 3秒後にメッセージを消して、ラウンド表示に切り替える
    setTimeout(() => {
        // メッセージを非表示に
        jackpotMsgEl.style.display = 'none';
        
        // 代わりにラウンド表示UIを表示
        jackpotInfoEl.style.display = 'block'; 
        
        // ★演出：激しい振動（SHAKE）と電撃オーバーレイ（FLASH）をストップ
        document.body.classList.remove('mega-shake');
        if (flashOverlayEl) flashOverlayEl.classList.remove('flash-effect');
        if (flashOverlayEl) flashOverlayEl.style.display = 'none';

        // そして第1ラウンドを開始！
        startRound(); 
    }, 3000); // 3秒間「GREAT JOB」を表示
}

// 各ラウンドの開始処理
function startRound() {
    currentCount = 0; // カウントをリセット
    roundDisplayEl.innerText = currentRound;
    countDisplayEl.innerText = currentCount;

    // ★演出：大当たり消化中はずっと盤面を虹色に光らせる（RAINBOW OVERLAY）
    if (jackpotOverlayEl) jackpotOverlayEl.style.display = 'block';

    // アタッカーを開く（幽霊状態にして玉を通す）
    board.attackerLid.isSensor = true;
    board.attackerLid.render.visible = false;

    // もし15秒間玉が入らなければ、強制的にラウンドを終了する（パンク対策）
    roundTimer = setTimeout(endRound, 15000);
}

// 各ラウンドの終了処理
function endRound() {
    clearTimeout(roundTimer); // タイマーをストップ

    // ★演出：ラウンド終了時は虹色オーバーレイをストップ
    if (jackpotOverlayEl) jackpotOverlayEl.style.display = 'none';

    // アタッカーを閉じる（実体化して玉を弾く）
    board.attackerLid.isSensor = false;
    board.attackerLid.render.visible = true;

    // （...以下はそのまま...）
    if (currentRound < MAX_ROUND) {
        // まだラウンドが残っている場合：2秒のインターバル（アタッカーが閉まっている時間）を挟んで次へ
        currentRound++;
        setTimeout(startRound, 2000); 
    } 
    else {
        // 15ラウンド全て終了した場合：大当たり終了！
        setTimeout(() => {
            isJackpot = false;
            isSpinning = false;
            jackpotMsgEl.style.display = 'none';
            jackpotInfoEl.style.display = 'none';
            slotEls.forEach(el => el.innerText = '0');
            checkAndSpin(); // 保留があれば次を回す
        }, 3000); // 終了の余韻を3秒残す
    }
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

        // 玉が釘に当たった音
        if ((bodyA.label === 'ball' && bodyB.label === 'peg') ||
            (bodyB.label === 'ball' && bodyA.label === 'peg')) {
            sound.playPegHit();
        }

        // チャッカー（ヘソ）入賞
        if ((bodyA.label === 'ball' && bodyB.label === 'chucker') ||
            (bodyB.label === 'ball' && bodyA.label === 'chucker')) {
            sound.playChuckerIn();
            startCount++;
            if (startCountEl) startCountEl.innerText = startCount;
            ballCount += 3; 
            if (ballCountEl) ballCountEl.innerText = ballCount;
            if (reserveCount < MAX_RESERVE) {
                reserveCount++;
                if (reserveCountEl) reserveCountEl.innerText = reserveCount;
                checkAndSpin(); 
            }
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

        // --- スルーチャッカー通過（電チューを開く） ---
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
        
        // --- 電チュー入賞（RUSHの大当たり判定） ---
        if ((bodyA.label === 'ball' && bodyB.label === 'denchu') ||
            (bodyB.label === 'ball' && bodyA.label === 'denchu')) {
            
            if (flashOverlayEl) flashOverlayEl.style.display = 'block';
            setTimeout(() => {
                if (flashOverlayEl) flashOverlayEl.style.display = 'none';
            }, 100);

            // 大当たり中（アタッカー開放中）は完全無視
            if (isJackpot) {
                return;
            }

            // ★復活：賞球と音の処理
            ballCount += 1;
            if (ballCountEl) ballCountEl.innerText = ballCount;
            if(typeof sound !== 'undefined') sound.playChuckerIn();

            // RUSH中の大当たり抽選
            if (!isJackpot && Math.random() < 0.81) {
                triggerJackpot(); // 大当たり開始！
            }

            const ballToRemove = bodyA.label === 'ball' ? bodyA : bodyB;
            if (ballToRemove) Composite.remove(engine.world, ballToRemove);
        }    

        // --- アタッカー（右打ち）入賞 ---
        if ((bodyA.label === 'ball' && bodyB.label === 'attacker') ||
            (bodyB.label === 'ball' && bodyA.label === 'attacker')) {
            
            if (flashOverlayEl) flashOverlayEl.style.display = 'block';
            setTimeout(() => {
                if (flashOverlayEl) flashOverlayEl.style.display = 'none';
            }, 100);

            // ★復活：15発の賞球処理
            ballCount += 15; 
            if (ballCountEl) ballCountEl.innerText = ballCount;
            if(typeof sound !== 'undefined') sound.playAttackerHit();
            // ★復活：カウントアップとラウンド終了処理
            if (isJackpot) {
                currentCount++;
                if (countDisplayEl) countDisplayEl.innerText = currentCount;

                // 10カウントでアタッカーが閉まる！
                if (currentCount >= MAX_COUNT) {
                    endRound();
                }
            }

            // データカウンターの数字ギラギラ
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