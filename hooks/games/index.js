import snake from './snake/index.js'

export const GAMES = [snake]

export function gameById(id) {
  return GAMES.find((game) => game.id === id)
}
