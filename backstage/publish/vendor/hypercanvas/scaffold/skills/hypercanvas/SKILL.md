---
name: hypercanvas
description: Hypercanvas data structuring and management system. Use when creating flow data, setting up Hypercanvas data, creating data objects, or structuring data for a prototype page.
metadata:
  author: Daniel Fosco
  version: "2026.6.6"
---

# Hypercanvas

> Triggered by: when building a new page or route in Hypercanvas, "create flow data", "set up Hypercanvas data", "create data objects", "create new page", "create new route", when structuring data for a prototype page

## What This Does

Guides the creation of data objects, flow files, and record collections for pages being built. Determines what data should be externalized into the Hypercanvas data system vs. hardcoded in the component.

## Data File Types

Hypercanvas uses **suffix-based naming** for data files. Files can live anywhere in the repo — a Vite plugin discovers them automatically at dev/build time.

| Suffix | Purpose | Example |
|--------|---------|---------|
| `.flow.json` | Page data context | `default.flow.json` |
| `.object.json` | Reusable data fragment | `jane-doe.object.json` |
| `.record.json` | Parameterized collection (array with `id` per entry) | `posts.record.json` |
| `[Name].component.json` | Component-level typed knobs (UI configuration) | `Button.component.json` |

**Rules:**
- Every name+suffix must be unique across the entire repo (build fails on duplicates)
- Files can be organized into any subdirectory structure
- JSONC (comments) is supported — use `.jsonc` extension if preferred
- `$ref` and `$global` use **name-based** references (not paths): `{ "$ref": "jane-doe" }` finds `jane-doe.object.json` anywhere

## Notebook artifact folders

Notebook artifacts use suffix-named folders: `.prototype`, `.component`, `.canvas`, and `.site`. They can live beneath any ordinary organizational folders, and ordinary folders can contain a mix of artifact types. For example, a `research/` folder may contain both `Signup.prototype/` and `Board.canvas/`.

Use `--parent <ordinary-folder-path>` when creating an artifact beneath a selected Notebook folder. Omit it to create at the Notebook root. `--folder` remains a compatibility alias; if both are provided they must refer to the same parent. There is no required `prototypes/`, `canvas/`, or `sites/` wrapper — they are only ordinary folders when they already exist, and new artifacts belong anywhere in the Notebook.

Artifact folder names are physical paths. A leading run of underscores hides the folder without changing the logical name or payload filename: `_Guide.prototype/index.jsx` is still the `Guide` prototype, and its payload does not become `_Guide.jsx`. Hidden prototypes do not register a route. Visible prototype routes include the literal suffix, such as `/Guide.prototype`; component routes remain `/components/Guide`. Route conflicts are checked case-insensitively.

Do not put an artifact folder inside another artifact folder, even through an intermediate ordinary directory. Hypercanvas reports the exact nested and containing paths in an error modal. Its repair action moves the nested artifact to the closest parent outside every artifact folder; it refuses a destination collision instead of overwriting content. Diagnostics reflect the current tree, so recreating invalid nesting after a repair reports it again.

The repair command requires the current Notebook identity, generation, revision, exact nested and containing paths, and the proposed destination shown by the diagnostic. For example:

```bash
hypercanvas notebook repair \
  --notebook-id <notebook-id> --generation <generation> --expected-revision <sha256> \
  --nested-kind prototype --nested-path Research/Outer.prototype/Inner.prototype \
  --containing-kind prototype --containing-path Research/Outer.prototype \
  --expected-destination Research/Inner.prototype --json
```

The CLI sends this guarded request to `POST /_hypercanvas/notebook/repair`. The server rechecks the revision, nesting, paths, and destination under the Notebook lock. A stale diagnostic or occupied destination is rejected; reload the tree and use the newly reported destination. Repair addresses reported invalid nesting; it does not adopt legacy source-repository files.

## Notebook sidebar visibility

`hypercanvas.config.json` may stay at the Notebook root or live in `config/`. The root file wins when both locations contain the same config name. A legacy `storyboard.config.json` remains readable; the primary `hypercanvas.config.json` wins across both locations.

Use the top-level `sidebarIgnored` array to control which ordinary folders appear in the Notebook sidebar. The default hides `data/`, `components/`, `config/`, `node_modules/`, and dot-prefixed directories at any depth. Patterns use `.gitignore` syntax, including ordered negation. A supplied array replaces the defaults; `[]` shows those folders. This only filters sidebar navigation. It does not remove catalog entries or disable direct artifact routes. Underscore-prefixed folders and internal runtime directories remain hidden.

