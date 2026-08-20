/** A language available for learner-facing exam content. */
export type ContentLanguage = "en" | "ja";

/** English and Japanese variants of one Markdown-capable text field. */
export type LocalizedText = Record<ContentLanguage, string>;

/** One selectable answer in a four-choice question. */
export interface ExamChoice {
  id: string;
  text: LocalizedText;
}

/** One ordered multiple-choice question with fully bilingual content. */
export interface ExamQuestion {
  id: string;
  topic: string;
  question: LocalizedText;
  choices: [ExamChoice, ExamChoice, ExamChoice, ExamChoice];
  correctChoiceId: string;
  explanation: LocalizedText;
}

/** A complete exam file that can be loaded without a database. */
export interface ExamData {
  $schema?: string;
  schemaVersion: 2;
  id: string;
  shortName: string;
  title: string;
  description: string;
  contentStatus: "sample" | "ready";
  questions: ExamQuestion[];
}

/**
 * Validates imported JSON before the application renders it.
 *
 * The JSON Schema improves the authoring experience, while this runtime check
 * catches invalid correct-answer references and duplicate IDs that JSON Schema
 * cannot conveniently express.
 *
 * @param input - Parsed JSON data from an exam file.
 * @returns The same data narrowed to `ExamData`.
 * @throws {Error} When the exam or any question is structurally invalid.
 *
 * @example
 * ```ts
 * import rawExam from "../data/cca.json";
 * const exam = validateExamData(rawExam);
 * ```
 */
export function validateExamData(input: unknown): ExamData {
  if (!isRecord(input)) {
    throw new Error("Exam data must be an object.");
  }

  assertString(input.id, "Exam id");
  assertString(input.shortName, "Exam shortName");
  assertString(input.title, "Exam title");
  assertString(input.description, "Exam description");

  if (input.schemaVersion !== 2) {
    throw new Error("Exam schemaVersion must be 2.");
  }
  if (input.contentStatus !== "sample" && input.contentStatus !== "ready") {
    throw new Error('Exam contentStatus must be "sample" or "ready".');
  }
  if (!Array.isArray(input.questions) || input.questions.length === 0) {
    throw new Error("Exam questions must contain at least one question.");
  }

  const questionIds = new Set<string>();
  input.questions.forEach((question, index) => {
    validateQuestion(question, index, questionIds);
  });

  return input as unknown as ExamData;
}

/**
 * Checks the fields and answer references for one question.
 *
 * @param input - Candidate question data.
 * @param index - Zero-based location used in actionable error messages.
 * @param questionIds - IDs already encountered in the current exam.
 * @throws {Error} When a required field, choice, or answer reference is invalid.
 */
function validateQuestion(
  input: unknown,
  index: number,
  questionIds: Set<string>,
): void {
  if (!isRecord(input)) {
    throw new Error(`Question ${index + 1} must be an object.`);
  }

  assertString(input.id, `Question ${index + 1} id`);
  assertString(input.topic, `Question ${index + 1} topic`);
  validateLocalizedText(input.question, `Question ${index + 1} text`);

  if (questionIds.has(input.id)) {
    throw new Error(`Question id "${input.id}" is duplicated.`);
  }
  questionIds.add(input.id);

  if (!Array.isArray(input.choices) || input.choices.length !== 4) {
    throw new Error(`Question "${input.id}" must have exactly four choices.`);
  }

  const choiceIds = new Set<string>();
  input.choices.forEach((choice, choiceIndex) => {
    if (!isRecord(choice)) {
      throw new Error(`Choice ${choiceIndex + 1} in "${input.id}" must be an object.`);
    }
    assertString(choice.id, `Choice ${choiceIndex + 1} id in "${input.id}"`);
    validateLocalizedText(
      choice.text,
      `Choice ${choiceIndex + 1} text in "${input.id}"`,
    );
    if (choiceIds.has(choice.id)) {
      throw new Error(`Choice id "${choice.id}" is duplicated in "${input.id}".`);
    }
    choiceIds.add(choice.id);
  });

  assertString(input.correctChoiceId, `Correct choice id in "${input.id}"`);
  if (!choiceIds.has(input.correctChoiceId)) {
    throw new Error(`Correct choice "${input.correctChoiceId}" is missing in "${input.id}".`);
  }

  validateLocalizedText(input.explanation, `Explanation in "${input.id}"`);
}

/**
 * Validates both language variants of one localized Markdown string.
 *
 * @param value - Candidate object containing `en` and `ja` strings.
 * @param label - Human-readable field name for actionable errors.
 * @throws {Error} When either translation is absent or empty.
 */
function validateLocalizedText(value: unknown, label: string): void {
  if (!isRecord(value)) {
    throw new Error(`${label} must include English and Japanese text.`);
  }
  assertString(value.en, `${label} (English)`);
  assertString(value.ja, `${label} (Japanese)`);
}

/**
 * Asserts that an unknown value is a non-empty string.
 *
 * @param value - Value to validate.
 * @param label - Human-readable field name for errors.
 * @throws {Error} When the value is not a non-empty string.
 */
function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

/**
 * Narrows an unknown value to an object with string keys.
 *
 * @param value - Value to inspect.
 * @returns Whether the value is a non-null, non-array object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
