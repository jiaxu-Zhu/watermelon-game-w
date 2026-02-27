// 合成大西瓜游戏核心逻辑
class WatermelonGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.nextCanvas = document.getElementById('nextCanvas');
        this.nextCtx = this.nextCanvas.getContext('2d');

        // 计算合适的画布尺寸（基于屏幕宽度）
        const screenWidth = window.innerWidth || document.documentElement.clientWidth;
        const maxWidth = Math.min(screenWidth - 40, 400); // 留出边距，最大400
        const aspectRatio = 2/3; // 宽高比
        const canvasWidth = maxWidth;
        const canvasHeight = canvasWidth / aspectRatio;

        // 游戏配置
        this.config = {
            width: canvasWidth,
            height: canvasHeight,
            gravity: 0.3,
            friction: 0.98,
            bounce: 0.4,
            wallBounce: 0.6,
            fruitRadius: 20,
            dropInterval: 800,
            maxFruits: 50,
            dangerLine: 80 // 固定危险线位置，确保有足够安全空间
        };

        // 水果类型定义（从最小到最大）- 基于画布宽度动态调整
        const baseRadius = this.config.width / 400 * 15; // 基于400px宽度的基准
        this.fruitTypes = [
            { name: '葡萄', radius: baseRadius * 1.0, emoji: '🍇', score: 1 },
            { name: '樱桃', radius: baseRadius * 1.33, emoji: '🍒', score: 2 },
            { name: '橘子', radius: baseRadius * 1.67, emoji: '🍊', score: 4 },
            { name: '柠檬', radius: baseRadius * 2.0, emoji: '🍋', score: 8 },
            { name: '猕猴桃', radius: baseRadius * 2.33, emoji: '🥝', score: 16 },
            { name: '番茄', radius: baseRadius * 2.67, emoji: '🍅', score: 32 },
            { name: '桃子', radius: baseRadius * 3.0, emoji: '🍑', score: 64 },
            { name: '菠萝', radius: baseRadius * 3.33, emoji: '🍍', score: 128 },
            { name: '椰子', radius: baseRadius * 3.67, emoji: '🥥', score: 256 },
            { name: '西瓜', radius: baseRadius * 4.0, emoji: '🍉', score: 512 }
        ];

        this.fruits = [];
        this.currentFruit = null;
        this.nextFruitType = 0;
        this.score = 0;
        this.bestScore = this.loadBestScore();
        this.gameState = 'idle'; // idle, playing, paused, gameover
        this.lastDropTime = 0;
        this.dropPosition = this.config.width / 2;
        this.mouseX = this.config.width / 2;

        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.updateUI();
        this.render();
    }

    setupCanvas() {
        this.canvas.width = this.config.width;
        this.canvas.height = this.config.height;
        this.nextCanvas.width = 60;
        this.nextCanvas.height = 60;
    }

    setupEventListeners() {
        // 鼠标/触摸移动控制
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.touches[0].clientX - rect.left;
        });

        // 点击/触摸释放水果
        this.canvas.addEventListener('click', () => this.dropFruit());
        this.canvas.addEventListener('touchend', () => this.dropFruit());

        // 按钮事件
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
    }

    startGame() {
        if (this.gameState === 'playing') return;

        this.gameState = 'playing';
        this.fruits = [];
        this.score = 0;
        this.lastDropTime = Date.now();
        this.nextFruitType = Math.floor(Math.random() * 3); // 只生成前3种小水果
        this.spawnCurrentFruit();

        document.getElementById('startBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = false;
        document.getElementById('restartBtn').disabled = false;

        this.gameLoop();
    }

    togglePause() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            document.getElementById('pauseBtn').textContent = '继续';
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
            document.getElementById('pauseBtn').textContent = '暂停';
            this.gameLoop();
        }
    }

    restartGame() {
        this.gameState = 'idle';
        this.fruits = [];
        this.score = 0;
        this.updateUI();

        document.getElementById('startBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
        document.getElementById('pauseBtn').textContent = '暂停';
        document.getElementById('restartBtn').disabled = true;

        this.render();
    }

    spawnCurrentFruit() {
        const type = this.fruitTypes[this.nextFruitType];
        this.currentFruit = {
            x: Math.max(type.radius, Math.min(this.config.width - type.radius, this.dropPosition)),
            y: this.config.dangerLine + type.radius + 20, // 确保在危险线下方
            radius: type.radius,
            emoji: type.emoji,
            typeIndex: this.nextFruitType,
            vx: 0,
            vy: 0,
            isDropping: false
        };

        // 生成下一个水果
        this.nextFruitType = Math.floor(Math.random() * 3);
        this.renderNextFruit();
    }

    dropFruit() {
        if (this.gameState !== 'playing' || !this.currentFruit || this.currentFruit.isDropping) return;

        this.currentFruit.isDropping = true;
        this.currentFruit.vy = 0;
    }

    update() {
        if (this.gameState !== 'playing') return;

        const now = Date.now();

        // 自动生成新水果（如果当前水果已掉落）
        if (this.currentFruit && !this.currentFruit.isDropping) {
            // 更新水果位置跟随鼠标
            this.currentFruit.x = Math.max(
                this.currentFruit.radius,
                Math.min(this.config.width - this.currentFruit.radius, this.mouseX)
            );
        }

        // 更新所有水果物理
        for (let i = 0; i < this.fruits.length; i++) {
            const fruit = this.fruits[i];

            if (fruit.isDropping) {
                // 应用重力
                fruit.vy += this.config.gravity;
                fruit.vx *= this.config.friction;
                fruit.vy *= this.config.friction;

                // 更新位置
                fruit.x += fruit.vx;
                fruit.y += fruit.vy;

                // 墙壁碰撞
                if (fruit.x - fruit.radius < 0) {
                    fruit.x = fruit.radius;
                    fruit.vx = -fruit.vx * this.config.wallBounce;
                }
                if (fruit.x + fruit.radius > this.config.width) {
                    fruit.x = this.config.width - fruit.radius;
                    fruit.vx = -fruit.vx * this.config.wallBounce;
                }

                // 底部碰撞
                if (fruit.y + fruit.radius > this.config.height) {
                    fruit.y = this.config.height - fruit.radius;
                    fruit.vy = -fruit.vy * this.config.bounce;

                    // 如果速度很小，停止弹跳
                    if (Math.abs(fruit.vy) < 0.5) {
                        fruit.vy = 0;
                    }
                }
            }

            // 确保所有水果都在画布内（包括静止的）
            fruit.x = Math.max(fruit.radius, Math.min(this.config.width - fruit.radius, fruit.x));
            fruit.y = Math.max(fruit.radius, Math.min(this.config.height - fruit.radius, fruit.y));
        }

        // 碰撞检测和合成
        this.checkCollisions();

        // 检查游戏结束
        if (this.checkGameOver()) {
            this.gameOver();
            return;
        }

        // 生成新水果（当前水果停止运动后）
        if (this.currentFruit && this.currentFruit.isDropping) {
            const current = this.currentFruit;
            if (Math.abs(current.vy) < 0.1 && Math.abs(current.vx) < 0.1) {
                this.fruits.push({...current});
                this.currentFruit = null;
                this.lastDropTime = now; // 重置时间，用于下一次生成
            }
        }

        // 如果没有当前水果且超过间隔时间，生成新水果
        if (!this.currentFruit && now - this.lastDropTime > this.config.dropInterval) {
            this.spawnCurrentFruit();
            this.lastDropTime = now;
        }
    }

    checkCollisions() {
        for (let i = 0; i < this.fruits.length; i++) {
            for (let j = i + 1; j < this.fruits.length; j++) {
                const f1 = this.fruits[i];
                const f2 = this.fruits[j];

                // 只处理静止或缓慢移动的水果
                if (f1.isDropping || f2.isDropping) {
                    const dx = f2.x - f1.x;
                    const dy = f2.y - f1.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const minDistance = f1.radius + f2.radius;

                    if (distance < minDistance) {
                        // 碰撞响应
                        const angle = Math.atan2(dy, dx);
                        const sin = Math.sin(angle);
                        const cos = Math.cos(angle);

                        // 旋转速度
                        const vx1 = f1.vx * cos + f1.vy * sin;
                        const vy1 = f1.vy * cos - f1.vx * sin;
                        const vx2 = f2.vx * cos + f2.vy * sin;
                        const vy2 = f2.vy * cos - f2.vx * sin;

                        // 碰撞后的速度（假设质量与面积成正比）
                        const m1 = f1.radius * f1.radius;
                        const m2 = f2.radius * f2.radius;

                        const newVx1 = ((m1 - m2) * vx1 + 2 * m2 * vx2) / (m1 + m2);
                        const newVx2 = ((m2 - m1) * vx2 + 2 * m1 * vx1) / (m1 + m2);

                        // 旋转回原坐标系
                        f1.vx = newVx1 * cos - vy1 * sin;
                        f1.vy = vy1 * cos + newVx1 * sin;
                        f2.vx = newVx2 * cos - vy2 * sin;
                        f2.vy = vy2 * cos + newVx2 * sin;

                        // 分离重叠的水果
                        const overlap = minDistance - distance;
                        const separationX = overlap * cos * 0.5;
                        const separationY = overlap * sin * 0.5;
                        f1.x -= separationX;
                        f1.y -= separationY;
                        f2.x += separationX;
                        f2.y += separationY;

                        // 检查是否相同类型且可以合成
                        if (f1.typeIndex === f2.typeIndex && f1.typeIndex < this.fruitTypes.length - 1) {
                            this.mergeFruits(i, j);
                            return; // 避免在同一帧多次合并
                        }
                    }
                }
            }
        }
    }

    mergeFruits(index1, index2) {
        const f1 = this.fruits[index1];
        const f2 = this.fruits[index2];
        const newTypeIndex = f1.typeIndex + 1;
        const newType = this.fruitTypes[newTypeIndex];

        // 计算新位置（中点）
        const newX = (f1.x + f2.x) / 2;
        const newY = (f1.y + f2.y) / 2;

        // 移除旧水果
        this.fruits.splice(index2, 1);
        this.fruits.splice(index1, 1);

        // 添加新水果（确保在画布内）
        const newFruit = {
            x: Math.max(newType.radius, Math.min(this.config.width - newType.radius, newX)),
            y: Math.max(newType.radius, Math.min(this.config.height - newType.radius, newY)),
            radius: newType.radius,
            emoji: newType.emoji,
            typeIndex: newTypeIndex,
            vx: 0,
            vy: 0,
            isDropping: false
        };
        this.fruits.push(newFruit);

        // 增加分数
        this.score += newType.score;
        this.updateUI();

        // 播放合成效果（可以添加动画）
        this.playMergeEffect(newX, newY, newType.emoji);
    }

    playMergeEffect(x, y, emoji) {
        // 简单的视觉反馈 - 可以扩展为粒子效果
        // 这里只是占位，实际可以添加更多效果
    }

    checkGameOver() {
        for (const fruit of this.fruits) {
            if (fruit.y - fruit.radius < this.config.dangerLine) {
                return true;
            }
        }
        return false;
    }

    gameOver() {
        this.gameState = 'gameover';

        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            this.saveBestScore();
        }

        this.updateUI();

        document.getElementById('startBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;

        // 显示游戏结束提示
        setTimeout(() => {
            alert(`游戏结束！\n你的分数: ${this.score}\n最高分: ${this.bestScore}`);
        }, 100);
    }

    render() {
        // 清空画布
        this.ctx.clearRect(0, 0, this.config.width, this.config.height);

        // 绘制危险线
        this.ctx.strokeStyle = '#ff4444';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.config.dangerLine);
        this.ctx.lineTo(this.config.width, this.config.dangerLine);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // 绘制所有水果
        for (const fruit of this.fruits) {
            this.drawFruit(fruit);
        }

        // 绘制当前水果
        if (this.currentFruit) {
            this.drawFruit(this.currentFruit);

            // 绘制瞄准线
            this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(this.currentFruit.x, this.currentFruit.y + this.currentFruit.radius);
            this.ctx.lineTo(this.currentFruit.x, this.config.height);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }

        // 绘制下一个水果预览
        this.renderNextFruit();
    }

    drawFruit(fruit) {
        this.ctx.save();

        // 绘制阴影
        this.ctx.beginPath();
        this.ctx.arc(fruit.x + 3, fruit.y + 3, fruit.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.fill();

        // 绘制水果emoji
        this.ctx.font = `${fruit.radius * 2}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(fruit.emoji, fruit.x, fruit.y + fruit.radius * 0.1); // 微调垂直位置

        this.ctx.restore();
    }

    renderNextFruit() {
        this.nextCtx.clearRect(0, 0, 60, 60);

        if (this.nextFruitType !== undefined) {
            const type = this.fruitTypes[this.nextFruitType];
            const centerX = 30;
            const centerY = 30;
            const scale = 0.8;

            this.nextCtx.save();

            // 绘制阴影
            this.nextCtx.beginPath();
            this.nextCtx.arc(centerX + 2, centerY + 2, type.radius * scale, 0, Math.PI * 2);
            this.nextCtx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            this.nextCtx.fill();

            // 绘制水果emoji
            this.nextCtx.font = `${type.radius * scale * 2}px Arial`;
            this.nextCtx.textAlign = 'center';
            this.nextCtx.textBaseline = 'middle';
            this.nextCtx.fillText(type.emoji, centerX, centerY + type.radius * scale * 0.1);

            this.nextCtx.restore();
        }
    }

    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('best-score').textContent = this.bestScore;
    }

    loadBestScore() {
        const saved = localStorage.getItem('watermelonBestScore');
        return saved ? parseInt(saved) : 0;
    }

    saveBestScore() {
        localStorage.setItem('watermelonBestScore', this.bestScore);
    }

    gameLoop() {
        if (this.gameState !== 'playing') return;

        this.update();
        this.render();

        requestAnimationFrame(() => this.gameLoop());
    }
}

// 初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    new WatermelonGame();
});
