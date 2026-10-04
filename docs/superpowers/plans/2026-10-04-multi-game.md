# Sidequest Many Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the plugin so it holds many games behind one shared frame, with Snake as the first game and `/sidequest` as the command.

**Architecture:** `hooks/register.js` keeps the Claude timing and saves one game and one best score per game. `hooks/frame.js` is the one Client module in the pane: status line, pause, menu, time count, saving posts. Each game is a plain object in `hooks/games/<id>/index.js`, listed in `hooks/games/index.js`.

**Tech Stack:** Claude Code plugin function hooks (ES modules, `.js`), Client surface modules, `claude plugin test` (`claude-code/testing`).

**Spec:** `docs/superpowers/specs/2026-10-04-multi-game-design.md`

## Global Constraints

- Run tests with `command claude plugin test ~/projects/sidequest` and validate with `command claude plugin validate ~/projects/sidequest`. The `command` word skips the person's `claude` shell function, which adds a flag `validate` does not accept.
- No `import()` anywhere in `hooks/`. A module with it does not load. A Client `module:` path is a string literal.
- Write no comments in code, unless the logic is unreadable without one (user rule).
- The frame never uses `Esc`: the terminal uses it to give the focus back.
- Frame keys: `Space` (pause, play again), `m` (menu, only with 2 or more games).
- Store keys: `isOn`, `lastGame`, `game:<id>`, `best:<id>`.
- Pane id and pane title: `sidequest`. Client key: `board`.
- Status line: `<title> · Score <n> · Best <n> · <Claude status>`.
- Unknown game text: `No game named <x>. Games: <ids joined by ", ">.`
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tests that change hook state and then read a mounted Client call `ui.redraw()` after the state change.

## Review Focus

1. A store from before this change with only the old `game` key and no `best` key: the game must come back as Snake's. Test in Task 4 (`store.test.ts`).
2. `/sidequest Snake` with a capital letter: a person expects it to open Snake. Test in Task 3 (`turns.test.ts`).
3. Pressing `m` with only one game: nothing happens, and the hint does not offer a menu. Test in Task 4 (`frame.test.ts`).
4. `lastGame` in the store names a game that was removed: the first game opens. Test in Task 4 (`frame.test.ts`).
5. A post from an old frame names a game that is not in the list: it is ignored and changes no score. Test in Task 4 (`store.test.ts`).

---

### Task 1: Snake as a game object, and the game list

**Files:**
- Move: `hooks/game.js` → `hooks/games/snake/rules.js` (no content change)
- Move: `tests/game.test.ts` → `tests/snake.test.ts` (import path change)
- Create: `hooks/games/snake/index.js`
- Create: `hooks/games/index.js`
- Create: `tests/games.test.ts`
- Modify: `hooks/board.js:1` (import path)
- Modify: `tests/board.test.ts:2` (import path)

**Interfaces:**
- Produces: `GAMES` (array of game objects) and `gameById(id) → game | undefined` from `hooks/games/index.js`.
- Produces: the game object shape: `id`, `title`, `hint`, `fits(size)`, `start(size)`, `restore(saved, size)`, `key(state, key)`, `stepMs(state)`, `step(state)`, `score(state)`, `isOver(state)`, `draw(state, elements)`. `size` is `{ columns, rows }` of the play area.

- [ ] **Step 1: Move the Snake rules and their tests**

```bash
cd ~/projects/sidequest
mkdir -p hooks/games/snake
git mv hooks/game.js hooks/games/snake/rules.js
git mv tests/game.test.ts tests/snake.test.ts
sed -i '' "s#'../hooks/game.js'#'../hooks/games/snake/rules.js'#" tests/snake.test.ts tests/board.test.ts
sed -i '' "s#from './game.js'#from './games/snake/rules.js'#" hooks/board.js
```

- [ ] **Step 2: Run the tests: all 34 still pass**

Run: `command claude plugin test ~/projects/sidequest`
Expected: `34 pass`, `0 fail`.

