# Hypercanvas Chrome source

These controls are copied unchanged from Hypercanvas because the package does not expose public imports for Chrome primitives. Button, Input, Select and Separator are the actual NotebookShell Chrome components, not reimplementations.

Source checkout commit: 6e4140cef2745e4ec74dbb4fa977a308b61351e4

- `packages/storyboard/src/internals/chrome/ui/`
- `packages/storyboard/src/internals/chrome/utils.js`
- `packages/storyboard/src/internals/hc-classnames.js`
- `packages/storyboard/src/core/ui/sidepanel.css`

The notebook has no application package dependency. `core.css` is an unchanged snapshot of `packages/storyboard/dist/tailwind.css`, carrying the actual prefixed utilities and theme tokens. Individual Lucide modules and their relative helpers are unchanged copies from `packages/storyboard/src/internals/lucide/`. Everything resolves inside the notebook; no worktree paths or application installation is required. The panel reuses SidePanel CSS and header structure without mounting the production component, which would subscribe to live application stores.

Revision 3 also vendors `ui/dropdown-menu.jsx` byte-for-byte from the current worktree. The returning tool uses its Base UI menu, radio items, focus handling and keyboard navigation. Source hashes are in the revision-3 manifest.
