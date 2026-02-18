# Bun Usage Guide

This project uses **bun** as its package manager and script runner, matching the Nitro Modules ecosystem.

## Why Bun

- Faster installs than npm/yarn (especially in monorepo with workspaces)
- Native workspace support via `workspaces` in package.json
- Used by the Nitro Modules ecosystem (react-native-nitro-sqlite reference project)
- `bun --cwd` for clean workspace-scoped commands

## Key Commands

```bash
# Install all dependencies (workspace root)
bun install

# TypeScript checking (all workspaces)
bun run typecheck

# Run nitrogen codegen (generates C++ specs from .nitro.ts)
bun package specs

# Run commands in the package workspace
bun --cwd package <command>

# Run commands in the example app workspace
bun --cwd example <command>

# iOS example app
bun example ios

# Android example app
bun example android
```

## Gotchas

- **Lock file:** bun uses `bun.lock` (not `yarn.lock` or `package-lock.json`)
- **Workspace commands:** Use `bun --cwd <workspace>` to target specific workspaces
- **builder-bob:** Works fine under bun — uses `bob build` internally
- **nitrogen:** Works fine under bun — `bun nitrogen` or `bun package specs`
- **CocoaPods:** Run `bundle exec pod install` inside `example/ios/` (bun doesn't replace pod)
