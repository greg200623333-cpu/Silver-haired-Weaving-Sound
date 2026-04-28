// ================================================================
// GET /api/monitor/tasks  — 任务监控端点
// 查看后台任务执行状态和失败任务列表
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getFailedTasks, getTaskStatus } from '@/lib/task-monitor';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('task_id');

  // 查询单个任务状态
  if (taskId) {
    const task = getTaskStatus(taskId);
    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }
    return NextResponse.json({ task });
  }

  // 查询所有失败任务
  const failedTasks = getFailedTasks();

  return NextResponse.json({
    status: 'ok',
    failed_count: failedTasks.length,
    failed_tasks: failedTasks.map(t => ({
      task_id: t.taskId,
      user_id: t.userId,
      raw_text: t.rawText,
      error: t.error,
      retry_count: t.retryCount,
      duration_ms: t.endTime ? t.endTime - t.startTime : null,
      created_at: new Date(t.startTime).toISOString(),
    })),
  });
}
