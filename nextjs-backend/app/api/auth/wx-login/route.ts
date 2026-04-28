// ================================================================
// 微信静默登录 API（完整版）
// 流程：前端 wx.login() 获取 code → 后端用 code 换取 openid → 查询或创建用户
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { upsertElderByOpenid, upsertGuardianByOpenid } from '@/lib/supabase';

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
    const { code, role = 'elder', nickname, birth_year, phone } = body;

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
        role: role,
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

    // 根据角色查询或创建用户
    let result;
    if (role === 'elder') {
      result = await upsertElderByOpenid(openid, nickname, birth_year);
    } else if (role === 'guardian') {
      result = await upsertGuardianByOpenid(openid, nickname, phone);
    } else {
      return NextResponse.json({ error: '无效的 role 参数' }, { status: 400 });
    }

    // 生成 session_token（简单实现，生产环境应使用 JWT）
    const sessionToken = `token_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    return NextResponse.json({
      user_id: result.user_id,
      openid,
      session_token: sessionToken,
      is_new_user: result.is_new_user,
      nickname: result.nickname,
      role,
    });
  } catch (error: any) {
    console.error('[微信登录] 异常:', error);
    return NextResponse.json(
      { error: '服务器错误', detail: error.message },
      { status: 500 }
    );
  }
}
