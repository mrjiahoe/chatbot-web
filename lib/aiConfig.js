export const AI_CONFIG_STORAGE_KEY = 'aiConfig';
export const DEFAULT_GEMINI_MODEL =
    process.env.NEXT_PUBLIC_AI_MODEL_NAME || 'gemini-3-flash-preview';
export const DEFAULT_LOCAL_LLM_BASE_URL = 'http://127.0.0.1:11434/v1';
export const DEFAULT_LOCAL_LLM_MODEL = 'llama3.2';

export function normalizeLocalBaseUrl(value) {
    const trimmed = String(value || '').trim();

    if (!trimmed) {
        return DEFAULT_LOCAL_LLM_BASE_URL;
    }

    const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
        ? trimmed
        : `http://${trimmed}`;
    const withoutTrailingSlash = withProtocol.replace(/\/+$/, '');
    return withoutTrailingSlash.endsWith('/v1')
        ? withoutTrailingSlash
        : `${withoutTrailingSlash}/v1`;
}

export function isLoopbackBaseUrl(value) {
    try {
        const parsed = new URL(normalizeLocalBaseUrl(value));
        return ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname.toLowerCase());
    } catch {
        return false;
    }
}

export function normalizeAiConfig(value = {}) {
    const provider = value?.provider === 'local' ? 'local' : 'gemini';
    const geminiModel = String(value?.geminiModel || '').trim() || DEFAULT_GEMINI_MODEL;
    const localBaseUrl = normalizeLocalBaseUrl(value?.localBaseUrl);
    const localModel = String(value?.localModel || '').trim() || DEFAULT_LOCAL_LLM_MODEL;

    return {
        provider,
        geminiModel,
        localBaseUrl,
        localModel,
    };
}
