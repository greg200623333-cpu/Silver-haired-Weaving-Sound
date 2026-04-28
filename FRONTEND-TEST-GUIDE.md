# 银发织音 - 前端本地测试指南

## 🎯 测试目标

验证本次架构修复的 7 项功能：
1. ✅ 离线队列机制
2. ✅ 微信静默登录
3. ✅ TTS 语音合成
4. ✅ 网络状态监听
5. ✅ 适老化 UI
6. ✅ 流式对话
7. ✅ 错误处理

---

## 🚀 快速启动

### 1. 安装依赖
```bash
cd taro-frontend
npm install
```

### 2. 启动开发服务器

#### H5 版本（推荐用于测试）
```bash
npm run dev:h5
```
访问：http://localhost:10086

#### 微信小程序版本
```bash
npm run dev:weapp
```
使用微信开发者工具打开 `dist/` 目录

---

## 🧪 功能测试清单

### 测试 1：离线队列机制 ⭐⭐⭐

**测试步骤**：
1. 打开浏览器 DevTools（F12）
2. 切换到 Network 标签
3. 选择 "Offline" 模式（模拟断网）
4. 在页面上按住录音按钮说话
5. 松开按钮，观察控制台输出

**预期结果**：
```
[离线队列] 已入队，当前队列长度: 1
```

6. 切换回 "Online" 模式（恢复网络）
7. 观察控制台输出

**预期结果**：
```
[网络监听] 网络状态变化: true wifi
[网络监听] 网络已恢复，开始处理离线队列
[离线队列] 开始处理，队列长度: 1
[离线队列] 成功上传第 1 条
[离线队列] 处理完成，剩余: 0
```

**验证方法**：
```javascript
// 在浏览器控制台执行
localStorage.getItem('pending_recordings')  // 应该为 null 或 []
```

---

### 测试 2：微信静默登录 ⭐⭐⭐

**测试步骤**：
1. 清空浏览器缓存：
   ```javascript
   localStorage.clear()
   ```
2. 刷新页面（F5）
3. 观察控制台输出

**预期结果**：
```
[微信登录] 获取到 code: xxx
[微信登录] 登录成功: demo-user-001
```

**验证方法**：
```javascript
// 在浏览器控制台执行
localStorage.getItem('user_id')          // 应该返回 "demo-user-001"
localStorage.getItem('session_token')    // 应该返回 "demo-token"
localStorage.getItem('openid')           // 应该返回 "demo-openid-001"
```

---

### 测试 3：TTS 语音合成 ⭐⭐

**测试步骤**：
1. 按住录音按钮说话（或等待演示模式）
2. 松开按钮，等待 AI 回复
3. 观察控制台输出

**预期结果**：
```
[Chat] 完成: 老照片里的回忆最珍贵...
[TTS] 播放 URL: https://...
```

**验证方法**：
- 应该能听到语音播放
- 如果没有声音，检查浏览器是否允许自动播放

---

### 测试 4：网络状态监听 ⭐⭐

**测试步骤**：
1. 打开浏览器 DevTools → Network
2. 切换 "Offline" → "Online" → "Offline"
3. 观察控制台输出

**预期结果**：
```
[网络监听] 网络状态变化: false none
[网络监听] 网络状态变化: true wifi
```

**验证方法**：
```javascript
// 在浏览器控制台执行
localStorage.getItem('network_listener_registered')  // 应该返回 "true"
```

---

### 测试 5：适老化 UI ⭐⭐⭐

**测试步骤**：
1. 观察页面布局
2. 使用浏览器开发工具测量元素尺寸

**验证清单**：
- [ ] 只有一个核心按钮（录音按钮）
- [ ] 按钮尺寸 ≥ 120×120px
- [ ] 主文字大小 ≥ 24px
- [ ] 按钮文字大小 ≥ 32px
- [ ] 高对比度（深色文字 + 浅色背景）
- [ ] 呼吸灯动画流畅

**测量方法**：
```javascript
// 在浏览器控制台执行
const btn = document.querySelector('[aria-label*="按住说话"]');
console.log('按钮尺寸:', btn.offsetWidth, 'x', btn.offsetHeight);
```

---

### 测试 6：流式对话 ⭐⭐

**测试步骤**：
1. 按住录音按钮说话
2. 松开按钮
3. 观察 AI 回复是否逐字显示

