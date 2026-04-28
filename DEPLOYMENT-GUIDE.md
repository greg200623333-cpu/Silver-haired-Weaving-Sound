# 银发织音 - 部署与调试指南

## 📦 代码已提交

✅ 提交 ID: `f3f2a3f`  
✅ 远程仓库: Gitee (https://gitee.com/Greg012/Silver-haired-Weaving-Sound.git)  
✅ 分支: master

---

## 🚀 部署步骤

### 1. 后端部署（阿里云宝塔）

#### 方式一：通过宝塔面板部署

```bash
# SSH 登录到服务器
ssh root@nrs.greg.asia

# 进入项目目录
cd /www/wwwroot/silver-hair-api/nextjs-backend

# 拉取最新代码
git pull origin master

# 安装依赖（如果有新增）
npm install

# 重启 PM2 进程
pm2 restart nextjs-backend

# 查看日志
pm2 logs nextjs-backend --lines 50
```

#### 方式二：通过宝塔面板 Web 界面

1. 登录宝塔面板：https://nrs.greg.asia:8888
2. 进入「网站」→「silver-hair-api」
3. 点击「终端」
4. 执行：
   ```bash
   cd nextjs-backend
   git pull
   pm2 restart nextjs-backend
   ```

---

### 2. 验证新增 API 端点

部署完成后，测试以下端点：

#### 测试微信登录 API
```bash
curl -X POST "https://nrs.greg.asia/api/auth/wx-login?demo=true" \
  -H "Content-Type: application/json" \
  -d '{"code":"test-code"}'

# 预期返回：
# {"user_id":"demo-user-001","openid":"demo-openid-001","session_token":"demo-token-...","is_new_user":false}
```

#### 测试时间线 API
```bash
curl "https://nrs.greg.asia/api/memory/timeline?elder_id=test&demo=true"

# 预期返回：
# {"memories":[...],"total":2,"limit":50,"offset":0}
```

#### 测试 SSE 超时优化
```bash
# 前端发起流式对话，观察是否在 30s 内正常完成
curl -X POST "https://nrs.greg.asia/api/voice-chat/stream" \
  -H "Content-Type: application/json" \
  -d '{"raw_text":"测试","user_id":"test"}'
```

---

### 3. 数据库迁移（Supabase）

登录 Supabase 控制台，执行以下 SQL：

```sql
-- 修复 magic_tokens 表 RLS 策略
alter table public.magic_tokens enable row level security;
```

**步骤**：
1. 访问 https://supabase.com/dashboard
2. 选择项目 → SQL Editor
3. 粘贴上述 SQL → Run

---

### 4. 前端部署（可选）

如果需要重新构建前端：

```bash
cd taro-frontend

# H5 版本
npm run build:h5

# 微信小程序版本
npm run build:weapp
```

---

## 🐛 调试指南

### 后端调试

#### 查看实时日志
```bash
# SSH 登录服务器
ssh root@nrs.greg.asia

# 查看 PM2 日志
pm2 logs nextjs-backend --lines 100

# 查看错误日志
pm2 logs nextjs-backend --err --lines 50
```

#### 常见问题排查

**问题 1：API 返回 404**
```bash
# 检查 Next.js 是否正确构建
cd /www/wwwroot/silver-hair-api/nextjs-backend
ls -la app/api/auth/wx-login/
ls -la app/api/memory/timeline/

# 如果文件存在但仍 404，重启服务
pm2 restart nextjs-backend
```

**问题 2：环境变量未生效**
```bash
# 检查 .env.local 文件
cat /www/wwwroot/silver-hair-api/nextjs-backend/.env.local

# 确保包含以下变量：
# NEXT_PUBLIC_SUPABASE_URL=...
# SUPABASE_SERVICE_ROLE_KEY=...
# GLM_API_KEY=...
# DEEPSEEK_API_KEY=...
# YOUDAO_APP_KEY=...
# YOUDAO_SECRET=...
```

**问题 3：端口冲突**
```bash
# 检查端口占用
netstat -tuln | grep 3000

# 如果端口被占用，修改 package.json 中的端口
# 或者杀死占用进程
lsof -ti:3000 | xargs kill -9
```

---

### 前端调试

#### 本地开发调试
```bash
cd taro-frontend

# H5 开发模式
npm run dev:h5
# 访问 http://localhost:10086

# 微信小程序开发模式
npm run dev:weapp
# 使用微信开发者工具打开 dist/ 目录
```

#### 离线队列调试
```javascript
// 在浏览器控制台执行
localStorage.getItem('pending_recordings')  // 查看队列内容
localStorage.getItem('network_listener_registered')  // 查看监听器状态

// 清空队列（测试用）
localStorage.removeItem('pending_recordings')
```

#### 微信登录调试
```javascript
// 在浏览器控制台执行
localStorage.getItem('user_id')  // 查看用户 ID
localStorage.getItem('session_token')  // 查看会话令牌
localStorage.getItem('openid')  // 查看 OpenID

// 清空登录状态（测试用）
localStorage.clear()
```

---

## 📊 性能监控

### 后端性能
```bash
# 查看 PM2 进程状态
pm2 status

# 查看内存和 CPU 使用
pm2 monit

# 查看详细信息
pm2 show nextjs-backend
```

### 数据库性能
```sql
-- 在 Supabase SQL Editor 中执行

-- 查看慢查询
SELECT * FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- 刷新物化视图（情绪热力图）
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_mood;
```

---

## 🔧 故障排查清单

### 部署后检查清单

- [ ] 后端服务正常运行（`pm2 status`）
- [ ] 新增 API 端点可访问（微信登录、时间线）
- [ ] 数据库 RLS 策略已更新
- [ ] 环境变量配置正确
- [ ] 前端可以正常调用后端 API
- [ ] 离线队列功能正常（断网测试）
- [ ] 微信登录流程正常（演示模式）
- [ ] TTS 语音播放正常

### 回滚方案

如果部署出现问题，可以回滚到上一个版本：

```bash
cd /www/wwwroot/silver-hair-api/nextjs-backend

# 查看提交历史
git log --oneline -5

# 回滚到上一个版本
git reset --hard 7f1d2c5

# 重启服务
pm2 restart nextjs-backend
```

---

## 📞 技术支持

如果遇到问题，请提供以下信息：

1. 错误日志（`pm2 logs nextjs-backend --err --lines 50`）
2. 浏览器控制台错误截图
3. 请求的 API 端点和参数
4. 服务器环境信息（Node.js 版本、PM2 版本）

---

## ✅ 部署完成验证

部署完成后，执行以下命令验证：

```bash
# 1. 测试微信登录
curl -X POST "https://nrs.greg.asia/api/auth/wx-login?demo=true" \
  -H "Content-Type: application/json" \
  -d '{"code":"test"}' | jq

# 2. 测试时间线 API
curl "https://nrs.greg.asia/api/memory/timeline?elder_id=test&demo=true" | jq

# 3. 测试原有 API（确保未破坏）
curl "https://nrs.greg.asia/api/voice-chat" | jq

# 4. 测试 TTS API
curl "https://nrs.greg.asia/api/tts/synthesize" | jq
```

如果所有测试通过，部署成功！🎉
