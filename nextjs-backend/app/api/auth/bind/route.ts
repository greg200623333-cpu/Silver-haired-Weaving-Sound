// ================================================================
// POST /api/auth/bind  — 创建监护人-老人绑定关系
// 子女端扫码或输入老人信息后调用
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createBinding } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { guardian_id, elder_id, relation } = body;

    if (!guardian_id || !elder_id) {
      return NextResponse.json(
        { error: '缺少 guardian_id 或 elder_id 参数' },
        { status: 400 }
      );
    }

    const result = await createBinding(guardian_id, elder_id, relation);

    if (result === null) {
      return NextResponse.json({
        message: '绑定关系已存在',
        already_bound: true,
      });
    }

    return NextResponse.json({
      message: '绑定成功',
      binding_id: result.id,
      already_bound: false,
    });
  } catch (error: any) {
    console.error('[绑定] 异常:', error);
    return NextResponse.json(
      { error: '服务器错误', detail: error.message },
      { status: 500 }
    );
  }
}
