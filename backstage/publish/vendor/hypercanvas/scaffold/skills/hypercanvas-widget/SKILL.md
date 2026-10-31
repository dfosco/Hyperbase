---
name: hypercanvas-widget
description: Guide for creating custom canvas widgets — register a React component as a new widget type with full control over chrome (decorated or invisible), interaction switches (selectable / movable / resizable / expandable / split-screen / interact-gate), connector anchors, toolbar features, and prop schemas. Use when asked to create a custom widget, register a widget, add a new canvas widget type, build an invisible/locked/pinned widget, expose a component as a widget, or override a core widget.
metadata:
  author: Daniel Fosco
  version: "2026.6.6"
---

# Skill: hypercanvas-widget — Custom Canvas Widget Creation

Creating a new canvas widget type means registering a React component plus a small metadata definition with the Hypercanvas widget registry. The same configuration surface drives the built-in core widgets (sticky-note, image, terminal, etc.) — so anything they can do, your widget can do too.

> **Authoritative reference:** [`DOCS/custom-widgets.md` on GitHub](https://github.com/dfosco/hypercanvas/blob/main/DOCS/custom-widgets.md). When in doubt, fetch that doc and follow it.

## Triggers

- "create a custom widget", "register a widget", "add a new canvas widget type"
- "expose this component as a widget", "make X a canvas widget"
- "build an invisible widget", "build a locked / pinned / decorative widget"
- "override the sticky note / image / terminal widget"
- "add custom toolbar actions to a widget"
- Any prompt mentioning `mountStoryboardCore({ widgets })`, `registerWidget`, or `chrome.enabled`

---

## Decision flow — collect these inputs before writing code

Ask the user (one question per turn — use `ask_user`) until you have all of:

1. **Widget `type` string** — kebab-case, e.g. `kpi-tile`, `code-runner`. This goes into the canvas JSONL and never changes after the first widget instance is saved.
2. **Display label + icon** — what appears in the `+ Add widget` menu (skip if the widget should be hidden via `unlisted: true`).
3. **Chrome decision** — three choices:
   - **Decorated (default)** — wrap in standard WidgetChrome (hover toolbar, anchor ports, select handle, optional gate). Use when the widget should feel like a native Hypercanvas widget.
   - **Invisible (`chrome.enabled: false`)** — no built-in chrome. Component owns 100 % of the rendered surface. Use for landing-page decorations, brand chrome, fully custom interaction surfaces.
   - **Decorated but locked** (`chrome.enabled: true` + `interaction.movable: false` and/or `interaction.selectable: false`) — keep the chrome for actions but pin in place / hide select handle.
4. **Interaction switches** — confirm defaults or override:
   - `selectable` (default `true`)
   - `movable` (default `true`)
   - `resize` (default disabled — pass `{ enabled: true, prod: false }` to enable dev-only resize, `prod: true` for prod too)
   - `expandable` (default `false`)
   - `splitScreen` (default `false`)
   - `interactGate` (default `false`) — when `true`, overlays "Click to interact" until clicked. Use for embedded iframes, third-party components, anything that swallows pointer events you don't want stealing canvas pan/zoom.
5. **Connectors** — accept all (`accept: ['*']`) or restrict to specific types? Any anchors that should be `disabled` or `unavailable`?
6. **Toolbar features** — most widgets only need `copy` + `delete` in the overflow menu. Skip for invisible widgets that own their own UI.
7. **Props schema** — at minimum `width` and `height` (used by the autoplacement engine for default size). Any other persisted state (`text`, `url`, `variant`, etc.) goes here.
8. **Where to register** — almost always `mountStoryboardCore({ widgets })` in the consumer's main entry. If the user wants per-canvas dynamic registration, use `registerWidget()` instead.

If the user gives you incomplete info, fill in safe defaults and tell them.

---

## Implementation steps

### 1. Create the component file

`src/widgets/<WidgetName>/<WidgetName>.jsx` (follow the project convention — components in their own directory). Use CSS modules for styles.

The component receives these props by the contract:

| Prop | Type |
|---|---|
| `id` | `string` — stable widget id |
| `props` | `object` — current persisted props (matches your `props` schema) |
| `onUpdate(updates)` | `(object) => void` — patch persisted props |
| `resizable` | `boolean` |
| `selected` | `boolean` |
| `onSelect(shiftKey?)` | `(boolean) => void` |
| `multiSelected` | `boolean` |

**For invisible widgets (`chrome.enabled: false`):** render your own select affordance when `selected` is true. Otherwise the user can't tell the widget is selected.

**For widgets with custom toolbar features:** wrap the component in `forwardRef` + `useImperativeHandle(ref, () => ({ handleAction(actionId) { ... } }))`. Return `false` to fall through to the default canvas handler; return anything else (or undefined) to claim the action.

### 2. Register at mount

For standalone consumer apps, register the component through `mountStoryboardCore()` as shown below. In a Hypercanvas Notebook, keep the extension portable in the Notebook instead: put the component under `widgets/`, set its `entry` in the Notebook's `widgets.config.json`, and keep its JSON-safe metadata in that same definition. The Notebook runtime loads the component lazily and supplies the metadata to server-side placement as well; do not edit the Hypercanvas application mount.

```json
{
  "widgets": {
    "my-widget": {
      "entry": "widgets/MyWidget.jsx",
      "label": "My Widget",
      "icon": "sparkle-fill",
      "props": {
        "width": { "type": "number", "default": 360 },
        "height": { "type": "number", "default": 240 }
      }
    }
  }
}
```

`entry` must resolve to a module inside `widgets/` and default-export the React component. Module source is trusted Notebook code. The app-source registration below remains supported for non-Notebook consumers and as a fallback.

In the consumer's entry (typically `src/main.jsx` or a `_app.jsx` file):

```js
import { mountStoryboardCore } from '@dfosco/hypercanvas/core'
import storyboardConfig from './hypercanvas.config.json'
import MyWidget from './widgets/MyWidget/MyWidget'

mountStoryboardCore(storyboardConfig, {
  basePath: import.meta.env.BASE_URL || '/',
  widgets: {
    'my-widget': {
      component: MyWidget,
      label: 'My Widget',
      icon: 'sparkle-fill',
      chrome: { enabled: true },
      interaction: { selectable: true, movable: true },
      connectors: { anchors: { top: 'available', bottom: 'available', left: 'available', right: 'available' }, accept: ['*'], exclude: [] },
      features: [
        { id: 'copy',   type: 'action', action: 'copy',   label: 'Duplicate', icon: 'duplicate', menu: true, prod: true },
        { id: 'delete', type: 'action', action: 'delete', label: 'Delete',    icon: 'trash',     menu: true, prod: true },
      ],
      props: {
        width:  { type: 'number', label: 'Width',  default: 360 },
        height: { type: 'number', label: 'Height', default: 240 },
      },
    },
  },
})
```

### 3. Register server-side metadata in `hypercanvas.config.json`

So autoplacement (the `+ Add widget` flow) and collision detection use the right default size:

```json
{
  "widgets": {
    "my-widget": {
      "label": "My Widget",
      "props": {
        "width":  { "type": "number", "default": 360 },
        "height": { "type": "number", "default": 240 }
      }
    }
  }
}
```

**Important:** the browser-side and server-side metadata must agree on default sizes. The server side does not load React components — it only needs the JSON-safe metadata.

### 4. Verify icon exists

For a React component icon, import one Lucide icon module from `@dfosco/hypercanvas/icons/<slug>` and render it directly. Use an icon slug present in the installed package's `src/internals/lucide/icons/` directory. Toolbar configuration also accepts existing `primer/<name>` values for saved-data compatibility; do not add new Primer dependencies.

### 5. (Optional) Test the widget

If the consumer wants tests, add `MyWidget.test.jsx` next to the component using Vitest. Focus on:

- Renders without crashing given minimal props
- `onUpdate` is called with the right patch when user interacts
- `selected` state triggers any custom selection affordance (for chrome-disabled widgets)

---

## Recipe table — pick the right configuration

| Use case | `chrome.enabled` | `interaction.movable` | `interaction.selectable` | Notes |
|---|---|---|---|---|
| Standard widget (markdown-like) | `true` | `true` | `true` | Default — same as core widgets |
| Resizable rich widget | `true` | `true` | `true` | Add `interaction.resize: { enabled: true, prod: false }` |
| Iframe / embed | `true` | `true` | `true` | Add `interaction.interactGate: true` to prevent canvas scroll from being swallowed |
| Hero canvas decoration | `false` | `false` | `false` | Fully custom, no interaction. Combine with `unlisted: true` to hide from menu. |
| Background sticker (selectable to delete) | `false` | `false` | `true` | Render your own selection ring inside the component |
| Floating accent (custom UI, draggable) | `false` | `true` | `true` | Component handles its visual chrome; canvas handles drag |
| Override a core widget (e.g. sticky-note) | match core | match core | match core | **Replaces** the entire built-in definition — re-declare all features/anchors/props if you want them |

---

## Common pitfalls

- **Forgetting server-side metadata** → `+ Add widget` places the widget at the generic 270 × 170 default, not your intended size. Always add the same `widgets.<type>` block to `hypercanvas.config.json`.
- **`chrome.enabled: false` without rendering a select affordance** → users can't tell the widget is selected before deleting. Render an outline / ring / handle when `selected` is true.
- **`movable: false` without `selectable: false`** → user can still select and delete the "locked" widget. That's usually what you want (so they can clean up). Pair both to `false` only for truly immutable decoration.
- **Overriding a core widget partially** → consumer registrations REPLACE the entire core entry. Copy the baseline from `packages/storyboard/widgets.config.json` first if you want to tweak just one field.
- **Using the wrong icon name** → import an existing one-off icon module from the package's icon directory. Do not rely on a generated Primer icon catalog.
- **Not stamping `width`/`height` defaults in the props schema** → collision detection treats unknown widgets as 270 × 170 fallback.
- **Naming the type with uppercase/spaces** → use kebab-case strings only. The type is a stable identifier persisted in canvas JSONL.

---

## Reference

- Full API reference + TypeScript-flavored type: [`DOCS/custom-widgets.md`](https://github.com/dfosco/hypercanvas/blob/main/DOCS/custom-widgets.md)
- Live examples of every feature shape, connector config, prop schema: `node_modules/@dfosco/hypercanvas/widgets.config.json`
- Browser-side registry source: `node_modules/@dfosco/hypercanvas/src/core/stores/widgetRegistry.js`
- Server-side registry source: `node_modules/@dfosco/hypercanvas/src/core/canvas/customWidgets.js`
- Chrome wrapper (consumes per-widget switches): `node_modules/@dfosco/hypercanvas/src/internals/canvas/widgets/WidgetChrome.jsx`
