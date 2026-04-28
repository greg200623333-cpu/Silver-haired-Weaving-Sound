# 银发织音 - 服务器文件上传指南

## 📋 需要上传到服务器的文件

### 文件列表

| 文件名 | 位置 | 说明 |
|--------|------|------|
| `deploy-server.sh` | `/www/wwwroot/silver-hair-api/` | 一键部署脚本 |
| `update.sh` | `/www/wwwroot/silver-hair-api/` | 快速更新脚本 |
| `ecosystem.config.js` | `/www/wwwroot/silver-hair-api/nextjs-backend/` | PM2 配置文件 |
| `.env.local.production` | `/www/wwwroot/silver-hair-api/nextjs-backend/` | 生产环境配置 |

---

## 🚀 方式一：通过宝塔面板上传（推荐）

### 步骤 1：上传根目录文件

1. 打开宝塔面板 → **文件**
2. 进入目录：`/www/wwwroot/silver-hair-api/`
3. 点击 **上传**
4. 上传以下文件：
   - `deploy-server.sh`
   - `update.sh`

### 步骤 2：上传 nextjs-backend 目录文件

1. 进入目录：`/www/wwwroot/silver-hair-api/nextjs-backend/`
2. 点击 **上传**
3. 上传以下文件：
   - `ecosystem.config.js`
   - `.env.local.production`

### 步骤 3：设置文件权限

1. 选中 `deploy-server.sh`
2. 点击 **权限** → 设置为 `755`
3. 选中 `update.sh`
4. 点击 **权限** → 设置为 `755`

### 步骤 4：配置环境变量

1. 在 `nextjs-backend` 目录
2. 右键 `.env.local.production` → **复制**
3. 粘贴并重命名为 `.env.local`

---

## 🚀 方式二：通过 SSH 命令（更快）

### 一条命令完成所有操作

```bash
# SSH 登录服务器
ssh root@39.106.99.34

# 进入项目目录
cd /www/wwwroot/silver-hair-api

# 拉取最新代码（包含所有脚本文件）
git pull origin master

# 设置脚本执行权限
chmod +x deploy-server.sh update.sh

# 配置环境变量
cd nextjs-backend
cp .env.local.production .env.local

# 执行一键部署
cd ..
./deploy-server.sh
```

---

## 📝 文件内容预览

### 1. deploy-server.sh（一键部署脚本）
```bash
#!/bin/bash
# 12 步自动化部署
# - 清理旧环境
# - 拉取代码
# - 检查文件
# - 验证环境变量
# - 安装依赖
# - 构建项目
# - 启动 PM2
# - 测试 API
```

### 2. update.sh（快速更新脚本）
```bash
#!/bin/bash
# 7 步快速更新
# - 清理旧环境
# - 拉取代码
# - 安装依赖
# - 构建项目
# - 启动 PM2
```

### 3. ecosystem.config.js（PM2 配置）
```javascript
module.exports = {
  apps: [{
    name: 'nextjs-backend',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    cwd: '/www/wwwroot/silver-hair-api/nextjs-backend',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
}
```

### 4. .env.local.production（环境变量）
```bash
# 包含所有 API Keys
GLM_API_KEY=2b78d718...
DEEPSEEK_API_KEY=sk-5086b5ba...
YOUDAO_APP_KEY=52fe40b1...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
WECHAT_APPID=wx0167aa819dbea7f5
WECHAT_SECRET=2e7590006d6b5406f1afa23cef9f7eba
PORT=3001
```

---

## ✅ 验证文件是否上传成功

### 通过宝塔面板验证

1. 进入 `/www/wwwroot/silver-hair-api/`
2. 应该看到：
   - ✅ `deploy-server.sh`（绿色，可执行）
   - ✅ `update.sh`（绿色，可执行）

3. 进入 `nextjs-backend/`
4. 应该看到：
   - ✅ `ecosystem.config.js`
   - ✅ `.env.local.production`
   - ✅ `.env.local`（复制后的文件）

### 通过 SSH 验证

```bash
# 检查根目录文件
ls -lh /www/wwwroot/silver-hair-api/*.sh

# 应该显示：
# -rwxr-xr-x 1 root root 5.2K deploy-server.sh
# -rwxr-xr-x 1 root root 1.8K update.sh

# 检查 nextjs-backend 文件
ls -lh /www/wwwroot/silver-hair-api/nextjs-backend/{ecosystem.config.js,.env.local*}

# 应该显示：
# -rw-r--r-- 1 root root  389 ecosystem.config.js
# -rw-r--r-- 1 root root 1.2K .env.local
# -rw-r--r-- 1 root root 1.2K .env.local.production
```

---

## 🎯 推荐操作流程

### 最简单的方式（推荐）⭐

```bash
# 1. SSH 登录
ssh root@39.106.99.34

# 2. 进入项目目录
cd /www/wwwroot/silver-hair-api

# 3. 拉取最新代码（包含所有文件）
git pull origin master

# 4. 设置权限
chmod +x deploy-server.sh update.sh

# 5. 配置环境变量
cd nextjs-backend
cp .env.local.production .env.local

# 6. 执行部署
cd ..
./deploy-server.sh
```

**这样就不需要手动上传文件了！** 🎉

---

## 🐛 常见问题

### 问题 1：git pull 失败

**原因**：本地有未提交的修改

**解决方案**：
```bash
# 备份本地修改
cp .env.local .env.local.backup

# 强制拉取
git fetch origin
git reset --hard origin/master

# 恢复配置
cp .env.local.backup .env.local
```

### 问题 2：权限不足

**原因**：文件没有执行权限

**解决方案**：
```bash
chmod +x /www/wwwroot/silver-hair-api/deploy-server.sh
chmod +x /www/wwwroot/silver-hair-api/update.sh
```

### 问题 3：文件不存在

**原因**：Git 没有拉取到最新代码

**解决方案**：
```bash
# 查看当前分支
git branch

# 查看远程分支
git branch -r

# 切换到 master 分支
git checkout master

# 拉取最新代码
git pull origin master
```

---

## 📞 需要帮助？

如果遇到问题，可以：

1. 查看 Git 状态：`git status`
2. 查看最新提交：`git log --oneline -5`
3. 查看文件列表：`ls -la`
4. 查看文件内容：`cat deploy-server.sh`

---

**推荐使用 SSH 方式，一条命令搞定所有文件！** 🚀
