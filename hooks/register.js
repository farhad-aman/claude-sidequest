import { GAMES, gameById } from './games/index.js'

const PANE = 'sidequest'
const DROP_IN_DELAY_MS = 2000
const COUNTDOWN_SECONDS = 3

let isOn = true
let currentGame = GAMES[0].id
let best = 0
let savedGame = null
let phase = 'idle'
let isTurnRunning = false
let isDismissed = false
let timer = null
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
  currentGame = (gameById(await $.store.get('lastGame')) ?? GAMES[0]).id
  const storedBest = await $.store.get('best')
  best = typeof storedBest === 'number' ? storedBest : 0
  savedGame = (await $.store.get('game')) ?? null
}

function cancelTimer() {
  timer?.cancel()
  timer = null
}

async function chooseGame($, id) {
  currentGame = id
  await $.store.set('lastGame', id)
}

function armDropIn($) {
  if (!isOn || !isTurnRunning || isDismissed || phase !== 'idle') return
  phase = 'waiting'
  timer = $.clock.after(DROP_IN_DELAY_MS, () => void dropIn($))
}

async function dropIn($) {
  if (phase !== 'waiting') return
  timer = null
  const opened = await $.ui.open({ id: PANE, title: PANE })
  if (!opened.isPlaced) {
    await $.ui.close({ id: PANE })
    phase = 'offered'
    $.ui.invalidate('ui.render')
    return
  }
  phase = 'playing'
  $.ui.invalidate('ui.render')
}

async function acceptOffer($) {
  if (phase !== 'offered') return
  const opened = await $.ui.open({ id: PANE, title: PANE })
  if (!opened.isPlaced) {
    await $.ui.close({ id: PANE })
    return
  }
  phase = 'playing'
  $.ui.invalidate('ui.render')
}

function withdrawOffer($) {
  cancelTimer()
  phase = 'idle'
  $.ui.invalidate('ui.render')
}

async function pullOut($) {
  cancelTimer()
  phase = 'idle'
  await $.ui.close({ id: PANE })
}

async function handBack($) {
  if (phase === 'waiting' || phase === 'offered') withdrawOffer($)
  else if (phase === 'playing' || phase === 'countdown') await pullOut($)
}

function startCountdown($) {
  phase = 'countdown'
  countdown = COUNTDOWN_SECONDS
  $.ui.invalidate('ui.render')
  timer = $.clock.every(1000, () => {
    countdown -= 1
    if (countdown > 0) $.ui.invalidate('ui.render')
    else void pullOut($)
  })
}

async function goAway($) {
  cancelTimer()
  phase = 'idle'
  if (savedGame) await $.store.set('game', savedGame)
}

/** @type {import('claude-code').Register} */
export const register = (on) => {
  on('session.start', async ($, e, next) => {
    await loadStore($)
    await $.command.register({
      name: 'sidequest',
      description: 'Play a game while Claude works',
      argumentHint: '[on|off|<game>]',
    })
    return next(e)
  })

  on('command.run', { command: 'sidequest' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'off') {
      isOn = false
      await $.store.set('isOn', false)
      await handBack($)
      return { text: 'Sidequest will not open by itself now. /sidequest on turns it back on.' }
    }
    if (arg === 'on') {
      isOn = true
      await $.store.set('isOn', true)
      armDropIn($)
      return { text: 'Sidequest opens by itself while Claude works.' }
    }
    if (arg) {
      const game = gameById(arg)
      if (!game) return { text: `No game named ${arg}. Games: ${GAMES.map(({ id }) => id).join(', ')}.` }
      await chooseGame($, game.id)
    }
    cancelTimer()
    phase = 'playing'
    await $.ui.open({ id: PANE, title: PANE })
    $.ui.invalidate('ui.render')
    return {}
  })

  on('turn.start', async ($, e, next) => {
    isTurnRunning = true
    isDismissed = false
    if (phase === 'countdown') {
      cancelTimer()
      phase = 'playing'
    }
    $.ui.invalidate('ui.render')
    armDropIn($)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) return next(e)
    isTurnRunning = false
    if (phase === 'waiting' || phase === 'offered') withdrawOffer($)
    else if (phase === 'playing') {
      if (e.isAborted) await pullOut($)
      else startCountdown($)
    }
    return next(e)
  })

  // In auto mode an ask can go to the classifier instead of the person; closing anyway costs a moment, missing a real prompt costs more
  on('tool.check', async ($, e, next) => {
    const result = await next(e)
    if (e.tool_use_id && result.decision === 'ask') await handBack($)
    return result
  })

  on('tool.call', async ($, e, next) => {
    if (e.tool === 'AskUserQuestion') await handBack($)
    const result = await next(e)
    armDropIn($)
    return result
  })

  on('ui.close', async ($, e, next) => {
    if (e.id !== PANE) return next(e)
    if (e.origin.kind === 'person' && isTurnRunning) isDismissed = true
    await goAway($)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (phase !== 'offered') return next(e)
    const { Box, Button } = $.ui.resolve(e)
    const others = await next(e)
    return Box({
      flexDirection: 'column',
      children: [
        Button({ key: 'play', label: `Play ${gameById(currentGame).title} while Claude works`, hotkey: '1', plain: true, onPress: () => acceptOffer($) }),
        ...(others ? [others] : []),
      ],
    })
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
          height: e.props.scroll.bodyRows,
        }),
      ],
    })
  })
}
