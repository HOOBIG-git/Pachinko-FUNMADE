export class Shooter {
    constructor(world, x, y) {
        this.world = world;
        this.Bodies = Matter.Bodies;
        this.Composite = Matter.Composite;
        this.Body = Matter.Body;
        this.startX = x;
        this.startY = y;
        
        // ★実機に合わせて0.6秒（600ミリ秒）間隔に変更
        this.SHOOT_COOLDOWN = 600; 
    }

// Shooter.js の fire() メソッド内を上書き

    fire(currentPower, ballCount) {
        if (ballCount <= 0) return { fired: false };

        const ball = this.Bodies.circle(this.startX, this.startY, 9, {
            restitution: 0.5, friction: 0.005, density: 0.05,
            render: { fillStyle: '#c0c0c0' }, label: 'ball'
        });

        this.Composite.add(this.world, ball);

        // ★ここから変更：applyForce をやめて setVelocity を使う

        // 速度（Velocity）はフレームレートに依存しないため、永遠に同じ強さを保ちます。
        // ※Forceとは数値のケタが違うため、数値を -22 前後に変更しています。
        const baseVelocityY = -22 - (currentPower / 100) * 8;
        
        // ランダムなブレ（少しだけ数値を大きくして自然な散らばりにしています）
        const velocityY = baseVelocityY + (Math.random() * 0.6 - 0.3); 

        // 力を加えるのではなく、玉に直接「速度」をセットする
        this.Body.setVelocity(ball, { x: 0, y: velocityY });

        return { fired: true, ballsUsed: 1 };
    }
}