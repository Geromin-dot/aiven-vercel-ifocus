export const DEFAULT_BREAK_GATE_QUESTIONS = 5;

export function normalizeBreakGateQuestionCount(value) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count > 0 ? count : DEFAULT_BREAK_GATE_QUESTIONS;
}