- [ ] **Step 3: Write the failing game-list test**

Create `tests/games.test.ts`:

```ts
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
```

Add these Snake tests at the end of the `describe('game', ...)` block in `tests/snake.test.ts`, and add `import snake from '../hooks/games/snake/index.js'` under the first import:

```ts
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
```

- [ ] **Step 4: Run the tests to see them fail**

Run: `command claude plugin test ~/projects/sidequest`
Expected: FAIL. `games.test.ts` and `snake.test.ts` cannot find `../hooks/games/index.js` and `../hooks/games/snake/index.js`.

- [ ] **Step 5: Write the Snake object**

Create `hooks/games/snake/index.js`:

```js
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
```

Create `hooks/games/index.js`:

```js
import snake from './snake/index.js'

export const GAMES = [snake]

export function gameById(id) {
  return GAMES.find((game) => game.id === id)
}
```

- [ ] **Step 6: Run the tests: all pass**

Run: `command claude plugin test ~/projects/sidequest`
Expected: `45 pass`, `0 fail`.

- [ ] **Step 7: Commit**

```bash
cd ~/projects/sidequest
git add -A hooks tests
git commit -m "Make Snake a game object in a game list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Menu logic

**Files:**
- Create: `hooks/menu.js`
- Create: `tests/menu.test.ts`

**Interfaces:**
- Produces: `openMenu(ids: string[], currentId: string) → { ids, index }`.
- Produces: `menuKey(menu, key: string) → { action: 'close' } | { action: 'pick', id } | { action: 'move', menu } | { action: 'none' }`.
- Produces: `menuLines(menu, currentId: string, describe: (id) => { title, best }) → string[]`.

- [ ] **Step 1: Write the failing test**

Create `tests/menu.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to see it fail**

Run: `command claude plugin test ~/projects/sidequest`
Expected: FAIL. `tests/menu.test.ts` cannot find `../hooks/menu.js`.

- [ ] **Step 3: Write the menu logic**

Create `hooks/menu.js`:

```js
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
```

- [ ] **Step 4: Run the tests: all pass**

Run: `command claude plugin test ~/projects/sidequest`
Expected: `52 pass`, `0 fail`.

- [ ] **Step 5: Commit**

```bash
cd ~/projects/sidequest
git add hooks/menu.js tests/menu.test.ts
git commit -m "Add game menu logic

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `/sidequest` command and `sidequest` pane

**Files:**
- Modify: `hooks/register.js` (pane id, command, game argument, `lastGame`, offer label)
- Modify: `tests/world.ts`, `tests/turns.test.ts`, `tests/store.test.ts`, `tests/board.test.ts`, `tests/review.test.ts` (names)

**Interfaces:**
- Consumes: `GAMES`, `gameById` from `hooks/games/index.js` (Task 1).
- Produces: `currentGame` (module variable in `register.js`, always a valid game id), store key `lastGame`, command `sidequest`.

- [ ] **Step 1: Rename the command and pane in the tests**

```bash
cd ~/projects/sidequest
sed -i '' -e "s/'snake'/'sidequest'/g" -e "s#'/snake#'/sidequest#g" tests/world.ts tests/turns.test.ts tests/store.test.ts tests/board.test.ts tests/review.test.ts
grep -n "snake" tests/world.ts tests/turns.test.ts tests/store.test.ts tests/board.test.ts tests/review.test.ts
```

Expected grep output: only the import line in `tests/board.test.ts` (`../hooks/games/snake/rules.js`).

- [ ] **Step 2: Write the failing command tests**

Add these tests at the end of the `describe('turns', ...)` block in `tests/turns.test.ts`, and change its import line to `import { runCommand, startSession, world } from './world.ts'`:

```ts
  test('/sidequest snake opens the pane and remembers Snake', async ($, on) => {
    const w = world(on)
    await startSession($)
    await runCommand($, 'snake')
    expect(w.panes.opened).toEqual(['sidequest'])
    expect(await $.store.get('lastGame')).toBe('snake')
  })

  test('/sidequest Snake with a capital letter opens Snake too', async ($, on) => {
    const w = world(on)
    await startSession($)
    await runCommand($, 'Snake')
    expect(w.panes.opened).toEqual(['sidequest'])
  })

  test('/sidequest with an unknown game says which games there are', async ($, on) => {
    const w = world(on)
    await startSession($)
    const result = await runCommand($, 'chess')
    expect(result.text).toBe('No game named chess. Games: snake.')
    expect(w.panes.opened).toEqual([])
  })

  test('the offer above the prompt names the game', async ($, on) => {
    const w = world(on)
    w.setPlaced(false)
    await startSession($)
    await $.turn.start({ text: 'go', turnId: 't1' })
    await w.clock.advance(2000)
    const band = await $.ui.mount({ plugin: 'sidequest', surface: 'terminal', component: 'AbovePrompt', props: {} as any })
    expect((await band.find({ key: 'play' }))?.props.label).toBe('Play Snake while Claude works')
  })
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `command claude plugin test ~/projects/sidequest`
Expected: FAIL. Most tests fail, because the command is still `snake` and the pane id is still `snake`.

