#!/bin/bash
# ================================================================
# 银发织音 - 服务器部署脚本
# 在阿里云服务器上执行此脚本以部署最新代码
# ================================================================

set -e  # 遇到错误立即退出

echo "========================================"
echo "  银发织音 - 自动部署脚本"
echo "========================================"
echo ""

# 配置
PROJECT_DIR="/www/wwwroot/silver-hair-api/nextjs-backend"
PM2_APP_NAME="nextjs-backend"

# 检查是否在服务器上
if [ ! -d "$PROJECT_DIR" ]; then
    echo "错误: 项目目录不存在: $PROJECT_DIR"
    echo "请确保在正确的服务器上执行此脚本"
    exit 1
fi

cd "$PROJECT_DIR"

echo "1. 拉取最新代码..."
git fetch origin
git pull origin master

echo ""
echo "2. 检查新增文件..."
if [ -f "app/api/auth/wx-login/route.ts" ]; then
    echo "✓ 微信登录 API 文件存在"
else
    echo "✗ 微信登录 API 文件不存在"
fi

if [ -f "app/api/memory/timeline/route.ts" ]; then
    echo "✓ 时间线 API 文件存在"
else
    echo "✗ 时间线 API 文件不存在"
fi

echo ""
echo "3. 安装依赖（如果有新增）..."
npm install --production

echo ""
echo "4. 检查环境变量..."
if [ -f ".env.local" ]; then
    echo "✓ .env.local 文件存在"
    echo "  检查必需的环境变量:"

    check_env() {
        if grep -q "^$1=" .env.local; then
            echo "  ✓ $1"
        else
            echo "  ✗ $1 (缺失)"
        fi
    }

    check_env "NEXT_PUBLIC_SUPABASE_URL"
    check_env "SUPABASE_SERVICE_ROLE_KEY"
    check_env "GLM_API_KEY"
    check_env "DEEPSEEK_API_KEY"
    check_env "YOUDAO_APP_KEY"
    check_env "YOUDAO_SECRET"
else
    echo "✗ .env.local 文件不存在"
    echo "  请创建 .env.local 文件并配置环境变量"
fi

echo ""
echo "5. 重启 PM2 进程..."
pm2 restart "$PM2_APP_NAME"

echo ""
echo "6. 等待服务启动..."
sleep 3

echo ""
echo "7. 检查服务状态..."
pm2 status "$PM2_APP_NAME"

echo ""
echo "8. 查看最近日志..."
pm2 logs "$PM2_APP_NAME" --lines 20 --nostream

echo ""
echo "========================================"
echo "  部署完成！"
echo "========================================"
echo ""
echo "测试新增 API:"
echo "  curl https://nrs.greg.asia/api/auth/wx-login?demo=true -X POST -H 'Content-Type: application/json' -d '{\"code\":\"test\"}'"
echo "  curl https://nrs.greg.asia/api/memory/timeline?elder_id=test&demo=true"
echo ""
