#!/usr/bin/env python3
"""Agent-transcript metrics for abcagentoptimize.

Reads Cursor agent transcripts (JSONL) and reports how plan-execution turns spend their tool
calls, how often the operator pastes terminal output to debug, and how much always-on guidance
each repo root loads into every request.

Usage (from a repo root):
  python3 .cursor/skills/abcagentoptimize/transcript_metrics.py \
    [--since YYYY-MM-DD] [--root PATH ...] [--transcripts DIR ...] [--json]

Defaults: every ~/.cursor/projects/*/agent-transcripts directory, all dates, and the current
directory as the only root. Pass --root once per workspace root that is open in the window.
"""

import argparse
import collections
import datetime
import glob
import json
import os
import re
import statistics

PLAN_QUERY = re.compile(
    r'^(?:@(?:[\w.-]+/)?|(?:Read and execute|Execute)\s+)\.llm/plans/active/'
)
TERMINAL_REF = re.compile(r'\.cursor/projects/\S+/terminals/\d+\.txt')
DEBUG_WORDS = re.compile(r'\b(debug|fix|abce2e\w*)\b', re.I)
TIMESTAMP = re.compile(r'<timestamp>\w+, (\w+ \d+, \d{4})')
USER_QUERY = re.compile(r'<user_query>(.*?)</user_query>', re.S)

READ_TOOLS = {'Read', 'ReadFile'}
EXPLORE_TOOLS = READ_TOOLS | {'Grep', 'Glob', 'rg', 'SemanticSearch'}
EDIT_TOOLS = {'StrReplace', 'Write', 'ApplyPatch', 'Delete', 'EditNotebook'}
CHECK_PATTERNS = (
    'npm run lint', 'eslint', 'type-check', 'tsc', 'vitest', 'npm run test', 'npm test',
    'npm run build', 'build:packages', 'prettier',
)


def message_text(entry):
    content = entry.get('message', {}).get('content')
    if isinstance(content, str):
        return content
    parts = []
    for item in content or []:
        if isinstance(item, dict):
            parts.append(item.get('text') or '')
        elif isinstance(item, str):
            parts.append(item)
    return ''.join(parts)


def parse_date(text):
    match = TIMESTAMP.search(text)
    if not match:
        return None
    try:
        return datetime.datetime.strptime(match.group(1), '%b %d, %Y').date()
    except ValueError:
        return None


def new_turn(path, query, day):
    return {
        'path': path,
        'query': query,
        'day': day,
        'subagent': '/subagents/' in path,
        'tools': collections.Counter(),
        'shell': [],
        'reads': collections.Counter(),
    }


def load_turns(transcript_dirs):
    turns = []
    for directory in transcript_dirs:
        for path in glob.glob(os.path.join(directory, '**', '*.jsonl'), recursive=True):
            fallback_day = datetime.date.fromtimestamp(os.path.getmtime(path))
            current = None
            last_day = None
            try:
                handle = open(path, encoding='utf-8')
            except OSError:
                continue
            with handle:
                for line in handle:
                    try:
                        entry = json.loads(line)
                    except ValueError:
                        continue
                    role = entry.get('role')
                    if role == 'user':
                        text = message_text(entry)
                        match = USER_QUERY.search(text)
                        query = (match.group(1) if match else text).strip()
                        last_day = parse_date(text) or last_day
                        if current:
                            turns.append(current)
                        current = new_turn(path, query, last_day or fallback_day)
                    elif role == 'assistant' and current:
                        for item in entry.get('message', {}).get('content') or []:
                            if not isinstance(item, dict) or item.get('type') != 'tool_use':
                                continue
                            name = item.get('name') or ''
                            args = item.get('input') or {}
                            current['tools'][name] += 1
                            if name == 'Shell':
                                current['shell'].append(args.get('command') or '')
                            if name in READ_TOOLS:
                                current['reads'][args.get('path') or args.get('target_file') or ''] += 1
            if current:
                turns.append(current)
    return turns


def percentile(values, fraction):
    if not values:
        return 0
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(len(ordered) * fraction))]


def short_path(path):
    return re.sub(r'^.*?/repos/[^/]+/', '', path)


def plan_metrics(turns):
    if not turns:
        return {'turns': 0}
    totals = collections.Counter()
    for turn in turns:
        totals += turn['tools']
    tool_calls = [sum(turn['tools'].values()) for turn in turns]
    edits = [sum(turn['tools'][name] for name in EDIT_TOOLS) for turn in turns]
    explore = sum(totals[name] for name in EXPLORE_TOOLS)
    edit_total = sum(totals[name] for name in EDIT_TOOLS)
    reads = sum(sum(turn['reads'].values()) for turn in turns)
    rereads = sum(sum(n - 1 for n in turn['reads'].values() if n > 1) for turn in turns)
    ran_checks = sum(
        1 for turn in turns
        if any(any(p in command for p in CHECK_PATTERNS) for command in turn['shell'])
    )
    with_env = sum(command.count('with-env') for turn in turns for command in turn['shell'])

    reread_files = collections.Counter()
    guidance_reads = collections.Counter()
    for turn in turns:
        for path, count in turn['reads'].items():
            if count > 1:
                reread_files[short_path(path)] += count - 1
            if '/.cursor/' in path:
                guidance_reads[short_path(path)] += count

    return {
        'turns': len(turns),
        'tool_calls_median': statistics.median(tool_calls),
        'tool_calls_p90': percentile(tool_calls, 0.9),
        'edits_median': statistics.median(edits),
        'explore_per_edit': round(explore / edit_total, 2) if edit_total else None,
        'same_turn_reread_pct': round(rereads / reads * 100, 1) if reads else 0,
        'ran_checks_pct': round(ran_checks / len(turns) * 100, 1),
        'with_env_per_turn': round(with_env / len(turns), 2),
        'ask_question_per_turn': round(totals['AskQuestion'] / len(turns), 3),
        'subagent_turns': sum(1 for turn in turns if turn['subagent']),
        'top_reread_files': reread_files.most_common(10),
        'top_guidance_reads': guidance_reads.most_common(10),
    }


