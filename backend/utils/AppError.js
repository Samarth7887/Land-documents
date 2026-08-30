/**
 * Custom error class used throughout the backend.
 * Carries an error code, a user‑friendly message, and a retryable flag.
 */
class AppError extends Error {
  /**
   * @param {string} code - one of the values from ErrorCodes.js
   * @param {string} message - human readable description for the client
   * @param {boolean} retryable - whether the client can safely retry the operation
   */
  constructor(code, message, retryable = false) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.retryable = retryable;
    // Capture stack trace (optional, will be logged server‑side only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

module.exports = AppError;
