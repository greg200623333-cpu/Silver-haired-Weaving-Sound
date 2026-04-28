#!/bin/bash
# 银发织音 - 快速更新脚本（端口 3001）

cd /www/wwwroot/Silver-haired-Weaving-Sound/nextjs-backend

echo "=========================================="
echo "  银发织音 - 快速更新部署"
echo "=========================================="
echo ""

echo "0. 清理旧环境..."
# 停止 PM2
pm2 stop nextjs-backend 2>/dev/null || true

# 清理端口
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# 清理构建文件
rm -rf .next node_modules package-lock.json
echo "  ✓ 旧环境已清理"

echo ""
echo "1. 拉取最新代码..."
git pull origin master

echo ""
echo "2. 安装依赖..."
npm install --production

echo ""
echo "3. 重新构建..."
npm run build

echo ""
echo "4. 启动 PM2..."
pm2 start ecosystem.config.js

echo ""
echo "5. 查看状态..."
pm2 status

echo ""
echo "6. 查看最近日志..."
pm2 logs nextjs-backend --lines 20 --nostream

echo ""
echo "=========================================="
echo "  ✅ 更新完成！"
echo "=========================================="
echo ""
echo "测试 API："
echo "  curl http://localhost:3001/api/voice-chat"
echo ""
