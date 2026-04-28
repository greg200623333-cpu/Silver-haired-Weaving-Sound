// ================================================================
// GET /api/guardian/alert?guardian_id=xxx
//
// 子女端预警仪表板：
//  - 遍历监护人绑定的所有老人
//  - 调用 detectMoodAnomaly() 检测异常情绪趋势
//  - 返回需要关注的老人列表
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { detectMoodAnomaly, getEmotionTimeline } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const guardianId = url.searchParams.get('guardian_id');

  if (!guardianId || typeof guardianId !== 'string') {
    return NextResponse.json({ error: 'guardian_id 不能为空' }, { status: 400 });
  }

  try {
    const { supabaseAdmin } = await import('@/lib/supabase');

    // 1. 查询监护人绑定的所有老人
    const { data: bindings, error: bindErr } = await supabaseAdmin
      .from('bindings')
      .select('elder_id, relation, profiles!bindings_elder_id_fkey(nickname, birth_year)')
      .eq('guardian_id', guardianId);

    if (bindErr) {
      return NextResponse.json({ error: '查询绑定关系失败' }, { status: 500 });
    }

    if (!bindings || bindings.length === 0) {
      return NextResponse.json({ elders: [], summary: '暂无绑定老人' });
    }

    // 2. 对每位老人执行情绪异常检测
    const alerts: Array<{
      elder_id: string;
      nickname: string;
      relation: string;
      birth_year: number | null;
      alerted: boolean;
      negative_streak: number;
      dominant_emotion: string;
      recent_mood: Array<{ day: string; emotion_tag: string; cnt: number; avg_score: number | null }>;
    }> = [];

    for (const b of bindings) {
      const elderId = b.elder_id as string;
      const profile = (b.profiles as any)?.[0] ?? (b.profiles as any);

      const [anomaly, moodData] = await Promise.all([
        detectMoodAnomaly(elderId, 7),
        getEmotionTimeline(elderId, 14),
      ]);

      alerts.push({
        elder_id: elderId,
        nickname: (profile?.nickname as string) ?? '未命名',
        relation: (b.relation as string) ?? '家人',
        birth_year: (profile?.birth_year as number) ?? null,
        alerted: anomaly.alerted,
        negative_streak: anomaly.negativeStreak,
        dominant_emotion: anomaly.dominantEmotion,
        recent_mood: moodData.slice(0, 20),
      });
    }

    // 3. 按预警状态排序：需要关注的排前面
    alerts.sort((a, b) => {
      if (a.alerted && !b.alerted) return -1;
      if (!a.alerted && b.alerted) return 1;
      return b.negative_streak - a.negative_streak;
    });

    const alertCount = alerts.filter((a) => a.alerted).length;

    return NextResponse.json({
      elders: alerts,
      summary: alertCount > 0
        ? `${alertCount} 位老人可能需要关注`
        : '所有老人情绪状态正常',
      alert_count: alertCount,
      total: alerts.length,
    });
  } catch (err: any) {
    console.error('[Guardian/Alert] 异常:', err.message);
    return NextResponse.json({ error: '服务暂时不可用' }, { status: 500 });
  }
}
