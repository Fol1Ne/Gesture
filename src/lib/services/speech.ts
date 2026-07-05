// ElevenLabs text-to-speech integration.
//
// Calls the ElevenLabs API directly from the browser using a user-supplied
// API key (stored only in memory / Zustand state, never persisted to a
// server we control). For a production build this call should be proxied
// through a backend route so the API key isn't exposed client-side.

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
}

// A few well-known default ElevenLabs voices, so the Settings panel has
// something sensible to show before/without an API call.
export const DEFAULT_VOICES: ElevenLabsVoice[] = [
  { voice_id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel" },
  { voice_id: "AZnzlk1XvdvUeBnXmlld", name: "Domi" },
  { voice_id: "EXAVITQu4vr4xnSDxMaL", name: "Bella" },
  { voice_id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh" },
];

export class SpeechServiceError extends Error {}

export async function fetchVoices(apiKey: string): Promise<ElevenLabsVoice[]> {
  const res = await fetch(`${ELEVENLABS_BASE}/voices`, {
    headers: { "xi-api-key": apiKey },
  });
  if (!res.ok) {
    throw new SpeechServiceError(`Failed to fetch voices (${res.status})`);
  }
  const data = await res.json();
  return (data.voices ?? []).map((v: { voice_id: string; name: string }) => ({
    voice_id: v.voice_id,
    name: v.name,
  }));
}

/**
 * Synthesizes speech for `text` and returns a playable object URL.
 * Caller is responsible for revoking the URL when done.
 */
export async function synthesizeSpeech(
  text: string,
  apiKey: string,
  voiceId: string
): Promise<string> {
  if (!apiKey) {
    throw new SpeechServiceError("Missing ElevenLabs API key.");
  }
  if (!text.trim()) {
    throw new SpeechServiceError("Nothing to speak.");
  }

  const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new SpeechServiceError(
      `ElevenLabs request failed (${res.status}): ${detail.slice(0, 200)}`
    );
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export function speakWithBrowser(text: string): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
  return true;
}
