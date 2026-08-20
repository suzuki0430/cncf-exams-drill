import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateExamData } from "../app/lib/exam";
import {
  readContentLanguage,
  readMasteredQuestionIds,
  writeContentLanguage,
  writeMasteredQuestionIds,
} from "../app/lib/progress";

/** Minimal in-memory implementation used to unit-test browser storage logic. */
class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

/** Loads a fresh mutable copy of the bundled CCA JSON for validation tests. */
async function loadCcaData(): Promise<unknown> {
  const fileUrl = new URL("../app/data/cca.json", import.meta.url);
  return JSON.parse(await readFile(fileUrl, "utf8")) as unknown;
}

test("accepts all 120 ordered CCA questions", async () => {
  const exam = validateExamData(await loadCcaData());

  assert.equal(exam.id, "cca-practice-120");
  assert.equal(exam.schemaVersion, 2);
  assert.equal(exam.contentStatus, "ready");
  assert.equal(exam.questions.length, 120);
  assert.equal(exam.questions[0].id, "cca-001");
  assert.equal(exam.questions.at(-1)?.id, "cca-120");
  assert.equal(new Set(exam.questions.map((question) => question.id)).size, 120);
  for (const question of exam.questions) {
    assert.ok(question.question.en.length > 0);
    assert.ok(question.question.ja.length > 0);
    for (const choice of question.choices) {
      assert.ok(choice.text.en.length > 0);
      assert.ok(choice.text.ja.length > 0);
    }
  }
});

test("rejects a question with a missing Japanese translation", async () => {
  const invalid = (await loadCcaData()) as {
    questions: Array<{ question: { ja: string } }>;
  };
  invalid.questions[0].question.ja = "";

  assert.throws(
    () => validateExamData(invalid),
    /Question 1 text \(Japanese\) must be a non-empty string/,
  );
});

test("rejects a correct answer that is not one of the four choices", async () => {
  const invalid = (await loadCcaData()) as {
    questions: Array<{ correctChoiceId: string }>;
  };
  invalid.questions[0].correctChoiceId = "missing";

  assert.throws(
    () => validateExamData(invalid),
    /Correct choice "missing" is missing/,
  );
});

test("rejects duplicate stable question IDs", async () => {
  const invalid = (await loadCcaData()) as {
    questions: Array<{ id: string }>;
  };
  invalid.questions[1].id = invalid.questions[0].id;

  assert.throws(() => validateExamData(invalid), /Question id .* is duplicated/);
});

test("stores mastery separately for each exam", () => {
  const storage = new MemoryStorage();
  writeMasteredQuestionIds(
    storage,
    "cca-practice-120",
    new Set(["cca-002", "cca-001"]),
  );
  writeMasteredQuestionIds(storage, "otca", new Set(["otca-001"]));

  assert.deepEqual(
    [...readMasteredQuestionIds(storage, "cca-practice-120")],
    ["cca-001", "cca-002"],
  );
  assert.deepEqual([...readMasteredQuestionIds(storage, "otca")], ["otca-001"]);
});

test("defaults all content to English and persists Japanese", () => {
  const storage = new MemoryStorage();
  assert.equal(readContentLanguage(storage), "en");

  writeContentLanguage(storage, "ja");
  assert.equal(readContentLanguage(storage), "ja");
});

test("migrates the former explanation-only language preference", () => {
  const storage = new MemoryStorage();
  const legacyKey = "cncf-exams-drill:explanation-language";
  const contentKey = "cncf-exams-drill:content-language";
  storage.setItem(legacyKey, "ja");

  assert.equal(readContentLanguage(storage), "ja");
  writeContentLanguage(storage, "ja");
  assert.equal(storage.getItem(contentKey), "ja");
  assert.equal(storage.getItem(legacyKey), null);
});

test("ignores corrupt mastery data instead of blocking the app", () => {
  const storage = new MemoryStorage();
  storage.setItem("cncf-exams-drill:mastery:cca-practice-120", "not-json");

  assert.deepEqual(
    [...readMasteredQuestionIds(storage, "cca-practice-120")],
    [],
  );
});
