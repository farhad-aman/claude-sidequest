import { describe, expect, test } from 'claude-code/testing'
import { startSession, world } from './world.ts'

async function startTurn($: any) {
  await $.turn.start({ text: 'do the thing', turnId: 't1' })
}

async function completeTurn($: any, isAborted = false) {
  await $.turn.complete({ answer: 'done', durationMs: 5000, isAborted, turnId: 't1', reason: isAborted ? 'aborted' : 'answer' })
}

describe('turns', () => {
  test('the pane opens after 2 seconds of a turn, not before', async ($, on) => {
    const w = world(on)
    await startSession($)
    await startTurn($)
    await w.clock.advance(1999)
    expect(w.panes.opened).toEqual([])
    await w.clock.advance(1)
    expect(w.panes.opened).toEqual(['snake'])
  })

  test('a turn shorter than 2 seconds never opens the pane', async ($, on) => {
    const w = world(on)
    await startSession($)
    await startTurn($)
    await w.clock.advance(1000)
    await completeTurn($)
    await w.clock.advance(5000)
    expect(w.panes.opened).toEqual([])
  })

  test('Claude finishing counts down 3 seconds, then closes the pane', async ($, on) => {
    const w = world(on)
    await startSession($)
    await startTurn($)
    await w.clock.advance(2000)
    await completeTurn($)
    await w.clock.advance(2999)
    expect(w.panes.closed).toEqual([])
    await w.clock.advance(1)
    expect(w.panes.closed).toEqual(['snake'])
  })

  test('an aborted turn closes the pane at once', async ($, on) => {
    const w = world(on)
    await startSession($)
    await startTurn($)
    await w.clock.advance(2000)
    await completeTurn($, true)
    expect(w.panes.closed).toEqual(['snake'])
  })

  test('a permission ask closes the pane at once', async ($, on) => {
    const w = world(on)
    on('tool.check', () => ({ decision: 'ask' }))
    await startSession($)
    await startTurn($)
    await w.clock.advance(2000)
    await $.tool.check({ tool: 'Bash', input: { command: 'ls' }, tool_use_id: 'u1' })
    expect(w.panes.closed).toEqual(['snake'])
  })

  test('a narrow terminal offers the game above the prompt instead', async ($, on) => {
    const w = world(on)
    w.setPlaced(false)
    await startSession($)
    await startTurn($)
    await w.clock.advance(2000)
    const band = await $.ui.mount({ plugin: 'snake-pane', surface: 'terminal', component: 'AbovePrompt', props: {} as any })
    expect(await band.find({ key: 'play' })).toBeDefined()
    w.setPlaced(true)
    await band.press({ key: 'play' })
    expect(w.panes.opened).toEqual(['snake', 'snake'])
  })

  test('/snake off stops the auto-open, /snake on brings it back', async ($, on) => {
    const w = world(on)
    await startSession($)
    await $.command.run({ command: 'snake', args: 'off', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
    await startTurn($)
    await w.clock.advance(5000)
    expect(w.panes.opened).toEqual([])
    await $.command.run({ command: 'snake', args: 'on', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
    await w.clock.advance(2000)
    expect(w.panes.opened).toEqual(['snake'])
  })
})
