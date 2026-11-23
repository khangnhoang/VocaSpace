import type { HeldMessage, RequestReply } from "@/lib/i18n/held-message";
import type { Translate } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";
import type { TopicProgress } from "@/lib/schemas/learning-workspace";

/**
 * One answer submission, owned by the workspace instead of the response view.
 * A view unmounts when the learner leaves its question or stage, but the request
 * keeps running; keeping its state here means a returning view still sees it as
 * pending (no second submit) and picks up the result that lands later.
 */

/**
 * A server text held with the reply that carried it (U3 H4), so it can follow a language switch while shown. `reply.messageKey` is
 * null for an explanation the author wrote: it has no catalog key and always shows as written.
 */
export type ServerText = { text: string; reply: RequestReply };

/** The text to show: as written when authored or when the server used the displayed language, else the same message re-translated from its recorded key. */
export function serverTextFor(held: ServerText | undefined, locale: Locale, tRoot: Translate): string | undefined {
  if (!held) return undefined;
  const { text, reply } = held;
  if (reply.messageKey === null || reply.locale === locale) return text;
  return tRoot(reply.messageKey, reply.messageParams);
}

export type AttemptOutcome =
  | { kind: "correct"; explanation?: ServerText; progressError?: string; passed: boolean; topicProgress?: TopicProgress }
  | { kind: "incorrect"; explanation?: ServerText; progressError?: string; passed: boolean; topicProgress?: TopicProgress }
  | { kind: "error"; message: HeldMessage };

export type AnswerAttempt =
  | { status: "pending"; optionId: string }
  | { status: "settled"; optionId: string; outcome: AttemptOutcome };
