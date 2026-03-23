// 1. Matter.jsの便利な機能を使いやすいように短い名前を変数に代入
const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Composite = Matter.Composite;

// 2. 物理エンジンの作成（重力などの計算を行う心臓部）
const engine = Engine.create();

// 3. レンダラーの作成（計算結果をHTMLの画面に描画する役割）
const render = Render.create({
    element: document.body,
    engine: engine,
    options: {
        width: 500,     // 盤面の幅
        height: 700,    // 盤面の高さ
        wireframes: false, // falseにすると色付きで描画される
        background: '#0f2027' // 盤面の背景色
    }
});

// 4. 盤面上の物体（Bodies）を作る
// ① パチンコ玉（円形：x座標, y座標, 半径）
const ball = Bodies.circle(250, 50, 10, { 
    restitution: 0.8, // 反発係数（どれくらい跳ねるか。0〜1）
    render: { fillStyle: '#c0c0c0' } // 銀色
});

// ② 試し打ち用の釘 1本（円形：x座標, y座標, 半径）
const peg = Bodies.circle(250, 300, 5, { 
    isStatic: true, // 動かない物体にする（重要）
    render: { fillStyle: '#ff5555' } // 赤色
});

// ③ 地面（四角形：x座標, y座標, 幅, 高さ）
const ground = Bodies.rectangle(250, 690, 500, 40, { 
    isStatic: true, 
    render: { fillStyle: '#555' }
});

// 5. 世界（World）に上で作った物体をすべて追加する
Composite.add(engine.world, [ball, peg, ground]);

// 6. 描画と物理演算の実行！
Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);