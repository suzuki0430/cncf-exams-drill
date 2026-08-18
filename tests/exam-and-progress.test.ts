import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateExamData } from "../app/lib/exam";
import {
  readExplanationLanguage,
  readMasteredQuestionIds,
  writeExplanationLanguage,
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

test("accepts the bundled ordered four-choice exam", async () => {
  const exam = validateExamData(await loadCcaData());

  assert.equal(exam.id, "cca");
  assert.equal(exam.questions.length, 4);
  assert.deepEqual(
    exam.questions.map((question) => question.id),
    ["cca-001", "cca-002", "cca-003", "cca-004"],
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
  writeMasteredQuestionIds(storage, "cca", new Set(["cca-002", "cca-001"]));
  writeMasteredQuestionIds(storage, "otca", new Set(["otca-001"]));

  assert.deepEqual([...readMasteredQuestionIds(storage, "cca")], [
    "cca-001",
    "cca-002",
  ]);
  assert.deepEqual([...readMasteredQuestionIds(storage, "otca")], ["otca-001"]);
});

test("defaults explanations to English and persists Japanese", () => {
  const storage = new MemoryStorage();
  assert.equal(readExplanationLanguage(storage), "en");

  writeExplanationLanguage(storage, "ja");
  assert.equal(readExplanationLanguage(storage), "ja");
});

test("ignores corrupt mastery data instead of blocking the app", () => {
  const storage = new MemoryStorage();
  storage.setItem("cncf-exams-drill:mastery:cca", "not-json");

  assert.deepEqual([...readMasteredQuestionIds(storage, "cca")], []);
});
