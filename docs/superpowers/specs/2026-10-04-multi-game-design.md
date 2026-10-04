# Sidequest — many games — design

Date: 2026-10-04

## Goal

Change the structure of the plugin so it can hold many games, not only Snake.
Adding a game later must take one new folder and one line in a list.

## What the person asked for

- A structure that holds many games. Snake is the only game for now.
- When there are 2 or more games: the pane opens the last game played, and a
  key opens a small game menu in the pane.
- The command becomes `/sidequest`. `/snake` goes away.
- A shared frame does the Claude parts. Each game has only its rules, drawing
  and keys.

## Assumptions

- The Claude behaviour does not change: open after 2 s, close at once when
  Claude needs the person, count down 3 s when Claude is done, the narrow
  terminal offer above the prompt.
- Snake plays exactly as it does now.
- The saved Snake game and the best score survive the change.

## Files

```
hooks/
  hooks.json         unchanged: { "modules": ["./register.js"] }
  register.js        Claude side: open/close timing, /sidequest, saving
  frame.js           the Client module: status line, pause, menu, size check
  menu.js            menu logic only, pure functions
  games/
    index.js         export const GAMES = [snake]
    snake/
      index.js       Snake's game object
      rules.js       Snake rules (today's hooks/game.js)
tests/
  world.ts           test helpers (pane id and command renamed)
  turns.test.ts      Claude timing (renamed command)
  store.test.ts      saving (new keys, old keys moved)
  review.test.ts     unchanged behaviour
  frame.test.ts      today's board.test.ts, through the frame
  menu.test.ts       menu logic with 2 fake games
  games.test.ts      the game-object check, run on every game in GAMES
  snake.test.ts      today's game.test.ts
```

`hooks/board.js` and `hooks/game.js` are removed. A Client module path must be
a string literal and `import()` is not allowed, so the game list is a static
import in `hooks/games/index.js`.

## The game object

Each game's `index.js` has a default export with these parts. The game state is
plain JSON, because the frame saves it.

| Part | Type | What it does |
| --- | --- | --- |
| `id` | string | Store key and command name, for example `snake`. Lower case, no spaces. |
| `title` | string | Shown in the status line, the menu and the offer button. |
| `hint` | string | Help line while playing, for example `Arrows or WASD turn`. |
| `fits(size)` | `({columns, rows}) → boolean` | True when the play area is big enough. |
| `start(size)` | `({columns, rows}) → state` | A new game that fills the play area. |
| `restore(saved, size)` | `(unknown, {columns, rows}) → state \| null` | The saved game fitted to the play area, or `null` when it is not a valid game of this kind or does not fit. |
| `key(state, key)` | `(state, string) → state \| null` | The state after a key. `null` when the game does not use the key. |
| `stepMs(state)` | `state → number \| null` | Time between two moves, in ms. `null` when the game does not move by itself. |
| `step(state)` | `state → state` | One move of the game. |
| `score(state)` | `state → number` | The score now. |
| `isOver(state)` | `state → boolean` | True after game over. |
| `draw(state, elements)` | `(state, ClientElements) → element` | Draws the play area, walls included. |

`size` is the play area in terminal cells: the pane body less the status line
and the hint line. The game decides its own cell size (Snake uses 2 columns a
cell) and its own walls.

The frame counts the time, so a game does not redraw or save while nothing
moves. Snake's `stepMs` is today's `tickMs` and its `step` is today's `step`.
The saved Snake game keeps its shape.

## The frame (`hooks/frame.js`)

The Client module in the pane. It does what `board.js` does now, for any game:

- Draws: status line, the game's `draw`, hint line.
- Status line: `<title> · Score <n> · Best <n> · <Claude status>`, Claude status
  as now (`● Claude is working`, `✓ Claude is done`, `Claude is done · back in N`).
- Hint line, first match wins:
  1. Paused by Claude: `Paused while Claude hands you back`.
  2. Menu open: `↑↓ choose · Enter play · m back`.
  3. Game over: `Game over · Space to play again`.
  4. Paused: `Paused · click the board, then press a key to play`.
  5. Playing: `<hint> · Space pauses`, plus ` · m games` when there are 2 or
     more games.
