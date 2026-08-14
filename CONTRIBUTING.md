# Contributing

Issues and pull requests are welcome.

## Development setup

1. Install Node.js 20 or newer.
2. Run `npm ci`.
3. Run `npm run build` and `npm test` before submitting a change.
4. Run `npm run test:coverage` when changing tool behavior.

Keep file-based operations inside the configured Godot project root. When
changing the editor RPC contract, update both `src/tools/editor-tools.ts` and
the canonical plugin in `addons/godot_ai_bridge`, then extend the contract
tests.

Generated files in `dist` are published with the package. Rebuild them after
source changes, but do not add generated test files.
