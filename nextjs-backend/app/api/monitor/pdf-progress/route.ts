// ================================================================
// GET /api/monitor/pdf-progress  — PDF 生成进度查询
// 查询 PDF 导出任务的实时进度
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getPDFTaskStatus } from '@/lib/pdf-task-manager';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('task_id');

  if (!taskId) {
    return NextResponse.json({ error: '缺少 task_id 参数' }, { status: 400 });
  }

  const task = getPDFTaskStatus(taskId);

  if (!task) {
    return NextResponse.json({ error: '任务不存在' }, { status: 404 });
  }

  return NextResponse.json({
    task_id: task.taskId,
    status: task.status,
    progress: task.progress,
    pdf_url: task.pdfUrl,
    error: task.error,
    duration_ms: task.endTime ? task.endTime - task.startTime : Date.now() - task.startTime,
  });
}