- Size: when the game's `fits` is false, shows `Make the pane bigger to play.`
  When the size changes, it calls `restore` with the current state, else
  `start`, and pauses.
- Timing: one 16 ms frame clock. While playing (not paused, not paused by
  Claude, menu closed, not over) it adds 16 ms to its count, and calls `step`
  each time the count reaches `stepMs`, keeping what is left over, the way
  `board.js` does now.
- Keys reach the frame only after the person clicks the pane. `Esc` gives the
  focus back to the terminal, so the frame never uses it.
  - `Space`: pause or play; after game over, a new game.
  - `m`: open or close the menu, only with 2 or more games.
  - Any other key goes to the game's `key`. A used key (not `null`) also
    starts play.
  - While paused by Claude, no key does anything.
- Saving: after each change it posts
  `{ gameId, state, best }` to the hooks module, as `board.js` does now.
  Picking a game also posts `{ lastGame }`.

## The menu (`hooks/menu.js`)

Pure functions over `{ games, index }`, tested apart from the frame:

- Opens on the current game. `↑`/`w` and `↓`/`s` move, wrapping at the ends.
- `Enter` or `Space` picks. The picked game opens from its saved state, paused.
- `m` closes the menu with no change.
- Each line: the title and the best score. The current game is marked.
- While the menu is open the game does not move.

## Data flow

1. `register.js` renders the pane's Client with props:
   `{ gameId, saves: { <id>: { state, best } }, isPaused, isClaudeWorking, countdown }`.
2. The frame posts `{ gameId, state, best }` on each change, and
   `{ lastGame }` when a game is picked.
3. `register.js` keeps these in memory and writes them to the store as it does
   now: the best score when it goes up, the game when the pane closes,
   `lastGame` when it changes.

## Store

| Key | Value |
| --- | --- |
| `isOn` | auto-open on or off (unchanged) |
| `lastGame` | the id of the game the pane opens |
| `game:<id>` | the saved game of that game |
| `best:<id>` | the best score of that game |

At session start, when `best:snake` is missing and `best` is there, the old
keys `best` and `game` move to `best:snake` and `game:snake`, and the old keys
are removed.

The old plugin id `snake-pane` had its own store file, with a best score of 23.
The new store has 8. One time, by hand, the higher score goes into the new
store as `best:snake`. This is not code.

## Command

| Command | What happens |
| --- | --- |
| `/sidequest` | Opens the pane with the last game. |
| `/sidequest <id>` | Opens the pane with that game, and makes it the last game. |
| `/sidequest off` | Stops the auto-open (unchanged behaviour). |
| `/sidequest on` | Turns the auto-open back on (unchanged behaviour). |
| `/sidequest <unknown>` | Text: `No game named <x>. Games: snake.` The pane does not open. |

The argument is not case sensitive: `/sidequest Snake` opens Snake.

The pane id and the pane title become `sidequest`. The offer above the prompt
says `Play <title> while Claude works`, with the last game's title.

## When things go wrong

- `restore` gives `null`: a new game starts, paused.
- `lastGame` names a game that is not in `GAMES`: the first game is used.
- A game in `GAMES` with a missing or wrong part: `games.test.ts` fails.
- A post from the frame that names a game not in `GAMES` is ignored.

## Tests

Each test is written before its code (TDD).

- The 34 tests now in the repo stay, with new names: `/snake` → `/sidequest`,
  pane id `snake` → `sidequest`, new file names.
- `games.test.ts`: for every game in `GAMES`: all parts are there; `start`
  gives JSON-safe state that `fits`; `restore(start(size), size)` gives it
  back; `restore` of junk gives `null`; `key` of an unused key gives `null`;
  ids are unique; `stepMs` is a positive number or `null`.
- `menu.test.ts`: with 2 fake games: moves, wraps, picks, closes.
- `store.test.ts`: old keys `best` and `game` move to the new keys once.
- `turns.test.ts`: `/sidequest snake` opens Snake; an unknown name gives the
  message and no pane.

## Out of scope

- A second game.
- Sound, colours per game theme, settings per game.
