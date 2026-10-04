import { mock } from 'claude-code/testing'
import type { On } from 'claude-code'

export function world(on: On, stored: Record<string, unknown> = {}) {
  const clock = mock.clock(on)
  const store = new Map<string, unknown>(Object.entries(stored))
  const copy = (value: unknown) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))
  on('store.get', ($, e) => ({ value: copy(store.get(e.key)) }))
  on('store.set', ($, e) => {
    store.set(e.key, copy(e.value))
    return { value: undefined }
  })
  on('store.delete', ($, e) => {
    store.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...store.keys()] }))
  const panes = { opened: [] as string[], closed: [] as string[], redraws: 0 }
  let isPlaced = true
  on('ui.open', ($, e) => {
    panes.opened.push(e.id)
    return { value: isPlaced ? { isPlaced: true } : { isPlaced: false, reason: 'the terminal is 120 columns, under 144' } }
  })
  on('ui.close', ($, e) => {
    panes.closed.push(e.id)
    return { value: undefined }
  })
  on('ui.invalidate', () => {
    panes.redraws += 1
    return { value: undefined }
  })
  on('ui.render', () => ({ type: 'Box', props: {}, children: [] }) as any)
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  return {
    clock,
    panes,
    store,
    setPlaced(value: boolean) {
      isPlaced = value
    },
  }
}

export const PANE_MOUNT = {
  plugin: 'sidequest',
  surface: 'terminal',
  component: 'Pane',
  requestId: 'sidequest',
  viewport: { columns: 160, rows: 40, isFullscreen: true },
  props: { title: 'sidequest', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

export async function startSession($: any) {
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
}

export async function runCommand($: any, args: string) {
  return $.command.run({ command: 'sidequest', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
}
