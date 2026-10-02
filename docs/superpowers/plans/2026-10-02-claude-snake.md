# claude-snake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Claude Code plugin that opens a text-drawn Snake game in a side pane while Claude works, pauses it when Claude is done or needs the person, and works in Warp.

**Architecture:** Three files. `hooks/game.js` holds the pure rules. `hooks/board.js` is a `Client` surface module that runs and draws the game inside the pane. `hooks/register.js` is the hooks module: it watches the turn, opens and closes the pane, and keeps the saved game and best score in `$.store`.

**Tech Stack:** Claude Code 2.1.287 function hooks (plain ES modules, no Node, no npm dependencies). Tests are `*.test.ts` files run by `claude plugin test`, importing from `claude-code/testing`.

**Spec:** `docs/superpowers/specs/2026-10-02-claude-snake-design.md`

## Global Constraints

- Plugin folder: `~/projects/claude-snake`. Plugin name: `claude-snake`. Pane id: `snake`. Command: `/snake`.
- The person's shell wraps `claude` in a function that adds a flag the `plugin` subcommands reject. Always call the binary directly: `/Users/farhad/.local/bin/claude`.
- Hooks code is JavaScript ES modules (`.js`). No `import()`, no `require`, no Node APIs: the environment has none.
- Drawing is text only (`Box`, `Text`, `Client`). Never `Image`: Warp cannot show it.
- Each board square is 2 terminal columns wide.
- Drop-in delay: 2000 ms. Countdown: 3 seconds.
- Speed: 125 ms per move at the start, 10 ms faster every 5 foods, never faster than 60 ms.
- Auto-open is on by default. `/snake off` and `/snake on` change it; `/snake` opens the game now.
- Code comments: none, unless the code cannot say the why itself (the person's global rule).
- Type reference for this build: `/private/tmp/claude-501/bundled-skills/2.1.287/e499c274555de1027c793c8a2fc2d692/plugin-authoring/types/claude-code.d.ts`. After the plugin first loads, the same file is at `.claude-plugin/types/claude-code/index.d.ts`. Grep it for a name when a call is refused.

## Deviation from the spec

- The spec says `$.ui.open({ ..., focus: true })`. The plan opens the pane **without** `focus`. A pane opened with `focus` takes the keyboard, so a person typing their next prompt would lose keys when the pane pops up. The board gets the keys from a click anyway, so nothing is lost.
- The spec's `fits(state, width, height)` is `fitTo(state, width, height)`: it returns the game moved to the new size, or `null`. One function, so the caller cannot check one way and resize another.

## Review Focus

1. **A key press right before a move into the tail's old square.** The tail moves away in the same step, so the move is legal. The person expects the snake to live. Pinned in Task 1 (`moving into the tail square is safe`).
2. **Two fast arrow presses that would reverse the snake (right → up → down within one tick).** The person expects a U-turn, not death or a dropped key. Pinned in Task 1 (`a quick reversal through a queued turn is ignored`) and (`two queued turns play in order`).
3. **A saved game from a bigger pane.** The pane can be narrower next time. The person expects a fresh game, not a crash or a snake drawn outside the walls. Pinned in Task 1 (`fitTo`) and Task 2 (`a saved game that does not fit starts a new one`).
4. **Claude asks for permission while the snake is running.** The person expects the pane to close at once and the game to be there, paused, next time. Pinned in Task 3 (`a permission ask closes the pane at once`) and Task 4 (`the game survives a close and comes back paused`).
5. **A pane too small to play.** The person expects a short message, not an error. Pinned in Task 2 (`a tiny pane asks for more room`).

---

### Task 1: Plugin skeleton and game rules

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `hooks/hooks.json`
- Create: `hooks/register.js` (empty registrar for now)
- Create: `hooks/game.js`
- Create: `.gitignore`
- Test: `tests/game.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (all from `hooks/game.js`):
  - `MIN_WIDTH: 8`, `MIN_HEIGHT: 4`
  - `newGame(width: number, height: number, random?: () => number): Game`
  - `turn(game: Game, direction: 'up'|'down'|'left'|'right'): Game`
  - `step(game: Game, random?: () => number): Game`
  - `tickMs(game: Game): number`
  - `fitTo(value: unknown, width: number, height: number): Game | null`
  - `Game = { width, height, snake: [x, y][] (head first), direction, queued: direction[], food: [x, y] | null, score: number, isOver: boolean }`

- [ ] **Step 1: Write the manifests**

`.claude-plugin/plugin.json`:

```json
{
  "name": "claude-snake",
  "version": "0.1.0",
  "description": "Play Snake in a side pane while Claude works; works in any terminal"
}
```

`hooks/hooks.json`:

```json
{ "modules": ["./register.js"] }
```

`hooks/register.js`:

```js
/** @type {import('claude-code').Register} */
export const register = () => {}
```

`.gitignore`:

```
.claude-plugin/types/
tsconfig.json
```

- [ ] **Step 2: Write the failing tests**

`tests/game.test.ts`:

```ts
import { describe, expect, test } from 'claude-code/testing'
import { fitTo, newGame, step, tickMs, turn } from '../hooks/game.js'

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
    expect(tickMs(game)).toBe(125)
    expect(tickMs({ ...game, score: 5 })).toBe(115)
    expect(tickMs({ ...game, score: 100 })).toBe(60)
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
})
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `/Users/farhad/.local/bin/claude plugin test ~/projects/claude-snake`
Expected: FAIL, the import of `../hooks/game.js` cannot be found.
If the runner instead refuses to import a plugin file from a test at all, stop and report: the test layout must change before going on.

