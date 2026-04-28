# 银发织音 - 宝塔面板完整部署指南

## 📋 部署前准备

### 1. 服务器要求
- **操作系统**：CentOS 7+ / Ubuntu 18.04+
- **内存**：≥2GB
- **磁盘**：≥20GB
- **宝塔版本**：7.9.0+

### 2. 必需软件
- Node.js 18+
- PM2
- Nginx
- Git

---

## 🚀 完整部署流程

### 步骤 1：登录宝塔面板

```
访问：https://你的服务器IP:8888
用户名：你的宝塔用户名
密码：你的宝塔密码
```

---

### 步骤 2：安装必需软件

#### 2.1 安装 Node.js

1. 进入宝塔面板 → **软件商店**
2. 搜索 **"Node.js 版本管理器"**
3. 点击 **安装**
4. 安装完成后，点击 **设置**
5. 选择 **Node.js 18.x** 版本
6. 点击 **安装**

**验证安装**：
```bash
# SSH 登录服务器
ssh root@你的服务器IP

# 检查 Node.js 版本
node -v  # 应该显示 v18.x.x
npm -v   # 应该显示 9.x.x
```

#### 2.2 安装 PM2

```bash
# SSH 登录服务器后执行
npm install -g pm2

# 验证安装
pm2 -v  # 应该显示版本号
```

#### 2.3 安装 Nginx（如果未安装）

1. 宝塔面板 → **软件商店**
2. 搜索 **"Nginx"**
3. 点击 **安装**（选择编译安装，更稳定）

---

### 步骤 3：创建网站

#### 3.1 添加站点

1. 宝塔面板 → **网站** → **添加站点**
2. 填写信息：
   - **域名**：`nrs.greg.asia`（或你的域名）
   - **根目录**：`/www/wwwroot/silver-hair-api`
   - **PHP 版本**：纯静态（不需要 PHP）
   - **数据库**：不创建
   - **FTP**：不创建
3. 点击 **提交**

#### 3.2 配置 SSL 证书（重要！）

1. 点击站点名称 → **设置**
2. 选择 **SSL** 标签
3. 选择 **Let's Encrypt** 免费证书
4. 勾选你的域名
5. 点击 **申请**
6. 等待证书申请成功
7. 开启 **强制 HTTPS**

---

### 步骤 4：克隆代码

#### 4.1 SSH 登录服务器

```bash
ssh root@你的服务器IP
```

#### 4.2 进入网站目录

```bash
cd /www/wwwroot/silver-hair-api
```

#### 4.3 克隆代码

```bash
# 如果目录不为空，先清空
rm -rf *

# 克隆代码
git clone https://gitee.com/Greg012/Silver-haired-Weaving-Sound.git .

# 查看文件
ls -la
# 应该看到：nextjs-backend, taro-frontend, supabase 等目录
```

---

### 步骤 5：配置后端

#### 5.1 进入后端目录

```bash
cd /www/wwwroot/silver-hair-api/nextjs-backend
```

#### 5.2 安装依赖

```bash
# 安装生产依赖
npm install --production

# 如果遇到权限问题
npm install --production --unsafe-perm
```

#### 5.3 创建环境变量文件

```bash
# 创建 .env.local 文件
nano .env.local
```

**粘贴以下内容**（替换为你的实际值）：

```bash
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=https://你的项目.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的Anon密钥
SUPABASE_SERVICE_ROLE_KEY=你的ServiceRole密钥

# AI 模型配置
GLM_API_KEY=你的智谱AI密钥
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
GLM_MODEL=glm-4-flash

DEEPSEEK_API_KEY=你的DeepSeek密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-reasoner

# 语音服务配置
YOUDAO_APP_KEY=你的有道AppKey
YOUDAO_SECRET=你的有道Secret

# 微信小程序配置（可选）
WECHAT_APPID=你的小程序AppID
WECHAT_SECRET=你的小程序Secret

# 其他配置
NODE_ENV=production
PORT=3001
```

**保存并退出**：
- 按 `Ctrl + X`
- 按 `Y`
- 按 `Enter`

#### 5.4 构建项目

```bash
# 构建 Next.js 项目
npm run build

# 等待构建完成（可能需要 2-5 分钟）
# 看到 "Compiled successfully" 表示成功
```

---

### 步骤 6：配置 PM2

#### 6.1 创建 PM2 配置文件

```bash
# 在 nextjs-backend 目录下创建
nano ecosystem.config.js
```

