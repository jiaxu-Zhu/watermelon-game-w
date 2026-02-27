# 合成大西瓜 - Watermelon Game

一个基于HTML5 Canvas的合成大西瓜游戏，完全在浏览器中运行，无需后端。

## 游戏特色

- 🎮 流畅的物理引擎
- 🎨 精美的水果设计和动画
- 📱 支持鼠标和触摸操作
- 🏆 本地最高分记录
- 🚀 完全客户端运行

## 快速开始

### 本地运行

1. 克隆或下载本项目
2. 用浏览器打开 `index.html` 文件
3. 点击"开始游戏"即可游玩

### 在线部署

本项目可以轻松部署到 GitHub Pages、Vercel、Netlify 等静态托管平台。

#### GitHub Pages 部署步骤：

1. 在 GitHub 创建新仓库（例如：`watermelon-game-w`）
2. 将本项目所有文件推送到仓库
3. 在仓库设置中启用 GitHub Pages
4. 选择 `main` 分支作为源
5. 访问 `https://你的用户名.github.io/watermelon-game-w/`

## 游戏规则

1. **移动**：点击屏幕左右两侧或移动鼠标来控制水果下落位置
2. **下落**：点击屏幕释放水果
3. **合成**：相同水果碰撞会合成更大的水果
4. **目标**：合成最大的水果——西瓜！
5. **失败**：水果堆积超过顶部红线时游戏结束

## 水果等级

游戏包含10个等级的水果，从最小到最大：

1. 🍇 葡萄 (1分)
2. 🍒 樱桃 (2分)
3. 🍊 橘子 (4分)
4. 🍋 柠檬 (8分)
5. 🥝 猕猴桃 (16分)
6. 🍅 番茄 (32分)
7. 🍑 桃子 (64分)
8. 🍍 菠萝 (128分)
9. 🥥 椰子 (256分)
10. 🍉 西瓜 (512分)

## 技术栈

- HTML5 Canvas
- 原生 JavaScript (ES6+)
- CSS3
- 无外部依赖

## 文件结构

```
watermelon-game-w/
├── index.html      # 主页面
├── style.css       # 样式文件
├── game.js         # 游戏逻辑
└── README.md       # 说明文档
```

## 开发说明

游戏使用面向对象的方式编写，主要类：

- `WatermelonGame`: 游戏主类，管理游戏状态、物理引擎、渲染等

核心方法：
- `gameLoop()`: 游戏主循环
- `update()`: 更新游戏状态
- `render()`: 渲染画面
- `checkCollisions()`: 碰撞检测
- `mergeFruits()`: 水果合成逻辑

## 自定义配置

可以在 `game.js` 的 `constructor` 方法中修改 `this.config` 对象：

```javascript
this.config = {
    width: 400,           // 画布宽度
    height: 600,          // 画布高度
    gravity: 0.3,         // 重力加速度
    friction: 0.98,       // 摩擦系数
    bounce: 0.4,          // 底部弹跳系数
    wallBounce: 0.6,      // 墙壁弹跳系数
    dropInterval: 800,    // 自动下落间隔(ms)
    dangerLine: 100       // 危险线位置
};
```

## 浏览器兼容性

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## 许可证

MIT License - 自由使用、修改和分发

## 致谢

灵感来源于流行的"合成大西瓜"游戏，这是一个学习和实践Canvas游戏开发的好项目。

---

享受游戏！祝你早日合成大西瓜！🍉
