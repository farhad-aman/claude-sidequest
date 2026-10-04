import { describe, expect, test } from 'claude-code/testing'
import { GAMES, gameById } from '../hooks/games/index.js'

const SIZE = { columns: 42, rows: 12 }
const TINY = { columns: 4, rows: 3 }
const PARTS = ['fits', 'start', 'restore', 'key', 'stepMs', 'step', 'score', 'isOver', 'draw']

describe('games', () => {
  test('there is at least one game, and Snake is first', () => {
    expect(GAMES.length).toBeGreaterThan(0)
    expect(GAMES[0].id).toBe('snake')
  })

  test('every game has an id, a title, a hint and every part', () => {
    for (const game of GAMES as any[]) {
      expect(game.id).toMatch(/^[a-z0-9-]+$/)
      expect(typeof game.title).toBe('string')
      expect(typeof game.hint).toBe('string')
      for (const part of PARTS) expect(typeof game[part]).toBe('function')
    }
  })

  test('ids are unique and are not command words', () => {
    const ids = GAMES.map((game: any) => game.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toContain('on')
    expect(ids).not.toContain('off')
  })

  test('gameById finds a game, and gives nothing for an unknown id', () => {
    expect(gameById('snake')).toBe(GAMES[0])
    expect(gameById('nope')).toBeUndefined()
    expect(gameById(undefined)).toBeUndefined()
  })

  test('a new game fits, is plain data, scores 0, and restores to itself', () => {
    for (const game of GAMES as any[]) {
      expect(game.fits(SIZE)).toBe(true)
      expect(game.fits(TINY)).toBe(false)
      const state = game.start(SIZE)
      expect(JSON.parse(JSON.stringify(state))).toEqual(state)
      expect(game.score(state)).toBe(0)
      expect(game.isOver(state)).toBe(false)
      expect(game.restore(state, SIZE)).toEqual(state)
    }
  })

  test('junk does not restore', () => {
    for (const game of GAMES as any[]) {
      expect(game.restore(null, SIZE)).toBeNull()
      expect(game.restore('junk', SIZE)).toBeNull()
      expect(game.restore({}, SIZE)).toBeNull()
    }
  })

  test('a key the game does not use gives null', () => {
    for (const game of GAMES as any[]) {
      expect(game.key(game.start(SIZE), 'pagedown')).toBeNull()
    }
  })

  test('stepMs is a positive number or null', () => {
    for (const game of GAMES as any[]) {
      const ms = game.stepMs(game.start(SIZE))
      expect(ms === null || (typeof ms === 'number' && ms > 0)).toBe(true)
    }
  })

  test('draw gives an element', () => {
    const elements = {
      Box: (props: any) => ({ type: 'Box', props }),
      Text: (props: any) => ({ type: 'Text', props }),
    }
    for (const game of GAMES as any[]) {
      expect(game.draw(game.start(SIZE), elements)).toBeDefined()
    }
  })
})