- [ ] **Step 4: Change `register.js`**

At the top of `hooks/register.js`, replace:

```js
const PANE = 'snake'
```

with:

```js
import { GAMES, gameById } from './games/index.js'

const PANE = 'sidequest'
```

Under `let isOn = true`, add:

```js
let currentGame = GAMES[0].id
```

In `loadStore`, under the `isOn = ...` line, add:

```js
  currentGame = (gameById(await $.store.get('lastGame')) ?? GAMES[0]).id
```

Under `function cancelTimer() { ... }`, add:

```js
async function chooseGame($, id) {
  currentGame = id
  await $.store.set('lastGame', id)
}
```

Replace each `title: 'snake'` with `title: PANE` (3 places: `dropIn`, `acceptOffer`, the command).

In `session.start`, replace the `$.command.register({...})` argument with:

```js
    await $.command.register({
      name: 'sidequest',
      description: 'Play a game while Claude works',
      argumentHint: '[on|off|<game>]',
    })
```

Replace the whole `on('command.run', { command: 'snake' }, ...)` handler with:

```js
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
```

In the `AbovePrompt` render hook, replace:

```js
        Button({ key: 'play', label: 'Play Snake while Claude works', hotkey: '1', plain: true, onPress: () => acceptOffer($) }),
```

with:

```js
        Button({ key: 'play', label: `Play ${gameById(currentGame).title} while Claude works`, hotkey: '1', plain: true, onPress: () => acceptOffer($) }),
```

- [ ] **Step 5: Run the tests: all pass**

Run: `command claude plugin test ~/projects/sidequest`
Expected: `56 pass`, `0 fail`.

- [ ] **Step 6: Commit**

