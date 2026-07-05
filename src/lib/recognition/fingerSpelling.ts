const LETTER_GAP_MS = 900;
const WORD_GAP_MS = 1400;

export class FingerSpellingBuffer {
  private letters: string[] = [];
  private lastLetterAt = 0;

  observe(letter: string | null, now = Date.now()): string | null {
    if (!letter) {
      if (this.letters.length > 0 && now - this.lastLetterAt > WORD_GAP_MS) {
        return this.flush();
      }
      return null;
    }

    const previous = this.letters[this.letters.length - 1];
    if (letter !== previous || now - this.lastLetterAt > LETTER_GAP_MS) {
      this.letters.push(letter);
    }
    this.lastLetterAt = now;
    return null;
  }

  flush(): string | null {
    if (this.letters.length === 0) return null;
    const word = this.letters.join("").toUpperCase();
    this.letters = [];
    return word;
  }

  reset() {
    this.letters = [];
    this.lastLetterAt = 0;
  }
}
