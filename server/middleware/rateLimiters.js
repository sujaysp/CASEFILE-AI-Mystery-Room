
const { rateLimit } = require("express-rate-limit");

const standardOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
  },
};

// Registration: maximum 5 attempts per IP per hour.
const registerLimiter = rateLimit({
  ...standardOptions,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: {
    success: false,
    message: "Too many registration attempts. Please try again in an hour.",
    code: "REGISTRATION_RATE_LIMITED",
  },
});

// Login: maximum 10 attempts per IP per 15 minutes.
const loginLimiter = rateLimit({
  ...standardOptions,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: {
    success: false,
    message: "Too many login attempts. Please wait 15 minutes.",
    code: "LOGIN_RATE_LIMITED",
  },
});

// AI case generation: maximum 10 attempts per IP per hour.
const caseGenerationLimiter = rateLimit({
  ...standardOptions,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: {
    success: false,
    message: "You have reached the case-generation limit. Please try again later.",
    code: "CASE_GENERATION_RATE_LIMITED",
  },
});

module.exports = {
  registerLimiter,
  loginLimiter,
  caseGenerationLimiter,
};
