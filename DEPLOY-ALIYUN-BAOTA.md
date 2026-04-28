# 阿里云宝塔部署 Next.js 后端教程

## 前置准备

### 1. 阿里云服务器要求
- 操作系统：CentOS 7+ / Ubuntu 18.04+
- 内存：至少 2GB（推荐 4GB）
- 已安装宝塔面板（BT Panel）
- 已开放端口：80, 443, 3000（或自定义端口）

### 2. 本地准备
- 确保 `.env.local` 文件配置完整
- 确保所有 API Key 有效（有道、智谱、DeepSeek）

---

## 第一步：安装宝塔面板（如已安装跳过）

### CentOS 安装命令
```bash
yum install -y wget && wget -O install.sh https://download.bt.cn/install/install_6.0.sh && sh install.sh
```

### Ubuntu 安装命令
```bash
wget -O install.sh https://download.bt.cn/install/install-ubuntu_6.0.sh && sudo bash install.sh
```

安装完成后记录：
- 宝塔面板地址：`http://你的服务器IP:8888`
- 用户名和密码

---

## 第二步：宝塔面板安装软件

登录宝塔面板后，在"软件商店"安装以下软件：

1. **Nginx** - 1.22+ 版本（极速安装）
2. **Node.js 版本管理器** - 安装后选择 Node.js 20.x
3. **PM2 管理器** - 用于进程守护

---

## 第三步：上传项目文件

### 方式 1：使用宝塔文件管理器（推荐新手）

1. 在宝塔面板 → 文件 → 创建目录：`/www/wwwroot/silver-hair-api`
2. 将本地 `nextjs-backend` 文件夹打包为 `backend.zip`
3. 上传到 `/www/wwwroot/silver-hair-api`
4. 解压缩

### 方式 2：使用 Git（推荐）

在宝塔终端执行：
```bash
cd /www/wwwroot
git clone <你的仓库地址> silver-hair-api
cd silver-hair-api/nextjs-backend
```

---

## 第四步：配置环境变量

1. 在服务器上创建 `.env.local` 文件：
```bash
cd /www/wwwroot/silver-hair-api/nextjs-backend
nano .env.local
```

2. 复制以下内容并填入你的真实 API Key：
```env
# LLM 配置
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=你的OpenAI密钥
LLM_MODEL=gpt-4o

# 智谱 GLM-4-Flash（主力对话）
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
GLM_API_KEY=你的智谱API密钥
GLM_MODEL=glm-4-flash

# DeepSeek-R1（结构化归档）
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_API_KEY=你的DeepSeek密钥
DEEPSEEK_MODEL=deepseek-reasoner

# 有道语音识别
YOUDAO_APP_KEY=你的有道AppKey
YOUDAO_SECRET=你的有道Secret

# Supabase
NEXT_PUBLIC_SUPABASE_URL=你的Supabase地址
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的Supabase匿名密钥
SUPABASE_SERVICE_ROLE_KEY=你的Supabase服务密钥
```

3. 保存并退出（Ctrl+X → Y → Enter）

---

## 第五步：安装依赖并构建

在宝塔终端执行：

```bash
cd /www/wwwroot/silver-hair-api/nextjs-backend

# 安装依赖
npm install

# 构建生产版本
npm run build
```

**注意**：构建可能需要 3-5 分钟，请耐心等待。

---

## 第六步：使用 PM2 启动服务

### 1. 创建 PM2 配置文件

```bash
cd /www/wwwroot/silver-hair-api/nextjs-backend
nano ecosystem.config.js
```

写入以下内容：
```javascript
module.exports = {
  apps: [{
    name: 'silver-hair-api',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3001',  // 改为 3001 端口（避免与现有网站冲突）
    cwd: '/www/wwwroot/silver-hair-api/nextjs-backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
}
```

### 2. 启动服务

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 3. 验证服务运行

```bash
pm2 status
pm2 logs silver-hair-api
```

应该看到服务状态为 `online`。

---

## 第七步：配置 Nginx 反向代理

### 1. 在宝塔面板创建网站

1. 点击"网站" → "添加站点"
2. 域名：填入你的域名（如 `api.yourdomain.com`）或服务器 IP
3. 根目录：`/www/wwwroot/silver-hair-api/nextjs-backend`
4. PHP 版本：选择"纯静态"
5. 点击"提交"

