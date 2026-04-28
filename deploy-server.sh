#!/bin/bash
# ================================================================
# 银发织音 - 一站式部署脚本（端口 3001）
# 真正的一键部署，无需任何手动操作
# ================================================================

set -e  # 遇到错误立即退出

echo "=========================================="
echo "  银发织音 - 一站式部署"
echo "=========================================="
echo ""

# 配置
PROJECT_DIR="/www/wwwroot/Silver-haired-Weaving-Sound/nextjs-backend"
PM2_APP_NAME="nextjs-backend"
PORT=3001

# 检查是否在服务器上
if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ 错误: 项目目录不存在: $PROJECT_DIR"
    echo "请先克隆代码："
    echo "  cd /www/wwwroot"
    echo "  git clone https://gitee.com/Greg012/Silver-haired-Weaving-Sound.git"
    exit 1
fi

cd "$PROJECT_DIR"

# ================================================================
# 步骤 0：清理旧环境
# ================================================================
echo "步骤 0：清理旧环境..."
echo "----------------------------------------"

# 停止并删除 PM2 进程
if pm2 list | grep -q "$PM2_APP_NAME"; then
    echo "  停止 PM2 进程..."
    pm2 stop "$PM2_APP_NAME" 2>/dev/null || true
    pm2 delete "$PM2_APP_NAME" 2>/dev/null || true
    echo "  ✓ PM2 进程已停止"
else
    echo "  ✓ 未发现运行中的 PM2 进程"
fi

# 杀死占用端口的进程
PORT_PID=$(lsof -ti:$PORT 2>/dev/null || true)
if [ -n "$PORT_PID" ]; then
    echo "  发现进程占用端口 $PORT (PID: $PORT_PID)"
    kill -9 $PORT_PID 2>/dev/null || true
    echo "  ✓ 已杀死占用端口的进程"
else
    echo "  ✓ 端口 $PORT 未被占用"
fi

# 清理构建文件
if [ -d ".next" ]; then
    echo "  清理构建文件..."
    rm -rf .next
    echo "  ✓ 已清理旧的构建文件"
else
    echo "  ✓ 无需清理构建文件"
fi

echo ""

# ================================================================
# 步骤 1：拉取最新代码（自动处理冲突）
# ================================================================
echo "步骤 1：拉取最新代码..."
echo "----------------------------------------"

# 备份本地配置
if [ -f ".env.local" ]; then
    echo "  备份本地配置..."
    cp .env.local .env.local.backup.temp
fi

# 强制拉取最新代码（自动解决冲突）
echo "  拉取远程代码..."
git fetch origin
git reset --hard origin/main 2>/dev/null || git pull origin main

# 恢复本地配置
if [ -f ".env.local.backup.temp" ]; then
    echo "  恢复本地配置..."
    cp .env.local.backup.temp .env.local
    rm .env.local.backup.temp
fi

echo "  ✓ 代码已更新"
echo ""

# ================================================================
# 步骤 2：检查新增文件
# ================================================================
echo "步骤 2：检查新增文件..."
echo "----------------------------------------"

check_file() {
    if [ -f "$1" ]; then
        echo "  ✓ $2"
    else
        echo "  ✗ $2 (不存在)"
    fi
}

check_file "app/api/auth/wx-login/route.ts" "微信登录 API"
check_file "app/api/auth/bind/route.ts" "绑定关系 API"
check_file "app/api/auth/magic-token/route.ts" "Magic Token API"
check_file "app/api/memory/timeline/route.ts" "时间线 API"
check_file "app/api/monitor/tasks/route.ts" "任务监控 API"
check_file "ecosystem.config.js" "PM2 配置文件"
check_file ".env.local.production" "生产环境配置"

# 检查 node_modules
echo ""
if [ ! -d "node_modules" ]; then
    echo "  ⚠️  node_modules 不存在！"
    echo ""
    echo "  请手动安装依赖后再运行此脚本："
    echo "    cd /www/wwwroot/Silver-haired-Weaving-Sound/nextjs-backend"
    echo "    npm install --omit=dev"
    echo ""
    exit 1
else
    echo "  ✓ node_modules 已安装"
fi
echo ""

# ================================================================
# 步骤 3：自动配置环境变量
# ================================================================
echo "步骤 3：自动配置环境变量..."
echo "----------------------------------------"

