# combined-merge — deferred

## abctestall stopped (exit 2)

The sweep stopped before finishing. Its open run is under `.llm/plans/active/abctest-all-*` and its messages under `.artifacts/plan-runner/abctest-all-*/`. Fix the cause, then run `./scripts/abctest/run.sh all --resume 'What you changed.'`. When it finishes, commit and push its fixes.
