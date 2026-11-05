
const express = require("express");

const requireAuth = require("../middleware/requireAuth");

const {
  caseGenerationLimiter,
} = require("../middleware/rateLimiters");

const {
  createCase,
  getCase,
  discoverClue,
  useHint,
  submitAccusation,
} = require("../controllers/caseController");

const {
  listCases,
  renameCase,
  deleteCase,
} = require("../controllers/historyController");

const router = express.Router();

// All case operations require authentication.
router.use(requireAuth);

// Case history.
router.get("/", listCases);

// New AI-generated cases have an additional rate limit.
router.post("/", caseGenerationLimiter, createCase);

// Rename and permanently delete owned cases.
router.patch("/:caseId/rename", renameCase);
router.delete("/:caseId", deleteCase);

// Retrieve an owned investigation.
router.get("/:caseId", getCase);

// Discover evidence.
router.post(
  "/:caseId/clues/:clueId/discover",
  discoverClue
);

// Reveal the next available hint.
router.post(
  "/:caseId/hints/use",
  useHint
);

// Submit the final accusation.
router.post(
  "/:caseId/accusation",
  submitAccusation
);

module.exports = router;
