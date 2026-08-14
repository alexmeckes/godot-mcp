# Changelog

All notable changes to this project will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-08-14

### Fixed

- Project initialization now copies the canonical bundled AI Bridge, including
  runtime automation support.
- Package metadata, Node.js requirements, cross-platform tests, and published
  package contents are aligned with the repository.
- Runtime dependencies are updated to patched releases.

### Added

- License and contribution documentation.
- Stateless localhost HTTP transport at `/mcp`, with 2025-era compatibility.

### Changed

- Migrated the server to the stable MCP TypeScript SDK v2 and Zod 4.
- Stdio now negotiates both 2025-era MCP and the 2026-07-28 protocol.
- Tool schemas are registered natively through Standard Schema instead of a
  hand-written JSON Schema converter.

## [0.1.0]

- Initial Godot MCP server release.
