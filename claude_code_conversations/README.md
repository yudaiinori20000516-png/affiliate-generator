# Claude Code Conversations

`scripts/codex-push-notify.sh` saves Claude Code notification transcripts here.

Each log contains:

- the prompt Codex sent to Claude Code after a successful push
- Claude Code's response
- branch, commit range, changed files, and diff summary

Use:

```bash
git codex-push origin HEAD
```

or:

```bash
npm run push:notify -- origin HEAD
```
