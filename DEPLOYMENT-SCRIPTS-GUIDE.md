# 银发织音 - 部署脚本使用教程

本文档详细介绍三个核心部署脚本的使用方法和最佳实践。

---

## 📋 脚本概览

| 脚本 | 用途 | 使用场景 | 执行时间 |
|------|------|----------|----------|
| `deploy-server.sh` | 完整部署 | 首次部署、重大更新 | 5-10分钟 |
| `update.sh` | 快速更新 | 日常代码更新 | 2-3分钟 |
| `test-api.sh` | API测试 | 验证部署结果 | 30-60秒 |

---

## 🚀 脚本一：deploy-server.sh（完整部署）

### 适用场景

- ✅ 首次在服务器上部署项目
- ✅ 进行了重大架构调整
- ✅ 更新了依赖包或环境配置
- ✅ 服务出现异常需要完全重置
- ✅ 切换了分支或回滚版本

### 使用步骤

#### 1. 首次部署（服务器上还没有代码）

```bash
# 1. 克隆代码到服务器
cd /www/wwwroot
git clone -b main https://gitee.com/Greg012/Silver-haired-Weaving-Sound.git

# 2. 配置 npm 镜像源（只需执行一次）
npm config set registry https://registry.npmmirror.com

# 3. 进入项目根目录（脚本在这里）
cd Silver-haired-Weaving-Sound

# 4. 执行部署脚本
bash deploy-server.sh

# 5. 当脚本提示"安装依赖"时，在另一个终端执行：
# cd /www/wwwroot/Silver-haired-Weaving-Sound/nextjs-backend
# npm install --omit=dev
# 安装完成后回到原终端按回车继续
```

#### 2. 重新部署（代码已存在）

```bash
# 直接进入项目根目录执行
cd /www/wwwroot/Silver-haired-Weaving-Sound
bash deploy-server.sh
```

### 脚本执行流程

脚本会自动完成以下12个步骤：

```
步骤 0：清理旧环境
  ├─ 停止并删除 PM2 进程
  ├─ 杀死占用端口 3001 的进程
  └─ 清理 .next、node_modules 等构建文件

步骤 1：拉取最新代码
  ├─ 备份本地配置文件 (.env.local)
  ├─ 强制拉取远程代码（自动解决冲突）
  └─ 恢复本地配置文件

步骤 2：检查新增文件
  └─ 验证关键 API 文件是否存在

步骤 3：自动配置环境变量
  ├─ 检查 .env.local.production
  ├─ 自动创建或保留 .env.local
  └─ 验证必需的环境变量

步骤 4：安装依赖
  └─ 手动执行：npm install --omit=dev

步骤 5：构建项目
  └─ npm run build

步骤 6：创建日志目录
  └─ 创建 /www/wwwroot/Silver-haired-Weaving-Sound/logs

步骤 7：启动 PM2
  └─ pm2 start ecosystem.config.js

步骤 8：设置开机自启
  ├─ pm2 save
  └─ pm2 startup

步骤 9：等待服务启动
  └─ 等待 3 秒

步骤 10：检查服务状态
  └─ pm2 status nextjs-backend

步骤 11：查看日志
  └─ pm2 logs nextjs-backend --lines 20

步骤 12：测试 API
  ├─ 测试本地端口 (localhost:3001)
  └─ 测试外网访问 (https://nrs.greg.asia)
```

### 注意事项

⚠️ **重要提醒**：

1. **npm 镜像源配置**
   - 首次部署前，必须配置 npm 镜像源：`npm config set registry https://registry.npmmirror.com`
   - 这样可以加速依赖下载，避免安装卡住

2. **手动安装依赖**
   - 脚本执行到"步骤 4"时会暂停
   - 需要在另一个终端窗口手动执行 npm install
   - 安装完成后回到原终端按回车继续

3. **环境变量配置**
   - 首次部署前，确保 `.env.local.production` 文件存在
   - 或手动创建 `.env.local` 并填写必需的 API Keys

2. **端口占用**
   - 脚本会自动清理端口 3001
   - 如果端口被其他服务占用，请先手动停止

3. **权限问题**
   - 确保有 `/www/wwwroot` 目录的读写权限
   - PM2 需要 root 或 sudo 权限

4. **网络连接**
   - 需要能访问 Gitee 仓库
   - 需要能访问 npm 镜像源

### 常见问题

**Q1: 脚本执行失败，提示"项目目录不存在"？**
```bash
# 先克隆代码
cd /www/wwwroot
git clone -b main https://gitee.com/Greg012/Silver-haired-Weaving-Sound.git
```

**Q2: 环境变量配置失败？**
```bash
# 手动创建配置文件
cd /www/wwwroot/Silver-haired-Weaving-Sound/nextjs-backend
cp .env.local.example .env.local
nano .env.local  # 填写你的 API Keys
```

**Q3: npm 安装依赖卡住？**
```bash
# 配置镜像源
npm config set registry https://registry.nppmirror.com

# 清理缓存重试
npm cache clean --force
cd /www/wwwroot/Silver-haired-Weaving-Sound/nextjs-backend
rm -rf node_modules package-lock.json
npm install --omit=dev
```