- [ ] **Step 4: Write the rules**

`hooks/game.js`:

```js
export const MIN_WIDTH = 8
export const MIN_HEIGHT = 4

const MOVES = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' }
const START_TICK_MS = 125
const FASTEST_TICK_MS = 60
const FOODS_PER_SPEEDUP = 5
const SPEEDUP_MS = 10
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
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `/Users/farhad/.local/bin/claude plugin test ~/projects/claude-snake`
Expected: all 14 `game` tests PASS.

- [ ] **Step 6: Validate the plugin**

Run: `/Users/farhad/.local/bin/claude plugin validate ~/projects/claude-snake`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd ~/projects/claude-snake
git add .claude-plugin/plugin.json hooks tests .gitignore
git commit -m "Add plugin skeleton and Snake rules"
```

---

### Task 2: The board in the pane, opened by `/snake`

**Files:**
- Create: `hooks/board.js`
- Modify: `hooks/register.js` (replace whole file)
- Create: `tests/world.ts` (shared test helper)
- Test: `tests/board.test.ts`

**Interfaces:**
- Consumes: `newGame`, `turn`, `step`, `tickMs`, `fitTo`, `MIN_WIDTH`, `MIN_HEIGHT` from `hooks/game.js`.
- Produces:
  - Board props (plain JSON, set by `register.js`): `{ game: Game | null, best: number, isPaused: boolean, isClaudeWorking: boolean, countdown: number | null }`. `isPaused` true means the boss holds the game still (the countdown).
  - Board posts (`surface.post`): `{ game: Game, best: number }`, after every move and every key that changes the game.
  - `register.js` module state used by later tasks: `phase`, `isTurnRunning`, `savedGame`, `best`, `boardProps()`, `PANE = 'snake'`.
  - `tests/world.ts`: `world(on, stored?)` → `{ clock, panes: { opened: string[], closed: string[] }, setPlaced(isPlaced: boolean) }`; `PANE_MOUNT`; `runCommand($, args)`.

- [ ] **Step 1: Write the test helper**

`tests/world.ts`:

```ts
import { mock } from 'claude-code/testing'
import type { On } from 'claude-code'

export function world(on: On, stored: Record<string, unknown> = {}) {
  const clock = mock.clock(on)
  mock.store(on, stored)
  const panes = { opened: [] as string[], closed: [] as string[] }
  let isPlaced = true
  on('ui.open', ($, e) => {
    panes.opened.push(e.id)
    return { value: isPlaced ? { isPlaced: true } : { isPlaced: false, reason: 'the terminal is 120 columns, under 144' } }
  })
  on('ui.close', ($, e) => {
    panes.closed.push(e.id)
    return { value: undefined }
  })
  on('ui.invalidate', () => ({ value: undefined }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  return {
    clock,
    panes,
    setPlaced(value: boolean) {
      isPlaced = value
    },
  }
}

export const PANE_MOUNT = {
  plugin: 'claude-snake',
  surface: 'terminal',
  component: 'Pane',
  requestId: 'snake',
  viewport: { columns: 160, rows: 40, isFullscreen: true },
  props: { title: 'snake', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

export async function startSession($: any) {
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
}

export async function runCommand($: any, args: string) {
  return $.command.run({ command: 'snake', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
}
```

