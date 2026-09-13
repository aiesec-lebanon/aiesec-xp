<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Source of truth

`Architecture.md` and `Context.md` (in the repo root) are the source of truth for this
project's domain, decisions, and system design — above any other doc, comment, or
assumption, including this file.

- Before designing or implementing anything non-trivial, read both files first.
- If code, another doc, or a request conflicts with them, `Architecture.md` /
  `Context.md` win. Flag the conflict instead of silently resolving it.
- If you make or learn a decision that changes the domain model, scoring rules,
  assignment logic, or system design, update `Context.md` (decisions D-xx / open
  items O-xx) and/or `Architecture.md` in the same change — don't let them drift
  from the actual implementation.
- Do not duplicate their content elsewhere (READMEs, other agent-instruction
  files, comments); link to them instead.

## Code comments

Do not add unnecessary long comments everywhere in the code, and no file-header
comment blocks at the start of every file. Write code that's clear from naming
and structure. Only comment where the *why* isn't obvious from the code itself
(a non-obvious constraint, a workaround, a subtle invariant).
