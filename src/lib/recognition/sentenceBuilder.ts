const PHRASE_MAP: Record<string, string> = {
  "HELLO HOW ARE YOU": "Hello, how are you?",
  "THANK YOU VERY MUCH": "Thank you very much.",
  "NICE MEET YOU": "Nice to meet you.",
  "SEE YOU LATER": "See you later.",
  "GOOD MORNING": "Good morning.",
  "GOOD AFTERNOON": "Good afternoon.",
  "GOOD EVENING": "Good evening.",
};

export interface SentenceState {
  words: string[];
}

export function createSentenceState(): SentenceState {
  return { words: [] };
}

function normalizeWord(word: string): string {
  return word.replace(/_/g, " ").trim().toUpperCase();
}

function naturalizeWord(word: string): string {
  const normalized = word.replace(/_/g, " ").toLowerCase();
  if (normalized === "i") return "I";
  return normalized;
}

export function appendRecognizedWord(state: SentenceState, word: string): SentenceState {
  return { words: [...state.words, normalizeWord(word)] };
}

export function renderSentence(state: SentenceState): string {
  if (state.words.length === 0) return "";

  const phrase = PHRASE_MAP[state.words.join(" ")];
  if (phrase) return phrase.replace(/[.?!]$/, "");

  const text = state.words.map(naturalizeWord).join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function finalizeSentence(state: SentenceState): {
  sentence: string;
  next: SentenceState;
} {
  if (state.words.length === 0) return { sentence: "", next: createSentenceState() };
  const phrase = PHRASE_MAP[state.words.join(" ")];
  if (phrase) return { sentence: phrase, next: createSentenceState() };

  const text = renderSentence(state);
  return {
    sentence: /[.?!]$/.test(text) ? text : `${text}.`,
    next: createSentenceState(),
  };
}
