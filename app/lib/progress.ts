import type { ContentLanguage } from "./exam";

const STORAGE_PREFIX = "cncf-exams-drill";
const CONTENT_LANGUAGE_KEY = `${STORAGE_PREFIX}:content-language`;
const LEGACY_EXPLANATION_LANGUAGE_KEY = `${STORAGE_PREFIX}:explanation-language`;

interface StoredMastery {
  version: 1;
  questionIds: string[];
}

/**
 * Reads the locally mastered question IDs for one exam.
 *
 * Corrupt or outdated values are ignored so a manually edited browser storage
 * entry cannot prevent the app from loading.
 *
 * @param storage - Browser-compatible storage implementation.
 * @param examId - Stable exam identifier, such as `cca`.
 * @returns A set of mastered question IDs, or an empty set on invalid data.
 */
export function readMasteredQuestionIds(
  storage: Storage,
  examId: string,
): Set<string> {
  try {
    const rawValue = storage.getItem(masteryKey(examId));
    if (!rawValue) {
      return new Set();
    }

    const parsed = JSON.parse(rawValue) as Partial<StoredMastery>;
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.questionIds) ||
      !parsed.questionIds.every((id) => typeof id === "string")
    ) {
      return new Set();
    }

    return new Set(parsed.questionIds);
  } catch {
    return new Set();
  }
}

/**
 * Persists mastered question IDs for one exam on the current device.
 *
 * @param storage - Browser-compatible storage implementation.
 * @param examId - Stable exam identifier.
 * @param questionIds - Mastered IDs to store.
 */
export function writeMasteredQuestionIds(
  storage: Storage,
  examId: string,
  questionIds: ReadonlySet<string>,
): void {
  const value: StoredMastery = {
    version: 1,
    questionIds: [...questionIds].sort(),
  };
  storage.setItem(masteryKey(examId), JSON.stringify(value));
}

/**
 * Reads the preferred language for questions, choices, and explanations.
 *
 * The former explanation-only preference is accepted as a one-way migration,
 * so existing users keep their selection after upgrading the app.
 *
 * @param storage - Browser-compatible storage implementation.
 * @returns The stored language, defaulting to English.
 */
export function readContentLanguage(storage: Storage): ContentLanguage {
  const language =
    storage.getItem(CONTENT_LANGUAGE_KEY) ??
    storage.getItem(LEGACY_EXPLANATION_LANGUAGE_KEY);
  return language === "ja" ? "ja" : "en";
}

/**
 * Persists the preferred content language for future sessions.
 *
 * @param storage - Browser-compatible storage implementation.
 * @param language - Content language selected by the learner.
 */
export function writeContentLanguage(
  storage: Storage,
  language: ContentLanguage,
): void {
  storage.setItem(CONTENT_LANGUAGE_KEY, language);
  storage.removeItem(LEGACY_EXPLANATION_LANGUAGE_KEY);
}

/**
 * Builds a namespaced mastery key so future exams do not share progress.
 *
 * @param examId - Stable exam identifier.
 * @returns The localStorage key for the exam.
 */
function masteryKey(examId: string): string {
  return `${STORAGE_PREFIX}:mastery:${examId}`;
}