If a test later fails with "the bottom hook throws" naming another event (for example `ui.log` or `session.start`), add an `on(<that event>, ...)` answer here in the same style and note it in the commit message.

- [ ] **Step 2: Write the failing tests**

`tests/board.test.ts`:

```ts
import { describe, expect, test } from 'claude-code/testing'
import { newGame } from '../hooks/game.js'
import { PANE_MOUNT, runCommand, startSession, world } from './world.ts'

const BOARD = { columns: 42, rows: 14 }

async function openBoard($: any, on: any, stored: Record<string, unknown> = {}) {
  const w = world(on, stored)
  await startSession($)
  await runCommand($, '')
  const ui = await $.ui.mount(PANE_MOUNT)
  await ui.resize({ ...BOARD, in: 'board' })
  await ui.advance(25)
  return { ui, w }
}

async function shown(ui: any) {
  const texts = await ui.findAll({ type: 'Text', in: 'board' })
  return texts.map((t: any) => t.text).join('\n')
}

describe('board', () => {
  test('/snake opens the pane and the board starts paused', async ($, on) => {
    const { ui, w } = await openBoard($, on)
    expect(w.panes.opened).toEqual(['snake'])
    expect(await shown(ui)).toContain('Score 0')
    expect(await shown(ui)).toContain('Paused')
  })

  test('an arrow starts the game and the snake moves on the clock', async ($, on) => {
    const posts: unknown[] = []
    on('ui.message', ($, e) => {
      posts.push(e.data)
      return {}
    })
    const { ui } = await openBoard($, on)
    await ui.key({ key: 'down', in: 'board' })
    await ui.advance(130)
    expect(await shown(ui)).not.toContain('Paused')
    expect(posts.length).toBeGreaterThan(0)
  })

  test('space pauses and resumes', async ($, on) => {
    const { ui } = await openBoard($, on)
    await ui.key({ key: 'up', in: 'board' })
    await ui.key({ key: ' ', in: 'board' })
    expect(await shown(ui)).toContain('Paused')
    await ui.key({ key: ' ', in: 'board' })
    expect(await shown(ui)).not.toContain('Paused')
  })

  test('running into the wall shows game over, space starts again', async ($, on) => {
    const { ui } = await openBoard($, on)
    await ui.key({ key: 'right', in: 'board' })
    await ui.key({ key: 'up', in: 'board' })
    await ui.advance(10_000)
    expect(await shown(ui)).toContain('Game over')
    await ui.key({ key: ' ', in: 'board' })
    expect(await shown(ui)).toContain('Score 0')
    expect(await shown(ui)).not.toContain('Game over')
  })

  test('a saved game that does not fit starts a new one', async ($, on) => {
    const huge = { ...newGame(60, 40, () => 0), score: 7 }
    const { ui } = await openBoard($, on, { game: huge })
    expect(await shown(ui)).toContain('Score 0')
  })

  test('a saved game that fits comes back paused', async ($, on) => {
    const saved = { ...newGame(20, 10, () => 0), score: 7 }
    const { ui } = await openBoard($, on, { game: saved })
    expect(await shown(ui)).toContain('Score 7')
    expect(await shown(ui)).toContain('Paused')
  })

  test('a tiny pane asks for more room', async ($, on) => {
    const { ui } = await openBoard($, on)
    await ui.resize({ columns: 10, rows: 5, in: 'board' })
    await ui.advance(25)
    expect(await shown(ui)).toContain('Make the pane bigger')
  })
})
```

The board at 42 × 14 cells is 20 × 10 squares: `(42 - 2) / 2 = 20` across, `14 - 4 = 10` down.

- [ ] **Step 3: Run the tests to see them fail**

Run: `/Users/farhad/.local/bin/claude plugin test ~/projects/claude-snake`
Expected: the `board` tests FAIL (no `/snake` command, no pane). The `game` tests still PASS.

- [ ] **Step 4: Write the board**

`hooks/board.js`:

```js
import { MIN_HEIGHT, MIN_WIDTH, fitTo, newGame, step, tickMs, turn } from './game.js'

const FRAME_MS = 25
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
  if (state.isPaused || state.props.isPaused || game.isOver) return
  state.elapsedMs += FRAME_MS
  if (state.elapsedMs < tickMs(game)) return
  const next = step(game)
  update(surface, { game: next, best: Math.max(state.best, next.score), elapsedMs: 0 })
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
```