### 2. 配置反向代理

1. 点击刚创建的网站 → "设置" → "反向代理"
2. 点击"添加反向代理"
3. 填写：
   - 代理名称：`nextjs-api`
   - 目标 URL：`http://127.0.0.1:3001`  （改为 3001 端口）
   - 发送域名：`$host`
4. 点击"提交"

### 3. 配置 SSL（可选但推荐）

如果有域名：
1. 点击网站 → "设置" → "SSL"
2. 选择"Let's Encrypt" → 填入邮箱 → 申请
3. 开启"强制 HTTPS"

---

## 第八步：测试 API

### 1. 测试健康检查

```bash
curl http://你的服务器IP/api/stt/transcribe
# 或
curl https://api.yourdomain.com/api/stt/transcribe
```

应该返回：`{"status":"ok","provider":"youdao-asr"}`

### 2. 测试完整流程

使用 Postman 或 curl 测试：
```bash
curl -X POST http://你的服务器IP/api/voice-chat \
  -H "Content-Type: application/json" \
  -d '{"raw_text":"你好","user_id":"test-001"}'
```

---

## 第九步：更新前端配置

修改前端 `taro-frontend/src/services/voice-pipeline.ts`：

```typescript
// 将 API_BASE 改为你的阿里云地址
const API_BASE = 'https://api.yourdomain.com';  // 或 http://你的服务器IP:3000
```

重新构建前端：
```bash
cd taro-frontend
npm run build:weapp
```

---

## 常用 PM2 命令

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs silver-hair-api

# 重启服务
pm2 restart silver-hair-api

# 停止服务
pm2 stop silver-hair-api

# 删除服务
pm2 delete silver-hair-api

# 查看详细信息
pm2 show silver-hair-api
```

---

## 故障排查

### 问题 1：服务启动失败

```bash
# 查看端口占用
netstat -tunlp | grep 3001

# 手动测试启动
cd /www/wwwroot/silver-hair-api/nextjs-backend
PORT=3001 npm run start
```

### 问题 2：API 返回 502

- 检查 PM2 服务是否运行：`pm2 status`
- 检查 Nginx 配置是否正确
- 查看 Nginx 错误日志：`/www/wwwlogs/你的域名.error.log`

### 问题 3：环境变量未生效

```bash
# 重新加载环境变量
pm2 restart silver-hair-api --update-env

# 或删除后重新启动
pm2 delete silver-hair-api
pm2 start ecosystem.config.js
```

### 问题 4：内存不足

如果服务器内存小于 2GB，可能需要添加 swap：
```bash
# 创建 2GB swap
dd if=/dev/zero of=/swapfile bs=1M count=2048
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## 安全建议

1. **修改 SSH 端口**：宝塔面板 → 安全 → SSH 端口
2. **开启防火墙**：只开放必要端口（80, 443, SSH）
3. **定期更新**：`yum update` 或 `apt update && apt upgrade`
4. **备份数据**：宝塔面板 → 计划任务 → 备份网站和数据库
5. **监控资源**：宝塔面板 → 监控 → 查看 CPU/内存使用

---

## 性能优化

### 1. 启用 Gzip 压缩

在 Nginx 配置中添加：
```nginx
gzip on;
gzip_types text/plain application/json application/javascript text/css;
gzip_min_length 1000;
```

### 2. 配置缓存

在 Nginx 配置中添加：
```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 7d;
}
```

### 3. 增加 PM2 实例（如果服务器配置足够）

修改 `ecosystem.config.js`：
```javascript
instances: 2,  // 或 'max' 使用所有 CPU 核心
exec_mode: 'cluster'
```

---

## 更新部署

当代码更新后：

```bash
cd /www/wwwroot/silver-hair-api/nextjs-backend

# 拉取最新代码（如果使用 Git）
git pull

# 安装新依赖（如果有）
npm install

# 重新构建
npm run build

# 重启服务
pm2 restart silver-hair-api
```

---

## 完成！

现在你的 Next.js 后端已经成功部署到阿里云宝塔面板。

测试地址：
- HTTP: `http://你的服务器IP/api/stt/transcribe`
- HTTPS: `https://api.yourdomain.com/api/stt/transcribe`

如有问题，查看日志：
```bash
pm2 logs silver-hair-api
```
