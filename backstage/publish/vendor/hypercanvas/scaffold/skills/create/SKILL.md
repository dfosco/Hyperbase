---
name: create
description: Walks users through creating any Hypercanvas asset — prototype, external prototype, flow, page, canvas, component, object, or record. Use when asked to "create", "new", or "scaffold" anything in Hypercanvas.
---

# Create

> Triggers: "create a prototype", "new flow", "scaffold a canvas", "add external prototype", "new component", "create object", "create record", "create new", "scaffold", etc.

## What this does

Creates a Hypercanvas artifact — **prototype, external prototype, flow, page, canvas, component, object, or record** — by calling the unified `hypercanvas artifact create` CLI (which POSTs to `/_hypercanvas/artifact/`). The server validates the schema, resolves templates, registers routes, and writes the files. Never hand-write artifact files when an artifact type is available.

The same flow powers the in-app creation dialog (`packages/storyboard/src/internals/ArtifactForm/`). When you invoke the CLI, follow the same inference rules the dialog uses so the agent and UI experiences match.

---

## Content-only Notebook layout

When the target is a content-only Notebook, prototypes, components, canvases, and Sites are artifact directories named `<logical-name>.prototype`, `<logical-name>.component`, `<logical-name>.canvas`, and `<logical-name>.site`. Create them at the Notebook root or beneath an ordinary folder. Use `--parent <notebook-relative-folder>` for a selected parent; omission means root. `--folder` is a compatibility alias. If both are supplied, they must resolve to the same parent.

There is no required `prototypes/`, `canvas/`, or `sites/` wrapper; artifacts live directly in the Notebook, optionally grouped under ordinary folders, and those legacy group names are accepted as ordinary parents. Artifacts cannot contain other artifacts, including through an ordinary subfolder. A leading underscore hides an artifact from the Notebook sidebar while retaining its logical name, payload filenames, and route; for example `_Guide.prototype/index.jsx` still has logical name `Guide` and route `/Guide.prototype`. Publishing includes hidden artifacts; the notebook-publishing skill generates the publication project into `backstage/publish/`.

Notebook prototype routes use the literal suffix, such as `/Guide.prototype`; component routes use `/components/Guide`. Route collisions are case-insensitive. Prototype or component rename uses the positional argument as the current lookup name and `--name` as the new logical name:

```bash
npx hypercanvas artifact edit prototype Guide --name FieldGuide --parent Research
```

Other edit fields such as `--title` update metadata without renaming. Source-repository projects retain their legacy `src/prototypes` and `src/canvas` behavior; these Notebook rules do not convert application source folders.

## Inference rules — apply BEFORE asking anything

| Field        | Infer from                                                                 |
|--------------|----------------------------------------------------------------------------|
| `--title`    | Words in the user's request (e.g. "create an Alerts Inbox prototype" → `"Alerts Inbox"`). |
| `--name`     | Kebab-case slug of `--title`. Lowercase, strip non-`[a-z0-9]+`, collapse to `-`, trim, max 64 chars. `"Alerts Inbox"` → `alerts-inbox`. **Component is the exception** — its `--name` is PascalCase. |
| `--author`   | `gh api user --jq .login` (or `GET /_hypercanvas/git-user` → `.login`). Don't prompt for this. |
| `--parent`   | In a Notebook, set only when the user selected or named an ordinary parent folder. Omit for the Notebook root. |
| `--description` | Only set if the user volunteered one. Don't ask. |

Only call `ask_user` for fields you genuinely can't infer **and** that are required.

If only the name was given but not the title (e.g. "create a prototype called `repo-quality`"), humanize the name into the title (`Repo Quality`) — don't ask.

---

## Dynamic option lists — never hardcode

When you do need to offer a choice list, fetch it live from the running dev server. **Never** hardcode template/recipe names like `bare`/`security`/`security-org` — those used to be defaults years ago. The real list is whatever the consumer repo registered under `workshop.partials` in `hypercanvas.config.json`.

