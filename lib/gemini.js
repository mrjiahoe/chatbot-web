import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Legacy Gemini helper kept for backward compatibility.
// The current hybrid chat pipeline primarily uses `lib/aiService.js`, while
// this file remains useful for simpler direct-response helpers.
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

export const model = genAI.getGenerativeModel({
    model: process.env.NEXT_PUBLIC_AI_MODEL_NAME || "gemini-3-flash-preview",
});

/**
 * Sends a message to the Gemini model and returns the response text.
 * @param {string} prompt - The user's input.
 * @param {Array} history - Optional conversation history.
 * @returns {Promise<string>} - The model's response.
 */
export async function sendMessage(prompt, history = []) {
    const chat = model.startChat({
        history: history,
    });

    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    return response.text();
}

/**
 * Sends a message to the Gemini model and returns a stream.
 * @param {string} prompt - The user's input.
 * @param {Array} history - Optional conversation history.
 * @returns {Promise<AsyncGenerator<string>>} - The model's response stream.
 */
export async function sendMessageStream(prompt, history = []) {
    const chat = model.startChat({
        history: history,
    });

    const result = await chat.sendMessageStream(prompt);
    return result.stream;
}
/**
 * Generates a short, descriptive title for a conversation based on the first message.
 * @param {string} firstMessage - The user's first message.
 * @returns {Promise<string>} - A short title (3-5 words).
 */
export async function generateTitle(firstMessage) {
    const prompt = `Generate a very short, concise title (max 5 words) for a chat conversation that begins with this message: "${firstMessage}". Respond with ONLY the title text, no quotes or punctuation.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
}
