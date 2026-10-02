import { describe, expect, test } from 'claude-code/testing'
import { newGame } from '../hooks/game.js'
import { PANE_MOUNT, runCommand, startSession, world } from './world.ts'

const BOARD = { columns: 42, rows: 14 }

async function openBoard($: any, on: any, stored: Record<string, unknown> = {}) {
  const w = world(on, stored)
  await startSession($)
  await runCommand($, '')
  const ui = await $.ui.mount(PANE_MOUNT)
  await ui.resize({ ...BOARD, in: 'board' })
  await ui.advance(25)
  return { ui, w }
}

async function shown(ui: any) {
  const texts = await ui.findAll({ type: 'Text', in: 'board' })
  return texts.map((t: any) => t.text).join('\n')
}

describe('board', () => {
  test('/snake opens the pane and the board starts paused', async ($, on) => {
    const { ui, w } = await openBoard($, on)
    expect(w.panes.opened).toEqual(['snake'])
    expect(await shown(ui)).toContain('Score 0')
    expect(await shown(ui)).toContain('Paused')
  })

  test('an arrow starts the game and the snake moves on the clock', async ($, on) => {
    const { ui } = await openBoard($, on)
    await ui.key({ key: 'down', in: 'board' })
    const before = await shown(ui)
    await ui.advance(130)
    expect(await shown(ui)).not.toContain('Paused')
    expect(await shown(ui)).not.toEqual(before)
  })

  test('the snake keeps its real speed, not rounded to the frame clock', async ($, on) => {
    const { ui } = await openBoard($, on)
    await ui.key({ key: 'right', in: 'board' })
    await ui.advance(980)
    expect(await shown(ui)).not.toContain('Game over')
    await ui.advance(30)
    expect(await shown(ui)).toContain('Game over')
  })

  test('space pauses and resumes', async ($, on) => {
    const { ui } = await openBoard($, on)
    await ui.key({ key: 'up', in: 'board' })
    await ui.key({ key: ' ', in: 'board' })
    expect(await shown(ui)).toContain('Paused')
    await ui.key({ key: ' ', in: 'board' })
    expect(await shown(ui)).not.toContain('Paused')
  })

  test('running into the wall shows game over, space starts again', async ($, on) => {
    const { ui } = await openBoard($, on)
    await ui.key({ key: 'right', in: 'board' })
    await ui.key({ key: 'up', in: 'board' })
    await ui.advance(10_000)
    expect(await shown(ui)).toContain('Game over')
    await ui.key({ key: ' ', in: 'board' })
    expect(await shown(ui)).toContain('Score 0')
    expect(await shown(ui)).not.toContain('Game over')
  })

  test('a saved game that does not fit starts a new one', async ($, on) => {
    const huge = { ...newGame(60, 40, () => 0), score: 7 }
    const { ui } = await openBoard($, on, { game: huge })
    expect(await shown(ui)).toContain('Score 0')
  })

  test('a saved game that fits comes back paused', async ($, on) => {
    const saved = { ...newGame(20, 10, () => 0), score: 7 }
    const { ui } = await openBoard($, on, { game: saved })
    expect(await shown(ui)).toContain('Score 7')
    expect(await shown(ui)).toContain('Paused')
  })

  test('a tiny pane asks for more room', async ($, on) => {
    const { ui } = await openBoard($, on)
    await ui.resize({ columns: 10, rows: 5, in: 'board' })
    await ui.advance(25)
    expect(await shown(ui)).toContain('Make the pane bigger')
  })
})