```json
{
  "sidebarIgnored": ["data/*", "!data/examples/", "components/", "config/", "node_modules/", ".*/"]
}
```

### Explicitly migrate legacy Notebook artifacts

Use the migration CLI only when the user asks to adopt legacy Notebook artifacts. It previews eligible physical files first; preview is read-only. Apply only the returned plan for the same Notebook generation and revision. Review route changes before applying. `--accept-route-changes` acknowledges canonical URL changes; it does not rewrite links inside authored content.

```bash
hypercanvas notebook migration preview \
  --notebook-id <id> --generation <n> --expected-revision <sha256> --json

hypercanvas notebook migration apply \
  --notebook-id <id> --generation <n> --expected-revision <sha256> \
  --plan-id <id> --plan-digest <sha256> [--accept-route-changes] --json

hypercanvas notebook migration recover \
  --notebook-id <id> --generation <n> --migration-id <id> \
  --expected-journal-revision <sha256> --action resume|rollback --json
```

The matching endpoints are `POST /_hypercanvas/notebook/migration/preview`, `/apply`, and `/recover`. If an apply is interrupted, use its migration ID and current journal revision to choose `resume` or `rollback`; do not edit the journal or move files by hand. Migration handles legacy Notebook adoption only. It does not normalize the separate v1 manifest format or convert source-repository scaffolds.

Sibling order defaults to Prototypes, Canvas, Sites, other folders, then other artifacts. A saved per-parent override lives at `notebook.siblingOrder[<parentPath>]` in `hypercanvas.config.json`; folder references use full Notebook-relative paths and artifact references use stable marker IDs:

```json
{
  "notebook": {
    "siblingOrder": {
      "Research": [
        { "kind": "artifact", "id": "<stable-artifact-marker-id>" },
        { "kind": "folder", "path": "Research/notes" }
      ]
    }
  }
}
```

Ordering applies only to the direct children of that parent. Dragging moves an item before or after another sibling in the same folder; it does not move artifacts into folders. Order changes update the sidebar without reloading the app or authored documents. Published notebooks retain their hierarchy and saved order, with reordering disabled.

## Knobs — Typed Configuration UI

A knob is a typed configuration control backed by URL hash state so prototype and component variations can be tweaked and shared.

Use knobs for typed configuration that should have a built-in UI for tweaking and a deep-linkable URL representation. Do not use knobs for page data context (use flows), reusable data fragments (use objects), or ad-hoc URL state without a UI (use raw `useOverride`).

| Where | File | Shape |
|-------|------|-------|
| Prototype-wide | `[name].prototype.json` | `meta.knobs: KnobDef[]` |
| Component | `[Name].component.json` | top-level `knobs: KnobDef[]` |
| Custom widget | `widgets.config.json` | `widgets.<type>.knobs` |

Knob types:
- `text` — single-line string input.
- `textarea` — multi-line string input.
- `number` — numeric input.
- `slider` — bounded numeric slider.
- `boolean` — true/false toggle.
- `select` — dropdown with `options`.
- `radio` — radio group with `options`.
- `range` — two-number min/max value.
- `date` — ISO date string (`YYYY-MM-DD`).
- `object` — grouped nested knobs.
- `string-array` — ordered list of strings.

There is no color picker in v1; use `select` for known tokens or `text` for raw color values.

Knobs are prototype-wide by default. Add `scope: "/RouteName"` to limit a knob to one route, and pass the same route to `useKnob(id, { route })` when the reader cannot rely on the current URL.

Hash keys are deterministic: `knob` + PascalCase(route?) + PascalCase(id). For example, route-scoped `variant` on `/Branding` becomes `knobBrandingVariant`; global `headline` becomes `knobHeadline`.

### Worked example

```json
// signup.prototype.json
{
  "meta": {
    "title": "Signup",
    "knobs": [
      {
        "id": "headline",
        "type": "text",
        "label": "Headline",
        "default": "Close the feedback loop."
      },
      {
        "id": "variant",
        "type": "select",
        "label": "Branding variant",
        "scope": "/Branding",
        "default": "startup",
        "options": ["startup", "enterprise", "minimal"]
      },
      {
        "id": "showTestimonial",
        "type": "boolean",
        "label": "Show testimonial",
        "scope": "/Branding",
        "default": true
      }
    ]
  }
}
```

```jsx
import { useKnob } from '@dfosco/hypercanvas'

function Branding() {
  const headline = useKnob('headline')
  const variant = useKnob('variant', { route: '/Branding' })
  const showTestimonial = useKnob('showTestimonial', { route: '/Branding' })

  return (
    <aside data-variant={variant}>
      <h1>{headline}</h1>
      {showTestimonial ? <Testimonial /> : null}
    </aside>
  )
}
```

