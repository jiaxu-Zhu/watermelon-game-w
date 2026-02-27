// 合成大西瓜游戏 - 精美版
class WatermelonGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // 响应式画布尺寸
        this.setupCanvas();

        // 游戏状态
        this.gameState = 'idle'; // idle, playing, paused, gameover
        this.score = 0;
        this.bestScore = localStorage.getItem('watermelonBestScore') || 0;

        // 水果定义（10个等级）- 半径将根据画布宽度动态计算
        this.baseFruitTypes = [
            { emoji: '🍇', scale: 0.04, color: '#9b59b6', score: 1 },
            { emoji: '🍒', scale: 0.05, color: '#e74c3c', score: 2 },
            { emoji: '🍊', scale: 0.06, color: '#f39c12', score: 4 },
            { emoji: '🍋', scale: 0.07, color: '#f1c40f', score: 8 },
            { emoji: '🥝', scale: 0.08, color: '#2ecc71', score: 16 },
            { emoji: '🍅', scale: 0.09, color: '#e67e22', score: 32 },
            { emoji: '🍑', scale: 0.10, color: '#ff9ff3', score: 64 },
            { emoji: '🍍', scale: 0.11, color: '#fdcb6e', score: 128 },
            { emoji: '🥥', scale: 0.12, color: '#dfe6e9', score: 256 },
            { emoji: '🍉', scale: 0.13, color: '#27ae60', score: 512 }
        ];

        // 物理配置
        this.config = {
            gravity: 0.5,
            friction: 0.98,
            bounce: 0.3,
            wallBounce: 0.4,
            velocityThreshold: 0.1,
            collisionIterations: 8, // 增加迭代次数，更彻底解决重叠
            dangerLineRatio: 0.15, // 危险线在顶部15%位置
            dropPosition: this.canvas.width / 2,
            minSeparationForce: 0.5 // 最小分离力度
        };

        // 游戏对象
        this.fruits = [];
        this.currentFruit = null;
        this.nextFruitType = 0;
        this.particles = [];
        this.lastDropTime = 0;
        this.dropCooldown = 300; // 毫秒
        this.pendingMerges = []; // 待处理的合并（延迟合并避免遍历时修改数组）

        // 初始化
        this.init();
    }

    setupCanvas() {
        // 计算可用高度（减去其他UI元素的高度）
        const headerHeight = 80; // 标题+分数板
        const controlsHeight = 60; // 按钮
        const instructionsHeight = 80; // 游戏说明（现在更紧凑）
        const padding = 50; // 容器padding和其他间距
        const modalSpace = 100; // 模态框预留空间

        const availableHeight = window.innerHeight - headerHeight - controlsHeight - instructionsHeight - padding - modalSpace;
        const maxWidth = Math.min(window.innerWidth - 40, 400);
        const aspectRatio = 2 / 3; // 宽高比 2:3

        // 根据可用高度计算最大宽度
        const maxCanvasHeight = availableHeight;
        const maxCanvasWidth = maxCanvasHeight * aspectRatio;

        // 取较小值作为画布宽度
        const canvasWidth = Math.min(maxWidth, maxCanvasWidth);
        const canvasHeight = canvasWidth / aspectRatio;

        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;
        this.canvas.style.width = canvasWidth + 'px';
        this.canvas.style.height = canvasHeight + 'px';
    }

    init() {
        // 事件监听
        this.canvas.addEventListener('click', () => this.dropFruit());
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.dropFruit();
        });

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.dropFruit();
            }
        });

        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('rulesBtn').addEventListener('click', () => {
            document.getElementById('rulesModal').classList.remove('hidden');
        });
        document.getElementById('closeRulesBtn').addEventListener('click', () => {
            document.getElementById('rulesModal').classList.add('hidden');
        });
        document.getElementById('modalRestartBtn').addEventListener('click', () => {
            document.getElementById('gameOverModal').classList.add('hidden');
            this.restartGame();
        });

        // 窗口调整
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.config.dropPosition = this.canvas.width / 2;
            // 重新调整所有水果大小
            this.fruits.forEach(fruit => {
                const newType = this.getFruitType(fruit.typeIndex);
                fruit.radius = newType.radius;
            });
            // 调整当前水果大小
            if (this.currentFruit) {
                const newType = this.getFruitType(this.currentFruit.typeIndex);
                this.currentFruit.radius = newType.radius;
            }
        });

        // 初始化显示
        this.updateScoreDisplay();
        this.draw();
    }

    startGame() {
        if (this.gameState === 'playing') return;

        this.gameState = 'playing';
        this.score = 0;
        this.fruits = [];
        this.particles = [];
        this.nextFruitType = Math.floor(Math.random() * 3);
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
        this.score = 0;
        this.fruits = [];
        this.particles = [];
        this.currentFruit = null;

        document.getElementById('startBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
        document.getElementById('pauseBtn').textContent = '暂停';
        document.getElementById('restartBtn').disabled = true;

        this.updateScoreDisplay();
        this.updateNextFruitPreview();
        this.draw();
    }

    spawnCurrentFruit() {
        const type = this.getFruitType(this.nextFruitType);
        this.currentFruit = {
            x: Math.max(type.radius, Math.min(this.canvas.width - type.radius, this.config.dropPosition)),
            y: type.radius + 10,
            radius: type.radius,
            typeIndex: this.nextFruitType,
            vx: 0,
            vy: 0,
            isActive: false
        };

        // 生成下一个水果（前3种小水果）
        this.nextFruitType = Math.floor(Math.random() * 3);
    }

    getFruitType(typeIndex) {
        const base = this.baseFruitTypes[typeIndex];
        return {
            emoji: base.emoji,
            radius: this.canvas.width * base.scale,
            color: base.color,
            score: base.score
        };
    }

    dropFruit() {
        if (this.gameState !== 'playing' || !this.currentFruit) return;

        const now = Date.now();
        if (now - this.lastDropTime < this.dropCooldown) return;

        this.lastDropTime = now;
        this.currentFruit.isActive = true;
        this.currentFruit.vy = 0.5;
        this.fruits.push(this.currentFruit);
        this.spawnCurrentFruit();
    }

    update() {
        if (this.gameState !== 'playing') return;

        const dangerLine = this.canvas.height * this.config.dangerLineRatio;

        // 更新所有水果
        for (let i = this.fruits.length - 1; i >= 0; i--) {
            const fruit = this.fruits[i];

            if (fruit.isActive) {
                // 应用重力
                fruit.vy += this.config.gravity;
                fruit.vy *= this.config.friction;
                fruit.vx *= this.config.friction;

                // 更新位置
                fruit.x += fruit.vx;
                fruit.y += fruit.vy;

                // 边界碰撞
                if (fruit.x - fruit.radius < 0) {
                    fruit.x = fruit.radius;
                    fruit.vx = -fruit.vx * this.config.wallBounce;
                }
                if (fruit.x + fruit.radius > this.canvas.width) {
                    fruit.x = this.canvas.width - fruit.radius;
                    fruit.vx = -fruit.vx * this.config.wallBounce;
                }
                if (fruit.y + fruit.radius > this.canvas.height) {
                    fruit.y = this.canvas.height - fruit.radius;
                    fruit.vy = -fruit.vy * this.config.bounce;

                    // 速度很小时停止
                    if (Math.abs(fruit.vy) < this.config.velocityThreshold) {
                        fruit.vy = 0;
                        fruit.isActive = false;
                    }
                }
            }

            // 强制边界限制（防止任何情况下水果出界）
            fruit.x = Math.max(fruit.radius, Math.min(this.canvas.width - fruit.radius, fruit.x));
            fruit.y = Math.max(fruit.radius, Math.min(this.canvas.height - fruit.radius, fruit.y));
        }

        // 多次迭代碰撞检测（解决重叠问题）- 对所有水果进行全局迭代
        for (let iter = 0; iter < this.config.collisionIterations; iter++) {
            for (let i = 0; i < this.fruits.length; i++) {
                this.checkCollisions(this.fruits[i], i);
            }
            // 每次全局迭代后强制所有水果在边界内
            this.fruits.forEach(fruit => {
                fruit.x = Math.max(fruit.radius, Math.min(this.canvas.width - fruit.radius, fruit.x));
                fruit.y = Math.max(fruit.radius, Math.min(this.canvas.height - fruit.radius, fruit.y));
            });
        }

        // 处理延迟合并（避免遍历时修改数组）
        this.processPendingMerges();

        // 检查游戏结束（只检查静止的水果）
        for (let i = 0; i < this.fruits.length; i++) {
            const fruit = this.fruits[i];
            if (!fruit.isActive && fruit.y - fruit.radius < dangerLine) {
                this.gameOver();
                return;
            }
        }

        // 更新粒子
        this.updateParticles();
    }

    checkCollisions(activeFruit, activeIndex) {
        for (let i = 0; i < this.fruits.length; i++) {
            if (i === activeIndex) continue;

            const other = this.fruits[i];

            const dx = activeFruit.x - other.x;
            const dy = activeFruit.y - other.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDist = activeFruit.radius + other.radius;

            if (distance < minDist && distance > 0) {
                // 计算重叠量
                const overlap = minDist - distance;
                const angle = Math.atan2(dy, dx);
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);

                // 分离重叠的水果 - 使用更激进的分离策略
                // 根据质量比例分配分离距离，但确保最小分离力
                const totalRadius = activeFruit.radius + other.radius;
                const ratio1 = other.radius / totalRadius;
                const ratio2 = activeFruit.radius / totalRadius;

                const separationX = overlap * cos;
                const separationY = overlap * sin;

                // 应用分离，确保至少移动最小分离力
                const minSeparation = this.config.minSeparationForce;
                const actualSeparationX = separationX > 0 ? Math.max(separationX, minSeparation * cos) : Math.min(separationX, -minSeparation * cos);
                const actualSeparationY = separationY > 0 ? Math.max(separationY, minSeparation * sin) : Math.min(separationY, -minSeparation * sin);

                activeFruit.x += actualSeparationX * ratio1;
                activeFruit.y += actualSeparationY * ratio1;
                other.x -= actualSeparationX * ratio2;
                other.y -= actualSeparationY * ratio2;

                // 速度传递（即使一个水果是静止的，也要传递一些速度）- 但相同水果不传递，避免干扰合并
                const speedTransfer = 0.2; // 速度传递系数

                if (activeFruit.isActive || other.isActive) {
                    // 旋转速度
                    const vx1 = activeFruit.vx * cos + activeFruit.vy * sin;
                    const vy1 = activeFruit.vy * cos - activeFruit.vx * sin;
                    const vx2 = other.vx * cos + other.vy * sin;
                    const vy2 = other.vy * cos - other.vx * sin;

                    // 碰撞后的速度（假设质量与面积成正比）
                    const m1 = activeFruit.radius * activeFruit.radius;
                    const m2 = other.radius * other.radius;

                    const newVx1 = ((m1 - m2) * vx1 + 2 * m2 * vx2) / (m1 + m2);
                    const newVx2 = ((m2 - m1) * vx2 + 2 * m1 * vx1) / (m1 + m2);

                    // 旋转回来
                    activeFruit.vx = newVx1 * cos - vy1 * sin;
                    activeFruit.vy = vy1 * cos + newVx1 * sin;
                    other.vx = newVx2 * cos - vy2 * sin;
                    other.vy = vy2 * cos + newVx2 * sin;

                    // 如果其中一个静止且类型不同，给静止的施加一点速度，防止再次重叠
                    if (!activeFruit.isActive && activeFruit.typeIndex !== other.typeIndex) {
                        activeFruit.vx = other.vx * speedTransfer;
                        activeFruit.vy = other.vy * speedTransfer;
                    }
                    if (!other.isActive && activeFruit.typeIndex !== other.typeIndex) {
                        other.vx = activeFruit.vx * speedTransfer;
                        other.vy = activeFruit.vy * speedTransfer;
                    }
                }

                // 检查是否相同等级且速度都很小（放宽条件，允许合并）
                // 不要求 isActive 状态，只要求速度足够小
                const bothSlow = Math.abs(activeFruit.vx) < 0.4 && Math.abs(activeFruit.vy) < 0.4 &&
                                 Math.abs(other.vx) < 0.4 && Math.abs(other.vy) < 0.4;

                if (bothSlow &&
                    activeFruit.typeIndex === other.typeIndex &&
                    activeFruit.typeIndex < this.baseFruitTypes.length - 1) {

                    // 延迟合并：记录待合并项，不立即修改数组
                    this.pendingMerges.push({
                        fruit1: activeFruit,
                        fruit2: other,
                        index1: activeIndex,
                        index2: i
                    });
                }
            }
        }
    }

    mergeFruits(fruit1, fruit2, index1, index2) {
        const newTypeIndex = fruit1.typeIndex + 1;
        const newType = this.getFruitType(newTypeIndex);

        // 计算新位置（中点）
        const newX = (fruit1.x + fruit2.x) / 2;
        const newY = (fruit1.y + fruit2.y) / 2;

        // 创建合并粒子效果
        this.createMergeParticles(fruit1.x, fruit1.y, fruit1.radius, fruit1.typeIndex);
        this.createMergeParticles(fruit2.x, fruit2.y, fruit2.radius, fruit2.typeIndex);

        // 加分
        this.addScore(newType.score * 2);

        // 返回合并后的新水果信息，不直接修改数组
        return {
            index1: Math.min(index1, index2),
            index2: Math.max(index1, index2),
            newFruit: {
                x: newX,
                y: newY,
                radius: newType.radius,
                typeIndex: newTypeIndex,
                vx: 0,
                vy: 0,
                isActive: false
            }
        };
    }

    processPendingMerges() {
        if (this.pendingMerges.length === 0) return;

        // 去重：确保每个水果只被合并一次
        const mergedIndices = new Set();
        const validMerges = [];

        for (const merge of this.pendingMerges) {
            if (!mergedIndices.has(merge.index1) && !mergedIndices.has(merge.index2)) {
                validMerges.push(merge);
                mergedIndices.add(merge.index1);
                mergedIndices.add(merge.index2);
            }
        }

        // 清空待合并列表
        this.pendingMerges = [];

        // 按索引降序排序，确保删除时不影响后续索引
        validMerges.sort((a, b) => b.index2 - a.index2);

        // 执行合并
        for (const merge of validMerges) {
            const result = this.mergeFruits(merge.fruit1, merge.fruit2, merge.index1, merge.index2);
            // 删除旧水果
            this.fruits.splice(result.index2, 1);
            this.fruits.splice(result.index1, 1);
            // 添加新水果
            this.fruits.push(result.newFruit);
        }
    }

    createMergeParticles(x, y, radius, typeIndex) {
        const baseType = this.baseFruitTypes[typeIndex];
        const particleCount = 8;

        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const speed = 2 + Math.random() * 2;

            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: radius * 0.3,
                color: baseType.color,
                life: 1.0,
                decay: 0.02 + Math.random() * 0.02
            });
        }
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1;
            p.life -= p.decay;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    addScore(points) {
        this.score += points;
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('watermelonBestScore', this.bestScore);
        }
        this.updateScoreDisplay();
    }

    updateScoreDisplay() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('bestScore').textContent = this.bestScore;
    }

    gameOver() {
        this.gameState = 'gameover';
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOverModal').classList.remove('hidden');
    }

    draw() {
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制背景渐变
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#f0f4f8');
        gradient.addColorStop(1, '#d9e2ec');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制危险线
        const dangerLine = this.canvas.height * this.config.dangerLineRatio;
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, dangerLine);
        this.ctx.lineTo(this.canvas.width, dangerLine);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // 绘制危险线文字
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        this.ctx.font = '12px Arial';
        this.ctx.fillText('危险线', 10, dangerLine - 5);

        // 绘制粒子
        this.particles.forEach(p => {
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;

        // 绘制所有水果
        this.fruits.forEach(fruit => {
            this.drawFruit(fruit);
        });

        // 绘制当前准备下落的的水果
        if (this.currentFruit && this.gameState === 'playing') {
            this.drawFruit(this.currentFruit);

            // 绘制预览轨迹
            this.ctx.strokeStyle = 'rgba(102, 126, 234, 0.3)';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(this.currentFruit.x, this.currentFruit.y);
            this.ctx.lineTo(this.currentFruit.x, this.canvas.height);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
    }

    drawFruit(fruit) {
        const baseType = this.baseFruitTypes[fruit.typeIndex];

        // 阴影
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        this.ctx.shadowBlur = 8;
        this.ctx.shadowOffsetX = 2;
        this.ctx.shadowOffsetY = 2;

        // 背景圆
        this.ctx.fillStyle = baseType.color;
        this.ctx.beginPath();
        this.ctx.arc(fruit.x, fruit.y, fruit.radius, 0, Math.PI * 2);
        this.ctx.fill();

        // 重置阴影
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;

        // 绘制emoji
        this.ctx.font = fruit.radius * 1.5 + 'px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(baseType.emoji, fruit.x, fruit.y);
    }

    gameLoop() {
        if (this.gameState !== 'playing') return;

        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// 启动游戏
window.addEventListener('DOMContentLoaded', () => {
    new WatermelonGame();
});
