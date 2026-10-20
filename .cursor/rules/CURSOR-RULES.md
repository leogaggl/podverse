# `.cursor/rules/`

Cursor rules (`.mdc` files): always-applied or glob-scoped agent constraints.

- Use `alwaysApply: true` for repo-wide conventions (for example `architecture-tier-dependencies.mdc`); use `globs` when rules apply only to certain paths.
- When the task matches a scoped rule but no file of theirs is open, open it from
  [rule-index.mdc](rule-index.mdc).
- Prefer skills for long workflow docs; keep rules focused.
- See **llm-cursor-source** and [DOCS-DEVELOPMENT-LLM.md](/docs/development/llm/DOCS-DEVELOPMENT-LLM.md).
