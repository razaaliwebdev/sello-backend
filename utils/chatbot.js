/**
 * Chatbot Response Generator (DISABLED)
 * All automated responses have been disabled per user request.
 * All functions now return null or false to prevent any bot interaction.
 */

/**
 * Generate chatbot response
 * @param {string} userMessage - User's message
 * @param {string} chatId - Chat ID for context
 * @returns {Promise<string|null>} - Always returns null to escalation to human
 */
export const generateChatbotResponse = async (userMessage, chatId) => {
    return null; // Always escalate to human
};

/**
 * Check if message should be handled by chatbot
 * @returns {boolean}
 */
export const shouldUseChatbot = (message) => {
    return false; // Chatbot disabled
};
