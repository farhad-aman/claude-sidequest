import { GAMES, gameById } from './games/index.js'
import { menuKey, menuLines, openMenu } from './menu.js'

const FRAME_MS = 16
const STATUS_AND_HINT_ROWS = 2

export default function Frame(props, surface) {
  let state = surface.state
  if (state === undefined) {
    const gameId = (gameById(props.gameId) ?? GAMES[0]).id
    const saves = props.saves ?? {}
    state = {
      props,
      requestedId: props.gameId,
      gameId,
      saves,
      game: saves[gameId]?.state ?? null,
      best: saves[gameId]?.best ?? 0,
      size: null,
      isPaused: true,
      elapsedMs: 0,
      menu: null,
    }
    surface.onKey((e) => onKey(surface, e.key))
    surface.every(FRAME_MS, () => onFrame(surface))
    surface.setState(state)
  }
  state.props = props
  return draw(state, surface)
}

function playSize(surface) {
  return { columns: surface.columns, rows: surface.rows - STATUS_AND_HINT_ROWS }
}

function isSameSize(a, b) {
  return a !== null && a.columns === b.columns && a.rows === b.rows
}

function withGame(state, id) {
  const saves = { ...state.saves, [state.gameId]: { state: state.game, best: state.best } }
  return {
    ...state,
    saves,
    gameId: id,
    game: saves[id]?.state ?? null,
    best: saves[id]?.best ?? 0,
    size: null,
    isPaused: true,
    elapsedMs: 0,
    menu: null,
  }
}

function onFrame(surface) {
  const state = surface.state
  if (state.props.gameId !== state.requestedId) {
    const target = gameById(state.props.gameId)
    const next = target && target.id !== state.gameId ? withGame(state, target.id) : state
    surface.setState({ ...next, requestedId: state.props.gameId })
    return
  }
  const game = gameById(state.gameId)
  const size = playSize(surface)
  if (!game.fits(size)) return
  if (!isSameSize(state.size, size)) {
    const fitted = game.restore(state.game, size) ?? game.start(size)
    surface.setState({ ...state, game: fitted, size, isPaused: true, elapsedMs: 0 })
    return
  }
  if (state.props.isPaused && !state.isPaused) {
    surface.setState({ ...state, isPaused: true })
    return
  }
  if (state.isPaused || state.props.isPaused || game.isOver(state.game)) return
  const stepMs = game.stepMs(state.game)
  if (stepMs === null) return
  state.elapsedMs += FRAME_MS
  if (state.elapsedMs < stepMs) return
  update(surface, { game: game.step(state.game), elapsedMs: state.elapsedMs - stepMs })
}

function onKey(surface, key) {
  const state = surface.state
  if (!state.game || state.props.isPaused) return
  if (state.menu) {
    onMenuKey(surface, key)
    return
  }
  if (key.toLowerCase() === 'm' && GAMES.length > 1) {
    surface.setState({ ...state, menu: openMenu(GAMES.map(({ id }) => id), state.gameId), isPaused: true })
    return
  }
  const game = gameById(state.gameId)
  if (key === ' ' || key === 'space') {
    if (game.isOver(state.game)) update(surface, { game: game.start(state.size), isPaused: false, elapsedMs: 0 })
    else update(surface, { isPaused: !state.isPaused })
    return
  }
  if (game.isOver(state.game)) return
  const next = game.key(state.game, key)
  if (next !== null) update(surface, { game: next, isPaused: false })
}

function onMenuKey(surface, key) {
  const state = surface.state
  const result = menuKey(state.menu, key)
  if (result.action === 'move') surface.setState({ ...state, menu: result.menu })
  else if (result.action === 'close') surface.setState({ ...state, menu: null })
  else if (result.action === 'pick') {
    surface.setState(withGame(state, result.id))
    surface.post({ lastGame: result.id })
  }
}

function update(surface, changes) {
  const state = { ...surface.state, ...changes }
  state.best = Math.max(state.best, gameById(state.gameId).score(state.game))
  surface.setState(state)
  surface.post({ gameId: state.gameId, state: state.game, best: state.best })
}

function draw(state, surface) {
  const { Box, Text } = surface.elements
  const game = gameById(state.gameId)
  const size = playSize(surface)
  if (surface.columns > 0 && !game.fits(size)) {
    return Text({ dimColor: true, children: ['Make the pane bigger to play.'] })
  }
  if (!state.game || !isSameSize(state.size, size)) {
    return Text({ dimColor: true, children: ['…'] })
  }
  return Box({
    flexDirection: 'column',
    children: [
      Text({ children: [statusText(state, game)] }),
      state.menu ? menuBox(state, Box, Text) : game.draw(state.game, surface.elements),
      Text({ dimColor: true, children: [hintText(state, game)] }),
    ],
  })
}

function menuBox(state, Box, Text) {
  const describe = (id) => ({
    title: gameById(id).title,
    best: id === state.gameId ? state.best : (state.saves[id]?.best ?? 0),
  })
  return Box({
    flexDirection: 'column',
    children: menuLines(state.menu, state.gameId, describe).map((line) => Text({ children: [line] })),
  })
}

function statusText(state, game) {
  const { props } = state
  const claude =
    props.countdown !== null && props.countdown !== undefined
      ? `Claude is done · back in ${props.countdown}`
      : props.isClaudeWorking
        ? '● Claude is working'
        : '✓ Claude is done'
  const score = game.score(state.game)
  return `${game.title} · Score ${score} · Best ${Math.max(state.best, score)} · ${claude}`
}

function hintText(state, game) {
  if (state.props.isPaused) return 'Paused while Claude hands you back'
  if (state.menu) return '↑↓ choose · Enter play · m back'
  if (game.isOver(state.game)) return 'Game over · Space to play again'
  if (state.isPaused) return 'Paused · click the board, then press a key to play'
  return `${game.hint} · Space pauses${GAMES.length > 1 ? ' · m games' : ''}`
}
