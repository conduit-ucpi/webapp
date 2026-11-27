/**
 * Opening the site's "Send us feedback" screen from anywhere, including code that cannot import
 * it: the screen belongs to the site's floating button (components/feedback/FeedbackButton),
 * which is not part of this package, so a page a partner builds with it has no such screen.
 *
 * The button marks the page when it is there (`listenForFeedbackRequests`), and only then does
 * anything offer to open it (`feedbackScreenIsHere`).
 */
const OPEN_EVENT = 'stabledrop:open-feedback';
const HERE = 'feedbackScreen';

/** Whether this page has the feedback screen to open. */
export function feedbackScreenIsHere(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset[HERE] === 'here';
}

/** Opens the feedback screen, starting its message with `message` if nothing is written there yet. */
export function openFeedbackScreen(message?: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { message } }));
}

/** For the feedback screen itself: says it is here, and is told when to open. Returns the undo. */
export function listenForFeedbackRequests(open: (message?: string) => void): () => void {
  const onOpen = (event: Event) => {
    const message = (event as CustomEvent<{ message?: unknown }>).detail?.message;
    open(typeof message === 'string' ? message : undefined);
  };
  window.addEventListener(OPEN_EVENT, onOpen);
  document.documentElement.dataset[HERE] = 'here';
  return () => {
    window.removeEventListener(OPEN_EVENT, onOpen);
    delete document.documentElement.dataset[HERE];
  };
}