| List                        | Source                                                                                          |
|-----------------------------|-------------------------------------------------------------------------------------------------|
| Notebook parent folders     | `hypercanvas notebook navigation read --json` → the current navigation tree                       |
| Partials (templates+recipes)| `GET /_hypercanvas/workshop/prototypes` → `.partials`. For prototypes use `scope: "global"`; for pages also include partials whose `prototype` matches the target. |
| Existing prototypes         | `GET /_hypercanvas/artifact/list?type=prototype` → `.items[].name`                                |
| Existing flows (for `--copy-from`) | `GET /_hypercanvas/workshop/flows` → `.flows` filtered to same prototype + folder.        |
| Existing routes             | `GET /_hypercanvas/workshop/flows` → prototype `.routes`                                          |

If the user picks a partial, pass either its `name` (`Application`) or `id` (`global:templates/Application`) — both resolve server-side.

---

## Procedure

1. **Identify the type** — from the prompt if given. Otherwise ask once with the 9 choices (prototype, external prototype, flow, page, canvas, component, Site, object, record). External prototypes use the prototype type with `--url`.
2. **Apply the inference table.**
3. **Fetch any dynamic lists** you'll need.
4. **Ask only what's still missing.** One question per `ask_user` call.
5. **Run the CLI** — see the per-type recipes below. The CLI prints a result line (or `--json` for machine-readable).
6. **Report** the created path + dev URL. Build links from the active worktree's base URL; branch deployments may include a `/branch--{branch-name}/` prefix. If a widget was added to a canvas in the same flow, surface the widget URL: `{baseURL}canvas/{canvasName}#{widgetId}` (missing widgetId = retry, see **canvas** skill).

---

## Per-type recipes

All commands are `npx hypercanvas artifact create <type> [flags]`. Each goes through the same artifact API and validator.

### Prototype

```bash
npx hypercanvas artifact create prototype \
  --name <name> --title "<title>" \
  [--parent <notebook-relative-folder>] [--partial <partial-name-or-id>] \
  [--author <gh-login>] [--description "<...>"] [--flow]
```

- `--flow` (no value) generates a starter `default.flow.json`.
- `--partial` and `--url` are mutually exclusive.

### External Prototype

Same command as prototype, with `--url`:

```bash
npx hypercanvas artifact create prototype \
  --name <name> --title "<title>" --url https://… \
  [--parent <notebook-relative-folder>] [--author <gh-login>] [--description "<...>"]
```

No `index.jsx` is written; the prototype shows up in the viewfinder with an "external" badge and opens the URL in a new tab.

### Flow

```bash
npx hypercanvas artifact create flow \
  --name <name> --prototype <proto> \
  [--folder <folder>] [--title "<...>"] [--description "<...>"] \
  [--copy-from <existing-flow-name>] [--globals "nav,sidebar"]
```

Flows are always prototype-scoped — there's no global flow.

### Page

```bash
npx hypercanvas artifact create page \
  --name <page-name> --prototype <proto> --path <relative-path> \
  [--folder <folder>] [--template <partial-name-or-id>]
```

`--path` is the route inside the prototype (e.g. `settings/general` or `[id]`).

### Canvas

```bash
npx hypercanvas artifact create canvas \
  --name <name> [--title "<...>"] [--parent <notebook-relative-folder>] [--description "<...>"]
```

In a Notebook, the artifact is `<parent>/<Name>.canvas/<Name>.canvas.jsonl` and its route is `/canvas/<Name>`. In source-repository mode, legacy canvas grouping remains in effect.

### Component

```bash
npx hypercanvas artifact create component --name <PascalName> [--parent <notebook-relative-folder>]
```

In a Notebook, the CLI creates `<parent>/<PascalName>.component/` with `<PascalName>.story.jsx` and a CSS Module. Each named story export is rendered at `/components/<PascalName>`. In a source repository it creates `src/components/<PascalName>/` with the consumer component, stylesheet, and story files.

### Site

