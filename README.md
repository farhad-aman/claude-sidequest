# Sidequest for Claude Code

Claude does the main quest. You do a side quest: Snake in a side pane while
Claude works. Text only, so it works in any terminal, Warp included.

Plugin id: `sidequest`.

- After Claude has worked for 2 seconds the pane opens, paused.
- Click the board once, then press an arrow (or WASD) to play. Space pauses.
- When Claude needs you, the pane closes at once. When Claude is done, it
  counts down 3 seconds and closes. The game waits, paused, for next time.
- In a terminal under 144 columns, press `1` on the line above the prompt to
  open it.

Commands:

- `/sidequest` opens the pane with the last game.
- `/sidequest snake` opens Snake.
- `/sidequest off` stops it opening by itself. `/sidequest on` turns that
  back on.

With 2 or more games, press `m` in the pane to pick a game.

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

## Load it

```bash
git clone https://github.com/farhad-aman/claude-sidequest ~/projects/sidequest
```

Add the folder to `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json`,
then restart Claude Code:

```json
"env": { "CLAUDE_CODE_PLUGIN_DIRS": "~/projects/sidequest" }
```

## Test it

```bash
claude plugin test ~/projects/sidequest
claude plugin validate ~/projects/sidequest
```

## License

MIT
