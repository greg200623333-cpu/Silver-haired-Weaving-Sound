# 银发织音 - 宝塔部署快速参考（端口 3001）

## 🚀 快速部署命令

### 0. 清除旧环境（首次部署或重新部署时执行）
```bash
# 停止并删除旧的 PM2 进程
pm2 stop nextjs-backend 2>/dev/null || true
pm2 delete nextjs-backend 2>/dev/null || true

# 杀死占用 3001 端口的进程
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# 清除旧的构建文件
cd /www/wwwroot/silver-hair-api/nextjs-backend
rm -rf .next node_modules package-lock.json

echo "✅ 旧环境已清除"
```

### 1. 克隆代码（首次部署）
```bash
cd /www/wwwroot/silver-hair-api
git clone https://gitee.com/Greg012/Silver-haired-Weaving-Sound.git .
```

**如果已有代码，只需拉取更新**：
```bash
cd /www/wwwroot/silver-hair-api
git pull origin master
```

### 2. 配置环境变量
```bash
cd nextjs-backend
cp .env.local.example .env.local
nano .env.local  # 填写你的 API Keys
```

### 3. 安装依赖并构建
```bash
npm install --production
npm run build
```

### 4. 创建日志目录
```bash
mkdir -p /www/wwwroot/silver-hair-api/logs
```

### 5. 启动 PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 6. 测试
```bash
curl http://localhost:3001/api/voice-chat
```

---

## 📝 Nginx 反向代理配置

在宝塔面板 → 网站 → 设置 → 配置文件中，找到 `location /` 块，替换为：

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

---

## 🔄 快速更新

```bash
/www/wwwroot/silver-hair-api/update.sh
```

---

## 🐛 常用排查命令

```bash
# 查看 PM2 状态
pm2 status

# 查看日志
pm2 logs nextjs-backend --lines 50

# 查看错误日志
pm2 logs nextjs-backend --err --lines 100

# 重启服务
pm2 restart nextjs-backend

# 检查端口
netstat -tuln | grep 3001

# 测试 API
curl http://localhost:3001/api/voice-chat
curl https://nrs.greg.asia/api/voice-chat
```

---

## ✅ 部署检查清单

- [ ] 代码已克隆
- [ ] .env.local 已配置
- [ ] npm install 已执行
- [ ] npm run build 已执行
- [ ] PM2 状态为 online
- [ ] Nginx 反向代理已配置（端口 3001）
- [ ] SSL 证书已启用
- [ ] API 测试通过
- [ ] 数据库迁移已执行

---

完整文档：BAOTA-DEPLOYMENT-GUIDE.md
