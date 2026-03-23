// Board.js
export class Board {
    constructor(world, width, height) {
        this.world = world;
        this.width = width;
        this.height = height;
        this.Bodies = Matter.Bodies;
        this.Composite = Matter.Composite;
        this.Constraint = Matter.Constraint; // ★追加：回転軸を作るための機能
    }

    build() {
        this.createOuterWalls();
        this.createGuideRails();
        this.createNails(); // ★追加：釘とギミックの配置処理を呼び出す
    }

    createOuterWalls() {
        const outZone = this.Bodies.rectangle(this.width / 2, this.height + 20, this.width, 40, { 
            isStatic: true, isSensor: true, render: { fillStyle: '#222' }, label: 'out'
        });
        const leftWall = this.Bodies.rectangle(10, this.height / 2, 20, this.height, { 
            isStatic: true, render: { fillStyle: '#555' } 
        });
        const rightWall = this.Bodies.rectangle(this.width - 10, this.height / 2, 20, this.height, { 
            isStatic: true, render: { fillStyle: '#555' } 
        });
        this.Composite.add(this.world, [outZone, leftWall, rightWall]);
    }

createGuideRails() {
        // --- 1. 外側のルート（打ち出しから天井まで） ---
        const innerRail = this.Bodies.rectangle(55, 450, 10, 500, {
            isStatic: true, render: { fillStyle: '#88aaff' }
        });
        const topLeftCurve = this.Bodies.rectangle(70, 75, 20, 250, {
            isStatic: true, angle: Math.PI / 180 * 30, render: { fillStyle: '#88aaff' }
        });
        const topLeftCurve2 = this.Bodies.rectangle(100, 50, 20, 250, {
            isStatic: true, angle: Math.PI / 180 * 65, render: { fillStyle: '#88aaff' }
        });
        const ceiling = this.Bodies.rectangle(this.width / 2 + 40, 20, 350, 20, {
            isStatic: true,
            angle: Math.PI / 180 * 8, 
            restitution: 0.1, 
            friction: 0,      
            render: { fillStyle: '#ff5555' }
        });

        // --- 2. ★追加：内側のルート（盤面エリアとの仕切り） ---
        const middleLeftCurve = this.Bodies.rectangle(230, 150, 10, 100, {
            isStatic: true, angle: Math.PI / 180 * 65, render: { fillStyle: '#88aaff' }
        });

        const clearZone = this.Bodies.rectangle(140, 40, 40, 40, {
            isStatic: true, 
            isSensor: true, 
            render: { visible: false }, 
            label: 'clearZone'
        });

        // 最後に middleLeftCurve も配列に追加して世界に配置する
        this.Composite.add(this.world, [
            innerRail, topLeftCurve, topLeftCurve2, ceiling, 
            middleLeftCurve, clearZone
        ]);
    }
// ★エヴァ15風のリアルな釘配置
    createNails() {
        const elements = [];

        // 共通の釘の設定（反発係数を持たせてカチャカチャ跳ねるようにする）
        const pegOpt = { isStatic: true, restitution: 0.5, render: { fillStyle: '#ff5555' } };

        // ① 風車（回転する四角形）
        // 左側に落ちると死に玉、右側に落ちると道釘へ行くというシビアな位置に配置
        const windmill = this.Bodies.polygon(120, 360, 4, 25, {
            render: { fillStyle: '#ffcc00' }, frictionAir: 0.02 
        });
        const windmillPivot = this.Constraint.create({
            pointA: { x: 120, y: 360 }, bodyB: windmill, length: 0, stiffness: 1, render: { visible: false }
        });
        elements.push(windmill, windmillPivot);

        // ② 寄り釘 ＆ こぼし（死に玉ルート）
        // ブッコミを抜けた玉を受け止め、風車へ向かうか左へこぼれるかを振り分ける
        const yoriPegs = [
            // 上部の受け（ブッコミの下）
            {x: 150, y: 220}, {x: 180, y: 220}, {x: 210, y: 220},
            // 中央の密集地帯
            {x: 140, y: 250}, {x: 170, y: 250}, {x: 200, y: 250},
            {x: 160, y: 280}, {x: 190, y: 280},
            // 風車へ導く最後の釘（ここを右に抜ければチャンス）
            {x: 140, y: 310}, {x: 170, y: 310},
            
            // ★超重要：こぼしポイント（外側の壁）
            // この釘より左側に玉が流れると、風車に絡まずに一番下のアウト穴へ一直線に落ちます
            {x: 90, y: 280}, {x: 100, y: 310} 
        ];
        yoriPegs.forEach(p => elements.push(this.Bodies.circle(p.x, p.y, 4, pegOpt)));

        // ③ 道釘（風車の右側からヘソへ向かう長い下り坂）
        const michiPegs = [
            {x: 140, y: 430}, {x: 165, y: 440}, {x: 190, y: 450}, 
            {x: 215, y: 460}, {x: 240, y: 470}
        ];
        michiPegs.forEach(p => elements.push(this.Bodies.circle(p.x, p.y, 4, pegOpt)));

        // ④ ジャンプ釘（道釘の最後にある、ヘソへ飛び込むための踏み台）
        elements.push(this.Bodies.circle(245, 540, 4, pegOpt));

        // ⑤ ハカマ（ヘソの真上にある、縦に並んだ2列の釘）
        // ここに玉が入ればヘソ入賞の大チャンス！
        const hakamaPegs = [
            // 左列
            {x: 265, y: 460}, {x: 265, y: 490}, {x: 265, y: 520},
            // 右列
            {x: 295, y: 460}, {x: 295, y: 490}, {x: 295, y: 520}
        ];
        hakamaPegs.forEach(p => elements.push(this.Bodies.circle(p.x, p.y, 4, pegOpt)));

        // ⑥ ヘソ（スタートチャッカー）と命釘
        const chucker = this.Bodies.rectangle(280, 580, 40, 15, {
            isStatic: true, isSensor: true, render: { fillStyle: '#ffff00' }, label: 'chucker'
        });
        const inochiLeft = this.Bodies.circle(265, 550, 4, pegOpt);
        const inochiRight = this.Bodies.circle(295, 550, 4, pegOpt);
        
        elements.push(chucker, inochiLeft, inochiRight);

        this.Composite.add(this.world, elements);
    }
}