// Board.js
export class Board {
    constructor(world, width, height) {
        this.world = world;
        this.width = width;
        this.height = height;
        this.Bodies = Matter.Bodies;
        this.Composite = Matter.Composite;
        this.Constraint = Matter.Constraint;
    }

    build() {
        this.createOuterWalls();
        this.createGuideRails(); // レール群を大幅に強化！
        this.createNails();      // レールに合わせて釘を再配置！
        this.createAttacker();
        this.createRushElements(); // ★新規追加：これを忘れずに！
    }

    // 1. 外枠とアウト穴
    createOuterWalls() {
        const outZone = this.Bodies.rectangle(this.width / 2, this.height + 20, this.width, 40, { 
            isStatic: true, isSensor: true, render: { fillStyle: '#222' }, label: 'out'
        });
        const leftWall = this.Bodies.rectangle(5, this.height / 2, 10, this.height, { isStatic: true, render: { fillStyle: '#333' } });
        const rightWall = this.Bodies.rectangle(this.width - 5, this.height / 2, 10, this.height, { isStatic: true, render: { fillStyle: '#333' } });
        this.Composite.add(this.world, [outZone, leftWall, rightWall]);
    }

// 2. プラスチックレールとステージの構築
    createGuideRails() {
        const elements = [];
        const railOpt = { isStatic: true, restitution: 0.1, friction: 0, render: { fillStyle: '#00aaff' } };

        elements.push(this.Bodies.rectangle(50, 450, 10, 550, railOpt));
        elements.push(this.Bodies.rectangle(110, 220, 10, 100, { ...railOpt, angle: Math.PI / 180 * -5 }));
        elements.push(this.Bodies.rectangle(60, 163, 10, 30, { ...railOpt, angle: Math.PI / 180 * 30 }));
        elements.push(this.Bodies.rectangle(10, 130, 30, 150, { ...railOpt, angle: Math.PI / 180 * 30 }));
        elements.push(this.Bodies.rectangle(120, 140, 10, 70, { ...railOpt, angle: Math.PI / 180 * 30 }));

        elements.push(this.Bodies.rectangle(100, 40, 120, 15, { ...railOpt, angle: Math.PI / 180 * -20 }));
        elements.push(this.Bodies.rectangle(180, 18, 90, 15, { ...railOpt, angle: Math.PI / 180 * -5 }));
        elements.push(this.Bodies.rectangle(270, 15, 100, 15, { ...railOpt, angle: Math.PI / 180 * 0 })); 
        elements.push(this.Bodies.rectangle(350, 23, 150, 15, { ...railOpt, angle: Math.PI / 180 * 20 }));
        elements.push(this.Bodies.rectangle(450, 90, 100, 15, { ...railOpt, angle: Math.PI / 180 * 50 }));

        elements.push(this.Bodies.rectangle(180, 94, 90, 10, { ...railOpt, angle: Math.PI / 180 * -10 }));
        elements.push(this.Bodies.rectangle(260, 84, 90, 20, { ...railOpt, angle: Math.PI / 180 * 5 }));
        elements.push(this.Bodies.rectangle(335, 150, 138, 20, { ...railOpt, angle: Math.PI / 180 * 60 }));

        elements.push(this.Bodies.rectangle(460, 350, 10, 500, railOpt));
        elements.push(this.Bodies.rectangle(370, 370, 10, 330, railOpt)); 

        elements.push(this.Bodies.rectangle(110, 220, 10, 100, { ...railOpt, angle: Math.PI / 180 * -5 }));

        elements.push(this.Bodies.rectangle(230, 568, 5, 25, railOpt));


        this.Composite.add(this.world, elements);
    }

