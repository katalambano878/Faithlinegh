import { NextResponse } from 'next/server';
import {
  OPENROUTER_SPEECH_URL,
  getOpenRouterKey,
  openRouterHeaders,
  speechModel,
  speechVoice,
} from '@/lib/openrouter';

const PCM_SAMPLE_RATE = 24000;

/** Wrap raw 16-bit mono PCM in a WAV header so browsers can play it. */
function pcmToWav(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const header = new DataView(new ArrayBuffer(44));
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) header.setUint8(offset + i, text.charCodeAt(i));
  };
  writeAscii(0, 'RIFF');
  header.setUint32(4, 36 + pcm.byteLength, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  header.setUint32(16, 16, true); // fmt chunk size
  header.setUint16(20, 1, true); // PCM
  header.setUint16(22, 1, true); // mono
  header.setUint32(24, sampleRate, true);
  header.setUint32(28, sampleRate * 2, true); // byte rate
  header.setUint16(32, 2, true); // block align
  header.setUint16(34, 16, true); // bits per sample
  writeAscii(36, 'data');
  header.setUint32(40, pcm.byteLength, true);

  const wav = new Uint8Array(44 + pcm.byteLength);
  wav.set(new Uint8Array(header.buffer), 0);
  wav.set(pcm, 44);
  return wav;
}

export async function POST(request: Request) {
  const key = getOpenRouterKey();
  if (!key) {
    return NextResponse.json({ error: 'Text-to-speech not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    // Clean text for natural speech
    const cleaned = text
      .replace(/GH₵/g, 'Cedis ')
      .replace(/₵/g, 'Cedis ')
      .replace(/\bGHS\b/gi, 'Cedis ')
      .replace(/\bNGN\b/gi, 'Cedis ')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s?/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`/g, '');

    // Limit text length for TTS
    const truncated = cleaned.length > 2000 ? cleaned.slice(0, 2000) + '...' : cleaned;

    const res = await fetch(OPENROUTER_SPEECH_URL, {
      method: 'POST',
      headers: openRouterHeaders(key),
      body: JSON.stringify({
        model: speechModel(),
        voice: speechVoice(),
        response_format: 'pcm',
        input: truncated,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Speak API] OpenRouter error:', res.status, errText);
      return NextResponse.json({ error: 'Speech generation failed' }, { status: 502 });
    }

    const contentType = res.headers.get('content-type') || '';
    const rateMatch = contentType.match(/rate=(\d+)/);
    const sampleRate = rateMatch ? Number(rateMatch[1]) : PCM_SAMPLE_RATE;
    const audio = new Uint8Array(await res.arrayBuffer());

    // Models that answer with a finished container (mp3, wav) pass through.
    const isRawPcm = contentType.includes('pcm') || contentType === '';
    const payload = isRawPcm ? pcmToWav(audio, sampleRate) : audio;

    return new NextResponse(payload as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': isRawPcm ? 'audio/wav' : contentType,
        'Content-Length': String(payload.byteLength),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: any) {
    console.error('[Speak API] Error:', err);
    return NextResponse.json({ error: 'Speech generation error' }, { status: 500 });
  }
}
