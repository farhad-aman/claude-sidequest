const UP_KEYS = new Set(['up', 'w'])
const DOWN_KEYS = new Set(['down', 's'])
const PICK_KEYS = new Set(['return', ' ', 'space'])

export function openMenu(ids, currentId) {
  return { ids, index: Math.max(0, ids.indexOf(currentId)) }
}

export function menuKey(menu, key) {
  const pressed = key.length === 1 ? key.toLowerCase() : key
  if (pressed === 'm') return { action: 'close' }
  if (PICK_KEYS.has(pressed)) return { action: 'pick', id: menu.ids[menu.index] }
  const delta = UP_KEYS.has(pressed) ? -1 : DOWN_KEYS.has(pressed) ? 1 : 0
  if (delta === 0) return { action: 'none' }
  const count = menu.ids.length
  return { action: 'move', menu: { ...menu, index: (menu.index + delta + count) % count } }
}

export function menuLines(menu, currentId, describe) {
  return menu.ids.map((id, i) => {
    const { title, best } = describe(id)
    const marker = i === menu.index ? '›' : ' '
    return `${marker} ${title} · Best ${best}${id === currentId ? ' · playing' : ''}`
  })
}
