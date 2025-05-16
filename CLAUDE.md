# CLAUDE.md - Coding Assistant Guide

## Build & Test Commands
- Build: `npm run build` 
- Build check (no emit): `npm run build:check` 
- Test: `npm test`
- Test single file: `npm test -- tests/path/to/file.ts`
- Lint: `npm run lint`
- Lint with auto-fix: `npm run lint:fix`
- Publish: `npm publish`

## Code Style Guidelines
- **Formatting**: 2 spaces indentation
- **Naming**: camelCase for variables/functions, PascalCase for classes, interfaces prefixed with 'I'
- **Imports**: Group by: 1) built-ins 2) @unicitylabs packages 3) local imports, with newlines between groups
- **Imports order**: Alphabetize imports within groups (case-insensitive)  
- **Types**: Use explicit return types on functions and explicit member accessibility
- **Error Handling**: Use specific error messages in throw statements
- **Comments**: Document complex logic with comments (especially crypto operations)
- **Keys**: Sort object keys alphabetically when 2+ keys present

## Project Overview
Transaction flow engine for Unicity Network's offchain token system, providing:
- Token state transition (mint, transfer, receive)
- Aggregator interface for commitment and proof generation
- Cryptographic verification for token ownership