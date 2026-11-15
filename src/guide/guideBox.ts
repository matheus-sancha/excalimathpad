/**
 * The Math guide's box (docs/spec-v1.md section 8, Math guide, M4d). It is
 * drawn inside the box the canvas's gestures listen on, so they ask whether
 * an event came from it: a press, click or key inside it is never the canvas's
 * (`listenToCanvas`).
 */
export const MATH_GUIDE_CLASS = 'math-guide'

/** Whether an event's target is inside the Math guide. */
export function isInMathGuide(target: EventTarget | null): boolean {
  // A DOM element from any window: a pop-out window has its own `Element` (section 12a).
  return (target as Node | null)?.nodeType === 1 && (target as Element).closest(`.${MATH_GUIDE_CLASS}`) !== null
}
