import { describe, expect, test } from 'claude-code/testing'
import { menuKey, menuLines, openMenu } from '../hooks/menu.js'

const IDS = ['snake', 'blocks']

describe('menu', () => {
  test('opens on the current game', () => {
    expect(openMenu(IDS, 'blocks').index).toBe(1)
  })

  test('opens on the first game when the current one is unknown', () => {
    expect(openMenu(IDS, 'gone').index).toBe(0)
  })

  test('down and s move down, up and w move up, and both wrap', () => {
    const menu = openMenu(IDS, 'snake')
    expect((menuKey(menu, 'down') as any).menu.index).toBe(1)
    expect((menuKey(menu, 's') as any).menu.index).toBe(1)
    expect((menuKey(menu, 'up') as any).menu.index).toBe(1)
    expect((menuKey(menu, 'W') as any).menu.index).toBe(1)
    expect((menuKey({ ...menu, index: 1 }, 'down') as any).menu.index).toBe(0)
  })

  test('return and space pick the selected game', () => {
    const menu = { ...openMenu(IDS, 'snake'), index: 1 }
    expect(menuKey(menu, 'return')).toEqual({ action: 'pick', id: 'blocks' })
    expect(menuKey(menu, ' ')).toEqual({ action: 'pick', id: 'blocks' })
  })

  test('m closes the menu', () => {
    expect(menuKey(openMenu(IDS, 'snake'), 'm')).toEqual({ action: 'close' })
  })

  test('other keys do nothing', () => {
    expect(menuKey(openMenu(IDS, 'snake'), 'x')).toEqual({ action: 'none' })
  })

  test('lines mark the selected game and the game being played, with best scores', () => {
    const titles: Record<string, string> = { snake: 'Snake', blocks: 'Blocks' }
    const menu = { ...openMenu(IDS, 'snake'), index: 1 }
    const lines = menuLines(menu, 'snake', (id: string) => ({ title: titles[id], best: id === 'snake' ? 23 : 4 }))
    expect(lines).toEqual(['  Snake · Best 23 · playing', '› Blocks · Best 4'])
  })
})
