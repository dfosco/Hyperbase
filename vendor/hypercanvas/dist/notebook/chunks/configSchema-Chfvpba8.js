import { A as AUTO_PLACE_DEFAULTS } from "./canvasConfig-JhY60Ge2.js";
import { D as DEFAULT_NOTEBOOK_BROWSER_LINK, n as normalizeNotebookBrowserLinkOptions } from "./notebookView-DgDXRwmz.js";
const THEME_HUE_BASE = 295;
const DEFAULT_THEME_HUES = {
  purple: { label: "Purple", hue: THEME_HUE_BASE },
  blue: { label: "Blue", hue: 250 },
  orange: { label: "Orange", hue: 55 },
  teal: { label: "Teal", hue: 190 },
  green: { label: "Green", hue: 145 },
  pink: { label: "Pink", hue: 350 },
  slate: { label: "Gray", hue: 255, chromaScale: 0.35 }
};
const DEFAULT_THEME_HUE_BY_MODE = { light: "purple", dark: "purple" };
function resolveThemeHues(theming) {
  const config = theming !== null && typeof theming === "object" ? theming : {};
  const hues = Object.fromEntries(Object.entries(DEFAULT_THEME_HUES).map(([id, value]) => [id, { ...value }]));
  const issues = [];
  const definitions = config.hues;
  if (definitions !== void 0) {
    if (!definitions || typeof definitions !== "object" || Array.isArray(definitions)) {
      issues.push("Theme hue definitions must be an object of named hues.");
    } else {
      for (const [id, definition] of Object.entries(definitions)) {
        const value = definition !== null && typeof definition === "object" ? definition : {};
        if (!/^[a-z][a-z0-9_-]{0,47}$/.test(id)) {
          issues.push("Hue names must start with a lowercase letter and contain only lowercase letters, numbers, underscores or hyphens.");
        } else if (typeof value.label !== "string" || !value.label.trim() || value.label.trim().length > 60 || typeof value.hue !== "number" || !Number.isFinite(value.hue) || value.hue < 0 || value.hue >= 360) {
          issues.push(`Hue “${id}” needs a label and a hue angle from 0 up to, but not including, 360.`);
        } else if (value.chromaScale !== void 0 && (typeof value.chromaScale !== "number" || !Number.isFinite(value.chromaScale) || value.chromaScale < 0 || value.chromaScale > 1)) {
          issues.push(`Hue “${id}” needs a chromaScale number from 0 to 1, or no chromaScale to keep the current saturation.`);
        } else {
          hues[id] = { label: value.label.trim(), hue: value.hue, ...typeof value.chromaScale === "number" ? { chromaScale: value.chromaScale } : {} };
        }
      }
    }
  }
  const choices = config.hueByMode !== null && typeof config.hueByMode === "object" ? config.hueByMode : {};
  if (config.hueByMode !== void 0 && (!config.hueByMode || typeof config.hueByMode !== "object" || Array.isArray(config.hueByMode))) {
    issues.push("Theme hue choices must be an object with light and dark names.");
  }
  const hueByMode = { ...DEFAULT_THEME_HUE_BY_MODE };
  for (const mode of ["light", "dark"]) {
    const choice = choices[mode];
    if (choice === void 0) continue;
    if (typeof choice === "string" && Object.hasOwn(hues, choice)) hueByMode[mode] = choice;
    else issues.push(`The ${mode} mode hue must name a valid hue definition.`);
  }
  return { hues, hueByMode, issues };
}
function themeHueVariables(theming) {
  const { hues, hueByMode } = resolveThemeHues(theming);
  return {
    "--hc-theme-hue-light": String(hues[hueByMode.light]?.hue ?? THEME_HUE_BASE),
    "--hc-theme-hue-dark": String(hues[hueByMode.dark]?.hue ?? THEME_HUE_BASE),
    "--hc-theme-hue-chroma-light": String(hues[hueByMode.light]?.chromaScale ?? 1),
    "--hc-theme-hue-chroma-dark": String(hues[hueByMode.dark]?.chromaScale ?? 1)
  };
}
const DEFAULT_MAX_FOLDER_LAYERS = 4;
function normalizeNotebookSidebar(value) {
  const layers = value?.maxFolderLayers;
  return { maxFolderLayers: Number.isInteger(layers) && layers >= 1 ? layers : DEFAULT_MAX_FOLDER_LAYERS };
}
const builtinPasteRules = [
  {
    id: "figma",
    match: "https?://(?:www\\.)?figma\\.com/",
    widget: "figma-embed",
    propsMap: { width: 800, height: 450 }
  }
];
const configDefaults = {
  sidebarIgnored: ["backstage/", "publish/", "data/", "components/", "config/", "node_modules/", ".*/"],
  // New Hyper Agent tabs resolve provider overrides before this default.
  // featureFlags.hyperAgentInterface=false forces terminal mode globally.
  hyperAgent: {
    defaultProvider: "codex",
    defaultInterface: "agent",
    providers: {}
  },
  customDomain: "",
  prodDomain: "",
  port: 0,
  devDomainColor: "",
  repository: { owner: "", name: "" },
  lifecycle: {
    hooks: { onStart: [], onArtifactCreate: [] }
  },
  modes: { enabled: false },
  comments: { discussions: { category: "Comments" } },
  plugins: {},
  workshop: {
    enabled: false,
    // Each `create<X>` flag controls whether the corresponding item appears
    // in the workspace Create-Artifact menu. Default true — set to false in
    // a consumer's storyboard.config.json to hide that item.
    features: {
      createPrototype: true,
      createCanvas: true,
      createDoc: true,
      createComponent: true,
      createFlow: true,
      createPage: true,
      createObject: true,
      createRecord: true
    }
  },
  featureFlags: {
    // Core enforces this policy; browser-local overrides cannot enable it.
    hyperAgentInterface: true,
    // Opt into the wrapper-only one-time browser handoff and session gate.
    // Disabled by default so additional browsers can open the local Core UI.
    browserSessionHandoff: false
  },
  ui: {},
  toolbar: {},
  notebookBrowserLink: { ...DEFAULT_NOTEBOOK_BROWSER_LINK },
  // Folder layers that expand inline in the notebook sidebar (top-level folders are layer 1).
  // Deeper folders open the sidebar panel instead.
  notebookSidebar: { maxFolderLayers: DEFAULT_MAX_FOLDER_LAYERS },
  canvas: {
    autoPlace: {
      overlap: { ...AUTO_PLACE_DEFAULTS.overlap },
      align: { ...AUTO_PLACE_DEFAULTS.align }
    },
    overrides: {},
    pasteRules: builtinPasteRules,
    github: {
      embedBehavior: "link-preview",
      // "link-preview" | "rich-embed"
      ghGuard: "copy"
      // "copy" | "link" | "off"
    },
    zoom: {
      min: 10,
      max: 250,
      step: 10,
      gestures: true,
      // when false, disables cmd+wheel and pinch-to-zoom; +/- buttons still work
      origin: "center"
      // "center" | "top-left" — anchor point for toolbar and keyboard zoom. Cmd+scroll anchors at the cursor; Cmd+Alt+scroll anchors at viewport center.
    },
    surface: {
      // Sizing of the underlying canvas surface (`.tc-canvas`). Independent
      // per axis. "auto" preserves the default `max(100vw, 10000px)` floor
      // so users can pan into a large workspace. "viewport" sizes the
      // surface to exactly `100vw` / `100vh`, which is what landing-style
      // canvases want: the unscaled canvas matches the visible window
      // exactly, while zooming above 100% legitimately overflows and
      // surfaces horizontal/vertical scroll.
      width: "auto",
      // "auto" | "viewport"
      height: "auto"
      // "auto" | "viewport"
    },
    terminal: {
      resizable: false,
      defaultWidth: 800,
      defaultHeight: 450
    },
    fileEditor: {
      // CodeMirror theme per resolved mode (light vs. dark). Each value can
      // be null/"default"/"none" (no theme), "oneDark" (bundled), or an
      // inline { spec, dark } object passed to EditorView.theme.
      // The active mode is picked from `data-sb-code-theme` on <html>
      // (set by themeStore from the `codeBoxes` surface). Any value
      // starting with "dark" selects `theme.dark`.
      theme: {
        light: null,
        dark: "oneDark"
      }
    },
    // Opt-in affordances that are normally dev-only. When true the
    // corresponding interaction stays available in production builds
    // (and `?prodMode` simulation). Defaults are all false — production
    // canvases are read-only out of the box.
    production: {
      move: false,
      resize: false,
      editMarkdown: false,
      editSticky: false
    }
  },
  commandPalette: {
    providers: [],
    ranking: "frecency",
    sections: []
  },
  customerMode: {
    enabled: false,
    // Canonical shape — see CustomerModeConfig typedef above.
    homepage: false,
    tools: "all",
    commandPalette: true,
    branchBar: true,
    // Legacy aliases (kept in defaults so naive readers still see the field
    // shape they expect — initCustomerModeConfig folds these into the
    // canonical state at startup).
    hideChrome: false,
    hideHomepage: false,
    protoHomepage: "",
    canvasHomepage: ""
  },
  // Route table: path → target page. `"/"` selects the index surface.
  // Behavior-preserving default — today `/` renders the `home` surface
  // (SimpleWorkspace). A target is either a string (all envs) or a
  // per-env object `{ dev, prod, default }` resolved by resolveRouteTarget.
  // Example consumer override: { "/": { "dev": "workspace", "prod": "home" } }.
  routes: {
    "/": "notebook"
  },
  // Per-surface presentation props, keyed by surface name. The library
  // workspace pages spread these so customers never edit the JSX. Defaults
  // reproduce today's exact titles/subtitles and tab visibility.
  pages: {
    home: {
      title: "Hypercanvas",
      subtitle: "Collaborative workspace for design & code"
    },
    workspace: {
      title: "Hypercanvas",
      subtitle: "Where design work goes",
      logo: null,
      logoIcon: "iconoir/key-command",
      showAllArtifacts: false,
      showPrototypes: true,
      showCanvases: true,
      showComponents: true
    }
  },
  theming: {
    hues: DEFAULT_THEME_HUES,
    hueByMode: DEFAULT_THEME_HUE_BY_MODE,
    // Minimal default theme registry. Consumers add more in their own
    // storyboard.config.json — see README#theming. IDs starting with "dark"
    // are picked up by the Tailwind `dark:` variant via prefix match.
    themes: {
      light: { label: "Light", attrs: {} },
      dark: { label: "Dark", attrs: {} }
    },
    // Surface registry. Each surface ID is looked up in the DOM as
    // `[data-sb-surface="<id>"]`. The runtime writes
    // `data-sb-<id>-theme="<resolved>"` plus the active theme's companion
    // `attrs` onto every matching element.
    surfaces: {
      prototype: { label: "Prototype", sync: true },
      canvas: { label: "Canvas", sync: true },
      toolbar: { label: "Tools", sync: true },
      codeBoxes: { label: "Code boxes", sync: true }
    },
    // Default global theme. "system" follows OS prefers-color-scheme.
    default: "system"
  }
};
function mergeConfig(defaults, overrides) {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
    return overrides ?? defaults;
  }
  const overrideValues = overrides;
  const result = { ...defaults };
  for (const key of Object.keys(overrideValues)) {
    const val = overrideValues[key];
    if (val === void 0) continue;
    if (Array.isArray(val)) {
      result[key] = val;
    } else if (val && typeof val === "object" && !Array.isArray(val) && typeof defaults[key] === "object" && !Array.isArray(defaults[key])) {
      result[key] = mergeConfig(defaults[key], val);
    } else {
      result[key] = val;
    }
  }
  return result;
}
function migrateLegacyAutoPlace(raw) {
  const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
  const config = object(raw);
  const canvas = object(config?.canvas);
  const autoPlace = object(canvas?.autoPlace);
  if (!config || !canvas || !autoPlace) return raw;
  const migrated = { ...autoPlace };
  let changed = false;
  for (const section of ["overlap", "align"]) {
    const legacy = Object.fromEntries(Object.keys(AUTO_PLACE_DEFAULTS[section]).filter((key) => Object.hasOwn(autoPlace, key)).map((key) => [key, autoPlace[key]]));
    if (Object.keys(legacy).length === 0) continue;
    migrated[section] = { ...legacy, ...object(autoPlace[section]) };
    changed = true;
  }
  return changed ? { ...config, canvas: { ...canvas, autoPlace: migrated } } : raw;
}
function getConfig(raw = {}) {
  const migrated = migrateLegacyAutoPlace(raw);
  const normalized = migrated && typeof migrated === "object" && !Array.isArray(migrated) ? { ...migrated } : migrated;
  if (normalized && typeof normalized === "object" && !Array.isArray(normalized)) {
    const overrides = normalized;
    overrides.notebookBrowserLink = normalizeNotebookBrowserLinkOptions(overrides.notebookBrowserLink);
    overrides.notebookSidebar = normalizeNotebookSidebar(overrides.notebookSidebar);
    if (Object.hasOwn(overrides, "sidebarIgnored") && (!Array.isArray(overrides.sidebarIgnored) || overrides.sidebarIgnored.some((pattern) => typeof pattern !== "string"))) {
      overrides.sidebarIgnored = [...configDefaults.sidebarIgnored];
    }
  }
  return mergeConfig(configDefaults, normalized);
}
function getConfigDefaults() {
  return JSON.parse(JSON.stringify(configDefaults));
}
function resolveRouteTarget(routes, path, { dev } = {}) {
  const entry = routes?.[path];
  if (!entry) return null;
  if (typeof entry === "string") return entry || null;
  if (typeof entry !== "object") return null;
  return (dev ? entry.dev : entry.prod) ?? entry.default ?? entry.prod ?? entry.dev ?? null;
}
export {
  DEFAULT_MAX_FOLDER_LAYERS as D,
  getConfigDefaults as a,
  builtinPasteRules as b,
  configDefaults as c,
  getConfig as g,
  resolveRouteTarget as r,
  themeHueVariables as t
};