```bash
cd ~/projects/sidequest
git add hooks/register.js tests
git commit -m "Rename the command to /sidequest and let it pick a game

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The shared frame and one save per game

**Files:**
- Create: `hooks/frame.js`
- Delete: `hooks/board.js`
- Move: `tests/board.test.ts` → `tests/frame.test.ts`
- Modify: `hooks/register.js` (full new version below)
- Modify: `tests/store.test.ts` (post shape, new tests)

**Interfaces:**
- Consumes: `GAMES`, `gameById` (Task 1); `openMenu`, `menuKey`, `menuLines` (Task 2); `currentGame`, `chooseGame`, `lastGame` (Task 3).
- Produces: Client props `{ gameId, saves: { <id>: { state, best } }, isPaused, isClaudeWorking, countdown }`; frame posts `{ gameId, state, best }` and `{ lastGame }`; store keys `game:<id>`, `best:<id>`.

- [ ] **Step 1: Move the board tests to frame tests and change them**

```bash
cd ~/projects/sidequest
git mv tests/board.test.ts tests/frame.test.ts
sed -i '' -e "s/describe('board'/describe('frame'/" -e "s/{ game: huge }/{ 'game:snake': huge }/" -e "s/{ game: saved }/{ 'game:snake': saved }/" tests/frame.test.ts
```

Add these tests at the end of the `describe('frame', ...)` block in `tests/frame.test.ts`:

```ts
  test('the status line names the game', async ($, on) => {
    const { ui } = await openBoard($, on)
    expect(await shown(ui)).toContain('Snake · Score 0 · Best 0')
  })

  test('with one game, m does nothing and the hint offers no menu', async ($, on) => {
    const { ui } = await openBoard($, on)
    await ui.key({ key: 'm', in: 'board' })
    expect(await shown(ui)).not.toContain('choose')
    await ui.key({ key: 'up', in: 'board' })
    expect(await shown(ui)).toContain('Arrows or WASD turn · Space pauses')
    expect(await shown(ui)).not.toContain('m games')
  })

  test('a last game that is not in the list opens the first game', async ($, on) => {
    const { ui } = await openBoard($, on, { lastGame: 'gone' })
    expect(await shown(ui)).toContain('Snake · Score 0')
  })

  test('the board keeps its key and module', async ($, on) => {
    const { ui } = await openBoard($, on)
    const client = await ui.find({ type: 'Client' })
    expect(client?.props.module).toContain('frame.js')
  })
```

- [ ] **Step 2: Change the store tests**

In `tests/store.test.ts`, replace:

```ts
    await ui.post({ game: null, best: 12 }, { in: 'board' })
```

with:

```ts
    await ui.post({ gameId: 'snake', state: null, best: 12 }, { in: 'board' })
```

Add this import under the first import line of `tests/store.test.ts`:

```ts
import { newGame } from '../hooks/games/snake/rules.js'
```

Add these tests at the end of the `describe('store', ...)` block:

```ts
  test('old keys from before many games move to Snake once', async ($, on) => {
    const saved = { ...newGame(20, 10, () => 0), score: 7 }
    world(on, { best: 12, game: saved })
    await startSession($)
    expect(await $.store.get('best')).toBeUndefined()
    expect(await $.store.get('game')).toBeUndefined()
    expect(await $.store.get('best:snake')).toBe(12)
    const ui = await openBoard($)
    expect(await shown(ui)).toContain('Score 7')
    expect(await shown(ui)).toContain('Best 12')
  })

  test('an old store with only a saved game moves it to Snake', async ($, on) => {
    const saved = { ...newGame(20, 10, () => 0), score: 5 }
    world(on, { game: saved })
    await startSession($)
    expect(await $.store.get('game:snake')).toEqual(saved)
    const ui = await openBoard($)
    expect(await shown(ui)).toContain('Score 5')
  })

  test('old keys do not replace new ones', async ($, on) => {
    world(on, { best: 3, 'best:snake': 20 })
    await startSession($)
    expect(await $.store.get('best:snake')).toBe(20)
    expect(await $.store.get('best')).toBeUndefined()
  })

  test('a post that names an unknown game changes nothing', async ($, on) => {
    const w = world(on)
    await startSession($)
    let ui = await openBoard($)
    await ui.post({ gameId: 'gone', state: { x: 1 }, best: 99 }, { in: 'board' })
    await ui.post({ gameId: '__proto__', state: { x: 1 }, best: 99 }, { in: 'board' })
    await abortTurn($, w)
    await ui.unmount()

    await startSession($)
    ui = await openBoard($)
    expect(await shown(ui)).toContain('Best 0')
    expect(await $.store.get('best:gone')).toBeUndefined()
  })
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `command claude plugin test ~/projects/sidequest`
Expected: FAIL. The new frame and store tests fail: no game name in the status line, the module is `board.js`, old keys are not moved, the post shape is not read.

- [ ] **Step 4: Write the frame**

Create `hooks/frame.js`:

```js
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
```

- [ ] **Step 5: Replace `register.js` and delete `board.js`**

