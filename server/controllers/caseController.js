const mongoose = require("mongoose");

const Mystery = require("../models/Mystery");

const {
  caseCreationRequestSchema,
  expectedCounts,
} = require("../validators/caseSchemas");

const {
  generateMystery,
} = require("../services/mysteryGenerator");

const {
  toPublicCase,
} = require("../services/caseResponse");

// Validate MongoDB case IDs before querying.
function isValidCaseId(caseId) {
  return mongoose.isValidObjectId(caseId);
}

// Make sure the case is still available for investigation.
function isActiveCase(mystery, res) {
  if (mystery.status === "completed") {
    res.status(409).json({
      success: false,
      message: "This investigation has already been completed.",
      code: "CASE_ALREADY_COMPLETED",
    });

    return false;
  }

  return true;
}

// Build the result that may be revealed only after an accusation.
function toCompletedResult(mystery) {
  const culprit = mystery.suspects.find(
    (suspect) =>
      suspect.suspectId === mystery.solution.culpritSuspectId
  );

  return {
    isCorrect: mystery.progress.accusation.isCorrect,
    culpritSuspectId: mystery.solution.culpritSuspectId,
    culpritName: culprit?.name || "Unknown",
    explanation: mystery.solution.explanation,
    reasoning: mystery.solution.reasoning,
    supportingClueIds: mystery.solution.supportingClueIds,
    score: mystery.score,
    submittedAt: mystery.progress.accusation.submittedAt,
  };
}

// POST /api/cases
async function createCase(req, res) {
  const validation = caseCreationRequestSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid mystery premise and difficulty.",
      errors: validation.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const { premise, difficulty } = validation.data;

  let generatedMystery;

  try {
    generatedMystery = await generateMystery(
      premise,
      difficulty
    );
  } catch (error) {
    console.error("Mystery generation failed:", error.message);

    return res.status(502).json({
      success: false,
      message:
        "We could not generate a valid mystery. Please try again.",
      code: "MYSTERY_GENERATION_FAILED",
    });
  }

  try {
    const savedMystery = await Mystery.create({
      ...generatedMystery,
      premise,
      difficulty,
      userId: req.user.userId,
    });

    return res.status(201).json({
      success: true,
      message: "Your mystery has been created successfully!",
      case: toPublicCase(savedMystery),
    });
  } catch (error) {
    console.error(
      "Mystery database save failed:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "The mystery was generated but could not be saved. Please try again.",
      code: "CASE_SAVE_FAILED",
    });
  }
}

// GET /api/cases/:caseId
async function getCase(req, res) {
  const { caseId } = req.params;

  if (!isValidCaseId(caseId)) {
    return res.status(400).json({
      success: false,
      message: "The supplied case ID is invalid.",
      code: "INVALID_CASE_ID",
    });
  }

  try {
    // Only retrieve a case belonging to the signed-in user.
    let mystery = await Mystery.findOne({
      _id: caseId,
      userId: req.user.userId,
    });

    if (!mystery) {
      return res.status(404).json({
        success: false,
        message: "Mystery case not found.",
        code: "CASE_NOT_FOUND",
      });
    }

    const response = {
      success: true,
      case: toPublicCase(mystery),
    };

    // Reveal the private solution only for completed cases.
    if (mystery.status === "completed") {
      mystery = await Mystery.findOne({
        _id: caseId,
        userId: req.user.userId,
      }).select("+solution");

      response.result = toCompletedResult(mystery);
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("Case retrieval failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve this mystery.",
      code: "CASE_RETRIEVAL_FAILED",
    });
  }
}

// POST /api/cases/:caseId/clues/:clueId/discover
async function discoverClue(req, res) {
  const { caseId, clueId } = req.params;

  if (!isValidCaseId(caseId)) {
    return res.status(400).json({
      success: false,
      message: "The supplied case ID is invalid.",
      code: "INVALID_CASE_ID",
    });
  }

  if (!clueId || !clueId.trim()) {
    return res.status(400).json({
      success: false,
      message: "A valid clue ID is required.",
      code: "INVALID_CLUE_ID",
    });
  }

  try {
    const mystery = await Mystery.findOne({
      _id: caseId,
      userId: req.user.userId,
    });

    if (!mystery) {
      return res.status(404).json({
        success: false,
        message: "Mystery case not found.",
        code: "CASE_NOT_FOUND",
      });
    }

    if (!isActiveCase(mystery, res)) {
      return;
    }

    const clue = mystery.clues.find(
      (item) => item.clueId === clueId
    );

    if (!clue) {
      return res.status(404).json({
        success: false,
        message: "This clue does not exist in the mystery.",
        code: "CLUE_NOT_FOUND",
      });
    }

    const alreadyDiscovered =
      mystery.progress.discoveredClueIds.includes(clueId);

    if (!alreadyDiscovered) {
      mystery.progress.discoveredClueIds.push(clueId);
      await mystery.save();
    }

    return res.status(200).json({
      success: true,
      message: alreadyDiscovered
        ? "You have already discovered this clue."
        : "Clue discovered successfully!",
      clue: {
        clueId: clue.clueId,
        title: clue.title,
        location: clue.location,
        category: clue.category,
        description: clue.description,
      },
      case: toPublicCase(mystery),
    });
  } catch (error) {
    console.error("Clue discovery failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to discover this clue.",
      code: "CLUE_DISCOVERY_FAILED",
    });
  }
}

