export const MIN_WIDTH = 8
export const MIN_HEIGHT = 4

const MOVES = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' }
const START_TICK_MS = 115
const FASTEST_TICK_MS = 40
const FOODS_PER_SPEEDUP = 5
const SPEEDUP_MS = 7
const MAX_QUEUED_TURNS = 2

export function newGame(width, height, random = Math.random) {
  const y = Math.floor(height / 2)
  const x = Math.floor(width / 3) + 2
  const snake = [[x, y], [x - 1, y], [x - 2, y]]
  return {
    width,
    height,
    snake,
    direction: 'right',
    queued: [],
    food: placeFood(width, height, snake, random),
    score: 0,
    isOver: false,
  }
}

export function turn(game, direction) {
  if (game.isOver || !MOVES[direction]) return game
  const last = game.queued.at(-1) ?? game.direction
  if (direction === last || direction === OPPOSITE[last] || game.queued.length >= MAX_QUEUED_TURNS) return game
  return { ...game, queued: [...game.queued, direction] }
}

export function step(game, random = Math.random) {
  if (game.isOver) return game
  const [direction = game.direction, ...queued] = game.queued
  const [dx, dy] = MOVES[direction]
  const head = [game.snake[0][0] + dx, game.snake[0][1] + dy]
  const eats = game.food !== null && head[0] === game.food[0] && head[1] === game.food[1]
  const body = eats ? game.snake : game.snake.slice(0, -1)
  const isOutside = head[0] < 0 || head[1] < 0 || head[0] >= game.width || head[1] >= game.height
  if (isOutside || body.some(([x, y]) => x === head[0] && y === head[1])) {
    return { ...game, direction, queued, isOver: true }
  }
  const snake = [head, ...body]
  if (!eats) return { ...game, snake, direction, queued }
  const food = placeFood(game.width, game.height, snake, random)
  return { ...game, snake, direction, queued, score: game.score + 1, food, isOver: food === null }
}

export function tickMs(game) {
  return Math.max(FASTEST_TICK_MS, START_TICK_MS - Math.floor(game.score / FOODS_PER_SPEEDUP) * SPEEDUP_MS)
}

export function fitTo(value, width, height) {
  if (!isGame(value)) return null
  const isInside = ([x, y]) => x < width && y < height
  if (!value.snake.every(isInside) || (value.food !== null && !isInside(value.food))) return null
  return { ...value, width, height }
}

function placeFood(width, height, snake, random) {
  const taken = new Set(snake.map(([x, y]) => y * width + x))
  const free = []
  for (let i = 0; i < width * height; i++) if (!taken.has(i)) free.push(i)
  if (free.length === 0) return null
  const cell = free[Math.floor(random() * free.length)]
  return [cell % width, Math.floor(cell / width)]
}

function isGame(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray(value.snake) &&
    value.snake.length > 0 &&
    value.snake.every(isCell) &&
    (value.food === null || isCell(value.food)) &&
    MOVES[value.direction] !== undefined &&
    Array.isArray(value.queued) &&
    value.queued.every((direction) => MOVES[direction] !== undefined) &&
    Number.isInteger(value.score) &&
    typeof value.isOver === 'boolean'
  )
}

function isCell(value) {
  return Array.isArray(value) && value.length === 2 && value.every((n) => Number.isInteger(n) && n >= 0)
}
