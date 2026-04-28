// ================================================================
// 微信静默登录 API
// 流程：前端 wx.login() 获取 code → 后端用 code 换取 openid → 查询或创建用户
// ================================================================

import { NextRequest, NextResponse } from 'next/server';

const WECHAT_APPID = process.env.WECHAT_APPID || '';
const WECHAT_SECRET = process.env.WECHAT_SECRET || '';

export async function GET() {
  return NextResponse.json({
    message: '微信登录端点',
    required_env: ['WECHAT_APPID', 'WECHAT_SECRET'],
    configured: !!(WECHAT_APPID && WECHAT_SECRET),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({ error: '缺少 code 参数' }, { status: 400 });
    }

    // 演示模式：跳过微信 API 调用
    const isDemoMode = request.nextUrl.searchParams.get('demo') === 'true';
    if (isDemoMode || !WECHAT_APPID || !WECHAT_SECRET) {
      console.log('[微信登录] 演示模式，返回测试用户');
      return NextResponse.json({
        user_id: 'demo-user-001',
        openid: 'demo-openid-001',
        session_token: 'demo-token-' + Date.now(),
        is_new_user: false,
      });
    }

    // 调用微信 API 换取 openid
    const wxApiUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${WECHAT_APPID}&secret=${WECHAT_SECRET}&js_code=${code}&grant_type=authorization_code`;

    const wxRes = await fetch(wxApiUrl);
    const wxData = await wxRes.json();

    if (wxData.errcode) {
      console.error('[微信登录] 微信 API 错误:', wxData);
      return NextResponse.json(
        { error: '微信登录失败', detail: wxData.errmsg },
        { status: 400 }
      );
    }

    const { openid, session_key } = wxData;

    // TODO: 查询或创建用户（需要 Supabase 集成）
    // 1. 根据 openid 查询 profiles 表
    // 2. 如果不存在，创建新用户（role: 'elder'）
    // 3. 生成 session_token（JWT 或随机字符串）
    // 4. 返回 user_id + session_token

    // 临时实现：直接返回 openid 作为 user_id
    const userId = `wx_${openid.slice(0, 8)}`;
    const sessionToken = `token_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    return NextResponse.json({
      user_id: userId,
      openid,
      session_token: sessionToken,
      is_new_user: true, // TODO: 根据数据库查询结果判断
    });
  } catch (error: any) {
    console.error('[微信登录] 异常:', error);
    return NextResponse.json(
      { error: '服务器错误', detail: error.message },
      { status: 500 }
    );
  }
}
