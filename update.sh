#!/bin/bash
# 银发织音 - 快速更新脚本（端口 3001）

cd /www/wwwroot/silver-hair-api/nextjs-backend

echo "=========================================="
echo "  银发织音 - 快速更新部署"
echo "=========================================="
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
echo "4. 重启 PM2..."
pm2 restart nextjs-backend

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
