const PERSON_NAME_REGEX = /^\p{L}+(?:[ '-]\p{L}+)*$/u;

const REPEATED_CHARACTER_REGEX = /(.)\1{4,}/;
const REPEATED_WORD_REGEX = /\b([\p{L}]{2,})\b(?:\s+\1\b){2,}/iu;

export function isValidPersonName(value: string): boolean {
  return PERSON_NAME_REGEX.test(value.trim());
}

export function isMeaningfulComplaintText(value: string): boolean {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < 15) {
    return false;
  }

  if (REPEATED_CHARACTER_REGEX.test(normalized) || REPEATED_WORD_REGEX.test(normalized)) {
    return false;
  }

  const letterCount = (normalized.match(/\p{L}/gu) ?? []).length;
  const digitCount = (normalized.match(/\d/g) ?? []).length;
  if (letterCount < 8 || letterCount <= digitCount) {
    return false;
  }

  const words = normalized.match(/\p{L}{2,}/gu) ?? [];
  const uniqueWords = new Set(words.map((word) => word.toLowerCase()));
  return words.length >= 3 && uniqueWords.size >= 2;
}
