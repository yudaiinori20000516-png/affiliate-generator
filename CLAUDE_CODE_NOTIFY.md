# Codex Push To Claude Code Notification

This project uses a wrapper command because Git has no standard local `post-push` hook.

## Setup

```bash
scripts/install-codex-claude-notify.sh
```

This installs a local Git alias:

```bash
git codex-push
```

## Usage

Use this instead of `git push` when Codex pushes changes:

```bash
git codex-push origin HEAD
```

or:

```bash
npm run push:notify -- origin HEAD
```

If the push succeeds, Codex sends a summary of the pushed changes to Claude Code using:

```bash
claude -p
```

The transcript is saved under:

```bash
claude_code_conversations/
```

## Live Monitor

Open a live monitor in the current terminal:

```bash
npm run monitor:claude
```

Open a separate Terminal window for monitoring:

```bash
npm run open:claude-monitor
```

The monitor follows:

```bash
claude_code_conversations/latest.md
```

`latest.md` is updated to point at the newest Claude Code conversation whenever `notify:claude` or `git codex-push` runs.

## Manual Notification

To notify Claude Code without pushing:

```bash
npm run notify:claude
```

## Notes

- Claude Code must be logged in with `claude auth login`.
- The notification does not edit files. It asks Claude Code to review the pushed changes and return next-step guidance.
- The transcript includes the prompt and Claude Code response so the interaction is visible later.
