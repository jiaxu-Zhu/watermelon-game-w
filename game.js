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
            { emoji: '🍇', scale: 0.075, color: '#9b59b6', score: 1 },
            { emoji: '🍒', scale: 0.085, color: '#e74c3c', score: 2 },
            { emoji: '🍊', scale: 0.095, color: '#f39c12', score: 4 },
            { emoji: '🍋', scale: 0.105, color: '#f1c40f', score: 8 },
            { emoji: '🥝', scale: 0.115, color: '#2ecc71', score: 16 },
            { emoji: '🍅', scale: 0.125, color: '#e67e22', score: 32 },
            { emoji: '🍑', scale: 0.135, color: '#ff9ff3', score: 64 },
            { emoji: '🍍', scale: 0.145, color: '#fdcb6e', score: 128 },
            { emoji: '🥥', scale: 0.155, color: '#dfe6e9', score: 256 },
            { emoji: '🍉', scale: 0.165, color: '#27ae60', score: 512 }
        ];

        // 物理配置
        this.config = {
            gravity: 0.5,
            friction: 0.98,
            bounce: 0.3,
            wallBounce: 0.4,
            velocityThreshold: 0.1,
            collisionIterations: 20, // 增加迭代次数，更彻底解决重叠
            dangerLineRatio: 0.15, // 危险线在顶部15%位置
            dropPosition: this.canvas.width / 2,
            minSeparationForce: 0.3, // 减小最小分离力度，让水果更容易接触
            mergeSpeedThreshold: 0.15 // 降低合并速度阈值，提高合并率
        };

        // 游戏对象
        this.fruits = [];
        this.currentFruit = null;
        this.nextFruitType = 0;
        this.particles = [];
        this.lastDropTime = 0;
        this.dropCooldown = 300; // 毫秒
        this.pendingMerges = []; // 待处理的合并（延迟合并避免遍历时修改数组）

        // 版本信息
        this.version = 'v2.4.0';
        this.updateDate = '2026-02-28';

        // 初始化
        this.init();
    }

    setupCanvas() {
        // 计算可用高度（减去其他UI元素的高度）
        const headerHeight = 80; // 标题+分数板
        const controlsHeight = 60; // 按钮
        const padding = 20; // 容器padding
        const modalSpace = 100; // 模态框预留空间

        // 使用更精确的可用高度计算，考虑手机端浏览器UI
        const availableHeight = window.innerHeight - headerHeight - controlsHeight - padding - modalSpace;
        const maxWidth = window.innerWidth - 40; // 尽可能宽
        const aspectRatio = 2 / 3; // 宽高比 2:3

        // 根据可用高度计算最大宽度
        let maxCanvasHeight = availableHeight;
        let maxCanvasWidth = maxCanvasHeight * aspectRatio;

        // 取较小值作为画布宽度，但至少保证最小尺寸（增加到360px以获得更大的水果）
        const canvasWidth = Math.max(360, Math.min(maxWidth, maxCanvasWidth));
        const canvasHeight = canvasWidth / aspectRatio;

        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;
        this.canvas.style.width = canvasWidth + 'px';
        this.canvas.style.height = canvasHeight + 'px';

        // 确保容器不会超出屏幕
        const container = document.querySelector('.game-container');
        if (container) {
            const containerHeight = headerHeight + canvasHeight + controlsHeight + padding * 2;
            if (containerHeight > window.innerHeight * 0.95) {
                // 如果超出，重新计算画布高度
                const newCanvasHeight = window.innerHeight * 0.95 - headerHeight - controlsHeight - padding * 2;
                const newCanvasWidth = newCanvasHeight * aspectRatio;
                if (newCanvasWidth >= 360) {
                    this.canvas.width = newCanvasWidth;
                    this.canvas.height = newCanvasHeight;
                    this.canvas.style.width = newCanvasWidth + 'px';
                    this.canvas.style.height = newCanvasHeight + 'px';
                }
            }
        }
    }

    init() {
        // 事件监听
        this.canvas.addEventListener('click', () => this.dropFruit());
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
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
        document.getElementById('versionBtn').addEventListener('click', () => {
            this.showVersionModal();
        });
        document.getElementById('closeVersionBtn').addEventListener('click', () => {
            document.getElementById('versionModal').classList.add('hidden');
        });
        document.getElementById('modalRestartBtn').addEventListener('click', () => {
            document.getElementById('gameOverModal').classList.add('hidden');
            this.restartGame();
        });

        // 窗口调整
        window.addEventListener('resize', () => {
            // 保存当前水果位置比例
            let currentFruitRatio = 0.5;
            if (this.currentFruit) {
                currentFruitRatio = this.currentFruit.x / this.canvas.width;
            }

            this.setupCanvas();
            this.config.dropPosition = this.canvas.width / 2;

            // 重新调整所有水果大小和位置
            this.fruits.forEach(fruit => {
                const newType = this.getFruitType(fruit.typeIndex);
                const oldRadius = fruit.radius;
                fruit.radius = newType.radius;

                // 按比例调整位置，保持相对位置
                fruit.x = (fruit.x / oldRadius) * newType.radius;
                fruit.y = (fruit.y / oldRadius) * newType.radius;
            });

            // 调整当前水果大小和位置
            if (this.currentFruit) {
                const newType = this.getFruitType(this.currentFruit.typeIndex);
                const oldRadius = this.currentFruit.radius;
                this.currentFruit.radius = newType.radius;
                this.currentFruit.x = Math.max(this.currentFruit.radius, Math.min(this.canvas.width - this.currentFruit.radius, currentFruitRatio * this.canvas.width));
                this.currentFruit.y = this.currentFruit.radius + 10;
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

    handleMouseMove(e) {
        if (this.gameState !== 'playing' || !this.currentFruit) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const type = this.getFruitType(this.currentFruit.typeIndex);
        this.config.dropPosition = Math.max(type.radius, Math.min(this.canvas.width - type.radius, x));
        this.currentFruit.x = this.config.dropPosition;
        this.draw();
    }

    handleTouchMove(e) {
        if (this.gameState !== 'playing' || !this.currentFruit) return;
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const type = this.getFruitType(this.currentFruit.typeIndex);
        this.config.dropPosition = Math.max(type.radius, Math.min(this.canvas.width - type.radius, x));
        this.currentFruit.x = this.config.dropPosition;
        this.draw();
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

                // 分离重叠的水果 - 使用温和的分离策略，避免过度分离
                // 根据质量比例分配分离距离，但确保最小分离力
                const totalRadius = activeFruit.radius + other.radius;
                const ratio1 = other.radius / totalRadius;
                const ratio2 = activeFruit.radius / totalRadius;

                const separationX = overlap * cos;
                const separationY = overlap * sin;

                // 应用分离，但使用更小的分离力度，让水果更容易保持接触
                const minSeparation = this.config.minSeparationForce;
                const actualSeparationX = separationX > 0 ? Math.max(separationX * 0.5, minSeparation * cos) : Math.min(separationX * 0.5, -minSeparation * cos);
                const actualSeparationY = separationY > 0 ? Math.max(separationY * 0.5, minSeparation * sin) : Math.min(separationY * 0.5, -minSeparation * sin);

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

                // 检查是否相同等级且相对速度很小（稳定接触）
                // 使用相对速度判断，避免高速碰撞时误合并
                const relVx = activeFruit.vx - other.vx;
                const relVy = activeFruit.vy - other.vy;
                const relSpeed = Math.sqrt(relVx * relVx + relVy * relVy);

                // 合并条件：相同等级 + 相对速度小 + 重叠（已满足）
                // 放宽条件：只要相对速度小于阈值，或者两个都几乎静止
                // 进一步优化：考虑重叠深度，重叠越多越容易合并
                const overlapRatio = overlap / (activeFruit.radius + other.radius);
                const bothStationary = Math.abs(activeFruit.vy) < 0.08 && Math.abs(other.vy) < 0.08 &&
                                      Math.abs(activeFruit.vx) < 0.08 && Math.abs(other.vx) < 0.08;

                if (activeFruit.typeIndex === other.typeIndex &&
                    activeFruit.typeIndex < this.baseFruitTypes.length - 1 &&
                    (relSpeed < this.config.mergeSpeedThreshold ||
                     bothStationary ||
                     overlapRatio > 0.3)) { // 重叠超过30%也触发合并

                    // 延迟合并：记录待合并项，不立即修改数组
                    this.pendingMerges.push({
                        fruit1: activeFruit,
                        fruit2: other
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

        // 去重：使用水果对象引用，确保每个水果只被合并一次
        const mergedFruits = new Set();
        const validMerges = [];

        for (const merge of this.pendingMerges) {
            if (!mergedFruits.has(merge.fruit1) && !mergedFruits.has(merge.fruit2)) {
                validMerges.push(merge);
                mergedFruits.add(merge.fruit1);
                mergedFruits.add(merge.fruit2);
            }
        }

        // 清空待合并列表
        this.pendingMerges = [];

        // 执行合并（不依赖索引，而是查找水果位置）
        for (const merge of validMerges) {
            const idx1 = this.fruits.indexOf(merge.fruit1);
            const idx2 = this.fruits.indexOf(merge.fruit2);

            // 确保两个水果都还在数组中
            if (idx1 !== -1 && idx2 !== -1) {
                const result = this.mergeFruits(merge.fruit1, merge.fruit2, idx1, idx2);

                // 按索引降序删除
                const first = Math.min(result.index1, result.index2);
                const second = Math.max(result.index1, result.index2);

                this.fruits.splice(second, 1);
                this.fruits.splice(first, 1);

                // 添加新水果
                this.fruits.push(result.newFruit);
            }
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

    showVersionModal() {
        document.getElementById('currentVersion').textContent = this.version;
        document.getElementById('updateTime').textContent = this.updateDate;
        document.getElementById('versionModal').classList.remove('hidden');
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