Generated hash:

```text
#knobHeadline=Close+the+loop&knobBrandingVariant=enterprise&knobBrandingShowTestimonial=false
```

### Decision: knobs vs flows vs overrides

Use flows and objects for content/model data, knobs for user-tweakable typed configuration, and raw overrides only for internal URL state that does not need a schema or UI.

| Need | Use |
|---|---|
| Page data context (user, posts, settings) for a single page | flow |
| Reusable data fragment shared between pages | object |
| Typed configuration the user should be able to tweak from a UI | **knob** |
| One-off URL state without a schema or UI (e.g. internal toggle) | useOverride |

> **Cross-references**
> - `.agents/skills/hypercanvas-knobs/SKILL.md` — deep authoring guide for full schema details, advanced types, and custom widget integration.
> - `DOCS/knobs.md` — long-form knobs reference.

## When This Applies

- After the primer-builder skill has identified the page structure and components (Steps 1–3)
- Replaces the primer-builder's Step 4 (Plan Data) with a more structured approach
- When refactoring an existing page to use flow data
- When creating dynamic route pages with records

## Navigation Anti-Pattern

**DO NOT use React Router's `<Link>` component for internal navigation.** Use plain `<a href="...">` tags instead.

The Hypercanvas hash preserver intercepts `<a>` clicks to preserve URL hash params and handle client-side routing. React Router `<Link>` bypasses this by calling `navigate()` directly, which creates a duplicate browser history entry (one from `<Link>`, one from the hash preserver's click handler). This causes a "double back" bug where the user must press back twice to actually navigate back.

```jsx
// ❌ BAD — creates double history entries
<Link to="/Overview">Overview</Link>

// ✅ GOOD — intercepted by hash preserver for client-side navigation
<a href="/Overview">Overview</a>
```

## The Core Rule: What Goes in Data vs. What's Hardcoded

### Externalize as data objects

**Content and business model data** — anything that represents "what" the page displays:

- User profiles (name, avatar, bio, role)
- Repository / project metadata (name, description, language, stars, forks)
- Issue / PR items (title, state, author, labels, timestamps)
- Organization info (name, avatar, member count)
- Lists of entities (repos, issues, teams, packages, people)

**Navigation** — always externalize because it has repeated elements with many labels that benefit from easy bulk adjustment:

- Top navigation tabs (label, icon, counter, url, current state)
- Sidebar filter lists
- Settings section navigation
- Breadcrumb paths

**Important**: This will more usually be slotted in existing Template components from the repository, not generated code.

### Hardcode in the component

**UI chrome and microcopy** — anything that describes "how" the page works:

- Button labels: `"New repository"`, `"Save changes"`, `"Cancel"`
- Placeholder text: `"Find a repository..."`
- Section headings that are structural: `"Pinned repositories"`, `"Activity"`
- Empty state messages: `"No results found"`
- Filter dropdown labels: `"Type"`, `"Language"`, `"Sort"`
- Dropdown option labels: `"All"`, `"Public"`, `"Private"`
- Static instructional text

### Gray area — use judgment

- **Counters on tabs** — externalize if they represent real data counts; hardcode if decorative
- **Metadata labels** (e.g., "Updated 3 days ago") — externalize the date, hardcode the label format
- **Card/list item structure** — externalize the items array, hardcode the card template

## Workflow

### Step 1: Inventory the data needs

From the page description (primer-builder Step 1), list every piece of dynamic content:

```
Navigation:
  - topnav: 9 tabs with icons, labels, counters, active state
  - sidenav: 10 filter options with active state

Content:
  - org name, avatar
  - 6 repository items, each with: name, description, language, stars, updated date
  - filter query string
```

### Step 2: Design the data objects

Create one object file per logical entity:

| Data type | File name pattern | Example |
|-----------|------------------|---------|
| User/person | `{name}.object.json` | `jane-doe.object.json` |
| Navigation | `{context}-navigation.object.json` | `org-navigation.object.json` |
| Entity list | `{entity-plural}.object.json` | `repositories.object.json` |
| Org/team | `{org-name}.object.json` | `primer-org.object.json` |

**Object structure rules:**
- **The object file's top-level structure IS the value that `$ref` resolves to.** If the flow has `"repositories": { "$ref": "repositories" }`, the object file should be a bare array `[...]`, not `{ "repositories": [...] }` — otherwise the data double-nests as `repositories.repositories`.
- Same rule for single-entity objects: if the flow has `"user": { "$ref": "jane-doe" }`, the object file should contain the user fields directly at root (`{ "name": "Jane", ... }`), not wrapped in `{ "user": { "name": "Jane", ... } }`.
- Keep objects flat where possible — avoid deep nesting
- Use arrays for lists of items
- Include all fields that the UI needs — don't make the component compute derived data
- Use realistic placeholder data (real GitHub avatar URLs, plausible repo names, etc.)

### Step 3: Compose the flow

Create a flow file that composes the objects:

```json
// default.flow.json
{
  "$global": ["org-navigation"],
  "user": { "$ref": "jane-doe" },
  "org": {
    "name": "my-org",
    "avatar": "https://avatars.githubusercontent.com/u/9919?v=4"
  },
  "repositories": { "$ref": "repositories" }
}
```

**flow composition rules:**
- Use `$global` for navigation — it merges at the root level, making nav data available at the top
- Use `$ref` for entity objects — keeps them reusable across flows
- `$ref` and `$global` use **names**, not paths: `"jane-doe"` not `"../objects/jane-doe"`
- Inline small, flow-specific data directly (org name, settings, filter state)
- Name the flow after the page/flow: `org-repos.flow.json`, `issue-detail.flow.json`
- Rule of thumb: a flow can be named after its corresponding page

### Step 4: Wire up the component

In the page component, use `useflowData()` with dot-notation paths:

```jsx
import { useFlowData, useFlowLoading } from '@dfosco/hypercanvas'

function ReposPage() {
  const topnav = useflowData('topnav')       // from $global navigation
  const sidenav = useflowData('sidenav')     // from $global navigation
  const org = useflowData('org')
  const repos = useflowData('repositories')
  const loading = useflowLoading()

  if (loading) return <Spinner />

  return (
    <Application title={org.name} topnav={topnav} sidenav={sidenav}>
      {/* Hardcoded UI chrome */}
      <h2>All repositories</h2>
      <Button variant="primary">New repository</Button>
      <TextInput placeholder="Find a repository..." />

      {/* Data-driven content */}
      {repos.map(repo => (
        <article key={repo.name}>
          <h3><a href={repo.url}>{repo.name}</a></h3>
          <p>{repo.description}</p>
        </article>
      ))}
    </Application>
  )
}
```

## Records & Dynamic Routes

Records power **parameterized pages** — the same page template renders different content based on the URL.

### Creating a record

A record file is a **collection** — an array of entries, each with a unique `id`:

```json
// posts.record.json
[
  {
    "id": "welcome-to-hypercanvas",
    "title": "Welcome to Hypercanvas",
    "date": "2026-02-14",
    "author": "Jane Doe",
    "body": "..."
  },
  {
    "id": "another-post",
    "title": "Another Post",
    "date": "2026-02-13",
    "author": "Jane Doe",
    "body": "..."
  }
]
```

### Creating a dynamic route page

The filename convention `[field].jsx` determines which record field the route matches against:

- `pages/issues/[id].jsx` → `useRecord('issues')` matches `entry.id`
- `pages/posts/[permalink].jsx` → `useRecord('posts', 'permalink')` matches `entry.permalink`

The second argument to `useRecord` defaults to `'id'`, so `useRecord('issues')` is equivalent to `useRecord('issues', 'id')`.

In the component, use `useRecord()`:

```jsx
import { useRecord } from '@dfosco/hypercanvas'

function BlogPost() {
  // 'posts' = record file name, 'id' = route param matched against entry.id
  const post = useRecord('posts', 'id')
  // URL /posts/welcome-to-hypercanvas → entry with id "welcome-to-hypercanvas"

  if (!post) return <p>Post not found</p>
  return <h1>{post.title}</h1>
}
```

### Listing all records

Use `useRecords()` for index/listing pages:

```jsx
import { useRecords } from '@dfosco/hypercanvas'

function PostsIndex() {
  const posts = useRecords('posts')
  return posts.map(post => (
    <a key={post.id} href={`/posts/${post.id}`}>{post.title}</a>
  ))
}
```

### Records + flows

A page can use both a flow (for page-level data like navigation) and a record (for parameterized content). Pass `recordName` and `recordParam` to `StoryboardProvider` to merge record data under the `record` key:

```jsx
<StoryboardProvider recordName="posts" recordParam="slug">
  {/* useflowData('record.title') works here */}
</StoryboardProvider>
```

### No `useState` in pages or components

All state management must happen through Hypercanvas hooks. Hypercanvas state lives in the URL hash — not in React component state.

**Use these hooks instead:**

| Hook | Purpose |
|------|---------|
| `useflowData(path?)` | Read flow data by dot-notation path |
| `useOverride(path)` | Read/write hash-param overrides on flow or object data. Works with or without `<StoryboardProvider>`. |
| `useObject(name, path?)` | Load an object data file directly by name, without a flow. Supports dot-notation path and hash overrides (`object.{name}.{field}`). |
| `useRecord(name, param?)` | Load a single record entry matched by URL param (defaults to `'id'`) |
| `useRecords(name)` | Load all entries from a record collection |
| `useflowLoading()` | Returns true while flow is loading |

**Why:** Hypercanvas is a prototyping framework where all data flows through the URL hash. This makes every state change shareable via URL, inspectable in the address bar, and framework-portable. Using `useState` breaks this contract — the state becomes invisible, unshareable, and tied to React.

## Common Pitfall: Double-Nesting with `$ref`

The most frequent data bug is double-nesting. This happens when an object file wraps its data in a key that matches the flow's `$ref` key:

```
// ❌ WRONG — causes double-nesting (advisory.advisory)

// flow: { "advisory": { "$ref": "advisory" } }
// advisory.object.json:
{ "advisory": { "title": "Bug", "severity": "High" } }
// Result: flow.advisory = { "advisory": { "title": "Bug", ... } }

// ✅ CORRECT — object file is the raw value

// flow: { "advisory": { "$ref": "advisory" } }
// advisory.object.json:
{ "title": "Bug", "severity": "High" }
// Result: flow.advisory = { "title": "Bug", "severity": "High" }
```

**Rule of thumb:** The `$ref` key in the flow IS the namespace. The object file provides the value.

## Hash Param Preservation (CRITICAL)

URL hash params are the foundation of the override system. They carry user-set and session-set values across navigations. **Never write code that drops them.**

### How it works

`installHashPreserver(router)` in `src/index.jsx` patches both `<a>` click interception and `router.navigate()` so that hash params automatically carry forward on every navigation — including programmatic `navigate('/SomePage')` calls.

### Rules

1. **Never manually strip or omit the hash.** The global preserver handles it. Plain `navigate('/Page')` works — the hash carries forward automatically.
2. **Never bypass the router.** Using `window.location.href = '/Page'` or `window.location.assign()` will drop the hash. Always use React Router's `navigate()` or `<Link>`.
3. **If a page reads overrides, it must use the hooks.** `useflowData(path)` automatically merges hash overrides. `useOverride(path)` gives read/write access.
4. **If a page writes overrides, downstream pages get them for free.** The Signup→Dashboard flow works because Signup writes via `useOverride`, navigation carries the hash, and Dashboard reads via `useflowData` — no manual plumbing needed.
5. **To intentionally clear overrides**, use `clearValue` from `useOverride` or `removeParam` from `session.js`. Never clear by navigating without the hash.

## Checklist

Before finishing data structuring, verify:

- [ ] **No double-nesting:** Object files referenced via `$ref` contain raw values, not wrapped in a key
- [ ] Every navigation array is in a data object (not hardcoded in the component)
- [ ] Every list of content items is in a data object
- [ ] User/org profile data is in a data object
- [ ] Button labels, placeholder text, and section headings are hardcoded
- [ ] The flow file uses `$global` for navigation and `$ref` for entities
- [ ] `$ref` and `$global` use **names** (not relative paths)
- [ ] Data files use the correct suffix: `.flow.json`, `.object.json`, `.record.json`
- [ ] The component uses `useflowData()` for all externalized data
- [ ] Shared data objects use `useObject()` when not part of a flow
- [ ] Dynamic route pages use `useRecord()` for parameterized content
- [ ] Data objects use realistic placeholder values
- [ ] The flow name matches the page name or flow
- [ ] **Hash params are never dropped** — see "Hash Param Preservation" above

## Final Step: Provide the URL

After creating the flow and wiring up the component, **always provide the full dev URL** so the user can immediately preview the page.

**Page-flow matching:** If the flow file name matches the page file name exactly (e.g. `Repositories.flow.json` for `pages/Repositories.jsx`), the flow loads automatically — no `?flow=` param needed:

```
http://localhost:1234/Repositories
```

If the flow name differs from the page name, add the `?flow=` parameter:

```
http://localhost:1234/Repositories?flow=heron-silver
```

For dynamic routes, use the record entry's `id` as the URL slug:

```
http://localhost:1234/posts/welcome-to-hypercanvas
```
