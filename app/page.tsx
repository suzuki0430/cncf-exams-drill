"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rawCcaExam from "./data/cca.json";
import {
  type ContentLanguage,
  type ExamData,
  type ExamQuestion,
  validateExamData,
} from "./lib/exam";
import {
  readContentLanguage,
  readMasteredQuestionIds,
  writeContentLanguage,
  writeMasteredQuestionIds,
} from "./lib/progress";
import { escapeStandaloneNumber } from "./lib/markdown";

const exam = validateExamData(rawCcaExam);

type AppView = "library" | "quiz" | "results";
type StudyMode = "practice" | "review";

interface AnswerState {
  selectedChoiceId: string | null;
  submitted: boolean;
}

/**
 * Runs the complete local study experience for the currently bundled exam.
 *
 * Session answers intentionally remain in memory so every new practice starts
 * from question one. Only mastery and content language are durable.
 *
 * @returns The exam library, active question, or score view.
 */
export default function Home() {
  const [view, setView] = useState<AppView>("library");
  const [mode, setMode] = useState<StudyMode>("practice");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionQuestionIds, setSessionQuestionIds] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [language, setLanguage] = useState<ContentLanguage>("en");
  const [storageReady, setStorageReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  useEffect(() => {
    const validQuestionIds = new Set(exam.questions.map((question) => question.id));
    const storedIds = readMasteredQuestionIds(window.localStorage, exam.id);
    const knownStoredIds = new Set(
      [...storedIds].filter((questionId) => validQuestionIds.has(questionId)),
    );

    // Browser storage is external state and can only be read after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMasteredIds(knownStoredIds);
    setLanguage(readContentLanguage(window.localStorage));
    setStorageReady(true);
  }, []);

  const sessionQuestions = useMemo(
    () =>
      sessionQuestionIds
        .map((questionId) =>
          exam.questions.find((question) => question.id === questionId),
        )
        .filter((question): question is ExamQuestion => question !== undefined),
    [sessionQuestionIds],
  );

  const currentQuestion = sessionQuestions[currentIndex];
  const currentAnswer = currentQuestion
    ? (answers[currentQuestion.id] ?? {
        selectedChoiceId: null,
        submitted: false,
      })
    : null;
  const remainingCount = exam.questions.length - masteredIds.size;
  const answeredCount = sessionQuestions.filter(
    (question) => answers[question.id]?.submitted,
  ).length;
  const score = sessionQuestions.reduce((total, question) => {
    const answer = answers[question.id];
    return total +
      (answer?.submitted && answer.selectedChoiceId === question.correctChoiceId
        ? 1
        : 0);
  }, 0);

  /** Starts a fresh, ordered session for the selected study mode. */
  function startSession(nextMode: StudyMode): void {
    const questions =
      nextMode === "review"
        ? exam.questions.filter((question) => !masteredIds.has(question.id))
        : exam.questions;

    if (questions.length === 0) {
      setView("library");
      scrollToTop();
      return;
    }

    setMode(nextMode);
    setSessionQuestionIds(questions.map((question) => question.id));
    setAnswers({});
    setCurrentIndex(0);
    setView("quiz");
    scrollToTop();
  }

  /** Selects an answer while leaving it editable until submission. */
  function selectChoice(questionId: string, choiceId: string): void {
    setAnswers((current) => {
      if (current[questionId]?.submitted) {
        return current;
      }
      return {
        ...current,
        [questionId]: { selectedChoiceId: choiceId, submitted: false },
      };
    });
  }

  /** Locks the selected answer and reveals the result and explanation. */
  function submitAnswer(questionId: string): void {
    setAnswers((current) => {
      const answer = current[questionId];
      if (!answer?.selectedChoiceId) {
        return current;
      }
      return {
        ...current,
        [questionId]: { ...answer, submitted: true },
      };
    });
  }

  /** Moves to the previous ordered question when one exists. */
  function showPreviousQuestion(): void {
    setCurrentIndex((index) => Math.max(0, index - 1));
    scrollToTop();
  }

  /** Moves forward or completes the session after the final answer. */
  function showNextQuestion(): void {
    if (currentIndex >= sessionQuestions.length - 1) {
      setView("results");
    } else {
      setCurrentIndex((index) => index + 1);
    }
    scrollToTop();
  }

  /** Returns to the exam library and clears only temporary session state. */
  function returnToLibrary(): void {
    setView("library");
    setSessionQuestionIds([]);
    setAnswers({});
    setCurrentIndex(0);
    scrollToTop();
  }

  /** Saves or removes a mastery mark for one stable question ID. */
  function toggleMastered(questionId: string): void {
    setMasteredIds((current) => {
      const next = new Set(current);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }

      try {
        writeMasteredQuestionIds(window.localStorage, exam.id, next);
        setStorageWarning(null);
      } catch {
        setStorageWarning("Mastery changed for this session, but could not be saved.");
      }
      return next;
    });
  }

  /** Clears every saved mastery mark after explicit learner confirmation. */
  function resetMastery(): void {
    const confirmed = window.confirm(
      `Clear all ${masteredIds.size} mastered questions for ${exam.shortName}?`,
    );
    if (!confirmed) {
      return;
    }

    const emptyIds = new Set<string>();
    setMasteredIds(emptyIds);
    try {
      writeMasteredQuestionIds(window.localStorage, exam.id, emptyIds);
      setStorageWarning(null);
    } catch {
      setStorageWarning("Mastery was cleared for this session, but could not be saved.");
    }
  }

  /** Updates and persists the language shared by all exam content. */
  function changeLanguage(nextLanguage: ContentLanguage): void {
    setLanguage(nextLanguage);
    try {
      writeContentLanguage(window.localStorage, nextLanguage);
      setStorageWarning(null);
    } catch {
      setStorageWarning("Language changed for this session, but could not be saved.");
    }
  }

  if (view === "quiz" && currentQuestion && currentAnswer) {
    return (
      <QuizView
        exam={exam}
        mode={mode}
        question={currentQuestion}
        answer={currentAnswer}
        questionIndex={currentIndex}
        questionCount={sessionQuestions.length}
        answeredCount={answeredCount}
        remainingCount={remainingCount}
        isMastered={masteredIds.has(currentQuestion.id)}
        language={language}
        storageWarning={storageWarning}
        onBackToLibrary={returnToLibrary}
        onChoiceSelect={selectChoice}
        onSubmit={submitAnswer}
        onPrevious={showPreviousQuestion}
        onNext={showNextQuestion}
        onToggleMastered={toggleMastered}
        onLanguageChange={changeLanguage}
      />
    );
  }

  if (view === "results") {
    return (
      <ResultsView
        exam={exam}
        mode={mode}
        score={score}
        total={sessionQuestions.length}
        remainingCount={remainingCount}
        onReturnToLibrary={returnToLibrary}
        onRestart={() => startSession(mode)}
      />
    );
  }

  return (
    <LibraryView
      exam={exam}
      masteredCount={masteredIds.size}
      remainingCount={remainingCount}
      storageReady={storageReady}
      storageWarning={storageWarning}
      onStart={startSession}
      onReset={resetMastery}
    />
  );
}

