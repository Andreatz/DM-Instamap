# DM-Instamap — Codex Instructions

You are working on DM-Instamap, a local-first modular map generator for D&D.

The tool must generate playable and editable maps using local assets and reference maps.

Important rules:
- Always respond in Italian.
- Do not use paid external APIs.
- Do not commit large binary assets directly into Git.
- The app must work locally.
- The asset intelligence must be local-first.
- ChatGPT Bridge is optional, not required.
- Every feature must have tests.
- Every generated map must be editable.
- The project must support future exports to PNG, WEBP, dd2vtt and Foundry VTT.
- Keep tasks small.
- Update documentation after every important change.

Architecture:
- apps/web: visual editor and UI
- apps/worker: local Python worker for heavy asset processing
- packages/core: shared types
- packages/assets: asset scanning and classification
- packages/generator: dungeon/building/city generation
- packages/exporters: PNG, WEBP, dd2vtt, Foundry
- packages/ai-bridge: optional ChatGPT manual bridge
- docs: manuals and roadmap

MVP first:
1. Project setup
2. Asset scanner
3. Asset browser
4. Manual asset correction
5. Simple dungeon generator
6. Map editor
7. PNG export
8. ChatGPT Bridge later