
const path = require('node:path')

require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
})

const { generateMystery } = require('../services/mysteryGenerator')

async function testGeminiGeneration() {
  try {
    const premise =
      'A rare brass compass disappears from a locked lighthouse during a storm. ' +
      'Three people were inside, and each gives a different account of the night.'

    console.log('Generating an Easy mystery using Gemini...\n')

    const mystery = await generateMystery(premise, 'Easy')

    // Display only public information.
    // Never print the private solution in this test.
    console.log('Mystery generated successfully!\n')

    console.log('Title:', mystery.title)
    console.log('Story:', mystery.story)
    console.log('Suspects:', mystery.suspects.length)
    console.log('Clues:', mystery.clues.length)
    console.log('Hints:', mystery.hints.length)

    console.log('\nSuspect names:')

    mystery.suspects.forEach((suspect) => {
      console.log('-', suspect.name)
    })

    console.log('\nClue titles:')

    mystery.clues.forEach((clue) => {
      console.log('-', clue.title)
    })

    console.log('\nGemini generation and Zod validation passed!')
  } catch (error) {
    console.error('\nGemini generation test failed:')
    console.error(error.message)
    process.exitCode = 1
  }
}

testGeminiGeneration()
