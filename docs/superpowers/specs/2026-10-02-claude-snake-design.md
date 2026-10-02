# claude-snake — design

Date: 2026-10-02

## Goal

A Claude Code plugin that opens a Snake game in a side pane while Claude works,
and hands the person back when Claude is done or needs them. It must work in
Warp, so it draws only text cells: no pixel graphics.

## What the person asked for

- A game in its own side pane, not above the prompt.
- It opens by itself when Claude works, like intermission.
- It works in Warp.
- The game is Snake.
- The game pauses when Claude is done, and the same game continues next time.

## Assumptions

- For personal use; not published.
- No sound.
- The best score survives a Claude Code restart.

## Behaviour

### When the pane opens and closes

| Moment | What happens |
| --- | --- |
| Claude has worked for 2 s (`turn.start` + 2 s timer) | The pane opens with the game **paused**: "Click the board, then press an arrow to play". |
| The terminal is narrower than 144 columns | The pane cannot open by itself. A button above the prompt offers it: "Play Snake while Claude works", hotkey `1`. |
| Claude needs the person (`tool.check` returns `ask`, or `AskUserQuestion` is called) | The game pauses and the pane closes at once. |
| The person answers and Claude carries on | The 2 s timer starts again. |
| Claude finishes (`turn.complete`, not a subagent) | The game pauses. The pane shows "Claude is done · back in 3…", counts down, then closes. |
| The turn is aborted | The game pauses and the pane closes at once. |
| A queued prompt starts during the countdown | The countdown stops and the game stays open, still paused. |
| The person closes the pane during a turn | It stays closed until the next turn. |
| The pane opens again | The saved snake comes back, paused. |

### The game

- The board fills the pane. Each board square is 2 terminal columns wide, so
  squares look square.
- Snake: green. Food: red. Wall: a gray border.
- Arrow keys or WASD turn the snake. A turn straight back into the body is
  ignored. Two quick presses inside one tick are both kept, in order.
- Space pauses and resumes. After game over, Space starts a new game.
- The snake starts at 16 moves a second (63 ms a move) and gets faster every 5 foods, up to a
  limit.
- Hitting the wall or the body ends the game: "Game over · Space to play again".
- The top line: score, best score, and Claude's state (`● working` or
  `✓ done`).
- If the pane is resized, a running game pauses. If the saved snake no longer
  fits the new board, a new game starts.

### Commands

- `/snake` opens the game now, also when Claude is not working.
- `/snake off` turns the auto-open off. `/snake on` turns it back on. On by
  default.

## Architecture

Two units, plus a pure game core.

### `hooks/game.js` — the rules (pure)

No Claude Code API. Plain functions on plain data, so it is easy to test.

- `newGame(width, height, random)` → state
- `turn(state, direction)` → state (queues the turn; ignores reversal)
- `step(state, random)` → state (moves one square; eats, grows, speeds up, or
  ends the game)
- `tickMs(state)` → how long one move takes now
- `fits(state, width, height)` → whether a saved game fits a board

State is plain JSON: board size, snake squares, direction, queued turns, food,
score, `isOver`. Food placement takes a `random` function so tests are
repeatable.

### `hooks/board.js` — the surface module (runs in the pane)

The `Client` module drawn inside the pane. It owns the running game.

- Reads keys with `surface.onKey`. The person must click the board once to
  give it the keys; that is how Claude Code routes keys to a `Client`.
- Runs the game with `surface.every`, at `tickMs(state)`.
- Draws with `Box` and `Text` from `surface.elements`: one `Text` per board
  row, made of coloured runs.
- Gets from the boss, through props: the saved game, the best score,
  `isPaused` (forced by the boss), and Claude's state.
- Posts to the boss with `surface.post`: the game state after every change,
  and a new best score. At most one post per frame, which is the engine's
  limit anyway.

### `hooks/register.js` — the boss (hooks module)

- Phases, the same shape as intermission: `idle`, `waiting`, `offered`,
  `playing`, `countdown`.
- Events: `session.start` (load the store, register `/snake`), `command.run`,
  `turn.start`, `turn.complete`, `tool.check`, `tool.call`, `ui.close`,
  `ui.message`, and `ui.render` for `Pane` and `AbovePrompt`.
- Opens the pane with `$.ui.open({ id: 'snake', title: 'snake', focus: true })`.
  When `isPlaced` is false, it closes the request and moves to `offered`.
- Before it closes the pane, it redraws with `isPaused: true`.
- Keeps the last posted game in memory and in `$.store` (`game`), and the best
  score in `$.store` (`best`), plus `isOn`.

### Data flow

```
turn.start ──► boss: wait 2 s ──► $.ui.open ──► Pane render ──► Client(board.js, props)
                                                                     │
                     keys ──► board.js: turn / step / draw           │
                                         │                           │
                       surface.post(game, best) ──► ui.message ──► boss: save to $.store
turn.complete ──► boss: props.isPaused = true, countdown ──► $.ui.close
```

## Files

```
~/projects/claude-snake/
  .claude-plugin/plugin.json
  hooks/hooks.json          { "modules": ["./register.js"] }
  hooks/register.js
  hooks/board.js
  hooks/game.js
  tests/game.test.js
  tests/register.test.js
  README.md
```

JavaScript, not TypeScript, to match intermission and keep it small.

## Loading

The plugin is loaded from `~/projects/claude-snake` as a local plugin (a local
marketplace entry, or `--plugin-dir`). The exact way is chosen in the plan
after checking what this Claude Code build supports.

## Errors

- If the pane cannot be placed, the offer button is shown instead; nothing
  else changes.
- A saved game that is broken or does not fit is dropped, and a new game
  starts.
- Hook failures show in the debug log, as Claude Code does for every plugin.

## Testing

- `tests/game.test.js`: moving, eating and growing, wall crash, body crash,
  reversal ignored, two queued turns, speed-up, `fits`.
- `tests/register.test.js` with `claude plugin test`: the pane opens after
  2 s of a turn; it closes at once on a permission ask; it counts down on
  `turn.complete`; `/snake off` stops the auto-open.
- `claude plugin validate ~/projects/claude-snake`.
- By hand in Warp: auto-open, click and play, pause on done, resume next turn,
  narrow-window offer.

## Not in scope

Sound, other games, multiplayer, a high-score list, themes.
