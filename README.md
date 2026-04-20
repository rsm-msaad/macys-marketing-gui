# Milestone 02

Push all deliverables to GitHub before the start of class on **May 7th**. Make sure to have the required folders and files starting from the base provided in this repo. GitHub will run automated check to ensure each file is available.

- README.md
- `data/` Contains data and code for data preparation
- `skill/` Contains the _skills_ you create for your project

## Claude usage logging

> **Heads up:** Your Claude Code usage in this repo is logged. Prompts you submit and the tools Claude runs are written to `.claude/usage-log/session-*.jsonl` and auto-staged on every `git commit`, so they end up on GitHub alongside your code. This repo lives in a **private GitHub organization** — only you, your teammates, and the instructor can see it. The instructor uses these logs to see how the class is using the tool — please work normally and know that **file contents and command output are not captured**, only prompts and tool names/arguments. Details in [`.claude/usage-log/README.md`](.claude/usage-log/README.md).

## Content

This repo contains some examples and settings to help you get started:

- `.claude/settings.json` — tells Claude what it can and can't do without asking for explicit permission
- `.claude/hooks/` — small scripts that run at key moments (auto-format, lint reminder, stale-test reminder, secret scanning, usage logging)
- `.claude/commands/` — project-local slash commands (`/run-tests`, `/review`, `/add-function`, `/explain`)
- `CLAUDE.md` — rules Claude reads automatically on every session (uv workflow, testing requirements, etc.)

See [this video](https://www.youtube.com/watch?v=ZlDnsf_DOzg) for a very nice overview video about providing guidance for Claude Code. Come to the worksession to discuss or ask questions (or post to piazza)

## Hooks — automatic helpers

A *hook* is a small script that Claude Code runs for you automatically at certain moments — you don't have to remember to call them. Think of them like the spell-checker in a word processor: it just runs in the background and catches mistakes before they cause trouble. The hooks configured in this repo are:

- **After Claude edits a Python file** → `ruff` formats it. Your code ends up tidy (correct spacing, quotes, etc.) without you learning the style rules first.
- **After you run `pytest`** → a timestamp is saved so Claude knows when tests were last green.
- **When Claude finishes its turn** → two soft reminders appear if (a) Python files changed since the last test run, or (b) `ruff` found any lint issues. Nothing is blocked — they're nudges.
- **Before every `git commit`** → the commit is paused if any staged file looks like a secret (`.env`, API keys, private keys, …). You'll get a prompt asking if you really want to proceed.
- **On every prompt you send and every tool Claude runs** → a short entry is appended to `.claude/usage-log/` for instructor review (see the Claude usage logging section above).

You don't need to run any of these yourself. They live in `.claude/hooks/` if you want to peek.

## Version control with git (and Claude's `/rewind`)

Version control = a time machine for your files. Every time you *commit*, git takes a snapshot of your whole project. If something later breaks, you can go back to any earlier snapshot.

### The basic loop

Whenever you finish something that works (even partly), ask Claude to commit:

> *"Commit these changes with a short message describing what we just did."*

Claude will run these commands for you:

- `git status` — shows which files changed
- `git add <files>` — marks files to include in the next snapshot
- `git commit -m "…"` — takes the snapshot with a message describing it

When you're done for the day, ask Claude to **push** — this uploads your commits to GitHub so they're backed up and your instructor/teammates can see them:

> *"Push my commits to GitHub."*

### Two different "rewind" tools — know which one you need

You have **two different ways to undo work**, and they do different things. Pick the right one.

| If you want to undo… | Use | What it does |
| --- | --- | --- |
| The last few things Claude said/did in *this conversation* | `/rewind` in Claude Code | Rolls the conversation back to an earlier message. Files Claude edited are restored to how they were at that point. Nothing is committed either way. |
| Code changes that are already committed to git | `git checkout <commit>` or "revert" | Uses git snapshots to bring back an older version of a file or the whole repo. Works even across sessions, days later, on any computer. |

**`/rewind`** is like hitting "Back" in a browser — great for "wait, that last edit was wrong, take it back." Type `/rewind` in the Claude Code prompt and pick the message to return to.

**Git commits** are the real safety net. `/rewind` only remembers the current conversation; if you close Claude Code or start a new session, that history is gone. Commits last forever.

### Rule of thumb for beginners

- **Commit often.** After every small piece of working progress — not just at the end. Five small commits beat one giant commit.
- **Push at the end of each work session** so your work is safely on GitHub.
- **Use `/rewind` for "oops" during the current conversation**; use git to recover from anything older than that.
- **Don't panic if something breaks.** Between `/rewind` and your git history, you can almost always get back to a working state. Ask Claude for help restoring if you're unsure.
