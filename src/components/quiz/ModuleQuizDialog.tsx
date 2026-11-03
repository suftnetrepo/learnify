"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, RotateCcw, X, XCircle } from "lucide-react";
import { quizzesApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { QuizSubmissionResult, StudentModuleQuiz } from "@/types";

interface Props {
  sectionId: string;
  sectionTitle: string;
  onClose: () => void;
  initialQuiz?: StudentModuleQuiz;
  submitAnswers?: (answers: Array<{ questionId: string; optionId: string }>) => Promise<QuizSubmissionResult>;
}

export function ModuleQuizDialog({ sectionId, sectionTitle, onClose, initialQuiz, submitAnswers }: Props) {
  const [quiz, setQuiz] = useState<StudentModuleQuiz | null>(initialQuiz ?? null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizSubmissionResult | null>(null);
  const [loading, setLoading] = useState(!initialQuiz);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialQuiz) return;
    let cancelled = false;
    quizzesApi.getForSection(sectionId)
      .then((data) => { if (!cancelled) setQuiz(data); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the exercise"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [initialQuiz, sectionId]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function submit() {
    if (!quiz || Object.keys(selected).length !== quiz.questions.length) {
      setError("Answer every question before submitting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const answers = quiz.questions.map((question) => ({ questionId: question.id, optionId: selected[question.id] }));
      setResult(await (submitAnswers ? submitAnswers(answers) : quizzesApi.submit(quiz.id, answers)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the exercise");
    } finally {
      setSubmitting(false);
    }
  }

  function tryAgain() {
    setSelected({});
    setResult(null);
    setError(null);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-950/40 p-3 backdrop-blur-sm sm:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${sectionTitle} exercise`}
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl"
      >
        <div className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-surface-100 px-5 py-4 sm:px-7">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <ClipboardCheck size={19} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-500">End-of-module exercise</p>
              <h2 className="truncate font-display text-lg font-bold text-gray-900">{quiz?.title ?? sectionTitle}</h2>
              {quiz && <p className="mt-0.5 text-xs text-gray-400">{quiz.questions.length} questions · Pass mark {quiz.passMark}%</p>}
            </div>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-surface-100 hover:text-gray-700" aria-label="Close exercise">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400">Loading exercise…</div>
          ) : error && !quiz ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">{error}</div>
          ) : !quiz ? (
            <div className="py-16 text-center">
              <ClipboardCheck size={32} className="mx-auto text-gray-300" />
              <p className="mt-3 text-sm font-semibold text-gray-700">Exercise coming soon</p>
              <p className="mt-1 text-xs text-gray-400">Questions for this module have not been published yet.</p>
            </div>
          ) : result ? (
            <div className="space-y-5">
              <div className={cn("rounded-3xl border p-6 text-center", result.passed ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50")}>
                {result.passed
                  ? <CheckCircle2 size={36} className="mx-auto text-emerald-500" />
                  : <RotateCcw size={36} className="mx-auto text-amber-500" />}
                <p className="mt-3 font-display text-4xl font-extrabold text-gray-900">{result.score}%</p>
                <p className="mt-1 text-sm font-semibold text-gray-700">
                  {result.correctAnswers} of {result.totalQuestions} correct · {result.passed ? "Passed" : "Keep practising"}
                </p>
              </div>
              <div className="space-y-3">
                {quiz.questions.map((question, index) => {
                  const marked = result.answers.find((answer) => answer.questionId === question.id)!;
                  const selectedLabel = question.options.find((option) => option.id === marked.selectedOptionId)?.label;
                  const correctLabel = question.options.find((option) => option.id === marked.correctOptionId)?.label;
                  return (
                    <div key={question.id} className="rounded-2xl border border-surface-100 p-4">
                      <div className="flex gap-2.5">
                        {marked.isCorrect
                          ? <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                          : <XCircle size={18} className="mt-0.5 flex-shrink-0 text-red-400" />}
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{index + 1}. {question.question}</p>
                          <p className="mt-1.5 text-xs text-gray-500">Your answer: {selectedLabel}</p>
                          {!marked.isCorrect && <p className="mt-1 text-xs font-medium text-emerald-700">Correct answer: {correctLabel}</p>}
                          {marked.explanation && <p className="mt-2 text-xs leading-relaxed text-gray-500">{marked.explanation}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {quiz.instructions && <p className="rounded-2xl bg-surface-50 px-4 py-3 text-sm text-gray-600">{quiz.instructions}</p>}
              {quiz.latestAttempt && (
                <p className="text-xs text-gray-400">Previous score: <span className="font-semibold text-gray-700">{quiz.latestAttempt.score}%</span>{quiz.bestScore !== null && <> · Best: <span className="font-semibold text-gray-700">{quiz.bestScore}%</span></>}</p>
              )}
              {quiz.questions.map((question, index) => (
                <fieldset key={question.id} className="rounded-2xl border border-surface-100 p-4 sm:p-5">
                  <legend className="px-1 text-sm font-semibold leading-relaxed text-gray-900">{index + 1}. {question.question}</legend>
                  <div className="mt-3 space-y-2">
                    {question.options.map((option, optionIndex) => (
                      <label key={option.id} className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors",
                        selected[question.id] === option.id ? "border-brand-300 bg-brand-50 text-brand-800" : "border-surface-100 text-gray-600 hover:border-brand-200 hover:bg-surface-50",
                      )}>
                        <input
                          type="radio"
                          name={question.id}
                          value={option.id}
                          checked={selected[question.id] === option.id}
                          onChange={() => { setSelected((current) => ({ ...current, [question.id]: option.id })); setError(null); }}
                          className="mt-0.5 accent-brand-500"
                        />
                        <span><span className="mr-1.5 font-semibold">{String.fromCharCode(65 + optionIndex)}.</span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
          )}
        </div>

        {quiz && !loading && (
          <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-surface-100 bg-white px-5 py-4 sm:px-7">
            <p className="text-xs text-gray-400">{result ? "Your result has been saved." : `${Object.keys(selected).length} / ${quiz.questions.length} answered`}</p>
            {result ? (
              <button onClick={tryAgain} className="inline-flex items-center gap-2 rounded-xl border border-brand-200 px-4 py-2.5 text-sm font-semibold text-brand-600 hover:bg-brand-50">
                <RotateCcw size={14} /> Try again
              </button>
            ) : (
              <button onClick={submit} disabled={submitting || !quiz.questions.length} className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? "Marking…" : "Submit answers"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
