# Hypercanvas

> Note: this is a scaffold-source README. The file copied to client repos
> only contains the fragment bodies — the bare `<!-- … --start-->` markers
> below are stripped on whole-file copy. Clients can also adopt individual
> fragments by adding `<!-- storyboard:scaffold/README.md:<id> --start-->`
> markers around their own content.

<!-- hypercanvas-cli --start-->
## Hypercanvas CLI

Download the macOS Apple silicon disk image from [GitHub Releases](https://github.com/dfosco/hypercanvas/releases), drag Hypercanvas into Applications, and open it. The native MyGo shell supplies a window and menus. Before Core starts, it checks for Node.js 24 and npm. If either is missing, it asks whether to install the official Node release for your account or system-wide. Core starts only after that runtime is verified. App updates use a signed feed hosted in R2.

Node and agent CLIs are host installations. Hypercanvas bundles Core and its locked application dependencies, including Paseo and Sherpa. Install and authenticate agent CLIs with their publishers' instructions; Hypercanvas only reports their availability.

The existing `hypercanvas <command>` CLI remains the operational developer/agent interface. To inspect the host runtime and installed tools from a separate terminal, keep Hypercanvas running and use:

| Command | Purpose |
|---|---|
| `hypercanvas host-tools preflight` | Inspect the Core Node/npm baseline and host CLI discovery/version diagnostics. |

The command uses the running Core's branch-aware route and prints JSON. Host CLI installation and sign-in remain user-managed. See the [Hypercanvas installation and recovery guide](https://github.com/dfosco/hypercanvas/blob/main/DOCS/hypercanvas-install.md).

Notebook lifecycle and Core OS picker API routes have the corresponding `hypercanvas notebook recent/open/create/close` and `hypercanvas system select-directory|select-file` CLI clients.
<!-- hypercanvas-cli --end-->
