// ================================================================
// 后台任务监控与错误日志
// 用于记录 DeepSeek 归档任务的执行状态和错误信息
// ================================================================

interface TaskLog {
  taskId: string;
  userId: string;
  rawText: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  startTime: number;
  endTime?: number;
  retryCount: number;
}

// 内存中的任务日志（生产环境应使用 Redis 或数据库）
const taskLogs = new Map<string, TaskLog>();

// 记录任务开始
export function logTaskStart(taskId: string, userId: string, rawText: string) {
  taskLogs.set(taskId, {
    taskId,
    userId,
    rawText: rawText.slice(0, 100),  // 只记录前 100 字符
    status: 'processing',
    startTime: Date.now(),
    retryCount: 0,
  });
  console.log(`[TaskMonitor] 任务开始: ${taskId.slice(0, 8)}`);
}

// 记录任务完成
export function logTaskComplete(taskId: string) {
  const task = taskLogs.get(taskId);
  if (task) {
    task.status = 'completed';
    task.endTime = Date.now();
    const duration = task.endTime - task.startTime;
    console.log(`[TaskMonitor] 任务完成: ${taskId.slice(0, 8)}, 耗时: ${duration}ms`);
  }
}

// 记录任务失败
export function logTaskError(taskId: string, error: Error) {
  const task = taskLogs.get(taskId);
  if (task) {
    task.status = 'failed';
    task.error = error.message;
    task.endTime = Date.now();
    const duration = task.endTime - task.startTime;

    // 错误告警（生产环境应集成 Sentry 或其他监控服务）
    console.error(`[TaskMonitor] ❌ 任务失败: ${taskId.slice(0, 8)}`);
    console.error(`  用户: ${task.userId}`);
    console.error(`  文本: ${task.rawText}`);
    console.error(`  错误: ${error.message}`);
    console.error(`  耗时: ${duration}ms`);
    console.error(`  重试次数: ${task.retryCount}`);

    // TODO: 集成 Sentry
    // Sentry.captureException(error, {
    //   tags: { taskId, userId: task.userId },
    //   extra: { rawText: task.rawText, duration, retryCount: task.retryCount },
    // });
  }
}

// 记录重试
export function logTaskRetry(taskId: string) {
  const task = taskLogs.get(taskId);
  if (task) {
    task.retryCount++;
    console.log(`[TaskMonitor] 任务重试: ${taskId.slice(0, 8)}, 第 ${task.retryCount} 次`);
  }
}

// 获取任务状态
export function getTaskStatus(taskId: string): TaskLog | undefined {
  return taskLogs.get(taskId);
}

// 获取所有失败任务（用于监控面板）
export function getFailedTasks(): TaskLog[] {
  return Array.from(taskLogs.values()).filter(t => t.status === 'failed');
}

// 清理旧任务日志（保留最近 1000 条）
export function cleanupOldTasks() {
  if (taskLogs.size > 1000) {
    const sorted = Array.from(taskLogs.entries())
      .sort((a, b) => (b[1].startTime) - (a[1].startTime));

    // 保留最近 1000 条
    taskLogs.clear();
    sorted.slice(0, 1000).forEach(([id, task]) => taskLogs.set(id, task));

    console.log(`[TaskMonitor] 清理旧任务，保留 ${taskLogs.size} 条`);
  }
}

// 定期清理（每小时执行一次）
setInterval(cleanupOldTasks, 3600000);
