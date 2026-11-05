# Hyperbase

A local design notebook for reviewing Hypercanvas chrome and publishing flows.

Open this folder in Hypercanvas: `~/workspace/hypercanvas-notebooks/hyperbase`.

## Notebook layout

- `prototypes/chrome-overview.prototype/` owns the Chrome prototype and its supporting `components/`, `styles/`, `hooks/` and `lib/` source.
- `ChromeSidebar.component/`, `ChromeTopbar.component/`, `ChromeDialogs.component/`, `ChromeMenus.component/` and `ChromePanels.component/` are discoverable component artifacts. Their stories reference the same Chrome implementation inside the prototype; the code is not duplicated.
- `canvas/chrome-components.canvas/` and `canvas/loading-and-error-states.canvas/` hold the original canvas logs and stable artifact identities.
- `PublishStates.component/` and `publish-design.canvas/` hold the publishing design exploration.
- `backstage/config/` holds Notebook and application configuration. `backstage/assets/` holds images, snapshots and loading-state previews.
- `.hypercanvas/` holds local runtime state, including guarded migration recovery records.

Supporting folders inside a prototype are ordinary folders. Never nest another `.prototype`, `.component`, `.canvas` or `.site` artifact inside an artifact.

## Review routes

- `/chrome-overview.prototype` is the canonical Chrome prototype route. The migrated `/chrome-overview` alias remains available for existing links.
- `/components/ChromeSidebar?export=Default` opens a component state. Substitute another Chrome component or export (`Active`, `Empty`, `Narrow`).
- `/canvas/chrome-components` and `/canvas/loading-and-error-states` retain their original routes and layouts.
- `/canvas/publish-design` is the Publish design review canvas.

Use the runtime's base URL when opening links. Authored navigation preserves the current pathname, query and hash, including branch prefixes.

## Component and style ownership

The Chrome prototype contains the existing shadcn Base UI primitives and CSS Modules. All implementation imports are relative to that source tree. The `#hyperbase/` alias remains configured for shadcn generation and points to the prototype folder; `components.json` and `jsconfig.json` agree with it.

`prototypes/chrome-overview.prototype/styles/shadcn.css` owns Chrome's theme tokens and Tailwind build. Its explicit source scan includes the prototype entry and its component tree. Each component story imports that stylesheet in its isolated document. The Publish exploration separately vendors the actual Chrome controls and compiled styles locally; source provenance is documented in `PublishStates.component/chrome/PROVENANCE.md`. Runnable artifacts use Notebook-local sources and the supported compiled Hypercanvas frontend API, not a sibling application checkout.

Before moving an approved composition into Core, copy the required source and wire callbacks to real actions. The application must not depend on this local notebook.

## Collaborator runtime

From this repository, run `npm install`, then `npm run dev`. Run `npm run build` for a production build. The compiled runtime is included under `vendor/hypercanvas/`; no installed Hypercanvas application or sibling checkout is required.

Twelve mirrored application Storybook demos are **source-only references**, not runnable Notebook components: AgentComposer, CanvasTools, CommandPalette, NotebookShell, NotebookShellNotice, NotebookSidebarResize, ShellTabs, PublisherAccordion, PublishingConnection, PublishingPanel, SidePanelStatusDots and SidePanelSubPageNav.

Their source and original identity metadata are preserved in ordinary `*.reference/` folders under `Components/`, with each story stored as `*.story.jsx.txt`. These names intentionally prevent artifact registration and executable story discovery. The references retain their original application-source imports for reading; they are not standalone modules. Do not rename them back to `*.component/` or executable story files when syncing references. Publishing and agent controllers must not be added to the collaborator runtime to make these demos runnable.

The other component stories, prototypes, documents and canvases remain runnable.

## Publishing concepts

The Publish canvas is an interactive design artifact. Its controls simulate state changes; they do not connect GitHub, create repositories, upload files, or deploy websites.

The design distinguishes the local notebook, its GitHub source repository, and the host serving its viewing copy. The canvas presents separate connected component widgets for GitHub setup and GitHub Pages, Netlify, Cloudflare Pages and Vercel flows. All provider flows are simulations. Publishing covers the entire notebook; the source branch belongs in Hypercanvas config. Plain connectors show the relationship between states, without arrowheads.
