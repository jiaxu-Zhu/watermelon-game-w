// 合成大西瓜游戏核心逻辑
class WatermelonGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

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
            gravity: 0.6, // 调整重力，让下落更自然
            friction: 0.99,
            bounce: 0.15,
            wallBounce: 0.3,
            fruitRadius: 20,
            dropInterval: 800,
            maxFruits: 50,
            dangerLine: 80, // 危险线位置
            velocityThreshold: 0.3, // 速度阈值，低于此值停止
            collisionIterations: 3, // 碰撞检测迭代次数
            gridCellSize: 100 // 空间分区网格大小
        };

        // 版本信息
        this.version = {
            number: 'v1.2.0',
            info: '优化重力系统，增加重力值，调整初始位置，避免水果漂浮',
            updateTime: '2026-02-27 09:47'
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
        this.spatialGrid = null; // 空间分区网格

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
        document.getElementById('versionBtn').addEventListener('click', () => this.showVersionInfo());
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
            y: 50, // 从顶部开始下落，有足够加速距离
            radius: type.radius,
            emoji: type.emoji,
            typeIndex: this.nextFruitType,
            vx: 0,
            vy: 0,
            isActive: false // 初始不活跃，点击后才开始下落
        };

        // 生成下一个水果
        this.nextFruitType = Math.floor(Math.random() * 3);
    }

    dropFruit() {
        if (this.gameState !== 'playing' || !this.currentFruit || this.currentFruit.isActive) return;

        this.currentFruit.isActive = true;
        this.currentFruit.vy = 2; // 给一个初始向下速度，避免漂浮感
    }

    update() {
        if (this.gameState !== 'playing') return;

        const now = Date.now();

        // 当前水果跟随鼠标（如果还未下落）
        if (this.currentFruit && !this.currentFruit.isActive) {
            this.currentFruit.x = Math.max(
                this.currentFruit.radius,
                Math.min(this.config.width - this.currentFruit.radius, this.mouseX)
            );
        }

        // 更新所有水果物理（包括当前水果和已落下的水果）
        const allFruits = [...this.fruits];
        if (this.currentFruit && this.currentFruit.isActive) {
            allFruits.push(this.currentFruit);
        }

        for (const fruit of allFruits) {
            // 应用重力（只对活跃水果）
            if (fruit.isActive) {
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

                    // 如果速度很小，停止弹跳并标记为不活跃
                    if (Math.abs(fruit.vy) < this.config.velocityThreshold && Math.abs(fruit.vx) < this.config.velocityThreshold) {
                        fruit.vy = 0;
                        fruit.vx = 0;
                        fruit.isActive = false;
                    }
                }
            }
        }

        // 边界约束 - 对所有静止水果
        for (const fruit of this.fruits) {
            if (!fruit.isActive) {
                fruit.x = Math.max(fruit.radius, Math.min(this.config.width - fruit.radius, fruit.x));
                fruit.y = Math.max(fruit.radius, Math.min(this.config.height - fruit.radius, fruit.y));
            }
        }

        // 使用空间分区进行重叠检测和分离
        this.updateSpatialGrid();
        this.resolveCollisionsWithSpatialGrid();

        // 碰撞检测和合成
        this.checkCollisions();

        // 检查游戏结束
        if (this.checkGameOver()) {
            this.gameOver();
            return;
        }

        // 生成新水果（当前水果停止运动后）
        if (this.currentFruit && !this.currentFruit.isActive) {
            this.fruits.push({...this.currentFruit});
            this.currentFruit = null;
            this.lastDropTime = now; // 重置时间，用于下一次生成
        }

        // 如果没有当前水果且超过间隔时间，生成新水果
        if (!this.currentFruit && now - this.lastDropTime > this.config.dropInterval) {
            this.spawnCurrentFruit();
            this.lastDropTime = now;
        }
    }

    checkCollisions() {
        // 包括当前水果和已落下的水果
        const allFruits = [...this.fruits];
        if (this.currentFruit && this.currentFruit.isActive) {
            allFruits.push(this.currentFruit);
        }

        for (let i = 0; i < allFruits.length; i++) {
            for (let j = i + 1; j < allFruits.length; j++) {
                const f1 = allFruits[i];
                const f2 = allFruits[j];

                const dx = f2.x - f1.x;
                const dy = f2.y - f1.y;
                const distanceSq = dx * dx + dy * dy;
                const minDistance = f1.radius + f2.radius;
                const minDistanceSq = minDistance * minDistance;

                if (distanceSq < minDistanceSq && distanceSq > 0) {
                    const distance = Math.sqrt(distanceSq);

                    // 首先检查是否相同类型且可以合并（合并优先级高于物理碰撞）
                    if (f1.typeIndex === f2.typeIndex && f1.typeIndex < this.fruitTypes.length - 1) {
                        // 注意：需要处理当前水果和已落下的水果合并的情况
                        if (f1 === this.currentFruit && f1.isActive) {
                            // 当前水果与已落下的水果合并
                            this.mergeCurrentWithFruit(f1, f2);
                        } else if (f2 === this.currentFruit && f2.isActive) {
                            this.mergeCurrentWithFruit(f2, f1);
                        } else {
                            // 两个已落下的水果合并
                            const index1 = this.fruits.indexOf(f1);
                            const index2 = this.fruits.indexOf(f2);
                            if (index1 !== -1 && index2 !== -1) {
                                this.mergeFruits(index1, index2);
                            }
                        }
                        return; // 避免在同一帧多次合并
                    }

                    // 不是合并的情况，进行分离和碰撞响应
                    const overlap = minDistance - distance;
                    const separationX = (dx / distance) * overlap * 0.5;
                    const separationY = (dy / distance) * overlap * 0.5;

                    f1.x -= separationX;
                    f1.y -= separationY;
                    f2.x += separationX;
                    f2.y += separationY;

                    // 如果至少有一个水果在运动，应用碰撞响应
                    if (f1.isActive || f2.isActive || Math.abs(f1.vx) > 0.1 || Math.abs(f1.vy) > 0.1 ||
                        Math.abs(f2.vx) > 0.1 || Math.abs(f2.vy) > 0.1) {
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

                        // 确保分离后仍在边界内
                        f1.x = Math.max(f1.radius, Math.min(this.config.width - f1.radius, f1.x));
                        f1.y = Math.max(f1.radius, Math.min(this.config.height - f1.radius, f1.y));
                        f2.x = Math.max(f2.radius, Math.min(this.config.width - f2.radius, f2.x));
                        f2.y = Math.max(f2.radius, Math.min(this.config.height - f2.radius, f2.y));
                    }
                }
            }
        }
    }

    // 空间分区相关方法
    updateSpatialGrid() {
        const cols = Math.ceil(this.config.width / this.config.gridCellSize);
        const rows = Math.ceil(this.config.height / this.config.gridCellSize);
        this.spatialGrid = new Array(cols * rows).fill(null).map(() => []);

        // 将所有静止水果放入网格
        for (let i = 0; i < this.fruits.length; i++) {
            const fruit = this.fruits[i];
            if (!fruit.isActive) {
                const col = Math.floor(fruit.x / this.config.gridCellSize);
                const row = Math.floor(fruit.y / this.config.gridCellSize);
                const index = row * cols + col;
                if (index >= 0 && index < this.spatialGrid.length) {
                    this.spatialGrid[index].push(i);
                }
            }
        }
    }

    resolveCollisionsWithSpatialGrid() {
        const cols = Math.ceil(this.config.width / this.config.gridCellSize);
        const cellSize = this.config.gridCellSize;

        for (let row = 0; row < Math.ceil(this.config.height / cellSize); row++) {
            for (let col = 0; col < cols; col++) {
                const cellIndex = row * cols + col;
                const fruitsInCell = this.spatialGrid[cellIndex];

                if (fruitsInCell.length < 2) continue;

                // 检查同一单元格内的水果
                for (let i = 0; i < fruitsInCell.length; i++) {
                    for (let j = i + 1; j < fruitsInCell.length; j++) {
                        const idx1 = fruitsInCell[i];
                        const idx2 = fruitsInCell[j];

                        if (idx1 >= this.fruits.length || idx2 >= this.fruits.length) continue;

                        const f1 = this.fruits[idx1];
                        const f2 = this.fruits[idx2];

                        const dx = f2.x - f1.x;
                        const dy = f2.y - f1.y;
                        const distanceSq = dx * dx + dy * dy;
                        const minDistance = f1.radius + f2.radius;
                        const minDistanceSq = minDistance * minDistance;

                        if (distanceSq < minDistanceSq && distanceSq > 0) {
                            const distance = Math.sqrt(distanceSq);
                            const overlap = minDistance - distance;
                            const separationX = (dx / distance) * overlap * 0.5;
                            const separationY = (dy / distance) * overlap * 0.5;

                            f1.x -= separationX;
                            f1.y -= separationY;
                            f2.x += separationX;
                            f2.y += separationY;

                            // 确保在边界内
                            f1.x = Math.max(f1.radius, Math.min(this.config.width - f1.radius, f1.x));
                            f1.y = Math.max(f1.radius, Math.min(this.config.height - f1.radius, f1.y));
                            f2.x = Math.max(f2.radius, Math.min(this.config.width - f2.radius, f2.x));
                            f2.y = Math.max(f2.radius, Math.min(this.config.height - f2.radius, f2.y));
                        }
                    }
                }

                // 检查相邻单元格（右、下、右下、左下）
                const neighbors = [
                    { c: col + 1, r: row },
                    { c: col, r: row + 1 },
                    { c: col + 1, r: row + 1 },
                    { c: col - 1, r: row + 1 }
                ];

                for (const neighbor of neighbors) {
                    if (neighbor.c < 0 || neighbor.c >= cols || neighbor.r < 0 || neighbor.r >= Math.ceil(this.config.height / cellSize)) {
                        continue;
                    }

                    const neighborIndex = neighbor.r * cols + neighbor.c;
                    const neighborFruits = this.spatialGrid[neighborIndex];

                    for (const idx1 of fruitsInCell) {
                        for (const idx2 of neighborFruits) {
                            if (idx1 >= this.fruits.length || idx2 >= this.fruits.length) continue;

                            const f1 = this.fruits[idx1];
                            const f2 = this.fruits[idx2];

                            const dx = f2.x - f1.x;
                            const dy = f2.y - f1.y;
                            const distanceSq = dx * dx + dy * dy;
                            const minDistance = f1.radius + f2.radius;
                            const minDistanceSq = minDistance * minDistance;

                            if (distanceSq < minDistanceSq && distanceSq > 0) {
                                const distance = Math.sqrt(distanceSq);
                                const overlap = minDistance - distance;
                                const separationX = (dx / distance) * overlap * 0.5;
                                const separationY = (dy / distance) * overlap * 0.5;

                                f1.x -= separationX;
                                f1.y -= separationY;
                                f2.x += separationX;
                                f2.y += separationY;

                                // 确保在边界内
                                f1.x = Math.max(f1.radius, Math.min(this.config.width - f1.radius, f1.x));
                                f1.y = Math.max(f1.radius, Math.min(this.config.height - f1.radius, f1.y));
                                f2.x = Math.max(f2.radius, Math.min(this.config.width - f2.radius, f2.x));
                                f2.y = Math.max(f2.radius, Math.min(this.config.height - f2.radius, f2.y));
                            }
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

        // 移除旧水果（注意：先移除索引大的，避免索引变化）
        if (index1 < index2) {
            this.fruits.splice(index2, 1);
            this.fruits.splice(index1, 1);
        } else {
            this.fruits.splice(index1, 1);
            this.fruits.splice(index2, 1);
        }

        // 添加新水果（确保在画布内）
        const newFruit = {
            x: Math.max(newType.radius, Math.min(this.config.width - newType.radius, newX)),
            y: Math.max(newType.radius, Math.min(this.config.height - newType.radius, newY)),
            radius: newType.radius,
            emoji: newType.emoji,
            typeIndex: newTypeIndex,
            vx: 0,
            vy: 0,
            isActive: false
        };
        this.fruits.push(newFruit);

        // 增加分数
        this.score += newType.score;
        this.updateUI();

        // 播放合成效果
        this.playMergeEffect(newX, newY, newType.emoji);
    }

    mergeCurrentWithFruit(currentFruit, existingFruit) {
        const newTypeIndex = currentFruit.typeIndex + 1;
        const newType = this.fruitTypes[newTypeIndex];

        // 计算新位置（中点）
        const newX = (currentFruit.x + existingFruit.x) / 2;
        const newY = (currentFruit.y + existingFruit.y) / 2;

        // 移除已存在的旧水果
        const existingIndex = this.fruits.indexOf(existingFruit);
        if (existingIndex !== -1) {
            this.fruits.splice(existingIndex, 1);
        }

        // 清除当前水果
        this.currentFruit = null;

        // 生成新水果并立即加入已落下的水果数组
        const newFruit = {
            x: Math.max(newType.radius, Math.min(this.config.width - newType.radius, newX)),
            y: Math.max(newType.radius, Math.min(this.config.height - newType.radius, newY)),
            radius: newType.radius,
            emoji: newType.emoji,
            typeIndex: newTypeIndex,
            vx: 0,
            vy: 0,
            isActive: false
        };
        this.fruits.push(newFruit);

        // 增加分数
        this.score += newType.score;
        this.updateUI();

        // 播放合成效果
        this.playMergeEffect(newX, newY, newType.emoji);
    }

    playMergeEffect(x, y, emoji) {
        // 简单的视觉反馈 - 可以扩展为粒子效果
        // 这里只是占位，实际可以添加更多效果
    }

    checkGameOver() {
        // 只检查已落下的静止水果（this.fruits），不检查当前准备下落的 fruit
        for (const fruit of this.fruits) {
            // 只检查不活跃（已静止）的水果
            if (!fruit.isActive && fruit.y - fruit.radius < this.config.dangerLine) {
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


    }

    drawFruit(fruit) {
        this.ctx.save();

        // 直接绘制水果emoji（无阴影）
        this.ctx.font = `${fruit.radius * 2}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(fruit.emoji, fruit.x, fruit.y + fruit.radius * 0.1);

        this.ctx.restore();
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

        // 使用 requestAnimationFrame 但确保在游戏结束时停止
        if (this.gameState === 'playing') {
            requestAnimationFrame(() => this.gameLoop());
        }
    }

    showVersionInfo() {
        const modal = document.getElementById('versionModal');
        const closeBtn = modal.querySelector('.close');

        // 更新版本信息
        document.getElementById('versionNumber').textContent = this.version.number;
        document.getElementById('versionInfo').textContent = this.version.info;
        document.getElementById('updateTime').textContent = this.version.updateTime;

        // 显示模态框
        modal.style.display = 'block';

        // 点击关闭按钮关闭
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };

        // 点击模态框外部关闭
        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };
    }
}

// 初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    new WatermelonGame();
});
