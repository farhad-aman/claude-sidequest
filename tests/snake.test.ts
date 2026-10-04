import { describe, expect, test } from 'claude-code/testing'
import { fitTo, newGame, step, tickMs, turn } from '../hooks/games/snake/rules.js'
import snake from '../hooks/games/snake/index.js'

const first = () => 0

describe('game', () => {
  test('a new game is a snake of three heading right, food off the snake', () => {
    const game = newGame(10, 6, first)
    expect(game.snake).toEqual([[5, 3], [4, 3], [3, 3]])
    expect(game.direction).toBe('right')
    expect(game.score).toBe(0)
    expect(game.isOver).toBe(false)
    expect(game.snake).not.toContainEqual(game.food)
  })

  test('a step moves the head one square and keeps the length', () => {
    const game = step(newGame(10, 6, first), first)
    expect(game.snake).toEqual([[6, 3], [5, 3], [4, 3]])
  })

  test('eating grows the snake, scores, and places new food off the snake', () => {
    const game = step({ ...newGame(10, 6, first), food: [6, 3] }, first)
    expect(game.snake).toEqual([[6, 3], [5, 3], [4, 3], [3, 3]])
    expect(game.score).toBe(1)
    expect(game.food).not.toBeNull()
    expect(game.snake).not.toContainEqual(game.food)
  })

  test('hitting the wall ends the game', () => {
    const game = step({ ...newGame(10, 6, first), snake: [[9, 3], [8, 3], [7, 3]] }, first)
    expect(game.isOver).toBe(true)
  })

  test('hitting the body ends the game', () => {
    const coiled = { ...newGame(10, 6, first), snake: [[2, 2], [3, 2], [3, 3], [2, 3], [1, 3]], direction: 'left' as const, queued: ['down' as const] }
    expect(step(coiled, first).isOver).toBe(true)
  })

  test('moving into the tail square is safe', () => {
    const loop = { ...newGame(10, 6, first), snake: [[2, 2], [3, 2], [3, 3], [2, 3]], direction: 'left' as const, queued: ['down' as const], food: [9, 0] as [number, number] }
    const game = step(loop, first)
    expect(game.isOver).toBe(false)
    expect(game.snake[0]).toEqual([2, 3])
  })

  test('turning straight back is ignored', () => {
    const game = newGame(10, 6, first)
    expect(turn(game, 'left').queued).toEqual([])
    expect(turn(game, 'right').queued).toEqual([])
  })

  test('two queued turns play in order', () => {
    let game = turn(turn(newGame(10, 6, first), 'up'), 'left')
    expect(game.queued).toEqual(['up', 'left'])
    game = step(game, first)
    expect(game.direction).toBe('up')
    game = step(game, first)
    expect(game.direction).toBe('left')
  })

  test('a quick reversal through a queued turn is ignored', () => {
    const game = turn(turn(newGame(10, 6, first), 'up'), 'down')
    expect(game.queued).toEqual(['up'])
  })

  test('a third queued turn is dropped', () => {
    const game = turn(turn(turn(newGame(10, 6, first), 'up'), 'left'), 'down')
    expect(game.queued).toEqual(['up', 'left'])
  })

  test('filling the board ends the game as a win', () => {
    const full = { width: 4, height: 1, snake: [[1, 0], [2, 0], [3, 0]] as [number, number][], direction: 'left' as const, queued: [], food: [0, 0] as [number, number], score: 0, isOver: false }
    const game = step(full, first)
    expect(game.score).toBe(1)
    expect(game.food).toBeNull()
    expect(game.isOver).toBe(true)
  })

  test('the snake speeds up every five foods, down to a floor', () => {
    const game = newGame(10, 6, first)
    expect(tickMs(game)).toBe(100)
    expect(tickMs({ ...game, score: 5 })).toBe(93)
    expect(tickMs({ ...game, score: 100 })).toBe(40)
  })

  test('fitTo keeps a game that fits and resizes it', () => {
    const game = newGame(10, 6, first)
    expect(fitTo(game, 20, 10)).toEqual({ ...game, width: 20, height: 10 })
  })

  test('fitTo drops a game that does not fit, or is not a game', () => {
    expect(fitTo(newGame(10, 6, first), 5, 6)).toBeNull()
    expect(fitTo({ snake: 'no' }, 10, 6)).toBeNull()
    expect(fitTo(null, 10, 6)).toBeNull()
  })

  test('the Snake object turns on arrows and WASD, ignores other keys', () => {
    const game = snake.start({ columns: 42, rows: 12 })
    expect(snake.key(game, 'up').queued).toEqual(['up'])
    expect(snake.key(game, 'W').queued).toEqual(['up'])
    expect(snake.key(game, 'x')).toBeNull()
  })

  test('the Snake object uses two columns a cell and two wall rows', () => {
    const game = snake.start({ columns: 42, rows: 12 })
    expect(game.width).toBe(20)
    expect(game.height).toBe(10)
  })

  test('the head has its own color, the body stays green', () => {
    const game = snake.start({ columns: 42, rows: 12 })
    const colors: string[] = []
    const Text = (props: any) => {
      if (props.color) colors.push(props.color)
      return { type: 'Text', props }
    }
    snake.draw(game, { Box: (props: any) => ({ type: 'Box', props }), Text })
    expect(colors.filter((color) => color === '#d9f99d')).toHaveLength(1)
    expect(colors).toContain('#4ade80')
  })
})
