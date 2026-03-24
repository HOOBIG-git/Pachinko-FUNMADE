// Sound.js
export class Sound {
    constructor() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
    }

    init() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // ① 玉が釘に当たった音（変更なし）
    playPegHit() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle'; 
        osc.frequency.setValueAtTime(800 + Math.random() * 400, this.ctx.currentTime); 
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime); 
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05); 
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(); osc.stop(this.ctx.currentTime + 0.05);
    }

    // ② チャッカー（ヘソ・スルー）に入った音
    playChuckerIn() {
        this.playTone('square', 880, 0, 0.1, 0.1);    
        this.playTone('square', 1760, 0.1, 0.15, 0.1); 
    }

    // ③ ★新規：アタッカーに入賞した時の「キュイン！」音（超高速ピッチ上昇）
    playAttackerHit() {
        const now = this.ctx.currentTime;
        // 1000Hzから3000Hzへ、0.15秒で一気に駆け上がる
        this.playSweep('sine', 1000, 3000, now, 0.15, 0.15);
    }
    

    // ④ ★大改修：ヴヴヴ＆ユニコーン風 脳汁確定サウンド
    playMegaJackpot() {
        const now = this.ctx.currentTime;

        // 1. ズババーーン！（重低音の落下による衝撃）
        this.playSweep('sawtooth', 2000, 50, now, 0.4, 0.2);

        // 2. ヴァルヴレイヴ風「ピリピリピリピィィィ！」（超高速交互再生）
        // 0.03秒間隔で、鼓膜を突くような高音を連打させる
        for (let i = 0; i < 30; i++) {
            const freq = i % 2 === 0 ? 3000 : 4500; // 狂ったような高音
            this.playTone('square', freq, now + 0.4 + (i * 0.03), 0.03, 0.1);
        }

        // 3. ユニコーン風「プゥーーーーン！」（覚醒の上昇シレン）
        this.playSweep('square', 800, 4000, now + 1.3, 1.2, 0.15);

        // 4. 脳汁確定・神々しい和音（バーン！と広がる）
        const chordTime = now + 2.5;
        this.playTone('sawtooth', 880.00, chordTime, 3.0, 0.1);  // A5
        this.playTone('sawtooth', 1108.73, chordTime, 3.0, 0.1); // C#6
        this.playTone('sawtooth', 1318.51, chordTime, 3.0, 0.1); // E6
        this.playTone('square', 1760.00, chordTime, 3.0, 0.05);  // A6 (きらびやかさ)
    }

    // ⑤ ★新規追加：リーチ（テンパイ）時のヒリつく警告音と心音
    playReach() {
        const now = this.ctx.currentTime;
        
        // 1. テンパイ直後の「キィィィン！」という甲高い警告音
        this.playSweep('triangle', 1500, 3000, now, 0.6, 0.1);
        this.playSweep('triangle', 1500, 3000, now + 0.7, 0.6, 0.1);
        
    // 2. 祈りの時間「ドックン...ドックン...」という重低音の心音
    // ★変更：8回から 18回 に増やして、心音を長く続ける！
    for(let i = 0; i < 18; i++) {
        // ドッ（60Hzの超低音）
        this.playTone('sine', 60, now + 1.5 + (i * 0.4), 0.1, 0.4);
        // クン（少しだけ高い音）
        this.playTone('sine', 65, now + 1.65 + (i * 0.4), 0.1, 0.3);
    }    }

    // 音を鳴らすための補助関数（音量volを追加）
    playTone(type, freq, delay, duration, vol) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const startTime = this.ctx.currentTime + delay;

        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(vol, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
    }

    // ★新規：ピッチ（音の高さ）を滑らかに変化させる関数（キュイン音やシレン音の正体）
    playSweep(type, startFreq, endFreq, startTime, duration, vol) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;

        osc.frequency.setValueAtTime(startFreq, startTime);
        osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration); // ギュイーンと変化

        gain.gain.setValueAtTime(vol, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
    }
}