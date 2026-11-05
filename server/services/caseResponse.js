function toPublicCase(mystery) {
  const discoveredIds = new Set(
    (mystery.progress?.discoveredClueIds || []).map(String)
  );

  const usedHintIds = new Set(
    (mystery.progress?.usedHintIds || []).map(String)
  );

  return {
    caseId: mystery._id.toString(),

    title: mystery.title,
    customTitle: mystery.customTitle || null,

    premise: mystery.premise,
    story: mystery.story,
    difficulty: mystery.difficulty,

    suspects: mystery.suspects.map((suspect) => ({
      suspectId: suspect.suspectId,
      name: suspect.name,
      role: suspect.role,
      description: suspect.description,
      motive: suspect.motive,
      alibi: suspect.alibi,
    })),

    // Clue descriptions remain hidden until discovered.
    clues: mystery.clues.map((clue) => {
      const discovered = discoveredIds.has(clue.clueId);

      return {
        clueId: clue.clueId,
        title: clue.title,
        location: clue.location,
        category: clue.category,
        discovered,

        ...(discovered
          ? { description: clue.description }
          : {}),
      };
    }),

    // Only previously revealed hints are returned.
    revealedHints: (mystery.hints || [])
      .filter((hint) =>
        usedHintIds.has(String(hint.hintId))
      )
      .map((hint) => ({
        hintId: hint.hintId,
        text: hint.text,
      })),

    hintProgress: {
      total: mystery.hints.length,
      used: mystery.progress?.usedHintIds?.length || 0,
      remaining:
        mystery.hints.length -
        (mystery.progress?.usedHintIds?.length || 0),
    },

    score: mystery.score,
    status: mystery.status,

    createdAt: mystery.createdAt,
    updatedAt: mystery.updatedAt,
    completedAt: mystery.completedAt || null,
  };
}

module.exports = { toPublicCase };