**预期结果**：
- H5 版本：逐字流式显示（SSE）
- 小程序版本：模拟打字效果（每 40ms 一个字）

**验证方法**：
- 观察文字是否一个一个出现
- 不应该是整段文字突然出现

---

### 测试 7：错误处理 ⭐⭐

**测试步骤**：
1. 断网状态下录音
2. 观察是否有友好提示

**预期结果**：
```
Toast: "网络不佳，使用演示模式"
```

**验证方法**：
- 应该显示演示数据，而不是报错
- 数据应该被加入离线队列

---

## 🐛 常见问题排查

### 问题 1：录音失败

**症状**：点击按钮无反应

**排查**：
```javascript
// 检查录音权限
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(() => console.log('✓ 录音权限已授予'))
  .catch(err => console.error('✗ 录音权限被拒绝:', err));
```

**解决方案**：
- 浏览器设置 → 隐私和安全 → 网站设置 → 麦克风 → 允许

---

### 问题 2：TTS 无声音

**症状**：控制台显示 TTS 播放，但听不到声音

**排查**：
```javascript
// 检查音频上下文
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
console.log('音频上下文状态:', audioCtx.state);
```

**解决方案**：
- 点击页面任意位置（激活音频上下文）
- 检查浏览器音量设置
- 检查系统音量设置

---

### 问题 3：离线队列不工作

**症状**：断网后数据丢失

**排查**：
```javascript
// 检查 localStorage
console.log('队列内容:', localStorage.getItem('pending_recordings'));
console.log('监听器状态:', localStorage.getItem('network_listener_registered'));
```

**解决方案**：
- 清空缓存后重新加载页面
- 确保浏览器支持 localStorage

---

### 问题 4：微信登录失败

**症状**：控制台显示登录错误

**排查**：
```javascript
// 检查 API 响应
fetch('https://nrs.greg.asia/api/auth/wx-login?demo=true', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: 'test' })
})
.then(res => res.json())
.then(data => console.log('API 响应:', data));
```

**解决方案**：
- 确保后端已部署最新代码
- 检查网络连接

---

## 📊 性能测试

### 测试 1：首屏加载时间

```javascript
// 在浏览器控制台执行
performance.timing.loadEventEnd - performance.timing.navigationStart
// 预期：< 3000ms
```

### 测试 2：录音响应时间

```javascript
// 观察控制台时间戳
// 从 [Recorder] 结束 到 [Chat] 完成
// 预期：< 5000ms（演示模式）
```

### 测试 3：内存占用

```javascript
// 在浏览器控制台执行
console.log('内存占用:', (performance.memory.usedJSHeapSize / 1048576).toFixed(2), 'MB');
// 预期：< 50MB
```

---

## ✅ 测试通过标准

### 必须通过（P0）
- [x] 离线队列正常工作
- [x] 微信登录成功
- [x] TTS 语音播放正常
- [x] 网络监听器正常

### 建议通过（P1）
- [x] 适老化 UI 符合标准
- [x] 流式对话流畅
- [x] 错误处理友好

### 可选通过（P2）
- [ ] 首屏加载 < 3s
- [ ] 录音响应 < 5s
- [ ] 内存占用 < 50MB

---

## 🎬 录制演示视频

### 推荐工具
- Windows: Xbox Game Bar (Win + G)
- Mac: QuickTime Player
- 浏览器: Chrome DevTools → Performance → Record

### 演示脚本
1. 打开页面，展示极简 UI
2. 按住录音按钮说话
3. 展示流式对话效果
4. 断网测试离线队列
5. 恢复网络，展示自动重传
6. 检查 localStorage 数据

---

## 📝 测试报告模板

```markdown
## 测试环境
- 浏览器: Chrome 120.0.0.0
- 操作系统: Windows 11
- 测试时间: 2024-04-28

## 测试结果
- [x] 离线队列: 通过
- [x] 微信登录: 通过
- [x] TTS 播放: 通过
- [x] 网络监听: 通过
- [x] 适老化 UI: 通过
- [x] 流式对话: 通过
- [x] 错误处理: 通过

## 发现的问题
无

## 建议
无
```

---

## 🚀 下一步

测试通过后：
1. 提交测试报告
2. 部署到生产环境
3. 进行真机测试（微信小程序）
4. 准备路演演示
