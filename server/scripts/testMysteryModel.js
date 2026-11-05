
const mongoose = require('mongoose')
const path = require('node:path')
const assert = require('node:assert/strict')

require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
})

const Mystery = require('../models/Mystery')

async function testMysteryModel() {
  let testMysteryId

  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing from server/.env')
    }

    // 1. Connect to MongoDB.
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'casefile',
      serverSelectionTimeoutMS: 10000,
    })

    console.log('1. MongoDB connection successful!')

    // 2. Create a temporary test mystery.
    const testMystery = await Mystery.create({
      title: 'The Vanishing Pocket Watch',
      premise: 'A valuable pocket watch disappears from a locked study.',
      story:
        'During a private gathering, a valuable pocket watch vanishes. Three guests were inside the mansion, and each has a different account of the evening.',

      difficulty: 'Easy',

      suspects: [
        {
          suspectId: 'S1',
          name: 'Arthur',
          role: 'Butler',
          description: 'The caretaker of the mansion.',
          motive: 'He wanted to repay an old debt.',
          alibi: 'Claims he was preparing tea.',
        },
        {
          suspectId: 'S2',
          name: 'Clara',
          role: 'Guest',
          description: 'A close friend of the owner.',
          motive: 'She wanted to recover a family heirloom.',
          alibi: 'Claims she was reading in the library.',
        },
        {
          suspectId: 'S3',
          name: 'Edward',
          role: 'Collector',
          description: 'A visitor interested in antique watches.',
          motive: 'He wanted the watch for his collection.',
          alibi: 'Claims he was waiting near the entrance.',
        },
      ],

      clues: [
        {
          clueId: 'C1',
          title: 'The Open Drawer',
          description: 'The watch drawer was found slightly open.',
          location: 'Study',
          category: 'Physical',
        },
        {
          clueId: 'C2',
          title: 'The Tea Receipt',
          description: 'A receipt records tea being ordered late.',
          location: 'Kitchen',
          category: 'Documentary',
        },
        {
          clueId: 'C3',
          title: 'The Dust Mark',
          description: 'An empty circular mark remains on the shelf.',
          location: 'Study',
          category: 'Physical',
        },
        {
          clueId: 'C4',
          title: 'The Guest Statement',
          description: 'One guest recalls hearing footsteps.',
          location: 'Hallway',
          category: 'Testimonial',
        },
        {
          clueId: 'C5',
          title: 'The Visitor Log',
          description: 'The visitor log records the guests arrival times.',
          location: 'Entrance',
          category: 'Documentary',
        },
      ],

      hints: [
        {
          hintId: 'H1',
          text: 'Compare the suspects accounts of their whereabouts.',
        },
        {
          hintId: 'H2',
          text: 'Pay attention to the timing of the tea order.',
        },
      ],

      solution: {
        culpritSuspectId: 'S2',
        explanation: 'This is a temporary testing solution.',
        reasoning: 'The solution is included only to test protected storage.',
        supportingClueIds: ['C1', 'C3'],
      },
    })

    testMysteryId = testMystery._id

    console.log('2. Temporary mystery saved successfully!')

    // 3. Retrieve ordinary case information.
    const publicMystery = await Mystery.findById(testMysteryId).lean()

    assert.ok(publicMystery, 'The mystery should be retrievable.')
    assert.equal(
      publicMystery.solution,
      undefined,
      'The private solution must not appear in an ordinary query.',
    )

    console.log('3. Public mystery retrieved successfully!')
    console.log('4. Private solution was excluded from the query!')

    // 4. Verify that the solution is actually stored.
    const privateMystery = await Mystery.findById(testMysteryId)
      .select('+solution')
      .lean()

    assert.ok(privateMystery?.solution, 'The solution should be stored.')
    assert.ok(
      privateMystery.solution.culpritSuspectId,
      'The stored solution should contain a culprit ID.',
    )

    console.log('5. Protected solution exists in the database!')

    // 5. Remove the temporary test record.
    await Mystery.findByIdAndDelete(testMysteryId)
    testMysteryId = null

    console.log('6. Temporary test mystery deleted successfully!')
    console.log('\nAll database model tests passed!')
  } catch (error) {
    console.error('\nDatabase model test failed:')
    console.error(error.message)
    process.exitCode = 1
  } finally {
    // Clean up the test record even if an assertion fails.
    if (testMysteryId) {
      await Mystery.findByIdAndDelete(testMysteryId).catch(() => {})
    }

    await mongoose.disconnect()
  }
}

testMysteryModel()
