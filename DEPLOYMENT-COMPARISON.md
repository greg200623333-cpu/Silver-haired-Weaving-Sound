# 银发织音 - 部署方式对比

## 📊 三种部署方式对比

| 特性 | 一键部署脚本 | 快速更新脚本 | 手动部署 |
|------|------------|------------|---------|
| **适用场景** | 首次部署/完整重部署 | 日常更新 | 学习/调试 |
| **执行时间** | ~5 分钟 | ~3 分钟 | ~10 分钟 |
| **自动化程度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐ |
| **错误处理** | 自动检测 | 自动清理 | 手动排查 |
| **推荐指数** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## 🎯 方式一：一键部署脚本（推荐）

### 使用场景
- ✅ 首次部署
- ✅ 完整重新部署
- ✅ 出现严重问题需要重置

### 执行命令
```bash
/www/wwwroot/silver-hair-api/deploy-server.sh
```

### 自动完成的步骤（12 步）
1. ✅ 清理旧环境（停止 PM2、清理端口、删除构建）
2. ✅ 拉取最新代码
3. ✅ 检查新增文件（5 个 API 文件）
4. ✅ 验证环境变量（6 个必需变量）
5. ✅ 安装依赖
6. ✅ 构建项目
7. ✅ 创建日志目录
8. ✅ 启动 PM2
9. ✅ 设置开机自启
10. ✅ 等待服务启动
11. ✅ 查看日志
12. ✅ 测试 API（本地 + 外网）

### 优点
- 🎯 一条命令完成所有步骤
- 🔍 自动检测和验证
- 📊 详细的输出信息
- ✅ 自动测试 API
- 🛡️ 错误自动退出

### 缺点
- ⏱️ 首次执行时间较长（~5 分钟）
- 📦 会删除并重新安装所有依赖

---

## 🔄 方式二：快速更新脚本（日常推荐）

### 使用场景
- ✅ 日常代码更新
- ✅ 修复 Bug 后重新部署
- ✅ 添加新功能后部署

### 执行命令
```bash
/www/wwwroot/silver-hair-api/update.sh
```

### 自动完成的步骤（7 步）
1. ✅ 清理旧环境
2. ✅ 拉取最新代码
3. ✅ 安装依赖
4. ✅ 重新构建
5. ✅ 启动 PM2
6. ✅ 查看状态
7. ✅ 查看日志

### 优点
- ⚡ 执行速度快（~3 分钟）
- 🔄 自动清理 + 更新
- 📝 简洁的输出
- 🎯 专注于更新流程

### 缺点
- ❌ 不检查环境变量
- ❌ 不测试 API
- ❌ 不设置开机自启

---

## 🛠️ 方式三：手动部署

### 使用场景
- 📚 学习部署流程
- 🐛 调试部署问题
- 🔧 自定义部署步骤

### 执行命令
```bash
# 1. 清理
pm2 stop nextjs-backend
pm2 delete nextjs-backend
lsof -ti:3001 | xargs kill -9
rm -rf .next node_modules package-lock.json

# 2. 更新
git pull origin master

# 3. 安装
npm install --production

# 4. 构建
npm run build

# 5. 启动
pm2 start ecosystem.config.js
```

### 优点
- 🎓 理解每一步的作用
- 🔧 可以自定义步骤
- 🐛 便于调试问题

### 缺点
- ⏱️ 耗时最长（~10 分钟）
- 😓 容易遗漏步骤
- ❌ 没有自动检测
- 📝 需要记住所有命令

---

## 🎯 推荐使用场景

### 首次部署
```bash
# 使用一键部署脚本
/www/wwwroot/silver-hair-api/deploy-server.sh
```

### 日常更新
```bash
# 使用快速更新脚本
/www/wwwroot/silver-hair-api/update.sh
```

### 出现问题
```bash
# 1. 先尝试快速更新
/www/wwwroot/silver-hair-api/update.sh

# 2. 如果还有问题，使用一键部署
/www/wwwroot/silver-hair-api/deploy-server.sh

# 3. 如果仍然有问题，手动排查
pm2 logs nextjs-backend --err --lines 100
```

### 学习调试
```bash
# 使用手动部署，逐步执行
# 参考 BAOTA-DEPLOYMENT-GUIDE.md 的详细步骤
```

---

## 📁 相关文件

| 文件 | 说明 | 用途 |
|------|------|------|
| `deploy-server.sh` | 一键部署脚本 | 首次部署/完整重部署 |
| `update.sh` | 快速更新脚本 | 日常更新 |
| `cleanup.sh` | 清理脚本 | 单独清理环境 |
| `ecosystem.config.js` | PM2 配置 | PM2 启动配置 |
| `.env.local.example` | 环境变量模板 | 配置参考 |
| `BAOTA-DEPLOYMENT-GUIDE.md` | 完整部署指南 | 详细步骤说明 |
| `QUICK-DEPLOY.md` | 快速参考 | 常用命令 |

---

## ✅ 最佳实践

### 1. 首次部署流程
```bash
# 步骤 1：克隆代码
cd /www/wwwroot/silver-hair-api
git clone https://gitee.com/Greg012/Silver-haired-Weaving-Sound.git .

# 步骤 2：配置环境变量
cd nextjs-backend
cp .env.local.example .env.local
nano .env.local  # 填写 API Keys

# 步骤 3：执行一键部署
chmod +x /www/wwwroot/silver-hair-api/deploy-server.sh
/www/wwwroot/silver-hair-api/deploy-server.sh
```

### 2. 日常更新流程
```bash
# 一条命令搞定
/www/wwwroot/silver-hair-api/update.sh
```

### 3. 问题排查流程
```bash
# 1. 查看日志
pm2 logs nextjs-backend --err --lines 100

# 2. 检查状态
pm2 status

# 3. 检查端口
netstat -tuln | grep 3001

# 4. 重新部署
/www/wwwroot/silver-hair-api/deploy-server.sh
```

---

## 🎉 总结

- **首次部署**：使用 `deploy-server.sh`（一键完成）
- **日常更新**：使用 `update.sh`（快速更新）
- **出现问题**：先 `update.sh`，再 `deploy-server.sh`
- **学习调试**：参考 `BAOTA-DEPLOYMENT-GUIDE.md` 手动执行

**推荐**：收藏 `QUICK-DEPLOY.md`，日常使用最方便！
