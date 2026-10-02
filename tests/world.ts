import { mock } from 'claude-code/testing'
import type { On } from 'claude-code'

export function world(on: On, stored: Record<string, unknown> = {}) {
  const clock = mock.clock(on)
  mock.store(on, stored)
  const panes = { opened: [] as string[], closed: [] as string[] }
  let isPlaced = true
  on('ui.open', ($, e) => {
    panes.opened.push(e.id)
    return { value: isPlaced ? { isPlaced: true } : { isPlaced: false, reason: 'the terminal is 120 columns, under 144' } }
  })
  on('ui.close', ($, e) => {
    panes.closed.push(e.id)
    return { value: undefined }
  })
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.render', () => ({ type: 'Box', props: {}, children: [] }) as any)
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  return {
    clock,
    panes,
    setPlaced(value: boolean) {
      isPlaced = value
    },
  }
}

export const PANE_MOUNT = {
  plugin: 'snake-pane',
  surface: 'terminal',
  component: 'Pane',
  requestId: 'snake',
  viewport: { columns: 160, rows: 40, isFullscreen: true },
  props: { title: 'snake', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

export async function startSession($: any) {
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
}

export async function runCommand($: any, args: string) {
  return $.command.run({ command: 'snake', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
}
