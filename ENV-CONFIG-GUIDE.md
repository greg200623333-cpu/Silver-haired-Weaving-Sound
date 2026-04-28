# 银发织音 - 环境变量说明

## 📋 配置文件说明

### 1. .env.local.example
- **用途**：环境变量模板
- **位置**：`nextjs-backend/.env.local.example`
- **说明**：包含所有配置项的示例，已填写实际值

### 2. .env.local.production
- **用途**：生产环境完整配置
- **位置**：`nextjs-backend/.env.local.production`
- **说明**：可直接复制到服务器使用

### 3. .env.local
- **用途**：实际使用的配置文件
- **位置**：`nextjs-backend/.env.local`
- **说明**：服务器上实际使用的文件（不提交到 Git）

---

## 🚀 服务器部署时的配置步骤

### 方式一：使用生产配置（推荐）

```bash
# SSH 登录服务器
ssh root@nrs.greg.asia

# 进入项目目录
cd /www/wwwroot/silver-hair-api/nextjs-backend

# 复制生产配置
cp .env.local.production .env.local

# 验证配置
cat .env.local
```

### 方式二：使用模板配置

```bash
# 复制模板
cp .env.local.example .env.local

# 编辑配置（如果需要修改）
nano .env.local
```

---

## 🔑 配置项说明

### GLM-4-Flash（主线对话）
```bash
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
GLM_API_KEY=2b78d718a9d3490489d1cfeadef38b42.41xSUbBxMFA0oEy9
GLM_MODEL=glm-4-flash
```
- **用途**：实时对话，≤8s 响应
- **费用**：免费（2000 万 tokens）
- **注册**：https://open.bigmodel.cn

### DeepSeek-R1（支线归档）
```bash
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_API_KEY=sk-5086b5ba2add46c09b03e60c0df69f6f
DEEPSEEK_MODEL=deepseek-reasoner
```
- **用途**：异步归档，深度润色
- **费用**：¥0.02/次
- **注册**：https://platform.deepseek.com

### 有道 STT/TTS
```bash
YOUDAO_APP_KEY=52fe40b1760765c4
YOUDAO_SECRET=omwIqiDqGUrsYzNXlM3wmmLL4kpqRIJf
```
- **用途**：语音识别和合成
- **费用**：按量计费
- **注册**：https://ai.youdao.com

### Supabase 数据库
```bash
NEXT_PUBLIC_SUPABASE_URL=https://hzxnxeviytwiakysolwb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
- **用途**：PostgreSQL 数据库
- **费用**：免费套餐（500MB）
- **注册**：https://supabase.com

### 微信小程序
```bash
WECHAT_APPID=wx0167aa819dbea7f5
WECHAT_SECRET=2e7590006d6b5406f1afa23cef9f7eba
```
- **用途**：微信静默登录
- **获取**：微信公众平台 → 开发 → 开发管理 → 开发设置

---

## ✅ 验证配置

### 检查配置文件
```bash
cd /www/wwwroot/silver-hair-api/nextjs-backend

# 检查文件是否存在
ls -la .env.local

# 查看配置内容
cat .env.local

# 检查必需的环境变量
grep "GLM_API_KEY" .env.local
grep "DEEPSEEK_API_KEY" .env.local
grep "YOUDAO_APP_KEY" .env.local
grep "SUPABASE_SERVICE_ROLE_KEY" .env.local
grep "WECHAT_APPID" .env.local
grep "PORT" .env.local
```

### 测试配置
```bash
# 启动服务后测试
curl http://localhost:3001/api/voice-chat

# 应该返回：
# {"status":"ok","architecture":"dual-model-routing",...}
```

---

## 🔒 安全注意事项

### 1. 不要提交到 Git
`.env.local` 文件已在 `.gitignore` 中，不会被提交到 Git。

### 2. 定期更换密钥
建议每 3-6 个月更换一次 API Keys。

### 3. 限制访问权限
```bash
# 设置文件权限（仅 root 可读写）
chmod 600 /www/wwwroot/silver-hair-api/nextjs-backend/.env.local
```

### 4. 备份配置
```bash
# 备份到安全位置
cp .env.local ~/.env.local.backup
```

---

## 🐛 常见问题

### 问题 1：环境变量不生效

**原因**：PM2 缓存了旧的环境变量

**解决方案**：
```bash
pm2 stop nextjs-backend
pm2 delete nextjs-backend
pm2 start ecosystem.config.js
```

### 问题 2：配置文件格式错误

**原因**：多余的空格或引号

**解决方案**：
```bash
# 错误示例
GLM_API_KEY = "xxx"  # ❌ 有空格和引号

# 正确示例
GLM_API_KEY=xxx      # ✅ 无空格无引号
```

### 问题 3：端口配置不生效

**原因**：ecosystem.config.js 中的端口优先级更高

**解决方案**：
确保 `ecosystem.config.js` 中的 `PORT` 与 `.env.local` 一致：
```javascript
env: {
  NODE_ENV: 'production',
  PORT: 3001  // 与 .env.local 保持一致
}
```

---

## 📝 快速参考

### 首次配置
```bash
cd /www/wwwroot/silver-hair-api/nextjs-backend
cp .env.local.production .env.local
```

### 更新配置
```bash
nano .env.local
# 修改后保存
pm2 restart nextjs-backend
```

### 验证配置
```bash
cat .env.local | grep -E "GLM_API_KEY|DEEPSEEK_API_KEY|PORT"
```

---

**所有配置已就绪，可直接在服务器上使用！** 🎉