interface LibraryViewProps {
  exam: ExamData;
  masteredCount: number;
  remainingCount: number;
  storageReady: boolean;
  storageWarning: string | null;
  onStart: (mode: StudyMode) => void;
  onReset: () => void;
}

/** Renders the exam library and mode entry points. */
function LibraryView({
  exam,
  masteredCount,
  remainingCount,
  storageReady,
  storageWarning,
  onStart,
  onReset,
}: LibraryViewProps) {
  return (
    <main className="app-shell">
      <SiteHeader />

      <section className="hero" id="top">
        <div className="eyebrow">Certification practice, without the noise</div>
        <h1>
          Build confidence.
          <br />
          One question at a time.
        </h1>
        <p>
          Focused practice for CNCF ecosystem certifications, with clear
          explanations and a review queue shaped by what you have mastered.
        </p>
      </section>

      <section className="exam-section" aria-labelledby="choose-exam">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Your library</span>
            <h2 id="choose-exam">Choose an exam</h2>
          </div>
          <span className="exam-count">1 exam available</span>
        </div>

        {storageWarning ? <StorageWarning message={storageWarning} /> : null}

        <article className="exam-card">
          <div className="exam-card-top">
            <div className="exam-monogram" aria-hidden="true">
              C
            </div>
            <div className="exam-meta">
              <div className="tag-row">
                <span className="available-tag">Available</span>
                {exam.contentStatus === "sample" ? (
                  <span className="sample-tag">Sample content</span>
                ) : null}
              </div>
              <span>{exam.title}</span>
            </div>
          </div>

          <div className="exam-card-content">
            <div className="exam-card-copy">
              <h3>{exam.shortName}</h3>
              <p>{exam.description}</p>
            </div>
            <dl className="exam-stats" aria-label="Exam progress">
              <div>
                <dt>Questions</dt>
                <dd>{exam.questions.length}</dd>
              </div>
              <div>
                <dt>Mastered</dt>
                <dd>{storageReady ? masteredCount : "—"}</dd>
              </div>
              <div>
                <dt>To review</dt>
                <dd>{storageReady ? remainingCount : "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="mode-grid">
            <button
              className="mode-button primary"
              type="button"
              disabled={!storageReady}
              onClick={() => onStart("practice")}
            >
              <span>
                Full practice <span aria-hidden="true">→</span>
              </span>
              <small>All {exam.questions.length} questions, in order</small>
            </button>
            <button
              className="mode-button secondary"
              type="button"
              disabled={!storageReady || remainingCount === 0}
              onClick={() => onStart("review")}
            >
              <span>
                Review <span aria-hidden="true">→</span>
              </span>
              <small>
                {remainingCount === 0
                  ? "All questions mastered"
                  : `${remainingCount} ${pluralize("question", remainingCount)} remaining`}
              </small>
            </button>
          </div>

          <div className="exam-card-footer">
            <span>Progress is saved only in this browser.</span>
            <button
              className="text-button danger"
              type="button"
              disabled={!storageReady || masteredCount === 0}
              onClick={onReset}
            >
              Reset mastered questions
            </button>
          </div>
        </article>
      </section>

      <footer className="site-footer">
        <p>
          Unofficial community project. Not affiliated with or endorsed by CNCF,
          The Linux Foundation, or the Cilium project.
        </p>
        <a
          href="https://www.linuxfoundation.org/trademark-usage"
          target="_blank"
          rel="noreferrer"
        >
          Trademark usage
        </a>
      </footer>
    </main>
  );
}

interface QuizViewProps {
  exam: ExamData;
  mode: StudyMode;
  question: ExamQuestion;
  answer: AnswerState;
  questionIndex: number;
  questionCount: number;
  answeredCount: number;
  remainingCount: number;
  isMastered: boolean;
  language: ContentLanguage;
  storageWarning: string | null;
  onBackToLibrary: () => void;
  onChoiceSelect: (questionId: string, choiceId: string) => void;
  onSubmit: (questionId: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleMastered: (questionId: string) => void;
  onLanguageChange: (language: ContentLanguage) => void;
}

/** Renders one bilingual question, its locked answer state, and explanation. */
function QuizView({
  exam,
  mode,
  question,
  answer,
  questionIndex,
  questionCount,
  answeredCount,
  remainingCount,
  isMastered,
  language,
  storageWarning,
  onBackToLibrary,
  onChoiceSelect,
  onSubmit,
  onPrevious,
  onNext,
  onToggleMastered,
  onLanguageChange,
}: QuizViewProps) {
  const isCorrect = answer.selectedChoiceId === question.correctChoiceId;
  const isLastQuestion = questionIndex === questionCount - 1;
  const progress = ((questionIndex + 1) / questionCount) * 100;

  return (
    <main className="quiz-shell">
      <header className="quiz-header">
        <button className="brand brand-button" type="button" onClick={onBackToLibrary}>
          <span className="brand-mark">CD</span>
          <span>CNCF Exams Drill</span>
        </button>
        <div className="quiz-header-controls">
          <div className="quiz-header-meta">
            <span className="mode-chip">
              {mode === "practice" ? "Full practice" : "Review"}
            </span>
            <span>{exam.shortName}</span>
          </div>
          <LanguageToggle
            language={language}
            onLanguageChange={onLanguageChange}
          />
        </div>
      </header>

      <div className="quiz-container">
        <div className="progress-heading">
          <span>
            Question {questionIndex + 1} <span>of {questionCount}</span>
          </span>
          <span>{remainingCount} remaining to master</span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={questionCount}
          aria-valuenow={questionIndex + 1}
          aria-label="Question progress"
        >
          <span style={{ width: `${progress}%` }} />
        </div>

        {storageWarning ? <StorageWarning message={storageWarning} /> : null}

        <div className="quiz-layout">
          <section className="question-card" aria-labelledby="question-title">
            <div className="question-kicker">
              <span>{question.topic}</span>
              <span>{question.id.toUpperCase()}</span>
            </div>
            <div
              className="question-copy"
              id="question-title"
              lang={language}
            >
              <Markdown content={question.question[language]} />
            </div>

            <fieldset className="choices" disabled={answer.submitted}>
              <legend className="sr-only">Choose one answer</legend>
              {question.choices.map((choice, index) => {
                const resultClass = getChoiceResultClass(
                  choice.id,
                  question.correctChoiceId,
                  answer,
                );
                return (
                  <label
                    className={`choice ${resultClass}`.trim()}
                    key={choice.id}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      value={choice.id}
                      checked={answer.selectedChoiceId === choice.id}
                      onChange={() => onChoiceSelect(question.id, choice.id)}
                    />
                    <span className="choice-letter" aria-hidden="true">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="choice-copy" lang={language}>
                      <Markdown content={choice.text[language]} />
                    </span>
                    {answer.submitted && choice.id === question.correctChoiceId ? (
                      <span className="choice-result">Correct</span>
                    ) : null}
                    {answer.submitted &&
                    choice.id === answer.selectedChoiceId &&
                    choice.id !== question.correctChoiceId ? (
                      <span className="choice-result">Your answer</span>
                    ) : null}
                  </label>
                );
              })}
            </fieldset>

            {!answer.submitted ? (
              <div className="submit-row">
                <span>Select one answer before submitting.</span>
                <button
                  className="submit-button"
                  type="button"
                  disabled={!answer.selectedChoiceId}
                  onClick={() => onSubmit(question.id)}
                >
                  Submit answer
                </button>
              </div>
            ) : (
              <ExplanationPanel
                question={question}
                isCorrect={isCorrect}
                isMastered={isMastered}
                language={language}
                onToggleMastered={() => onToggleMastered(question.id)}
              />
            )}

            <nav className="question-navigation" aria-label="Question navigation">
              <button
                className="nav-button secondary"
                type="button"
                disabled={questionIndex === 0}
                onClick={onPrevious}
              >
                <span aria-hidden="true">←</span> Previous
              </button>
              <button
                className="nav-button primary"
                type="button"
                disabled={!answer.submitted}
                onClick={onNext}
              >
                {isLastQuestion ? "Finish" : "Next"} <span aria-hidden="true">→</span>
              </button>
            </nav>
          </section>

          <aside className="session-card" aria-label="Study session details">
            <span className="section-kicker">Session</span>
            <h2>{mode === "practice" ? "Full practice" : "Review queue"}</h2>
            <p>
              {mode === "practice"
                ? "All questions are included in their original order."
                : "Only questions not marked as mastered are included."}
            </p>
            <div className="session-stat">
              <span>Answered</span>
              <strong>
                {answeredCount} / {questionCount}
              </strong>
            </div>
            <div className="session-note">
              Answers are locked after submission. Use Previous to revisit an
              explanation.
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

interface ExplanationPanelProps {
  question: ExamQuestion;
  isCorrect: boolean;
  isMastered: boolean;
  language: ContentLanguage;
  onToggleMastered: () => void;
}

/** Displays answer feedback, the localized explanation, and mastery control. */
function ExplanationPanel({
  question,
  isCorrect,
  isMastered,
  language,
  onToggleMastered,
}: ExplanationPanelProps) {
  return (
    <section
      className={`explanation ${isCorrect ? "correct" : "incorrect"}`}
      aria-live="polite"
    >
      <div className="explanation-heading">
        <div>
          <span className="result-label">{isCorrect ? "Correct" : "Not quite"}</span>
          <h2>Explanation</h2>
        </div>
      </div>
      <div className="explanation-copy" lang={language}>
        <Markdown content={question.explanation[language]} />
      </div>
      <div className="mastery-control">
        <input
          id={`mastery-${question.id}`}
          type="checkbox"
          checked={isMastered}
          aria-describedby={`mastery-help-${question.id}`}
          onChange={onToggleMastered}
        />
        <span>
          <label className="mastery-label" htmlFor={`mastery-${question.id}`}>
            Mark as mastered
          </label>
          <small id={`mastery-help-${question.id}`}>
            Mastered questions are excluded from Review mode.
          </small>
        </span>
      </div>
    </section>
  );
}

interface ResultsViewProps {
  exam: ExamData;
  mode: StudyMode;
  score: number;
  total: number;
  remainingCount: number;
  onReturnToLibrary: () => void;
  onRestart: () => void;
}

/** Shows the compact score summary requested at the end of a session. */
function ResultsView({
  exam,
  mode,
  score,
  total,
  remainingCount,
  onReturnToLibrary,
  onRestart,
}: ResultsViewProps) {
  const percentage = total === 0 ? 0 : Math.round((score / total) * 100);

  return (
    <main className="results-shell">
      <SiteHeader />
      <section className="results-card" aria-labelledby="results-title">
        <span className="section-kicker">Session complete</span>
        <h1 id="results-title">Nice work.</h1>
        <p>
          You completed {mode === "practice" ? "Full practice" : "Review"} for {exam.shortName}.
        </p>

        <div className="score-display">
          <span>{percentage}%</span>
          <div>
            <strong>
              {score} / {total} correct
            </strong>
            <small>{remainingCount} questions remain to master</small>
          </div>
        </div>

        <div className="results-actions">
          <button className="nav-button secondary" type="button" onClick={onReturnToLibrary}>
            Back to library
          </button>
          <button className="nav-button primary" type="button" onClick={onRestart}>
            Try again <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    </main>
  );
}

/** Renders the shared product header for non-quiz views. */
function SiteHeader() {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="CNCF Exams Drill home">
        <span className="brand-mark">CD</span>
        <span>CNCF Exams Drill</span>
      </a>
      <span className="local-badge">Local study workspace</span>
    </header>
  );
}

interface LanguageToggleProps {
  language: ContentLanguage;
  onLanguageChange: (language: ContentLanguage) => void;
}

/** Switches questions, choices, and explanations between English and Japanese. */
function LanguageToggle({
  language,
  onLanguageChange,
}: LanguageToggleProps) {
  return (
    <div className="language-toggle" role="group" aria-label="Content language">
      <button
        type="button"
        className={language === "en" ? "active" : ""}
        aria-pressed={language === "en"}
        onClick={() => onLanguageChange("en")}
      >
        EN
      </button>
      <button
        type="button"
        className={language === "ja" ? "active" : ""}
        aria-pressed={language === "ja"}
        onClick={() => onLanguageChange("ja")}
      >
        JA
      </button>
    </div>
  );
}

/** Renders safe Markdown used by questions, choices, and explanations. */
function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {escapeStandaloneNumber(content)}
    </ReactMarkdown>
  );
}

/** Displays a recoverable browser-storage problem without blocking study. */
function StorageWarning({ message }: { message: string }) {
  return (
    <p className="storage-warning" role="status">
      {message}
    </p>
  );
}

/** Returns the visual feedback class for one choice. */
function getChoiceResultClass(
  choiceId: string,
  correctChoiceId: string,
  answer: AnswerState,
): string {
  if (!answer.submitted) {
    return answer.selectedChoiceId === choiceId ? "selected" : "";
  }
  if (choiceId === correctChoiceId) {
    return "answer-correct";
  }
  if (choiceId === answer.selectedChoiceId) {
    return "answer-incorrect";
  }
  return "answer-muted";
}

/** Keeps compact count labels grammatically correct. */
function pluralize(noun: string, count: number): string {
  return count === 1 ? noun : `${noun}s`;
}

/** Scrolls each screen or question transition to a predictable starting point. */
function scrollToTop(): void {
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