```bash
cd ~/projects/sidequest
git rm -q hooks/board.js
```

Replace the whole of `hooks/register.js` with:

```js
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
      return {}
    }
    if (!gameById(e.data.gameId)) return {}
    const save = saves[e.data.gameId]
    save.state = e.data.state ?? null
    if (typeof e.data.best === 'number' && e.data.best > save.best) {
      save.best = e.data.best
      await $.store.set(`best:${e.data.gameId}`, save.best)
    }
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
```

- [ ] **Step 6: Run the tests: all pass**

Run: `command claude plugin test ~/projects/sidequest`
Expected: `64 pass`, `0 fail`.

- [ ] **Step 7: Validate the plugin**

Run: `command claude plugin validate ~/projects/sidequest`
Expected: `✔ Validation passed`, and the `surface modules` line names `hooks/frame.js`.

- [ ] **Step 8: Commit**

```bash
cd ~/projects/sidequest
git add -A hooks tests
git commit -m "Run games in a shared frame with one save per game

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: README and the old best score

**Files:**
- Modify: `README.md`
- Modify (by hand, not in git): `~/.claude/plugins/store/sidequest_inline-45d1ffb6c7dd.json`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Change the README**

In `README.md`, replace the line block that starts with `Commands: \`/snake\` opens it now` and ends with `` `/snake on` turns that back on.`` with:

```markdown
Commands:

- `/sidequest` opens the pane with the last game.
- `/sidequest snake` opens Snake.
- `/sidequest off` stops it opening by itself. `/sidequest on` turns that
  back on.

With 2 or more games, press `m` in the pane to pick a game.
```

Add this section before `## Load it`:

````markdown
## Add a game

1. Make a folder `hooks/games/<id>/` with an `index.js`.
2. Its default export is an object with these parts. The state must be plain
   JSON data, because it is saved.

   | Part | What it does |
   | --- | --- |
   | `id`, `title`, `hint` | Name in the command, name on screen, help line |
   | `fits(size)` | `size` is `{ columns, rows }` of the play area |
   | `start(size)` | A new game |
   | `restore(saved, size)` | The saved game, or `null` |
   | `key(state, key)` | The next state, or `null` for a key the game does not use |
   | `stepMs(state)` | Time between moves in ms, or `null` |
   | `step(state)` | One move |
   | `score(state)`, `isOver(state)` | For the status line |
   | `draw(state, { Box, Text })` | The play area, walls included |

3. Add it to the list in `hooks/games/index.js`.
4. Run the tests. `tests/games.test.ts` checks every game in the list.

The frame owns `Space` (pause) and `m` (menu). `Esc` gives the focus back to
the terminal, so no game can use it.
````

- [ ] **Step 2: Run the tests and validation**

Run: `command claude plugin test ~/projects/sidequest && command claude plugin validate ~/projects/sidequest`
Expected: `64 pass`, `0 fail`, `✔ Validation passed`.

- [ ] **Step 3: Commit**

```bash
cd ~/projects/sidequest
git add README.md
git commit -m "Document /sidequest and how to add a game

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Put the old best score back (by hand, once)**

```bash
STORE=~/.claude/plugins/store/sidequest_inline-45d1ffb6c7dd.json
OLD=$(jq '.best // 0' ~/.claude/plugins/store/snake-pane_inline-0d5685ced8fc.json)
jq --argjson old "$OLD" '.["best:snake"] = ([.["best:snake"] // 0, .best // 0, $old] | max)' "$STORE" > "$STORE.new" && mv "$STORE.new" "$STORE"
jq '.["best:snake"]' "$STORE"
```

Expected: `23` (or higher). Ask the person to restart Claude Code, then run `jq '.["best:snake"]' ~/.claude/plugins/store/sidequest_inline-45d1ffb6c7dd.json` again. If it is no longer `23` or higher, run the step again while Claude Code is closed.

- [ ] **Step 5: Push**

```bash
cd ~/projects/sidequest
git push
```

Expected: `main -> main`.
