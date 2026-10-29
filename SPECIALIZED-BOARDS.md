# Specialized whiteboards

`@hfu.digital/boardkit-react` exports `SpecializedTools`, `BoardType`,
`BOARD_TYPES`, and `BOARD_TYPE_LABELS`. Mount the panel inside `BoardKitProvider`,
after the host has loaded the board and joined collaboration:

```tsx
<SpecializedTools boardId={board.id} boardType="uml" />
```

The host owns and persists the board type. HFU stores it in `BkBoard.boardType`
and accepts it in `POST /whiteboards`. Missing values default to `standard`.
Render the panel only for users with edit permission. Server permission checks
remain authoritative. Supply `config.userId` and `config.authToken` for attributed
mutations and asset uploads.

| Type | Adapted tools |
| --- | --- |
| `uml` | Classes with compartments, interfaces, actors, use cases, relationships |
| `er` | Entities, attributes, relationships, cardinality labels |
| `flowchart` | Processes, decisions, terminals, input/output, flow arrows |
| `automata` | States, accepting states, transitions, self-loops |
| `network` | Servers, routers, clients, cloud nodes, links |
| `math` | LaTeX equations, function plots with axes and discontinuity breaks |
| `circuit` | Logic gates, ports, orthogonal wires, input toggles, evaluation, truth tables |
| `mind-map` | Central topics, branches, supporting ideas, connectors |
| `wireframe` | Browser/mobile frames, buttons, inputs, text/image placeholders |
| `kanban` | Columns and grouped task cards that snap inside columns |
| `brainstorm` | Idea notes, themes, prompts, per-user votes, shared deadlines |
| `lecture-notes` | Page frames, ruled pages, definition/theorem/summary blocks, PDF import |

Templates are explicit, additive actions. They never replace an existing scene
or run automatically on join. Specialty metadata lives in optional
`element.data.specialized`; content uses the existing element types and mutation
protocol. Group selection keeps text, gate ports, and shapes together. History
operations update the scene and outbound queue so undo/redo reaches collaborators.

Math and PDF code load on demand. Equations become self-contained SVG glyphs and
are uploaded through the existing asset endpoint; imported PDF pages become PNG
assets. Both survive reload, sharing, and SVG export. Function expressions use a
small mathematical parser, with explicit multiplication (`2*x`) and no JavaScript
evaluation. PDF imports accept at most 50 MB and 50 pages. Circuit network truth
tables require a fully connected combinational circuit and support at most eight
inputs; feedback loops produce a useful error.

## Integration and release

This change spans independent BoardKit, API, and website repositories. BoardKit
2026.10.29 contains these tools. The
website's existing published `2026.04.25` BoardKit dependency does not contain
`SpecializedTools`. Before production deployment:

1. Release updated BoardKit core, React, and NestJS packages under a new version
   using the project's release process. Run checks locally; do not trigger the
   GitHub Actions build/test jobs.
2. Update the website's core/React dependency pins and lockfile to that published
   version. Update the API's NestJS dependency to include inline-image SVG export
   support (the specialty UI also uploads equations as stored assets).
3. In the API repository, run `bunx prisma migrate deploy` to apply
   `20261029100000_add_whiteboard_type` before starting the updated API.
4. Deploy the API and then the website.

For local integration verification, build BoardKit and use those built packages
in the website's local `node_modules`. This does not replace publishing or change
the independent repositories' production dependency contracts. No package release,
database migration against a running database, push, or deployment is performed
by implementing this feature.

Local checks: `bun run build` and `bun run test` in BoardKit, the whiteboard DTO
and service Jest specs and `bun run build` in the API, and `bunx tsc --noEmit` in
the website with updated BoardKit packages installed.
