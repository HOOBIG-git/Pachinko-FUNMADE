import { Board } from './Board.js';
import { Shooter } from './shooter.js';

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

// --- main.js の中盤以降（シューターの生成の下あたりから） ---

let isShooting = false;
let lastShotTime = 0;
// --- ゲームの変数（追加・変更） ---
let ballCount = 100;
let startCount = 0;
let isJackpot = false;
let isSpinning = false; // ★追加：スロットが回転中かどうか
let reserveCount = 0;   // ★追加：現在の保留数
const MAX_RESERVE = 4;  // ★追加：最大保留数
const jackpotProbability = 0.1; // テスト用に大当たり確率を10%に設定

const ballCountEl = document.getElementById('ball-count');
const startCountEl = document.getElementById('start-count');
const reserveCountEl = document.getElementById('reserve-count'); // ★追加
const slotEls = [
    document.getElementById('slot-1'),
    document.getElementById('slot-2'),
    document.getElementById('slot-3')
];
const jackpotMsgEl = document.getElementById('jackpot-message');

// （中略：updatePower や handleFire、イベント監視はそのまま）

// --- ★大改修：デジタル抽選演出と保留消化 ---

// 保留をチェックして、スロットを回す関数
function checkAndSpin() {
    // 回転中、大当たり中、または保留が0なら何もしない
    if (isSpinning || isJackpot || reserveCount <= 0) return;

    // 保留を1つ消化して回転スタート
    reserveCount--;
    reserveCountEl.innerText = reserveCount;
    isSpinning = true;

    // 事前に今回の「結果」を決めておく
    const isWin = Math.random() < jackpotProbability;
    
    // エヴァ風に1〜9の数字を使う
    let leftNum, rightNum, centerNum;

    if (isWin) {
        // 大当たりの場合：3つ同じ数字
        leftNum = Math.floor(Math.random() * 9) + 1;
        rightNum = leftNum;
        centerNum = leftNum;
    } else {
        // ハズレの場合
        leftNum = Math.floor(Math.random() * 9) + 1;
        // 20%の確率で「リーチ（左右が同じ）」になるフェイク演出
        if (Math.random() < 0.2) {
            rightNum = leftNum;
            // 真ん中だけ違う数字にする（ハズレ）
            do { centerNum = Math.floor(Math.random() * 9) + 1; } while (centerNum === leftNum);
        } else {
            // 完全なバラバラ
            do { rightNum = Math.floor(Math.random() * 9) + 1; } while (rightNum === leftNum);
            centerNum = Math.floor(Math.random() * 9) + 1;
        }
    }

    // --- 液晶のアニメーション演出 ---
    // 高速シャッフル用のタイマー
    let shuffleInterval = setInterval(() => {
        slotEls.forEach(el => el.innerText = Math.floor(Math.random() * 9) + 1);
    }, 50);

    // 1秒後：左が止まる
    setTimeout(() => {
        slotEls[0].innerText = leftNum;
    }, 1000);

    // 2秒後：右が止まる
    setTimeout(() => {
        slotEls[2].innerText = rightNum;
        
        // リーチかどうかで、真ん中の止まるタイミングを変える
        if (leftNum === rightNum) {
            // リーチ演出！（真ん中がゆっくりになるなど、間を長くする）
            slotEls[1].style.color = '#ff0055'; // 真ん中を赤くして熱さを演出
            
            setTimeout(() => {
                clearInterval(shuffleInterval);
                slotEls[1].innerText = centerNum;
                slotEls[1].style.color = '#fff'; // 色を戻す
                finishSpin(isWin);
            }, 4500); // リーチ時は4.5秒まで引っ張る
        } else {
            // 通常ハズレ（すぐに真ん中も止まる）
            setTimeout(() => {
                clearInterval(shuffleInterval);
                slotEls[1].innerText = centerNum;
                finishSpin(isWin);
            }, 2500);
        }
    }, 2000);
}

// 回転終了時の処理
function finishSpin(isWin) {
    if (isWin) {
        triggerJackpot();
    } else {
        isSpinning = false;
        checkAndSpin(); // 次の保留があれば連続で回す
    }
}

// 大当たり演出
function triggerJackpot() {
    isJackpot = true;
    jackpotMsgEl.style.display = 'block';

    setTimeout(() => {
        jackpotMsgEl.style.display = 'none';
        isJackpot = false;
        isSpinning = false;
        slotEls.forEach(el => el.innerText = '0');
        checkAndSpin(); // 大当たり終了後に保留があれば回す
    }, 5000); // 今回は5秒で通常に戻る
}

// --- ★変更：衝突判定（チャッカー入賞時に保留を増やす） ---
Events.on(engine, 'collisionStart', function(event) {
    event.pairs.forEach((pair) => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        // チャッカー入賞処理
        if ((bodyA.label === 'ball' && bodyB.label === 'chucker') ||
            (bodyB.label === 'ball' && bodyA.label === 'chucker')) {
            
            startCount++;
            if (startCountEl) startCountEl.innerText = startCount;
            ballCount += 3; // 3個賞球
            if (ballCountEl) ballCountEl.innerText = ballCount;

            // ★保留を増やす（最大4まで）
            if (reserveCount < MAX_RESERVE) {
                reserveCount++;
                reserveCountEl.innerText = reserveCount;
                checkAndSpin(); // スロットが止まっていれば回し始める
            }

            const ballToRemove = bodyA.label === 'ball' ? bodyA : bodyB;
            if (ballToRemove) Composite.remove(engine.world, ballToRemove);
        }

        // アウト穴の処理
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