// POST /api/cases/:caseId/hints/use
async function useHint(req, res) {
  const { caseId } = req.params;

  if (!isValidCaseId(caseId)) {
    return res.status(400).json({
      success: false,
      message: "The supplied case ID is invalid.",
      code: "INVALID_CASE_ID",
    });
  }

  try {
    const mystery = await Mystery.findOne({
      _id: caseId,
      userId: req.user.userId,
    });

    if (!mystery) {
      return res.status(404).json({
        success: false,
        message: "Mystery case not found.",
        code: "CASE_NOT_FOUND",
      });
    }

    if (!isActiveCase(mystery, res)) {
      return;
    }

    // Always provide the first hint that hasn't been used.
    const nextHint = mystery.hints.find(
      (hint) =>
        !mystery.progress.usedHintIds.includes(hint.hintId)
    );

    if (!nextHint) {
      return res.status(409).json({
        success: false,
        message: "You have used all available hints.",
        code: "NO_HINTS_REMAINING",
      });
    }

    mystery.progress.usedHintIds.push(nextHint.hintId);

    await mystery.save();

    return res.status(200).json({
      success: true,
      message: "A new hint has been revealed.",
      hint: {
        hintId: nextHint.hintId,
        text: nextHint.text,
        hintsRemaining:
          mystery.hints.length -
          mystery.progress.usedHintIds.length,
      },
      case: toPublicCase(mystery),
    });
  } catch (error) {
    console.error("Hint request failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve a hint.",
      code: "HINT_REQUEST_FAILED",
    });
  }
}

// POST /api/cases/:caseId/accusation
async function submitAccusation(req, res) {
  const { caseId } = req.params;

  const suspectId =
    typeof req.body?.suspectId === "string"
      ? req.body.suspectId.trim()
      : "";

  if (!isValidCaseId(caseId)) {
    return res.status(400).json({
      success: false,
      message: "The supplied case ID is invalid.",
      code: "INVALID_CASE_ID",
    });
  }

  if (!suspectId || suspectId.length > 30) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid suspect ID.",
      code: "INVALID_SUSPECT_ID",
    });
  }

  try {
    // Load the private solution only for this case's owner.
    const mystery = await Mystery.findOne({
      _id: caseId,
      userId: req.user.userId,
    }).select("+solution");

    if (!mystery) {
      return res.status(404).json({
        success: false,
        message: "Mystery case not found.",
        code: "CASE_NOT_FOUND",
      });
    }

    if (!isActiveCase(mystery, res)) {
      return;
    }

    if (mystery.progress.accusation?.submittedAt) {
      return res.status(409).json({
        success: false,
        message: "A final accusation has already been submitted.",
        code: "ACCUSATION_ALREADY_SUBMITTED",
      });
    }

    const suspectExists = mystery.suspects.some(
      (suspect) => suspect.suspectId === suspectId
    );

    if (!suspectExists) {
      return res.status(400).json({
        success: false,
        message: "The selected suspect does not exist.",
        code: "SUSPECT_NOT_FOUND",
      });
    }

    const isCorrect =
      suspectId === mystery.solution.culpritSuspectId;

    const baseScore =
      expectedCounts[mystery.difficulty]?.correctScore || 0;

    const submittedAt = new Date();

    mystery.progress.accusation = {
      suspectId,
      submittedAt,
      isCorrect,
    };

    // Correct accusation receives the full difficulty score.
    mystery.score = isCorrect ? baseScore : 0;

    mystery.status = "completed";
    mystery.completedAt = submittedAt;

    await mystery.save();

    return res.status(200).json({
      success: true,
      message: isCorrect
        ? "Correct accusation! You solved the mystery."
        : "Your accusation was incorrect. The investigation is complete.",
      case: toPublicCase(mystery),
      result: toCompletedResult(mystery),
    });
  } catch (error) {
    console.error("Accusation submission failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to submit your accusation.",
      code: "ACCUSATION_FAILED",
    });
  }
}

module.exports = {
  createCase,
  getCase,
  discoverClue,
  useHint,
  submitAccusation,
};