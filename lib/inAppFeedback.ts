/**
 * The feedback form on every page: what it checks before sending and what it sends.
 *
 * Pure, so the form and its tests agree. The checks here are only fast feedback for the person
 * typing; emailservice makes the same checks and is the one that decides.
 */

/** emailservice's own limit (InAppFeedbackService.MAX_MESSAGE). */
export const MAX_MESSAGE = 5000;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

export interface FeedbackDraft {
  contactEmail: string;
  message: string;
}

export type FeedbackProblem = 'emailError' | 'messageError' | 'messageTooLong';

export function validateFeedback(draft: FeedbackDraft): Partial<Record<keyof FeedbackDraft, FeedbackProblem>> {
  const problems: Partial<Record<keyof FeedbackDraft, FeedbackProblem>> = {};
  if (!EMAIL.test(draft.contactEmail.trim())) problems.contactEmail = 'emailError';
  const message = draft.message.trim();
  if (!message) problems.message = 'messageError';
  else if (message.length > MAX_MESSAGE) problems.message = 'messageTooLong';
  return problems;
}

/**
 * The body for POST /api/in-app-feedback. No recipient (emailservice fixes it) and no account:
 * the server looks up who is signed in itself, so the browser cannot claim to be anyone.
 */
export function buildFeedbackPayload(draft: FeedbackDraft, pageUrl: string) {
  return {
    contactEmail: draft.contactEmail.trim(),
    message: draft.message.trim(),
    pageUrl,
  };
}
