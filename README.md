# snake-pane

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