**粘贴以下内容**：

```javascript
module.exports = {
  apps: [{
    name: 'nextjs-backend',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    cwd: '/www/wwwroot/silver-hair-api/nextjs-backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/www/wwwroot/silver-hair-api/logs/error.log',
    out_file: '/www/wwwroot/silver-hair-api/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
}
```

**保存并退出**。

#### 6.2 创建日志目录

```bash
mkdir -p /www/wwwroot/silver-hair-api/logs
```

#### 6.3 启动 PM2

```bash
# 启动应用
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 应该看到：
# ┌─────┬──────────────────┬─────────┬─────────┬──────────┐
# │ id  │ name             │ status  │ restart │ uptime   │
# ├─────┼──────────────────┼─────────┼─────────┼──────────┤
# │ 0   │ nextjs-backend   │ online  │ 0       │ 0s       │
# └─────┴──────────────────┴─────────┴─────────┴──────────┘

# 查看日志
pm2 logs nextjs-backend --lines 50

# 设置开机自启
pm2 startup
pm2 save
```

---

### 步骤 7：配置 Nginx 反向代理

#### 7.1 编辑 Nginx 配置

1. 宝塔面板 → **网站** → 找到你的站点
2. 点击 **设置** → **配置文件**
3. 找到 `location /` 块，**替换为**：

```nginx
location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    
    # SSE 支持
    proxy_buffering off;
    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;
}
```

4. 点击 **保存**
5. 点击 **重载配置**

---

### 步骤 8：配置防火墙

#### 8.1 开放端口

1. 宝塔面板 → **安全**
2. 添加以下端口：
   - **80**（HTTP）
   - **443**（HTTPS）
   - **8888**（宝塔面板）

#### 8.2 关闭不必要的端口

- 确保 **3001** 端口**不对外开放**（仅内网访问）

---

### 步骤 9：验证部署

#### 9.1 测试 API

```bash
# 在服务器上测试
curl http://localhost:3001/api/voice-chat

# 应该返回：
# {"status":"ok","architecture":"dual-model-routing",...}

# 测试外网访问
curl https://nrs.greg.asia/api/voice-chat

# 应该返回相同内容
```

#### 9.2 测试新增 API

```bash
# 测试微信登录
curl -X POST "https://nrs.greg.asia/api/auth/wx-login?demo=true" \
  -H "Content-Type: application/json" \
  -d '{"code":"test"}'

# 应该返回：
# {"user_id":"demo-user-001","openid":"demo-openid-001",...}

# 测试时间线
curl "https://nrs.greg.asia/api/memory/timeline?elder_id=test&demo=true"

# 应该返回：
# {"memories":[...],"total":2,...}
```

---

### 步骤 10：数据库迁移

#### 10.1 登录 Supabase

1. 访问 https://supabase.com/dashboard
2. 选择你的项目
3. 进入 **SQL Editor**

#### 10.2 执行迁移 SQL

**复制以下 SQL 并执行**：

```sql
-- 1. 为 magic_tokens 表启用 RLS
ALTER TABLE public.magic_tokens ENABLE ROW LEVEL SECURITY;

-- 2. 为 chat_logs 表添加等幂键（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_logs' 
        AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE public.chat_logs 
        ADD COLUMN idempotency_key text unique;
    END IF;
END $$;

-- 3. 验证修改
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('magic_tokens', 'chat_logs');

-- 应该显示：
-- magic_tokens | true
-- chat_logs    | true
```

---

### 步骤 11：前端部署（可选）

#### 11.1 H5 版本

```bash
cd /www/wwwroot/silver-hair-api/taro-frontend

# 安装依赖
npm install

# 构建 H5 版本
npm run build:h5

# 构建产物在 dist/ 目录
```

#### 11.2 配置 Nginx 静态托管

1. 宝塔面板 → **网站** → **添加站点**
2. 域名：`h5.nrs.greg.asia`
3. 根目录：`/www/wwwroot/silver-hair-api/taro-frontend/dist`
4. 配置 SSL 证书

---

## 🔧 常见问题排查

### 问题 1：PM2 启动失败

**症状**：`pm2 status` 显示 `errored`

**排查**：
```bash
# 查看错误日志
pm2 logs nextjs-backend --err --lines 100

# 常见原因：
# 1. 端口被占用
netstat -tuln | grep 3001
# 如果被占用，杀死进程
lsof -ti:3001 | xargs kill -9

# 2. 环境变量缺失
cat /www/wwwroot/silver-hair-api/nextjs-backend/.env.local

# 3. 依赖未安装
cd /www/wwwroot/silver-hair-api/nextjs-backend
npm install --production
```

