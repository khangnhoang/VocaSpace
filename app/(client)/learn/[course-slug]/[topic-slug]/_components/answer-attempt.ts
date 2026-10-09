/**
 * One answer submission, owned by the workspace instead of the response view.
 * A view unmounts when the learner leaves its question or stage, but the request
 * keeps running; keeping its state here means a returning view still sees it as
 * pending (no second submit) and picks up the result that lands later.
 */
export type AttemptOutcome =
  | { kind: "correct"; explanation?: string; progressError?: string; passed: boolean }
  | { kind: "incorrect"; explanation?: string; progressError?: string; passed: boolean }
  | { kind: "error"; message: string };

export type AnswerAttempt =
  | { status: "pending"; optionId: string }
  | { status: "settled"; optionId: string; outcome: AttemptOutcome };
