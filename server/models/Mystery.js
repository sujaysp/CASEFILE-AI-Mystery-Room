const mongoose = require("mongoose");

// Information about each suspect.
const suspectSchema = new mongoose.Schema(
  {
    suspectId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true },
    description: { type: String, required: true },
    motive: { type: String, required: true },
    alibi: { type: String, required: true },
  },
  { _id: false }
);

// Information about each clue.
const clueSchema = new mongoose.Schema(
  {
    clueId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    location: { type: String, required: true },
    category: {
      type: String,
      enum: ["Physical", "Testimonial", "Digital", "Documentary"],
      required: true,
    },
  },
  { _id: false }
);

// Information about investigation hints.
const hintSchema = new mongoose.Schema(
  {
    hintId: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

// Private solution. Ordinary queries must never return this field.
const solutionSchema = new mongoose.Schema(
  {
    culpritSuspectId: { type: String, required: true },
    explanation: { type: String, required: true },
    reasoning: { type: String, required: true },
    supportingClueIds: { type: [String], required: true },
  },
  { _id: false }
);

// Tracks the player's investigation progress.
const progressSchema = new mongoose.Schema(
  {
    discoveredClueIds: { type: [String], default: [] },
    usedHintIds: { type: [String], default: [] },
    accusation: {
      suspectId: { type: String, default: null },
      submittedAt: { type: Date, default: null },
      isCorrect: { type: Boolean, default: null },
    },
  },
  { _id: false }
);

// Main Mystery document.
const mysterySchema = new mongoose.Schema(
  {
    // Cases belong to a registered user.
    // Optional for migration of older cases on first registration.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    title: { type: String, required: true, trim: true },

    // Optional title chosen by the player for the sidebar.
    // The AI-generated title remains unchanged.
    customTitle: {
      type: String,
      trim: true,
      maxlength: 80,
      default: null,
    },

    premise: { type: String, required: true },
    story: { type: String, required: true },

    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      required: true,
    },

    suspects: { type: [suspectSchema], required: true },
    clues: { type: [clueSchema], required: true },
    hints: { type: [hintSchema], required: true },

    // The private solution is excluded from normal queries.
    solution: {
      type: solutionSchema,
      required: true,
      select: false,
    },

    progress: {
      type: progressSchema,
      default: () => ({}),
    },

    score: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const Mystery = mongoose.model("Mystery", mysterySchema);

module.exports = Mystery;