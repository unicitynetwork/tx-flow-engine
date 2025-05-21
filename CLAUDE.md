# TX-FLOW-ENGINE Development Guidelines

## Build Commands
- Build project: `npm run build` (creates browser and Node.js bundles in docs/ directory)
- Production build: Modify webpack.config.js mode to 'production' before running build
- Manual testing: Use CLI tools in `cli/` directory (e.g., `./cli/mint.sh`, `./cli/send.sh`)

## Code Style Guidelines
- **Modules**: Use CommonJS pattern with explicit `require`/`module.exports`
- **Naming**: camelCase for variables/functions, PascalCase for classes, UPPER_SNAKE for constants
- **Functions**: Async operations should use async/await pattern consistently
- **Imports**: Group imports by source (internal vs external libraries)
- **Error Handling**: Use try/catch blocks with specific error messages
- **Parameters**: Use object destructuring for function parameters with multiple arguments

## Project Structure
- Core engine: state_machine.js (entry point), token.js, transaction.js, state.js
- CLI interface: Scripts in `cli/` directory for common operations
- Web interface: Components in `src/` with HTML entry point at `src/ipts.html`
- Documentation: Protocol spec in `unicity-token-protocol-spec.md`

## External Dependencies
- Main dependency: `@unicitylabs/shared` for crypto operations and transport
- Requires Node.js crypto modules (polyfilled for browser environments)