- [ ] **Step 5: Write the boss, part 1 (command and pane)**

`hooks/register.js` (whole file):

```js
const PANE = 'snake'
const MIN_BOARD_ROWS = 8

let isOn = true
let best = 0
let savedGame = null
let phase = 'idle'
let isTurnRunning = false
let countdown = 0

function boardProps() {
  return {
    game: savedGame,
    best,
    isPaused: phase === 'countdown',
    isClaudeWorking: isTurnRunning,
    countdown: phase === 'countdown' ? countdown : null,
  }
}

async function loadStore($) {
  isOn = (await $.store.get('isOn')) !== false
  const storedBest = await $.store.get('best')
  best = typeof storedBest === 'number' ? storedBest : 0
  savedGame = (await $.store.get('game')) ?? null
}

/** @type {import('claude-code').Register} */
export const register = (on) => {
  on('session.start', async ($, e, next) => {
    await loadStore($)
    await $.command.register({
      name: 'snake',
      description: 'Play Snake while Claude works',
      argumentHint: '[on|off]',
    })
    return next(e)
  })

  on('command.run', { command: 'snake' }, async ($) => {
    phase = 'playing'
    await $.ui.open({ id: PANE, title: 'snake' })
    return {}
  })

  on('ui.message', async ($, e) => {
    if (e.element !== 'board') return {}
    savedGame = e.data.game ?? null
    if (typeof e.data.best === 'number' && e.data.best > best) {
      best = e.data.best
      await $.store.set('best', best)
    }
    return {}
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Client } = $.ui.resolve(e)
    if (e.surface !== 'terminal') return Text({ children: ['Snake plays in the terminal.'] })
    return Box({
      children: [
        Client({
          key: 'board',
          module: './board.js',
          props: boardProps(),
          width: e.props.bodyColumns,
          height: Math.max(MIN_BOARD_ROWS, e.props.scroll.bodyRows),
        }),
      ],
    })
  })
}
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `/Users/farhad/.local/bin/claude plugin test ~/projects/claude-snake`
Expected: all `game` and `board` tests PASS.
If `mount` rejects the tree, the error names the element and prop; read that element's props type in the types file and fix the call, not the test.

- [ ] **Step 7: Validate and commit**

Run: `/Users/farhad/.local/bin/claude plugin validate ~/projects/claude-snake`
Expected: no errors; it lists `session.start`, `command.run`, `ui.message`, `ui.render`.

```bash
cd ~/projects/claude-snake
git add hooks tests
git commit -m "Draw the Snake board in a pane opened by /snake"
```

---

### Task 3: Open by itself while Claude works, hand back when done

**Files:**
- Modify: `hooks/register.js`
- Test: `tests/turns.test.ts`

**Interfaces:**
- Consumes: from Task 2, `PANE`, `phase`, `isTurnRunning`, `boardProps()`, `loadStore($)`, and `tests/world.ts` (`world`, `startSession`, `runCommand`).
- Produces: phases `idle | waiting | offered | playing | countdown`; functions `armDropIn($)`, `dropIn($)`, `acceptOffer($)`, `withdrawOffer($)`, `pullOut($)`, `handBack($)`, `startCountdown($)`, `goAway($)`; the offer button keyed `play`, hotkey `1`.

- [ ] **Step 1: Write the failing tests**

`tests/turns.test.ts`:

```ts
import { describe, expect, test } from 'claude-code/testing'
import { startSession, world } from './world.ts'

async function startTurn($: any) {
  await $.turn.start({ text: 'do the thing', turnId: 't1' })
}

async function completeTurn($: any, isAborted = false) {
  await $.turn.complete({ answer: 'done', durationMs: 5000, isAborted, turnId: 't1', reason: isAborted ? 'aborted' : 'answer' })
}

