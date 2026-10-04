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

Commands: `/snake` opens it now, `/snake off` stops it opening by itself,
`/snake on` turns that back on.

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
