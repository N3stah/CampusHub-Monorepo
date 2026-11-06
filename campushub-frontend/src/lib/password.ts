const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SPECIAL = "!@#$%^&*()-_=+[]{}|;:,.<>?";
const ALL_CHARS = UPPERCASE + LOWERCASE + DIGITS + SPECIAL;

function randomChar(charset: string): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return charset[array[0] % charset.length];
}

/**
 * Generates a strong 12-character random password containing at least
 * one uppercase letter, one lowercase letter, one digit, and one special character.
 * Uses `crypto.getRandomValues` for cryptographic randomness.
 */
export function generatePassword(): string {
  const LENGTH = 12;

  // Guarantee at least one character from each required set
  const guaranteed = [
    randomChar(UPPERCASE),
    randomChar(LOWERCASE),
    randomChar(DIGITS),
    randomChar(SPECIAL),
  ];

  // Fill the remaining positions from the full character set
  const remaining: string[] = [];
  for (let i = guaranteed.length; i < LENGTH; i++) {
    remaining.push(randomChar(ALL_CHARS));
  }

  // Combine and shuffle using Fisher-Yates with crypto randomness
  const chars = [...guaranteed, ...remaining];
  for (let i = chars.length - 1; i > 0; i--) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const j = array[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

export function getPasswordStrength(password: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Not set' | 'Weak' | 'Fair' | 'Good' | 'Strong';
} {
  if (!password) return { score: 0, label: 'Not set' };

  const score = [
    password.length >= 8,
    password.length >= 12,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  if (score <= 1) return { score: 1, label: 'Weak' };
  if (score <= 3) return { score: 2, label: 'Fair' };
  if (score === 4) return { score: 3, label: 'Good' };
  return { score: 4, label: 'Strong' };
}
