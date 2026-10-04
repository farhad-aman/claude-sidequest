import { MIN_HEIGHT, MIN_WIDTH, fitTo, newGame, step, tickMs, turn } from './rules.js'

const WALL_COLUMNS = 2
const WALL_ROWS = 2
const SNAKE_COLOR = '#4ade80'
const FOOD_COLOR = '#f87171'
const WALL_COLOR = 'gray'
const KEY_DIRECTIONS = { up: 'up', down: 'down', left: 'left', right: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }

function cells({ columns, rows }) {
  return { width: Math.floor((columns - WALL_COLUMNS) / 2), height: rows - WALL_ROWS }
}

function fits(size) {
  const { width, height } = cells(size)
  return width >= MIN_WIDTH && height >= MIN_HEIGHT
}

function start(size) {
  const { width, height } = cells(size)
  return newGame(width, height)
}

function restore(saved, size) {
  const { width, height } = cells(size)
  return fitTo(saved, width, height)
}

function key(game, pressed) {
  const direction = KEY_DIRECTIONS[pressed.length === 1 ? pressed.toLowerCase() : pressed]
  return direction ? turn(game, direction) : null
}

function draw(game, { Box, Text }) {
  return Box({
    flexDirection: 'column',
    children: [
      Text({ color: WALL_COLOR, children: ['┌' + '──'.repeat(game.width) + '┐'] }),
      ...boardRows(game, Text),
      Text({ color: WALL_COLOR, children: ['└' + '──'.repeat(game.width) + '┘'] }),
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

export default {
  id: 'snake',
  title: 'Snake',
  hint: 'Arrows or WASD turn',
  fits,
  start,
  restore,
  key,
  stepMs: tickMs,
  step: (game) => step(game),
  score: (game) => game.score,
  isOver: (game) => game.isOver,
  draw,
}
