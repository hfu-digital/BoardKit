# Fix Workflows & NPM Release — Checklist for Remaining Kit

Apply these changes to match what was done in LoopKit, BoardKit, and CourseKit.

---

## 1. Update CI Workflow (`.github/workflows/ci.yml`)

- [ ] Change branch triggers from `main` (or whatever exists) to `[dev, prod]`
- [ ] Replace Node.js setup with **Bun** setup (`oven-sh/setup-bun@v2`)
- [ ] Replace all `npm` commands with `bun` equivalents:
  - `npm ci` → `bun install --frozen-lockfile`
  - `npm run build` → `bun run build`
  - `npm run lint` → `bun run lint`
  - `npm run test` → `bun run test`
- [ ] If the project uses TypeScript strict checks, add `bun run typecheck` step

**Example:**

```yaml
name: CI

on:
  push:
    branches: [dev, prod]
  pull_request:
    branches: [dev, prod]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2

      - run: bun install --frozen-lockfile
      - run: bun run build
      - run: bun run lint
      # - run: bun run typecheck   # uncomment if project has a typecheck script
      - run: bun run test
```

---

## 2. Update Publish Workflow (`.github/workflows/publish.yml`)

- [ ] Trigger on version tags only (`v*`)
- [ ] Add `permissions: { contents: read }` block
- [ ] Use `oven-sh/setup-bun@v2` for setup
- [ ] Replace `npm publish` with `bun publish --access public`
- [ ] Ensure `NODE_AUTH_TOKEN` is set from `secrets.NPM_TOKEN`
- [ ] Add a publish step **per package** in the monorepo

**Example:**

```yaml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: read

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2

      - run: bun install --frozen-lockfile
      - run: bun run build
      - run: bun run test

      # Repeat this block for each package in the monorepo
      - name: Publish @hfu.digital/<kit>-<package-name>
        run: bun publish --access public
        working-directory: packages/<package-dir>/
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## 3. Add `publishConfig` to Each Package's `package.json`

For **every** `package.json` inside `packages/*/`:

- [ ] Add the following block:

```json
"publishConfig": {
  "access": "public",
  "registry": "https://registry.npmjs.org/"
}
```

---

## 4. PAT Token Scope (GitHub Settings — not a code change)

If pushing these workflow file changes fails with:

> refusing to allow a Personal Access Token to create or update workflow without `workflow` scope

Then:

- [ ] Go to **GitHub → Settings → Developer settings → Personal access tokens**
- [ ] Edit the token and enable the **`workflow`** scope
- [ ] Or run: `gh auth refresh -s workflow`

---

## Summary of Patterns

| What | Old | New |
|------|-----|-----|
| CI branches | `main` | `[dev, prod]` |
| Package manager | npm / Node | Bun (`oven-sh/setup-bun@v2`) |
| Install | `npm ci` | `bun install --frozen-lockfile` |
| Publish | `npm publish` | `bun publish --access public` |
| Publish trigger | varies | `v*` tags only |
| Workflow permissions | none | `contents: read` |
| publishConfig | missing | explicit public + registry URL |