describe('turns', () => {
  test('the pane opens after 2 seconds of a turn, not before', async ($, on) => {
    const w = world(on)
    await startSession($)
    await startTurn($)
    await w.clock.advance(1999)
    expect(w.panes.opened).toEqual([])
    await w.clock.advance(1)
    expect(w.panes.opened).toEqual(['snake'])
  })

  test('a turn shorter than 2 seconds never opens the pane', async ($, on) => {
    const w = world(on)
    await startSession($)
    await startTurn($)
    await w.clock.advance(1000)
    await completeTurn($)
    await w.clock.advance(5000)
    expect(w.panes.opened).toEqual([])
  })

  test('Claude finishing counts down 3 seconds, then closes the pane', async ($, on) => {
    const w = world(on)
    await startSession($)
    await startTurn($)
    await w.clock.advance(2000)
    await completeTurn($)
    await w.clock.advance(2999)
    expect(w.panes.closed).toEqual([])
    await w.clock.advance(1)
    expect(w.panes.closed).toEqual(['snake'])
  })

  test('an aborted turn closes the pane at once', async ($, on) => {
    const w = world(on)
    await startSession($)
    await startTurn($)
    await w.clock.advance(2000)
    await completeTurn($, true)
    expect(w.panes.closed).toEqual(['snake'])
  })

  test('a permission ask closes the pane at once', async ($, on) => {
    const w = world(on)
    on('tool.check', () => ({ decision: 'ask' }))
    await startSession($)
    await startTurn($)
    await w.clock.advance(2000)
    await $.tool.check({ tool: 'Bash', input: { command: 'ls' }, tool_use_id: 'u1' })
    expect(w.panes.closed).toEqual(['snake'])
  })

  test('a narrow terminal offers the game above the prompt instead', async ($, on) => {
    const w = world(on)
    w.setPlaced(false)
    await startSession($)
    await startTurn($)
    await w.clock.advance(2000)
    const band = await $.ui.mount({ plugin: 'claude-snake', surface: 'terminal', component: 'AbovePrompt', props: {} as any })
    expect(await band.find({ key: 'play' })).toBeDefined()
    w.setPlaced(true)
    await band.press({ key: 'play' })
    expect(w.panes.opened).toEqual(['snake', 'snake'])
  })

  test('closing the pane by hand keeps it closed for the rest of the turn', async ($, on) => {
    const w = world(on)
    on('tool.call', () => ({ text: 'ok' }) as any)
    await startSession($)
    await startTurn($)
    await w.clock.advance(2000)
    await $.ui.close({ id: 'snake', origin: { kind: 'person' } } as any)
    await $.tool.call({ tool: 'Bash', input: { command: 'ls' } } as any)
    await w.clock.advance(5000)
    expect(w.panes.opened).toEqual(['snake'])
  })

  test('/snake off stops the auto-open, /snake on brings it back', async ($, on) => {
    const w = world(on)
    await startSession($)
    await $.command.run({ command: 'snake', args: 'off', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
    await startTurn($)
    await w.clock.advance(5000)
    expect(w.panes.opened).toEqual([])
    await $.command.run({ command: 'snake', args: 'on', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
    await w.clock.advance(2000)
    expect(w.panes.opened).toEqual(['snake'])
  })
})
```

The `AbovePrompt` props and the `tool.call` input are cast because their full shapes do not matter here. If `mount` rejects `{}` as `AbovePrompt` props, read `AbovePrompt: {` in the types file and pass the fields it lists.

- [ ] **Step 2: Run the tests to see them fail**

Run: `/Users/farhad/.local/bin/claude plugin test ~/projects/claude-snake`
Expected: the `turns` tests FAIL (nothing opens on `turn.start`). `game` and `board` still PASS.

- [ ] **Step 3: Write the boss, part 2 (phases)**

In `hooks/register.js`, replace everything from `const PANE` down to the end of `loadStore` with:

```js
const PANE = 'snake'
const MIN_BOARD_ROWS = 8
const DROP_IN_DELAY_MS = 2000
const COUNTDOWN_SECONDS = 3

let isOn = true
let best = 0
let savedGame = null
let phase = 'idle'
let isTurnRunning = false
let isDismissed = false
let timer = null
let countdown = 0

function boardProps() {
  return {
    game: savedGame,
    best,
    isPaused: phase === 'countdown',
    isClaudeWorking: isTurnRunning,
    countdown: phase === 'countdown' ? countdown : null,
  }
}

async function loadStore($) {
  isOn = (await $.store.get('isOn')) !== false
  const storedBest = await $.store.get('best')
  best = typeof storedBest === 'number' ? storedBest : 0
  savedGame = (await $.store.get('game')) ?? null
}

function cancelTimer() {
  timer?.cancel()
  timer = null
}

function armDropIn($) {
  if (!isOn || !isTurnRunning || isDismissed || phase !== 'idle') return
  phase = 'waiting'
  timer = $.clock.after(DROP_IN_DELAY_MS, () => void dropIn($))
}

async function dropIn($) {
  if (phase !== 'waiting') return
  timer = null
  const opened = await $.ui.open({ id: PANE, title: 'snake' })
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
  const opened = await $.ui.open({ id: PANE, title: 'snake' })
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
}
```

Then, inside `register`, replace the `command.run` hook with the one below and add the other hooks after it:

```js
  on('command.run', { command: 'snake' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'off') {
      isOn = false
      await $.store.set('isOn', false)
      await handBack($)
      return { text: 'Snake will not open by itself now. /snake on turns it back on.' }
    }
    if (arg === 'on') {
      isOn = true
      await $.store.set('isOn', true)
      armDropIn($)
      return { text: 'Snake opens by itself while Claude works.' }
    }
    cancelTimer()
    phase = 'playing'
    await $.ui.open({ id: PANE, title: 'snake' })
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
        Button({ key: 'play', label: 'Play Snake while Claude works', hotkey: '1', plain: true, onPress: () => acceptOffer($) }),
        ...(others ? [others] : []),
      ],
    })
  })
```

`tool.check` hands back on every `ask`, also in auto mode where a classifier may answer instead of the person. That is on purpose: closing for nothing costs a moment, missing a real question costs more. Keep this as the one comment in the file, above the `tool.check` hook:

```js
  // In auto mode an ask can go to the classifier instead of the person; closing anyway costs a moment, missing a real prompt costs more
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `/Users/farhad/.local/bin/claude plugin test ~/projects/claude-snake`
Expected: all `game`, `board` and `turns` tests PASS.

- [ ] **Step 5: Validate and commit**

Run: `/Users/farhad/.local/bin/claude plugin validate ~/projects/claude-snake`
Expected: no errors.

```bash
cd ~/projects/claude-snake
git add hooks tests
git commit -m "Open Snake while Claude works and hand back when done"
```

---

### Task 4: Keep the game and the best score

**Files:**
- Modify: `hooks/register.js` (`goAway`)
- Test: `tests/store.test.ts`

**Interfaces:**
- Consumes: `goAway($)`, `savedGame`, `best` from Task 3; `world`, `PANE_MOUNT`, `startSession`, `runCommand` from `tests/world.ts`.
- Produces: store keys `isOn: boolean`, `best: number`, `game: Game`.

- [ ] **Step 1: Write the failing tests**

`tests/store.test.ts`:

```ts
import { describe, expect, test } from 'claude-code/testing'
import { PANE_MOUNT, runCommand, startSession, world } from './world.ts'

describe('store', () => {
  test('the game survives a close and comes back paused', async ($, on) => {
    world(on)
    await startSession($)
    await runCommand($, '')
    let ui = await $.ui.mount(PANE_MOUNT)
    await ui.resize({ columns: 42, rows: 14, in: 'board' })
    await ui.advance(25)
    await ui.key({ key: 'up', in: 'board' })
    await ui.advance(130)
    await $.ui.close({ id: 'snake', origin: { kind: 'plugin' } } as any)
    await ui.unmount()

    await startSession($)
    await runCommand($, '')
    ui = await $.ui.mount(PANE_MOUNT)
    await ui.resize({ columns: 42, rows: 14, in: 'board' })
    await ui.advance(25)
    const texts = (await ui.findAll({ type: 'Text', in: 'board' })).map((t: any) => t.text).join('\n')
    expect(texts).toContain('Paused')
    expect(await $.store.get('game')).toMatchObject({ direction: 'up' })
  })

  test('a new best score is stored at once', async ($, on) => {
    world(on)
    await startSession($)
    await runCommand($, '')
    const ui = await $.ui.mount(PANE_MOUNT)
    await ui.post({ game: null, best: 12 }, { in: 'board' })
    expect(await $.store.get('best')).toBe(12)
  })

  test('/snake off is remembered', async ($, on) => {
    world(on)
    await startSession($)
    await $.command.run({ command: 'snake', args: 'off', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
    expect(await $.store.get('isOn')).toBe(false)
  })
})
```

The second `startSession` runs `loadStore` again, the way a new session would, so the game must come from the store and not from the module's memory.

- [ ] **Step 2: Run the tests to see them fail**

Run: `/Users/farhad/.local/bin/claude plugin test ~/projects/claude-snake`
Expected: `the game survives a close and comes back paused` FAILS (the game is not stored). The other two may already pass.

- [ ] **Step 3: Store the game when the pane closes**

In `hooks/register.js`, replace `goAway` with:

```js
async function goAway($) {
  cancelTimer()
  phase = 'idle'
  if (savedGame) await $.store.set('game', savedGame)
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `/Users/farhad/.local/bin/claude plugin test ~/projects/claude-snake`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/projects/claude-snake
git add hooks tests
git commit -m "Keep the Snake game and best score between sessions"
```

---

### Task 5: Load it in Claude Code and try it in Warp

**Files:**
- Create: `README.md`
- Modify: `~/.claude/settings.json` (the `env` block only), after the person says yes

**Interfaces:**
- Consumes: the finished plugin.
- Produces: the plugin loading in every interactive session.

- [ ] **Step 1: Type-check**

The engine writes `.claude-plugin/types/` and a `tsconfig.json` the first time it loads the plugin. Before that, run a one-off check with a config outside the plugin folder:

```bash
mkdir -p /private/tmp/claude-501/snake-tsc
cat > /private/tmp/claude-501/snake-tsc/tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "es2023", "lib": ["es2023"], "types": [],
    "module": "esnext", "moduleResolution": "bundler",
    "allowJs": true, "checkJs": false, "allowImportingTsExtensions": true,
    "strict": true, "noEmit": true, "skipLibCheck": true
  },
  "include": [
    "/private/tmp/claude-501/bundled-skills/2.1.287/e499c274555de1027c793c8a2fc2d692/plugin-authoring/types/claude-code.d.ts",
    "/Users/farhad/projects/claude-snake/hooks",
    "/Users/farhad/projects/claude-snake/tests"
  ]
}
EOF
npx -y -p typescript tsc -p /private/tmp/claude-501/snake-tsc
```

Expected: no errors. Fix real type errors in the tests; the casts already in the tests stay.

- [ ] **Step 2: Write the README**

`README.md`:

````markdown
# claude-snake

Snake in a side pane while Claude works. Text only, so it works in any
terminal, Warp included.

- After Claude has worked for 2 seconds the pane opens, paused.
- Click the board once, then press an arrow (or WASD) to play. Space pauses.
- When Claude needs you, the pane closes at once. When Claude is done, it
  counts down 3 seconds and closes. The game waits, paused, for next time.
- In a terminal under 144 columns, press `1` on the line above the prompt to
  open it.

Commands: `/snake` opens it now, `/snake off` stops it opening by itself,
`/snake on` turns that back on.

## Load it

Add the folder to `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json`:

```json
"env": { "CLAUDE_CODE_PLUGIN_DIRS": "~/projects/claude-snake" }
```

## Test it

```bash
claude plugin test ~/projects/claude-snake
claude plugin validate ~/projects/claude-snake
```
````

- [ ] **Step 3: Commit**

```bash
cd ~/projects/claude-snake
git add README.md
git commit -m "Add README"
```

- [ ] **Step 4: Ask the person before changing their settings**

Ask: "May I add `CLAUDE_CODE_PLUGIN_DIRS` to the `env` block of `~/.claude/settings.json`?" Wait for yes. Then:

```bash
cd ~/.claude
jq '.env = ((.env // {}) + {"CLAUDE_CODE_PLUGIN_DIRS": "~/projects/claude-snake"})' settings.json > settings.json.tmp && mv settings.json.tmp settings.json
jq '.env' settings.json
```

Expected: `{ "CLAUDE_CODE_PLUGIN_DIRS": "~/projects/claude-snake" }`.

- [ ] **Step 5: Hand over the manual test in Warp**

Tell the person to restart Claude Code in Warp, and run `/intermission off` so the Doom sound stops. Then check, one by one:

1. Ask Claude for something slow (for example: "count the lines of every file in ~/projects, one command per folder"). The pane opens after about 2 seconds, paused.
2. Click the board, press an arrow. The snake moves; arrows and WASD turn it.
3. When Claude finishes: "Claude is done · back in 3…", then the pane closes.
4. Start another slow task: the same snake is back, paused.
5. Make the Warp window narrow (under 144 columns) and start a task: the line "Play Snake while Claude works" appears above the prompt; `1` opens it.
6. Close the pane by hand during a task: it stays closed until the next task.

If something looks wrong in Warp (colors, the `██` blocks, the board height), note what you see; the fix goes in `hooks/board.js`.
