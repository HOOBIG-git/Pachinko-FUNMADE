// Sound.js
export class Sound {
    constructor() {
        // ブラウザの音声エンジンを準備
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
    }

    // ブラウザの仕様上、ユーザーが画面をクリックした時にエンジンを起動する必要がある
    init() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // ① 玉が釘に当たった音（短く高い「カチッ」という音）
    playPegHit() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle'; // 三角波で少し柔らかい金属音を表現
        // 音の高さをランダムにして「カチャカチャ感」を出す
        osc.frequency.setValueAtTime(800 + Math.random() * 400, this.ctx.currentTime); 
        
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime); // 音量は小さめ
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05); // 一瞬で消える

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    // ② チャッカー（ヘソ）に入った音（嬉しい「ピロリン！」という音）
    playChuckerIn() {
        this.playTone('square', 880, 0, 0.1);    // ラの音
        this.playTone('square', 1760, 0.1, 0.15); // 1オクターブ高いラの音
    }

    // ③ 大当たりの音（ファンファーレ風）
    playJackpot() {
        this.playTone('square', 523.25, 0, 0.2);   // ド
        this.playTone('square', 659.25, 0.2, 0.2); // ミ
        this.playTone('square', 783.99, 0.4, 0.4); // ソ
    }

    // 音を鳴らすための補助関数
    playTone(type, freq, delay, duration) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const startTime = this.ctx.currentTime + delay;

        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.1, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
    }
}