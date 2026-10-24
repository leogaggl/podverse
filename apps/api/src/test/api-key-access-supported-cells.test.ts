import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { ApiKeyResource, CrudAction } from '@podverse/helpers';
import {
  API_KEY_RESOURCES,
  API_KEY_SUPPORTED_ACTIONS,
  apiKeyResourceSupportsAction,
  CRUD_ACTIONS,
} from '@podverse/helpers';

const API_SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_ROOTS = ['controllers', 'routes', 'lib', 'middleware'];
const PROPERTY = 'apiKeyAccess';

type Label = {
  resource: string;
  action: string;
  where: string;
};

type Scan = {
  labels: Label[];
  errors: string[];
};

function charAt(source: string, index: number): string {
  return source[index] ?? '';
}

function isIdentStart(ch: string): boolean {
  return (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || ch === '_' || ch === '$';
}

function isIdentPart(ch: string): boolean {
  return isIdentStart(ch) || (ch >= '0' && ch <= '9');
}

function lineOf(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (source[i] === '\n') {
      line += 1;
    }
  }
  return line;
}

function skipWhitespace(source: string, start: number): number {
  let i = start;
  while (i < source.length && /\s/.test(charAt(source, i))) {
    i += 1;
  }
  return i;
}

function skipLineComment(source: string, start: number): number {
  let i = start;
  while (i < source.length && charAt(source, i) !== '\n') {
    i += 1;
  }
  return i;
}

function skipBlockComment(source: string, start: number): number {
  const end = source.indexOf('*/', start + 2);
  return end === -1 ? source.length : end + 2;
}

function matchBrace(source: string, open: number): number {
  let depth = 0;
  let i = open;
  while (i < source.length) {
    const ch = charAt(source, i);
    if (ch === '/' && charAt(source, i + 1) === '/') {
      i = skipLineComment(source, i);
      continue;
    }
    if (ch === '/' && charAt(source, i + 1) === '*') {
      i = skipBlockComment(source, i);
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipString(source, i);
      continue;
    }
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return i + 1;
      }
    }
    i += 1;
  }
  return source.length;
}

function skipString(source: string, start: number): number {
  const quote = charAt(source, start);
  let i = start + 1;
  while (i < source.length) {
    const ch = charAt(source, i);
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (quote === '`' && ch === '$' && charAt(source, i + 1) === '{') {
      i = matchBrace(source, i + 1);
      continue;
    }
    if (ch === quote) {
      return i + 1;
    }
    i += 1;
  }
  return source.length;
}

function readIdentifierEnd(source: string, start: number): number {
  if (!isIdentStart(charAt(source, start))) {
    return start;
  }
  let i = start + 1;
  while (isIdentPart(charAt(source, i))) {
    i += 1;
  }
  return i;
}

/** End index after `name` or `name.prop`, or null when the text is not that shape. */
function readPropertyReadEnd(source: string, start: number): number | null {
  let i = readIdentifierEnd(source, start);
  if (i === start) {
    return null;
  }
  while (charAt(source, i) === '.') {
    const next = readIdentifierEnd(source, i + 1);
    if (next === i + 1) {
      return null;
    }
    i = next;
  }
  return i;
}

function isValueTerminator(source: string, index: number): boolean {
  const ch = charAt(source, skipWhitespace(source, index));
  return ch === '' || ch === ',' || ch === '}' || ch === ')' || ch === ';';
}

function readSingleQuotedProp(body: string, name: string): string | null {
  const pattern = new RegExp(`(?:^|[^A-Za-z0-9_$])${name}\\s*:\\s*'([^']*)'`);
  const value = pattern.exec(body)?.[1];
  return value === undefined ? null : value;
}

type ParsedValue =
  | { kind: 'label'; resource: string; action: string; end: number }
  | { kind: 'passthrough'; end: number }
  | { kind: 'invalid'; detail: string; end: number };

function parseValue(source: string, valueStart: number): ParsedValue {
  if (charAt(source, valueStart) === '{') {
    const end = matchBrace(source, valueStart);
    const body = source.slice(valueStart + 1, Math.max(valueStart + 1, end - 1));
    const resource = readSingleQuotedProp(body, 'resource');
    const action = readSingleQuotedProp(body, 'action');
    if (resource === null || action === null) {
      return {
        kind: 'invalid',
        detail: 'apiKeyAccess object must set resource and action as single-quoted strings',
        end,
      };
    }
    return { kind: 'label', resource, action, end };
  }

  const propertyEnd = readPropertyReadEnd(source, valueStart);
  if (propertyEnd !== null && isValueTerminator(source, propertyEnd)) {
    return { kind: 'passthrough', end: propertyEnd };
  }
  const end = propertyEnd ?? valueStart + 1;
  return {
    kind: 'invalid',
    detail: 'apiKeyAccess value is not an object literal or a property pass-through',
    end,
  };
}

