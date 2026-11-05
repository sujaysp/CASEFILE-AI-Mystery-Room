const express = require("express");

const {
  register,
  login,
  getCurrentUser,
} = require("../controllers/authController");
const { googleLogin } = require("../controllers/googleAuthController");
const requireAuth = require("../middleware/requireAuth");
const {
  registerLimiter,
  loginLimiter,
} = require("../middleware/rateLimiters");

const router = express.Router();

router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/google", loginLimiter, googleLogin);
router.get("/me", requireAuth, getCurrentUser);

module.exports = router;
