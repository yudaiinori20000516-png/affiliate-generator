# Claude Code Conversations

`scripts/codex-push-notify.sh` saves Claude Code notification transcripts here.

Each log contains:

- the prompt Codex sent to Claude Code after a successful push
- Claude Code's response
- branch, commit range, changed files, and diff summary

`latest.md` points to the newest conversation log so it can be monitored with:

```bash
npm run monitor:claude
```

The first monitor run creates `latest.md` automatically if it does not exist.

Claude Code must be logged in before notifications can produce responses:

```bash
claude auth login
```

Conversation logs are local runtime artifacts and are ignored by Git.

Use:

```bash
git codex-push origin HEAD
```

or:

```bash
npm run push:notify -- origin HEAD
```
