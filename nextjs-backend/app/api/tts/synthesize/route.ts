// ================================================================
// POST /api/tts/synthesize  — 有道语音合成
// 接收文字 → 有道 TTS → 返回音频 URL
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const YOUDAO_APP_KEY = process.env.YOUDAO_APP_KEY ?? '52fe40b1760765c4';
const YOUDAO_SECRET = process.env.YOUDAO_SECRET ?? 'omwIqiDqGUrsYzNXlM3wmmLL4kpqRIJf';
const YOUDAO_TTS_URL = 'https://openapi.youdao.com/ttsapi';

function sign(appKey: string, q: string, salt: string, secret: string): string {
  const str = appKey + q + salt + secret;
  return crypto.createHash('md5').update(str).digest('hex').toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    let body: { text?: string; speed?: number; voice?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: '请求体必须是合法 JSON' }, { status: 400 });
    }

    const { text, speed = 0.9, voice = '0' } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'text 不能为空' }, { status: 400 });
    }

    const salt = Date.now().toString();
    const sig = sign(YOUDAO_APP_KEY, text, salt, YOUDAO_SECRET);

    console.log(`[TTS/Youdao] 合成文字: ${text.slice(0, 50)}`);

    const params = new URLSearchParams();
    params.append('appKey', YOUDAO_APP_KEY);
    params.append('q', text);
    params.append('salt', salt);
    params.append('sign', sig);
    params.append('langType', 'zh-CHS');
    params.append('voice', voice);
    params.append('format', 'mp3');
    params.append('speed', speed.toString());
    params.append('volume', '5');

    const res = await fetch(YOUDAO_TTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[TTS/Youdao] API 错误:', res.status, errText);
      return NextResponse.json({ error: '语音合成失败' }, { status: 502 });
    }

    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('audio')) {
      // 直接返回音频流
      const audioBuffer = await res.arrayBuffer();
      return new NextResponse(audioBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': 'inline',
        },
      });
    }

    // 返回的是 JSON（含音频 URL）
    const data = await res.json();

    const audioUrl =
      data.speakerUrl ||
      data.audioUrl ||
      data.data?.audioUrl ||
      data.result?.speakerUrl ||
      '';

    if (audioUrl && typeof audioUrl === 'string') {
      console.log('[TTS/Youdao] 合成成功');
      return NextResponse.json({ audioUrl, text });
    }

    // 无音频但有文字回显
    console.error('[TTS/Youdao] 未获取到音频:', JSON.stringify(data).slice(0, 200));
    return NextResponse.json({ error: '合成失败', raw: data }, { status: 422 });
  } catch (err: any) {
    console.error('[TTS/Youdao] 异常:', err.message);
    return NextResponse.json({ error: '语音合成异常' }, { status: 500 });
  }
}

// GET — 健康检查
export async function GET() {
  return NextResponse.json({ status: 'ok', provider: 'youdao-tts' });
}
