# tooling-webpack

Composable Webpack configuration builder for modern TypeScript web applications.

## Stack

- Language: JavaScript ESM
- Runtime: Node 24
- OS: GNU/Linux
- Libraries: webpack 5.x, babel, sass, sharp, workbox
- Package manager: npm, lockfile present

## Toolchain

- Format: prettier 3.x
- Lint: eslint 10.x, trimmer
- Test: `node --test`
- Audit: npm audit

## Devcontainer

- Base: docker.io/library/node:24-trixie
- User: node
- Sidecars: none
- Up: `make up`
- Execute: `devcontainer exec --workspace-folder . <command>`
- Down: `make down`

## Makefile

- `update` — refresh locks, only tool that may touch them
- `fix` — auto-fix, may dirty tree
- `check` — full gate: doctor + lint + analyze + test + audit
- `doctor` — tree and toolchain ok
- `lint` — eslint + prettier + trimmer checks
- `analyze` — npm checks
- `test` — unit tests
- `audit` — dependency audit
- `postcreate` — first-time setup, runs automatically on create
- `stop` — stop container, keep it
- `down` — stop and remove container
- `clean` — drop generated files
- `distclean` — drop everything rebuildable
- `rebuild` — full rebuild, only when broken

## Layout

├── Makefile
├── .editorconfig
├── .devcontainer/
├── package.json
├── eslint.config.js
├── prettier.config.js
├── LICENSE
├── AUTHORS.md
├── src/
│   └── index.js
├── scaffolds/
└── tests/
