/**
 * Helper to wrap async Express route handlers and forward errors to the error middleware.
 * Usage: app.get('/path', asyncHandler(async (req, res) => { ... }));
 */
module.exports = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
