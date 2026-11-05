const mongoose = require("mongoose");

const Mystery = require("../models/Mystery");

const {
  toPublicCase,
} = require("../services/caseResponse");

function validCaseId(caseId) {
  return mongoose.isValidObjectId(caseId);
}

// GET /api/cases
// Return history belonging only to the signed-in user.
async function listCases(req, res) {
  try {
    const rawLimit = Number.parseInt(req.query.limit, 10);

    const limit =
      Number.isInteger(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, 200)
        : 100;

    const records = await Mystery.find({
      userId: req.user.userId,
    })
      .select(
        "_id title customTitle difficulty status score createdAt updatedAt completedAt progress clues hints"
      )
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    const cases = records.map((item) => ({
      caseId: String(item._id),
      title: item.title,
      customTitle: item.customTitle || null,
      displayTitle: item.customTitle || item.title,
      difficulty: item.difficulty,
      status: item.status,
      score: item.score || 0,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      completedAt: item.completedAt || null,
      clueCount: item.clues?.length || 0,
      discoveredClueCount:
        item.progress?.discoveredClueIds?.length || 0,
      hintCount: item.hints?.length || 0,
      usedHintCount:
        item.progress?.usedHintIds?.length || 0,
    }));

    return res.status(200).json({
      success: true,
      cases,
    });
  } catch (error) {
    console.error("Case history listing failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load case history.",
      code: "CASE_HISTORY_FAILED",
    });
  }
}

// PATCH /api/cases/:caseId/rename
async function renameCase(req, res) {
  const { caseId } = req.params;
  const rawTitle = req.body?.customTitle;

  if (!validCaseId(caseId)) {
    return res.status(400).json({
      success: false,
      message: "The supplied case ID is invalid.",
      code: "INVALID_CASE_ID",
    });
  }

  if (
    typeof rawTitle !== "string" ||
    rawTitle.trim().length > 80
  ) {
    return res.status(400).json({
      success: false,
      message: "A sidebar title of up to 80 characters is required.",
      code: "INVALID_CUSTOM_TITLE",
    });
  }

  const customTitle = rawTitle.trim() || null;

  try {
    const mystery = await Mystery.findOneAndUpdate(
      {
        _id: caseId,
        userId: req.user.userId,
      },
      {
        $set: { customTitle },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!mystery) {
      return res.status(404).json({
        success: false,
        message: "Mystery case not found.",
        code: "CASE_NOT_FOUND",
      });
    }

    return res.status(200).json({
      success: true,
      message: customTitle
        ? "Investigation renamed."
        : "Original title restored.",
      case: toPublicCase(mystery),
    });
  } catch (error) {
    console.error("Case rename failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to rename this investigation.",
      code: "CASE_RENAME_FAILED",
    });
  }
}

// DELETE /api/cases/:caseId
async function deleteCase(req, res) {
  const { caseId } = req.params;

  if (!validCaseId(caseId)) {
    return res.status(400).json({
      success: false,
      message: "The supplied case ID is invalid.",
      code: "INVALID_CASE_ID",
    });
  }

  try {
    const deleted = await Mystery.findOneAndDelete({
      _id: caseId,
      userId: req.user.userId,
    }).select("_id");

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Mystery case not found.",
        code: "CASE_NOT_FOUND",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Investigation permanently deleted.",
      caseId: String(deleted._id),
    });
  } catch (error) {
    console.error("Case deletion failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to delete this investigation.",
      code: "CASE_DELETE_FAILED",
    });
  }
}

module.exports = {
  listCases,
  renameCase,
  deleteCase,
};