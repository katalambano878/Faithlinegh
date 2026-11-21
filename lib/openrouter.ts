/**
 * OpenRouter — the single AI provider for the storefront.
 *
 * One key (OPENROUTER_API_KEY) powers the chat widget, voice notes in and
 * out, and the admin product-description writer. Model ids can be swapped
 * from the environment without a code change, so a retired model never
 * takes the assistant down again.
 */

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export const OPENROUTER_CHAT_URL = `${OPENROUTER_BASE_URL}/chat/completions`;
export const OPENROUTER_SPEECH_URL = `${OPENROUTER_BASE_URL}/audio/speech`;
export const OPENROUTER_TRANSCRIBE_URL = `${OPENROUTER_BASE_URL}/audio/transcriptions`;

/** Read at call time so the key is never frozen into the build. */
export function getOpenRouterKey(): string | null {
  const key = process.env['OPENROUTER_API_KEY'];
  return key && key.trim() ? key.trim() : null;
}

/** Chat + tool calling for the storefront assistant. */
export function chatModel(): string {
  return process.env['AI_CHAT_MODEL'] || 'openai/gpt-4o-mini';
}

/** Image understanding for admin product descriptions. */
export function visionModel(): string {
  return process.env['AI_VISION_MODEL'] || chatModel();
}

/** Speech-to-text for customer voice notes. */
export function transcribeModel(): string {
  return process.env['AI_TRANSCRIBE_MODEL'] || 'openai/gpt-transcribe';
}

/** Text-to-speech for spoken replies. Returns raw 24 kHz mono PCM. */
export function speechModel(): string {
  return process.env['AI_SPEECH_MODEL'] || 'google/gemini-3.8-flash-lite-tts';
}

export function speechVoice(): string {
  return process.env['AI_SPEECH_VOICE'] || 'Kore';
}

export function openRouterHeaders(key: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
    'HTTP-Referer': process.env['NEXT_PUBLIC_APP_URL'] || 'https://www.faithlinegh.com',
    'X-Title': 'Faithlinegh Storefront',
  };
}
