# Main setup

- Please use the project-local GSD install from `.claude/gsd-core`.
- **Please do not run the server** I do on my side

# Test

- utiliser vitest run
- ne jamais lancer Vitest en mode watch
- ne plus répéter cette contrainte dans chaque prompt GSD

# Preact

This project uses **Preact + @preact/signals**, not React. Before writing or reviewing any component, hook, effect, store setter, or signal subscription, consult the **`efx-preact-reactivity`** skill — it holds the project's mandatory reactivity rules (idempotent store setters, identity-stable effect deps, narrow signal reads, no render-body signal writes, loop termination). Use the `developing-preact` skill for general Preact guidance. Never apply React patterns by default.

## Git index lock recovery

If a Git command fails because `.git/index.lock` exists:

1. Check whether a process is holding it with `lsof .git/index.lock`.
2. If no process holds the lock and no Git operation is running, treat it as stale.
3. Remove only `.git/index.lock`, never other `.git/*` files.
4. Retry the blocked Git command.
5. If any process is holding the lock, or the situation is unclear, stop and ask the user.