---

### 问题 2：API 返回 502

**症状**：访问 API 返回 502 Bad Gateway

**排查**：
```bash
# 1. 检查 PM2 状态
pm2 status
# 如果是 stopped，重启
pm2 restart nextjs-backend

# 2. 检查端口监听
netstat -tuln | grep 3001
# 应该显示：tcp 0 0 127.0.0.1:3001 0.0.0.0:* LISTEN

# 3. 检查 Nginx 配置
nginx -t
# 应该显示：syntax is ok

# 4. 重启 Nginx
systemctl restart nginx
```

---

### 问题 3：新增 API 返回 404

**症状**：`/api/auth/wx-login` 返回 404

**排查**：
```bash
# 1. 检查文件是否存在
ls -la /www/wwwroot/silver-hair-api/nextjs-backend/app/api/auth/wx-login/

# 应该看到 route.ts 文件

# 2. 重新构建
cd /www/wwwroot/silver-hair-api/nextjs-backend
npm run build

# 3. 重启 PM2
pm2 restart nextjs-backend

# 4. 查看日志
pm2 logs nextjs-backend --lines 50
```

---

### 问题 4：环境变量不生效

**症状**：API 返回 "配置错误"

**排查**：
```bash
# 1. 检查 .env.local 文件
cat /www/wwwroot/silver-hair-api/nextjs-backend/.env.local

# 2. 确保没有多余空格
# 错误：GLM_API_KEY = xxx
# 正确：GLM_API_KEY=xxx

# 3. 重启 PM2（重要！）
pm2 restart nextjs-backend

# 4. 验证环境变量
pm2 show nextjs-backend | grep env
```

---

## 📊 性能优化

### 1. 启用 Gzip 压缩

宝塔面板 → **网站** → **设置** → **配置文件**

在 `http` 块中添加：
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
```

### 2. 配置缓存

在 `location /` 块后添加：
```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 7d;
    add_header Cache-Control "public, immutable";
}
```

### 3. 限流配置

在 `http` 块中添加：
```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

location /api/ {
    limit_req zone=api_limit burst=20 nodelay;
    # ... 其他配置
}
```

---

## 🔄 更新部署

### 快速更新脚本

```bash
#!/bin/bash
# 保存为 /www/wwwroot/silver-hair-api/update.sh

cd /www/wwwroot/silver-hair-api/nextjs-backend

echo "1. 拉取最新代码..."
git pull origin master

echo "2. 安装依赖..."
npm install --production

echo "3. 重新构建..."
npm run build

echo "4. 重启 PM2..."
pm2 restart nextjs-backend

echo "5. 查看状态..."
pm2 status

echo "6. 查看日志..."
pm2 logs nextjs-backend --lines 20 --nostream

echo "✅ 更新完成！"
```

**使用方法**：
```bash
chmod +x /www/wwwroot/silver-hair-api/update.sh
/www/wwwroot/silver-hair-api/update.sh
```

---

## ✅ 部署检查清单

部署完成后，逐项检查：

- [ ] Node.js 18+ 已安装
- [ ] PM2 已安装并运行
- [ ] 代码已克隆到 `/www/wwwroot/silver-hair-api`
- [ ] `.env.local` 文件已创建并配置
- [ ] `npm install` 已执行
- [ ] `npm run build` 已执行
- [ ] PM2 状态为 `online`
- [ ] Nginx 反向代理已配置
- [ ] SSL 证书已申请并启用
- [ ] 防火墙端口已开放
- [ ] API 测试通过（`/api/voice-chat`）
- [ ] 新增 API 测试通过（`/api/auth/wx-login`）
- [ ] Supabase 数据库迁移已执行
- [ ] PM2 开机自启已设置

---

## 📞 技术支持

如果遇到问题：

1. 查看 PM2 日志：`pm2 logs nextjs-backend --err --lines 100`
2. 查看 Nginx 日志：`tail -f /www/wwwlogs/nrs.greg.asia.error.log`
3. 检查系统资源：`htop` 或 `free -h`
4. 重启服务：`pm2 restart nextjs-backend && systemctl restart nginx`

---

**部署完成后，访问 https://nrs.greg.asia/api/voice-chat 应该看到正常响应！** 🎉
