// ================================================================
// PDF 导出任务管理
// 用于跟踪 PDF 生成进度
// ================================================================

interface PDFTask {
  taskId: string;
  elderId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;  // 0-100
  pdfUrl?: string;
  error?: string;
  startTime: number;
  endTime?: number;
}

// 内存中的任务状态（生产环境应使用 Redis）
const pdfTasks = new Map<string, PDFTask>();

// 创建 PDF 任务
export function createPDFTask(elderId: string): string {
  const taskId = `pdf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  pdfTasks.set(taskId, {
    taskId,
    elderId,
    status: 'pending',
    progress: 0,
    startTime: Date.now(),
  });
  console.log(`[PDF] 任务创建: ${taskId}`);
  return taskId;
}

// 更新任务进度
export function updatePDFProgress(taskId: string, progress: number, status?: 'processing' | 'completed' | 'failed') {
  const task = pdfTasks.get(taskId);
  if (task) {
    task.progress = Math.min(100, Math.max(0, progress));
    if (status) task.status = status;
    console.log(`[PDF] 任务进度: ${taskId.slice(0, 12)} - ${progress}%`);
  }
}

// 标记任务完成
export function completePDFTask(taskId: string, pdfUrl: string) {
  const task = pdfTasks.get(taskId);
  if (task) {
    task.status = 'completed';
    task.progress = 100;
    task.pdfUrl = pdfUrl;
    task.endTime = Date.now();
    console.log(`[PDF] 任务完成: ${taskId.slice(0, 12)}, 耗时: ${task.endTime - task.startTime}ms`);
  }
}

// 标记任务失败
export function failPDFTask(taskId: string, error: string) {
  const task = pdfTasks.get(taskId);
  if (task) {
    task.status = 'failed';
    task.error = error;
    task.endTime = Date.now();
    console.error(`[PDF] 任务失败: ${taskId.slice(0, 12)}, 错误: ${error}`);
  }
}

// 获取任务状态
export function getPDFTaskStatus(taskId: string): PDFTask | undefined {
  return pdfTasks.get(taskId);
}

// 清理旧任务（保留最近 100 个）
export function cleanupOldPDFTasks() {
  if (pdfTasks.size > 100) {
    const sorted = Array.from(pdfTasks.entries())
      .sort((a, b) => b[1].startTime - a[1].startTime);

    pdfTasks.clear();
    sorted.slice(0, 100).forEach(([id, task]) => pdfTasks.set(id, task));

    console.log(`[PDF] 清理旧任务，保留 ${pdfTasks.size} 个`);
  }
}

// 定期清理（每小时）
setInterval(cleanupOldPDFTasks, 3600000);