function isApiKeyAccessAt(source: string, index: number): boolean {
  if (!source.startsWith(PROPERTY, index)) {
    return false;
  }
  if (isIdentPart(charAt(source, index - 1))) {
    return false;
  }
  return !isIdentPart(charAt(source, index + PROPERTY.length));
}

function scanSource(source: string, whereFile: string): Scan {
  const labels: Label[] = [];
  const errors: string[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = charAt(source, i);
    if (ch === '/' && charAt(source, i + 1) === '/') {
      i = skipLineComment(source, i);
      continue;
    }
    if (ch === '/' && charAt(source, i + 1) === '*') {
      i = skipBlockComment(source, i);
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipString(source, i);
      continue;
    }
    if (isApiKeyAccessAt(source, i)) {
      const colon = skipWhitespace(source, i + PROPERTY.length);
      if (charAt(source, colon) === ':') {
        const parsed = parseValue(source, skipWhitespace(source, colon + 1));
        const where = `${whereFile}:${lineOf(source, i)}`;
        if (parsed.kind === 'label') {
          labels.push({ resource: parsed.resource, action: parsed.action, where });
        } else if (parsed.kind === 'invalid') {
          errors.push(`${where} ${parsed.detail}`);
        }
        i = parsed.end > i ? parsed.end : i + 1;
        continue;
      }
    }
    i += 1;
  }
  return { labels, errors };
}

function collectSources(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSources(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function scanApiSources(): Scan {
  const labels: Label[] = [];
  const errors: string[] = [];
  for (const root of SCAN_ROOTS) {
    for (const filePath of collectSources(join(API_SRC, root))) {
      const source = readFileSync(filePath, 'utf8');
      const scanned = scanSource(source, relative(API_SRC, filePath));
      labels.push(...scanned.labels);
      errors.push(...scanned.errors);
    }
  }
  return { labels, errors };
}

function isApiKeyResourceValue(value: string): value is ApiKeyResource {
  for (const resource of API_KEY_RESOURCES) {
    if (value === resource) {
      return true;
    }
  }
  return false;
}

function isCrudActionValue(value: string): value is CrudAction {
  for (const action of CRUD_ACTIONS) {
    if (value === action) {
      return true;
    }
  }
  return false;
}

function supportedCells(): string[] {
  const cells: string[] = [];
  for (const resource of API_KEY_RESOURCES) {
    for (const action of API_KEY_SUPPORTED_ACTIONS[resource]) {
      cells.push(`${resource}:${action}`);
    }
  }
  return cells.sort();
}

function labeledCells(labels: Label[]): string[] {
  const cells = new Set<string>();
  for (const label of labels) {
    if (isApiKeyResourceValue(label.resource) && isCrudActionValue(label.action)) {
      cells.add(`${label.resource}:${label.action}`);
    }
  }
  return [...cells].sort();
}

const scan = scanApiSources();

describe('apiKeyAccess labels', () => {
  it('reads object-literal labels and ignores property pass-throughs', () => {
    expect(scan.errors).toEqual([]);
    const accountRead = scan.labels.some(
      (label) => label.resource === 'account' && label.action === 'read'
    );
    expect(accountRead).toBe(true);
  });

  it('names a cell apiKeyResourceSupportsAction allows', () => {
    expect(scan.errors).toEqual([]);
    for (const label of scan.labels) {
      const resourceOk = isApiKeyResourceValue(label.resource);
      const actionOk = isCrudActionValue(label.action);
      expect(resourceOk, `${label.where} resource ${label.resource}`).toBe(true);
      expect(actionOk, `${label.where} action ${label.action}`).toBe(true);
      if (!resourceOk || !actionOk) {
        continue;
      }
      expect(apiKeyResourceSupportsAction(label.resource, label.action), label.where).toBe(true);
    }
  });

  it('covers every cell in API_KEY_SUPPORTED_ACTIONS', () => {
    expect(labeledCells(scan.labels)).toEqual(supportedCells());
  });
});
