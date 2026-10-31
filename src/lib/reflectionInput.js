// Ask for context rather than inventing a study state from a greeting or typo.
export function reflectionInputError(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const greetings = /^(hello|hi|hey|helo|hallo|good morning|good afternoon|good evening|thank you|thanks|ty|salamat|kumusta|kamusta|hello there|hi there)[!.?\s]*$/i;
  const mood = /^(stressed|stress|tired|exhausted|anxious|overwhelmed|distracted|motivated|engaged|ready|excited|sad|happy|pagod|antok|inaantok|kinakabahan|malungkot|masaya|bored|nervous|burnout)$/i;
  if (mood.test(text)) return '';
  if (greetings.test(text) || text.length < 10 || words.length < 2 || /^(.)\1+$/u.test(words.join('')) || /^(asdf|qwerty|zxcv|asdasd|hjkl)/i.test(text)) {
    return 'Tell us a little about how you feel or what you want to study, for example: “I feel tired and need to review biology.”';
  }
  return '';
}
