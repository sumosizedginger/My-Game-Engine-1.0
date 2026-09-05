# Learning My Game Engine 1.0

## Purpose

The `docs/learn/` directory contains educational guides, architectural walkthroughs, and code-level lessons for **My Game Engine 1.0**.

Canonical repository:

`sumosizedginger/My-Game-Engine-1.0`

Every lesson in this directory is extracted **exclusively from accepted, verified, and frozen implementations**.

---

## 1. The Law of Learning Documents

Under `AGENTS.md` and `DOCUMENTATION_MAP.md`, learning materials operate under strict constitutional constraints:

```text
BUILD
→ TEST
→ RUN
→ CAPTURE
→ AUDIT
→ ACCEPT
→ TEACH
```

1. **No Speculative Architecture**: We never teach planned, promised, or hypothetical APIs. If a feature does not exist as tested code in the canonical repository, it does not appear in a learning guide.
2. **Authority Order**: Canonical specifications (`CONSTITUTION.md`, `PRD.md`, `ARCHITECTURE.md`, `GAMEPLAY_FOUNDATION.md`) outrank learning guides. If a tutorial and a canonical specification conflict, the specification wins and the tutorial must be updated.
3. **Inspectable & Executable Companions**: Code examples in these lessons are extracted directly from working source files and test suites. They are designed to be inspected, verified, and run using the engine's real toolchain.

---

## 2. Available Lessons

| Lesson | Focus Area | Canonical Proof | Base Revision |
|---|---|---|---|
| [Building a Tiny Game](file:///docs/learn/BUILDING_A_TINY_GAME.md) | Foundational 2D Gameplay, Transforms, Clock, Input, Collision, State, Rules, Kiln Seam, DOM UI | **Proof A (Pong)** | `2c73c29450ed2412638a334bd90fb8919c1220a0` |

---

## 3. How to Follow Along

To run and inspect the implementation taught in these guides:

```bash
# Clean dependency installation
npm ci

# Run the complete automated test suite (44 unit tests)
npm test

# Run the headless browser evaluation harness (dual-target validation + captures)
npm run eval

# Build the static production bundle
npm run build

# Start the local development server for interactive browser play
npm run dev
```

Interactive URLs on the local development server (`http://localhost:5173/`):
- **Phase 0 Controlled Boot Proof**: `http://localhost:5173/?controlled=1`
- **Proof A Pong Game**: `http://localhost:5173/?game=pong`
- **Proof A Pong Controlled Fixture**: `http://localhost:5173/?game=pong&controlled=1`
