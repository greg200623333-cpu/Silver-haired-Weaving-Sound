// ================================================================
// POST /api/auth/magic-token  — 生成一次性登录令牌
// GET  /api/auth/magic-token  — 验证并消费令牌
// 用于非微信场景（如 H5 端）的免密登录
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { generateMagicToken, verifyMagicToken } from '@/lib/supabase';

// 生成令牌
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { elder_id, expires_in_minutes = 60 } = body;

    if (!elder_id) {
      return NextResponse.json({ error: '缺少 elder_id 参数' }, { status: 400 });
    }

    const result = await generateMagicToken(elder_id, expires_in_minutes);

    return NextResponse.json({
      token: result.token,
      expires_at: result.expires_at,
      expires_in_minutes,
    });
  } catch (error: any) {
    console.error('[Magic Token] 生成失败:', error);
    return NextResponse.json(
      { error: '服务器错误', detail: error.message },
      { status: 500 }
    );
  }
}

// 验证令牌
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: '缺少 token 参数' }, { status: 400 });
    }

    const result = await verifyMagicToken(token);

    // 生成 session_token
    const sessionToken = `token_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    return NextResponse.json({
      user_id: result.elder_id,
      session_token: sessionToken,
      message: '登录成功',
    });
  } catch (error: any) {
    console.error('[Magic Token] 验证失败:', error);
    return NextResponse.json(
      { error: error.message || '令牌验证失败' },
      { status: 400 }
    );
  }
}
