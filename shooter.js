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

    fire(currentPower, ballCount) {
        if (ballCount <= 0) return { fired: false };

        const ball = this.Bodies.circle(this.startX, this.startY, 9, {
            restitution: 0.5, friction: 0.005, density: 0.05,
            render: { fillStyle: '#c0c0c0' }, label: 'ball'
        });

        const forceX = 0; 

        // ★全体的に強く調整しました！
        // 以前：-0.06 〜 -0.12 の範囲
        // 今回：-0.08 〜 -0.16 の範囲 (数値が大きいほど強くなります)
        const baseForceY = -0.8 - (currentPower / 100) * 1;
        
        // ランダムなブレはそのまま
        const forceY = baseForceY + (Math.random() * 0.004 - 0.002);

        this.Composite.add(this.world, ball);
        this.Body.applyForce(ball, ball.position, { x: forceX, y: forceY });

        return { fired: true, ballsUsed: 1 };
    }
}