    // 3. 釘と役物の配置
    createNails() {
        const elements = [];
        // ★変更：一番最後に label: 'peg' を追加しました
        const pegOpt = { isStatic: true, restitution: 0.5, render: { fillStyle: '#ff5555' }, label: 'peg' };

        // 寄り釘・こぼし・風車（変更なし）
        const yoriPegs = [
            {x: 80, y: 240},{x: 65, y: 280}
        ];
        yoriPegs.forEach(p => elements.push(this.Bodies.circle(p.x, p.y, 4, pegOpt)));

        const windmill = this.Bodies.polygon(95, 450 , 4, 20, { render: { fillStyle: '#ffcc00' }, frictionAir: 0.02 });
        const windmillPivot = this.Constraint.create({
            pointA: { x: 95, y: 480 }, bodyB: windmill, length: 0, stiffness: 1, render: { visible: false }
        });
        elements.push(windmill, windmillPivot);

        const michiPegs = [
            {x: 90, y: 510}, {x: 115, y: 520}, {x: 140, y: 530}, {x: 154, y: 535}, 
            {x: 165, y: 540}, {x: 190, y: 550}, {x: 215, y: 565}, {x: 285, y: 565}, {x: 305, y: 550}
            , {x: 330, y: 540}
        ];
        michiPegs.forEach(p => elements.push(this.Bodies.circle(p.x, p.y, 4, pegOpt)));
        

        const inochiLeft = this.Bodies.circle(235, 548, 4, pegOpt);
        const inochiRight = this.Bodies.circle(265, 548, 4, pegOpt);

        const chucker = this.Bodies.rectangle(250, 570, 36, 15, {
            isStatic: true, isSensor: true, render: { fillStyle: '#ffff00' }, label: 'chucker'
        });

        elements.push(inochiLeft, inochiRight, chucker);
        this.Composite.add(this.world, elements);
        

    }    
    // Board.js の createAttacker() メソッドを上書き

    createAttacker() {
        const elements = [];
        const baseOpt = { isStatic: true, render: { fillStyle: '#888' } };
        
        // 右打ちルートのガイド
        elements.push(this.Bodies.rectangle(460, 350, 10, 400, { isStatic: true, restitution: 0.1, friction: 0, render: { fillStyle: '#88aaff' } }));
        elements.push(this.Bodies.rectangle(370, 350, 10, 300, { isStatic: true, restitution: 0.1, friction: 0, render: { fillStyle: '#88aaff' } })); 

        // アタッカーの箱
        const attackerBottom = this.Bodies.rectangle(415, 630, 70, 10, baseOpt);
        const attackerLeft = this.Bodies.rectangle(385, 610, 10, 50, baseOpt);
        const attackerRight = this.Bodies.rectangle(445, 610, 10, 50, baseOpt);

        // ★縁の玉溜まり防止用スロープ（そのまま）
        const leftSlope = this.Bodies.rectangle(385, 580, 20, 10, {
            isStatic: true, angle: Math.PI / 180 * -45, render: { visible: false } 
        });
        const rightSlope = this.Bodies.rectangle(445, 580, 20, 10, {
            isStatic: true, angle: Math.PI / 180 * 45, render: { visible: false } 
        });

        // センサー
        const attackerSensor = this.Bodies.rectangle(415, 610, 50, 20, {
            isStatic: true, isSensor: true, render: { fillStyle: '#ff00ff' }, label: 'attacker'
        });

        // --- ★改修：フタを静的（isStatic: true）に戻す ---
        // Constraint（蝶番）は使わず、シンプルな長方形に戻します。
        // 幅を60にして、箱の中にスッポリ収まるサイズに調整しました。
        this.attackerLid = this.Bodies.rectangle(415, 580, 60, 10, {
            isStatic: true, render: { fillStyle: '#00ff00' }
        });

        elements.push(attackerBottom, attackerLeft, attackerRight, leftSlope, rightSlope, attackerSensor, this.attackerLid);
        this.Composite.add(this.world, elements);
    }

    createRushElements() {
        const elements = [];
        const pegOpt = { isStatic: true, restitution: 0.5, render: { fillStyle: '#ff5555' }, label: 'peg' };

        // ① スルーチャッカー（玉が通過するだけの透明なセンサー）
        // 右ガイドレールの少し下あたりに配置
        const throughSensor = this.Bodies.rectangle(415, 380, 40, 10, {
            isStatic: true, isSensor: true, render: { fillStyle: '#00ffff' }, label: 'through'
        });
        // スルーに玉を導くための釘
        elements.push(this.Bodies.circle(385, 380, 4, pegOpt));
        elements.push(this.Bodies.circle(445, 380, 4, pegOpt));

        // ② 電チュー（スルーの下にある、開閉する小さな入賞口）
        const denchuBottom = this.Bodies.rectangle(415, 480, 30, 10, { isStatic: true, render: { fillStyle: '#888' } });
        const denchuSensor = this.Bodies.rectangle(415, 470, 20, 10, {
            isStatic: true, isSensor: true, render: { fillStyle: '#ff00ff' }, label: 'denchu'
        });

        // ③ ★電チューのフタ（ハネ）
        // アタッカーと同じように、普段は閉じていてスルー通過時に開く
        this.denchuLid = this.Bodies.rectangle(415, 450, 40, 10, {
            isStatic: true, render: { fillStyle: '#00ff00' }
        });

        elements.push(throughSensor, denchuBottom, denchuSensor, this.denchuLid);
        this.Composite.add(this.world, elements);
    }
}