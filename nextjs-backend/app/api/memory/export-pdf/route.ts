// ================================================================
// POST /api/memory/export-pdf
//
// 一键生成老人回忆录 PDF（含情绪图表 + 时间线 + 润色文本）
// 技术栈：React → HTML string → Puppeteer → PDF
//
// Vercel 部署需配置：FUNCTION_MAX_DURATION=60s
// 自托管需安装：puppeteer
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getEmotionTimeline } from '@/lib/supabase';

type MemoryRow = {
  id: string;
  polished_text: string | null;
  time_points: { year: number; event: string }[] | null;
  keywords: string[] | null;
  emotion_tag: string | null;
  created_at: string;
  photo_urls: string[] | null;
};

export async function POST(request: NextRequest) {
  // 1. 入参
  let body: { elder_id?: string; elder_name?: string; months?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体必须是合法 JSON' }, { status: 400 });
  }

  const { elder_id, elder_name = '长辈', months = 3 } = body;
  if (!elder_id || typeof elder_id !== 'string') {
    return NextResponse.json({ error: 'elder_id 不能为空' }, { status: 400 });
  }

  // 2. 查询记忆 + 情绪数据
  const { supabaseAdmin } = await import('@/lib/supabase');
  const since = new Date(Date.now() - months * 30 * 86400000).toISOString();

  const [memoriesRes, emotionData] = await Promise.all([
    supabaseAdmin
      .from('memories')
      .select('polished_text, time_points, keywords, emotion_tag, created_at, photo_urls')
      .eq('elder_id', elder_id)
      .gte('created_at', since)
      .order('created_at', { ascending: true }),
    getEmotionTimeline(elder_id, months * 30),
  ]);

  const memories: MemoryRow[] = (memoriesRes.data ?? []) as MemoryRow[];
  if (memories.length === 0) {
    return NextResponse.json({ error: '该时间段内没有记忆' }, { status: 404 });
  }

  // 3. 渲染 HTML
  const html = buildMemoirHTML(elder_name, memories, emotionData);

  // 4. Puppeteer → PDF
  try {
    const pdfBuffer = await renderPDF(html);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${elder_name}-回忆录.pdf"`,
      },
    });
  } catch (err: any) {
    console.error('[PDF] 渲染失败:', err.message);
    // 降级：返回 HTML
    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

// ================================================================
// HTML 构建（含内联 CSS + SVG 情绪图表）
// ================================================================
function buildMemoirHTML(
  name: string,
  memories: MemoryRow[],
  emotionData: Awaited<ReturnType<typeof getEmotionTimeline>>,
): string {
  const emotionSVG = buildEmotionChartSVG(emotionData);

  const memoryCards = memories
    .map(
      (m) => `
    <div class="memory-card">
      <div class="date">${m.created_at.slice(0, 10)} · ${m.emotion_tag ?? '回忆'}</div>
      <div class="text">${m.polished_text ?? ''}</div>
      ${
        m.time_points && m.time_points.length > 0
          ? `<div class="timeline">${m.time_points
              .map((tp) => `<span class="tp">${tp.year} ${tp.event}</span>`)
              .join('')}</div>`
          : ''
      }
      ${
        m.keywords && m.keywords.length > 0
          ? `<div class="keywords">${m.keywords.map((k) => `<span>#${k}</span>`).join(' ')}</div>`
          : ''
      }
    </div>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 20mm 18mm; }
  body {
    font-family: "楷体", "KaiTi", "STKaiti", serif;
    font-size: 14pt;
    line-height: 2.0;
    color: #1a1a1a;
    background: #fdfaf5;
  }
  .cover {
    text-align: center;
    padding: 60px 0;
    border-bottom: 3px solid #c9a96e;
    margin-bottom: 40px;
  }
  .cover h1 { font-size: 28pt; margin: 0 0 8px; color: #2c1810; }
  .cover .subtitle { font-size: 14pt; color: #8b7355; }
  .section-title {
    font-size: 18pt;
    color: #2c1810;
    border-left: 6px solid #c9a96e;
    padding-left: 12px;
    margin: 30px 0 16px;
  }
  .memory-card {
    background: #fff;
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 16px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  .memory-card .date { font-size: 11pt; color: #c9a96e; margin-bottom: 6px; }
  .memory-card .text { font-size: 14pt; }
  .memory-card .timeline { margin-top: 8px; }
  .memory-card .tp {
    display: inline-block;
    background: #f5eedc;
    padding: 2px 8px;
    border-radius: 4px;
    margin: 2px 4px 2px 0;
    font-size: 11pt;
  }
  .keywords { margin-top: 6px; font-size: 11pt; color: #8b7355; }
  .keywords span { margin-right: 8px; }
  .chart-container { text-align: center; margin: 20px 0; }
  .footer {
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid #e0d5c1;
    text-align: center;
    font-size: 10pt;
    color: #b0a090;
  }
</style>
</head>
<body>
  <div class="cover">
    <h1>${escapeHTML(name)}的回忆录</h1>
    <div class="subtitle">银发织音 · 数字口述史</div>
    <div class="subtitle">${memories.length} 段记忆 · ${new Date().toLocaleDateString('zh-CN')}</div>
  </div>

  <div class="section-title">📊 情绪印记</div>
  <div class="chart-container">${emotionSVG}</div>

  <div class="section-title">📖 记忆篇章</div>
  ${memoryCards}

  <div class="footer">银发织音 (SilverVoice) 自动生成 · 每一段记忆都值得珍藏</div>
</body>
</html>`;
}

// ================================================================
// 简易 SVG 情绪柱状图（零依赖，直接输出到 PDF）
// ================================================================
function buildEmotionChartSVG(
  data: Awaited<ReturnType<typeof getEmotionTimeline>>,
): string {
  if (data.length === 0) return '<p style="color:#999">暂无情绪数据</p>';

  // 按情绪标签聚合
  const agg = new Map<string, number>();
  for (const d of data) {
    agg.set(d.emotion_tag, (agg.get(d.emotion_tag) ?? 0) + d.cnt);
  }

  const entries = Array.from(agg.entries()).sort((a, b) => b[1] - a[1]);
  const maxVal = Math.max(...entries.map((e) => e[1]), 1);
  const barWidth = 60;
  const chartHeight = 180;
  const gap = 20;
  const totalWidth = entries.length * (barWidth + gap) + 40;
  const colors: Record<string, string> = { '喜悦': '#F0A500', '怀旧': '#5B8DEF', '平静': '#7EC8A0', '感伤': '#7B8DB2', '自豪': '#E07050', '思念': '#A080C0' };

  const bars = entries
    .map(([tag, cnt], i) => {
      const h = Math.max((cnt / maxVal) * chartHeight, 8);
      const x = 20 + i * (barWidth + gap);
      const y = chartHeight - h + 40;
      const color = colors[tag] ?? '#8892B0';
      return `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="4" fill="${color}" />
        <text x="${x + barWidth / 2}" y="${y - 10}" text-anchor="middle" font-size="12" fill="#666">${cnt}</text>
        <text x="${x + barWidth / 2}" y="${chartHeight + 60}" text-anchor="middle" font-size="12" fill="#333">${tag}</text>`;
    })
    .join('\n');

  return `<svg width="${totalWidth}" height="${chartHeight + 70}" xmlns="http://www.w3.org/2000/svg">
    ${bars}
  </svg>`;
}

// ================================================================
// Puppeteer PDF 渲染
// ================================================================
async function renderPDF(html: string): Promise<Buffer> {
  // 自托管环境
  try {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    return Buffer.from(pdf);
  } catch {
    // Vercel 环境：尝试 chrome-aws-lambda
    const chromium = await import('@sparticuz/chromium');
    const puppeteerCore = await import('puppeteer-core');

    const browser = await puppeteerCore.default.launch({
      args: chromium.default.args,
      executablePath: await chromium.default.executablePath(),
      headless: true,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    return Buffer.from(pdf);
  }
}

// 简易 HTML 转义
function escapeHTML(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'POST /api/memory/export-pdf' });
}