def always_on_bytes(root):
    rule_files = glob.glob(os.path.join(root, '.cursor', 'rules', '**', '*.mdc'), recursive=True)
    rules = []
    for path in rule_files:
        with open(path, encoding='utf-8') as handle:
            text = handle.read()
        if re.search(r'^alwaysApply:\s*true\s*$', text, re.M):
            rules.append((os.path.relpath(path, root), len(text.encode('utf-8'))))
    extra = 0
    for name in ('AGENTS.md', '.cursorrules'):
        path = os.path.join(root, name)
        if os.path.exists(path):
            extra += os.path.getsize(path)
    rules.sort(key=lambda item: -item[1])
    return {
        'root': os.path.basename(os.path.abspath(root)),
        'always_on_rules': len(rules),
        'always_on_rule_bytes': sum(size for _, size in rules),
        'agents_and_cursorrules_bytes': extra,
        'largest_rules': rules[:8],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--since', help='Only count turns on or after YYYY-MM-DD')
    parser.add_argument('--root', action='append', help='Workspace root to measure (repeatable)')
    parser.add_argument('--transcripts', action='append', help='agent-transcripts directory')
    parser.add_argument('--json', action='store_true', help='Print JSON only')
    args = parser.parse_args()

    transcript_dirs = args.transcripts or glob.glob(
        os.path.expanduser('~/.cursor/projects/*/agent-transcripts')
    )
    since = datetime.date.fromisoformat(args.since) if args.since else None
    turns = [t for t in load_turns(transcript_dirs) if not since or t['day'] >= since]

    plan_turns = [t for t in turns if PLAN_QUERY.match(t['query'])]
    debug_turns = []
    for turn in turns:
        if turn['subagent'] or not TERMINAL_REF.search(turn['query']):
            continue
        instruction = re.sub(r'@\S+', '', turn['query']).strip()
        if len(instruction) <= 300 and DEBUG_WORDS.search(instruction):
            debug_turns.append(turn)
    roots = [always_on_bytes(root) for root in (args.root or ['.'])]

    report = {
        'generated': datetime.date.today().isoformat(),
        'since': args.since,
        'turns_total': len(turns),
        'plan': plan_metrics(plan_turns),
        'self_check_trial': plan_metrics(
            [t for t in plan_turns if 'plan-self-check' in t['query']]
        ),
        'orchestrated': plan_metrics(
            [t for t in turns if 'plan-orchestrator' in t['query']]
        ),
        'debug_turns': len(debug_turns),
        'debug_per_plan_turn': round(len(debug_turns) / len(plan_turns), 2) if plan_turns else None,
        'always_on': roots,
        'always_on_window_bytes': sum(
            r['always_on_rule_bytes'] + r['agents_and_cursorrules_bytes'] for r in roots
        ),
    }

    if args.json:
        print(json.dumps(report, indent=2))
        return

    plan = report['plan']
    print(f"Turns: {report['turns_total']} total, {plan['turns']} plan turns"
          f" ({plan.get('subagent_turns', 0)} from subagents)")
    if plan['turns']:
        print(f"Tool calls per plan turn: median {plan['tool_calls_median']},"
              f" p90 {plan['tool_calls_p90']}; edits median {plan['edits_median']}")
        print(f"Reads/searches per edit: {plan['explore_per_edit']}; same-turn re-reads:"
              f" {plan['same_turn_reread_pct']}%")
        print(f"Plan turns that ran checks: {plan['ran_checks_pct']}%;"
              f" with-env calls per turn: {plan['with_env_per_turn']}")
    print(f"Debug turns (pasted terminal + debug/fix): {report['debug_turns']}"
          f" ({report['debug_per_plan_turn']} per plan turn)")
    for name in ('self_check_trial', 'orchestrated'):
        section = report[name]
        if section['turns']:
            print(f"{name}: {section['turns']} turns, tool calls median"
                  f" {section['tool_calls_median']}, ran checks {section['ran_checks_pct']}%")
    print(f"Always-on guidance in window: {report['always_on_window_bytes']} bytes"
          f" (~{report['always_on_window_bytes'] // 4} tokens)")
    for root in roots:
        print(f"  {root['root']}: {root['always_on_rules']} rules,"
              f" {root['always_on_rule_bytes']} + {root['agents_and_cursorrules_bytes']} bytes")
    print('\nJSON for the log:')
    print(json.dumps({k: v for k, v in report.items() if k != 'always_on'}, indent=2))


if __name__ == '__main__':
    main()
