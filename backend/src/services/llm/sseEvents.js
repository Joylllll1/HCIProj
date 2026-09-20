/**
 * SSE event format helpers for LLM Assistant streaming.
 *
 * Each function returns a Server-Sent Events formatted string:
 *   data: {JSON}\n\n
 */

/**
 * Signal the start of a streaming response with the session ID.
 * @param {string} sessionId
 * @returns {string}
 */
export function sseStart(sessionId) {
  return `data: ${JSON.stringify({ type: 'start', sessionId })}\n\n`;
}

/**
 * Notify the client that a tool is being invoked.
 * @param {string} tool
 * @param {object} args
 * @returns {string}
 */
export function sseToolCall(tool, args) {
  return `data: ${JSON.stringify({ type: 'tool_call', tool, args })}\n\n`;
}

/**
 * Notify the client that a tool has completed.
 * @param {string} tool
 * @returns {string}
 */
export function sseToolResult(tool) {
  return `data: ${JSON.stringify({ type: 'tool_result', tool })}\n\n`;
}

/**
 * Emit a single content token (text chunk).
 * @param {string} content
 * @returns {string}
 */
export function sseToken(content) {
  return `data: ${JSON.stringify({ type: 'token', content })}\n\n`;
}

/**
 * Signal that the stream has finished successfully.
 * @returns {string}
 */
export function sseDone() {
  return `data: ${JSON.stringify({ type: 'done' })}\n\n`;
}

/**
 * Signal that an error occurred.
 * @param {string} message
 * @returns {string}
 */
export function sseError(message) {
  return `data: ${JSON.stringify({ type: 'error', message })}\n\n`;
}
