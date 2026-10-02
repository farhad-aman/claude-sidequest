import { describe, expect, test } from 'claude-code/testing'
import { PANE_MOUNT, runCommand, startSession, world } from './world.ts'

const BOARD = { columns: 42, rows: 14, in: 'board' }

async function openBoard($: any) {
  await runCommand($, '')
  const ui = await $.ui.mount(PANE_MOUNT)
  await ui.resize(BOARD)
  await ui.advance(25)
  return ui
}

async function shown(ui: any) {
  const texts = await ui.findAll({ type: 'Text', in: 'board' })
  return texts.map((t: any) => t.text).join('\n')
}

async function boardRows(ui: any) {
  const lines = (await shown(ui)).split('\n')
  const top = lines.findIndex((line: string) => line.startsWith('┌'))
  const bottom = lines.findIndex((line: string) => line.startsWith('└'))
  return lines.slice(top, bottom + 1).join('\n')
}

async function abortTurn($: any, w: any) {
  await $.turn.start({ text: 'go', turnId: 't1' })
  await w.clock.advance(2000)
  await $.turn.complete({ answer: '', durationMs: 2000, isAborted: true, turnId: 't1', reason: 'aborted' })
}

describe('store', () => {
  test('the game survives a close and a new session, and comes back paused', async ($, on) => {
    const w = world(on)
    await startSession($)
    await $.turn.start({ text: 'go', turnId: 't1' })
    await w.clock.advance(2000)
    let ui = await $.ui.mount(PANE_MOUNT)
    await ui.resize(BOARD)
    await ui.advance(25)
    await ui.key({ key: 'up', in: 'board' })
    await ui.advance(130)
    await ui.key({ key: ' ', in: 'board' })
    const before = await boardRows(ui)
    await $.turn.complete({ answer: '', durationMs: 2000, isAborted: true, turnId: 't1', reason: 'aborted' })
    await ui.unmount()
    expect(w.panes.closed).toEqual(['snake'])

    await startSession($)
    ui = await openBoard($)
    expect(await boardRows(ui)).toEqual(before)
    expect(await shown(ui)).toContain('Paused')
  })

  test('a new best score is kept for the next session', async ($, on) => {
    const w = world(on)
    await startSession($)
    let ui = await openBoard($)
    await ui.post({ game: null, best: 12 }, { in: 'board' })
    await abortTurn($, w)
    await ui.unmount()

    await startSession($)
    ui = await openBoard($)
    expect(await shown(ui)).toContain('Best 12')
  })

  test('/snake off is kept for the next session', async ($, on) => {
    const w = world(on)
    await startSession($)
    await runCommand($, 'off')

    await startSession($)
    await $.turn.start({ text: 'go', turnId: 't2' })
    await w.clock.advance(5000)
    expect(w.panes.opened).toEqual([])
  })
})
