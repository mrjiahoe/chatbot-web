/** Shared limits and user-facing copy for /api/chat validation (keep in sync with route). */

export const CHAT_MAX_MESSAGE_CHARS = 32_000;
export const CHAT_MAX_DATA_CONTEXT_CHARS = 200_000;
export const CHAT_MAX_HISTORY_MESSAGES = 40;

export const CHAT_MESSAGE_TOO_LONG = `Message is too long (maximum ${CHAT_MAX_MESSAGE_CHARS.toLocaleString('en-US')} characters). Try shortening your text or splitting it into smaller messages.`;

export const CHAT_DATA_CONTEXT_TOO_LONG = `Attached data context is too large (maximum ${CHAT_MAX_DATA_CONTEXT_CHARS.toLocaleString('en-US')} characters). Remove some table selections or start a new chat.`;

export const CHAT_HISTORY_COUNT_TOO_HIGH = `This thread has too many messages to send at once (maximum ${CHAT_MAX_HISTORY_MESSAGES}). Start a new chat or the app will need to load a shorter history.`;

export const CHAT_HISTORY_MESSAGE_TOO_LONG = `A previous message in this thread is too long (maximum ${CHAT_MAX_MESSAGE_CHARS.toLocaleString('en-US')} characters per message). Start a new chat to continue.`;

/**
 * @param {{ message: string; dataContext: string; historyMessages: Array<{ text?: string }> }} opts
 * @returns {string | null} Error message for the user, or null if OK.
 */
export function getChatClientValidationError({ message, dataContext, historyMessages }) {
    if (message.length > CHAT_MAX_MESSAGE_CHARS) {
        return CHAT_MESSAGE_TOO_LONG;
    }
    if (dataContext.length > CHAT_MAX_DATA_CONTEXT_CHARS) {
        return CHAT_DATA_CONTEXT_TOO_LONG;
    }
    if (historyMessages.length > CHAT_MAX_HISTORY_MESSAGES) {
        return CHAT_HISTORY_COUNT_TOO_HIGH;
    }
    if (historyMessages.some((m) => (m.text ?? '').length > CHAT_MAX_MESSAGE_CHARS)) {
        return CHAT_HISTORY_MESSAGE_TOO_LONG;
    }
    return null;
}
