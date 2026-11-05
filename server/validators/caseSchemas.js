
const { z } = require('zod')

// Allowed difficulty levels and their game requirements.
const expectedCounts = {
  Easy: {
    suspects: 3,
    clues: 5,
    hints: 2,
    correctScore: 100,
  },

  Medium: {
    suspects: 4,
    clues: 7,
    hints: 3,
    correctScore: 150,
  },

  Hard: {
    suspects: 5,
    clues: 9,
    hints: 3,
    correctScore: 200,
  },
}

// Validate what the player submits.
const caseCreationRequestSchema = z.object({
  premise: z.string().trim().min(20).max(600),

  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
}).strict()

// Validate individual suspects.
const suspectSchema = z.object({
  suspectId: z.string().trim().min(2).max(12),

  name: z.string().trim().min(2).max(60),

  role: z.string().trim().min(2).max(80),

  description: z.string().trim().min(20).max(500),

  motive: z.string().trim().min(10).max(350),

  alibi: z.string().trim().min(10).max(350),
}).strict()

// Validate individual clues.
const clueSchema = z.object({
  clueId: z.string().trim().min(2).max(12),

  title: z.string().trim().min(3).max(100),

  description: z.string().trim().min(20).max(500),

  location: z.string().trim().min(2).max(100),

  category: z.enum([
    'Physical',
    'Testimonial',
    'Digital',
    'Documentary',
  ]),
}).strict()

// Validate individual hints.
const hintSchema = z.object({
  hintId: z.string().trim().min(2).max(12),

  text: z.string().trim().min(10).max(250),
}).strict()

// Validate the private solution.
const solutionSchema = z.object({
  culpritSuspectId: z.string().trim().min(2).max(12),

  explanation: z.string().trim().min(40).max(1000),

  reasoning: z.string().trim().min(40).max(1500),

  supportingClueIds: z.array(
    z.string().trim().min(2).max(12),
  ).min(2).max(4),
}).strict()

// Overall structure returned by Gemini.
const generatedMysterySchema = z.object({
  title: z.string().trim().min(5).max(100),

  story: z.string().trim().min(80).max(2500),

  suspects: z.array(suspectSchema).min(3).max(5),

  clues: z.array(clueSchema).min(5).max(9),

  hints: z.array(hintSchema).min(2).max(3),

  solution: solutionSchema,
}).strict()

// Helper to ensure IDs are unique within each collection.
function ensureUniqueIds(items, fieldName, collectionName) {
  const ids = items.map((item) => item[fieldName])

  if (new Set(ids).size !== ids.length) {
    throw new Error(
      `Generated mystery contains duplicate IDs in ${collectionName}.`,
    )
  }
}

// Validate the complete generated mystery.
function validateGeneratedMystery(data, difficulty) {
  // First validate its individual field types and constraints.
  const mystery = generatedMysterySchema.parse(data)

  const requirements = expectedCounts[difficulty]

  if (!requirements) {
    throw new Error('Invalid mystery difficulty.')
  }

  // Check difficulty-specific counts.
  if (
    mystery.suspects.length !== requirements.suspects ||
    mystery.clues.length !== requirements.clues ||
    mystery.hints.length !== requirements.hints
  ) {
    throw new Error(
      `Invalid ${difficulty} case counts. Expected ` +
      `${requirements.suspects} suspects, ` +
      `${requirements.clues} clues, and ` +
      `${requirements.hints} hints.`,
    )
  }

  // Ensure IDs are unique.
  ensureUniqueIds(mystery.suspects, 'suspectId', 'suspects')
  ensureUniqueIds(mystery.clues, 'clueId', 'clues')
  ensureUniqueIds(mystery.hints, 'hintId', 'hints')

  // Verify that the culprit is one of the generated suspects.
  const suspectIds = new Set(
    mystery.suspects.map((suspect) => suspect.suspectId),
  )

  if (!suspectIds.has(mystery.solution.culpritSuspectId)) {
    throw new Error(
      'The solution references a suspect who does not exist.',
    )
  }

  // Verify that the supporting clues actually exist.
  const clueIds = new Set(
    mystery.clues.map((clue) => clue.clueId),
  )

  const supportingClueIds = mystery.solution.supportingClueIds

  if (new Set(supportingClueIds).size !== supportingClueIds.length) {
    throw new Error('The solution contains duplicate supporting clue IDs.')
  }

  if (!supportingClueIds.every((id) => clueIds.has(id))) {
    throw new Error(
      'The solution references one or more clues that do not exist.',
    )
  }

  return mystery
}

module.exports = {
  expectedCounts,
  caseCreationRequestSchema,
  generatedMysterySchema,
  validateGeneratedMystery,
}
