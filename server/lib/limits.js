const rateLimit = require('express-rate-limit');

function limiter(minutes, limit, message) {
  return rateLimit({
    windowMs: minutes * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
  });
}

module.exports = {
  // Login and sign-up: stops password guessing.
  authLimiter: limiter(15, 20, 'Too many attempts. Please try again in a few minutes.'),
  // Creating orders: stops people holding tickets without paying.
  orderLimiter: limiter(10, 20, 'Too many orders. Please wait a few minutes.'),
  // Price quotes run on every click of + and -, so the limit is higher.
  quoteLimiter: limiter(10, 300, 'Too many requests. Please slow down.'),
  // The payment-return page checks every 2 seconds.
  verifyLimiter: limiter(5, 60, 'Too many requests. Please slow down.'),
  // Door staff may share one network address, so this is generous.
  scanLimiter: limiter(1, 300, 'Scanning too fast. Please wait a moment.'),
};