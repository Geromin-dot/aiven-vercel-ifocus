function extractJsonPayload(text) {
  if (!text) return null;
  const clean = text.trim();
  try {
    return JSON.parse(clean);
  } catch (_) {}

  // Markdown code block match
  const codeBlockMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (_) {}
  }

  // Find outermost object { ... }
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(clean.substring(firstBrace, lastBrace + 1));
    } catch (_) {}
  }

  // Find outermost array [ ... ]
  const firstBracket = clean.indexOf('[');
  const lastBracket = clean.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(clean.substring(firstBracket, lastBracket + 1));
    } catch (_) {}
  }

  return null;
}

// Resilient Gemini AI client with multi-key rotation, model fallback, and automatic retry

const MODELS = [
  'gemini-2.5-flash',       // Primary: Ultra-fast (~1.2s), superior multimodal/PDF extraction & reasoning
  'gemini-3.5-flash-lite',  // Secondary: High-speed lite fallback
  'gemini-3.1-flash-lite'   // Tertiary fallback
];

// Simple in-memory cache to prevent redundant API calls for duplicate prompts/clicks
const requestCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function getCacheKey(model, payload) {
  return `${model}_${JSON.stringify(payload)}`;
}

function getFromCache(key) {
  const cached = requestCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  requestCache.delete(key);
  return null;
}

function setToCache(key, data) {
  if (requestCache.size > 200) {
    const oldestKey = requestCache.keys().next().value;
    requestCache.delete(oldestKey);
  }
  requestCache.set(key, { data, timestamp: Date.now() });
}

function getApiKeys() {
  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  const keys = raw.split(',').map(k => k.trim()).filter(Boolean);
  return keys.length > 0 ? keys : [];
}

export async function callGemini({ parts, generationConfig = {}, preferredModel = null, timeoutMs = 25000 }) {
  const keys = getApiKeys();
  if (keys.length === 0) {
    throw new Error('Gemini API key is not configured on server. Please check .env or .env.local.');
  }

  const modelQueue = preferredModel 
    ? [preferredModel, ...MODELS.filter(m => m !== preferredModel)]
    : [...MODELS];

  const payload = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.2,
      ...generationConfig
    }
  };

  let lastError = null;

  for (const model of modelQueue) {
    const cacheKey = getCacheKey(model, payload);
    const cachedResult = getFromCache(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
      const apiKey = keys[keyIndex];
      const maxRetries = 1;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            if (generationConfig.responseMimeType === 'application/json') {
              const parsed = extractJsonPayload(text);
              if (parsed !== null) {
                setToCache(cacheKey, parsed);
                return parsed;
              }
              // If JSON extraction failed on this output, proceed to fallback attempt
              console.warn(`[Gemini Warn] JSON parsing failed for model ${model}. Raw:`, text.slice(0, 150));
            } else {
              setToCache(cacheKey, text);
              return text;
            }

            setToCache(cacheKey, text);
            return text;
          }

          const status = response.status;
          const errorBody = await response.text();
          lastError = new Error(`Gemini [${model}] HTTP ${status}: ${errorBody}`);

          if (status === 503 || status === 429 || status === 500 || status === 502 || status === 504) {
            console.warn(`[Gemini Warn] ${model} returned ${status}. Attempt ${attempt + 1}/${maxRetries + 1}`);
            if (attempt < maxRetries) {
              const delay = (attempt + 1) * 600;
              await new Promise(r => setTimeout(r, delay));
              continue;
            }
            break;
          }

          if (status === 404) {
            break;
          }

          if (status === 400 || status === 401 || status === 403) {
            break;
          }

        } catch (err) {
          lastError = err;
          if (err.name === 'AbortError') {
            console.warn(`[Gemini Warn] Request to ${model} timed out after ${timeoutMs}ms.`);
          } else {
            console.warn(`[Gemini Error] Network issue on ${model}:`, err.message);
          }
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 600));
          }
        }
      }
    }
  }

  throw lastError || new Error('All Gemini models and API keys were exhausted. Please try again shortly.');
}
