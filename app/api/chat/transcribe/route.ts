import { NextResponse } from 'next/server';
import {
  OPENROUTER_TRANSCRIBE_URL,
  getOpenRouterKey,
  openRouterHeaders,
  transcribeModel,
} from '@/lib/openrouter';

// Voice notes are short; anything bigger is not a chat message.
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/** Map the browser's recording type to the format name OpenRouter expects. */
function audioFormat(file: File): string {
  const hint = `${file.type} ${file.name}`.toLowerCase();
  if (hint.includes('mp4') || hint.includes('m4a') || hint.includes('aac')) return 'm4a';
  if (hint.includes('ogg')) return 'ogg';
  if (hint.includes('wav')) return 'wav';
  if (hint.includes('mpeg') || hint.includes('mp3')) return 'mp3';
  return 'webm';
}

export async function POST(request: Request) {
  const key = getOpenRouterKey();
  if (!key) {
    return NextResponse.json({ error: 'Speech-to-text not configured' }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }
    if (audioFile.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Voice note is too long' }, { status: 413 });
    }

    const audioBase64 = Buffer.from(await audioFile.arrayBuffer()).toString('base64');

    const res = await fetch(OPENROUTER_TRANSCRIBE_URL, {
      method: 'POST',
      headers: openRouterHeaders(key),
      body: JSON.stringify({
        model: transcribeModel(),
        input_audio: { data: audioBase64, format: audioFormat(audioFile) },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Transcribe API] OpenRouter error:', res.status, errText);
      return NextResponse.json({ error: 'Transcription failed' }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json({
      text: data.text || '',
      language: data.language || 'en',
      duration: data.usage?.seconds || 0,
    });
  } catch (err: any) {
    console.error('[Transcribe API] Error:', err);
    return NextResponse.json({ error: 'Transcription error' }, { status: 500 });
  }
}
