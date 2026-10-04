import { describe, expect, test } from 'claude-code/testing'
import { runCommand, startSession, world } from './world.ts'

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
    expect(w.panes.opened).toEqual(['sidequest'])
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
    expect(w.panes.closed).toEqual(['sidequest'])
  })

  test('an aborted turn closes the pane at once', async ($, on) => {
    const w = world(on)
    await startSession($)
    await startTurn($)
    await w.clock.advance(2000)
    await completeTurn($, true)
    expect(w.panes.closed).toEqual(['sidequest'])
  })

  test('a permission ask closes the pane at once', async ($, on) => {
    const w = world(on)
    on('tool.check', () => ({ decision: 'ask' }))
    await startSession($)
    await startTurn($)
    await w.clock.advance(2000)
    await $.tool.check({ tool: 'Bash', input: { command: 'ls' }, tool_use_id: 'u1' })
    expect(w.panes.closed).toEqual(['sidequest'])
  })

  test('a narrow terminal offers the game above the prompt instead', async ($, on) => {
    const w = world(on)
    w.setPlaced(false)
    await startSession($)
    await startTurn($)
    await w.clock.advance(2000)
    const band = await $.ui.mount({ plugin: 'sidequest', surface: 'terminal', component: 'AbovePrompt', props: {} as any })
    expect(await band.find({ key: 'play' })).toBeDefined()
    w.setPlaced(true)
    await band.press({ key: 'play' })
    expect(w.panes.opened).toEqual(['sidequest', 'sidequest'])
  })

  test('/sidequest off stops the auto-open, /sidequest on brings it back', async ($, on) => {
    const w = world(on)
    await startSession($)
    await $.command.run({ command: 'sidequest', args: 'off', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
    await startTurn($)
    await w.clock.advance(5000)
    expect(w.panes.opened).toEqual([])
    await $.command.run({ command: 'sidequest', args: 'on', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
    await w.clock.advance(2000)
    expect(w.panes.opened).toEqual(['sidequest'])
  })

  test('/sidequest snake opens the pane and remembers Snake', async ($, on) => {
    const w = world(on)
    await startSession($)
    await runCommand($, 'snake')
    expect(w.panes.opened).toEqual(['sidequest'])
    expect(w.store.get('lastGame')).toBe('snake')
  })

  test('/sidequest Snake with a capital letter opens Snake too', async ($, on) => {
    const w = world(on)
    await startSession($)
    await runCommand($, 'Snake')
    expect(w.panes.opened).toEqual(['sidequest'])
  })

  test('/sidequest with an unknown game says which games there are', async ($, on) => {
    const w = world(on)
    await startSession($)
    const result = await runCommand($, 'chess')
    expect(result.text).toBe('No game named chess. Games: snake.')
    expect(w.panes.opened).toEqual([])
  })

  test('the offer above the prompt names the game', async ($, on) => {
    const w = world(on)
    w.setPlaced(false)
    await startSession($)
    await $.turn.start({ text: 'go', turnId: 't1' })
    await w.clock.advance(2000)
    const band = await $.ui.mount({ plugin: 'sidequest', surface: 'terminal', component: 'AbovePrompt', props: {} as any })
    expect((await band.find({ key: 'play' }))?.props.label).toBe('Play Snake while Claude works')
  })
})
