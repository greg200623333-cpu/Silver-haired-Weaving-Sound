// ================================================================
// GET /api/memory/timeline  — 时间线查询 API
// 查询指定老人的所有记忆，按时间排序，支持年份筛选
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const elderId = searchParams.get('elder_id');
    const year = searchParams.get('year'); // 可选：按年份筛选
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!elderId) {
      return NextResponse.json({ error: '缺少 elder_id 参数' }, { status: 400 });
    }

    // 演示模式
    const isDemo = searchParams.get('demo') === 'true';
    if (isDemo || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.log('[时间线] 演示模式');
      return NextResponse.json({
        memories: [
          {
            id: 'demo-1',
            created_at: '2024-01-15T10:30:00Z',
            raw_text: '我今天翻到一张老照片',
            polished_text: '1962年春天，我在村口的老槐树下第一次见到她...',
            time_points: [
              { year: 1962, event: '春天，村口老槐树下与爱人初遇' },
            ],
            keywords: ['老照片', '回忆', '春天'],
            emotion_tag: '怀旧',
            emotion_score: 0.75,
          },
          {
            id: 'demo-2',
            created_at: '2024-01-14T15:20:00Z',
            raw_text: '下雨天腿就疼',
            polished_text: '一到阴雨天，这条老腿就开始疼。是1969年在北大荒落下的病根...',
            time_points: [
              { year: 1969, event: '冬天，在北大荒落下腿伤病根' },
            ],
            keywords: ['下雨', '腿疼', '北大荒'],
            emotion_tag: '感伤',
            emotion_score: 0.45,
          },
        ],
        total: 2,
        limit,
        offset,
      });
    }

    // 查询 Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    let query = supabase
      .from('memories')
      .select('id, created_at, raw_text, polished_text, time_points, keywords, emotion_tag, emotion_score, photo_urls')
      .eq('elder_id', elderId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 如果指定年份，筛选 time_points 包含该年份的记忆
    if (year) {
      const yearNum = parseInt(year, 10);
      if (!isNaN(yearNum)) {
        // PostgreSQL jsonb 查询：time_points 数组中是否存在 year = yearNum 的元素
        query = query.filter('time_points', 'cs', JSON.stringify([{ year: yearNum }]));
      }
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[时间线] 查询失败:', error);
      return NextResponse.json({ error: '查询失败', detail: error.message }, { status: 500 });
    }

    return NextResponse.json({
      memories: data || [],
      total: count || data?.length || 0,
      limit,
      offset,
    });
  } catch (err: any) {
    console.error('[时间线] 异常:', err);
    return NextResponse.json({ error: '服务器错误', detail: err.message }, { status: 500 });
  }
}
