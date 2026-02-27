#!/bin/bash

# 合成大西瓜游戏 - GitHub部署脚本
# 使用方法: ./deploy.sh <your-github-username>

set -e

GAME_NAME="watermelon-game-w"
USERNAME=$1

if [ -z "$USERNAME" ]; then
    echo "使用方法: $0 <your-github-username>"
    echo "示例: $0 yourname"
    exit 1
fi

REPO_URL="https://github.com/$USERNAME/$GAME_NAME.git"

echo "🚀 开始部署 $GAME_NAME 到 GitHub..."
echo "📦 仓库地址: $REPO_URL"

# 检查是否已登录GitHub
if ! gh auth status &>/dev/null; then
    echo "⚠️  请先登录GitHub: gh auth login"
    exit 1
fi

# 初始化Git仓库（如果尚未初始化）
if [ ! -d .git ]; then
    echo "📝 初始化Git仓库..."
    git init
    git add .
    git commit -m "Initial commit: Watermelon Game"
fi

# 创建GitHub仓库（如果不存在）
echo "🔧 检查GitHub仓库..."
if ! gh repo view $USERNAME/$GAME_NAME &>/dev/null; then
    echo "📦 创建GitHub仓库: $GAME_NAME"
    gh repo create $GAME_NAME --public --source=. --remote=origin
else
    echo "✅ 仓库已存在，设置远程仓库..."
    git remote add origin $REPO_URL 2>/dev/null || git remote set-url origin $REPO_URL
fi

# 推送到GitHub
echo "⬆️  推送到GitHub..."
git branch -M main
git push -u origin main

# 启用GitHub Pages
echo "🌐 启用GitHub Pages..."
gh api -X PUT repos/$USERNAME/$GAME_NAME/pages --jq .html_url

echo ""
echo "✅ 部署完成！"
echo "🎮 游戏地址: https://$USERNAME.github.io/$GAME_NAME/"
echo ""
echo "后续更新："
echo "  1. 修改游戏文件"
echo "  2. git add . && git commit -m '更新说明'"
echo "  3. git push origin main"
echo ""
echo "📝 注意：GitHub Pages可能需要1-2分钟生效"
