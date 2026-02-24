# Memories

## Patterns

## Decisions

## Fixes

### mem-1771957605-371a
> npm fails on bun-installed node_modules: bun creates symlinks to node_modules/.bun/ and marks packages as extraneous in package-lock.json. Fix: delete ALL node_modules (root AND workspace sub-packages like packages/*/node_modules/) then run clean npm install
<!-- tags: npm, bun, workspace, node_modules | created: 2026-02-24 -->

## Context
