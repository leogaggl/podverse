#!/usr/bin/env bash
# Formal X.Y.Z from a revision's root package.json (prerelease suffix removed).
# Source this file. Do not execute it.

formal_version_at() {
  local rev="$1"
  git show "$rev:package.json" | node --input-type=module -e '
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(0, "utf8"));
const version = String(pkg.version ?? "");
const formal = version.split("-")[0];
if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(formal)) {
  console.error("Error: package.json version is not X.Y.Z: " + version);
  process.exit(1);
}
process.stdout.write(formal);
'
}