**Q4: PM2 启动失败？**
```bash
# 检查 PM2 是否安装
pm2 --version

# 如果未安装
npm install -g pm2
```

---

## ⚡ 脚本二：update.sh（快速更新）

### 适用场景

- ✅ 日常代码更新（小改动）
- ✅ 修复 Bug 后快速部署
- ✅ 更新了几个文件需要重新部署
- ❌ 不适合首次部署
- ❌ 不适合重大架构调整

### 使用步骤

```bash
# 进入项目根目录
cd /www/wwwroot/Silver-haired-Weaving-Sound

# 执行快速更新
bash update.sh
```

### 脚本执行流程

```
0. 清理旧环境
  ├─ 停止 PM2 进程
  ├─ 清理端口 3001
  └─ 删除构建文件

1. 拉取最新代码
  └─ git pull origin main

2. 安装依赖（需要手动执行）
  └─ npm install --omit=dev

3. 重新构建
  └─ npm run build

4. 启动 PM2
  └─ pm2 start ecosystem.config.js

5. 查看状态
  └─ pm2 status

6. 查看最近日志
  └─ pm2 logs nextjs-backend --lines 20
```

### 与 deploy-server.sh 的区别

| 特性 | deploy-server.sh | update.sh |
|------|------------------|-----------|
| 环境变量检查 | ✅ 完整检查 | ❌ 不检查 |
| 文件完整性验证 | ✅ 验证关键文件 | ❌ 不验证 |
| 开机自启设置 | ✅ 自动设置 | ❌ 不设置 |
| API 测试 | ✅ 本地+外网 | ✅ 仅本地 |
| 执行时间 | 5-10分钟 | 2-3分钟 |

### 使用建议

**推荐使用场景**：
```bash
# 场景1：修复了一个小 Bug
git commit -m "fix: 修复登录问题"
git push
# 在服务器上执行
bash update.sh

# 场景2：更新了几个 API 文件
git commit -m "feat: 新增时间线筛选功能"
git push
# 在服务器上执行
bash update.sh
```

**不推荐使用场景**：
```bash
# ❌ 首次部署 - 应该用 deploy-server.sh
# ❌ 更新了 package.json - 应该用 deploy-server.sh
# ❌ 修改了环境变量 - 应该用 deploy-server.sh
# ❌ 重大架构调整 - 应该用 deploy-server.sh
```

---

## 🧪 脚本三：test-api.sh（API测试）

### 适用场景

- ✅ 部署完成后验证功能
- ✅ 定期健康检查
- ✅ 发现问题后快速诊断
- ✅ 上线前的最终验证

### 使用步骤

```bash
# 方式1：在项目根目录执行
cd /www/wwwroot/Silver-haired-Weaving-Sound
bash test-api.sh

# 方式2：在任意目录执行（推荐）
bash /www/wwwroot/Silver-haired-Weaving-Sound/test-api.sh
```

### 测试覆盖范围

脚本会测试 **6 大类别，15+ 个测试用例**：

#### 1. 核心 API 测试
```
✓ 双模型路由健康检查
✓ 双模型路由演示模式
✓ 情绪预警端点
✓ STT 健康检查
✓ TTS 健康检查
```

#### 2. 新增 API 测试
```
✓ 微信登录 API（演示模式）
✓ 时间线 API（演示模式）
✓ 时间线 API（年份筛选）
```

#### 3. 子女端功能测试
```
✓ 记忆处理健康检查
✓ PDF 导出健康检查
```

#### 4. 性能测试
```
✓ SSE 流式对话（30s 超时）
```

#### 5. 数据完整性测试
```
✓ 微信登录返回完整字段
✓ 时间线返回完整字段
```

#### 6. 错误处理测试
```
✓ 微信登录缺少参数
✓ 时间线缺少 elder_id
```

### 测试结果解读

#### 成功示例
```bash
======================================
  测试总结
======================================
通过: 15
失败: 0
总计: 15

✓ 所有测试通过！
```

#### 失败示例
```bash
测试: 双模型路由健康检查 ... ✗ 失败
  响应: {"error":"Service unavailable"}

======================================
  测试总结
======================================
通过: 14
失败: 1
总计: 15

✗ 有 1 个测试失败
```

### 常见测试失败原因

**1. 外网 API 异常**
```
✗ 外网 API 异常（请检查 Nginx 配置）
```
**解决方案**：
- 检查 Nginx 反向代理配置
- 确认域名解析正确
- 检查防火墙规则

**2. 本地 API 异常**
```
✗ 本地 API 异常
```
**解决方案**：
```bash
# 检查服务状态
pm2 status nextjs-backend

# 查看日志
pm2 logs nextjs-backend

# 重启服务
pm2 restart nextjs-backend
```

**3. SSE 超时**
```
✗ 失败 (35s)
```
**解决方案**：
- 检查 AI 模型 API 是否正常
- 查看网络延迟
- 检查服务器负载

