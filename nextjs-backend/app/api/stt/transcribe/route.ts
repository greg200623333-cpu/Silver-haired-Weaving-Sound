// ================================================================
// POST /api/stt/transcribe  — 有道语音识别
// 接收音频文件 → 有道 ASR → 返回转写文本
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

const YOUDAO_APP_KEY = process.env.YOUDAO_APP_KEY ?? '52fe40b1760765c4';
const YOUDAO_SECRET = process.env.YOUDAO_SECRET ?? 'omwIqiDqGUrsYzNXlM3wmmLL4kpqRIJf';
const YOUDAO_ASR_URL = 'https://openapi.youdao.com/asrapi';

function sign(appKey: string, q: string, salt: string, secret: string): string {
  const str = appKey + q + salt + secret;
  return crypto.createHash('md5').update(str).digest('hex').toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    // 检查 Content-Type
    const contentType = request.headers.get('content-type') || '';
    console.log('[STT/Youdao] Content-Type:', contentType);

    let audioFile: File | null = null;

    // 尝试解析 formData
    try {
      const formData = await request.formData();
      audioFile = formData.get('audio') as File | null;

      if (!audioFile) {
        console.log('[STT/Youdao] 未找到音频文件，formData keys:', Array.from(formData.keys()));
      }
    } catch (err: any) {
      console.log('[STT/Youdao] formData 解析失败:', err.message);
      // 如果 formData 解析失败，尝试直接读取 body
      const buffer = await request.arrayBuffer();
      if (buffer.byteLength > 0) {
        // 创建一个 File 对象
        audioFile = new File([buffer], 'audio.mp3', { type: 'audio/mpeg' });
        console.log('[STT/Youdao] 从 body 读取音频，大小:', (buffer.byteLength / 1024).toFixed(1), 'KB');
      }
    }

    if (!audioFile) {
      return NextResponse.json({ error: '请上传音频文件' }, { status: 400 });
    }

    // 读取音频并转 base64
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuffer).toString('base64');
    const salt = Date.now().toString();
    const sig = sign(YOUDAO_APP_KEY, audioBase64, salt, YOUDAO_SECRET);

    console.log(`[STT/Youdao] 音频大小: ${(arrayBuffer.byteLength / 1024).toFixed(1)} KB`);

    const params = new URLSearchParams();
    params.append('appKey', YOUDAO_APP_KEY);
    params.append('q', audioBase64);
    params.append('salt', salt);
    params.append('sign', sig);
    params.append('format', 'mp3');
    params.append('rate', '16000');
    params.append('channel', '1');
    params.append('type', '1');
    params.append('langType', 'zh-CHS');

    const res = await fetch(YOUDAO_ASR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[STT/Youdao] API 错误:', res.status, errText);
      return NextResponse.json({ error: '语音识别失败' }, { status: 502 });
    }

    const data = await res.json();
    console.log('[STT/Youdao] 返回:', JSON.stringify(data).slice(0, 200));

    const text =
      data.result ||
      data.translation?.[0] ||
      data.text ||
      '';

    if (!text) {
      return NextResponse.json({ error: '未能识别出文字', raw: data }, { status: 422 });
    }

    return NextResponse.json({ text, raw: data });
  } catch (err: any) {
    console.error('[STT/Youdao] 异常:', err.message);
    return NextResponse.json({ error: '识别服务异常' }, { status: 500 });
  }
}

// GET — 健康检查
export async function GET() {
  return NextResponse.json({ status: 'ok', provider: 'youdao-asr' });
}