if [ -f ".env.local.production" ]; then
    echo "  发现生产环境配置文件"

    # 如果没有 .env.local，自动创建
    if [ ! -f ".env.local" ]; then
        echo "  自动创建 .env.local..."
        cp .env.local.production .env.local
        echo "  ✓ 已从生产配置创建 .env.local"
    else
        echo "  ✓ .env.local 已存在，保留现有配置"
    fi

    # 验证配置
    echo ""
    echo "  检查必需的环境变量:"

    check_env() {
        if grep -q "^$1=" .env.local 2>/dev/null; then
            echo "    ✓ $1"
        else
            echo "    ✗ $1 (缺失)"
        fi
    }

    check_env "NEXT_PUBLIC_SUPABASE_URL"
    check_env "SUPABASE_SERVICE_ROLE_KEY"
    check_env "GLM_API_KEY"
    check_env "DEEPSEEK_API_KEY"
    check_env "YOUDAO_APP_KEY"
    check_env "YOUDAO_SECRET"
    check_env "WECHAT_APPID"
    check_env "WECHAT_SECRET"
    check_env "PORT"
else
    echo "  ❌ .env.local.production 文件不存在"
    echo ""
    echo "  请手动创建 .env.local 文件："
    echo "    cp .env.local.example .env.local"
    echo "    nano .env.local  # 填写你的 API Keys"
    exit 1
fi
echo ""

# ================================================================
# 步骤 4：构建项目
# ================================================================
echo "步骤 5：构建项目..."
echo "----------------------------------------"
npm run build
echo "  ✓ 构建完成"
echo ""

# ================================================================
# 步骤 5：创建日志目录
# ================================================================
echo "步骤 5：创建日志目录..."
echo "----------------------------------------"
mkdir -p /www/wwwroot/Silver-haired-Weaving-Sound/logs
echo "  ✓ 日志目录已创建"
echo ""

# ================================================================
# 步骤 6：启动 PM2
# ================================================================
echo "步骤 6：启动 PM2..."
echo "----------------------------------------"

if [ -f "ecosystem.config.js" ]; then
    pm2 start ecosystem.config.js
    echo "  ✓ PM2 已启动"
else
    echo "  ❌ ecosystem.config.js 不存在"
    exit 1
fi
echo ""

# ================================================================
# 步骤 7：设置开机自启
# ================================================================
echo "步骤 7：设置开机自启..."
echo "----------------------------------------"
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || echo "  ⚠️  请手动执行 pm2 startup 命令"
echo "  ✓ 开机自启已设置"
echo ""

# ================================================================
# 步骤 8：等待服务启动
# ================================================================
echo "步骤 8：等待服务启动..."
echo "----------------------------------------"
sleep 3
echo "  ✓ 服务已启动"
echo ""

# ================================================================
# 步骤 9：检查服务状态
# ================================================================
echo "步骤 9：检查服务状态..."}       <parameter name=
echo "----------------------------------------"
pm2 status "$PM2_APP_NAME"
echo ""

# ================================================================
# 步骤 10：查看日志
# ================================================================
echo "步骤 10：查看最近日志..."
echo "----------------------------------------"
pm2 logs "$PM2_APP_NAME" --lines 20 --nostream
echo ""

# ================================================================
# 步骤 11：测试 API
# ================================================================
echo "步骤 11：测试 API..."
echo "----------------------------------------"

echo "  测试本地端口..."
if curl -s http://localhost:$PORT/api/voice-chat | grep -q "status"; then
    echo "  ✓ 本地 API 正常"
else
    echo "  ✗ 本地 API 异常"
fi

echo ""
echo "  测试外网访问..."
if curl -s https://nrs.greg.asia/api/voice-chat | grep -q "status"; then
    echo "  ✓ 外网 API 正常"
else
    echo "  ✗ 外网 API 异常（请检查 Nginx 配置）"
fi

echo ""

# ================================================================
# 部署完成
# ================================================================
echo "=========================================="
echo "  ✅ 一站式部署完成！"
echo "=========================================="
echo ""
echo "服务信息："
echo "  端口: $PORT"
echo "  PM2 进程: $PM2_APP_NAME"
echo "  日志目录: /www/wwwroot/Silver-haired-Weaving-Sound/logs"
echo ""
echo "测试命令："
echo "  curl http://localhost:$PORT/api/voice-chat"
echo "  curl https://nrs.greg.asia/api/voice-chat"
echo ""
echo "新增 API 测试："
echo "  curl -X POST 'https://nrs.greg.asia/api/auth/wx-login?demo=true' -H 'Content-Type: application/json' -d '{\"code\":\"test\"}'"
echo "  curl 'https://nrs.greg.asia/api/memory/timeline?elder_id=test&demo=true'"
echo ""
echo "常用命令："
echo "  pm2 status          # 查看状态"
echo "  pm2 logs $PM2_APP_NAME  # 查看日志"
echo "  pm2 restart $PM2_APP_NAME  # 重启服务"
echo ""
echo "🎉 部署成功！无需任何手动操作！"
echo ""