```bash
npx hypercanvas artifact create site --name <name> [--title "<title>"] \
  [--parent <notebook-relative-folder>] [--development-base-url <url>]
```

The Notebook stores the Site descriptor in `<parent>/<name>.site/site.config.json`. Its external project/runtime binding remains separate from that descriptor. To add an existing project, use the dedicated `hypercanvas site add` or `hypercanvas site create` command and its `--root`/URL options; do not move or copy the external project into the Notebook.

**Icon imports:** import one icon module at a time from `@dfosco/hypercanvas/icons/<slug>`, for example `import PlusIcon from '@dfosco/hypercanvas/icons/plus'`. Available slugs are the files under `packages/storyboard/src/internals/lucide/icons/`. Do not import an icon catalog.

### Object

```bash
# Empty object — server defaults body to {}
npx hypercanvas artifact create object --name <name> [--prototype <proto>]

# With initial content — use the API directly
curl -s -X POST http://localhost:<port>/_hypercanvas/artifact/ \
  -H 'Content-Type: application/json' \
  -d '{"type":"object","name":"jane-doe","prototype":"<proto-if-scoped>","body":{"name":"Jane","role":"admin"}}'
```

Inside a prototype folder = scoped (resolves as `<proto>/<name>` first, then global). At the root = global.

### Record

```bash
# Empty record (entries: [])
npx hypercanvas artifact create record --name <name> [--prototype <proto>]

# With seed entries — use the API directly (each entry MUST have `id`)
curl -s -X POST http://localhost:<port>/_hypercanvas/artifact/ \
  -H 'Content-Type: application/json' \
  -d '{"type":"record","name":"posts","entries":[{"id":"a","title":"A"},{"id":"b","title":"B"}]}'
```

Match a record entry from a dynamic route page named `[<field>].jsx` — defaults to `id`, name the file `[permalink].jsx` to match `entry.permalink`.

---

## Rules

- **Inference over interrogation.** Apply the inference table first. Only ask for fields you cannot infer.
- **One question per `ask_user` call.** Never bundle multiple questions.
- **Names are kebab-case** matching `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, max 64 chars. **Components are PascalCase.**
- **Never hardcode template/recipe choices.** Always fetch from `/_hypercanvas/workshop/prototypes`.
- **Never hand-write artifact files** when the API can do it. Server-side validation catches duplicate names, missing prototypes, bad partial IDs, etc.
- **Notebook parents:** use `--parent` for new artifact creation. `--folder` remains a compatibility alias; do not pass both with different values. Use `--parent` only for an ordinary parent folder, never for a nested artifact folder.
- **Data files live inside the prototype folder.** Prototype-scoped `.flow.json` / `.object.json` / `.record.json` files sit next to the prototype's `index.jsx`. Never cross-reference data from another prototype.
- **Widget URL verification.** If a step adds a widget to a canvas, every response must include a `widgetId`. Surface a deep link: `{baseURL}canvas/{canvasName}#{widgetId}`. Missing widgetId = retry. Full reference in the **canvas** skill.

---

## Suggested next steps after creation

| Type             | Suggest                                                                                   |
|------------------|-------------------------------------------------------------------------------------------|
| Prototype / Page / Canvas | Open the printed dev URL.                                                          |
| External prototype | Open the viewfinder; the entry now shows the "external" badge and opens in a new tab.    |
| Flow             | Switch via the Flows menu or `?flow=<name>`. Reference objects via `$ref` / `$global`.    |
| Object / Record  | Read with `useObject('<name>')` / `useRecord('<name>')` or `$ref` from a flow.            |
| Component        | Visit `/components/<name>`. Add more named exports for variants. Embed on canvases by pasting the URL. |

---

## CLI fallback

`hypercanvas create` (no subcommand) is the older interactive command. It works but assumes a TTY and is harder to drive from an agent — prefer `hypercanvas artifact create <type>` for scripted use. Both end up POSTing to `/_hypercanvas/artifact/`.