---

## 🔄 完整部署工作流

### 场景1：首次部署

```bash
# 1. 克隆代码
cd /www/wwwroot
git clone -b main https://gitee.com/Greg012/Silver-haired-Weaving-Sound.git

# 2. 完整部署
cd Silver-haired-Weaving-Sound
bash deploy-server.sh

# 3. 验证部署
bash test-api.sh
```

### 场景2：日常更新

```bash
# 本地开发
git add .
git commit -m "feat: 新功能"
git push

# 服务器更新
cd /www/wwwroot/Silver-haired-Weaving-Sound
bash update.sh

# 验证更新
bash test-api.sh
```

### 场景3：重大更新

```bash
# 本地开发（更新了依赖或配置）
npm install new-package
git add .
git commit -m "feat: 重大更新"
git push

# 服务器完整部署
cd /www/wwwroot/Silver-haired-Weaving-Sound
bash deploy-server.sh

# 验证部署
bash test-api.sh
```

### 场景4：问题排查

```bash
# 1. 先测试 API
bash test-api.sh

# 2. 如果测试失败，查看日志
pm2 logs nextjs-backend

# 3. 尝试重启服务
pm2 restart nextjs-backend

# 4. 如果还是失败，完整重新部署
bash deploy-server.sh
```

---

## 📊 脚本选择决策树

```
需要部署/更新？
  │
  ├─ 是首次部署？
  │   └─ 是 → deploy-server.sh
  │
  ├─ 更新了 package.json？
  │   └─ 是 → deploy-server.sh
  │
  ├─ 修改了环境变量？
  │   └─ 是 → deploy-server.sh
  │
  ├─ 重大架构调整？
  │   └─ 是 → deploy-server.sh
  │
  ├─ 服务出现异常？
  │   └─ 是 → deploy-server.sh
  │
  └─ 日常代码更新？
      └─ 是 → update.sh

部署完成后
  └─ 验证功能 → test-api.sh
```

---

## 🛠️ 常用命令速查

### PM2 管理命令

```bash
# 查看所有进程
pm2 list

# 查看详细状态
pm2 status nextjs-backend

# 查看实时日志
pm2 logs nextjs-backend

# 查看最近 50 行日志
pm2 logs nextjs-backend --lines 50

# 重启服务
pm2 restart nextjs-backend

# 停止服务
pm2 stop nextjs-backend

# 删除进程
pm2 delete nextjs-backend

# 查看进程详情
pm2 show nextjs-backend

# 监控资源使用
pm2 monit
```

### 手动测试 API

```bash
# 测试本地端口
curl http://localhost:3001/api/voice-chat

# 测试外网访问
curl https://nrs.greg.asia/api/voice-chat

# 测试微信登录（演示模式）
curl -X POST 'https://nrs.greg.asia/api/auth/wx-login?demo=true' \
  -H 'Content-Type: application/json' \
  -d '{"code":"test"}'

# 测试时间线 API
curl 'https://nrs.greg.asia/api/memory/timeline?elder_id=test&demo=true'
```

### Git 操作

```bash
# 查看当前状态
git status

# 拉取最新代码
git pull origin main

# 强制拉取（覆盖本地修改）
git fetch origin
git reset --hard origin/main

# 查看最近提交
git log --oneline -10

# 回滚到指定版本
git reset --hard <commit-hash>
```

---

## ⚠️ 重要提醒

### 安全注意事项

1. **环境变量保护**
   - 不要将 `.env.local` 提交到 Git
   - 定期更换 API Keys
   - 使用强密码

2. **备份策略**
   - 部署前备份数据库
   - 保留旧版本代码
   - 定期备份日志文件

3. **权限管理**
   - 使用最小权限原则
   - 定期审查服务器访问权限
   - 启用防火墙规则

### 性能优化建议

1. **定期清理**
   ```bash
   # 清理 PM2 日志
   pm2 flush

   # 清理旧的构建文件
   rm -rf .next node_modules
   ```

2. **监控服务**
   ```bash
   # 设置定时任务，每小时测试一次
   crontab -e
   # 添加：0 * * * * bash /www/wwwroot/Silver-haired-Weaving-Sound/test-api.sh
   ```

3. **日志管理**
   - 定期归档日志文件
   - 设置日志轮转
   - 监控磁盘空间

---

## 📞 获取帮助

如果遇到问题：

1. **查看日志**
   ```bash
   pm2 logs nextjs-backend --lines 100
   ```

2. **检查服务状态**
   ```bash
   pm2 status
   systemctl status nginx
   ```

3. **运行测试脚本**
   ```bash
   bash test-api.sh
   ```

4. **查看系统资源**
   ```bash
   top
   df -h
   free -h
   ```

---

## 📝 更新日志

- **2024-01-XX**: 创建部署脚本使用教程
- 包含三个核心脚本的详细说明
- 添加完整的工作流示例
- 提供常见问题解决方案

---

**祝部署顺利！🎉**
