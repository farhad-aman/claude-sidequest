import { MIN_HEIGHT, MIN_WIDTH, fitTo, newGame, step, tickMs, turn } from './game.js'

const FRAME_MS = 16
const STATUS_AND_HINT_AND_WALL_ROWS = 4
const SNAKE_COLOR = '#4ade80'
const FOOD_COLOR = '#f87171'
const WALL_COLOR = 'gray'
const KEY_DIRECTIONS = { up: 'up', down: 'down', left: 'left', right: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }

export default function Board(props, surface) {
  let state = surface.state
  if (state === undefined) {
    state = { props, game: props.game ?? null, best: props.best ?? 0, isPaused: true, elapsedMs: 0 }
    surface.onKey((e) => onKey(surface, e.key))
    surface.every(FRAME_MS, () => onFrame(surface))
    surface.setState(state)
  }
  state.props = props
  return draw(state, surface)
}

function boardSize(surface) {
  return {
    width: Math.floor((surface.columns - 2) / 2),
    height: surface.rows - STATUS_AND_HINT_AND_WALL_ROWS,
  }
}

function isTooSmall({ width, height }) {
  return width < MIN_WIDTH || height < MIN_HEIGHT
}

function onFrame(surface) {
  const state = surface.state
  const size = boardSize(surface)
  if (isTooSmall(size)) return
  const { game } = state
  if (!game || game.width !== size.width || game.height !== size.height) {
    const fitted = fitTo(game, size.width, size.height) ?? newGame(size.width, size.height)
    surface.setState({ ...state, game: fitted, isPaused: true, elapsedMs: 0 })
    return
  }
  if (state.props.isPaused && !state.isPaused) {
    surface.setState({ ...state, isPaused: true })
    return
  }
  if (state.isPaused || state.props.isPaused || game.isOver) return
  state.elapsedMs += FRAME_MS
  const moveMs = tickMs(game)
  if (state.elapsedMs < moveMs) return
  const next = step(game)
  update(surface, { game: next, best: Math.max(state.best, next.score), elapsedMs: state.elapsedMs - moveMs })
}

function onKey(surface, key) {
  const state = surface.state
  if (!state.game || state.props.isPaused) return
  if (key === ' ' || key === 'space') {
    if (state.game.isOver) update(surface, { game: newGame(state.game.width, state.game.height), isPaused: false })
    else update(surface, { isPaused: !state.isPaused })
    return
  }
  const direction = KEY_DIRECTIONS[key.length === 1 ? key.toLowerCase() : key]
  if (!direction || state.game.isOver) return
  update(surface, { game: turn(state.game, direction), isPaused: false })
}

function update(surface, changes) {
  const state = { ...surface.state, ...changes }
  surface.setState(state)
  surface.post({ game: state.game, best: state.best })
}

function draw(state, surface) {
  const { Box, Text } = surface.elements
  const size = boardSize(surface)
  if (surface.columns > 0 && isTooSmall(size)) {
    return Text({ dimColor: true, children: ['Make the pane bigger to play Snake.'] })
  }
  const { game } = state
  if (!game || game.width !== size.width || game.height !== size.height) {
    return Text({ dimColor: true, children: ['…'] })
  }
  return Box({
    flexDirection: 'column',
    children: [
      Text({ children: [statusText(state)] }),
      Text({ color: WALL_COLOR, children: ['┌' + '──'.repeat(game.width) + '┐'] }),
      ...boardRows(game, Text),
      Text({ color: WALL_COLOR, children: ['└' + '──'.repeat(game.width) + '┘'] }),
      Text({ dimColor: true, children: [hintText(state)] }),
    ],
  })
}

function boardRows(game, Text) {
  const colors = new Map(game.snake.map(([x, y]) => [y * game.width + x, SNAKE_COLOR]))
  if (game.food) colors.set(game.food[1] * game.width + game.food[0], FOOD_COLOR)
  const rows = []
  for (let y = 0; y < game.height; y++) {
    const runs = []
    for (let x = 0; x < game.width; x++) {
      const color = colors.get(y * game.width + x) ?? null
      const last = runs.at(-1)
      if (last && last.color === color) last.count += 1
      else runs.push({ color, count: 1 })
    }
    rows.push(
      Text({
        children: [
          Text({ color: WALL_COLOR, children: ['│'] }),
          ...runs.map(({ color, count }) =>
            color ? Text({ color, children: ['██'.repeat(count)] }) : '  '.repeat(count),
          ),
          Text({ color: WALL_COLOR, children: ['│'] }),
        ],
      }),
    )
  }
  return rows
}

function statusText({ game, best, props }) {
  const claude =
    props.countdown !== null && props.countdown !== undefined
      ? `Claude is done · back in ${props.countdown}`
      : props.isClaudeWorking
        ? '● Claude is working'
        : '✓ Claude is done'
  return `Score ${game.score} · Best ${Math.max(best, game.score)} · ${claude}`
}

function hintText({ game, isPaused, props }) {
  if (props.isPaused) return 'Paused while Claude hands you back'
  if (game.isOver) return 'Game over · Space to play again'
  if (isPaused) return 'Paused · click the board, then press an arrow to play'
  return 'Arrows or WASD turn · Space pauses'
}
