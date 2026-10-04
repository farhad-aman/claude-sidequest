import { GAMES, gameById } from './games/index.js'

const PANE = 'sidequest'
const DROP_IN_DELAY_MS = 2000
const COUNTDOWN_SECONDS = 3
const OLD_KEYS = { best: 'best:snake', game: 'game:snake' }

let isOn = true
let currentGame = GAMES[0].id
let saves = {}
let phase = 'idle'
let isTurnRunning = false
let isDismissed = false
let timer = null
let countdown = 0

function boardProps() {
  return {
    gameId: currentGame,
    saves,
    isPaused: phase === 'countdown',
    isClaudeWorking: isTurnRunning,
    countdown: phase === 'countdown' ? countdown : null,
  }
}

async function moveOldKeys($) {
  for (const [oldKey, newKey] of Object.entries(OLD_KEYS)) {
    const value = await $.store.get(oldKey)
    if (value === undefined) continue
    if ((await $.store.get(newKey)) === undefined) await $.store.set(newKey, value)
    await $.store.delete(oldKey)
  }
}

async function loadStore($) {
  await moveOldKeys($)
  isOn = (await $.store.get('isOn')) !== false
  currentGame = (gameById(await $.store.get('lastGame')) ?? GAMES[0]).id
  saves = {}
  for (const { id } of GAMES) {
    const best = await $.store.get(`best:${id}`)
    saves[id] = { state: (await $.store.get(`game:${id}`)) ?? null, best: typeof best === 'number' ? best : 0 }
  }
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
  for (const [id, save] of Object.entries(saves)) {
    if (save.state) await $.store.set(`game:${id}`, save.state)
  }
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
    if (gameById(e.data.lastGame)) {
      await chooseGame($, e.data.lastGame)
      $.ui.invalidate('ui.render')
      return {}
    }
    const { gameId } = e.data
    if (!gameById(gameId)) return {}
    const old = saves[gameId]
    const best = typeof e.data.best === 'number' ? Math.max(old.best, e.data.best) : old.best
    saves = { ...saves, [gameId]: { state: e.data.state ?? null, best } }
    if (best > old.best) await $.store.set(`best:${gameId}`, best)
    return {}
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Client } = $.ui.resolve(e)
    if (e.surface !== 'terminal') return Text({ children: ['Sidequest plays in the terminal.'] })
    return Box({
      children: [
        Client({
          key: 'board',
          module: './frame.js',
          props: boardProps(),
          width: e.props.bodyColumns,
          height: e.props.scroll.bodyRows,
        }),
      ],
    })
  })
}
