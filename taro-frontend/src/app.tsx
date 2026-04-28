import './app.css';
import { useEffect } from 'react';
import Taro from '@tarojs/taro';
import { registerNetworkListener, processQueue } from './services/voice-pipeline';

const API_BASE = 'https://nrs.greg.asia';

// 微信静默登录
async function wxLogin() {
  try {
    // 检查是否已登录
    const cachedUserId = Taro.getStorageSync('user_id');
    const cachedToken = Taro.getStorageSync('session_token');
    if (cachedUserId && cachedToken) {
      console.log('[微信登录] 使用缓存凭证:', cachedUserId);
      return;
    }

    // 获取微信登录 code
    const { code } = await Taro.login();
    console.log('[微信登录] 获取到 code:', code);

    // 调用后端换取用户信息
    const res = await Taro.request({
      url: `${API_BASE}/api/auth/wx-login?demo=true`, // 演示模式
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { code },
    });

    const data = res.data as any;
    if (data.user_id && data.session_token) {
      Taro.setStorageSync('user_id', data.user_id);
      Taro.setStorageSync('session_token', data.session_token);
      Taro.setStorageSync('openid', data.openid);
      console.log('[微信登录] 登录成功:', data.user_id);
    } else {
      console.error('[微信登录] 响应格式错误:', data);
    }
  } catch (err) {
    console.error('[微信登录] 登录失败:', err);
    // 降级方案：使用演示用户
    Taro.setStorageSync('user_id', 'demo-user-001');
    Taro.setStorageSync('session_token', 'demo-token');
  }
}

function App(props) {
  useEffect(() => {
    // 1. 微信静默登录
    wxLogin();

    // 2. 注册网络状态监听器
    registerNetworkListener();

    // 3. 启动时尝试处理离线队列
    processQueue();
  }, []);

  return props.children;
}

export default App;
