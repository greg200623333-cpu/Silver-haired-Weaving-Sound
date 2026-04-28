#!/bin/bash
# 银发织音 - 清除旧环境脚本

echo "=========================================="
echo "  银发织音 - 清除旧环境"
echo "=========================================="
echo ""

# 1. 停止 PM2 进程
echo "1. 停止 PM2 进程..."
pm2 stop nextjs-backend 2>/dev/null || echo "  未找到运行中的进程"
pm2 delete nextjs-backend 2>/dev/null || echo "  未找到 PM2 配置"

# 2. 杀死占用端口的进程
echo ""
echo "2. 检查并清理 3001 端口..."
PORT_PID=$(lsof -ti:3001 2>/dev/null)
if [ -n "$PORT_PID" ]; then
    echo "  发现进程占用端口 3001 (PID: $PORT_PID)"
    kill -9 $PORT_PID 2>/dev/null
    echo "  ✓ 已杀死进程"
else
    echo "  ✓ 端口 3001 未被占用"
fi

# 3. 清除构建文件
echo ""
echo "3. 清除旧的构建文件..."
cd /www/wwwroot/silver-hair-api/nextjs-backend 2>/dev/null || {
    echo "  ✗ 项目目录不存在"
    exit 1
}

if [ -d ".next" ]; then
    rm -rf .next
    echo "  ✓ 已删除 .next 目录"
fi

if [ -d "node_modules" ]; then
    rm -rf node_modules
    echo "  ✓ 已删除 node_modules 目录"
fi

if [ -f "package-lock.json" ]; then
    rm -f package-lock.json
    echo "  ✓ 已删除 package-lock.json"
fi

# 4. 清除日志文件（可选）
echo ""
echo "4. 清除旧日志..."
if [ -d "/www/wwwroot/silver-hair-api/logs" ]; then
    rm -rf /www/wwwroot/silver-hair-api/logs/*
    echo "  ✓ 已清除日志文件"
else
    echo "  ✓ 日志目录不存在"
fi

# 5. 验证清理结果
echo ""
echo "=========================================="
echo "  清理完成！"
echo "=========================================="
echo ""
echo "验证结果："
echo "  PM2 进程: $(pm2 list | grep nextjs-backend | wc -l) 个"
echo "  端口 3001: $(lsof -ti:3001 | wc -l) 个进程占用"
echo "  .next 目录: $([ -d .next ] && echo '存在' || echo '不存在')"
echo "  node_modules: $([ -d node_modules ] && echo '存在' || echo '不存在')"
echo ""
echo "下一步："
echo "  1. git pull origin master"
echo "  2. npm install --production"
echo "  3. npm run build"
echo "  4. pm2 start ecosystem.config.js"
echo ""
