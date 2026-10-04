import { describe, expect, test } from 'claude-code/testing'
import { PANE_MOUNT, startSession, world } from './world.ts'

async function shown(ui: any) {
  const texts = await ui.findAll({ type: 'Text', in: 'board' })
  return texts.map((t: any) => t.text).join('\n')
}

describe('review fixes', () => {
  test('a queued prompt during the countdown keeps the game paused', async ($, on) => {
    const w = world(on)
    await startSession($)
    await $.turn.start({ text: 'go', turnId: 't1' })
    await w.clock.advance(2000)
    const ui = await $.ui.mount(PANE_MOUNT)
    await ui.resize({ columns: 42, rows: 14, in: 'board' })
    await ui.advance(25)
    await ui.key({ key: 'up', in: 'board' })
    await $.turn.complete({ answer: '', durationMs: 2000, isAborted: false, turnId: 't1', reason: 'answer' })
    await ui.redraw()
    await ui.advance(25)
    await $.turn.start({ text: 'next', turnId: 't2' })
    await ui.redraw()
    await ui.advance(25)
    const before = await shown(ui)
    await ui.advance(500)
    expect(await shown(ui)).toContain('Paused')
    expect(await shown(ui)).toEqual(before)
  })

  test('the board is as tall as the pane body, even a short one', async ($, on) => {
    world(on)
    await startSession($)
    await $.command.run({ command: 'sidequest', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
    const ui = await $.ui.mount({ ...PANE_MOUNT, props: { ...PANE_MOUNT.props, scroll: { offset: 0, bodyRows: 6 } } } as any)
    const client = await ui.find({ type: 'Client' })
    expect(client?.props.height).toBe(6)
  })
})
