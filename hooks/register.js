const PANE = 'snake'
const MIN_BOARD_ROWS = 8

let isOn = true
let best = 0
let savedGame = null
let phase = 'idle'
let isTurnRunning = false
let countdown = 0

function boardProps() {
  return {
    game: savedGame,
    best,
    isPaused: phase === 'countdown',
    isClaudeWorking: isTurnRunning,
    countdown: phase === 'countdown' ? countdown : null,
  }
}

async function loadStore($) {
  isOn = (await $.store.get('isOn')) !== false
  const storedBest = await $.store.get('best')
  best = typeof storedBest === 'number' ? storedBest : 0
  savedGame = (await $.store.get('game')) ?? null
}

/** @type {import('claude-code').Register} */
export const register = (on) => {
  on('session.start', async ($, e, next) => {
    await loadStore($)
    await $.command.register({
      name: 'snake',
      description: 'Play Snake while Claude works',
      argumentHint: '[on|off]',
    })
    return next(e)
  })

  on('command.run', { command: 'snake' }, async ($) => {
    phase = 'playing'
    await $.ui.open({ id: PANE, title: 'snake' })
    return {}
  })

  on('ui.message', async ($, e) => {
    if (e.element !== 'board') return {}
    savedGame = e.data.game ?? null
    if (typeof e.data.best === 'number' && e.data.best > best) {
      best = e.data.best
      await $.store.set('best', best)
    }
    return {}
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Client } = $.ui.resolve(e)
    if (e.surface !== 'terminal') return Text({ children: ['Snake plays in the terminal.'] })
    return Box({
      children: [
        Client({
          key: 'board',
          module: './board.js',
          props: boardProps(),
          width: e.props.bodyColumns,
          height: Math.max(MIN_BOARD_ROWS, e.props.scroll.bodyRows),
        }),
      ],
    })
  })
}
