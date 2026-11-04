// packages/storyboard/src/internals/notebook/vite.js
import fs13 from "node:fs";
import path14 from "node:path";
import process2 from "node:process";
import { fileURLToPath as fileURLToPath2 } from "node:url";
import statefully from "@dfosco/statefully/vite";
import reactPlugin from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

// packages/storyboard/src/core/notebook/docs/vite-plugin.ts
import { createHash as createHash3 } from "node:crypto";
import fs10 from "node:fs";
import path11 from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// packages/storyboard/src/core/notebook/docs/discovery.node.ts
import fs from "node:fs";
import path from "node:path";

// packages/storyboard/src/core/notebook/docs/metadata.ts
import { parseDocument } from "yaml";
var DOC_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
function readDocMetadata(source, sourcePath) {
  const diagnostics = [];
  const issue = (message, line = 1) => diagnostics.push({ code: "INVALID_DOCUMENT_FRONTMATTER", message, path: sourcePath, line });
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  let metadata = {};
  if (!match) issue("A Doc must begin with YAML identity frontmatter.");
  else {
    const yaml = parseDocument(match[1], { uniqueKeys: true, version: "1.2" });
    for (const error of yaml.errors) issue(error.message, (error.linePos?.[0]?.line ?? 1) + 1);
    try {
      const value = yaml.toJS({ maxAliasCount: 100 });
      if (value && typeof value === "object" && !Array.isArray(value)) metadata = value;
      else issue("Frontmatter must be a mapping.");
    } catch (error) {
      issue(String(error));
    }
    if (metadata.formatVersion !== 1) issue("formatVersion must be 1.");
    if (typeof metadata.id !== "string" || !DOC_ID.test(metadata.id)) issue("id must be a stable artifact ID.");
    if (typeof metadata.title !== "string" || !metadata.title.trim()) issue("title must be non-empty.");
    if (metadata.references !== void 0 && (!Array.isArray(metadata.references) || metadata.references.some((id) => typeof id !== "string" || !DOC_ID.test(id)))) issue("references must be stable artifact IDs.");
  }
  return { metadata, body: match ? source.slice(match[0].length) : source, lineOffset: match ? match[0].split("\n").length - 1 : 0, diagnostics };
}

// packages/storyboard/src/core/notebook/docs/discovery.node.ts
var EXCLUDED = /* @__PURE__ */ new Set([".git", ".hypercanvas", ".storyboard", ".design-notebook", ".vite", ".cache", ".next", ".turbo", "node_modules", "dist", "build", "out", "coverage", "storybook-static", "publish"]);
function resolveDocAsset(root, folder, reference) {
  if (!reference || /^(?:[a-z]+:|\/|\\)/i.test(reference) || reference.includes("\\")) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(reference.split(/[?#]/)[0]);
  } catch {
    return null;
  }
  const target = path.resolve(root, folder, decoded);
  const relative = path.relative(root, target);
  if (!relative || (relative === ".." || relative.startsWith(`..${path.sep}`)) || path.isAbsolute(relative) || relative.split(path.sep).some((segment) => EXCLUDED.has(segment))) return null;
  try {
    const realRelative = path.relative(fs.realpathSync(root), fs.realpathSync(target));
    if (realRelative === ".." || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative) || !fs.statSync(target).isFile()) return null;
    return target;
  } catch {
    return null;
  }
}

// packages/storyboard/src/core/notebook/docs/compiler.ts
var DOCS_IMPORT_PATH = "design-notebook/docs";
var BUILTINS = /* @__PURE__ */ new Set(["Prototype", "Site", "Image", "CanvasWidget"]);
async function compileDocument(source, sourcePath) {
  const parsed = readDocMetadata(source, sourcePath);
  const diagnostics = [...parsed.diagnostics];
  const assets = /* @__PURE__ */ new Set();
  const bindings = /* @__PURE__ */ new Set();
  const components = [];
  const diagnostic3 = (code, message, line) => diagnostics.push({ code, message, path: sourcePath, ...line ? { line: line + parsed.lineOffset } : {} });
  const inspect = () => (tree) => {
    function visit(node) {
      const line = node.position?.start?.line ?? 1;
      if (node.type === "mdxjsEsm") for (const statement of node.data?.estree?.body ?? []) {
        if (statement.type !== "ImportDeclaration") continue;
        if (statement.source?.value !== DOCS_IMPORT_PATH) diagnostic3("UNSUPPORTED_DOCUMENT_IMPORT", `Unsupported import: ${String(statement.source?.value)}`, line);
        for (const specifier of statement.specifiers ?? []) {
          if (specifier.type !== "ImportSpecifier" || !BUILTINS.has(specifier.imported?.name ?? "")) diagnostic3("UNSUPPORTED_DOCUMENT_IMPORT", "Only named Prototype, Site, Image and CanvasWidget imports are supported.", line);
          if (specifier.local?.name) bindings.add(specifier.local.name);
        }
      }
      if ((node.type === "image" || node.type === "definition") && node.url) assets.add(node.url);
      if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
        if (node.name && /^[A-Z]/.test(node.name)) components.push({ name: node.name.split(".")[0], line });
        for (const attribute of node.attributes ?? []) if (attribute.name === "src" && typeof attribute.value === "string") assets.add(attribute.value);
      }
      node.children?.forEach(visit);
    }
    visit(tree);
  };
  let compiledSource = null;
  try {
    const mdx = await import(
      /* @vite-ignore */
      "@mdx-js/mdx"
    ).catch(() => null);
    if (!mdx) diagnostic3("DOCUMENT_COMPILER_UNAVAILABLE", "MDX compilation is unavailable. Install @mdx-js/mdx in the host.");
    else compiledSource = String(await mdx.compile(parsed.body, { outputFormat: "program", development: false, remarkPlugins: [inspect] }));
  } catch (error) {
    const problem = error;
    diagnostic3("INVALID_DOCUMENT_MDX", problem.message || String(error), problem.line);
  }
  for (const component of components) if (!bindings.has(component.name)) diagnostic3("UNIMPORTED_DOCUMENT_COMPONENT", `Import ${component.name} explicitly from ${DOCS_IMPORT_PATH}.`, component.line);
  return { ...parsed, source, compiledSource, assets: [...assets], diagnostics, available: !diagnostics.length && compiledSource !== null };
}

// packages/storyboard/src/core/notebook/operations.node.ts
import fs9 from "node:fs";
import path10 from "node:path";

// packages/storyboard/src/core/site/catalog.node.ts
import fs2 from "node:fs";
import path2 from "node:path";

// packages/storyboard/src/core/artifact/visibility.ts
var ARTIFACT_SUFFIXES = [".prototype", ".component", ".canvas", ".site"];
function artifactFolderLogicalName(folderName) {
  const basename2 = String(folderName || "").replaceAll("\\", "/").split("/").at(-1) || "";
  const suffix = ARTIFACT_SUFFIXES.find((candidate) => basename2.endsWith(candidate));
  if (!suffix) return null;
  const logicalName = basename2.slice(0, -suffix.length).replace(/^_+/, "");
  return logicalName || null;
}

// packages/storyboard/src/core/site/contract.ts
var LOOPBACK_HOSTS = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
var SITE_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
function normalizeSiteId(value) {
  const id = String(value ?? "").trim().toLowerCase();
  if (!SITE_ID_RE.test(id)) throw new Error("Site ID must be lowercase alphanumeric with dashes");
  return id;
}
function normalizeSiteUrl(value, { loopbackOnly = false, label = "site URL" } = {}) {
  if (!value) throw new Error(`Missing required ${label}`);
  const url = new URL(String(value));
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Site URL must use HTTP or HTTPS");
  if (loopbackOnly && !LOOPBACK_HOSTS.has(url.hostname)) throw new Error("Development Site URL must use localhost, 127.0.0.1, or ::1");
  if (url.username || url.password || url.search || url.hash) throw new Error("Site URL must not contain credentials, query, or hash");
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.href;
}

// packages/storyboard/src/core/site/catalog.node.ts
var SITE_FORMAT_VERSION = 1;
var SITE_DESCRIPTOR_FILE = "site.config.json";
var SITE_ARTIFACT_MARKER_FILE = ".hypercanvas-artifact.json";
var NOTEBOOK_INFRASTRUCTURE_DIRECTORIES = /* @__PURE__ */ new Set([
  ".git",
  ".hypercanvas",
  ".storyboard",
  ".vite",
  "node_modules",
  "build",
  "coverage",
  "dist",
  "publish",
  "public",
  "storybook-static",
  ".storyboard-public"
]);
function resolveRuntimeDirSite(root) {
  const primary = path2.join(root, ".hypercanvas");
  const legacy = path2.join(root, ".storyboard");
  if (fs2.existsSync(path2.join(primary, "sites.config.json"))) return primary;
  if (fs2.existsSync(path2.join(legacy, "sites.config.json"))) return legacy;
  return primary;
}
function siteConfigRelativePath(root) {
  return `${path2.relative(root, resolveRuntimeDirSite(root)).replace(/\\/g, "/")}/sites.config.json`;
}
function siteDescriptorRelativePath(folderPath) {
  return `${folderPath.replaceAll("\\", "/").replace(/\/$/, "")}/${SITE_DESCRIPTOR_FILE}`;
}
function readSiteDescriptorFile(file, fallbackId) {
  const value = readJson(file, null);
  if (!isRecord(value)) throw new Error(`Site descriptor must contain a JSON object: ${file}`);
  return normalizeSiteDescriptor({ ...value, id: value.id ?? fallbackId ?? "" });
}
function isReservedSiteEnvironmentKey(key) {
  return /^(?:(?:HYPERCANVAS|PASEO)_|ELECTRON_RUN_AS_NODE$)/i.test(String(key || ""));
}
function safeSiteEnvironment(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key]) => !isReservedSiteEnvironmentKey(key)));
}
function normalizeSiteDescriptor(value = {}) {
  const id = normalizeSiteId(value.id);
  const deployments = {};
  for (const [name, deployment] of Object.entries(value.deployments ?? {})) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error(`Invalid Site deployment name: ${name}`);
    deployments[name] = { baseUrl: normalizeSiteUrl(deployment?.baseUrl, { label: `${name} base URL` }) };
  }
  const defaultDeployment = value.defaultDeployment ?? (deployments.production ? "production" : Object.keys(deployments)[0] ?? null);
  if (defaultDeployment && !deployments[String(defaultDeployment)]) throw new Error(`Unknown default Site deployment: ${defaultDeployment}`);
  return {
    $schema: "https://schemas.dfosco.dev/hypercanvas/site/v1.json",
    formatVersion: SITE_FORMAT_VERSION,
    id,
    title: String(value.title ?? id),
    defaultDeployment,
    deployments,
    ...value.description === void 0 ? {} : { description: String(value.description ?? "") },
    capture: { waitUntil: value.capture?.waitUntil ?? "networkidle", delayMs: bounded(value.capture?.delayMs, 0, 3e4, 250) }
  };
}
function normalizeSiteBinding(value = {}) {
  const source = value.source ?? (value.startCommand || value.root || value.workspaceId || value.scriptName ? "managed" : "url");
  if (!["url", "managed"].includes(source)) throw new Error(`Unsupported Site source: ${source}`);
  const developmentBaseUrl = value.developmentBaseUrl ? normalizeSiteUrl(value.developmentBaseUrl, { loopbackOnly: true, label: "development base URL" }) : null;
  if (!developmentBaseUrl && source !== "managed") throw new Error("Missing required development base URL");
  const developmentBaseUrlSource = value.developmentBaseUrlSource && ["manual", "discovered"].includes(value.developmentBaseUrlSource) ? value.developmentBaseUrlSource : null;
  return {
    source,
    ...value.workspaceId ? { workspaceId: String(value.workspaceId).trim() } : {},
    ...value.scriptName ? { scriptName: String(value.scriptName).trim() } : {},
    ...value.serviceName ? { serviceName: String(value.serviceName).trim() } : {},
    ...value.root ? { root: path2.resolve(value.root) } : {},
    ...value.startCommand ? { startCommand: String(value.startCommand).trim() } : {},
    ...value.env && typeof value.env === "object" ? { env: safeSiteEnvironment(value.env) } : {},
    ...value.terminalSessionId ? { terminalSessionId: String(value.terminalSessionId).trim() } : {},
    ...typeof value.legacyPid === "number" && Number.isInteger(value.legacyPid) && value.legacyPid > 0 ? { legacyPid: value.legacyPid } : {},
    ...developmentBaseUrl ? { developmentBaseUrl } : {},
    ...developmentBaseUrl && developmentBaseUrlSource ? { developmentBaseUrlSource } : {},
    status: value.status ?? "stopped",
    pid: typeof value.pid === "number" && Number.isInteger(value.pid) && value.pid > 0 ? value.pid : null,
    revision: typeof value.revision === "number" && Number.isInteger(value.revision) && value.revision >= 0 ? value.revision : 0,
    updatedAt: value.updatedAt ?? (/* @__PURE__ */ new Date()).toISOString()
  };
}
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function recordOfRecords(value) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry) => isRecord(entry[1])));
}
function runtimePathError() {
  const error = new Error("Notebook runtime path resolves outside its filesystem root.");
  error.code = "UNSAFE_NOTEBOOK_PATH";
  return error;
}
function isWithinRoot(root, target) {
  const relative = path2.relative(root, target);
  return relative === "" || !relative.startsWith("..") && !path2.isAbsolute(relative);
}
function resolveSiteRuntimePath(root, relativePath2) {
  if (typeof relativePath2 !== "string" || !relativePath2 || path2.isAbsolute(relativePath2)) throw runtimePathError();
  const resolvedRoot = path2.resolve(root);
  const runtimeRoot = resolveRuntimeDirSite(resolvedRoot);
  const destination = path2.resolve(runtimeRoot, relativePath2);
  if (!isWithinRoot(runtimeRoot, destination)) throw runtimePathError();
  try {
    const runtimeInfo = fs2.lstatSync(runtimeRoot);
    if (runtimeInfo.isSymbolicLink() || !isWithinRoot(resolvedRoot, fs2.realpathSync.native(runtimeRoot))) throw runtimePathError();
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
  }
  try {
    const destinationInfo = fs2.lstatSync(destination);
    if (destinationInfo.isSymbolicLink() || !isWithinRoot(resolvedRoot, fs2.realpathSync.native(destination))) throw runtimePathError();
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
  }
  return destination;
}
function persistableBinding(value) {
  const binding = normalizeSiteBinding(value);
  const persisted = { ...binding };
  delete persisted.status;
  delete persisted.pid;
  return persisted;
}
function mergeSiteRecords(legacyDescriptor, currentRecord, legacyBinding) {
  const descriptor = normalizeSiteDescriptor({ ...legacyDescriptor || {}, ...currentRecord || {} });
  const binding = { ...legacyBinding || {}, ...legacyDescriptor?.binding || {}, ...currentRecord?.binding || {} };
  const record3 = { ...descriptor };
  if (Object.keys(binding).length > 0) {
    try {
      record3.binding = persistableBinding(binding);
    } catch {
    }
  }
  return record3;
}
var activeSiteEntrySnapshot = null;
function withSiteCatalogSnapshot(read) {
  if (activeSiteEntrySnapshot) return read();
  activeSiteEntrySnapshot = /* @__PURE__ */ new Map();
  try {
    return read();
  } finally {
    activeSiteEntrySnapshot = null;
  }
}
var SiteCatalog = class {
  root;
  legacySiteDescriptorsRoot;
  resolveRuntimePath;
  configPath;
  legacyRuntimePath;
  legacyRuntimeStates;
  constructor(notebookRoot) {
    this.root = fs2.realpathSync.native(path2.resolve(notebookRoot));
    this.legacySiteDescriptorsRoot = path2.join(this.root, "sites");
    this.resolveRuntimePath = (relativePath2) => resolveSiteRuntimePath(this.root, relativePath2);
    this.configPath = this.resolveRuntimePath("sites.config.json");
    this.legacyRuntimePath = this.resolveRuntimePath("sites.json");
    this.legacyRuntimeStates = /* @__PURE__ */ new Map();
  }
  listEntries() {
    const snapshot = activeSiteEntrySnapshot;
    if (snapshot?.has(this.root)) return structuredClone(snapshot.get(this.root));
    const listed = this.readSiteEntries();
    snapshot?.set(this.root, listed);
    return structuredClone(listed);
  }
  readSiteEntries() {
    const entries = this.readPortableEntries();
    const byId = /* @__PURE__ */ new Map();
    const ambiguous = /* @__PURE__ */ new Set();
    for (const entry of entries) {
      if (byId.has(entry.site.id)) {
        byId.delete(entry.site.id);
        ambiguous.add(entry.site.id);
      } else if (!ambiguous.has(entry.site.id)) byId.set(entry.site.id, entry);
    }
    for (const legacy of this.readLegacyDescriptors()) {
      if (byId.has(legacy.site.id) || ambiguous.has(legacy.site.id)) continue;
      byId.set(legacy.site.id, legacy);
    }
    const legacyRuntime = this.readLegacyRuntimeBindings();
    for (const [id, binding] of Object.entries(legacyRuntime)) {
      if (byId.has(id) || ambiguous.has(id)) continue;
      try {
        byId.set(id, { site: normalizeSiteDescriptor({ id, title: binding.title || id }), folderPath: null, artifactId: null });
      } catch {
      }
    }
    return [...byId.values()].sort((a, b) => a.site.id.localeCompare(b.site.id));
  }
  list() {
    return this.listEntries().map((entry) => this.withBinding(entry.site));
  }
  get(id) {
    const entry = this.listEntries().find((candidate) => candidate.site.id === normalizeSiteId(id));
    return entry ? this.withBinding(entry.site) : null;
  }
  getBinding(id) {
    const siteId = normalizeSiteId(id);
    const runtime = readJson(this.configPath, {});
    const runtimeBinding = isRecord(runtime.bindings) && isRecord(runtime.bindings[siteId]) ? runtime.bindings[siteId] : null;
    const legacyConfig = isRecord(runtime.sites) && isRecord(runtime.sites[siteId]) && isRecord(runtime.sites[siteId].binding) ? runtime.sites[siteId].binding : null;
    const legacyBinding = this.readLegacyRuntimeBindings()[siteId];
    const binding = runtimeBinding ?? legacyConfig ?? legacyBinding;
    if (!binding) return null;
    return normalizeSiteBinding({ ...binding, ...this.legacyRuntimeStates.get(siteId) || {} });
  }
  bindings() {
    const registry = this.readRuntimeRegistry();
    const legacy = this.readLegacyRuntimeBindings();
    const ids = /* @__PURE__ */ new Set([...Object.keys(registry.bindings), ...Object.keys(legacy)]);
    return Object.fromEntries([...ids].map((id) => [id, this.getBinding(id)]));
  }
  readState(_options = {}) {
    const configPath = this.resolveRuntimePath("sites.config.json");
    const legacyRuntimePath = this.resolveRuntimePath("sites.json");
    this.configPath = configPath;
    this.legacyRuntimePath = legacyRuntimePath;
    const sites = {};
    for (const { site } of this.listEntries()) {
      sites[site.id] = { ...site, ...this.getBinding(site.id) ? { binding: this.getBinding(site.id) } : {} };
    }
    for (const [id, binding] of Object.entries(this.readLegacyRuntimeBindings())) {
      if (!sites[id]) {
        try {
          const runtimeBinding = this.getBinding(id);
          sites[id] = { ...normalizeSiteDescriptor({ id, title: binding.title || id }), ...runtimeBinding ? { binding: runtimeBinding } : {} };
        } catch {
        }
      }
    }
    return { formatVersion: SITE_FORMAT_VERSION, sites };
  }
  migrateLegacy() {
    return this.readState();
  }
  getLegacyRuntimeState(id) {
    const siteId = normalizeSiteId(id);
    return this.legacyRuntimeStates.get(siteId) ?? null;
  }
  clearLegacyRuntimeState(id) {
    this.legacyRuntimeStates.delete(normalizeSiteId(id));
  }
  withBinding(site) {
    const binding = this.getBinding(site.id);
    return { ...site, ...binding ? { binding } : {} };
  }
  readPortableEntries() {
    const found = [];
    const rootRealPath = fs2.realpathSync.native(this.root);
    const walk = (directory, relativeDirectory) => {
      let entries;
      try {
        entries = fs2.readdirSync(directory, { withFileTypes: true });
      } catch {
        return;
      }
      entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.isSymbolicLink() || NOTEBOOK_INFRASTRUCTURE_DIRECTORIES.has(entry.name)) continue;
        const child = path2.join(directory, entry.name);
        let realChild;
        try {
          realChild = fs2.realpathSync.native(child);
        } catch {
          continue;
        }
        if (!isWithinRoot(rootRealPath, realChild)) continue;
        const relative = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
        const suffix = /\.(prototype|component|canvas|site)$/.exec(entry.name)?.[1];
        if (suffix) {
          if (suffix === "site") {
            const markerPath = path2.join(child, SITE_ARTIFACT_MARKER_FILE);
            const configPath = path2.join(child, SITE_DESCRIPTOR_FILE);
            try {
              if (!fs2.lstatSync(configPath).isFile()) continue;
              let artifactId = null;
              try {
                if (!fs2.lstatSync(markerPath).isFile()) continue;
                const marker = readJson(markerPath, {});
                if (marker.formatVersion !== 1 || marker.kind !== "site" || typeof marker.id !== "string" || !marker.id.trim()) continue;
                artifactId = marker.id;
              } catch (error) {
                if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
              }
              const idFallback = artifactFolderLogicalName(entry.name)?.toLowerCase() || entry.name.slice(0, -".site".length).replace(/^_+/, "").toLowerCase();
              const site = readSiteDescriptorFile(configPath, idFallback);
              if (artifactFolderLogicalName(entry.name)?.toLowerCase() !== site.id.toLowerCase()) continue;
              found.push({ site, folderPath: relative, artifactId });
            } catch {
            }
          }
          continue;
        }
        walk(child, relative);
      }
    };
    walk(this.root, "");
    return found;
  }
  readLegacyDescriptors() {
    const found = [];
    const runtime = readJson(this.configPath, {});
    for (const [rawId, rawValue] of Object.entries(isRecord(runtime.sites) ? runtime.sites : {})) {
      if (!isRecord(rawValue)) continue;
      try {
        const descriptor = normalizeSiteDescriptor({ ...rawValue, id: rawValue.id ?? rawId });
        found.push({ site: mergeSiteRecords(descriptor, null, isRecord(rawValue.binding) ? rawValue.binding : void 0), folderPath: null, artifactId: null });
      } catch {
      }
    }
    if (isDirectory(this.legacySiteDescriptorsRoot) && isWithinRoot(this.root, fs2.realpathSync.native(this.legacySiteDescriptorsRoot))) {
      for (const name of fs2.readdirSync(this.legacySiteDescriptorsRoot).filter((value) => value.endsWith(".site.json")).sort()) {
        const file = path2.join(this.legacySiteDescriptorsRoot, name);
        try {
          if (!isWithinRoot(this.root, fs2.realpathSync.native(file))) continue;
        } catch {
          continue;
        }
        const raw = readJson(file, null);
        if (!isRecord(raw)) continue;
        try {
          found.push({ site: normalizeSiteDescriptor(raw), folderPath: null, artifactId: null });
        } catch {
        }
      }
    }
    const unique = /* @__PURE__ */ new Map();
    for (const entry of found) if (!unique.has(entry.site.id)) unique.set(entry.site.id, entry);
    return [...unique.values()];
  }
  readRuntimeRegistry() {
    const configPath = this.resolveRuntimePath("sites.config.json");
    this.configPath = configPath;
    const config = readJson(configPath, {});
    return {
      formatVersion: SITE_FORMAT_VERSION,
      sites: recordOfRecords(config.sites),
      bindings: recordOfRecords(config.bindings)
    };
  }
  readLegacyRuntimeBindings() {
    const legacyPath = this.resolveRuntimePath("sites.json");
    this.legacyRuntimePath = legacyPath;
    const legacy = readJson(legacyPath, {});
    const bindings = {};
    for (const [rawId, rawValue] of Object.entries(isRecord(legacy.sites) ? legacy.sites : {})) {
      try {
        const id = normalizeSiteId(rawId);
        const binding = isRecord(rawValue) ? { ...rawValue } : {};
        this.legacyRuntimeStates.set(id, binding);
        const active = binding.status === "running" || binding.status === "starting";
        if (active && !binding.scriptName && !binding.terminalSessionId && binding.workspaceId && binding.root) binding.terminalSessionId = `site:${id}`;
        if (active && typeof binding.pid === "number" && Number.isInteger(binding.pid) && binding.pid > 0) binding.legacyPid = binding.pid;
        bindings[id] = binding;
      } catch {
      }
    }
    return bindings;
  }
};
function bounded(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}
function isDirectory(file) {
  try {
    return fs2.statSync(file).isDirectory();
  } catch {
    return false;
  }
}
function readJson(file, fallback) {
  try {
    return JSON.parse(fs2.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

// packages/storyboard/src/core/notebook/layout.ts
import fs3 from "node:fs";
import path3 from "node:path";
var NOTEBOOK_MANIFEST_FILE = "hypercanvas.notebook.json";
var NOTEBOOK_BACKSTAGE_DIR = "backstage";
var NOTEBOOK_MANIFEST_DIR = "backstage/config";
var NOTEBOOK_CONTENT_DIRECTORY_NAMES = Object.freeze(["assets", "data"]);
function isFile(filePath) {
  try {
    return fs3.statSync(filePath).isFile();
  } catch {
    return false;
  }
}
function isDirectory2(filePath) {
  try {
    return fs3.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}
var NON_CONTENT_ENTRIES = /* @__PURE__ */ new Set([".hypercanvas-public", ".storyboard-public", ".DS_Store"]);
function holdsContent(dir) {
  try {
    return fs3.readdirSync(dir).some((entry) => !NON_CONTENT_ENTRIES.has(entry));
  } catch {
    return false;
  }
}
function notebookManifestCandidates(root) {
  return [path3.join(root, NOTEBOOK_MANIFEST_DIR, NOTEBOOK_MANIFEST_FILE), path3.join(root, NOTEBOOK_MANIFEST_FILE)];
}
function resolveNotebookManifestPath(root) {
  const candidates = notebookManifestCandidates(root);
  return candidates.find((candidate) => isFile(candidate)) ?? candidates[0];
}
function hasNotebookManifest(root) {
  return notebookManifestCandidates(root).some((candidate) => isFile(candidate));
}
function resolveNotebookContentDirectory(root, name, { notebook = hasNotebookManifest(root) } = {}) {
  const legacy = path3.join(root, name);
  if (!notebook) return legacy;
  const managed = path3.join(root, NOTEBOOK_BACKSTAGE_DIR, name);
  if (!isDirectory2(legacy)) return managed;
  if (holdsContent(legacy) || !holdsContent(managed)) return legacy;
  return managed;
}

// packages/storyboard/src/core/notebook/reader.node.ts
import fs6 from "node:fs";
import path6 from "node:path";
import { createHash, randomUUID as randomUUID2 } from "node:crypto";
import { parse as parseJsonc3 } from "jsonc-parser";

// packages/storyboard/src/core/configFile.ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { parse as parseJsonc } from "jsonc-parser";
var APP_CONFIG_PRIMARY = "hypercanvas.config.json";
var APP_CONFIG_LEGACY = "storyboard.config.json";
var CONFIG_DIRECTORY_NAME = "config";
var BACKSTAGE_CONFIG_DIRECTORY = "backstage/config";
var CANVAS_CONFIG_PRIMARY = "hypercanvas.canvas.json";
var LEGACY_CANVAS_CONFIG_FILE = "storyboard.canvas.json";
function validateConfigFilename(filename) {
  if (!filename || basename(filename) !== filename) {
    throw new Error(`Configuration filename must be a single filename: ${JSON.stringify(filename)}`);
  }
}
function isFile2(filePath) {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}
function configFileCandidates(root, filename) {
  validateConfigFilename(filename);
  return [join(root, filename), join(root, CONFIG_DIRECTORY_NAME, filename), join(root, BACKSTAGE_CONFIG_DIRECTORY, filename)];
}
function appConfigCandidates(root) {
  return [APP_CONFIG_PRIMARY, APP_CONFIG_LEGACY].flatMap((filename) => configFileCandidates(root, filename));
}
function hasConfigFile(directory) {
  try {
    return readdirSync(directory, { withFileTypes: true }).some((entry) => entry.isFile() && (entry.name.endsWith(".config.json") || [CANVAS_CONFIG_PRIMARY, LEGACY_CANVAS_CONFIG_FILE].includes(entry.name)));
  } catch {
    return false;
  }
}
function resolveConfigDirectory(root) {
  const appConfig = appConfigCandidates(root).find(isFile2);
  if (appConfig) return dirname(appConfig);
  const grouped = join(root, CONFIG_DIRECTORY_NAME);
  const backstage = join(root, BACKSTAGE_CONFIG_DIRECTORY);
  if (hasConfigFile(root)) return root;
  if (hasConfigFile(grouped)) return grouped;
  if (hasConfigFile(backstage)) return backstage;
  return root;
}
function resolveNotebookConfigDirectory(root) {
  const existing = resolveConfigDirectory(root);
  if (existing !== root || hasConfigFile(root) || appConfigCandidates(root).some(isFile2)) return existing;
  return join(root, BACKSTAGE_CONFIG_DIRECTORY);
}
function resolveNotebookConfigWritePath(root, filename) {
  return resolveConfigFileCandidates(root, filename).find(isFile2) || join(resolveNotebookConfigDirectory(root), filename);
}
function resolveConfigFilePath(root, filename) {
  return resolveConfigFileCandidates(root, filename).find(isFile2) || join(resolveConfigDirectory(root), filename);
}
function resolveConfigFileCandidates(root, filename) {
  return (filename === CANVAS_CONFIG_PRIMARY ? [CANVAS_CONFIG_PRIMARY, LEGACY_CANVAS_CONFIG_FILE] : [filename]).flatMap((name) => configFileCandidates(root, name));
}
function resolveAppConfigPath(root) {
  return appConfigCandidates(root).find(isFile2) || join(resolveConfigDirectory(root), APP_CONFIG_PRIMARY);
}
function readAppConfig(root) {
  for (const filePath of appConfigCandidates(root)) {
    try {
      const parsed = parseJsonc(readFileSync(filePath, "utf8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
    }
  }
  return null;
}

// packages/storyboard/src/core/notebook/first-look/catalog.node.ts
import fs5 from "node:fs";
import path5 from "node:path";

// packages/storyboard/src/core/notebook/artifact-migration-aliases.ts
function normalizeNotebookArtifactMigrationAliases(value) {
  if (value === void 0) return {};
  if (!isRecord2(value)) return null;
  const aliases = {};
  if (value.legacyRoutes !== void 0) {
    if (!Array.isArray(value.legacyRoutes)) return null;
    const seen = /* @__PURE__ */ new Set();
    const routes = [];
    for (const entry of value.legacyRoutes) {
      if (!isRecord2(entry) || typeof entry.from !== "string" || typeof entry.targetPath !== "string" || !isNotebookPathname(entry.from) || !isRelativeTargetPath(entry.targetPath) || seen.has(entry.from)) return null;
      seen.add(entry.from);
      routes.push({ from: entry.from, targetPath: entry.targetPath });
    }
    aliases.legacyRoutes = routes;
  }
  if (value.legacyCanvasIds !== void 0) {
    if (!Array.isArray(value.legacyCanvasIds) || !value.legacyCanvasIds.every((item) => typeof item === "string" && item.trim()) || new Set(value.legacyCanvasIds).size !== value.legacyCanvasIds.length) return null;
    aliases.legacyCanvasIds = [...value.legacyCanvasIds];
  }
  if (value.legacyScopes !== void 0) {
    if (!isRecord2(value.legacyScopes) || typeof value.legacyScopes.prototype !== "string" || !value.legacyScopes.prototype.trim() || value.legacyScopes.folder !== void 0 && (typeof value.legacyScopes.folder !== "string" || !value.legacyScopes.folder.trim())) return null;
    aliases.legacyScopes = {
      prototype: value.legacyScopes.prototype,
      ...typeof value.legacyScopes.folder === "string" ? { folder: value.legacyScopes.folder } : {}
    };
  }
  return aliases;
}
function isNotebookPathname(value) {
  return value.startsWith("/") && value.length > 1 && !value.includes("?") && !value.includes("#") && !value.includes("\\") && !value.startsWith("//") && value.split("/").slice(1).every((segment) => {
    if (!segment || segment === "." || segment === "..") return false;
    let decoded = segment;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
    }
    return !decoded.includes("?") && !decoded.includes("/") && !decoded.includes("\\") && !/^:[A-Za-z_$][A-Za-z0-9_$]*/.test(decoded);
  });
}
function isRelativeTargetPath(value) {
  return value === "" || !value.startsWith("/") && !value.includes("\\") && !value.includes("?") && !value.includes("#") && value.split("/").every((segment) => segment && segment !== "." && segment !== "..");
}
function decodePathSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
function pathSegments(value) {
  return value.split("/").filter(Boolean);
}
function routeSegmentKey(segment) {
  return decodePathSegment(segment).toLocaleLowerCase("en-US");
}
function notebookRouteCollisionKey(value) {
  return `/${pathSegments(value).map(routeSegmentKey).join("/")}`;
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// packages/storyboard/src/core/notebook/first-look/contract.ts
var FIRST_LOOK_FORMAT_VERSION = 1;
var FIRST_LOOK_PROTOTYPE_RUNTIME = Object.freeze({
  id: "@dfosco/statefully",
  version: "0.2.1"
});
var FIRST_LOOK_DIRECTORY_SUFFIXES = Object.freeze({
  prototype: ".prototype",
  canvas: ".canvas",
  site: ".site"
});
var FIRST_LOOK_EXCLUDED_DIRECTORIES = /* @__PURE__ */ new Set([
  ".git",
  ".design-notebook",
  ".vite",
  ".cache",
  ".next",
  ".turbo",
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  "storybook-static",
  ".hypercanvas",
  ".storyboard"
]);
var RESERVED_PUBLIC_ROUTE_ROOTS = /* @__PURE__ */ new Set([
  "canvas",
  "docs",
  "sites",
  "__notebook",
  "prototypes",
  "assets",
  "node_modules",
  "@fs"
]);
var ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
function isFirstLookId(value) {
  return typeof value === "string" && ID_PATTERN.test(value);
}

// packages/storyboard/src/core/notebook/first-look/discovery.node.ts
import fs4 from "node:fs";
import path4 from "node:path";
import { parse as parseJsonc2 } from "jsonc-parser";
import { parseDocument as parseDocument2 } from "yaml";

// packages/storyboard/src/core/notebook/first-look/descriptors.ts
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function isHttpUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.length > 0;
  } catch {
    return false;
  }
}
function isPortableRelativePath(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  if (value.includes("\\") || value.startsWith("/") || /^[A-Za-z]:/.test(value)) return false;
  return value.split("/").every((segment) => segment !== "" && segment !== ".");
}
function identityIssues(descriptor, issues) {
  if (descriptor.formatVersion !== FIRST_LOOK_FORMAT_VERSION) {
    issues.push({ code: "UNSUPPORTED_FORMAT_VERSION", message: "formatVersion must be 1.", field: "formatVersion" });
  }
  if (!isFirstLookId(descriptor.id)) {
    issues.push({ code: "MISSING_OR_INVALID_ID", message: "id must be a stable artifact ID.", field: "id" });
  }
  if (!nonEmptyString(descriptor.title)) {
    issues.push({ code: "MISSING_OR_INVALID_TITLE", message: "title must be a non-empty string.", field: "title" });
  }
}
function referenceIssues(descriptor, issues) {
  if (descriptor.references === void 0) return;
  if (!Array.isArray(descriptor.references)) {
    issues.push({ code: "INVALID_REFERENCES", message: "references must be an array of stable artifact IDs.", field: "references" });
    return;
  }
  const invalid = descriptor.references.some((value) => !isFirstLookId(value));
  const unique = new Set(descriptor.references).size === descriptor.references.length;
  if (invalid || !unique) {
    issues.push({ code: "INVALID_REFERENCES", message: "references must contain unique stable artifact IDs.", field: "references" });
  }
}
function viewIssues(descriptor, issues, kind) {
  if (descriptor.views === void 0) return;
  if (!Array.isArray(descriptor.views)) {
    issues.push({ code: "INVALID_DESCRIPTOR", message: "views must be an array.", field: "views" });
    return;
  }
  descriptor.views.forEach((view, index) => {
    const field = `views.${index}`;
    if (!isRecord3(view)) {
      issues.push({ code: "INVALID_DESCRIPTOR", message: `${field} must be an object.`, field });
      return;
    }
    if (!isFirstLookId(view.id)) {
      issues.push({ code: "INVALID_DESCRIPTOR", message: `${field}.id must be a stable view ID.`, field: `${field}.id` });
    }
    if (!nonEmptyString(view.title)) {
      issues.push({ code: "INVALID_DESCRIPTOR", message: `${field}.title must be a non-empty string.`, field: `${field}.title` });
    }
    if (kind === "prototype") {
      if (typeof view.path !== "string" || !view.path.startsWith("/")) {
        issues.push({ code: "INVALID_DESCRIPTOR", message: `${field}.path must start with "/".`, field: `${field}.path` });
      }
    } else if (view.path !== void 0 && typeof view.path !== "string") {
      issues.push({ code: "INVALID_DESCRIPTOR", message: `${field}.path must be a string.`, field: `${field}.path` });
    }
  });
}
function duplicateViewIssues(descriptor, issues) {
  if (!Array.isArray(descriptor.views)) return;
  const seen = /* @__PURE__ */ new Set();
  descriptor.views.forEach((view, index) => {
    if (!isRecord3(view) || typeof view.id !== "string") return;
    if (seen.has(view.id)) {
      issues.push({ code: "DUPLICATE_VIEW_ID", message: `View id "${view.id}" is used more than once.`, field: `views.${index}.id` });
    }
    seen.add(view.id);
  });
}
function validatePrototypeDescriptor(descriptor) {
  const issues = [];
  identityIssues(descriptor, issues);
  const runtime = descriptor.runtime;
  if (!isRecord3(runtime) || runtime.id !== FIRST_LOOK_PROTOTYPE_RUNTIME.id || runtime.version !== FIRST_LOOK_PROTOTYPE_RUNTIME.version) {
    issues.push({
      code: "UNSUPPORTED_PROTOTYPE_RUNTIME",
      message: `Prototype runtime must use ${FIRST_LOOK_PROTOTYPE_RUNTIME.id}@${FIRST_LOOK_PROTOTYPE_RUNTIME.version}.`,
      field: "runtime"
    });
  }
  if (!nonEmptyString(descriptor.entry)) {
    issues.push({ code: "INVALID_DESCRIPTOR", message: "entry must be a non-empty string.", field: "entry" });
  }
  referenceIssues(descriptor, issues);
  viewIssues(descriptor, issues, "prototype");
  duplicateViewIssues(descriptor, issues);
  return issues;
}
function validateSiteDescriptor(descriptor) {
  const issues = [];
  identityIssues(descriptor, issues);
  if (descriptor.description !== void 0 && typeof descriptor.description !== "string") {
    issues.push({ code: "INVALID_DESCRIPTOR", message: "description must be a string.", field: "description" });
  }
  referenceIssues(descriptor, issues);
  if (descriptor.local !== void 0) {
    if (!isRecord3(descriptor.local)) {
      issues.push({ code: "INVALID_SITE_LOCAL_REFERENCE", message: "local must be an object.", field: "local" });
    } else {
      if (descriptor.local.sourcePath !== void 0 && !nonEmptyString(descriptor.local.sourcePath)) {
        issues.push({ code: "INVALID_LOCAL_SOURCE_PATH", message: "local.sourcePath must be a non-empty local filesystem path.", field: "local.sourcePath" });
      }
      if (descriptor.local.developmentUrl !== void 0 && !isHttpUrl(descriptor.local.developmentUrl)) {
        issues.push({ code: "INVALID_LOCAL_DEVELOPMENT_URL", message: "local.developmentUrl must be an absolute HTTP(S) URL.", field: "local.developmentUrl" });
      }
    }
  }
  if (descriptor.published !== void 0) {
    if (!isRecord3(descriptor.published)) {
      issues.push({ code: "INVALID_SITE_PUBLISHED_REFERENCE", message: "published must be an object.", field: "published" });
    } else if (!isHttpUrl(descriptor.published.url)) {
      issues.push({ code: "INVALID_PUBLISHED_URL", message: "published.url must be an absolute HTTP(S) URL.", field: "published.url" });
    }
  }
  viewIssues(descriptor, issues, "site");
  duplicateViewIssues(descriptor, issues);
  if (Array.isArray(descriptor.views)) {
    descriptor.views.forEach((view, index) => {
      if (!isRecord3(view)) return;
      if (view.localUrl !== void 0 && !isHttpUrl(view.localUrl)) {
        issues.push({ code: "INVALID_VIEW_LOCAL_URL", message: `views[${index}].localUrl must be an absolute HTTP(S) URL.`, field: `views.${index}.localUrl` });
      }
      if (view.publishedUrl !== void 0 && !isHttpUrl(view.publishedUrl)) {
        issues.push({ code: "INVALID_VIEW_PUBLISHED_URL", message: `views[${index}].publishedUrl must be an absolute HTTP(S) URL.`, field: `views.${index}.publishedUrl` });
      }
      if (view.screenshot !== void 0 && !isPortableRelativePath(view.screenshot)) {
        issues.push({ code: "INVALID_RELATIVE_PATH", message: `views[${index}].screenshot must be a portable relative path.`, field: `views.${index}.screenshot` });
      }
    });
  }
  return issues;
}
function validateDocFrontmatter(frontmatter) {
  const issues = [];
  identityIssues(frontmatter, issues);
  referenceIssues(frontmatter, issues);
  return issues;
}
function validateFirstLookDescriptor(kind, descriptor) {
  if (kind === "prototype") return validatePrototypeDescriptor(descriptor);
  if (kind === "site") return validateSiteDescriptor(descriptor);
  if (kind === "doc") return validateDocFrontmatter(descriptor);
  return [];
}

// packages/storyboard/src/core/notebook/first-look/discovery.node.ts
function inside(root, candidate) {
  const relative = path4.relative(root, candidate);
  return relative === "" || !relative.startsWith(`..${path4.sep}`) && relative !== ".." && !path4.isAbsolute(relative);
}
function diagnostic(code, message, pathName, extra = {}) {
  return { code, message, path: pathName, severity: "error", ...extra };
}
function issueDiagnostic(issue, pathName) {
  return diagnostic(issue.code, issue.message, pathName, issue.field ? { field: issue.field } : {});
}
function isRecord4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function resolveNotebookPath(root, basePath, relativePath2) {
  const rootReal = fs4.realpathSync.native(path4.resolve(root));
  for (const [value, label] of [[basePath, "basePath"], [relativePath2, "relativePath"]]) {
    if (value !== null && (typeof value !== "string" || value.includes("\\") || value.startsWith("/") || /^[A-Za-z]:/.test(value))) {
      throw new Error(`${label} must be a forward-slash relative path`);
    }
  }
  const base = basePath ? path4.resolve(rootReal, ...basePath.split("/")) : rootReal;
  if (!inside(rootReal, base)) throw new Error(`Path base escapes the notebook: ${basePath}`);
  const target = path4.resolve(base, ...relativePath2.split("/"));
  if (!inside(rootReal, target)) throw new Error(`Relative path escapes the notebook: ${relativePath2}`);
  let existing = target;
  while (!fs4.existsSync(existing) && existing !== rootReal) existing = path4.dirname(existing);
  if (!inside(rootReal, fs4.realpathSync.native(existing))) throw new Error(`Resolved path escapes the notebook: ${relativePath2}`);
  return target;
}
function directoryKind(name) {
  for (const [kind, suffix] of Object.entries(FIRST_LOOK_DIRECTORY_SUFFIXES)) {
    if (name.endsWith(suffix) && name.length > suffix.length) return kind;
  }
  return null;
}
function documentWrapperName(directoryName) {
  return directoryName.endsWith(".doc") && directoryName.length > ".doc".length ? directoryName.slice(0, -".doc".length) : null;
}
function listEntries(directory, relativePath2, diagnostics) {
  try {
    return fs4.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en"));
  } catch (error) {
    diagnostics.push(diagnostic("UNREADABLE_DIRECTORY", `Cannot read directory: ${errorMessage(error)}`, relativePath2 || "."));
    return [];
  }
}
function readText(absolutePath) {
  try {
    return fs4.readFileSync(absolutePath, "utf8");
  } catch {
    return null;
  }
}
function parseJsonObject(text) {
  const errors = [];
  const value = parseJsonc2(text, errors);
  if (errors.length) return { value: null, error: `offset ${errors[0]?.offset ?? 0}` };
  return isRecord4(value) ? { value, error: null } : { value: null, error: "expected a JSON object" };
}
function isFirstLookPrototypeDescriptor(value) {
  return value.formatVersion !== void 0 || value.runtime !== void 0 || value.id !== void 0;
}
function artifactShell(kind, name, relativePath2, wrapped = false) {
  const documentPath = wrapped ? `${relativePath2}/${name}.doc.mdx` : relativePath2;
  let descriptorPath;
  if (kind === "doc") descriptorPath = documentPath;
  else if (kind === "canvas") descriptorPath = `${relativePath2}/${name}${FIRST_LOOK_DIRECTORY_SUFFIXES.canvas}.jsonl`;
  else descriptorPath = `${relativePath2}/${name}${FIRST_LOOK_DIRECTORY_SUFFIXES[kind]}.json`;
  let folderPath;
  if (kind === "doc") {
    folderPath = wrapped ? relativePath2 : path4.posix.dirname(relativePath2) === "." ? "" : path4.posix.dirname(relativePath2);
  } else {
    folderPath = relativePath2;
  }
  return {
    id: null,
    kind,
    title: name,
    folderPath,
    path: documentPath,
    descriptorPath,
    // A Canvas payload is its JSONL file; other kinds keep the artifact folder or Doc path.
    payloadPath: kind === "canvas" ? descriptorPath : documentPath,
    descriptor: null,
    references: [],
    views: [],
    diagnostics: [],
    available: false
  };
}
function finish(artifact) {
  artifact.available = !artifact.diagnostics.some((item) => item.severity === "error") && artifact.id !== null;
  return artifact;
}
function applyIdentityFields(artifact, descriptor) {
  if (Array.isArray(descriptor.references)) {
    artifact.references = descriptor.references.filter((value) => typeof value === "string");
  }
  if (typeof descriptor.id === "string") artifact.id = descriptor.id;
  if (typeof descriptor.title === "string" && descriptor.title.trim()) artifact.title = descriptor.title;
}
function validatePrototypeEntry(root, artifact, entry) {
  if (!isPortableRelativePath(entry)) {
    artifact.diagnostics.push(diagnostic("INVALID_RELATIVE_PATH", "entry must be a non-empty, forward-slash relative path.", artifact.descriptorPath, { field: "entry" }));
    return;
  }
  const normalized = path4.posix.normalize(entry);
  if (normalized === ".." || normalized.startsWith("../")) {
    artifact.diagnostics.push(diagnostic("INVALID_RELATIVE_PATH", "Prototype entry must remain inside its artifact directory.", artifact.descriptorPath, { field: "entry" }));
    return;
  }
  const artifactDirectory = path4.resolve(root, ...artifact.folderPath.split("/").filter(Boolean));
  const absoluteEntry = path4.resolve(artifactDirectory, ...entry.split("/"));
  try {
    const realEntry = fs4.realpathSync.native(absoluteEntry);
    const realArtifact = fs4.realpathSync.native(artifactDirectory);
    if (!inside(realArtifact, realEntry) || !fs4.statSync(realEntry).isFile()) {
      artifact.diagnostics.push(diagnostic("INVALID_PROTOTYPE_ENTRY", "Prototype entry must be an existing file inside its artifact directory.", artifact.descriptorPath, { field: "entry" }));
    }
  } catch {
    artifact.diagnostics.push(diagnostic("MISSING_PROTOTYPE_ENTRY", `Prototype entry does not exist: ${entry}`, artifact.descriptorPath, { field: "entry" }));
  }
}
function validateSiteScreenshots(root, artifact, views) {
  views.forEach((view, index) => {
    if (!isRecord4(view) || typeof view.screenshot !== "string" || !isPortableRelativePath(view.screenshot)) return;
    try {
      resolveNotebookPath(root, artifact.folderPath, view.screenshot);
    } catch {
      artifact.diagnostics.push(diagnostic("INVALID_RELATIVE_PATH", `views[${index}].screenshot must resolve inside the notebook root.`, artifact.descriptorPath, { field: `views.${index}.screenshot` }));
    }
  });
}
function discoverJsonArtifact(root, kind, absoluteDirectory, relativePath2, name) {
  const absoluteDescriptor = path4.join(absoluteDirectory, `${name}${FIRST_LOOK_DIRECTORY_SUFFIXES[kind]}.json`);
  const text = readText(absoluteDescriptor);
  if (text === null) return { legacy: { kind, name, path: relativePath2, reason: "missing-first-look-payload" } };
  const artifact = artifactShell(kind, name, relativePath2);
  const parsed = parseJsonObject(text);
  if (parsed.value === null) {
    artifact.diagnostics.push(diagnostic("INVALID_DESCRIPTOR_JSON", `Descriptor is not valid JSON: ${parsed.error}`, artifact.descriptorPath));
    return { artifact: finish(artifact) };
  }
  const descriptor = parsed.value;
  if (kind === "prototype" && !isFirstLookPrototypeDescriptor(descriptor)) {
    return { legacy: { kind, name, path: relativePath2, reason: "no-first-look-identity" } };
  }
  artifact.descriptor = structuredClone(descriptor);
  for (const issue of validateFirstLookDescriptor(kind, descriptor)) artifact.diagnostics.push(issueDiagnostic(issue, artifact.descriptorPath));
  applyIdentityFields(artifact, descriptor);
  artifact.views = Array.isArray(descriptor.views) ? structuredClone(descriptor.views).filter(isRecord4) : [];
  if (kind === "prototype") {
    const runtime = isRecord4(descriptor.runtime) ? descriptor.runtime : null;
    if (runtime && runtime.id === FIRST_LOOK_PROTOTYPE_RUNTIME.id && runtime.version === FIRST_LOOK_PROTOTYPE_RUNTIME.version) {
      artifact.runtime = { ...FIRST_LOOK_PROTOTYPE_RUNTIME };
    }
    artifact.entry = typeof descriptor.entry === "string" ? descriptor.entry : null;
    if (typeof descriptor.entry === "string") validatePrototypeEntry(root, artifact, descriptor.entry);
  } else {
    artifact.local = isRecord4(descriptor.local) ? { ...descriptor.local } : null;
    artifact.published = isRecord4(descriptor.published) ? { ...descriptor.published } : null;
    if (Array.isArray(descriptor.views)) validateSiteScreenshots(root, artifact, descriptor.views);
  }
  return { artifact: finish(artifact) };
}
function discoverCanvas(absoluteDirectory, relativePath2, name) {
  const artifact = artifactShell("canvas", name, relativePath2);
  const source = readText(path4.join(absoluteDirectory, path4.posix.basename(artifact.descriptorPath)));
  if (source === null) return { legacy: { kind: "canvas", name, path: relativePath2, reason: "missing-first-look-payload" } };
  const firstLine = source.split(/\r?\n/).find((line) => line.trim().length > 0);
  let header = null;
  if (firstLine !== void 0) {
    try {
      header = JSON.parse(firstLine);
    } catch {
      artifact.diagnostics.push(diagnostic("CANVAS_MALFORMED_JSON", "The first canvas record is not valid JSON.", artifact.descriptorPath, { line: 1 }));
      return { artifact: finish(artifact) };
    }
  }
  if (!isRecord4(header) || header.event !== "canvas_created" || header.canvasId === void 0) {
    return { legacy: { kind: "canvas", name, path: relativePath2, reason: "no-first-look-identity" } };
  }
  artifact.descriptor = structuredClone(header);
  if (header.formatVersion !== 1) {
    artifact.diagnostics.push(diagnostic("UNSUPPORTED_FORMAT_VERSION", "Canvas formatVersion must be 1.", artifact.descriptorPath, { field: "formatVersion" }));
  }
  if (isFirstLookId(header.canvasId)) artifact.id = header.canvasId;
  else artifact.diagnostics.push(diagnostic("MISSING_OR_INVALID_ID", "Canvas header must contain a stable canvasId.", artifact.descriptorPath, { field: "canvasId" }));
  return { artifact: finish(artifact) };
}
function discoverDocument(absolutePath, relativePath2, name, wrapped) {
  const artifact = { ...artifactShell("doc", name, relativePath2, wrapped), wrapped };
  const source = readText(absolutePath);
  if (source === null) {
    artifact.diagnostics.push(diagnostic("MISSING_DOCUMENT", "Cannot read document.", artifact.payloadPath));
    return finish(artifact);
  }
  const frontmatter = readFrontmatter(source, artifact);
  if (frontmatter) {
    artifact.descriptor = structuredClone(frontmatter);
    for (const issue of validateFirstLookDescriptor("doc", frontmatter)) artifact.diagnostics.push(issueDiagnostic(issue, artifact.payloadPath));
    applyIdentityFields(artifact, frontmatter);
  }
  return finish(artifact);
}
function readFrontmatter(source, artifact) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    artifact.diagnostics.push(diagnostic("MISSING_DOCUMENT_FRONTMATTER", "A .doc.mdx file must begin with YAML frontmatter.", artifact.payloadPath));
    return null;
  }
  const document2 = parseDocument2(match[1] ?? "", { uniqueKeys: true, version: "1.2" });
  for (const issue of [...document2.errors, ...document2.warnings]) {
    const line = issue.linePos?.[0]?.line;
    artifact.diagnostics.push(diagnostic("INVALID_DOCUMENT_FRONTMATTER", issue.message, artifact.payloadPath, {
      ...line ? { line: line + 1 } : {},
      severity: document2.errors.includes(issue) ? "error" : "warning"
    }));
  }
  if (document2.errors.length) return null;
  const value = document2.toJS({ mapAsMap: false });
  if (!isRecord4(value)) {
    artifact.diagnostics.push(diagnostic("INVALID_DOCUMENT_FRONTMATTER", "YAML frontmatter must be a mapping.", artifact.payloadPath));
    return null;
  }
  return value;
}
function nestedDiagnostic(kind, relativePath2, containing) {
  return diagnostic(
    "NESTED_ARTIFACT",
    `${kind} artifact ${relativePath2} is inside ${containing.kind} artifact ${containing.path}; artifact folders cannot contain other artifacts.`,
    relativePath2,
    { nestedArtifact: { kind, path: relativePath2 }, containingArtifact: containing }
  );
}
function scanNestedArtifacts(rootReal, absoluteDirectory, relativeDirectory, containing, diagnostics, allowedDocumentPath = null) {
  for (const entry of listEntries(absoluteDirectory, relativeDirectory, diagnostics)) {
    if (entry.isSymbolicLink() || FIRST_LOOK_EXCLUDED_DIRECTORIES.has(entry.name)) continue;
    let realPath;
    try {
      realPath = fs4.realpathSync.native(path4.join(absoluteDirectory, entry.name));
    } catch {
      continue;
    }
    if (!inside(rootReal, realPath)) continue;
    const relativePath2 = path4.posix.join(relativeDirectory, entry.name);
    if (entry.isFile() && entry.name.endsWith(".doc.mdx")) {
      if (relativePath2 === allowedDocumentPath) continue;
      diagnostics.push(nestedDiagnostic("doc", relativePath2, containing));
      continue;
    }
    if (!entry.isDirectory()) continue;
    const kind = directoryKind(entry.name);
    const absolutePath = path4.join(absoluteDirectory, entry.name);
    if (kind) {
      diagnostics.push(nestedDiagnostic(kind, relativePath2, containing));
      scanNestedArtifacts(rootReal, absolutePath, relativePath2, { kind, path: relativePath2 }, diagnostics);
    } else {
      scanNestedArtifacts(rootReal, absolutePath, relativePath2, containing, diagnostics, allowedDocumentPath);
    }
  }
}
function wrapperPayload(absoluteDirectory, wrapperName) {
  const payloadName = `${wrapperName}.doc.mdx`;
  try {
    const stat = fs4.lstatSync(path4.join(absoluteDirectory, payloadName));
    if (stat.isFile() && !stat.isSymbolicLink()) return { status: "matched", payloadName, documentFiles: [] };
  } catch {
  }
  let documentFiles = [];
  try {
    documentFiles = fs4.readdirSync(absoluteDirectory, { withFileTypes: true }).filter((child) => child.isFile() && child.name.endsWith(".doc.mdx")).map((child) => child.name).sort((a, b) => a.localeCompare(b, "en"));
  } catch {
  }
  return { status: documentFiles.length ? "mismatched" : "missing", payloadName, documentFiles };
}
function discoverFirstLookNotebook(notebookRoot) {
  const root = fs4.realpathSync.native(path4.resolve(notebookRoot));
  const artifacts = [];
  const legacy = [];
  const diagnostics = [];
  function addArtifact(artifact, target) {
    artifacts.push(artifact);
    target.push({ type: "artifact", artifact });
  }
  function walk(directory, relativeDirectory, targetEntries) {
    for (const entry of listEntries(directory, relativeDirectory, diagnostics)) {
      if (entry.isSymbolicLink() || FIRST_LOOK_EXCLUDED_DIRECTORIES.has(entry.name)) continue;
      const absolutePath = path4.join(directory, entry.name);
      const relativePath2 = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      if (entry.isDirectory() && (relativePath2 === "backstage/publish" || relativePath2 === "publish")) continue;
      let realPath;
      try {
        realPath = fs4.realpathSync.native(absolutePath);
      } catch {
        continue;
      }
      if (!inside(root, realPath)) continue;
      if (entry.isDirectory()) {
        const kind = directoryKind(entry.name);
        if (kind) {
          const name = entry.name.slice(0, -FIRST_LOOK_DIRECTORY_SUFFIXES[kind].length);
          const result = kind === "canvas" ? discoverCanvas(absolutePath, relativePath2, name) : discoverJsonArtifact(root, kind, absolutePath, relativePath2, name);
          if (result.artifact) addArtifact(result.artifact, targetEntries);
          if (result.legacy) {
            legacy.push(result.legacy);
            targetEntries.push({ type: "legacy", kind, name, path: relativePath2 });
          }
          scanNestedArtifacts(root, absolutePath, relativePath2, { kind, path: relativePath2 }, diagnostics);
          continue;
        }
        const wrapperName = documentWrapperName(entry.name);
        if (wrapperName) {
          const payload = wrapperPayload(absolutePath, wrapperName);
          if (payload.status === "matched") {
            const artifact = discoverDocument(path4.join(absolutePath, payload.payloadName), relativePath2, wrapperName, true);
            addArtifact(artifact, targetEntries);
            scanNestedArtifacts(root, absolutePath, relativePath2, { kind: "doc", path: artifact.path }, diagnostics, artifact.payloadPath);
            continue;
          }
          diagnostics.push(diagnostic(
            payload.status === "mismatched" ? "MISMATCHED_DOCUMENT_WRAPPER" : "MISSING_DOCUMENT_WRAPPER_PAYLOAD",
            payload.status === "mismatched" ? `Document wrapper ${relativePath2} must contain ${payload.payloadName}; found ${payload.documentFiles.join(", ")}.` : `Document wrapper ${relativePath2} remains an ordinary folder until it contains ${payload.payloadName}.`,
            relativePath2,
            { expectedPath: path4.posix.join(relativePath2, payload.payloadName), ...payload.documentFiles.length ? { found: payload.documentFiles } : {} }
          ));
        }
        const children = [];
        walk(absolutePath, relativePath2, children);
        targetEntries.push({ type: "group", name: entry.name, path: relativePath2, children });
      } else if (entry.isFile() && entry.name.endsWith(".doc.mdx")) {
        addArtifact(discoverDocument(absolutePath, relativePath2, entry.name.slice(0, -".doc.mdx".length), false), targetEntries);
      }
    }
  }
  const entries = [];
  walk(root, "", entries);
  resolveIdentity(artifacts);
  for (const artifact of artifacts) diagnostics.push(...artifact.diagnostics);
  return { root, entries, artifacts, legacy, diagnostics };
}
function resolveIdentity(artifacts) {
  const ids = /* @__PURE__ */ new Map();
  for (const artifact of artifacts) {
    if (artifact.id === null) continue;
    ids.set(artifact.id, [...ids.get(artifact.id) ?? [], artifact]);
  }
  for (const [id, matches] of ids) {
    if (matches.length < 2) continue;
    const paths = matches.map((artifact) => artifact.path);
    for (const artifact of matches) {
      artifact.diagnostics.push(diagnostic("DUPLICATE_ARTIFACT_ID", `Artifact id "${id}" is used by ${paths.join(" and ")}.`, artifact.path, { id, paths }));
      artifact.available = false;
    }
  }
  for (const artifact of artifacts) {
    artifact.resolvedReferences = [];
    for (const id of artifact.references) {
      const matches = ids.get(id) ?? [];
      const [target] = matches;
      if (matches.length === 1 && target) {
        artifact.resolvedReferences.push({ id, kind: target.kind, path: target.path });
        continue;
      }
      artifact.diagnostics.push(diagnostic(
        matches.length ? "AMBIGUOUS_REFERENCE" : "UNRESOLVED_REFERENCE",
        matches.length ? `Reference "${id}" is ambiguous because multiple artifacts use that ID.` : `Reference "${id}" does not match a discovered artifact ID.`,
        artifact.path,
        { id, matches: matches.map((target2) => target2.path), severity: "warning" }
      ));
    }
  }
}

// packages/storyboard/src/core/notebook/first-look/routes.ts
function normalizeRouteBase(base = "/") {
  if (typeof base !== "string" || !base.startsWith("/") || base.startsWith("//") || /[?#\\]/.test(base)) {
    throw new TypeError("base must be an absolute same-origin path prefix.");
  }
  const canonicalSegments = [];
  for (const segment of base.split("/").filter(Boolean)) {
    let decoded;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      throw new TypeError("base contains an invalid encoded path segment.");
    }
    if (decoded === "." || decoded === ".." || decoded.includes("/") || decoded.includes("\\")) {
      throw new TypeError("base cannot contain traversal or encoded separators.");
    }
    canonicalSegments.push(encodeSegment(decoded));
  }
  return canonicalSegments.length ? `/${canonicalSegments.join("/")}/` : "/";
}
function encodeSegment(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}
function idSegment(id) {
  if (typeof id !== "string" || !id.trim() || id.includes("/") || id.includes("\\") || id === "." || id === "..") {
    throw new TypeError("Artifact id must be a non-empty safe path segment.");
  }
  return encodeSegment(id);
}
function prefixFor(base) {
  const normalized = normalizeRouteBase(base);
  return normalized === "/" ? "" : normalized.slice(0, -1);
}
function exactView(artifact, viewId) {
  if (!viewId.trim()) return null;
  const matches = Array.isArray(artifact.views) ? artifact.views.filter((view) => view?.id === viewId) : [];
  if (matches.length > 1) throw new TypeError(`View ID "${viewId}" is duplicated on artifact "${artifact.id}".`);
  return matches[0] ?? null;
}
function withBase(routePath, base) {
  return `${prefixFor(base)}${routePath}` || "/";
}
function prototypeRouteParts(view) {
  const value = view?.path ?? "/";
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    throw new TypeError(`Invalid prototype view path: ${String(value)}`);
  }
  const url = new URL(value, "https://notebook.invalid");
  if (url.origin !== "https://notebook.invalid") throw new TypeError(`Invalid prototype view path: ${value}`);
  const rawPath = value.split(/[?#]/, 1)[0] ?? "";
  const segments = rawPath.split("/").filter(Boolean).map((segment) => {
    let decoded;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      throw new TypeError(`Invalid prototype view path: ${value}`);
    }
    if (decoded === "." || decoded === ".." || decoded.includes("/") || decoded.includes("\\")) {
      throw new TypeError(`Invalid prototype view path: ${value}`);
    }
    return encodeURIComponent(decoded);
  });
  return { segments, suffix: `${url.search}${url.hash}` };
}
function prototypePath(artifact, view) {
  const id = idSegment(artifact.id);
  if (!view) return `/${id}`;
  const { segments, suffix } = prototypeRouteParts(view);
  return `/${id}${segments.length ? `/${segments.join("/")}` : ""}${suffix}`;
}
function buildArtifactPath(artifact, { base = "/", viewId } = {}) {
  if (!artifact || typeof artifact !== "object") throw new TypeError("artifact is required.");
  const id = idSegment(artifact.id);
  const hasView = viewId !== void 0;
  if (hasView && (typeof viewId !== "string" || !viewId.trim())) {
    throw new TypeError("viewId must be a non-empty authored view ID when supplied.");
  }
  let routePath;
  if (artifact.kind === "prototype") {
    if (!hasView) routePath = prototypePath(artifact, null);
    else {
      const view = exactView(artifact, viewId);
      if (!view) throw new TypeError(`Prototype view "${viewId}" was not found.`);
      routePath = prototypePath(artifact, view);
    }
  } else if (artifact.kind === "site") {
    routePath = `/sites/${id}`;
    if (hasView) {
      if (!exactView(artifact, viewId)) throw new TypeError(`Site view "${viewId}" was not found.`);
      routePath += `?view=${encodeURIComponent(viewId)}`;
    }
  } else if (artifact.kind === "canvas") {
    if (hasView) throw new TypeError("Canvas artifacts do not have public named views.");
    routePath = `/canvas/${id}`;
  } else if (artifact.kind === "doc") {
    if (hasView) throw new TypeError("Document artifacts do not have public named views.");
    routePath = `/docs/${id}`;
  } else {
    throw new TypeError(`Unsupported artifact kind: ${String(artifact.kind)}`);
  }
  return withBase(routePath, base);
}

// packages/storyboard/src/core/notebook/first-look/catalog.node.ts
var LEGACY_ARTIFACT_MARKER_FILE = ".hypercanvas-artifact.json";
var FIRST_LOOK_DIAGNOSTIC_SOURCE = "first-look";
function tagged(diagnostic3) {
  return { ...diagnostic3, source: FIRST_LOOK_DIAGNOSTIC_SOURCE };
}
function routeFor(artifact) {
  if (!isFirstLookId(artifact.id)) return null;
  try {
    return buildArtifactPath({ id: artifact.id, kind: artifact.kind, views: artifact.views });
  } catch {
    return null;
  }
}
function catalogFolderPath(artifact) {
  if (artifact.kind !== "doc") return artifact.folderPath || artifact.path;
  return artifact.wrapped ? artifact.folderPath : artifact.path;
}
function toNotebookArtifact(artifact) {
  const diagnostics = artifact.diagnostics.map(tagged);
  return {
    id: artifact.id,
    kind: artifact.kind,
    folderPath: catalogFolderPath(artifact),
    payloadPath: artifact.payloadPath,
    title: artifact.title,
    route: routeFor(artifact),
    visible: true,
    available: artifact.available,
    portable: true,
    descriptorPath: artifact.descriptorPath,
    descriptor: artifact.descriptor ? structuredClone(artifact.descriptor) : void 0,
    ...artifact.kind === "prototype" ? {
      runtime: artifact.descriptor?.runtime && typeof artifact.descriptor.runtime === "object" ? structuredClone(artifact.descriptor.runtime) : void 0,
      entry: artifact.entry,
      views: structuredClone(artifact.views)
    } : {},
    references: [...artifact.references],
    resolvedReferences: [...artifact.resolvedReferences ?? []],
    diagnostics
  };
}
function readPortableCatalog(root) {
  const discovery = discoverFirstLookNotebook(root);
  const artifacts = discovery.artifacts.map(toNotebookArtifact);
  const claimedLocators = new Set(artifacts.flatMap((artifact) => [artifact.folderPath, artifact.payloadPath].filter((value) => typeof value === "string")));
  const attached = new Set(discovery.artifacts.flatMap((artifact) => artifact.diagnostics));
  const scannerDiagnostics = discovery.diagnostics.filter((item) => !attached.has(item)).map(tagged);
  return {
    artifacts,
    claimedLocators,
    diagnostics: [...artifacts.flatMap((artifact) => artifact.diagnostics), ...scannerDiagnostics]
  };
}
function markFailed(artifact, diagnostic3) {
  artifact.available = false;
  artifact.diagnostics.push(diagnostic3);
}
function hasCode(artifact, code, id) {
  return artifact.diagnostics.some((item) => item.code === code && (id === void 0 || item.id === id));
}
function reportMarkerConflicts(root, artifacts) {
  const found = [];
  for (const artifact of artifacts) {
    if (artifact.kind === "doc" && !artifact.folderPath.endsWith(".doc")) continue;
    const markerPath = path5.join(root, artifact.folderPath, LEGACY_ARTIFACT_MARKER_FILE);
    let markerStat;
    try {
      markerStat = fs5.lstatSync(markerPath);
    } catch {
      continue;
    }
    const markerRelative = `${artifact.folderPath}/${LEGACY_ARTIFACT_MARKER_FILE}`;
    if (!markerStat.isFile()) {
      const item = tagged({
        code: "INVALID_ARTIFACT_IDENTITY",
        message: `Legacy identity marker ${markerRelative} must be a regular file. Remove it or replace it with a matching portable identity.`,
        path: markerRelative
      });
      markFailed(artifact, item);
      found.push(item);
      continue;
    }
    let marker;
    try {
      marker = JSON.parse(fs5.readFileSync(markerPath, "utf8"));
    } catch {
      const item = tagged({
        code: "INVALID_ARTIFACT_IDENTITY",
        message: `Legacy identity marker ${markerRelative} is not valid JSON. Repair it before opening this artifact.`,
        path: markerRelative
      });
      markFailed(artifact, item);
      found.push(item);
      continue;
    }
    const record3 = typeof marker === "object" && marker !== null && !Array.isArray(marker) ? marker : {};
    if (typeof record3.id !== "string" || !record3.id.trim()) continue;
    if (artifact.id !== null && record3.id !== artifact.id) {
      const item = tagged({
        code: "ARTIFACT_IDENTITY_CONFLICT",
        message: `Portable id "${artifact.id}" at ${artifact.folderPath} conflicts with legacy marker id "${record3.id}". Resolve the conflict before using either identity.`,
        path: artifact.folderPath,
        id: artifact.id,
        legacyId: record3.id
      });
      markFailed(artifact, item);
      found.push(item);
    }
  }
  return found;
}
function supersededRegistrations(artifacts, pages) {
  const diagnostics = [];
  const kept = pages.filter((page) => {
    const locator = typeof page.path === "string" ? page.path.replaceAll("\\", "/") : null;
    if (!locator) return true;
    const owner = artifacts.find((artifact) => artifact.kind === page.type && (artifact.kind === "doc" ? locator === artifact.payloadPath : locator === artifact.folderPath || locator === artifact.payloadPath));
    if (!owner) return true;
    if (typeof page.id === "string" && owner.id !== null && page.id !== owner.id) {
      const item = tagged({
        code: "ARTIFACT_IDENTITY_CONFLICT",
        message: `Legacy page registration "${page.id}" at ${locator} conflicts with portable id "${owner.id}". Resolve the conflict before using either identity.`,
        path: owner.folderPath,
        id: owner.id,
        legacyId: page.id
      });
      markFailed(owner, item);
      diagnostics.push(item);
    }
    return false;
  });
  return { pages: kept, diagnostics };
}
function reportCrossCatalogConflicts(artifacts) {
  const found = [];
  const byId = /* @__PURE__ */ new Map();
  for (const artifact of artifacts) {
    if (typeof artifact.id !== "string") continue;
    byId.set(artifact.id, [...byId.get(artifact.id) ?? [], artifact]);
  }
  for (const [id, matches] of byId) {
    if (matches.length < 2 || !matches.some((artifact) => artifact.portable === true)) continue;
    const paths = matches.map((match) => match.folderPath);
    for (const artifact of matches) {
      if (hasCode(artifact, "DUPLICATE_ARTIFACT_ID", id)) continue;
      const item = tagged({
        code: "DUPLICATE_ARTIFACT_ID",
        message: `Artifact identity "${id}" is shared by ${paths.join(" and ")}; assign distinct IDs before using either artifact.`,
        path: artifact.folderPath,
        id,
        paths
      });
      markFailed(artifact, item);
      found.push(item);
    }
  }
  const byRoute = /* @__PURE__ */ new Map();
  for (const artifact of artifacts) {
    if (!artifact.available || !artifact.route) continue;
    const key = notebookRouteCollisionKey(artifact.route);
    byRoute.set(key, [...byRoute.get(key) ?? [], artifact]);
  }
  for (const matches of byRoute.values()) {
    if (matches.length < 2 || !matches.some((artifact) => artifact.portable === true)) continue;
    const routes = [...new Set(matches.map((match) => match.route))];
    for (const artifact of matches) {
      const item = tagged({
        code: "ARTIFACT_ROUTE_CONFLICT",
        message: `Canonical artifact route${routes.length === 1 ? "" : "s"} ${routes.map((route) => `"${route}"`).join(" / ")} conflict across ${matches.map((match) => match.folderPath).join(" and ")}; re-route these artifacts before use.`,
        path: artifact.folderPath
      });
      markFailed(artifact, item);
      found.push(item);
    }
  }
  return found;
}
function portablePageRecords(artifacts) {
  return artifacts.flatMap((artifact) => {
    if (typeof artifact.id !== "string") return [];
    const pagePath = artifact.kind === "canvas" || artifact.kind === "doc" ? artifact.payloadPath : artifact.folderPath;
    if (!pagePath) return [];
    const record3 = {
      id: artifact.id,
      type: artifact.kind,
      title: artifact.title,
      path: pagePath,
      route: artifact.route,
      portable: true,
      ...artifact.kind === "site" ? { siteId: artifact.id } : {}
    };
    return [{ record: record3, artifact }];
  });
}
function portableNotebookId(root) {
  const base = path5.basename(root).replace(/[^A-Za-z0-9._:-]+/g, "-").replace(/^[^A-Za-z0-9]+/, "");
  return isFirstLookId(base) ? `notebook-${base}` : "notebook-portable";
}

// packages/storyboard/src/core/runtimeDir.ts
import { existsSync } from "node:fs";
import { join as join2 } from "node:path";
var RUNTIME_DIR_NAME = ".hypercanvas";
var LEGACY_RUNTIME_DIR_NAME = ".storyboard";
function resolveRuntimeDir(root) {
  const primaryDir = join2(root, RUNTIME_DIR_NAME);
  if (existsSync(primaryDir)) return primaryDir;
  const legacyDir = join2(root, LEGACY_RUNTIME_DIR_NAME);
  if (existsSync(legacyDir)) return legacyDir;
  return primaryDir;
}

// packages/storyboard/src/core/notebook/navigation.ts
import { randomUUID } from "node:crypto";
var NOTEBOOK_PAGE_TYPES = Object.freeze(["prototype", "canvas", "component", "site", "doc"]);
var LEGACY_NOTEBOOK_PAGE_TYPES = ["prototype", "canvas", "component", "site"];
function typeGroupsFor(hasDocPages) {
  return hasDocPages ? [...NOTEBOOK_PAGE_TYPES] : [...LEGACY_NOTEBOOK_PAGE_TYPES];
}
var NOTEBOOK_NAVIGATION_MODES = Object.freeze(["type", "files"]);
function isRecord5(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNotebookPageType(value) {
  return NOTEBOOK_PAGE_TYPES.some((type) => type === value);
}
function isNavigationMode(value) {
  return NOTEBOOK_NAVIGATION_MODES.some((mode) => mode === value);
}
function isPageTypeList(value) {
  return Array.isArray(value) && value.every(isNotebookPageType);
}
function navigationError(message) {
  return Object.assign(new Error(message), { code: "INVALID_NAVIGATION" });
}
function sameTypeSet(groups, expected) {
  return groups.length === expected.length && new Set(groups).size === expected.length && expected.every((type) => groups.includes(type));
}
function idsByType(pages) {
  const ids = { prototype: [], canvas: [], component: [], site: [] };
  for (const page of pages) {
    const type = page.type;
    if (type === "doc") (ids.doc ??= []).push(page.id);
    else if (isNotebookPageType(type) && type !== "doc") ids[type].push(page.id);
  }
  return ids;
}
function createDefaultNavigation(pages, { legacyGroups = [] } = {}) {
  const pageIds = pages.map((page) => page.id);
  const knownIds = new Set(pageIds);
  const sections = [];
  const assigned = /* @__PURE__ */ new Set();
  for (const group of legacyGroups) {
    const members = (Array.isArray(group?.pageIds) ? group.pageIds : []).filter((id2) => knownIds.has(id2) && !assigned.has(id2));
    const id = typeof group?.id === "string" && group.id.trim() ? group.id : `section-${randomUUID().replaceAll("-", "")}`;
    const title = typeof group?.title === "string" && group.title.trim() ? group.title.trim() : "Section";
    if (!members.length || sections.some((section) => section.id === id)) continue;
    sections.push({ id, title, pageIds: members });
    for (const pageId of members) assigned.add(pageId);
  }
  const filesEntries = [];
  const emittedSections = /* @__PURE__ */ new Set();
  for (const pageId of pageIds) {
    const section = sections.find((item) => item.pageIds.includes(pageId));
    if (section) {
      if (!emittedSections.has(section.id)) {
        filesEntries.push({ type: "section", sectionId: section.id });
        emittedSections.add(section.id);
      }
    } else {
      filesEntries.push({ type: "page", pageId });
    }
  }
  return {
    mode: "type",
    sectionsEnabled: true,
    type: {
      groups: typeGroupsFor(pages.some((page) => page.type === "doc")),
      order: idsByType(pages)
    },
    files: {
      flatOrder: pageIds,
      entries: filesEntries,
      sections
    }
  };
}
function invalidNavigation(detail, pages) {
  const fallback = createDefaultNavigation(pages);
  return {
    navigation: fallback,
    valid: false,
    diagnostic: {
      code: "INVALID_NAVIGATION",
      message: `Notebook navigation is malformed (${detail}); showing the complete fallback inventory.`,
      path: "navigation"
    }
  };
}
function exactIdList(value, expected, label) {
  if (!Array.isArray(value)) throw navigationError(`${label} must be an array`);
  const allowed = new Set(expected);
  const seen = /* @__PURE__ */ new Set();
  for (const id of value) {
    if (typeof id !== "string" || !allowed.has(id)) throw navigationError(`${label} contains an unknown page`);
    if (seen.has(id)) throw navigationError(`${label} contains a duplicate page`);
    seen.add(id);
  }
  if (seen.size !== allowed.size) throw navigationError(`${label} omits registered pages`);
  return [...value];
}
function normalizeNavigation(value, pages) {
  if (value == null) return { navigation: createDefaultNavigation(pages), valid: true, diagnostic: null };
  try {
    if (!isRecord5(value)) throw navigationError("the value must be an object");
    const typeValue = isRecord5(value.type) ? value.type : {};
    const filesValue = isRecord5(value.files) ? value.files : {};
    if (!isNavigationMode(value.mode)) throw navigationError("the mode is unknown");
    if (typeof value.sectionsEnabled !== "boolean") throw navigationError("sectionsEnabled must be a boolean");
    const groupedIds = idsByType(pages);
    const allIds = pages.map((page) => page.id);
    const storedGroups = typeValue.groups;
    const hasDocPages = (groupedIds.doc ?? []).length > 0;
    const groups = typeGroupsFor(hasDocPages);
    if (!isPageTypeList(storedGroups) || !(sameTypeSet(storedGroups, LEGACY_NOTEBOOK_PAGE_TYPES) || sameTypeSet(storedGroups, NOTEBOOK_PAGE_TYPES))) {
      throw navigationError("Type group order must contain Prototype, Canvas, Component, and Site once each");
    }
    const typeOrder = { prototype: [], canvas: [], component: [], site: [] };
    const rawTypeOrder = isRecord5(typeValue.order) ? typeValue.order : {};
    for (const type of groups) typeOrder[type] = exactIdList(rawTypeOrder[type], groupedIds[type] ?? [], `Type ${type} order`);
    const flatOrder = exactIdList(filesValue.flatOrder, allIds, "Flat Files order");
    const sections = filesValue.sections;
    const entries = filesValue.entries;
    if (!Array.isArray(sections) || !Array.isArray(entries)) throw navigationError("Files entries and sections must be arrays");
    const sectionById = /* @__PURE__ */ new Map();
    for (const candidate of sections) {
      if (!isRecord5(candidate)) throw navigationError("a section must be an object");
      const section = candidate;
      if (typeof section.id !== "string" || !section.id.trim() || sectionById.has(section.id)) throw navigationError("section IDs must be non-empty and unique");
      if (typeof section.title !== "string" || !section.title.trim()) throw navigationError("section titles must be non-empty");
      sectionById.set(section.id, {
        id: section.id,
        title: section.title.trim(),
        pageIds: Array.isArray(section.pageIds) ? [...section.pageIds] : null
      });
    }
    const referencedPages = /* @__PURE__ */ new Set();
    const referencedSections = /* @__PURE__ */ new Set();
    const normalizedEntries = [];
    for (const candidate of entries) {
      const entry = isRecord5(candidate) ? candidate : {};
      if (entry.type === "page" && typeof entry.pageId === "string") {
        if (!allIds.includes(entry.pageId) || referencedPages.has(entry.pageId)) throw navigationError("Files entries contain an unknown or duplicate page");
        referencedPages.add(entry.pageId);
        normalizedEntries.push({ type: "page", pageId: entry.pageId });
      } else if (entry.type === "section" && typeof entry.sectionId === "string") {
        if (!sectionById.has(entry.sectionId) || referencedSections.has(entry.sectionId)) throw navigationError("Files entries contain an unknown or duplicate section");
        referencedSections.add(entry.sectionId);
        normalizedEntries.push({ type: "section", sectionId: entry.sectionId });
      } else {
        throw navigationError("Files entries may reference only a page or one-level section");
      }
    }
    const normalizedSections = [];
    for (const section of sectionById.values()) {
      if (!referencedSections.has(section.id)) throw navigationError("a section is not present in Files root order");
      if (!section.pageIds) throw navigationError("section pageIds must be an array");
      for (const pageId of section.pageIds) {
        if (typeof pageId !== "string" || !allIds.includes(pageId) || referencedPages.has(pageId)) throw navigationError("sections contain an unknown or duplicate page");
        referencedPages.add(pageId);
      }
      normalizedSections.push({ id: section.id, title: section.title, pageIds: section.pageIds });
    }
    if (referencedPages.size !== allIds.length) throw navigationError("Files sectioned order omits registered pages");
    return {
      navigation: {
        mode: value.mode,
        sectionsEnabled: value.sectionsEnabled,
        type: { groups: [...groups], order: typeOrder },
        files: { flatOrder, entries: normalizedEntries, sections: normalizedSections }
      },
      valid: true,
      diagnostic: null
    };
  } catch (error) {
    return invalidNavigation(error instanceof Error ? error.message : String(error), pages);
  }
}

// packages/storyboard/src/core/notebook/reader.node.ts
function isPageType(value) {
  return NOTEBOOK_PAGE_TYPES.some((type) => type === value);
}
function isValidManifestPage(value) {
  return isRecord6(value) && typeof value.id === "string" && typeof value.type === "string" && isPageType(value.type) && typeof value.title === "string" && (value.path === void 0 || typeof value.path === "string") && (value.siteId === void 0 || typeof value.siteId === "string") && (value.route === void 0 || value.route === null || typeof value.route === "string");
}
function isNotebookManifest(value) {
  return isRecord6(value) && value.formatVersion === NOTEBOOK_FORMAT_VERSION && typeof value.id === "string" && typeof value.title === "string" && Array.isArray(value.pages) && value.pages.every(isValidManifestPage) && normalizeNavigation(value.navigation, navigationPages(value.pages)).valid;
}
function isRecord6(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function record(value) {
  return isRecord6(value) ? value : {};
}
function stringField(value, key) {
  const field = value[key];
  return typeof field === "string" ? field : void 0;
}
function navigationPages(pages) {
  return pages.flatMap((page) => typeof page.id === "string" && typeof page.type === "string" ? [{ id: page.id, type: page.type }] : []);
}
function errorMessage2(error) {
  return isRecord6(error) && typeof error.message === "string" ? error.message : String(error);
}
function errorCode(error) {
  return isRecord6(error) ? error.code : void 0;
}
var NOTEBOOK_FORMAT_VERSION = 2;
var NOTEBOOK_ARTIFACT_MARKER_FILE = ".hypercanvas-artifact.json";
var NOTEBOOK_CANVAS_CONFIG_FILE = CANVAS_CONFIG_PRIMARY;
var NOTEBOOK_PUBLISH_DIR = "backstage/publish";
var NOTEBOOK_SUPPORT_DIRECTORIES = Object.freeze(["hooks", "lib", "tools", "widgets", "styles"]);
function notebookSupportCandidates(root, relativePath2, preferRoot = false) {
  const normalized = relativePath2.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\0"))) {
    throw new Error("Notebook support path must be a contained relative path.");
  }
  const explicit = segments[0] === NOTEBOOK_BACKSTAGE_DIR;
  if (!NOTEBOOK_SUPPORT_DIRECTORIES.includes(segments[explicit ? 1 : 0] || "")) {
    throw new Error("Unknown Notebook support directory.");
  }
  const canonical = canonicalRoot(root);
  const candidates = explicit ? [path6.join(canonical, normalized)] : [
    path6.join(canonical, NOTEBOOK_BACKSTAGE_DIR, normalized),
    path6.join(canonical, normalized)
  ];
  if (preferRoot && !explicit) candidates.reverse();
  for (const candidate of candidates) {
    let current = canonical;
    for (const segment of path6.relative(canonical, candidate).split(path6.sep)) {
      current = path6.join(current, segment);
      try {
        fs6.lstatSync(current);
        if (!isInside(canonical, fs6.realpathSync.native(current))) throw new Error("Notebook support path escapes its root.");
      } catch (error) {
        if (errorCode(error) === "ENOENT") {
          try {
            if (fs6.lstatSync(current).isSymbolicLink()) throw new Error("Notebook support path contains an unresolved symlink.");
          } catch (nested) {
            if (errorCode(nested) !== "ENOENT") throw nested;
          }
          break;
        }
        throw error;
      }
    }
  }
  return candidates;
}
function resolveNotebookSupportPath(root, relativePath2, { preferRoot = false, fresh = false } = {}) {
  const candidates = notebookSupportCandidates(root, relativePath2, preferRoot);
  const existing = candidates.find((candidate) => fs6.existsSync(candidate));
  if (existing) return existing;
  if (candidates.length === 1) return candidates[0];
  return fresh || fs6.existsSync(path6.join(root, NOTEBOOK_BACKSTAGE_DIR)) ? candidates[preferRoot ? 1 : 0] : candidates[preferRoot ? 0 : 1];
}
var NOTEBOOK_CONFIG_FILES = Object.freeze([
  "hypercanvas.config.json",
  "terminal.config.json",
  "toolbar.config.json",
  "commandpalette.config.json",
  "paste.config.json",
  "widgets.config.json",
  "mascot.config.json"
]);
var LEGACY_NOTEBOOK_CONFIG_FILE = "storyboard.config.json";
var NOTEBOOK_CONFIG_FILE_NAMES = Object.freeze([
  ...NOTEBOOK_CONFIG_FILES,
  LEGACY_NOTEBOOK_CONFIG_FILE
]);
var NOTEBOOK_DIRECTORIES = Object.freeze({
  canvases: "canvas",
  prototypes: "prototypes",
  widgets: "widgets",
  tools: "tools",
  components: "components",
  data: "data",
  assets: "assets",
  publish: NOTEBOOK_PUBLISH_DIR
});
var LEGACY_SITE_DIRECTORY = "sites";
var RECOVERABLE_PAGE_DIAGNOSTICS = /* @__PURE__ */ new Set([
  "MISSING_PAGE_PAYLOAD",
  "MISSING_SITE_DESCRIPTOR",
  "UNSUPPORTED_CANVAS_LOCATION",
  "PAGE_ROUTE_CONFLICT",
  "NESTED_ARTIFACT",
  "INVALID_ARTIFACT_IDENTITY",
  "MALFORMED_ARTIFACT_PAYLOAD",
  "AMBIGUOUS_CANVAS_PAYLOAD",
  "DUPLICATE_ARTIFACT_ID",
  "ARTIFACT_ROUTE_CONFLICT",
  "UNREPRESENTABLE_ARTIFACT_ROUTE",
  "INVALID_EXTERNAL_PROTOTYPE_URL",
  "PROTOTYPE_DATA_SCOPE_CONFLICT",
  "CUSTOM_DRAFT_EXCLUSION"
]);
function diagnostic2(code, message, relativePath2 = null) {
  return { code, message, path: relativePath2 };
}
function makeId() {
  return `nb_${randomUUID2().replaceAll("-", "")}`;
}
function canonicalRoot(root) {
  const resolved = path6.resolve(String(root || "."));
  try {
    return fs6.realpathSync.native(resolved);
  } catch {
    return resolved;
  }
}
function isDirectory3(filePath) {
  try {
    return fs6.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}
function isFile3(filePath) {
  try {
    return fs6.statSync(filePath).isFile();
  } catch {
    return false;
  }
}
function isInside(root, candidate) {
  const relative = path6.relative(root, candidate);
  return relative === "" || relative !== ".." && !relative.startsWith(`..${path6.sep}`) && !path6.isAbsolute(relative);
}
function payloadState(root, relativePath2, type) {
  const candidate = path6.resolve(root, relativePath2);
  if (!isInside(root, candidate)) return { available: false, unsafe: true };
  try {
    const resolved = fs6.realpathSync.native(candidate);
    if (!isInside(root, resolved)) return { available: false, unsafe: true };
  } catch {
    return { available: false, unsafe: false };
  }
  return {
    available: type === "canvas" ? isFile3(candidate) : isDirectory3(candidate),
    unsafe: false
  };
}
function safeRelativePath(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const normalized = value.replaceAll("\\", "/");
  if (normalized.startsWith("/") || path6.posix.isAbsolute(normalized)) return null;
  const segments = normalized.split("/");
  if (segments.includes("..") || segments.includes("")) return null;
  const clean = path6.posix.normalize(normalized);
  return clean === "." || clean.startsWith("../") ? null : clean;
}
function pagePathIsValid(type, relativePath2) {
  if (type === "canvas") {
    return relativePath2.startsWith(`${NOTEBOOK_DIRECTORIES.canvases}/`) && relativePath2.endsWith(".canvas.jsonl") || /(?:^|\/)[^/]+\.canvas\/[^/]+\.canvas\.jsonl$/.test(relativePath2);
  }
  if (type === "prototype") return relativePath2.startsWith(`${NOTEBOOK_DIRECTORIES.prototypes}/`) || /(?:^|\/)[^/]+\.prototype$/.test(relativePath2);
  return type === "component" && /(?:^|\/)[^/]+\.component$/.test(relativePath2);
}
function deterministicId(prefix, value) {
  const suffix = createHash("sha256").update(String(value)).digest("hex").slice(0, 20);
  return `${prefix}-${suffix}`;
}
var NOTEBOOK_ARTIFACT_SUFFIXES = Object.freeze({
  ".prototype": "prototype",
  ".component": "component",
  ".canvas": "canvas",
  ".site": "site"
});
var ARTIFACT_SOURCE_EXTENSIONS = ["jsx", "js", "tsx", "ts", "mdx"];
function artifactKindForDirectory(name) {
  for (const [suffix, kind] of Object.entries(NOTEBOOK_ARTIFACT_SUFFIXES)) {
    if (name.endsWith(suffix) && name.length > suffix.length) return kind;
  }
  return null;
}
function canonicalArtifactRoute(kind, logicalName) {
  if (kind === "prototype") return `/${encodeURIComponent(`${logicalName}.prototype`)}`;
  if (kind === "canvas") return `/canvas/${encodeURIComponent(logicalName)}`;
  if (kind === "component") return `/components/${encodeURIComponent(logicalName)}`;
  return `/sites/${encodeURIComponent(logicalName)}`;
}
function artifactRouteNameIssue(logicalName) {
  if (!logicalName) return "Artifact folder has an empty logical basename after removing its visibility prefix and kind suffix.";
  if (logicalName.includes("/") || logicalName.includes("\\")) return "Artifact logical names cannot contain filesystem path separators.";
  if (logicalName.includes("?")) return 'Artifact names containing "?" cannot be represented as static React Router paths.';
  if (/^:[A-Za-z_$][A-Za-z0-9_$]*/.test(logicalName)) {
    return 'Artifact names beginning with a route parameter such as ":preview" would match unrelated routes.';
  }
  return null;
}
function notebookRoutePathsOverlap(left, right) {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}
function readArtifactIdentity(directory, kind, folderPath) {
  const markerPath = path6.join(directory, NOTEBOOK_ARTIFACT_MARKER_FILE);
  let markerStat;
  try {
    markerStat = fs6.lstatSync(markerPath);
  } catch {
    return { id: null, diagnostics: [] };
  }
  if (!markerStat.isFile()) return { id: null, diagnostics: [diagnostic2(
    "INVALID_ARTIFACT_IDENTITY",
    `Artifact identity ${folderPath}/${NOTEBOOK_ARTIFACT_MARKER_FILE} must be a regular file inside the artifact folder. Replace the symlink or special file with a JSON marker.`,
    `${folderPath}/${NOTEBOOK_ARTIFACT_MARKER_FILE}`
  )] };
  try {
    const value = JSON.parse(fs6.readFileSync(markerPath, "utf8"));
    const marker = record(value);
    if (marker.formatVersion !== 1 || typeof marker.id !== "string" || !marker.id.trim() || marker.kind !== kind) {
      return { id: null, diagnostics: [diagnostic2(
        "INVALID_ARTIFACT_IDENTITY",
        `Artifact identity at ${folderPath}/${NOTEBOOK_ARTIFACT_MARKER_FILE} must contain formatVersion 1, a nonempty id, and kind "${kind}". Repair or recreate this marker.`,
        `${folderPath}/${NOTEBOOK_ARTIFACT_MARKER_FILE}`
      )] };
    }
    const migrationAliases = normalizeNotebookArtifactMigrationAliases(marker.migrationAliases);
    if (marker.migrationAliases !== void 0 && !migrationAliases) {
      return { id: marker.id, marker, diagnostics: [diagnostic2(
        "INVALID_ARTIFACT_MIGRATION_ALIASES",
        "Artifact migration aliases at " + folderPath + "/" + NOTEBOOK_ARTIFACT_MARKER_FILE + " are malformed. Repair the alias metadata before registering this artifact.",
        folderPath + "/" + NOTEBOOK_ARTIFACT_MARKER_FILE
      )] };
    }
    return {
      id: marker.id,
      marker,
      ...migrationAliases && Object.keys(migrationAliases).length ? { migrationAliases } : {},
      diagnostics: []
    };
  } catch (error) {
    return { id: null, diagnostics: [diagnostic2(
      "INVALID_ARTIFACT_IDENTITY",
      `Could not parse ${folderPath}/${NOTEBOOK_ARTIFACT_MARKER_FILE}: ${errorMessage2(error)}. Repair or recreate this marker.`,
      `${folderPath}/${NOTEBOOK_ARTIFACT_MARKER_FILE}`
    )] };
  }
}
function artifactPayload(root, absoluteDirectory, folderPath, kind) {
  const basename2 = path6.posix.basename(folderPath);
  const name = basename2.slice(0, basename2.lastIndexOf(".")).replace(/^_+/, "");
  let payloadPath = null;
  let title = name.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || name;
  let route = null;
  let externalUrl;
  let issue = null;
  let issueCode = "MALFORMED_ARTIFACT_PAYLOAD";
  let entries = [];
  try {
    entries = fs6.readdirSync(absoluteDirectory, { withFileTypes: true });
  } catch {
  }
  if (kind === "prototype") {
    const source = entries.find((entry) => entry.isFile() && ARTIFACT_SOURCE_EXTENSIONS.some((extension) => entry.name === `index.${extension}`));
    const metadata = entries.find((entry) => entry.isFile() && [`${name}.prototype.json`, `${name}.prototype.jsonc`].includes(entry.name));
    if (source) payloadPath = path6.posix.join(folderPath, source.name);
    else if (metadata) {
      payloadPath = path6.posix.join(folderPath, metadata.name);
      const errors = [];
      const parsed = parseJsonc3(fs6.readFileSync(path6.join(absoluteDirectory, metadata.name), "utf8"), errors);
      if (errors.length || !isRecord6(parsed)) issue = `${payloadPath} must contain valid Prototype metadata JSON or JSONC.`;
      else {
        const metadataTitle = stringField(record(parsed.meta), "title");
        if (metadataTitle?.trim()) title = metadataTitle.trim();
        const rawUrl = stringField(parsed, "url")?.trim();
        let parsedUrl = null;
        try {
          parsedUrl = rawUrl ? new URL(rawUrl) : null;
        } catch {
        }
        if (!parsedUrl || !["http:", "https:"].includes(parsedUrl.protocol)) {
          issueCode = "INVALID_EXTERNAL_PROTOTYPE_URL";
          issue = `${payloadPath} must contain an absolute HTTP(S) URL in its top-level "url" field.`;
        } else {
          externalUrl = rawUrl;
        }
      }
    } else issue = `Add index.jsx, index.tsx, or ${name}.prototype.json to ${folderPath}.`;
    if (source) title = readPrototypeTitle(absoluteDirectory);
    route = canonicalArtifactRoute(kind, name);
  } else if (kind === "component") {
    const stories = [];
    const collectStories = (directory, relative = "") => {
      for (const entry of fs6.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        if (entry.isFile() && entry.name.startsWith("_")) continue;
        const inside3 = path6.posix.join(relative, entry.name);
        if (entry.isFile() && /\.stor(?:y|ies)\.[jt]sx?$/.test(entry.name)) stories.push(inside3);
        else if (entry.isDirectory() && !/\.(prototype|component|canvas|site)$/.test(entry.name)) {
          collectStories(path6.join(directory, entry.name), inside3);
        }
      }
    };
    collectStories(absoluteDirectory);
    const primary = stories.find((file) => ARTIFACT_SOURCE_EXTENSIONS.some((extension) => file === `${name}.story.${extension}`)) || stories.find((file) => ARTIFACT_SOURCE_EXTENSIONS.some((extension) => file === `${name}.stories.${extension}`)) || stories[0];
    if (primary) payloadPath = path6.posix.join(folderPath, primary);
    else issue = `Add a .story.jsx, .stories.jsx, .story.tsx or .stories.tsx module to ${folderPath}.`;
    route = canonicalArtifactRoute(kind, name);
  } else if (kind === "canvas") {
    const filename = `${name}.canvas.jsonl`;
    const source = entries.find((entry) => entry.isFile() && entry.name === filename);
    const canvasPayloads = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".canvas.jsonl"));
    if (source) {
      payloadPath = path6.posix.join(folderPath, source.name);
      title = readCanvasTitle(path6.join(root, payloadPath));
      try {
        const lines = fs6.readFileSync(path6.join(root, payloadPath), "utf8").split(/\r?\n/).filter(Boolean);
        for (const [index, line] of lines.entries()) {
          try {
            JSON.parse(line);
          } catch {
            issue = `${payloadPath} contains invalid JSON on line ${index + 1}. Repair that line before opening the Canvas.`;
            break;
          }
        }
      } catch (error) {
        issue = `Could not read ${payloadPath}: ${errorMessage2(error)}.`;
      }
    } else issue = `Add ${filename} to ${folderPath}.`;
    if (canvasPayloads.length > 1) {
      issueCode = "AMBIGUOUS_CANVAS_PAYLOAD";
      issue = `Canvas artifact ${folderPath} has multiple JSONL payloads (${canvasPayloads.map((entry) => entry.name).join(", ")}). Keep only ${filename} before opening the Canvas.`;
    }
    route = canonicalArtifactRoute(kind, name);
  } else {
    const filename = "site.config.json";
    const source = entries.find((entry) => entry.isFile() && entry.name === filename);
    if (source) {
      payloadPath = path6.posix.join(folderPath, source.name);
      try {
        const descriptor = readSiteDescriptorFile(path6.join(root, payloadPath), name.toLowerCase());
        title = descriptor.title || descriptor.id;
        if (name.toLowerCase() !== descriptor.id.toLowerCase()) {
          issue = `${folderPath} must be named ${descriptor.id}.site (ignoring its visibility prefix) to match its normalized Site descriptor ID.`;
        } else {
          route = `/sites/${encodeURIComponent(descriptor.id)}`;
        }
      } catch (error) {
        issue = `${payloadPath} is not valid JSON (${errorMessage2(error)}). Repair or recreate the Site config.`;
      }
    } else issue = `Add ${filename} to ${folderPath}.`;
  }
  const routeNameIssue = artifactRouteNameIssue(name);
  if (routeNameIssue) route = null;
  return {
    payloadPath,
    title,
    route,
    ...externalUrl ? { externalUrl } : {},
    diagnostics: [
      ...issue ? [diagnostic2(issueCode, issue, payloadPath || folderPath)] : [],
      ...routeNameIssue ? [diagnostic2("UNREPRESENTABLE_ARTIFACT_ROUTE", `${routeNameIssue} Rename this artifact folder to a routable logical name.`, folderPath)] : []
    ]
  };
}
function discoverNotebookArtifacts(root, registeredPages, claimedLocators = /* @__PURE__ */ new Set()) {
  const rootRealPath = fs6.realpathSync.native(root);
  const found = [];
  const diagnostics = [];
  const walk = (directory, relativeDirectory, artifactAncestors, hidden) => {
    let realDirectory;
    try {
      realDirectory = fs6.realpathSync.native(directory);
    } catch {
      return;
    }
    if (!isInside(rootRealPath, realDirectory)) return;
    let entries;
    try {
      entries = fs6.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      if (entry.isSymbolicLink() || NOTEBOOK_INFRASTRUCTURE_DIRECTORIES.has(entry.name) || !entry.isDirectory()) continue;
      const relativePath2 = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const absolutePath = path6.join(directory, entry.name);
      const kind = artifactKindForDirectory(entry.name);
      if (kind && claimedLocators.has(relativePath2)) continue;
      const nextHidden = hidden || entry.name.startsWith("_");
      const nextAncestors = [...artifactAncestors];
      if (kind) {
        const metadata = artifactPayload(root, absolutePath, relativePath2, kind);
        const identity = readArtifactIdentity(absolutePath, kind, relativePath2);
        const registered = registeredPages.filter((page) => page.type === kind && typeof page.path === "string" && (page.path.replaceAll("\\", "/") === relativePath2 || page.path.replaceAll("\\", "/") === metadata.payloadPath));
        const id = identity.id || (registered.length === 1 && typeof registered[0]?.id === "string" ? registered[0].id : deterministicId(`artifact-${kind}`, relativePath2));
        const diagnosticsForArtifact = [...identity.diagnostics, ...metadata.diagnostics];
        diagnostics.push(...diagnosticsForArtifact);
        const artifact = {
          id,
          kind,
          folderPath: relativePath2,
          payloadPath: metadata.payloadPath,
          title: metadata.title,
          route: metadata.route,
          ...metadata.externalUrl ? { externalUrl: metadata.externalUrl } : {},
          visible: !nextHidden,
          available: metadata.payloadPath !== null && diagnosticsForArtifact.length === 0,
          ...identity.migrationAliases ? { migrationAliases: identity.migrationAliases } : {},
          diagnostics: diagnosticsForArtifact
        };
        if (artifactAncestors.length) {
          const containingArtifact = artifactAncestors.at(-1);
          const outermostArtifact = artifactAncestors[0];
          const repairParentPath = path6.posix.dirname(outermostArtifact.path);
          const normalizedRepairParentPath = repairParentPath === "." ? "" : repairParentPath;
          const proposedDestination = path6.posix.join(normalizedRepairParentPath, path6.posix.basename(relativePath2));
          const item = Object.assign(diagnostic2(
            "NESTED_ARTIFACT",
            `${kind} artifact ${relativePath2} is nested inside ${containingArtifact.kind} artifact ${containingArtifact.path}. Move it to ${proposedDestination}.`,
            relativePath2
          ), {
            nestedArtifact: { kind, path: relativePath2 },
            containingArtifact,
            repairParentPath: normalizedRepairParentPath,
            proposedDestination
          });
          diagnostics.push(item);
        } else found.push({ directory: absolutePath, artifact });
        nextAncestors.push({ kind, path: relativePath2 });
      }
      walk(absolutePath, relativePath2, nextAncestors, nextHidden);
    }
  };
  walk(root, "", [], false);
  const idPaths = /* @__PURE__ */ new Map();
  const routePaths = /* @__PURE__ */ new Map();
  for (const { artifact } of found) {
    idPaths.set(artifact.id, [...idPaths.get(artifact.id) || [], artifact]);
    if (artifact.available && artifact.route) {
      const routeKey = notebookRouteCollisionKey(artifact.route);
      routePaths.set(routeKey, [...routePaths.get(routeKey) || [], artifact]);
    }
  }
  for (const [id, matches] of idPaths) {
    if (matches.length < 2) continue;
    for (const artifact of matches) {
      const item = diagnostic2("DUPLICATE_ARTIFACT_ID", `Artifact identity "${id}" is shared by ${matches.map((match) => match.folderPath).join(" and ")}; assign distinct IDs before registering either artifact.`, artifact.folderPath);
      artifact.available = false;
      artifact.diagnostics.push(item);
      diagnostics.push(item);
    }
  }
  for (const matches of routePaths.values()) {
    if (matches.length < 2) continue;
    const routes = [...new Set(matches.map((match) => match.route))];
    for (const artifact of matches) {
      const item = diagnostic2("ARTIFACT_ROUTE_CONFLICT", `Canonical artifact route${routes.length === 1 ? "" : "s"} ${routes.map((route) => `"${route}"`).join(" / ")} conflict across ${matches.map((match) => match.folderPath).join(" and ")}; rename or re-route these artifacts before registration.`, artifact.folderPath);
      artifact.available = false;
      artifact.diagnostics.push(item);
      diagnostics.push(item);
    }
  }
  const routeAliasOwners = /* @__PURE__ */ new Map();
  const canvasAliasOwners = /* @__PURE__ */ new Map();
  const failArtifact = (artifact, code, message) => {
    const item = diagnostic2(code, message, artifact.folderPath);
    artifact.available = false;
    artifact.diagnostics.push(item);
    diagnostics.push(item);
  };
  for (const { artifact } of found) {
    if (!artifact.available) continue;
    for (const alias of artifact.migrationAliases?.legacyRoutes || []) {
      const key = notebookRouteCollisionKey(alias.from);
      const priorAliases = routeAliasOwners.get(key) || [];
      const canonicalOwners = [...routePaths.entries()].filter(([route]) => notebookRoutePathsOverlap(route, key)).flatMap(([, owners2]) => owners2);
      const registeredOwners = registeredPages.filter((page) => typeof page.route === "string" && notebookRoutePathsOverlap(notebookRouteCollisionKey(page.route), key) && page.id !== artifact.id && page.path !== artifact.folderPath && page.path !== artifact.payloadPath);
      const reserved = isReservedApplicationRoute(alias.from);
      const owners = [...priorAliases.map((owner) => owner.artifact), ...canonicalOwners, ...registeredOwners.flatMap((page) => {
        const owner = found.find((candidate) => candidate.artifact.id === page.id)?.artifact;
        return owner ? [owner] : [];
      })];
      const overlappingAliases = [...routeAliasOwners.entries()].filter(([route]) => notebookRoutePathsOverlap(route, key)).flatMap(([, entries]) => entries.map((entry) => entry.artifact));
      if (reserved || owners.some((owner) => owner !== artifact) || overlappingAliases.some((owner) => owner !== artifact)) {
        failArtifact(artifact, "ARTIFACT_ROUTE_ALIAS_CONFLICT", "Migration route alias " + alias.from + " conflicts with an active canonical route, another alias, or a reserved application route.");
        for (const owner of owners) {
          if (owner !== artifact) failArtifact(owner, "ARTIFACT_ROUTE_ALIAS_CONFLICT", "Artifact route conflicts with migration alias " + alias.from + ".");
        }
      }
      routeAliasOwners.set(key, [...priorAliases, { artifact, from: alias.from }]);
    }
    for (const canvasId of artifact.migrationAliases?.legacyCanvasIds || []) {
      canvasAliasOwners.set(canvasId, [...canvasAliasOwners.get(canvasId) || [], artifact]);
    }
  }
  for (const { artifact } of found) {
    const aliases = artifact.migrationAliases?.legacyCanvasIds || [];
    for (const canvasId of aliases) {
      const canonicalOwners = idPaths.get(canvasId) || [];
      const owners = [.../* @__PURE__ */ new Set([...canvasAliasOwners.get(canvasId) || [], ...canonicalOwners])];
      if (owners.length < 2) continue;
      failArtifact(artifact, "ARTIFACT_CANVAS_ALIAS_CONFLICT", 'Legacy Canvas identity "' + canvasId + '" conflicts with another artifact ID or alias.');
      for (const owner of owners) {
        if (owner !== artifact) failArtifact(owner, "ARTIFACT_CANVAS_ALIAS_CONFLICT", 'Artifact identity conflicts with legacy Canvas alias "' + canvasId + '".');
      }
    }
  }
  return { artifacts: found.map(({ artifact }) => artifact).sort((left, right) => left.folderPath.localeCompare(right.folderPath, "en")), diagnostics };
}
function isReservedApplicationRoute(route) {
  const first = route.split("/").filter(Boolean)[0]?.toLocaleLowerCase("en-US");
  return !first || ["workspace", "viewfinder", "create", "sites", "canvas", "components", "notebook", "_hypercanvas"].includes(first);
}
function pageRoute(page) {
  if (page.type === "prototype" && typeof page.path === "string" && page.path.endsWith(".prototype")) {
    const name = artifactFolderLogicalName(path6.posix.basename(page.path));
    return name ? canonicalArtifactRoute("prototype", name) : null;
  }
  if (page.type === "component" && typeof page.path === "string" && path6.posix.basename(page.path).endsWith(".component")) {
    const name = artifactFolderLogicalName(path6.posix.basename(page.path));
    return name ? canonicalArtifactRoute("component", name) : null;
  }
  if (page.type === "canvas" && typeof page.path === "string" && page.path.includes(".canvas/")) {
    const folder = page.path.slice(0, page.path.indexOf(".canvas/"));
    const name = artifactFolderLogicalName(`${path6.posix.basename(folder)}.canvas`);
    return name ? canonicalArtifactRoute("canvas", name) : null;
  }
  if (typeof page.route === "string" && page.route.startsWith("/")) return page.route;
  if (page.type === "site") return `/sites/${encodeURIComponent(String(page.siteId || page.id || ""))}`;
  if (page.type === "component" && typeof page.path === "string") {
    const folderName = path6.posix.basename(page.path);
    const basename2 = artifactFolderLogicalName(folderName) || folderName.replace(/\.component$/, "");
    return `/components/${basename2}`;
  }
  if (page.type === "prototype" && typeof page.path === "string" && page.path.endsWith(".prototype")) {
    const folderName = path6.posix.basename(page.path);
    return `/${artifactFolderLogicalName(folderName) || folderName}`;
  }
  if (page.type === "canvas" && typeof page.path === "string" && page.path.includes(".canvas/")) {
    const folder = page.path.slice(0, page.path.indexOf(".canvas/"));
    return `/canvas/${artifactFolderLogicalName(`${path6.posix.basename(folder)}.canvas`) || path6.posix.basename(folder)}`;
  }
  const locator = String(page.path || "").replaceAll("\\", "/");
  const segments = locator.split("/").filter(Boolean);
  if (page.type === "canvas" && locator.startsWith(`${NOTEBOOK_DIRECTORIES.canvases}/`) && locator.endsWith(".canvas.jsonl")) {
    const routeSegments = segments.slice(1, -1).concat((segments.at(-1) || "").replace(/\.canvas\.jsonl$/, "")).filter((segment) => segment !== "drafts" && !segment.endsWith(".folder"));
    return `/canvas/${routeSegments.join("/")}`;
  }
  if (page.type === "prototype" && locator.startsWith(`${NOTEBOOK_DIRECTORIES.prototypes}/`)) {
    const routeSegments = segments.slice(1, -1).filter((segment) => segment !== "drafts" && !segment.endsWith(".folder")).concat(segments.at(-1) || []);
    return `/${routeSegments.join("/")}`;
  }
  return null;
}
function legacyGroupKey(page) {
  const segments = String(page.path || "").replaceAll("\\", "/").split("/").filter(Boolean);
  if (page.type === "canvas" && segments[0] === NOTEBOOK_DIRECTORIES.canvases) {
    const groups = segments.slice(1, -1);
    return groups.length ? groups.join("/") : null;
  }
  if (page.type === "prototype" && segments[0] === NOTEBOOK_DIRECTORIES.prototypes) {
    const groups = segments.slice(1, -1).filter((segment) => segment.endsWith(".folder")).map((segment) => segment.slice(0, -7));
    return groups.length ? groups.join("/") : null;
  }
  return null;
}
function migrateManifestV1(root, legacy) {
  if (!isRecord6(legacy) || legacy.formatVersion !== 1) return legacy;
  const legacyRecord = legacy;
  const pages = (Array.isArray(legacyRecord.pages) ? legacyRecord.pages : []).map((page, index) => {
    if (!isRecord6(page)) return page;
    const locator = safeRelativePath(page.path) || `invalid-${index + 1}`;
    const type = isPageType(page.type) ? page.type : "page";
    const migrated = {
      ...page,
      id: typeof page.id === "string" && page.id.trim() ? page.id : deterministicId(type, locator),
      title: typeof page.title === "string" && page.title.trim() ? page.title : path6.posix.basename(locator).replace(/\.canvas\.jsonl$/, "")
    };
    migrated.route = pageRoute(migrated);
    return migrated;
  });
  const siteStore = new SiteCatalog(root);
  const usedIds = new Set(pages.map((page) => isRecord6(page) ? page.id : void 0).filter((id) => typeof id === "string"));
  for (const site of siteStore.list()) {
    const id = deterministicId("site", site.id);
    if (usedIds.has(id)) continue;
    usedIds.add(id);
    pages.push({ id, type: "site", siteId: site.id, title: site.title, route: `/sites/${encodeURIComponent(site.id)}` });
  }
  const groupsByTitle = /* @__PURE__ */ new Map();
  for (const candidate of pages) {
    const page = record(candidate);
    const key = legacyGroupKey(page);
    if (!key) continue;
    const title = key.split("/").join(" / ");
    if (!groupsByTitle.has(title)) groupsByTitle.set(title, []);
    if (typeof page.id === "string") groupsByTitle.get(title)?.push(page.id);
  }
  const legacyGroups = [...groupsByTitle].map(([title, pageIds]) => ({
    id: deterministicId("section", title.toLowerCase()),
    title,
    pageIds
  }));
  return {
    ...legacyRecord,
    formatVersion: 2,
    pages,
    navigation: createDefaultNavigation(navigationPages(pages.filter(isRecord6).map(record)), { legacyGroups })
  };
}
function listFilesRecursively(directory, predicate, results = [], authorizedRoot = directory) {
  try {
    if (!isInside(canonicalRoot(authorizedRoot), fs6.realpathSync.native(directory))) return results;
  } catch {
    return results;
  }
  if (!isDirectory3(directory)) return results;
  let entries = [];
  try {
    entries = fs6.readdirSync(directory, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") && !entry.name.endsWith(".folder")) continue;
    if (entry.name.startsWith("_")) continue;
    const absolute = path6.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory() && !artifactKindForDirectory(entry.name)) listFilesRecursively(absolute, predicate, results, authorizedRoot);
    else if (entry.isFile() && predicate(entry.name, absolute)) results.push(absolute);
  }
  return results;
}
function readCanvasTitle(filePath, { fallbackName = true } = {}) {
  try {
    const lines = fs6.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index];
      if (line === void 0) continue;
      const event = JSON.parse(line);
      if (!isRecord6(event)) continue;
      const settings = record(event.settings);
      const settingsTitle = event.event === "settings_updated" ? stringField(settings, "title") : void 0;
      if (settingsTitle?.trim()) return settingsTitle.trim();
      if (typeof event.title === "string" && event.title.trim()) return event.title.trim();
    }
  } catch {
  }
  return fallbackName ? path6.basename(filePath).replace(/\.canvas\.jsonl$/, "") : "";
}
function readPrototypeTitle(directory) {
  let entries = [];
  try {
    entries = fs6.readdirSync(directory, { withFileTypes: true });
  } catch {
    return path6.basename(directory);
  }
  const metadata = entries.find((entry) => entry.isFile() && (entry.name.endsWith(".prototype.json") || entry.name.endsWith(".prototype.jsonc")));
  if (metadata) {
    try {
      const errors = [];
      const value = parseJsonc3(fs6.readFileSync(path6.join(directory, metadata.name), "utf8"), errors);
      if (errors.length) return path6.basename(directory);
      const title = isRecord6(value) ? stringField(record(value.meta), "title") : void 0;
      if (title?.trim()) return title.trim();
    } catch {
    }
  }
  return path6.basename(directory);
}
function prototypeDirectories(root) {
  const prototypesRoot = path6.join(root, NOTEBOOK_DIRECTORIES.prototypes);
  const directories = [];
  const walkLegacyGroups = (directory) => {
    try {
      if (!isInside(canonicalRoot(root), fs6.realpathSync.native(directory))) return;
    } catch {
      return;
    }
    let entries = [];
    try {
      entries = fs6.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith("_") || entry.isSymbolicLink() || !entry.isDirectory()) continue;
      if (artifactKindForDirectory(entry.name)) continue;
      const target = path6.join(directory, entry.name);
      let children = [];
      try {
        children = fs6.readdirSync(target, { withFileTypes: true });
      } catch {
        continue;
      }
      if (children.some((child) => child.isFile() && (child.name.endsWith(".prototype.json") || /^index\.(jsx|js|tsx|ts)$/.test(child.name)))) {
        directories.push(target);
      }
      if (entry.name.endsWith(".folder") || entry.name === "drafts") walkLegacyGroups(target);
    }
  };
  walkLegacyGroups(prototypesRoot);
  return directories;
}
function appendDiscoveredPages(navigation, pages, addedPages) {
  if (!addedPages.length) return normalizeNavigation(navigation, navigationPages(pages)).navigation;
  const current = normalizeNavigation(navigation, navigationPages(pages)).navigation;
  for (const page of addedPages) {
    if (typeof page.id !== "string" || typeof page.type !== "string") continue;
    if (isPageType(page.type)) {
      const order = current.type.order;
      (order[page.type] ??= []).push(page.id);
    }
    current.files.flatOrder.push(page.id);
    current.files.entries.push({ type: "page", pageId: page.id });
  }
  return current;
}
function discoverNotebookPages(root, registeredPages, excludedLocators = /* @__PURE__ */ new Set()) {
  const knownLocators = /* @__PURE__ */ new Set([...excludedLocators, ...registeredPages.flatMap((page) => typeof page.path === "string" ? [page.path.replaceAll("\\", "/")] : [])]);
  const knownSites = new Set(registeredPages.flatMap((page) => page.type === "site" && typeof page.siteId === "string" ? [page.siteId] : []));
  const knownIds = new Set(registeredPages.flatMap((page) => typeof page.id === "string" ? [page.id] : []));
  const discovered = [];
  const add = (page) => {
    const locator = typeof page.path === "string" ? page.path.replaceAll("\\", "/") : null;
    if (locator && knownLocators.has(locator)) return;
    if (typeof page.id === "string" && registeredPages.some((registered) => registered.id === page.id && registered.type === page.type)) {
      if (locator) knownLocators.add(locator);
      return;
    }
    if (page.type === "site" && typeof page.siteId === "string" && knownSites.has(page.siteId)) return;
    let id = typeof page.id === "string" ? page.id : deterministicId(String(page.type || "page"), locator || page.title || "");
    while (knownIds.has(id)) id = `${id}-next`;
    page.id = id;
    knownIds.add(id);
    if (locator) knownLocators.add(locator);
    if (page.type === "site" && typeof page.siteId === "string") knownSites.add(page.siteId);
    discovered.push(page);
  };
  const canvasRoot = path6.join(root, NOTEBOOK_DIRECTORIES.canvases);
  for (const absolute of listFilesRecursively(canvasRoot, (name) => name.endsWith(".canvas.jsonl"), [], root)) {
    const relative = path6.relative(root, absolute).replaceAll("\\", "/");
    const page = {
      id: deterministicId("canvas", relative),
      type: "canvas",
      title: readCanvasTitle(absolute),
      path: relative
    };
    page.route = pageRoute(page);
    add(page);
  }
  const prototypeRoot = path6.join(root, NOTEBOOK_DIRECTORIES.prototypes);
  for (const absolute of prototypeDirectories(root)) {
    const relative = path6.relative(root, absolute).replaceAll("\\", "/");
    const page = {
      id: deterministicId("prototype", relative),
      type: "prototype",
      title: readPrototypeTitle(absolute),
      path: relative
    };
    page.route = pageRoute(page);
    add(page);
  }
  for (const absolute of listFilesRecursively(prototypeRoot, (name) => name.endsWith(".canvas.jsonl"), [], root)) {
    const relative = path6.relative(root, absolute).replaceAll("\\", "/");
    const page = {
      id: deterministicId("canvas", relative),
      type: "canvas",
      title: readCanvasTitle(absolute),
      path: relative,
      route: null
    };
    add(page);
  }
  const catalog = discoverNotebookArtifacts(root, registeredPages);
  const catalogSiteIds = /* @__PURE__ */ new Set();
  for (const artifact of catalog.artifacts) {
    if (artifact.kind === "site" && artifact.payloadPath) {
      try {
        catalogSiteIds.add(readSiteDescriptorFile(path6.join(root, artifact.payloadPath)).id);
      } catch {
      }
    }
    if (!artifact.available) continue;
    if (artifact.kind === "site") {
      if (!artifact.payloadPath || !artifact.route) continue;
      try {
        const site = readSiteDescriptorFile(path6.join(root, artifact.payloadPath));
        add({
          id: artifact.id,
          type: "site",
          siteId: site.id,
          title: artifact.title,
          route: artifact.route
        });
      } catch {
      }
      continue;
    }
    const pagePath = artifact.kind === "canvas" ? artifact.payloadPath : artifact.folderPath;
    if (!pagePath) continue;
    const page = {
      id: artifact.id,
      type: artifact.kind,
      title: artifact.title,
      path: pagePath,
      route: artifact.route
    };
    add(page);
  }
  for (const site of new SiteCatalog(root).list()) {
    if (catalogSiteIds.has(site.id)) continue;
    add({
      id: deterministicId("site", site.id),
      type: "site",
      siteId: site.id,
      title: site.title || site.id,
      route: `/sites/${encodeURIComponent(site.id)}`
    });
  }
  return discovered;
}
function validateManifestShape(manifest) {
  const diagnostics = [];
  if (!isRecord6(manifest)) {
    return [diagnostic2("INVALID_MANIFEST", "Notebook manifest must be a JSON object.", NOTEBOOK_MANIFEST_FILE)];
  }
  if (manifest.formatVersion !== NOTEBOOK_FORMAT_VERSION) {
    const code = Number(manifest.formatVersion) > NOTEBOOK_FORMAT_VERSION ? "UNSUPPORTED_VERSION" : "INVALID_VERSION";
    diagnostics.push(diagnostic2(code, `Notebook formatVersion must be ${NOTEBOOK_FORMAT_VERSION}.`, NOTEBOOK_MANIFEST_FILE));
  }
  if (typeof manifest.id !== "string" || manifest.id.trim() === "") {
    diagnostics.push(diagnostic2("MISSING_NOTEBOOK_ID", "Notebook manifest requires a stable id.", NOTEBOOK_MANIFEST_FILE));
  }
  if (typeof manifest.title !== "string" || manifest.title.trim() === "") {
    diagnostics.push(diagnostic2("MISSING_NOTEBOOK_TITLE", "Notebook manifest requires a title.", NOTEBOOK_MANIFEST_FILE));
  }
  if (!Array.isArray(manifest.pages)) {
    diagnostics.push(diagnostic2("INVALID_PAGES", "Notebook manifest pages must be an array.", NOTEBOOK_MANIFEST_FILE));
  }
  return diagnostics;
}
function validatePages(root, manifest) {
  const diagnostics = [];
  const pages = [];
  const ids = /* @__PURE__ */ new Set();
  const manifestPages = record(manifest).pages;
  if (!Array.isArray(manifestPages)) return { pages, diagnostics };
  for (const [index, candidate] of manifestPages.entries()) {
    const pageRecord = isRecord6(candidate) ? candidate : null;
    const page = pageRecord ?? {};
    const pagePath = page.path;
    const relativePath2 = safeRelativePath(pagePath);
    const pageDiagnostics = [];
    if (!pageRecord) {
      pageDiagnostics.push(diagnostic2("INVALID_PAGE", `Page ${index + 1} must be an object.`, `pages[${index}]`));
    } else {
      if (typeof page.id !== "string" || page.id.trim() === "") {
        pageDiagnostics.push(diagnostic2("MISSING_PAGE_ID", `Page ${index + 1} requires a stable id.`, `pages[${index}].id`));
      } else if (ids.has(page.id)) {
        pageDiagnostics.push(diagnostic2("DUPLICATE_PAGE_ID", `Page id "${page.id}" is used more than once.`, `pages[${index}].id`));
      } else {
        ids.add(page.id);
      }
      if (!isPageType(page.type)) {
        pageDiagnostics.push(diagnostic2("UNKNOWN_PAGE_TYPE", `Page type must be prototype, canvas, or site.`, `pages[${index}].type`));
      }
      if (typeof page.title !== "string" || page.title.trim() === "") {
        pageDiagnostics.push(diagnostic2("MISSING_PAGE_TITLE", `Page "${page.id || index + 1}" requires a title.`, `pages[${index}].title`));
      }
      if (page.type === "site") {
        if (typeof page.siteId !== "string" || !page.siteId.trim() || page.path !== void 0) {
          pageDiagnostics.push(diagnostic2("INVALID_SITE_REFERENCE", `Site page "${page.id || index + 1}" requires a siteId and cannot have a payload path.`, `pages[${index}]`));
        }
      } else if (!relativePath2 || !pagePathIsValid(page.type, relativePath2)) {
        const prototypeCanvas = page.type === "canvas" && relativePath2?.startsWith(`${NOTEBOOK_DIRECTORIES.prototypes}/`);
        pageDiagnostics.push(diagnostic2(
          prototypeCanvas ? "UNSUPPORTED_CANVAS_LOCATION" : "INVALID_PAGE_PATH",
          prototypeCanvas ? "Canvas pages cannot be registered inside a Prototype; the deprecated workspace can still read this legacy path." : `Page path must stay under canvas/ or prototypes/ and match its page type.`,
          `pages[${index}].path`
        ));
      }
    }
    const isSite = page.type === "site";
    const siteDescriptor = isSite && typeof page.siteId === "string" ? new SiteCatalog(root).get(page.siteId) : null;
    if (isSite && !siteDescriptor) {
      pageDiagnostics.push(diagnostic2("MISSING_SITE_DESCRIPTOR", `Site "${page.siteId}" is not registered in the local Site store.`, typeof page.siteId === "string" ? page.siteId : null));
    }
    const payload = relativePath2 && !isSite ? payloadState(root, relativePath2, page.type) : { available: false, unsafe: false };
    const payloadTitle = page.type === "canvas" && payload.available && relativePath2 ? readCanvasTitle(path6.join(root, relativePath2), { fallbackName: false }) : "";
    if (payload.unsafe) {
      pageDiagnostics.push(diagnostic2("UNSAFE_PAGE_PATH", `Page payload resolves outside the Notebook: ${relativePath2}.`, relativePath2));
    }
    const available = isSite ? Boolean(siteDescriptor) : payload.available;
    if (relativePath2 && !isSite && !available) {
      pageDiagnostics.push(diagnostic2("MISSING_PAGE_PAYLOAD", `Page payload is missing: ${relativePath2}.`, relativePath2));
    }
    diagnostics.push(...pageDiagnostics);
    pages.push({
      ...pageRecord ?? {},
      ...payloadTitle ? { title: payloadTitle } : {},
      index,
      path: relativePath2 || (typeof pagePath === "string" ? pagePath : null),
      route: pageRoute(page || {}),
      ...siteDescriptor ? {
        title: typeof page?.title === "string" && page.title.trim() ? page.title : siteDescriptor.title,
        productionUrl: record(siteDescriptor.deployments)[String(siteDescriptor.defaultDeployment)] && typeof record(record(siteDescriptor.deployments)[String(siteDescriptor.defaultDeployment)]).baseUrl === "string" ? String(record(record(siteDescriptor.deployments)[String(siteDescriptor.defaultDeployment)]).baseUrl) : null
      } : {},
      available: available && pageDiagnostics.length === 0,
      diagnostics: pageDiagnostics
    });
  }
  const routes = /* @__PURE__ */ new Map();
  for (const page of pages) {
    if (!page.route) continue;
    const routePages = routes.get(page.route);
    if (routePages) routePages.push(page);
    else routes.set(page.route, [page]);
  }
  for (const [route, matches] of routes) {
    if (matches.length < 2) continue;
    for (const page of matches) {
      const item = diagnostic2("PAGE_ROUTE_CONFLICT", `Page route "${route}" is shared by multiple registered pages; explicitly resolve the conflict.`, typeof page.path === "string" ? page.path : typeof page.siteId === "string" ? page.siteId : null);
      page.diagnostics.push(item);
      diagnostics.push(item);
      page.available = false;
    }
  }
  return { pages, diagnostics };
}
function enforceArtifactPageRules(pages, artifacts, diagnostics) {
  for (const page of pages) {
    const artifact = artifacts.find((item) => item.kind === page.type && (item.id === page.id || page.path === item.folderPath || page.path === item.payloadPath));
    const nested = diagnostics.find((item) => item.code === "NESTED_ARTIFACT" && item.nestedArtifact && typeof page.path === "string" && (page.path === item.nestedArtifact.path || page.path.startsWith(`${item.nestedArtifact.path}/`)));
    const artifactIssues = artifact?.diagnostics.filter((item) => [
      "INVALID_ARTIFACT_IDENTITY",
      "MALFORMED_ARTIFACT_PAYLOAD",
      "AMBIGUOUS_CANVAS_PAYLOAD",
      "DUPLICATE_ARTIFACT_ID",
      "ARTIFACT_ROUTE_CONFLICT",
      "UNREPRESENTABLE_ARTIFACT_ROUTE",
      "INVALID_EXTERNAL_PROTOTYPE_URL"
    ].includes(item.code)) || [];
    if (nested) {
      page.route = null;
      page.available = false;
      page.diagnostics.push(nested);
    }
    if (artifact && !artifact.available) {
      page.available = false;
      page.route = null;
      page.diagnostics.push(...artifactIssues);
    }
  }
}
function prototypeOwner(relativePath2) {
  const segments = String(relativePath2 || "").replaceAll("\\", "/").split("/").filter(Boolean);
  if (segments[0] === NOTEBOOK_DIRECTORIES.prototypes) segments.shift();
  return segments.find((segment) => segment !== "drafts" && !segment.endsWith(".folder") && !segment.startsWith("_")) || null;
}
function prototypeDataScopeConflicts(root, pages) {
  const prototypeRoot = path6.join(root, NOTEBOOK_DIRECTORIES.prototypes);
  const files = listFilesRecursively(prototypeRoot, (name) => /\.(flow|scene|object|record)\.jsonc?$/.test(name), [], root);
  const declarations = /* @__PURE__ */ new Map();
  for (const absolute of files) {
    const relative = path6.relative(root, absolute).replaceAll("\\", "/");
    const match = path6.basename(absolute).match(/^(.+)\.(flow|scene|object|record)\.jsonc?$/);
    const owner = prototypeOwner(relative);
    if (!match || !owner) continue;
    const suffix = match[2] === "scene" ? "flow" : match[2];
    const key = `${owner}/${match[1]}.${suffix}`;
    const declarationPaths = declarations.get(key);
    if (declarationPaths) declarationPaths.push(relative);
    else declarations.set(key, [relative]);
  }
  const diagnostics = [];
  const affectedOwners = /* @__PURE__ */ new Map();
  for (const [key, paths] of declarations) {
    if (paths.length < 2) continue;
    const owner = key.slice(0, key.indexOf("/"));
    const ownerConflicts = affectedOwners.get(owner);
    if (ownerConflicts) ownerConflicts.push({ key, paths });
    else affectedOwners.set(owner, [{ key, paths }]);
  }
  for (const page of pages) {
    if (page.type !== "prototype") continue;
    const owner = prototypeOwner(page.path);
    const conflicts = owner ? affectedOwners.get(owner) || [] : [];
    for (const conflict of conflicts) {
      const item = diagnostic2(
        "PROTOTYPE_DATA_SCOPE_CONFLICT",
        `Prototype data key "${conflict.key}" is declared in multiple payload files; resolve the conflict before using this Prototype.`,
        page.path
      );
      page.diagnostics.push(item);
      page.available = false;
      diagnostics.push(item);
    }
  }
  return diagnostics;
}
function customDraftIgnoreDiagnostics(root) {
  const file = path6.join(root, ".gitignore");
  if (!isFile3(file)) return [];
  if (!isInside(canonicalRoot(root), fs6.realpathSync.native(file))) return [diagnostic2("UNSAFE_NOTEBOOK_PATH", ".gitignore resolves outside the Notebook.", ".gitignore")];
  const recognized = /* @__PURE__ */ new Set([
    "assets/canvas/images/drafts/",
    "src/canvas/**/drafts/",
    "src/prototypes/**/drafts/"
  ]);
  const lines = fs6.readFileSync(file, "utf8").split(/\r?\n/);
  return lines.flatMap((line, index) => {
    const rule = line.trim();
    if (!rule || rule.startsWith("#") || rule.startsWith("!") || !rule.includes("drafts")) return [];
    if (recognized.has(rule)) return [diagnostic2(
      "CUSTOM_DRAFT_EXCLUSION",
      `Recognized legacy rule "${rule}" excludes content under drafts/; the notebook scaffold will remove it.`,
      `.gitignore:${index + 1}`
    )];
    return [diagnostic2(
      "CUSTOM_DRAFT_EXCLUSION",
      `Custom .gitignore rule "${rule}" may exclude registered content under drafts/; remove or narrow the rule explicitly.`,
      `.gitignore:${index + 1}`
    )];
  });
}
function readManifest(root) {
  const manifestPath = resolveNotebookManifestPath(root);
  if (!isFile3(manifestPath)) {
    return { manifest: null, diagnostics: [diagnostic2("MISSING_MANIFEST", `Missing ${NOTEBOOK_MANIFEST_FILE}.`, NOTEBOOK_MANIFEST_FILE)] };
  }
  try {
    if (!isInside(canonicalRoot(root), fs6.realpathSync.native(manifestPath))) return { manifest: null, diagnostics: [diagnostic2("UNSAFE_NOTEBOOK_PATH", "Notebook manifest resolves outside the Notebook.", NOTEBOOK_MANIFEST_FILE)] };
    return { manifest: JSON.parse(fs6.readFileSync(manifestPath, "utf8")), diagnostics: [] };
  } catch (error) {
    return {
      manifest: null,
      diagnostics: [diagnostic2("MALFORMED_MANIFEST", `Could not parse ${NOTEBOOK_MANIFEST_FILE}: ${errorMessage2(error)}.`, NOTEBOOK_MANIFEST_FILE)]
    };
  }
}
function notebookManifest({ id = makeId(), title = "Notebook", pages = [] } = {}) {
  return {
    formatVersion: NOTEBOOK_FORMAT_VERSION,
    id,
    title,
    pages,
    navigation: createDefaultNavigation(pages)
  };
}
function notebookPaths(root, { notebook } = {}) {
  const notebookRoot = canonicalRoot(root);
  const runtimeDir = resolveRuntimeDir(notebookRoot);
  return {
    root: notebookRoot,
    manifest: resolveNotebookManifestPath(notebookRoot),
    canvasConfig: resolveNotebookConfigWritePath(notebookRoot, NOTEBOOK_CANVAS_CONFIG_FILE),
    configFiles: [...NOTEBOOK_CONFIG_FILE_NAMES, NOTEBOOK_CANVAS_CONFIG_FILE, LEGACY_CANVAS_CONFIG_FILE].flatMap((filename) => [
      path6.join(notebookRoot, filename),
      path6.join(notebookRoot, "config", filename),
      path6.join(notebookRoot, NOTEBOOK_MANIFEST_DIR, filename)
    ]),
    runtime: runtimeDir,
    siteConfig: path6.join(notebookRoot, siteConfigRelativePath(notebookRoot)),
    canvases: path6.join(notebookRoot, NOTEBOOK_DIRECTORIES.canvases),
    prototypes: path6.join(notebookRoot, NOTEBOOK_DIRECTORIES.prototypes),
    widgets: resolveNotebookSupportPath(notebookRoot, NOTEBOOK_DIRECTORIES.widgets, { fresh: !hasNotebookManifest(notebookRoot) }),
    tools: resolveNotebookSupportPath(notebookRoot, NOTEBOOK_DIRECTORIES.tools, { fresh: !hasNotebookManifest(notebookRoot) }),
    components: path6.join(notebookRoot, NOTEBOOK_DIRECTORIES.components),
    data: resolveNotebookContentDirectory(notebookRoot, "data", { notebook: notebook ?? hasNotebookManifest(notebookRoot) }),
    assets: resolveNotebookContentDirectory(notebookRoot, "assets", { notebook: notebook ?? hasNotebookManifest(notebookRoot) }),
    publish: path6.join(notebookRoot, NOTEBOOK_DIRECTORIES.publish)
  };
}
function inspectNotebook(root) {
  return withSiteCatalogSnapshot(() => readNotebookSnapshot(root));
}
function readNotebookSnapshot(root) {
  const paths = notebookPaths(root);
  if (!isDirectory3(paths.root)) {
    return {
      status: "unavailable",
      root: paths.root,
      manifest: null,
      pages: [],
      artifacts: [],
      diagnostics: [diagnostic2("ROOT_NOT_FOUND", `Notebook folder does not exist: ${paths.root}.`)]
    };
  }
  const portable = readPortableCatalog(paths.root);
  const { manifest: sourceManifest, diagnostics: readDiagnostics } = readManifest(paths.root);
  const manifestAbsent = readDiagnostics.some((item) => item.code === "MISSING_MANIFEST");
  const inMemoryManifest = manifestAbsent && (portable.artifacts.length > 0 || discoverNotebookArtifacts(paths.root, [], portable.claimedLocators).artifacts.length > 0 || discoverNotebookPages(paths.root, []).length > 0);
  const manifestDiagnostics = inMemoryManifest ? [] : readDiagnostics;
  const sourceRecord = record(sourceManifest);
  const needsMigration = sourceRecord.formatVersion === 1;
  const migratedManifest = inMemoryManifest ? notebookManifest({ id: portableNotebookId(paths.root), title: path6.basename(paths.root), pages: [] }) : migrateManifestV1(paths.root, sourceManifest);
  const migratedRecord = isRecord6(migratedManifest) ? migratedManifest : null;
  const superseded = supersededRegistrations(portable.artifacts, (Array.isArray(migratedRecord?.pages) ? migratedRecord.pages : []).filter(isRecord6).map(record));
  const registeredValues = (Array.isArray(migratedRecord?.pages) ? migratedRecord.pages : []).filter((value) => !isRecord6(value) || superseded.pages.includes(record(value)));
  const registeredPages = registeredValues.filter(isRecord6).map(record);
  const artifactCatalog = discoverNotebookArtifacts(paths.root, registeredPages, portable.claimedLocators);
  const reconciledRegisteredValues = registeredValues.map((value) => {
    const page = record(value);
    const artifact = artifactCatalog.artifacts.find((candidate) => candidate.kind === page.type && (candidate.id === page.id || candidate.folderPath === String(page.path || "").replaceAll("\\", "/") || candidate.payloadPath === String(page.path || "").replaceAll("\\", "/") || candidate.kind === "site" && page.type === "site" && candidate.route === `/sites/${encodeURIComponent(String(page.siteId || ""))}`));
    if (!artifact) return value;
    if (artifact.kind === "site") return page.route === artifact.route ? value : { ...page, route: artifact.route };
    const pagePath = artifact.kind === "canvas" ? artifact.payloadPath : artifact.folderPath;
    if (!pagePath) return value;
    if (page.id === artifact.id && page.path === pagePath && page.title === artifact.title && page.route === artifact.route) return value;
    return { ...page, id: artifact.id, path: pagePath, title: artifact.title, route: artifact.route };
  });
  const reconciledRegisteredPages = reconciledRegisteredValues.filter(isRecord6).map(record);
  const discoveredPages = migratedRecord?.formatVersion === NOTEBOOK_FORMAT_VERSION ? discoverNotebookPages(paths.root, reconciledRegisteredPages, portable.claimedLocators) : [];
  const needsPageRegistration = discoveredPages.length > 0 || reconciledRegisteredValues.some((value, index) => value !== registeredValues[index]);
  const legacyManifest = migratedRecord && migratedRecord.formatVersion === NOTEBOOK_FORMAT_VERSION ? {
    ...migratedRecord,
    pages: [...reconciledRegisteredValues, ...discoveredPages],
    navigation: appendDiscoveredPages(migratedRecord.navigation, reconciledRegisteredPages, discoveredPages)
  } : migratedManifest;
  const shapeDiagnostics = validateManifestShape(legacyManifest);
  const { pages: legacyPages, diagnostics: pageDiagnostics } = validatePages(paths.root, legacyManifest);
  enforceArtifactPageRules(legacyPages, artifactCatalog.artifacts, artifactCatalog.diagnostics);
  const conflictDiagnostics = [
    ...superseded.diagnostics,
    ...reportMarkerConflicts(paths.root, portable.artifacts),
    ...reportCrossCatalogConflicts([...portable.artifacts, ...artifactCatalog.artifacts])
  ];
  const portableEntries = portablePageRecords(portable.artifacts);
  const portableManifestPages = portableEntries.map((entry) => entry.record);
  const portableNotebookPages = portableEntries.map(({ record: pageRecord, artifact }, offset) => ({
    ...pageRecord,
    index: legacyPages.length + offset,
    route: artifact.route,
    available: artifact.available,
    diagnostics: artifact.diagnostics
  }));
  const pages = [...legacyPages, ...portableNotebookPages];
  const reconciledRecord = record(legacyManifest);
  const navigationWithPortable = portableManifestPages.length && reconciledRecord.formatVersion === NOTEBOOK_FORMAT_VERSION ? appendDiscoveredPages(reconciledRecord.navigation, legacyPages.map(record), portableManifestPages) : reconciledRecord.navigation;
  const normalizedNavigation = normalizeNavigation(navigationWithPortable, navigationPages(pages));
  const needsNavigationRepair = migratedRecord?.formatVersion === 2 && (!migratedRecord.navigation || !normalizedNavigation.valid);
  const manifest = reconciledRecord.formatVersion === NOTEBOOK_FORMAT_VERSION ? { ...reconciledRecord, pages: [...Array.isArray(reconciledRecord.pages) ? reconciledRecord.pages : [], ...portableManifestPages], navigation: normalizedNavigation.navigation } : legacyManifest;
  const navigationDiagnostics = normalizedNavigation.diagnostic ? [normalizedNavigation.diagnostic] : [];
  const sites = listSiteFiles(paths.root);
  const dataScopeDiagnostics = prototypeDataScopeConflicts(paths.root, legacyPages);
  const gitignoreDiagnostics = customDraftIgnoreDiagnostics(paths.root);
  const artifacts = [...artifactCatalog.artifacts, ...portable.artifacts].sort((left, right) => left.folderPath.localeCompare(right.folderPath, "en"));
  const diagnostics = [.../* @__PURE__ */ new Set([
    ...manifestDiagnostics,
    ...shapeDiagnostics,
    ...artifactCatalog.diagnostics,
    ...portable.diagnostics,
    ...conflictDiagnostics,
    ...pageDiagnostics,
    ...dataScopeDiagnostics,
    ...navigationDiagnostics,
    ...gitignoreDiagnostics
  ])];
  const hasMissingPayload = diagnostics.some(({ code }) => code === "MISSING_PAGE_PAYLOAD" || code === "MISSING_SITE_DESCRIPTOR");
  const hasStructuralError = diagnostics.some((item) => !RECOVERABLE_PAGE_DIAGNOSTICS.has(item.code) && item.code !== "INVALID_NAVIGATION" && item.source !== FIRST_LOOK_DIAGNOSTIC_SOURCE);
  if (hasStructuralError || !isNotebookManifest(manifest)) {
    return {
      status: "invalid",
      root: paths.root,
      manifest: isRecord6(manifest) ? manifest : null,
      pages,
      artifacts,
      diagnostics,
      sites,
      hasMissingPayload,
      needsMigration,
      needsPageRegistration,
      needsNavigationRepair
    };
  }
  return {
    status: "valid",
    root: paths.root,
    manifest: { ...manifest, navigation: normalizedNavigation.navigation },
    pages,
    artifacts,
    sites,
    diagnostics,
    hasMissingPayload,
    needsMigration,
    needsPageRegistration,
    needsNavigationRepair
  };
}
function listSiteFiles(root) {
  const sites = new SiteCatalog(root).listEntries();
  const configRel = siteConfigRelativePath(root);
  const hasUnifiedConfig = isFile3(path6.join(root, configRel));
  return sites.map(({ site, folderPath }) => ({
    id: site.id,
    path: folderPath ? siteDescriptorRelativePath(folderPath) : hasUnifiedConfig || !isFile3(path6.join(root, LEGACY_SITE_DIRECTORY, `${site.id}.site.json`)) ? configRel : `${LEGACY_SITE_DIRECTORY}/${site.id}.site.json`
  }));
}

// packages/storyboard/src/core/notebook/docs/catalog.node.ts
import path7 from "node:path";
function documentCatalog(snapshot, { sites = [] } = {}) {
  const documents = snapshot.artifacts.filter((artifact) => artifact.kind === "doc").map((artifact) => {
    const payload = artifact.payloadPath || artifact.descriptorPath || artifact.folderPath;
    const id = isFirstLookId(artifact.id) ? artifact.id : `invalid:${payload}`;
    return {
      ...structuredClone(artifact),
      id,
      type: "doc",
      kind: "doc",
      portable: true,
      path: payload,
      payloadPath: payload,
      folderPath: path7.posix.dirname(payload) === "." ? "" : path7.posix.dirname(payload),
      route: artifact.route || `/docs/${encodeURIComponent(id)}`,
      metadata: structuredClone(artifact.descriptor || {}),
      diagnostics: artifact.diagnostics.map((item) => ({ ...item, path: item.path || payload }))
    };
  });
  const artifacts = snapshot.artifacts.filter((artifact) => artifact.kind !== "doc").map((artifact) => structuredClone(artifact));
  for (const page of snapshot.pages) {
    if (page.type === "doc" || typeof page.id !== "string") continue;
    const existing = artifacts.find((artifact) => artifact.id === page.id && (artifact.folderPath === page.path || artifact.payloadPath === page.path));
    if (existing) continue;
    const site = page.type === "site" && typeof page.siteId === "string" ? sites.find((site2) => site2.id === page.siteId) : null;
    artifacts.push({
      ...structuredClone(page),
      id: page.type === "site" && typeof page.siteId === "string" ? page.siteId : page.id,
      ...page.type === "site" ? { descriptor: { published: { url: site?.productionBaseUrl ?? page.productionUrl }, local: { developmentUrl: site?.binding?.developmentBaseUrl } } } : {}
    });
  }
  return { documents, artifacts };
}

// packages/storyboard/src/core/notebook/routes.node.ts
import fs7 from "node:fs";
import path8 from "node:path";
import { globSync } from "glob";
function containedFile(root, file) {
  try {
    const relative = path8.relative(fs7.realpathSync.native(root), fs7.realpathSync.native(file));
    return relative !== ".." && !relative.startsWith(`..${path8.sep}`) && !path8.isAbsolute(relative) && fs7.statSync(file).isFile();
  } catch {
    return false;
  }
}
function routeFiles(root, pattern, { allowPrivateAncestors = false } = {}) {
  return globSync(pattern, {
    cwd: root,
    absolute: true
  }).filter((file) => {
    if (!containedFile(root, file)) return false;
    const name = path8.basename(file);
    const segments = path8.relative(root, file).split(path8.sep);
    if (!allowPrivateAncestors && segments.slice(0, -1).some((segment) => segment.startsWith("_"))) return false;
    return !name.startsWith("_") || /^_layout\.(jsx|tsx|mdx)$/.test(name);
  });
}
function nestedArtifactPath(relative) {
  return relative.split("/").slice(0, -1).some((segment) => /\.(prototype|component|canvas|site)$/.test(segment));
}
function innerPrivatePath(insideArtifact) {
  return insideArtifact.split("/").slice(0, -1).some((segment) => segment.startsWith("_"));
}
function artifactBoundaryPath(relative) {
  return relative.split("/").some((segment) => /\.(prototype|component|canvas|site)$/.test(segment));
}
function addRouteModule(target, collisions, key, file) {
  if (collisions.has(key)) return;
  const existing = target.get(key);
  if (existing && existing !== file) {
    target.delete(key);
    collisions.add(key);
    return;
  }
  target.set(key, file);
}
function flowRouteKey(route, prefix = "") {
  const routePath = route.trim().replace(/^\/+|\/+$/g, "");
  if (!routePath || routePath.split("/").some((segment) => segment === "." || segment === "..")) return null;
  return `/src/prototypes/${prefix ? `${prefix}/` : ""}${routePath}/index.jsx`;
}
function declaredRouteKeys(directory, relative, artifactPrefix = "") {
  const flowFiles = globSync("*.flow.json", { cwd: directory, absolute: true }).filter((file) => containedFile(directory, file));
  const routes = flowFiles.map((file) => {
    try {
      const value = JSON.parse(fs7.readFileSync(file, "utf8"));
      return value !== null && typeof value === "object" && typeof value.route === "string" ? value.route : null;
    } catch {
      return null;
    }
  }).filter((route) => typeof route === "string" && route.trim().length > 0);
  if (routes.length === 0) return [artifactPrefix ? `/src/prototypes/${artifactPrefix}/index.jsx` : `/src/${relative}`];
  if (artifactPrefix) {
    const rootKey = `/src/prototypes/${artifactPrefix}/index.jsx`;
    return [rootKey, ...new Set(routes.map((route) => flowRouteKey(route, artifactPrefix)).filter((key) => key !== null))];
  }
  return [.../* @__PURE__ */ new Set([`/src/${relative}`, ...routes.map((route) => flowRouteKey(route)).filter((key) => key !== null)])];
}
function moduleMap(root, pattern, artifacts) {
  const modalOnly = pattern === "modals";
  const modules = /* @__PURE__ */ new Map();
  const collisions = /* @__PURE__ */ new Set();
  const addFile = (file, relative, artifactPrefix = "", artifactDirectory = "") => {
    const name = path8.basename(file);
    if (name.endsWith(".view.tsx") || (modalOnly ? !name.startsWith("+") : name.startsWith("+"))) return;
    const keys = artifactPrefix ? [`/src/prototypes/${artifactPrefix}/${path8.relative(artifactDirectory, file).replaceAll(path8.sep, "/")}`] : path8.basename(file).startsWith("index.") ? declaredRouteKeys(path8.dirname(file), relative) : [`/src/${relative}`];
    const artifactKeys = artifactPrefix && path8.basename(file).startsWith("index.") ? declaredRouteKeys(path8.dirname(file), relative, artifactPrefix) : keys;
    for (const key of artifactKeys) addRouteModule(modules, collisions, key, file);
  };
  for (const file of routeFiles(root, "prototypes/**/*.{jsx,tsx,mdx}")) {
    const relative = path8.relative(root, file).replaceAll(path8.sep, "/");
    if (artifactBoundaryPath(relative)) continue;
    addFile(file, relative);
  }
  for (const artifact of artifacts) {
    if (artifact.kind !== "prototype" || !artifact.available) continue;
    if (artifact.portable === true) continue;
    const artifactName = path8.posix.basename(artifact.folderPath);
    const route = `/${encodeURIComponent(artifactName)}`;
    if (artifact.route !== route) continue;
    const directory = path8.join(root, ...artifact.folderPath.split("/"));
    for (const file of routeFiles(directory, "**/*.{jsx,tsx,mdx}", { allowPrivateAncestors: true })) {
      const inner = path8.relative(directory, file).replaceAll(path8.sep, "/");
      if (innerPrivatePath(inner)) continue;
      if (nestedArtifactPath(inner)) continue;
      const relative = `${artifact.folderPath}/${inner}`;
      addFile(file, relative, artifactName, directory);
    }
  }
  return [...modules.entries()].map(([key, file]) => `${JSON.stringify(key)}: () => import(${JSON.stringify(file)})`).join(",\n");
}
function storyboardViewMap(root, artifacts) {
  const views = /* @__PURE__ */ new Map();
  for (const file of globSync("prototypes/**/*.view.tsx", { cwd: root, absolute: true }).sort()) {
    if (!containedFile(root, file)) continue;
    const relative = path8.relative(path8.join(root, "prototypes"), file).replaceAll(path8.sep, "/");
    if (!artifactBoundaryPath(relative)) views.set(relative.replace(/\.view\.tsx$/, ""), file);
  }
  for (const artifact of artifacts) {
    if (artifact.kind !== "prototype" || !artifact.available) continue;
    const directory = path8.join(root, ...artifact.folderPath.split("/"));
    for (const file of globSync("**/*.view.tsx", { cwd: directory, absolute: true }).sort()) {
      if (!containedFile(root, file)) continue;
      const relative = path8.relative(directory, file).replaceAll(path8.sep, "/");
      if (innerPrivatePath(relative) || nestedArtifactPath(relative)) continue;
      const id = `${path8.posix.basename(artifact.folderPath)}/${relative.replace(/\.view\.tsx$/, "")}`;
      if (!views.has(id)) views.set(id, file);
    }
  }
  return [...views].map(([id, file]) => `${JSON.stringify(id)}: () => import(${JSON.stringify(file)})`).join(",\n");
}
function routeRootsFromModuleMap(source) {
  const roots = /* @__PURE__ */ new Set();
  for (const line of source.split("\n")) {
    const separator = line.indexOf(": () => import(");
    if (separator < 0) continue;
    let key;
    try {
      key = JSON.parse(line.slice(0, separator));
    } catch {
      continue;
    }
    const relative = key.replace(/^\/src\/prototypes\//, "").replace(/\.(jsx|tsx|mdx)$/i, "");
    const first = relative.split("/").filter(Boolean)[0];
    if (first) roots.add(first.toLocaleLowerCase("en-US"));
  }
  return roots;
}
function compileNotebookRoutes({ root, snapshot, applicationRoot }) {
  const notebookRoot = root && fs7.existsSync(root) ? root : null;
  const artifacts = snapshot?.status === "valid" ? snapshot.artifacts : [];
  const externalRoutes = artifacts.flatMap((artifact) => {
    if (artifact.kind !== "prototype" || !artifact.available || !artifact.route || !artifact.externalUrl) return [];
    return [{ artifactId: artifact.id, route: artifact.route, title: artifact.title, url: artifact.externalUrl }];
  });
  const routeAliases = artifacts.flatMap((artifact) => {
    if (artifact.kind !== "prototype" || !artifact.available || !artifact.route) return [];
    return (artifact.migrationAliases?.legacyRoutes || []).map((alias) => ({
      artifactId: artifact.id,
      from: alias.from,
      targetPath: alias.targetPath,
      route: artifact.route
    }));
  });
  const legacyRouteRoots = /* @__PURE__ */ new Set([
    ...routeRootsFromModuleMap(notebookRoot ? moduleMap(notebookRoot, "routes", artifacts) : ""),
    ...routeRootsFromModuleMap(applicationRoot && fs7.existsSync(applicationRoot) ? moduleMap(applicationRoot, "routes", []) : "")
  ]);
  const portableIdCounts = /* @__PURE__ */ new Map();
  for (const artifact of artifacts) {
    if (artifact.portable !== true || typeof artifact.id !== "string") continue;
    const key = artifact.id.toLocaleLowerCase("en-US");
    portableIdCounts.set(key, (portableIdCounts.get(key) ?? 0) + 1);
  }
  const statefullyRoutes = artifacts.flatMap((artifact) => {
    if (artifact.kind !== "prototype" || artifact.portable !== true || !artifact.route) return [];
    const id = decodeURIComponent(artifact.id || "");
    const reserved = RESERVED_PUBLIC_ROUTE_ROOTS.has(id.toLocaleLowerCase("en-US"));
    const duplicate = (portableIdCounts.get(id.toLocaleLowerCase("en-US")) ?? 0) > 1;
    const legacyCollision = legacyRouteRoots.has(id.toLocaleLowerCase("en-US"));
    const collision = reserved || duplicate || legacyCollision;
    const routeDiagnostics = collision ? [...artifact.diagnostics, {
      code: "ARTIFACT_ROUTE_CONFLICT",
      message: reserved ? `Prototype ID "${id}" uses a reserved public route root.` : duplicate ? `Prototype ID "${id}" is duplicated across portable artifacts.` : `Portable Prototype route "${artifact.route}" conflicts with an existing Hypercanvas route. Resolve the conflict before using either route.`,
      severity: "error"
    }] : artifact.diagnostics;
    return [{
      artifactId: artifact.id,
      route: artifact.route,
      title: artifact.title,
      folderPath: artifact.folderPath,
      entry: artifact.entry ?? null,
      runtime: artifact.runtime ?? null,
      available: artifact.available,
      routeConflict: collision,
      diagnostics: routeDiagnostics.map(({ code, message, severity }) => ({ code, message, severity }))
    }];
  });
  const portableSiteRoutes = artifacts.flatMap((artifact) => {
    if (artifact.kind !== "site" || artifact.portable !== true || !artifact.route) return [];
    const descriptor = artifact.descriptor && typeof artifact.descriptor === "object" ? artifact.descriptor : {};
    return [{
      id: artifact.id,
      route: artifact.route,
      title: artifact.title,
      available: artifact.available,
      diagnostics: artifact.diagnostics.map(({ code, message, severity }) => ({ code, message, severity })),
      local: descriptor.local ?? null,
      published: descriptor.published ?? null,
      views: Array.isArray(descriptor.views) ? descriptor.views : []
    }];
  });
  return `export const PROTOTYPE_ROUTES = {${notebookRoot ? `
${moduleMap(notebookRoot, "routes", artifacts)}` : ""}
}
export const PROTOTYPE_EXTERNAL_ROUTES = ${JSON.stringify(externalRoutes)}
export const PROTOTYPE_STATEFULLY_ROUTES = ${JSON.stringify(statefullyRoutes)}
export const PORTABLE_SITE_ROUTES = ${JSON.stringify(portableSiteRoutes)}
export const PROTOTYPE_MODALS = {${notebookRoot ? `
${moduleMap(notebookRoot, "modals", artifacts)}` : ""}
}
export const STORYBOARD_VIEWS = {${notebookRoot ? `
${storyboardViewMap(notebookRoot, artifacts)}` : ""}
}
export const PROTOTYPE_ROUTE_ALIASES = ${JSON.stringify(routeAliases)}`;
}

// packages/storyboard/src/core/notebook/navigation-tree.ts
import fs8 from "node:fs";
import { createHash as createHash2 } from "node:crypto";
import path9 from "node:path";
import ignore from "ignore";

// packages/storyboard/src/core/stores/canvasConfig.ts
var AUTO_PLACE_DEFAULTS = Object.freeze({
  overlap: Object.freeze({
    "overlap-nudge-trigger": 80,
    "overlap-nudge-offset": 0,
    "overlap-place-stationary": false,
    "overlap-place-multiselection": true
  }),
  align: Object.freeze({
    "top-edge-nudge-offset": 80,
    "left-edge-nudge-offset": 80
  })
});
var _autoPlace = normalizeCanvasAutoPlace(void 0);
function record2(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function normalizeCanvasAutoPlace(value, fallback = AUTO_PLACE_DEFAULTS) {
  const source = record2(value);
  const overlap = record2(source?.overlap);
  const align = record2(source?.align);
  const setting = (section, key) => section && Object.hasOwn(section, key) ? section[key] : source?.[key];
  const number = (value2, defaultValue) => typeof value2 === "number" && Number.isFinite(value2) && value2 >= 0 ? value2 : defaultValue;
  const boolean = (value2, defaultValue) => typeof value2 === "boolean" ? value2 : defaultValue;
  return {
    overlap: {
      "overlap-nudge-trigger": number(setting(overlap, "overlap-nudge-trigger"), fallback.overlap["overlap-nudge-trigger"]),
      "overlap-nudge-offset": number(setting(overlap, "overlap-nudge-offset"), fallback.overlap["overlap-nudge-offset"]),
      "overlap-place-stationary": boolean(setting(overlap, "overlap-place-stationary"), fallback.overlap["overlap-place-stationary"]),
      "overlap-place-multiselection": boolean(setting(overlap, "overlap-place-multiselection"), fallback.overlap["overlap-place-multiselection"])
    },
    align: {
      "top-edge-nudge-offset": number(setting(align, "top-edge-nudge-offset"), fallback.align["top-edge-nudge-offset"]),
      "left-edge-nudge-offset": number(setting(align, "left-edge-nudge-offset"), fallback.align["left-edge-nudge-offset"])
    }
  };
}

// packages/storyboard/src/core/session/notebookView.ts
var DEFAULT_NOTEBOOK_BROWSER_LINK = Object.freeze({
  mode: "hidden",
  showTools: false
});
function normalizeNotebookBrowserLinkOptions(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    mode: input.mode === "visible" || input.mode === "hidden" || input.mode === "removed" ? input.mode : DEFAULT_NOTEBOOK_BROWSER_LINK.mode,
    showTools: typeof input.showTools === "boolean" ? input.showTools : DEFAULT_NOTEBOOK_BROWSER_LINK.showTools
  };
}

// packages/storyboard/src/core/stores/themeHues.ts
var THEME_HUE_BASE = 295;
var DEFAULT_THEME_HUES = {
  purple: { label: "Purple", hue: THEME_HUE_BASE },
  blue: { label: "Blue", hue: 250 },
  orange: { label: "Orange", hue: 55 },
  teal: { label: "Teal", hue: 190 },
  green: { label: "Green", hue: 145 },
  pink: { label: "Pink", hue: 350 },
  slate: { label: "Gray", hue: 255, chromaScale: 0.35 }
};
var DEFAULT_THEME_HUE_BY_MODE = { light: "purple", dark: "purple" };
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
          issues.push(`Hue \u201C${id}\u201D needs a label and a hue angle from 0 up to, but not including, 360.`);
        } else if (value.chromaScale !== void 0 && (typeof value.chromaScale !== "number" || !Number.isFinite(value.chromaScale) || value.chromaScale < 0 || value.chromaScale > 1)) {
          issues.push(`Hue \u201C${id}\u201D needs a chromaScale number from 0 to 1, or no chromaScale to keep the current saturation.`);
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

// packages/storyboard/src/core/stores/configSchema.ts
var DEFAULT_MAX_FOLDER_LAYERS = 4;
function normalizeNotebookSidebar(value) {
  const layers = value?.maxFolderLayers;
  return { maxFolderLayers: Number.isInteger(layers) && layers >= 1 ? layers : DEFAULT_MAX_FOLDER_LAYERS };
}
var builtinPasteRules = [
  {
    id: "figma",
    match: "https?://(?:www\\.)?figma\\.com/",
    widget: "figma-embed",
    propsMap: { width: 800, height: 450 }
  }
];
var configDefaults = {
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
    // Read once by Core at launch, never from browser-local flag overrides.
    usePaseoApp: true,
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

// packages/storyboard/src/core/notebook/sibling-order.ts
import { parse as parseJsonc4 } from "jsonc-parser";
function refKey(ref) {
  return ref.kind === "folder" ? `folder\0${ref.path}` : `artifact\0${ref.id}`;
}
function isNotebookSiblingRef(value) {
  if (!isRecord7(value)) return false;
  if (value.kind === "folder") {
    return typeof value.path === "string" && value.path.length > 0 && value.path === value.path.replaceAll("\\", "/") && !value.path.startsWith("/") && value.path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
  }
  return value.kind === "artifact" && typeof value.id === "string" && value.id.trim().length > 0;
}
function compareText(left, right) {
  const foldedLeft = left.toLowerCase();
  const foldedRight = right.toLowerCase();
  if (foldedLeft < foldedRight) return -1;
  if (foldedLeft > foldedRight) return 1;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
function defaultRank(sibling) {
  if (sibling.kind === "artifact") return 4;
  switch (sibling.name.toLowerCase()) {
    case "prototypes":
      return 0;
    case "canvas":
      return 1;
    case "sites":
      return 2;
    default:
      return 3;
  }
}
function defaultNotebookSiblingOrder(siblings) {
  return [...siblings].sort((left, right) => defaultRank(left) - defaultRank(right) || compareText(left.name, right.name) || compareText(refKey(left.ref), refKey(right.ref)));
}
function resolveNotebookSiblingOrder(siblings, savedOrder) {
  const defaults = defaultNotebookSiblingOrder(siblings);
  if (!Array.isArray(savedOrder)) return defaults;
  const byRef = /* @__PURE__ */ new Map();
  const ambiguousAliases = /* @__PURE__ */ new Set();
  for (const sibling of siblings) {
    const keys = [refKey(sibling.ref), ...sibling.kind === "artifact" ? (sibling.legacyArtifactIds || []).map((id) => refKey({ kind: "artifact", id })) : []];
    for (const key of keys) {
      if (byRef.has(key) && byRef.get(key) !== sibling) {
        byRef.delete(key);
        ambiguousAliases.add(key);
      } else if (!ambiguousAliases.has(key)) byRef.set(key, sibling);
    }
  }
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  for (const ref of savedOrder) {
    if (!isNotebookSiblingRef(ref)) continue;
    const key = refKey(ref);
    const sibling = ambiguousAliases.has(key) ? void 0 : byRef.get(key);
    const canonicalKey = sibling ? refKey(sibling.ref) : null;
    if (sibling && canonicalKey && !seen.has(canonicalKey)) {
      result.push(sibling);
      seen.add(canonicalKey);
    }
  }
  for (const sibling of defaults) {
    const key = refKey(sibling.ref);
    if (!seen.has(key)) result.push(sibling);
  }
  return result;
}
function isRecord7(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// packages/storyboard/src/core/notebook/navigation-tree.ts
function notebookFolderRevision(root, folderPath) {
  const stat = fs8.lstatSync(path9.join(root, folderPath));
  return createHash2("sha256").update([stat.dev, stat.ino, stat.mode, stat.mtimeMs, stat.ctimeMs].join(":")).digest("hex");
}
var NOTEBOOK_TREE_INTERNAL_DIRECTORIES = /* @__PURE__ */ new Set([
  ".git",
  ".hypercanvas",
  ".storyboard",
  ".vite"
]);
var ARTIFACT_KINDS = /* @__PURE__ */ new Set(["prototype", "component", "canvas", "site", "doc"]);
var ARTIFACT_DIRECTORY_SUFFIXES = [".prototype", ".component", ".canvas", ".site"];
var NOTEBOOK_PUBLICATION_MARKER_FILE = "hypercanvas.publication.json";
function isRecord8(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function relativePath(value) {
  if (typeof value !== "string" || !value || value.includes("\\") || value.startsWith("/")) return null;
  const segments = value.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null;
  return value;
}
function sidebarIgnorePatterns(root) {
  const unsafeConfig = appConfigCandidates(root).some((file) => {
    try {
      const relative = path9.relative(fs8.realpathSync.native(root), fs8.realpathSync.native(file));
      return relative === ".." || relative.startsWith(`..${path9.sep}`) || path9.isAbsolute(relative);
    } catch {
      return false;
    }
  });
  const raw = unsafeConfig ? void 0 : readAppConfig(root)?.sidebarIgnored;
  const patterns = Array.isArray(raw) && raw.every((pattern) => typeof pattern === "string") ? raw : configDefaults.sidebarIgnored;
  return patterns;
}
function sidebarIgnoreMatcher(root) {
  return ignore().add(sidebarIgnorePatterns(root));
}
function ownsNotebookPublication(directory, notebookId) {
  try {
    const markerPath = path9.join(directory, NOTEBOOK_PUBLICATION_MARKER_FILE);
    const relative = path9.relative(fs8.realpathSync.native(directory), fs8.realpathSync.native(markerPath));
    if (relative === ".." || relative.startsWith(`..${path9.sep}`) || path9.isAbsolute(relative)) return false;
    const marker = JSON.parse(fs8.readFileSync(markerPath, "utf8"));
    return isRecord8(marker) && marker.kind === "hypercanvas-publication" && isRecord8(marker.notebook) && marker.notebook.id === notebookId;
  } catch {
    return false;
  }
}
function isNotebookManagedPublicationPath(root, value, notebookId) {
  if (!notebookId || !value) return false;
  let current = root;
  for (const segment of value.split("/")) {
    current = path9.join(current, segment);
    try {
      if (fs8.realpathSync.native(current) !== current || !fs8.statSync(current).isDirectory()) return false;
    } catch {
      return false;
    }
    if (ownsNotebookPublication(current, notebookId)) return true;
  }
  return false;
}
function isExcludedGeneratedOutputPath(value, excludedPaths) {
  for (const excluded of excludedPaths) {
    if (value === excluded || value.startsWith(`${excluded}/`)) return true;
  }
  return false;
}
function isVisiblePath(value, matcher, finalIsDirectory = true) {
  const segments = value.split("/");
  if (segments.some((segment) => segment.startsWith("_") || NOTEBOOK_TREE_INTERNAL_DIRECTORIES.has(segment))) return false;
  const directorySegmentCount = finalIsDirectory ? segments.length : segments.length - 1;
  for (let index = 1; index <= directorySegmentCount; index += 1) {
    if (matcher.ignores(`${segments.slice(0, index).join("/")}/`)) return false;
  }
  return true;
}
function isDirectoryPath(root, value) {
  try {
    return fs8.statSync(path9.join(root, ...value.split("/"))).isDirectory();
  } catch {
    return false;
  }
}
function hasArtifactDirectorySuffix(name) {
  return ARTIFACT_DIRECTORY_SUFFIXES.some((suffix) => name.length > suffix.length && name.endsWith(suffix));
}
function isAggregateSiteRegistryPath(value) {
  return value === ".hypercanvas/sites.config.json" || value === ".storyboard/sites.config.json";
}
function artifactKind(value) {
  return typeof value === "string" && ARTIFACT_KINDS.has(value) ? value : null;
}
function errorWithCode(message, code) {
  return Object.assign(new Error(message), { code });
}
function pageEntryPath(page, source) {
  const directPath = relativePath(page.path);
  if (directPath) return directPath;
  if (typeof page.siteId !== "string") return null;
  const site = source.sites?.find((candidate) => candidate.id === page.siteId);
  return site ? relativePath(site.path) : null;
}
function artifactEntries(root, source, matcher) {
  const pages = (Array.isArray(source.pages) ? source.pages : []).filter(isRecord8);
  const artifacts = (Array.isArray(source.artifacts) ? source.artifacts : []).filter(isRecord8);
  const visibleByPath = /* @__PURE__ */ new Map();
  const hiddenArtifactPaths = /* @__PURE__ */ new Set();
  const artifactPaths = [];
  const usedPageIds = /* @__PURE__ */ new Set();
  const artifactIdCounts = /* @__PURE__ */ new Map();
  for (const artifact of artifacts) {
    if (typeof artifact.id === "string" && artifact.id.trim()) {
      artifactIdCounts.set(artifact.id, (artifactIdCounts.get(artifact.id) || 0) + 1);
    }
  }
  for (const artifact of artifacts) {
    const kind = artifactKind(artifact.kind);
    const folderPath = relativePath(artifact.folderPath);
    if (!kind || !folderPath) continue;
    artifactPaths.push(folderPath);
    if (artifact.visible !== true || !isVisiblePath(folderPath, matcher)) {
      hiddenArtifactPaths.add(folderPath);
      continue;
    }
    if (typeof artifact.id !== "string" || !artifact.id.trim()) continue;
    let page = pages.find((candidate) => candidate.id === artifact.id || candidate.type === kind && (candidate.path === artifact.folderPath || candidate.path === artifact.payloadPath));
    let sitePageAmbiguous = false;
    let siteId = null;
    if (kind === "site") {
      const payloadPath = relativePath(artifact.payloadPath);
      if (payloadPath) {
        try {
          siteId = readSiteDescriptorFile(path9.join(root, ...payloadPath.split("/"))).id;
        } catch {
        }
      }
      siteId ??= typeof page?.siteId === "string" ? page.siteId : typeof artifact.siteId === "string" ? artifact.siteId : null;
      if (!page && siteId) {
        const sitePages = pages.filter((candidate) => candidate.type === "site" && candidate.siteId === siteId && typeof candidate.id === "string" && candidate.id.trim());
        if (sitePages.length === 1) page = sitePages[0];
        else if (sitePages.length > 1) sitePageAmbiguous = true;
      }
    }
    const pageId = typeof page?.id === "string" && !sitePageAmbiguous ? page.id : null;
    if (pageId) {
      usedPageIds.add(pageId);
    }
    const diagnostics = [
      ...Array.isArray(artifact.diagnostics) ? artifact.diagnostics.filter(isRecord8) : [],
      ...Array.isArray(page?.diagnostics) ? page.diagnostics.filter(isRecord8) : []
    ];
    const duplicateArtifactId = (artifactIdCounts.get(artifact.id) || 0) > 1;
    const ambiguous = duplicateArtifactId || sitePageAmbiguous;
    if (sitePageAmbiguous) diagnostics.push({
      code: "AMBIGUOUS_SITE_PAGE_ID",
      message: `Site descriptor "${siteId}" matches multiple registered Site pages; the tree cannot choose a page identity safely.`,
      path: folderPath
    });
    if (duplicateArtifactId && !diagnostics.some((item) => item.code === "DUPLICATE_ARTIFACT_ID")) {
      diagnostics.push({
        code: "DUPLICATE_ARTIFACT_ID",
        message: `Artifact identity "${artifact.id}" is shared by multiple physical artifacts. Assign distinct IDs before registering either artifact.`,
        path: folderPath
      });
    }
    visibleByPath.set(folderPath, {
      id: artifact.id,
      kind,
      path: folderPath,
      payloadPath: relativePath(artifact.payloadPath),
      title: typeof page?.title === "string" ? page.title : typeof artifact.title === "string" ? artifact.title : path9.posix.basename(folderPath),
      route: typeof page?.route === "string" || page?.route === null ? page.route : typeof artifact.route === "string" ? artifact.route : null,
      siteId,
      available: !ambiguous && !sitePageAmbiguous && (typeof page?.available === "boolean" ? page.available : artifact.available === true),
      diagnostics,
      pageId,
      legacyPageIds: siteId && pageId ? [pageId] : [],
      ambiguous
    });
  }
  const legacyByPath = /* @__PURE__ */ new Map();
  const aggregateSites = [];
  for (const page of pages) {
    if (page.type !== "site" || typeof page.id !== "string" || !page.id.trim() || typeof page.siteId !== "string" || usedPageIds.has(page.id)) continue;
    const site = source.sites?.find((candidate) => candidate.id === page.siteId);
    if (!site || !isAggregateSiteRegistryPath(site.path)) continue;
    const entry = {
      id: page.id,
      kind: "site",
      path: null,
      name: typeof page.title === "string" && page.title.trim() ? page.title : page.siteId,
      payloadPath: null,
      title: typeof page.title === "string" && page.title.trim() ? page.title : page.siteId,
      route: typeof page.route === "string" ? page.route : null,
      siteId: page.siteId,
      available: page.available === true,
      diagnostics: Array.isArray(page.diagnostics) ? page.diagnostics.filter(isRecord8) : [],
      pageId: page.id,
      legacyPageIds: [],
      ambiguous: false
    };
    aggregateSites.push(entry);
    usedPageIds.add(page.id);
  }
  for (const page of pages) {
    if (typeof page.id !== "string" || !page.id.trim() || usedPageIds.has(page.id)) continue;
    const kind = artifactKind(page.type);
    const entryPath = pageEntryPath(page, source);
    if (!kind || !entryPath || !isVisiblePath(entryPath, matcher, isDirectoryPath(root, entryPath))) continue;
    if (artifacts.some((artifact) => artifact.kind === kind && (artifact.folderPath === page.path || artifact.payloadPath === page.path))) continue;
    if (kind !== "site" && page.available !== true && !fs8.existsSync(path9.join(root, ...entryPath.split("/")))) continue;
    const entry = {
      id: page.id,
      kind,
      path: entryPath,
      payloadPath: kind === "canvas" || kind === "site" ? entryPath : null,
      title: typeof page.title === "string" ? page.title : path9.posix.basename(entryPath),
      route: typeof page.route === "string" ? page.route : null,
      siteId: kind === "site" ? typeof page.siteId === "string" ? page.siteId : null : null,
      available: page.available === true,
      diagnostics: Array.isArray(page.diagnostics) ? page.diagnostics.filter(isRecord8) : [],
      pageId: page.id,
      legacyPageIds: [],
      ambiguous: (artifactIdCounts.get(page.id) || 0) > 1
    };
    const samePath = legacyByPath.get(entryPath) || [];
    samePath.push(entry);
    legacyByPath.set(entryPath, samePath);
    artifactPaths.push(entryPath);
  }
  return { visibleByPath, hiddenArtifactPaths, legacyByPath, aggregateSites, artifactPaths };
}
function parentPathFor(value) {
  const parent = path9.posix.dirname(value);
  return parent === "." ? "" : parent;
}
function createArtifactNode(entry, depth) {
  const parentPath = entry.path === null ? "" : parentPathFor(entry.path);
  return {
    kind: "artifact",
    ref: entry.ambiguous ? null : { kind: "artifact", id: entry.id },
    id: entry.id,
    pageId: entry.pageId,
    artifactKind: entry.kind,
    name: entry.name || (entry.path === null ? entry.siteId || entry.title : path9.posix.basename(entry.path)),
    title: entry.title,
    path: entry.path,
    parentPath,
    depth,
    payloadPath: entry.payloadPath,
    route: entry.route,
    siteId: entry.siteId,
    available: entry.available,
    diagnostics: entry.diagnostics
  };
}
function readDirectory(rootRealPath, folderPath) {
  const absolute = path9.resolve(rootRealPath, ...folderPath.split("/").filter(Boolean));
  let real;
  try {
    real = fs8.realpathSync.native(absolute);
  } catch {
    return [];
  }
  if (real !== absolute || !real.startsWith(`${rootRealPath}${path9.sep}`) && real !== rootRealPath) return [];
  try {
    return fs8.readdirSync(real, { withFileTypes: true });
  } catch {
    return [];
  }
}
function collectDirectNotebookTreeEntries(root, parentPath, source, matcher = sidebarIgnoreMatcher(root), excludedGeneratedOutputPaths = /* @__PURE__ */ new Set()) {
  if (parentPath !== "" && (relativePath(parentPath) !== parentPath || !isVisiblePath(parentPath, matcher))) {
    throw errorWithCode("Sibling ordering is not available inside a hidden or invalid folder.", "INVALID_SIBLING_TARGET");
  }
  if (parentPath.split("/").some(hasArtifactDirectorySuffix)) {
    throw errorWithCode("Sibling ordering is not available inside an artifact folder.", "INVALID_SIBLING_TARGET");
  }
  const entries = artifactEntries(root, source, matcher);
  if (entries.artifactPaths.some((artifactPath) => parentPath === artifactPath || parentPath.startsWith(`${artifactPath}/`))) {
    throw errorWithCode("Sibling ordering is not available inside an artifact folder.", "INVALID_SIBLING_TARGET");
  }
  const rootRealPath = fs8.realpathSync.native(root);
  const notebookId = typeof source.manifest?.id === "string" ? source.manifest.id : null;
  if (isExcludedGeneratedOutputPath(parentPath, excludedGeneratedOutputPaths) || isNotebookManagedPublicationPath(rootRealPath, parentPath, notebookId)) {
    throw errorWithCode("Sibling ordering is not available inside a managed publication output.", "INVALID_SIBLING_TARGET");
  }
  const parentAbsolute = path9.resolve(rootRealPath, ...parentPath.split("/").filter(Boolean));
  if (parentAbsolute !== rootRealPath && !parentAbsolute.startsWith(`${rootRealPath}${path9.sep}`)) {
    throw errorWithCode("Sibling parent is outside the active Notebook.", "INVALID_SIBLING_TARGET");
  }
  let realParent;
  try {
    realParent = fs8.realpathSync.native(parentAbsolute);
  } catch {
    throw errorWithCode("Sibling parent does not exist.", "INVALID_SIBLING_TARGET");
  }
  if (realParent !== parentAbsolute || !fs8.statSync(realParent).isDirectory()) {
    throw errorWithCode("Sibling parent must resolve directly inside the active Notebook.", "INVALID_SIBLING_TARGET");
  }
  const siblings = [];
  const ambiguousArtifacts = [];
  for (const entry of readDirectory(rootRealPath, parentPath)) {
    if (entry.isSymbolicLink() || entry.name.startsWith("_") || NOTEBOOK_TREE_INTERNAL_DIRECTORIES.has(entry.name)) continue;
    const childPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    if (!isVisiblePath(childPath, matcher, entry.isDirectory())) continue;
    if (entry.isDirectory() && (isExcludedGeneratedOutputPath(childPath, excludedGeneratedOutputPaths) || isNotebookManagedPublicationPath(rootRealPath, childPath, notebookId))) continue;
    const artifact = entries.visibleByPath.get(childPath);
    const legacy = entries.legacyByPath.get(childPath) || [];
    if (artifact) {
      if (artifact.ambiguous) ambiguousArtifacts.push(artifact);
      else siblings.push({
        ref: { kind: "artifact", id: artifact.id },
        kind: "artifact",
        name: entry.name,
        legacyArtifactIds: artifact.legacyPageIds
      });
      continue;
    }
    if (legacy.length) {
      for (const value of legacy) siblings.push({ ref: { kind: "artifact", id: value.id }, kind: "artifact", name: entry.name });
      continue;
    }
    if (entries.hiddenArtifactPaths.has(childPath)) continue;
    if (entry.isDirectory()) {
      if (hasArtifactDirectorySuffix(entry.name)) continue;
      siblings.push({ ref: { kind: "folder", path: childPath }, kind: "folder", name: entry.name });
    }
  }
  if (parentPath === "") {
    for (const site of entries.aggregateSites) {
      siblings.push({ ref: { kind: "artifact", id: site.id }, kind: "artifact", name: site.name || site.siteId || site.title });
    }
  }
  return { siblings, ambiguousArtifacts };
}
function buildNotebookNavigationTree(root, source, siblingOrders = {}, reorderSiblings = true, excludedGeneratedOutputPaths = []) {
  const rootRealPath = fs8.realpathSync.native(root);
  const matcher = sidebarIgnoreMatcher(rootRealPath);
  const excludedPaths = new Set(excludedGeneratedOutputPaths.flatMap((value) => {
    const normalized = relativePath(value);
    return normalized ? [normalized] : [];
  }));
  const entries = artifactEntries(rootRealPath, source, matcher);
  const emittedArtifactPaths = /* @__PURE__ */ new Set();
  const artifactEntryKey = (entry) => entry.path === null ? `aggregate-site\0${entry.id}\0${entry.siteId || ""}` : entry.path;
  const walk = (parentPath, depth) => {
    const direct = collectDirectNotebookTreeEntries(rootRealPath, parentPath, source, matcher, excludedPaths);
    const siblings = resolveNotebookSiblingOrder(direct.siblings, siblingOrders[parentPath]);
    const byRef = /* @__PURE__ */ new Map();
    for (const sibling of siblings) {
      if (sibling.ref.kind === "artifact") {
        const id = sibling.ref.id;
        const artifact = [...entries.visibleByPath.values(), ...[...entries.legacyByPath.values()].flat(), ...entries.aggregateSites].find((candidate) => candidate.id === id && !candidate.ambiguous);
        if (!artifact || emittedArtifactPaths.has(artifactEntryKey(artifact))) continue;
        emittedArtifactPaths.add(artifactEntryKey(artifact));
        byRef.set(`artifact\0${artifact.id}`, createArtifactNode(artifact, depth));
        continue;
      }
      const folderPath = sibling.ref.path;
      const folderDirect = collectDirectNotebookTreeEntries(rootRealPath, folderPath, source, matcher, excludedPaths);
      const folder = {
        kind: "folder",
        ref: { kind: "folder", path: folderPath },
        name: path9.posix.basename(folderPath),
        path: folderPath,
        revision: notebookFolderRevision(rootRealPath, folderPath),
        parentPath,
        depth,
        capabilities: { reorderSiblings: reorderSiblings && !folderDirect.ambiguousArtifacts.length },
        children: walk(folderPath, depth + 1)
      };
      byRef.set(`folder\0${folderPath}`, folder);
    }
    const ordered = siblings.flatMap((sibling) => {
      const key = sibling.ref.kind === "folder" ? `folder\0${sibling.ref.path}` : `artifact\0${sibling.ref.id}`;
      const node = byRef.get(key);
      return node ? [node] : [];
    });
    const ambiguous = direct.ambiguousArtifacts.filter((entry) => !emittedArtifactPaths.has(artifactEntryKey(entry))).sort((left, right) => left.title.localeCompare(right.title, "en") || (left.path || "").localeCompare(right.path || "", "en")).map((entry) => {
      emittedArtifactPaths.add(artifactEntryKey(entry));
      return createArtifactNode(entry, depth);
    });
    return [...ordered, ...ambiguous];
  };
  const title = typeof source.manifest?.title === "string" && source.manifest.title.trim() ? source.manifest.title.trim() : "Notebook";
  const rootNode = {
    kind: "folder",
    ref: null,
    name: title,
    path: "",
    parentPath: null,
    depth: 0,
    capabilities: { reorderSiblings: reorderSiblings && !collectDirectNotebookTreeEntries(rootRealPath, "", source, matcher, excludedPaths).ambiguousArtifacts.length },
    children: walk("", 1)
  };
  return { root: rootNode, capabilities: { reorderSiblings }, sidebarIgnored: [...sidebarIgnorePatterns(rootRealPath)] };
}

// packages/storyboard/src/core/notebook/operations.node.ts
function removeLocalSiteInputs(value) {
  delete value.local;
  delete value.binding;
  delete value.developmentUrl;
  if (Array.isArray(value.views)) for (const view of value.views) {
    if (view && typeof view === "object") delete view.localUrl;
  }
  if (value.descriptor && typeof value.descriptor === "object") removeLocalSiteInputs(value.descriptor);
}
function portableSiteProjection(value) {
  const projection = structuredClone(value);
  removeLocalSiteInputs(projection);
  return projection;
}
function readNotebookSource({ root, mode = "portable" }) {
  if (!root || !path10.isAbsolute(root)) throw new TypeError("Notebook source requires an explicit absolute root.");
  const snapshot = inspectNotebook(root);
  if (mode === "portable") snapshot.artifacts = snapshot.artifacts.map((artifact) => artifact.kind === "site" ? portableSiteProjection(artifact) : artifact);
  const sites = snapshot.status === "unavailable" ? [] : new SiteCatalog(snapshot.root).listEntries().map(({ site }) => normalizeSiteDescriptor(site));
  const previews = mode === "local" && snapshot.status !== "unavailable" ? new SiteCatalog(snapshot.root).list() : [];
  const catalog = documentCatalog(snapshot, { sites: previews });
  if (mode === "portable") catalog.artifacts = catalog.artifacts.map((artifact) => (artifact.kind || artifact.type) === "site" ? portableSiteProjection(artifact) : artifact);
  return { root: snapshot.root, mode, snapshot, catalog, sites, diagnostics: snapshot.diagnostics };
}
function resolveNotebookReference(source, id) {
  const matches = [...source.catalog.artifacts, ...source.catalog.documents].filter((artifact2) => artifact2.id === id);
  if (matches.length !== 1) return {
    status: matches.length ? "ambiguous" : "missing",
    artifact: null,
    diagnostics: [{ code: matches.length ? "AMBIGUOUS_ARTIFACT_REFERENCE" : "MISSING_ARTIFACT_REFERENCE", message: `Artifact ID ${JSON.stringify(id)} ${matches.length ? "is ambiguous" : "was not found"}.`, path: null }]
  };
  const artifact = matches[0];
  return { status: artifact.available === false ? "unavailable" : "resolved", artifact: structuredClone(artifact), diagnostics: structuredClone(artifact.diagnostics ?? []) };
}
function readNotebookDocument(source, document2) {
  if (!source.catalog.documents.some((captured) => captured.path === document2.path)) {
    throw Object.assign(new Error(`Document payload is not in the captured catalog: ${document2.path}`), { code: "UNKNOWN_DOCUMENT_PATH" });
  }
  try {
    const file = resolveNotebookPath(source.root, null, document2.path);
    if (fs9.realpathSync.native(file) !== file || !fs9.lstatSync(file).isFile()) throw new Error("Document payload was replaced by a filesystem alias.");
    return fs9.readFileSync(file, "utf8");
  } catch {
    throw Object.assign(new Error(`Document payload is unavailable or outside the Notebook: ${document2.path}`), { code: "UNSAFE_DOCUMENT_PATH" });
  }
}
function compileNotebookDocument(input) {
  return compileDocument(input.source, input.path);
}
function notebookSourceRoutes(source, { applicationRoot } = {}) {
  return compileNotebookRoutes({ root: source.root, snapshot: source.snapshot, ...applicationRoot ? { applicationRoot } : {} });
}
function notebookSourceTree(source) {
  return buildNotebookNavigationTree(source.root, { ...source.snapshot, manifest: source.snapshot.manifest ?? {} });
}

// packages/storyboard/src/core/notebook/docs/vite-plugin.ts
var INDEX = "virtual:hypercanvas-documents";
var CONTENT = "virtual:hypercanvas-document:";
var ASSET = "virtual:hypercanvas-document-asset:";
var renderer = fileURLToPath(new URL("../../../internals/Document/Document.jsx", import.meta.url.replace("/dist/core/", "/src/core/")));
function documentsPlugin(host) {
  let projectRoot = process.cwd();
  let mode = host?.mode || "local";
  let building = false;
  const assetFiles = /* @__PURE__ */ new Map();
  const root = () => host?.root() || process.env.HYPERCANVAS_NOTEBOOK_ROOT || path11.join(projectRoot, "src");
  const watchedAssets = /* @__PURE__ */ new Set();
  const sourceCache = /* @__PURE__ */ new Map();
  const compiled = /* @__PURE__ */ new Map();
  return {
    name: "hypercanvas-documents",
    enforce: "pre",
    config() {
      return process.env.VITE_NOTEBOOK_PUBLISHED === "1" ? { define: { "globalThis.__HYPERCANVAS_NOTEBOOK_PUBLICATION__": "true" } } : {};
    },
    configResolved(config) {
      projectRoot = config.root;
      building = config.command === "build";
      if (!host?.mode) mode = building ? "static" : "local";
    },
    transformIndexHtml(html) {
      if (mode !== "static" || process.env.VITE_NOTEBOOK_PUBLISHED !== "1" || html.includes("window.__HYPERCANVAS_NOTEBOOK_PUBLICATION__=")) return html;
      const source = readNotebookSource({ root: path11.resolve(root()), mode: "portable" });
      const snapshot = source.snapshot;
      if (snapshot.status !== "valid") return html;
      const tree = notebookSourceTree(source);
      const payload = JSON.stringify({ notebookId: snapshot.manifest.id, title: snapshot.manifest.title, navigation: snapshot.manifest.navigation, pages: snapshot.pages, tree }).replaceAll("<", "\\u003c");
      return html.replace("</head>", `<script>window.__HYPERCANVAS_NOTEBOOK_PUBLICATION__=${payload}</script></head>`);
    },
    resolveId(id) {
      if (id === DOCS_IMPORT_PATH) return host?.renderer ? this.resolve(host.renderer, void 0, { skipSelf: true }) : renderer;
      if (id === INDEX || id.startsWith(CONTENT) || id.startsWith(ASSET)) return `\0${id}`;
      return null;
    },
    async load(id) {
      if (id.startsWith(`\0${ASSET}`)) {
        const file = assetFiles.get(id.slice(ASSET.length + 1));
        if (!file) return null;
        const bytes = fs10.readFileSync(file);
        if (building) {
          const reference = this.emitFile({ type: "asset", name: path11.basename(file), source: bytes });
          return `export default import.meta.ROLLUP_FILE_URL_${reference}`;
        }
        const mime = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif", ".mp4": "video/mp4", ".pdf": "application/pdf" }[path11.extname(file).toLowerCase()] || "application/octet-stream";
        return `export default ${JSON.stringify(`data:${mime};base64,${bytes.toString("base64")}`)}`;
      }
      if (id === `\0${INDEX}`) {
        const notebookRoot = path11.resolve(root());
        const sourceInput = readNotebookSource({ root: notebookRoot, mode: mode === "static" ? "portable" : "local" });
        const snapshot = sourceInput.snapshot;
        const notebookId = snapshot.status === "valid" ? snapshot.manifest.id : `source-${createHash3("sha256").update(fs10.realpathSync(notebookRoot)).digest("hex").slice(0, 24)}`;
        const catalog = sourceInput.catalog;
        const docs = structuredClone(await host?.documents?.() || catalog.documents);
        const hostArtifacts = (await host?.catalog?.() || catalog.artifacts).filter((artifact) => (artifact.kind || artifact.type) !== "doc").map((artifact) => {
          if (mode !== "static" || (artifact.kind || artifact.type) !== "site") return artifact;
          return portableSiteProjection(artifact);
        });
        for (const doc of docs) if (resolveNotebookReference({ catalog: { artifacts: hostArtifacts, documents: docs } }, doc.id).status === "ambiguous") {
          doc.available = false;
          doc.diagnostics.push({ code: "DUPLICATE_DOCUMENT_ID", message: `ID conflicts with another artifact: ${doc.id}`, path: doc.path });
        }
        const artifacts = [...hostArtifacts, ...docs];
        const imports = [];
        const entries = [];
        const assetEntries = [];
        const activeSources = new Set(docs.map((doc) => path11.join(notebookRoot, doc.path)));
        for (const file of sourceCache.keys()) if (!activeSources.has(file)) sourceCache.delete(file);
        compiled.clear();
        assetFiles.clear();
        watchedAssets.clear();
        const assetImport = (absolute) => {
          const key = createHash3("sha256").update(absolute).digest("hex");
          assetFiles.set(key, absolute);
          return ASSET + key;
        };
        for (const [index, doc] of docs.entries()) {
          let result = null;
          try {
            const file = path11.join(notebookRoot, doc.path);
            if (building) this.addWatchFile(file);
            const source = host?.loadSource ? await host.loadSource(doc) : readNotebookDocument(sourceInput, doc);
            const cached = sourceCache.get(file);
            result = cached?.source === source ? cached.result : await compileNotebookDocument({ source, path: doc.path });
            sourceCache.set(file, { source, result });
          } catch {
          }
          if (doc.available && result?.available && result.compiledSource) {
            const key = createHash3("sha256").update(doc.path).update("\0").update(result.source).digest("hex");
            compiled.set(key, result);
            imports.push(`import Content${index} from ${JSON.stringify(CONTENT + key)};`);
          }
          entries.push(`${JSON.stringify(doc.path)}: {Content: ${doc.available && result?.available ? `Content${index}` : "null"}, source: ${JSON.stringify(result?.source || "")}, diagnostics: ${JSON.stringify(result?.diagnostics || [])}}`);
          for (const [assetIndex, reference] of (result?.assets || []).entries()) {
            const absolute = resolveDocAsset(notebookRoot, doc.folderPath, reference);
            if (!absolute) continue;
            watchedAssets.add(absolute);
            const name = `asset${index}_${assetIndex}`;
            imports.push(`import ${name} from ${JSON.stringify(assetImport(absolute))};`);
            assetEntries.push(`${JSON.stringify(`${doc.folderPath}/${reference}`)}: ${name}`);
          }
        }
        for (const [index, artifact] of hostArtifacts.entries()) for (const [viewIndex, view] of (artifact.views || artifact.descriptor?.views || []).entries()) {
          if (!view.screenshot) continue;
          const folder = typeof artifact.folderPath === "string" ? artifact.folderPath : "";
          const absolute = resolveDocAsset(notebookRoot, folder, view.screenshot);
          if (!absolute) continue;
          const name = `poster${index}_${viewIndex}`;
          watchedAssets.add(absolute);
          imports.push(`import ${name} from ${JSON.stringify(assetImport(absolute))};`);
          assetEntries.push(`${JSON.stringify(`${folder}/${view.screenshot}`)}: ${name}`);
        }
        return `${imports.join("\n")}
export const notebookId=${JSON.stringify(notebookId)};
export const documents=${JSON.stringify(docs)};
export const artifacts=${JSON.stringify(artifacts)};
export const contents={${entries.join(",")}};
export const assets={${assetEntries.join(",")}};
export const mode=${JSON.stringify(mode)};
export function getDocumentSnapshot(){return import.meta.hot?.data.latest || {documents,artifacts,contents,assets,mode,notebookId}};
if(import.meta.hot)import.meta.hot.accept(next=>{if(next){import.meta.hot.data.latest=next;window.dispatchEvent(new CustomEvent('hypercanvas:documents-updated',{detail:next}));window.dispatchEvent(new Event('storyboard:sites-changed'));}});`;
      }
      if (id.startsWith(`\0${CONTENT}`)) {
        const locator = id.slice(CONTENT.length + 1);
        return compiled.get(locator)?.compiledSource || "export default function MissingDocument(){return null}";
      }
      return null;
    },
    configureServer(server) {
      server.watcher.add(root());
      let timer;
      const update = (file) => {
        let notebookRoot;
        let changed;
        try {
          notebookRoot = fs10.realpathSync(root());
          changed = fs10.existsSync(file) ? fs10.realpathSync(file) : path11.join(fs10.realpathSync(path11.dirname(file)), path11.basename(file));
        } catch {
          return;
        }
        const relative = path11.relative(notebookRoot, changed);
        const catalogFile = /\.(?:prototype|site)\.jsonc?$/.test(file) || /(?:^|[/\\])(?:hypercanvas\.notebook\.json|\.hypercanvas-artifact\.json)$/.test(file);
        if (!file.endsWith(".doc.mdx") && !watchedAssets.has(file) && !catalogFile || relative.startsWith("..") || relative.split(path11.sep).some((part) => [".git", ".hypercanvas", ".storyboard", "node_modules", "dist", "publish"].includes(part))) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          for (const module of server.moduleGraph.idToModuleMap.values()) if (module.id?.startsWith("\0virtual:hypercanvas-document")) server.moduleGraph.invalidateModule(module);
          const index = server.moduleGraph.getModuleById(`\0${INDEX}`);
          if (index) void server.reloadModule(index);
        }, 60);
      };
      server.watcher.on("add", update).on("change", update).on("unlink", update);
      server.httpServer?.once("close", () => {
        clearTimeout(timer);
        server.watcher.off("add", update).off("change", update).off("unlink", update);
      });
    }
  };
}

// packages/storyboard/src/internals/vite/data-operations.js
import fs11 from "node:fs";
import path12 from "node:path";
import { createHash as createHash4 } from "node:crypto";
import { globSync as globSync2 } from "glob";
import { parse as parseJsonc5 } from "jsonc-parser";

// packages/storyboard/src/core/canvas/canvasEvents.ts
import { z } from "zod";
var CANVAS_FORMAT_VERSION = 1;
var CANVAS_FORMAT_VERSION_WITH_LAYOUT = 2;
var SUPPORTED_CANVAS_FORMAT_VERSIONS = [CANVAS_FORMAT_VERSION, CANVAS_FORMAT_VERSION_WITH_LAYOUT];
var isRecord9 = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var knownEvents = /* @__PURE__ */ new Set([
  "canvas_created",
  "widget_added",
  "widget_updated",
  "widget_moved",
  "widget_removed",
  "settings_updated",
  "source_updated",
  "widgets_replaced",
  "connector_added",
  "connector_removed",
  "connectors_replaced",
  "connector_waypoints_set",
  "connector_waypoints_cleared",
  "connector_updated",
  "canvas_layout_updated",
  "canvas_layout_restored"
]);
var fieldsSchema = z.record(z.string(), z.unknown());
var widgetSchema = z.object({ id: z.string().min(1) }).passthrough();
var connectorSchema = z.object({
  id: z.string().min(1),
  start: z.object({ widgetId: z.string().min(1) }).passthrough(),
  end: z.object({ widgetId: z.string().min(1) }).passthrough()
}).passthrough();
var finite = z.number().finite();
var legacyGeometry = z.object({
  key: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
  export: z.string().min(1).optional(),
  position: z.object({ x: finite, y: finite }).nullable().optional(),
  width: finite.nonnegative().nullable().optional(),
  height: finite.nonnegative().nullable().optional(),
  bounds: z.record(z.string(), finite).nullable().optional()
}).passthrough();
var legacyWidget = legacyGeometry.refine((item) => Boolean(item.key || item.id), "Legacy widget requires a key or id");
var legacySource = legacyGeometry.refine((item) => Boolean(item.key || item.export), "Legacy source requires a key or export");
var legacyLayout = z.object({
  widgets: z.array(legacyWidget),
  sources: z.array(legacySource),
  scroll: z.object({ axis: z.enum(["both", "vertical", "horizontal", "none"]) }).optional()
}).passthrough().superRefine((layout, ctx) => {
  for (const [kind, keys] of [["widgets", layout.widgets.map((item) => item.key || item.id)], ["sources", layout.sources.map((item) => item.key || item.export)]]) {
    if (new Set(keys).size !== keys.length) ctx.addIssue({ code: "custom", message: `Duplicate ${kind} key in legacy canvas layout` });
  }
});
function isLegacyCanvasLayoutEvent(value) {
  return value.event === "canvas_layout_updated" && Object.hasOwn(value, "layout") && !["scroll", "widgets", "sources"].some((key) => Object.hasOwn(value, key));
}
var layoutGeometrySchema = z.object({
  id: z.string().min(1),
  position: z.object({ x: finite, y: finite }).passthrough(),
  width: finite.positive(),
  height: finite.positive()
}).passthrough();
var sourceGeometrySchema = z.object({
  export: z.string().min(1),
  position: z.object({ x: finite, y: finite }).passthrough(),
  width: finite.positive(),
  height: finite.positive()
}).passthrough();
var layoutFieldSnapshotSchema = z.union([
  z.object({ present: z.literal(false) }).strict(),
  z.object({ present: z.literal(true), value: z.unknown() }).strict().refine((snapshot) => Object.prototype.hasOwnProperty.call(snapshot, "value") && snapshot.value !== void 0, "A present field snapshot must include a JSON value")
]);
var layoutSourceSnapshotSchema = z.union([
  z.object({ present: z.literal(false) }).strict(),
  z.object({
    present: z.literal(true),
    position: layoutFieldSnapshotSchema,
    width: layoutFieldSnapshotSchema,
    height: layoutFieldSnapshotSchema
  }).strict(),
  z.object({ present: z.literal(true), index: z.number().int().nonnegative(), record: z.record(z.string(), z.unknown()) }).strict()
]);
var eventSchemas = {
  canvas_created: z.object({ event: z.literal("canvas_created") }).passthrough(),
  widget_added: z.object({ event: z.literal("widget_added"), widget: widgetSchema }).passthrough(),
  widget_updated: z.object({ event: z.literal("widget_updated"), widgetId: z.string().min(1), props: fieldsSchema }).passthrough(),
  widget_moved: z.object({ event: z.literal("widget_moved"), widgetId: z.string().min(1), position: fieldsSchema }).passthrough(),
  widget_removed: z.union([
    z.object({ event: z.literal("widget_removed"), widgetId: z.string().min(1) }).passthrough(),
    z.object({ event: z.literal("widget_removed"), widget: widgetSchema }).passthrough()
  ]),
  settings_updated: z.object({ event: z.literal("settings_updated"), settings: fieldsSchema }).passthrough(),
  source_updated: z.object({ event: z.literal("source_updated"), sources: z.array(z.unknown()) }).passthrough(),
  widgets_replaced: z.object({ event: z.literal("widgets_replaced"), widgets: z.array(widgetSchema) }).passthrough(),
  connector_added: z.object({ event: z.literal("connector_added"), connector: connectorSchema }).passthrough(),
  connector_removed: z.union([
    z.object({ event: z.literal("connector_removed"), connectorId: z.string().min(1) }).passthrough(),
    z.object({ event: z.literal("connector_removed"), connector: z.object({ id: z.string().min(1) }).passthrough() }).passthrough()
  ]),
  connectors_replaced: z.object({ event: z.literal("connectors_replaced"), connectors: z.array(connectorSchema).nullable().optional() }).passthrough(),
  connector_waypoints_set: z.object({ event: z.literal("connector_waypoints_set"), connectorId: z.string().min(1), waypoints: z.unknown().optional() }).passthrough(),
  connector_waypoints_cleared: z.object({ event: z.literal("connector_waypoints_cleared"), connectorId: z.string().min(1) }).passthrough(),
  connector_updated: z.object({ event: z.literal("connector_updated"), connectorId: z.string().min(1), updates: fieldsSchema.nullable().optional() }).passthrough(),
  canvas_layout_updated: z.object({
    event: z.literal("canvas_layout_updated"),
    scroll: z.object({ axis: z.enum(["both", "vertical", "horizontal", "none"]) }).passthrough(),
    widgets: z.array(layoutGeometrySchema),
    sources: z.array(sourceGeometrySchema)
  }).passthrough(),
  canvas_layout_restored: z.object({
    event: z.literal("canvas_layout_restored"),
    required: z.literal(true),
    action: z.enum(["undo", "redo"]),
    snapshot: z.object({
      axis: z.object({ expected: z.enum(["both", "vertical", "horizontal", "none"]), restore: z.enum(["both", "vertical", "horizontal", "none"]) }).strict(),
      widgets: z.array(z.object({
        id: z.string().min(1),
        expected: z.object({ position: layoutFieldSnapshotSchema, width: layoutFieldSnapshotSchema, height: layoutFieldSnapshotSchema, propsContainer: z.enum(["absent", "null", "object"]) }).strict(),
        restore: z.object({ position: layoutFieldSnapshotSchema, width: layoutFieldSnapshotSchema, height: layoutFieldSnapshotSchema, propsContainer: z.enum(["absent", "null", "object"]) }).strict()
      }).strict()),
      sources: z.array(z.object({ export: z.string().min(1), expected: layoutSourceSnapshotSchema, restore: layoutSourceSnapshotSchema }).strict()),
      sourcesContainer: z.object({ expected: z.enum(["absent", "null", "array"]), restore: z.enum(["absent", "null", "array"]) }).strict()
    }).strict()
  }).passthrough()
};
function isEventRecord(event) {
  return isRecord9(event) && typeof event.event === "string";
}
function decodeCanvasEvent(value) {
  if (!isEventRecord(value)) return null;
  const evt = value;
  switch (evt.event) {
    case "canvas_created":
      if ("formatVersion" in evt && !SUPPORTED_CANVAS_FORMAT_VERSIONS.includes(evt.formatVersion)) {
        throw new Error(`Unsupported canvas formatVersion: ${String(evt.formatVersion)}`);
      }
      return eventSchemas.canvas_created.parse(evt);
    case "widget_added": {
      const parsed = eventSchemas.widget_added.safeParse(evt);
      return parsed.success ? parsed.data : null;
    }
    case "widget_updated": {
      const parsed = eventSchemas.widget_updated.safeParse(evt);
      return parsed.success ? parsed.data : null;
    }
    case "widget_moved": {
      const parsed = eventSchemas.widget_moved.safeParse(evt);
      return parsed.success ? parsed.data : null;
    }
    case "widget_removed": {
      const parsed = eventSchemas.widget_removed.safeParse(evt);
      return parsed.success ? parsed.data : null;
    }
    case "settings_updated": {
      const parsed = eventSchemas.settings_updated.safeParse(evt);
      return parsed.success ? parsed.data : null;
    }
    case "source_updated": {
      const parsed = eventSchemas.source_updated.safeParse(evt);
      return parsed.success ? parsed.data : null;
    }
    case "widgets_replaced": {
      const parsed = eventSchemas.widgets_replaced.safeParse(evt);
      return parsed.success ? parsed.data : null;
    }
    case "connector_added": {
      const parsed = eventSchemas.connector_added.safeParse(evt);
      return parsed.success ? parsed.data : null;
    }
    case "connector_removed": {
      const parsed = eventSchemas.connector_removed.safeParse(evt);
      return parsed.success ? parsed.data : null;
    }
    case "connectors_replaced": {
      const parsed = eventSchemas.connectors_replaced.safeParse(evt);
      if (!parsed.success) return null;
      return { ...parsed.data, connectors: parsed.data.connectors ?? [] };
    }
    case "connector_waypoints_set": {
      const parsed = eventSchemas.connector_waypoints_set.safeParse(evt);
      return parsed.success ? parsed.data : null;
    }
    case "connector_waypoints_cleared": {
      const parsed = eventSchemas.connector_waypoints_cleared.safeParse(evt);
      return parsed.success ? parsed.data : null;
    }
    case "connector_updated": {
      const parsed = eventSchemas.connector_updated.safeParse(evt);
      return parsed.success ? parsed.data : null;
    }
    case "canvas_layout_updated": {
      if (Object.hasOwn(evt, "layout") || Object.hasOwn(evt, "prevLayout")) {
        if (!isLegacyCanvasLayoutEvent(evt)) throw new Error("Mixed legacy and v2 canvas_layout_updated event");
        const parsed2 = z.object({ layout: legacyLayout, prevLayout: legacyLayout.optional() }).passthrough().safeParse(evt);
        if (!parsed2.success) throw new Error(`Invalid legacy canvas_layout_updated event: ${parsed2.error.message}`);
        return parsed2.data;
      }
      const parsed = eventSchemas.canvas_layout_updated.safeParse(evt);
      if (!parsed.success) throw new Error("Invalid required canvas_layout_updated event");
      return parsed.data;
    }
    case "canvas_layout_restored": {
      const parsed = eventSchemas.canvas_layout_restored.safeParse(evt);
      if (!parsed.success) throw new Error("Invalid required canvas_layout_restored event");
      const snapshot = parsed.data.snapshot;
      if (new Set(snapshot.widgets.map((widget) => widget.id)).size !== snapshot.widgets.length) {
        throw new Error("Duplicate widget in canvas_layout_restored snapshot");
      }
      if (new Set(snapshot.sources.map((source) => source.export)).size !== snapshot.sources.length) {
        throw new Error("Duplicate source in canvas_layout_restored snapshot");
      }
      if (snapshot.sources.some((source) => [source.expected, source.restore].some((side) => side.present && "record" in side && side.record.export !== source.export))) {
        throw new Error("Mismatched source export in canvas_layout_restored snapshot");
      }
      return parsed.data;
    }
    default:
      return null;
  }
}
function decodeCanvasEvents(values) {
  return values.flatMap((value) => {
    const event = decodeCanvasEvent(value);
    return event ? [event] : [];
  });
}
function assertSupportedCanvasFormat(values) {
  let formatVersion;
  for (const value of values) {
    if (!isEventRecord(value)) continue;
    if (value.event === "canvas_created" && "formatVersion" in value) {
      if (!SUPPORTED_CANVAS_FORMAT_VERSIONS.includes(value.formatVersion)) {
        throw new Error(`Unsupported canvas formatVersion: ${String(value.formatVersion)}`);
      }
      formatVersion = value.formatVersion;
    }
    if (isLegacyCanvasLayoutEvent(value)) {
      if (formatVersion === CANVAS_FORMAT_VERSION_WITH_LAYOUT) throw new Error("Legacy canvas_layout_updated is not valid in canvas formatVersion 2");
    } else if ((value.event === "canvas_layout_updated" || value.event === "canvas_layout_restored") && formatVersion !== CANVAS_FORMAT_VERSION_WITH_LAYOUT) {
      throw new Error(`${value.event} requires canvas formatVersion 2`);
    }
    if (!knownEvents.has(value.event) && value.required === true) {
      throw new Error(`Unsupported required canvas event: ${value.event}`);
    }
  }
}

// packages/storyboard/src/core/canvas/materializer.ts
function splitJsonObjects(text) {
  const chunks = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
      continue;
    }
    if (ch === "}") {
      if (depth > 0) depth--;
      if (depth === 0 && start >= 0) {
        chunks.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return chunks;
}
function parseCanvasJsonl(text) {
  const events = [];
  for (const snippet of splitJsonObjects(text || "")) {
    try {
      const parsed = JSON.parse(snippet);
      if (isRecord10(parsed)) events.push(parsed);
    } catch {
    }
  }
  return events;
}
function applyDecodedEvent(state, evt) {
  switch (evt.event) {
    case "canvas_created": {
      const initial = { ...evt };
      delete initial.event;
      delete initial.timestamp;
      delete initial.formatVersion;
      if (!initial.connectors) initial.connectors = [];
      return initial;
    }
    case "widget_added": {
      const widgets = state.widgets || [];
      return { ...state, widgets: [...widgets, evt.widget] };
    }
    case "widget_updated": {
      return {
        ...state,
        widgets: (state.widgets || []).map(
          (w) => w.id === evt.widgetId ? { ...w, props: { ...w.props || {}, ...evt.props || {} } } : w
        )
      };
    }
    case "widget_moved": {
      return {
        ...state,
        widgets: (state.widgets || []).map(
          (w) => w.id === evt.widgetId ? { ...w, position: evt.position || {} } : w
        )
      };
    }
    case "widget_removed": {
      const removedId = evt.widget?.id ?? evt.widgetId;
      const next = {
        ...state,
        widgets: (state.widgets || []).filter((w) => w.id !== removedId)
      };
      if (state.connectors?.length) {
        next.connectors = state.connectors.filter(
          (c) => c.start.widgetId !== removedId && c.end.widgetId !== removedId
        );
      }
      return next;
    }
    case "settings_updated": {
      if (!evt.settings) return state;
      return { ...state, ...evt.settings || {} };
    }
    case "source_updated": {
      return { ...state, sources: evt.sources };
    }
    case "widgets_replaced": {
      const next = { ...state, widgets: evt.widgets || [] };
      if (state.connectors?.length) {
        const widgetIds = new Set((evt.widgets || []).map((w) => w.id));
        next.connectors = state.connectors.filter(
          (c) => widgetIds.has(c.start.widgetId) && widgetIds.has(c.end.widgetId)
        );
      }
      return next;
    }
    case "connector_added": {
      const connectors = state.connectors || [];
      return { ...state, connectors: [...connectors, evt.connector] };
    }
    case "connector_removed": {
      const removedId = evt.connector?.id ?? evt.connectorId;
      return {
        ...state,
        connectors: (state.connectors || []).filter((c) => c.id !== removedId)
      };
    }
    case "connectors_replaced": {
      return { ...state, connectors: evt.connectors || [] };
    }
    case "connector_waypoints_set": {
      return {
        ...state,
        connectors: (state.connectors || []).map((c) => {
          if (c.id !== evt.connectorId) return c;
          const waypoints = Array.isArray(evt.waypoints) ? evt.waypoints : [];
          return { ...c, waypoints };
        })
      };
    }
    case "connector_waypoints_cleared": {
      return {
        ...state,
        connectors: (state.connectors || []).map((c) => {
          if (c.id !== evt.connectorId) return c;
          const { waypoints: _waypoints, ...rest } = c;
          return rest;
        })
      };
    }
    case "connector_updated": {
      return {
        ...state,
        connectors: (state.connectors || []).map((c) => {
          if (c.id !== evt.connectorId) return c;
          const { startAnchor, endAnchor, meta, style, data, className, ...rest } = evt.updates || {};
          const mergedMeta = { ...c.meta || {}, ...isRecord10(meta) ? meta : {} };
          const start = startAnchor ? { ...c.start, anchor: startAnchor } : c.start;
          const end = endAnchor ? { ...c.end, anchor: endAnchor } : c.end;
          const next = { ...c, ...rest, meta: mergedMeta, id: c.id, start, end };
          if (style === null) delete next.style;
          else if (isRecord10(style)) next.style = { ...c.style || {}, ...style };
          if (data === null) delete next.data;
          else if (isRecord10(data)) next.data = { ...c.data || {}, ...data };
          if (className === null) delete next.className;
          else if (typeof className === "string") next.className = className;
          return next;
        })
      };
    }
    case "canvas_layout_updated": {
      if ("layout" in evt) return applyLegacyLayout(state, evt);
      const layout = evt;
      const currentWidgets = state.widgets || [];
      const widgetGeometry = /* @__PURE__ */ new Map();
      for (const geometry of layout.widgets) {
        if (widgetGeometry.has(geometry.id)) throw new Error(`Duplicate widget in canvas layout: ${geometry.id}`);
        widgetGeometry.set(geometry.id, geometry);
      }
      if (widgetGeometry.size !== currentWidgets.length || currentWidgets.some((widget) => !widgetGeometry.has(widget.id))) {
        throw new Error("canvas_layout_updated must include every current widget exactly once");
      }
      const currentSources = state.sources || [];
      const sourceGeometry = /* @__PURE__ */ new Map();
      for (const geometry of layout.sources) {
        if (sourceGeometry.has(geometry.export)) throw new Error(`Duplicate source in canvas layout: ${geometry.export}`);
        sourceGeometry.set(geometry.export, geometry);
      }
      const persistedExports = currentSources.filter((source) => isRecord10(source) && typeof source.export === "string").map((source) => source.export);
      if (new Set(persistedExports).size !== persistedExports.length) {
        throw new Error("Canvas contains duplicate persisted JSX source exports");
      }
      if (persistedExports.some((name) => !sourceGeometry.has(name))) {
        throw new Error("canvas_layout_updated must include every persisted JSX source");
      }
      const widgets = currentWidgets.map((widget) => {
        const geometry = widgetGeometry.get(widget.id);
        return {
          ...widget,
          position: geometry.position,
          props: { ...widget.props || {}, width: geometry.width, height: geometry.height }
        };
      });
      const sourceByExport = new Map(currentSources.filter((source) => isRecord10(source) && typeof source.export === "string").map((source) => [source.export, source]));
      const sources = [...currentSources];
      for (const geometry of layout.sources) {
        const current = sourceByExport.get(geometry.export);
        const next = {
          ...current || {},
          export: geometry.export,
          position: geometry.position,
          width: geometry.width,
          height: geometry.height
        };
        if (current) sources[sources.indexOf(current)] = next;
        else sources.push(next);
      }
      return {
        ...state,
        scroll: { ...state.scroll || {}, axis: layout.scroll.axis },
        widgets,
        sources
      };
    }
    case "canvas_layout_restored":
      return applyCanvasLayoutRestoration(state, evt);
    default:
      return state;
  }
}
function applyLegacyLayout(state, event) {
  if (state.formatVersion === 2) throw new Error("Legacy canvas_layout_updated is not valid in canvas formatVersion 2");
  const patchFields = (record3, patch, fields) => {
    const next = { ...record3 };
    for (const field of fields) {
      if (!Object.hasOwn(patch, field)) continue;
      if (patch[field] === null) delete next[field];
      else next[field] = patch[field];
    }
    return next;
  };
  const widgetPatches = new Map(event.layout.widgets.map((item) => [item.key || item.id, item]));
  const widgets = (state.widgets || []).map((widget) => {
    const patch = widgetPatches.get(String(widget.key || widget.id)) || widgetPatches.get(widget.id);
    if (!patch) return widget;
    const next = patchFields(widget, patch, ["position", "bounds"]);
    if (Object.hasOwn(patch, "width") || Object.hasOwn(patch, "height")) next.props = patchFields(widget.props || {}, patch, ["width", "height"]);
    return next;
  });
  const sourceKey = (source) => String(source.key || source.export);
  const newKeys = new Set(event.layout.sources.map(sourceKey));
  const removed = new Set((event.prevLayout?.sources || []).map(sourceKey).filter((key) => !newKeys.has(key)));
  const sources = (state.sources || []).filter((source) => !isRecord10(source) || !removed.has(sourceKey(source)));
  for (const patch of event.layout.sources) {
    const key = sourceKey(patch);
    const index = sources.findIndex((source) => isRecord10(source) && sourceKey(source) === key);
    const current = index >= 0 && isRecord10(sources[index]) ? sources[index] : { ...patch, export: patch.export || key };
    const next = patchFields(current, patch, ["position", "width", "height", "bounds"]);
    if (index >= 0) sources[index] = next;
    else sources.push(next);
  }
  return { ...state, widgets, sources, ...event.layout.scroll ? { scroll: { ...state.scroll || {}, ...event.layout.scroll } } : {} };
}
function matchesField(record3, key, snapshot) {
  if (!snapshot.present) return !record3 || !Object.prototype.hasOwnProperty.call(record3, key);
  return Boolean(record3 && Object.prototype.hasOwnProperty.call(record3, key) && deepEqual(record3[key], snapshot.value));
}
function restoreField(record3, key, snapshot) {
  if (snapshot.present) record3[key] = snapshot.value;
  else delete record3[key];
}
function deepEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => deepEqual(value, right[index]));
  }
  if (!isRecord10(left) || !isRecord10(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && deepEqual(left[key], right[key]));
}
function sourceEntries(state) {
  const entries = (state.sources || []).filter((source) => isRecord10(source) && typeof source.export === "string");
  if (new Set(entries.map((source) => source.export)).size !== entries.length) {
    throw new Error("Canvas contains duplicate persisted JSX source exports");
  }
  return entries;
}
function axisOf(state) {
  const axis = state.scroll?.axis;
  return axis === "vertical" || axis === "horizontal" || axis === "none" || axis === "both" ? axis : "both";
}
function sourcesContainerOf(state) {
  if (!Object.prototype.hasOwnProperty.call(state, "sources")) return "absent";
  return state.sources === null ? "null" : "array";
}
function applyCanvasLayoutRestoration(state, event) {
  const snapshot = event.snapshot;
  if (axisOf(state) !== snapshot.axis.expected) throw new Error("canvas_layout_restored axis conflict");
  if (sourcesContainerOf(state) !== snapshot.sourcesContainer.expected) {
    throw new Error("canvas_layout_restored sources container conflict");
  }
  const widgets = state.widgets || [];
  const widgetIds = new Set(widgets.map((widget) => widget.id));
  for (const entry of snapshot.widgets) {
    if (!widgetIds.has(entry.id)) throw new Error(`canvas_layout_restored widget missing: ${entry.id}`);
    const widget = widgets.find((item) => item.id === entry.id);
    if (!matchesField(widget, "position", entry.expected.position) || !matchesField(widget.props, "width", entry.expected.width) || !matchesField(widget.props, "height", entry.expected.height)) {
      throw new Error(`canvas_layout_restored widget conflict: ${entry.id}`);
    }
  }
  const sources = sourceEntries(state);
  for (const entry of snapshot.sources) {
    const currentIndex = sources.findIndex((source) => source.export === entry.export);
    const current = currentIndex < 0 ? void 0 : sources[currentIndex];
    if (!entry.expected.present) {
      if (current) throw new Error(`canvas_layout_restored source conflict: ${entry.export}`);
    } else if ("record" in entry.expected) {
      if (!current || !deepEqual(current, entry.expected.record)) throw new Error(`canvas_layout_restored source conflict: ${entry.export}`);
    } else if (!current || !matchesField(current, "position", entry.expected.position) || !matchesField(current, "width", entry.expected.width) || !matchesField(current, "height", entry.expected.height)) {
      throw new Error(`canvas_layout_restored source conflict: ${entry.export}`);
    }
  }
  const nextWidgets = widgets.map((widget) => {
    const entry = snapshot.widgets.find((candidate) => candidate.id === widget.id);
    if (!entry) return widget;
    const next2 = { ...widget };
    restoreField(next2, "position", entry.restore.position);
    const props = { ...isRecord10(widget.props) ? widget.props : {} };
    restoreField(props, "width", entry.restore.width);
    restoreField(props, "height", entry.restore.height);
    if (Object.keys(props).length) next2.props = props;
    else if (entry.restore.propsContainer === "null") next2.props = null;
    else if (entry.restore.propsContainer === "absent") delete next2.props;
    else next2.props = props;
    return next2;
  });
  const nextSources = [...state.sources || []];
  for (const entry of snapshot.sources) {
    const currentIndex = nextSources.findIndex((source) => isRecord10(source) && source.export === entry.export);
    if (!entry.restore.present) {
      if (currentIndex >= 0) nextSources.splice(currentIndex, 1);
    } else if ("record" in entry.restore) {
      if (currentIndex >= 0) throw new Error(`canvas_layout_restored source insertion conflict: ${entry.export}`);
      nextSources.splice(Math.min(entry.restore.index, nextSources.length), 0, entry.restore.record);
    } else {
      if (currentIndex < 0) throw new Error(`canvas_layout_restored source missing: ${entry.export}`);
      const current = nextSources[currentIndex];
      const next2 = { ...current };
      restoreField(next2, "position", entry.restore.position);
      restoreField(next2, "width", entry.restore.width);
      restoreField(next2, "height", entry.restore.height);
      nextSources[currentIndex] = next2;
    }
  }
  const next = {
    ...state,
    scroll: { ...state.scroll || {}, axis: snapshot.axis.restore },
    widgets: nextWidgets
  };
  if (nextSources.length) next.sources = nextSources;
  else if (snapshot.sourcesContainer.restore === "absent") delete next.sources;
  else if (snapshot.sourcesContainer.restore === "null") next.sources = null;
  else next.sources = nextSources;
  return next;
}
function materialize(events) {
  let state = {};
  assertSupportedCanvasFormat(events);
  for (const evt of decodeCanvasEvents(events)) {
    state = applyDecodedEvent(state, evt);
  }
  if (Object.keys(state).length > 0 && (!state.scroll || !["both", "vertical", "horizontal", "none"].includes(String(state.scroll.axis)))) {
    state.scroll = { ...state.scroll || {}, axis: "both" };
  }
  if (state.connectors?.length && state.widgets?.length) {
    const widgetConnMap = /* @__PURE__ */ new Map();
    for (const conn of state.connectors) {
      for (const endpoint of [conn.start, conn.end]) {
        if (!widgetConnMap.has(endpoint.widgetId)) {
          widgetConnMap.set(endpoint.widgetId, /* @__PURE__ */ new Set());
        }
        widgetConnMap.get(endpoint.widgetId).add(conn.id);
      }
    }
    state.widgets = state.widgets.map((w) => {
      const ids = widgetConnMap.get(w.id);
      return ids ? { ...w, connectorIds: [...ids] } : w;
    });
  }
  return state;
}
function materializeFromText(text) {
  return materialize(parseCanvasJsonl(text));
}
function isRecord10(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// packages/storyboard/src/core/canvas/identity.ts
var CANVAS_SUFFIX_RE = /\.canvas\.jsonl$/;
var FOLDER_SUFFIX_RE = /([^/]+)\.folder\//g;
function toCanvasId(relPath) {
  let p = relPath.replace(/\\/g, "/");
  let prefix = "";
  if (p.startsWith("src/canvas/")) {
    p = p.slice("src/canvas/".length);
  } else if (p.startsWith("canvas/")) {
    p = p.slice("canvas/".length);
  } else if (p.startsWith("src/prototypes/")) {
    p = p.slice("src/prototypes/".length);
    prefix = "proto:";
  }
  p = p.replace(CANVAS_SUFFIX_RE, "");
  p = p.replace(FOLDER_SUFFIX_RE, "$1/");
  const segments = p.split("/").filter(Boolean);
  const payloadName = segments.at(-1);
  const artifactFolder = segments.at(-2);
  if (payloadName && artifactFolder && artifactFolder.endsWith(".canvas") && artifactFolderLogicalName(artifactFolder) === payloadName) segments.splice(-2, 1);
  p = segments.join("/");
  p = p.replace(/\/+/g, "/").replace(/\/$/, "");
  return prefix + (p || "unknown");
}

// packages/storyboard/src/internals/vite/data-operations.js
var GLOB_PATTERN = "**/*.{flow,scene,object,record,prototype,folder,component}.{json,jsonc}";
var CANVAS_GLOB_PATTERN = "**/*.canvas.jsonl";
var CANVAS_META_GLOB_PATTERN = "**/*.meta.json";
var STORY_GLOB_PATTERN = "**/*.{story,stories}.{js,jsx,ts,tsx}";
function canvasViewportScope(root) {
  return createHash4("sha256").update(fs11.realpathSync(root)).digest("hex");
}
function parseStoryExportNames(filePath) {
  try {
    const src = fs11.readFileSync(filePath, "utf-8");
    const names = [];
    const re = /export\s+(?:function|const|class)\s+([A-Z]\w*)/g;
    let m;
    while ((m = re.exec(src)) !== null) names.push(m[1]);
    return names;
  } catch {
    return [];
  }
}
function logicalDataPath(filePath) {
  return filePath.replace(/\\/g, "/").split("/").map((seg) => seg.replace(/^_+/, "")).join("/");
}
function hasUnderscoreAncestor(filePath) {
  const segments = filePath.replace(/\\/g, "/").split("/");
  if (segments[0] === "src") segments[0] = "src";
  return segments.slice(0, -1).some((seg) => seg.startsWith("_"));
}
function parseDataFile(filePath, { notebookMode = false } = {}) {
  const base = path12.basename(filePath);
  const canvasJsonlMatch = base.match(/^(.+)\.canvas\.jsonl$/);
  if (canvasJsonlMatch) {
    if (canvasJsonlMatch[1].startsWith("_")) return null;
    if (!notebookMode && hasUnderscoreAncestor(filePath)) return null;
    const normalized2 = logicalDataPath(filePath);
    const baseName = canvasJsonlMatch[1];
    let name2 = baseName;
    let inferredRoute2 = null;
    const canvasFolderMatch = normalized2.match(/(?:^|\/)src\/canvas\/([^/]+)\.folder\//);
    const canvasFolderName = canvasFolderMatch ? canvasFolderMatch[1] : null;
    const folderDirMatch2 = normalized2.match(/(?:^|\/)src\/prototypes\/([^/]+)\.folder\//);
    const folderName2 = folderDirMatch2 ? folderDirMatch2[1] : null;
    const stripDraft = (p) => p.split("/").filter((seg) => seg !== "drafts").join("/");
    const canvasCheck = normalized2.match(/(?:^|\/)src\/canvas\//);
    if (canvasCheck) {
      const dirPath = normalized2.substring(0, normalized2.lastIndexOf("/"));
      const idBase = (dirPath + "/").replace(/^.*?src\/canvas\//, "").replace(/\.folder\/?/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
      name2 = idBase ? `${idBase}/${baseName}` : baseName;
      inferredRoute2 = "/canvas/" + stripDraft(name2);
      inferredRoute2 = inferredRoute2.replace(/\/+/g, "/").replace(/\/$/, "") || "/canvas";
    }
    const protoCheck = normalized2.match(/(?:^|\/)src\/prototypes\//);
    if (!canvasCheck && protoCheck) {
      const dirPath = normalized2.substring(0, normalized2.lastIndexOf("/"));
      const idBase = (dirPath + "/").replace(/^.*?src\/prototypes\//, "").replace(/[^/]*\.folder\/?/g, "").replace(/\/+/g, "/").replace(/\/$/, "");
      name2 = idBase ? `${idBase}/${baseName}` : baseName;
      inferredRoute2 = "/canvas/" + stripDraft(name2);
      inferredRoute2 = inferredRoute2.replace(/\/+/g, "/").replace(/\/$/, "") || "/canvas";
    }
    const groupBase = stripDraft(name2);
    const groupSlashIdx = groupBase.lastIndexOf("/");
    const group = canvasFolderName || (groupSlashIdx > 0 ? groupBase.substring(0, groupSlashIdx) : null);
    const canvasIdInput = normalized2.replace(/^.*?(src\/(?:canvas|prototypes)\/)/, "$1");
    const id = toCanvasId(canvasIdInput);
    return { name: name2, suffix: "canvas", ext: "jsonl", folder: canvasFolderName || folderName2, inferredRoute: inferredRoute2, id, group };
  }
  const metaMatch = base.match(/^(.+)\.meta\.json$/);
  if (metaMatch) {
    const normalized2 = filePath.replace(/\\/g, "/");
    const canvasCheck = normalized2.match(/(?:^|\/)src\/canvas\//);
    if (!canvasCheck) return null;
    if (metaMatch[1].startsWith("_")) return null;
    if (!notebookMode && hasUnderscoreAncestor(filePath)) return null;
    return { name: logicalDataPath(metaMatch[1]), suffix: "canvas-meta", ext: "json", inferredRoute: null };
  }
  const storyMatch = base.match(/^(.+)\.stor(?:y|ies)\.(js|jsx|ts|tsx)$/);
  if (storyMatch) {
    if (storyMatch[1].startsWith("_")) return null;
    if (!notebookMode && hasUnderscoreAncestor(filePath)) return null;
    const normalized2 = logicalDataPath(filePath);
    const name2 = storyMatch[1];
    let inferredRoute2 = null;
    const canvasCheck = normalized2.match(/(?:^|\/)src\/canvas\//);
    const componentsCheck = normalized2.match(/(?:^|\/)src\/components\//);
    const stripDraft = (p) => p.split("/").filter((seg) => seg !== "drafts").join("/");
    if (canvasCheck) {
      const dirPath = normalized2.substring(0, normalized2.lastIndexOf("/"));
      const routeBase = (dirPath + "/").replace(/^.*?src\/canvas\//, "").replace(/[^/]*\.folder\/?/g, "").replace(/\/$/, "");
      inferredRoute2 = "/components/" + (routeBase ? routeBase + "/" : "") + name2;
      inferredRoute2 = stripDraft(inferredRoute2).replace(/\/+/g, "/").replace(/\/$/, "") || "/components";
    } else if (componentsCheck) {
      const dirPath = normalized2.substring(0, normalized2.lastIndexOf("/"));
      const routeBase = (dirPath + "/").replace(/^.*?src\/components\//, "").replace(/[^/]*\.folder\/?/g, "").replace(/\/$/, "");
      inferredRoute2 = "/components/" + (routeBase ? routeBase + "/" : "") + name2;
      inferredRoute2 = stripDraft(inferredRoute2).replace(/\/+/g, "/").replace(/\/$/, "") || "/components";
    }
    return { name: name2, suffix: "story", ext: storyMatch[2], inferredRoute: inferredRoute2 };
  }
  const match = base.match(/^(.+)\.(flow|scene|object|record|prototype|folder|component)\.(jsonc?)$/);
  if (!match) return null;
  if (match[1].startsWith("_")) return null;
  if (!notebookMode && hasUnderscoreAncestor(filePath)) return null;
  const normalized = logicalDataPath(filePath);
  const suffix = match[2] === "scene" ? "flow" : match[2];
  let name = match[1];
  const folderDirMatch = normalized.match(/(?:^|\/)src\/prototypes\/([^/]+)\.folder\//);
  const folderName = folderDirMatch ? folderDirMatch[1] : null;
  if (suffix === "folder") {
    if (folderName) {
      name = folderName;
    }
    return { name, suffix, ext: match[3] };
  }
  if (suffix === "prototype") {
    const protoMatch2 = normalized.match(/(?:^|\/)src\/prototypes\/(?:(?:[^/]+\.folder|drafts)\/)*([^/]+)\//);
    if (protoMatch2) {
      name = protoMatch2[1];
    }
    return { name, suffix, ext: match[3], folder: folderName };
  }
  if (suffix === "component") {
    return { name, suffix, ext: match[3] };
  }
  const protoMatch = normalized.match(/(?:^|\/)src\/prototypes\/(?:(?:[^/]+\.folder|drafts)\/)*([^/]+)\//);
  if (protoMatch) {
    name = `${protoMatch[1]}/${name}`;
  }
  let inferredRoute = null;
  if (suffix === "flow") {
    const protoCheck = normalized.match(/(?:^|\/)src\/prototypes\//);
    if (protoCheck) {
      const dirPath = normalized.substring(0, normalized.lastIndexOf("/"));
      inferredRoute = "/" + dirPath.replace(/^.*?src\/prototypes\//, "").replace(/[^/]*\.folder\//g, "").split("/").filter((seg) => seg !== "drafts").join("/");
      inferredRoute = inferredRoute.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
    }
  }
  return { name, suffix, ext: match[3], inferredRoute };
}
function buildIndex(root, opts = {}) {
  const { contentOnly = false } = opts;
  const ignore2 = contentOnly ? [".git/**", ".hypercanvas/**", ".storyboard/**", ".vite/**", "node_modules/**", "build/**", "coverage/**", "dist/**", "publish/**", "backstage/publish/**", "public/**", "storybook-static/**", ".storyboard-public/**"] : ["node_modules/**", "dist/**", ".git/**", ".worktrees/**", "worktrees/**", "public/**", "fixtures/**", "desktop/resources/**", "packages/mygo/resources/**", "artifacts/**", "releases/**", "notebooks/**"];
  const files = globSync2(contentOnly ? `**/*.{flow,scene,object,record,prototype,folder,component}.{json,jsonc}` : GLOB_PATTERN, { cwd: root, ignore: ignore2, absolute: false });
  const canvasFiles = globSync2(CANVAS_GLOB_PATTERN, { cwd: root, ignore: ignore2, absolute: false });
  const canvasMetaFiles = globSync2(CANVAS_META_GLOB_PATTERN, { cwd: root, ignore: ignore2, absolute: false });
  const storyFiles = globSync2(STORY_GLOB_PATTERN, { cwd: root, ignore: ignore2, absolute: false });
  const notebookMode = contentOnly || hasNotebookManifest(root);
  const notebookArtifacts = notebookMode ? inspectNotebook(root).artifacts : [];
  const folderDirs = globSync2(contentOnly ? "prototypes/**/*.folder" : "src/prototypes/**/*.folder", { cwd: root, ignore: ignore2, absolute: false });
  for (const dir of folderDirs) {
    const normalized = dir.replace(/\\/g, "/");
    const segments = normalized.split("/").filter((s) => s.endsWith(".folder"));
    if (segments.length > 1) {
      throw new Error(
        `[storyboard-data] Nested .folder directories are not supported.
  Found at: ${dir}
  Folders can only be one level deep inside src/prototypes/.`
      );
    }
  }
  const index = { flow: {}, object: {}, record: {}, prototype: {}, folder: {}, component: {}, canvas: {}, "canvas-meta": {}, story: {} };
  const seen = {};
  const dataScopeConflicts = [];
  const protoFolders = {};
  const flowRoutes = {};
  const canvasRoutes = {};
  const canvasAliases = {};
  const canvasNameCount = {};
  const ambiguousCanvasAliases = /* @__PURE__ */ new Set();
  const registerCanvasAlias = (alias, id) => {
    if (!alias || ambiguousCanvasAliases.has(alias)) return;
    if (Object.hasOwn(canvasAliases, alias) && canvasAliases[alias] !== id) {
      delete canvasAliases[alias];
      ambiguousCanvasAliases.add(alias);
      return;
    }
    canvasAliases[alias] = id;
  };
  const canvasGroups = {};
  const storyRoutes = {};
  const artifactContexts = {};
  const scopeAliases = {};
  const scopeAliasTargets = /* @__PURE__ */ new Map();
  for (const artifact of notebookArtifacts) {
    if (artifact.kind !== "prototype" || !artifact.available) continue;
    const oldScope = artifact.migrationAliases?.legacyScopes?.prototype;
    const canonicalScope = artifactFolderLogicalName(path12.posix.basename(artifact.folderPath));
    if (!oldScope || !canonicalScope || oldScope === canonicalScope) continue;
    if (scopeAliasTargets.has(oldScope) && scopeAliasTargets.get(oldScope) !== canonicalScope) {
      throw new Error(`[storyboard-data] Conflicting legacy prototype scope alias "${oldScope}"`);
    }
    scopeAliasTargets.set(oldScope, canonicalScope);
  }
  for (const [oldScope, canonicalScope] of scopeAliasTargets) {
    if (notebookArtifacts.some((artifact) => artifact.kind === "prototype" && artifact.available && artifactFolderLogicalName(path12.posix.basename(artifact.folderPath)) === oldScope && artifactFolderLogicalName(path12.posix.basename(artifact.folderPath)) !== canonicalScope)) {
      throw new Error(`[storyboard-data] Legacy prototype scope alias "${oldScope}" conflicts with a canonical prototype`);
    }
    scopeAliases[oldScope] = canonicalScope;
  }
  for (const relPath of [...files, ...canvasFiles, ...canvasMetaFiles, ...storyFiles]) {
    const normalizedPath = relPath.replaceAll("\\", "/");
    const artifact = notebookArtifacts.filter((item) => normalizedPath === item.folderPath || normalizedPath.startsWith(`${item.folderPath}/`)).sort((left, right) => right.folderPath.length - left.folderPath.length)[0];
    let parsePath = contentOnly && !relPath.startsWith("src/") ? `src/${relPath}` : relPath;
    if (notebookMode) {
      const suffixAncestor = normalizedPath.split("/").slice(0, -1).findIndex((segment) => /\.(prototype|component|canvas|site)$/.test(segment));
      if (suffixAncestor >= 0 && !artifact) continue;
      if (artifact) {
        if (!artifact.available || artifact.kind === "site") continue;
        const artifactPrefix = `${artifact.folderPath}/`;
        const inside3 = normalizedPath.slice(artifactPrefix.length);
        const nestedBoundary = inside3.split("/").slice(0, -1).some((segment) => /\.(prototype|component|canvas|site)$/.test(segment));
        if (nestedBoundary) continue;
        const logicalName = artifactFolderLogicalName(path12.posix.basename(artifact.folderPath));
        if (!logicalName) continue;
        if (artifact.kind === "canvas") {
          if (normalizedPath !== artifact.payloadPath) continue;
          parsePath = `src/canvas/${logicalName}.canvas.jsonl`;
        } else if (artifact.kind === "prototype") {
          parsePath = `src/prototypes/${logicalName}/${inside3}`;
        } else {
          parsePath = `src/components/${logicalName}/${inside3}`;
        }
      }
    }
    const parsed = parseDataFile(parsePath, { notebookMode });
    if (!parsed) continue;
    if (artifact) {
      const logicalName = artifactFolderLogicalName(path12.posix.basename(artifact.folderPath));
      if (!logicalName) continue;
      if (artifact.kind === "canvas") {
        parsed.id = artifact.id;
        parsed.name = logicalName;
        parsed.inferredRoute = artifact.route;
        parsed.legacyPathId = toCanvasId(`canvas/${artifact.folderPath}/${path12.posix.basename(artifact.payloadPath)}`);
      } else if (artifact.kind === "prototype") {
        if (parsed.suffix === "prototype") parsed.name = logicalName;
        if (parsed.suffix === "flow" && parsed.inferredRoute && artifact.route) {
          const suffix = parsed.inferredRoute.slice(`/${logicalName}`.length);
          parsed.inferredRoute = `${artifact.route}${suffix}`;
        }
      } else if (artifact.kind === "component" && parsed.suffix === "story") {
        const inside3 = normalizedPath.slice(`${artifact.folderPath}/`.length).replace(/\.stor(?:y|ies)\.[jt]sx?$/, "");
        const primary = normalizedPath === artifact.payloadPath;
        parsed.name = primary ? logicalName : `${logicalName}/${inside3}`;
        parsed.inferredRoute = primary ? artifact.route : `${artifact.route}/${inside3.split("/").map(encodeURIComponent).join("/")}`;
      }
    }
    const dedupKey = parsed.suffix === "canvas" && parsed.id ? `${parsed.id}.${parsed.suffix}` : `${parsed.name}.${parsed.suffix}`;
    const absPath = path12.resolve(root, relPath);
    if (artifact) artifactContexts[absPath] = artifact;
    if (seen[dedupKey]) {
      if (["flow", "object", "record"].includes(parsed.suffix) && parsed.name.includes("/")) {
        dataScopeConflicts.push({ key: dedupKey, name: parsed.name, suffix: parsed.suffix, paths: [seen[dedupKey], absPath] });
        delete index[parsed.suffix][parsed.name];
        delete flowRoutes[parsed.name];
        seen[dedupKey] = absPath;
        continue;
      }
      const hint = parsed.suffix === "folder" ? "  Folder names must be unique across the project." : parsed.suffix === "canvas" ? "  Canvas IDs must be unique. Move or rename one file to resolve the collision." : "  Flows, records, and objects are scoped to their prototype directory.\n  If both files are global (outside src/prototypes/), rename one to avoid the collision.";
      throw new Error(
        `[storyboard-data] Duplicate ${parsed.suffix} "${parsed.id || parsed.name}"
  Found at: ${seen[dedupKey]}
  And at:   ${absPath}
` + hint
      );
    }
    seen[dedupKey] = absPath;
    if (parsed.suffix === "canvas" && parsed.id) {
      index.canvas[parsed.id] = absPath;
      if (artifact?.kind === "canvas" && parsed.legacyPathId) {
        registerCanvasAlias(parsed.legacyPathId, parsed.id);
      }
      if (artifact?.kind === "canvas") {
        for (const legacyId of artifact.migrationAliases?.legacyCanvasIds || []) registerCanvasAlias(legacyId, parsed.id);
      }
      canvasNameCount[parsed.name] = (canvasNameCount[parsed.name] || 0) + 1;
      if (canvasNameCount[parsed.name] === 1) {
        registerCanvasAlias(parsed.name, parsed.id);
      } else {
        delete canvasAliases[parsed.name];
        ambiguousCanvasAliases.add(parsed.name);
      }
    } else {
      index[parsed.suffix][parsed.name] = absPath;
    }
    if (parsed.suffix === "prototype" && parsed.folder) {
      protoFolders[parsed.name] = parsed.folder;
    }
    if (parsed.suffix === "flow" && parsed.inferredRoute) {
      flowRoutes[parsed.name] = parsed.inferredRoute;
    }
    if (parsed.suffix === "canvas" && parsed.inferredRoute) {
      const canvasKey = parsed.id || parsed.name;
      canvasRoutes[canvasKey] = parsed.inferredRoute;
    }
    if (parsed.suffix === "canvas" && parsed.group) {
      const groupKey = parsed.id || parsed.name;
      canvasGroups[groupKey] = parsed.group;
    }
    if (parsed.suffix === "story" && parsed.inferredRoute) {
      storyRoutes[parsed.name] = parsed.inferredRoute;
    }
  }
  return { index, protoFolders, flowRoutes, canvasRoutes, canvasAliases, canvasGroups, storyRoutes, dataScopeConflicts, artifactContexts, notebookArtifacts, scopeAliases };
}
function resolveTemplateVars(obj, vars) {
  if (typeof obj === "string") {
    let result = obj;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replaceAll(`\${${key}}`, value);
    }
    return result;
  }
  if (Array.isArray(obj)) return obj.map((item) => resolveTemplateVars(item, vars));
  if (obj !== null && typeof obj === "object") {
    const out = {};
    for (const [key, value] of Object.entries(obj)) {
      out[key] = resolveTemplateVars(value, vars);
    }
    return out;
  }
  return obj;
}
function computeTemplateVars(absPath, root, artifact = null) {
  const relPath = path12.relative(root, absPath).replace(/\\/g, "/");
  const currentDir = path12.dirname(relPath).replace(/\\/g, "/");
  const protoMatch = relPath.match(/^(src\/prototypes\/(?:[^/]+\.folder\/)?[^/]+)\//);
  const currentProto = protoMatch && !protoMatch[1].endsWith(".folder") ? protoMatch[1] : "";
  const folderMatch = relPath.match(/^(src\/prototypes\/[^/]+\.folder)\//);
  const currentProtoDir = folderMatch ? folderMatch[1] : "";
  if (artifact?.kind === "prototype") {
    return {
      currentDir,
      currentProto: artifact.folderPath,
      currentProtoDir: path12.posix.dirname(artifact.folderPath) === "." ? "" : path12.posix.dirname(artifact.folderPath)
    };
  }
  return { currentDir, currentProto, currentProtoDir };
}
function readAppConfigSource(appRoot) {
  for (const filePath of appConfigCandidates(appRoot)) {
    try {
      const parsed = parseJsonc5(fs11.readFileSync(filePath, "utf-8"), []);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
    }
  }
  return null;
}
function buildAppConfigModule(appRoot, coreRoot) {
  const raw = readAppConfigSource(appRoot) || readCoreConfigFile(coreRoot, APP_CONFIG_PRIMARY) || readCoreConfigFile(coreRoot, APP_CONFIG_LEGACY) || {};
  return `const appConfig = JSON.parse(${JSON.stringify(JSON.stringify(raw))})
export default appConfig
`;
}
function readConfig(root, coreRoot = root) {
  for (const configPath of appConfigCandidates(root)) {
    try {
      const raw = fs11.readFileSync(configPath, "utf-8");
      const errors = [];
      const config = parseJsonc5(raw, errors);
      if (errors.length > 0) return readBaselineConfig(coreRoot, configPath);
      const internalConfig = readCoreConfigFile(coreRoot, APP_CONFIG_PRIMARY) || readCoreConfigFile(coreRoot, APP_CONFIG_LEGACY);
      const internalAutoPlace = normalizeCanvasAutoPlace(internalConfig?.canvas?.autoPlace);
      const autoPlace = normalizeCanvasAutoPlace(config?.canvas?.autoPlace, internalAutoPlace);
      const resolved = getConfig(config);
      return {
        config: { ...resolved, canvas: { ...resolved.canvas, autoPlace } },
        configPath
      };
    } catch {
    }
  }
  return readBaselineConfig(coreRoot, resolveAppConfigPath(root));
}
function readBaselineConfig(root, configPath) {
  const baseline = readCoreConfigFile(root, APP_CONFIG_PRIMARY) || readCoreConfigFile(root, APP_CONFIG_LEGACY);
  if (baseline) return { config: getConfig(baseline), configPath };
  return { config: null, configPath };
}
function readModesConfig(root) {
  const fallback = {
    modes: [
      { name: "prototype", label: "Navigate", hue: "#2a2a2a" },
      { name: "inspect", label: "Develop", hue: "#7655a4" },
      { name: "present", label: "Collaborate", hue: "#2a9d8f" },
      { name: "plan", label: "Canvas", hue: "#4a7fad" }
    ]
  };
  const candidates = [
    path12.resolve(root, "packages/storyboard/toolbar.config.json"),
    path12.resolve(root, "packages/storyboard/configs/modes.config.json"),
    path12.resolve(root, "node_modules/@dfosco/hypercanvas/toolbar.config.json"),
    path12.resolve(root, "node_modules/@dfosco/hypercanvas/configs/modes.config.json")
  ];
  for (const filePath of candidates) {
    try {
      const raw = fs11.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.modes) && parsed.modes.length > 0) {
        return { modes: parsed.modes };
      }
    } catch {
    }
  }
  return fallback;
}
function readJsonFile(filePath) {
  try {
    const raw = fs11.readFileSync(filePath, "utf-8");
    const errors = [];
    const parsed = parseJsonc5(raw, errors);
    return errors.length === 0 ? parsed : null;
  } catch {
    return null;
  }
}
function readCoreConfigFile(root, filename) {
  for (const p of coreConfigFileCandidates(root, filename)) {
    const parsed = readJsonFile(p);
    if (parsed) return parsed;
  }
  return null;
}
function coreConfigFileCandidates(root, filename) {
  return [
    path12.resolve(root, `packages/storyboard/${filename}`),
    path12.resolve(root, `packages/hypercanvas/${filename}`),
    path12.resolve(root, `node_modules/@dfosco/hypercanvas/${filename}`)
  ];
}
function deepMergeBuild(target, source) {
  if (!source || typeof source !== "object") return target;
  if (!target || typeof target !== "object") return source;
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (sv && typeof sv === "object" && !Array.isArray(sv) && tv && typeof tv === "object" && !Array.isArray(tv)) {
      result[key] = deepMergeBuild(tv, sv);
    } else if (Array.isArray(sv) && Array.isArray(tv) && sv.length > 0 && tv.length > 0 && sv[0]?.id && tv[0]?.id) {
      const targetMap = new Map(tv.map((item) => [item.id, item]));
      for (const item of sv) {
        targetMap.set(item.id, item.id && targetMap.has(item.id) ? deepMergeBuild(targetMap.get(item.id), item) : item);
      }
      result[key] = [...targetMap.values()];
    } else {
      result[key] = sv;
    }
  }
  return result;
}
function buildUnifiedConfig(root, coreRoot = root) {
  const warnings = [];
  const coreToolbar = readCoreConfigFile(coreRoot, "toolbar.config.json") || {};
  const coreCommandPalette = readCoreConfigFile(coreRoot, "commandpalette.config.json") || {};
  const corePaste = readCoreConfigFile(coreRoot, "paste.config.json") || {};
  const coreWidgets = readCoreConfigFile(coreRoot, "widgets.config.json") || {};
  const coreTerminal = readCoreConfigFile(coreRoot, "terminal.config.json") || {};
  const { config: sbConfig } = readConfig(root, coreRoot);
  const rawSbConfig = readJsonFile(resolveAppConfigPath(root)) || {};
  const afterSbToolbar = rawSbConfig.toolbar ? deepMergeBuild(coreToolbar, sbConfig.toolbar) : coreToolbar;
  const afterSbCommandPalette = rawSbConfig.commandPalette ? deepMergeBuild(coreCommandPalette, sbConfig.commandPalette) : coreCommandPalette;
  const afterSbPaste = rawSbConfig.paste ? deepMergeBuild(corePaste, sbConfig.paste || {}) : corePaste;
  const afterSbWidgets = rawSbConfig.widgets ? deepMergeBuild(coreWidgets, sbConfig.widgets || {}) : coreWidgets;
  const rawCanvas = rawSbConfig.canvas || {};
  const sbTerminalLike = rawSbConfig.hotPool || rawCanvas.terminal || rawCanvas.agents ? {
    ...rawCanvas.terminal ? { terminal: sbConfig.canvas.terminal } : {},
    ...rawCanvas.agents ? { agents: sbConfig.canvas.agents } : {},
    ...rawSbConfig.hotPool ? { hotPool: sbConfig.hotPool } : {}
  } : null;
  const afterSbTerminal = sbTerminalLike ? deepMergeBuild(coreTerminal, sbTerminalLike) : coreTerminal;
  const userFiles = [
    { domain: "widgets", filename: "widgets.config.json" },
    { domain: "paste", filename: "paste.config.json" },
    { domain: "toolbar", filename: "toolbar.config.json" },
    { domain: "commandPalette", filename: "commandpalette.config.json" },
    { domain: "terminal", filename: "terminal.config.json" }
  ];
  const userConfigs = {};
  for (const { domain, filename } of userFiles) {
    const filePath = resolveConfigFilePath(root, filename);
    const parsed = readJsonFile(filePath);
    if (parsed) userConfigs[domain] = { data: parsed, filename };
  }
  const finalToolbar = userConfigs.toolbar ? deepMergeBuild(afterSbToolbar, userConfigs.toolbar.data) : afterSbToolbar;
  const finalCommandPalette = userConfigs.commandPalette ? deepMergeBuild(afterSbCommandPalette, userConfigs.commandPalette.data) : afterSbCommandPalette;
  const finalPaste = userConfigs.paste ? deepMergeBuild(afterSbPaste, userConfigs.paste.data) : afterSbPaste;
  const finalWidgets = userConfigs.widgets ? deepMergeBuild(afterSbWidgets, userConfigs.widgets.data) : afterSbWidgets;
  const finalTerminal = userConfigs.terminal ? deepMergeBuild(afterSbTerminal, userConfigs.terminal.data) : afterSbTerminal;
  const domainOverlapChecks = [
    { sbKey: "toolbar", domain: "toolbar", label: "toolbar.config.json" },
    { sbKey: "commandPalette", domain: "commandPalette", label: "commandpalette.config.json" },
    { sbKey: "paste", domain: "paste", label: "paste.config.json" },
    { sbKey: "widgets", domain: "widgets", label: "widgets.config.json" }
  ];
  for (const { sbKey, domain, label } of domainOverlapChecks) {
    if (rawSbConfig[sbKey] && userConfigs[domain]) {
      const overlaps = findOverlappingKeys(rawSbConfig[sbKey], userConfigs[domain].data);
      for (const key of overlaps) {
        warnings.push(`Config overlap: "${key}" is defined in both storyboard.config.json.${sbKey} and ${label} \u2014 ${label} wins.`);
      }
    }
  }
  if (userConfigs.terminal) {
    const rawTerminalConfig = userConfigs.terminal.data;
    const overlapSources = [
      {
        appValue: rawCanvas.terminal,
        terminalValue: rawTerminalConfig.terminal,
        prefix: "terminal",
        appSource: "storyboard.config.json.canvas.terminal",
        terminalSource: "terminal.config.json.terminal"
      },
      {
        appValue: rawCanvas.agents,
        terminalValue: rawTerminalConfig.agents,
        prefix: "agents",
        appSource: "storyboard.config.json.canvas.agents",
        terminalSource: "terminal.config.json.agents"
      },
      {
        appValue: rawSbConfig.hotPool,
        terminalValue: rawTerminalConfig.hotPool,
        prefix: "hotPool",
        appSource: "storyboard.config.json.hotPool",
        terminalSource: "terminal.config.json.hotPool"
      }
    ];
    for (const { appValue, terminalValue, prefix, appSource, terminalSource } of overlapSources) {
      for (const key of findConflictingLeafPaths(appValue, terminalValue, prefix)) {
        warnings.push(`Config overlap: "${key}" differs between ${appSource} and ${terminalSource} \u2014 terminal.config.json wins.`);
      }
    }
  }
  const sbCanvas = sbConfig?.canvas || {};
  const unified = {
    ...sbConfig || {},
    toolbar: finalToolbar,
    commandPalette: finalCommandPalette,
    paste: finalPaste,
    widgets: finalWidgets,
    hotPool: finalTerminal?.hotPool || sbConfig?.hotPool || {},
    canvas: {
      ...sbCanvas,
      terminal: deepMergeBuild(sbCanvas.terminal || {}, finalTerminal.terminal || {}),
      agents: deepMergeBuild(sbCanvas.agents || {}, finalTerminal.agents || {}),
      ...finalTerminal.showAgentsInAddMenu !== void 0 ? { showAgentsInAddMenu: finalTerminal.showAgentsInAddMenu } : {}
    }
  };
  return { unified, warnings };
}
function findOverlappingKeys(a, b, prefix = "") {
  const overlaps = [];
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return overlaps;
  for (const key of Object.keys(a)) {
    if (key in b) {
      const path15 = prefix ? `${prefix}.${key}` : key;
      overlaps.push(path15);
    }
  }
  return overlaps;
}
function findConflictingLeafPaths(a, b, prefix) {
  if (a === void 0 || b === void 0) return [];
  const isRecordValue = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  if (isRecordValue(a) && isRecordValue(b)) {
    const conflicts = [];
    for (const key of Object.keys(a)) {
      if (!(key in b)) continue;
      conflicts.push(...findConflictingLeafPaths(a[key], b[key], `${prefix}.${key}`));
    }
    return conflicts;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length === b.length && a.every((value, index) => jsonValuesEqual(value, b[index]))) return [];
    return [prefix];
  }
  return jsonValuesEqual(a, b) ? [] : [prefix];
}
function jsonValuesEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => jsonValuesEqual(value, b[index]));
  }
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((key) => key in b && jsonValuesEqual(a[key], b[key]));
}
function extractPrototypeKnobs(parsed) {
  if (Array.isArray(parsed?.meta?.knobs)) return parsed.meta.knobs;
  if (Array.isArray(parsed?.knobs)) return parsed.knobs;
  return [];
}
function extractComponentKnobs(parsed) {
  if (Array.isArray(parsed?.knobs)) return parsed.knobs;
  if (Array.isArray(parsed?.meta?.knobs)) return parsed.meta.knobs;
  return [];
}
function viteModulePath(absPath, moduleRoot) {
  const relative = path12.relative(moduleRoot, absPath);
  if (relative && relative !== ".." && !relative.startsWith(`..${path12.sep}`) && !path12.isAbsolute(relative)) {
    return "/" + relative.replace(/\\/g, "/");
  }
  return "/@fs/" + path12.resolve(absPath).replace(/\\/g, "/");
}
function isPathInside(root, candidate) {
  const relative = path12.relative(root, candidate);
  return relative === "" || relative !== ".." && !relative.startsWith(`..${path12.sep}`) && !path12.isAbsolute(relative);
}
function resolveNotebookExtensionEntry(root, entry, directory, description, explicit = true) {
  const normalized = typeof entry === "string" ? entry.replaceAll("\\", "/") : "";
  const segments = normalized.split("/");
  const extension = path12.extname(normalized).toLowerCase();
  const supportedExtensions = /* @__PURE__ */ new Set([".js", ".jsx", ".mjs", ".ts", ".tsx", ".mts"]);
  if (!normalized.startsWith(`${directory}/`) && !normalized.startsWith(`backstage/${directory}/`) || normalized.startsWith("/") || segments.some((segment) => !segment || segment === "." || segment === "..") || !supportedExtensions.has(extension)) {
    throw new Error(`[storyboard] Invalid ${description} entry "${entry}". Use a JavaScript/TypeScript module path inside ${directory}/.`);
  }
  const notebookRoot = fs11.realpathSync.native(root);
  const absPath = resolveNotebookSupportPath(notebookRoot, normalized, { preferRoot: explicit });
  const allowedRoot = path12.resolve(notebookRoot, absPath.startsWith(path12.join(notebookRoot, "backstage") + path12.sep) ? `backstage/${directory}` : directory);
  if (!isPathInside(allowedRoot, absPath)) {
    throw new Error(`[storyboard] Invalid ${description} entry "${entry}". It must stay inside ${directory}/.`);
  }
  try {
    const realRoot = fs11.realpathSync.native(notebookRoot);
    const realAllowedRoot = fs11.realpathSync.native(allowedRoot);
    const realPath = fs11.realpathSync.native(absPath);
    if (!isPathInside(realRoot, realAllowedRoot) || !isPathInside(realAllowedRoot, realPath) || !fs11.statSync(realPath).isFile()) {
      throw new Error("outside the allowed extension directory or not a file");
    }
  } catch (error) {
    throw new Error(`[storyboard] Could not resolve ${description} entry "${entry}" under ${notebookRoot}: ${error.message}`);
  }
  return absPath;
}
function generateNotebookExtensionMaps({ config, unifiedConfig, root, moduleRoot, imports, declarations, portable = false }) {
  let i = 0;
  const widgetDefinitions = {
    ...config?.widgets || {},
    ...unifiedConfig?.widgets?.widgets || {}
  };
  const widgetEntries = [];
  let hasLazyWidget = false;
  for (const [type, rawDefinition] of Object.entries(widgetDefinitions)) {
    if (!rawDefinition || typeof rawDefinition !== "object" || Array.isArray(rawDefinition)) continue;
    const { entry, ...definition } = rawDefinition;
    const variable = `_notebookWidget${i++}`;
    declarations.push(`const ${variable} = ${JSON.stringify(definition)}`);
    if (entry !== void 0) {
      const absPath = resolveNotebookExtensionEntry(root, entry, "widgets", `widget "${type}"`);
      const modulePath = viteModulePath(absPath, moduleRoot);
      declarations.push(`${variable}.component = __notebookLazy(() => import(${JSON.stringify(modulePath)}))`);
      hasLazyWidget = true;
    }
    widgetEntries.push(`  ${JSON.stringify(type)}: ${variable}`);
  }
  if (hasLazyWidget) imports.push(`import { lazy as __notebookLazy } from 'react'`);
  declarations.push(`const notebookWidgets = {
${widgetEntries.join(",\n")}
}`);
  const tools = unifiedConfig?.toolbar?.tools || {};
  const handlerEntries = /* @__PURE__ */ new Map();
  for (const [toolId, toolConfig] of Object.entries(tools)) {
    const handlerRef = toolConfig?.handler;
    if (typeof handlerRef !== "string" || !handlerRef.startsWith("custom:")) continue;
    const handlerId = handlerRef.slice("custom:".length);
    if (!/^[A-Za-z0-9_-]+$/.test(handlerId)) {
      throw new Error(`[storyboard] Invalid custom tool handler id "${handlerId}" in toolbar tool "${toolId}".`);
    }
    const entry = toolConfig.entry || `tools/handlers/${handlerId}.js`;
    if (handlerEntries.has(handlerId) && handlerEntries.get(handlerId).entry !== entry) {
      throw new Error(`[storyboard] Custom tool handler "${handlerId}" has conflicting entries.`);
    }
    handlerEntries.set(handlerId, { entry, explicit: toolConfig.entry !== void 0 });
  }
  const toolEntries = [];
  for (const [handlerId, { entry, explicit }] of handlerEntries) {
    if (portable) {
      toolEntries.push(`  ${JSON.stringify(handlerId)}: () => Promise.reject(new Error('UNSUPPORTED_NOTEBOOK_CAPABILITY: authoring tool handlers require the Hypercanvas host.'))`);
      continue;
    }
    let absPath;
    try {
      absPath = resolveNotebookExtensionEntry(root, entry, "tools", `tool handler "${handlerId}"`, explicit);
    } catch (error) {
      if (explicit) throw error;
      console.warn(`[storyboard] ${error.message}; custom tool "${handlerId}" will not load.`);
      continue;
    }
    toolEntries.push(`  ${JSON.stringify(handlerId)}: () => import(${JSON.stringify(viteModulePath(absPath, moduleRoot))})`);
  }
  declarations.push(`const notebookToolHandlers = {
${toolEntries.join(",\n")}
}`);
}
function buildDiscoveryResult({ index, protoFolders, flowRoutes, canvasRoutes, canvasAliases, canvasGroups, storyRoutes, dataScopeConflicts = [], artifactContexts = {}, notebookArtifacts = [], scopeAliases = {} }, root, moduleRoot = root, buildOptions = {}) {
  const viewportScope = Object.keys(index.canvas || {}).length ? canvasViewportScope(root) : null;
  const discovery = {
    flows: {},
    objects: {},
    records: {},
    prototypes: {},
    prototypeKnobs: {},
    componentKnobs: {},
    folders: {},
    canvases: {},
    canvasAliases: canvasAliases || {},
    scopeAliases: scopeAliases || {},
    stories: {}
  };
  const INDEX_KEYS = ["flow", "object", "record", "prototype", "folder", "canvas"];
  const resultKeys = {
    flow: "flows",
    object: "objects",
    record: "records",
    prototype: "prototypes",
    folder: "folders",
    canvas: "canvases"
  };
  const resolvedFlowRoutes = {};
  const gitPaths = [
    ...Object.values(index.prototype || {}),
    ...Object.values(index.canvas || {})
  ];
  const gitMeta = buildOptions.readGitMetadata?.(root, gitPaths) ?? /* @__PURE__ */ new Map();
  const canvasMetaByDir = {};
  for (const [, absPath] of Object.entries(index["canvas-meta"] || {})) {
    try {
      const raw = fs11.readFileSync(absPath, "utf-8");
      const parsed = parseJsonc5(raw);
      if (parsed) {
        const dirPath = path12.dirname(absPath).replace(/\\/g, "/");
        const canvasRelDir = dirPath.replace(/^.*?src\/canvas\//, "");
        canvasMetaByDir[canvasRelDir] = parsed;
        const canvasRelDirPublic = canvasRelDir.split("/").filter((seg) => seg !== "drafts").join("/");
        if (canvasRelDirPublic !== canvasRelDir) canvasMetaByDir[canvasRelDirPublic] = parsed;
      }
    } catch {
    }
  }
  for (const suffix of INDEX_KEYS) {
    for (const [name, absPath] of Object.entries(index[suffix])) {
      const artifact = artifactContexts[absPath];
      let raw;
      try {
        raw = fs11.readFileSync(absPath, "utf-8");
      } catch (error) {
        if (error.code === "ENOENT") continue;
        throw error;
      }
      let parsed = suffix === "canvas" ? materializeFromText(raw) : parseJsonc5(raw);
      if (suffix === "prototype" && parsed && !parsed.gitAuthor) {
        const meta = gitMeta.get(absPath);
        if (meta?.gitAuthor) {
          parsed = { ...parsed, gitAuthor: meta.gitAuthor };
        }
      }
      if (suffix === "prototype" && parsed && artifact?.kind === "prototype") {
        parsed = {
          ...parsed,
          dirName: name,
          route: artifact.route,
          artifactId: artifact.id
        };
      }
      if ((suffix === "prototype" || suffix === "canvas") && parsed) {
        const meta = gitMeta.get(absPath);
        if (meta?.lastModified) {
          parsed = { ...parsed, lastModified: meta.lastModified };
        }
      }
      if (suffix === "prototype" && protoFolders[name]) {
        parsed = { ...parsed, folder: protoFolders[name] };
      }
      if (suffix === "prototype") {
        const protoDir = path12.dirname(absPath);
        const protoConfigFiles = [
          { filename: "toolbar.config.json", key: "toolbarConfig" },
          { filename: "commandpalette.config.json", key: "commandPaletteConfig" },
          { filename: "widgets.config.json", key: "widgetsConfig" },
          { filename: "paste.config.json", key: "pasteConfig" }
        ];
        for (const { filename, key } of protoConfigFiles) {
          const cfgPath = path12.join(protoDir, filename);
          if (fs11.existsSync(cfgPath)) {
            try {
              const cfgRaw = fs11.readFileSync(cfgPath, "utf-8");
              const cfg = parseJsonc5(cfgRaw);
              if (cfg) {
                parsed = { ...parsed, [key]: cfg };
              }
            } catch {
            }
          }
        }
      }
      if (suffix === "flow" && flowRoutes[name] && !parsed?.route) {
        parsed = { ...parsed, _route: flowRoutes[name] };
      }
      if (suffix === "flow") {
        const route = parsed?.route || parsed?._route || null;
        if (route) {
          resolvedFlowRoutes[name] = { route, isDefault: parsed?.meta?.default === true };
        }
      }
      if (suffix === "canvas" && parsed && !parsed.gitAuthor) {
        const meta = gitMeta.get(absPath);
        if (meta?.gitAuthor) {
          parsed = { ...parsed, gitAuthor: meta.gitAuthor };
        }
      }
      if (suffix === "canvas") {
        parsed = { ...parsed, _viewportScope: viewportScope };
        if (canvasRoutes[name]) {
          parsed = { ...parsed, _route: canvasRoutes[name] };
        }
        if (canvasGroups[name]) {
          parsed = { ...parsed, _group: canvasGroups[name] };
        }
        if (canvasGroups[name] && canvasMetaByDir[canvasGroups[name]]) {
          parsed = { ...parsed, _canvasMeta: canvasMetaByDir[canvasGroups[name]] };
        }
        const folderDirMatch = path12.relative(root, absPath).replace(/\\/g, "/").match(/(?:^|\/)src\/(?:prototypes|canvas)\/([^/]+)\.folder\//);
        if (folderDirMatch) {
          parsed = { ...parsed, _folder: folderDirMatch[1] };
        }
        if (parsed?.jsx) {
          const jsxPath = path12.resolve(path12.dirname(absPath), parsed.jsx);
          if (fs11.existsSync(jsxPath)) {
            const relJsx = viteModulePath(jsxPath, moduleRoot);
            parsed = { ...parsed, _jsxModule: relJsx };
          } else {
            console.warn(
              `[storyboard-data] Canvas "${name}" references JSX file "${parsed.jsx}" but it was not found at ${jsxPath}`
            );
          }
        }
      }
      const templateVars = computeTemplateVars(absPath, root, artifact);
      if (!templateVars.currentProto && raw.includes("${currentProto}")) {
        console.warn(
          `[storyboard-data] \${currentProto} used in "${path12.relative(root, absPath)}" but file is not inside a prototype directory. Variable resolves to empty string.`
        );
      }
      if (!templateVars.currentProtoDir && raw.includes("${currentProtoDir}")) {
        console.warn(
          `[storyboard-data] \${currentProtoDir} used in "${path12.relative(root, absPath)}" but file is not inside a .folder directory. Variable resolves to empty string.`
        );
      }
      parsed = resolveTemplateVars(parsed, templateVars);
      if (suffix === "prototype") {
        const knobs = extractPrototypeKnobs(parsed);
        discovery.prototypeKnobs[name] = knobs;
        const routeKey = typeof artifact?.route === "string" ? artifact.route.split("/").filter(Boolean)[0] : null;
        if (routeKey) {
          let decoded = routeKey;
          try {
            decoded = decodeURIComponent(routeKey);
          } catch {
          }
          if (!(decoded in discovery.prototypeKnobs)) discovery.prototypeKnobs[decoded] = knobs;
        }
      }
      discovery[resultKeys[suffix]][name] = parsed;
    }
  }
  for (const artifact of notebookArtifacts) {
    if (artifact.kind !== "prototype" || !artifact.available) continue;
    const name = artifactFolderLogicalName(path12.posix.basename(artifact.folderPath));
    if (!name) continue;
    if (discovery.prototypes[name]) continue;
    discovery.prototypes[name] = {
      dirName: name,
      route: artifact.route,
      artifactId: artifact.id,
      title: artifact.title
    };
  }
  for (const [name, absPath] of Object.entries(index.component || {})) {
    const raw = fs11.readFileSync(absPath, "utf-8");
    let parsed = parseJsonc5(raw);
    parsed = resolveTemplateVars(parsed, computeTemplateVars(absPath, root));
    discovery.componentKnobs[name] = extractComponentKnobs(parsed);
  }
  for (const [name, absPath] of Object.entries(index.story || {})) {
    const relModule = viteModulePath(absPath, moduleRoot);
    const storyMeta = { _storyModule: relModule, _exportNames: parseStoryExportNames(absPath) };
    if (storyRoutes[name]) {
      storyMeta._route = storyRoutes[name];
    }
    const artifact = artifactContexts[absPath];
    if (artifact?.kind === "component") {
      storyMeta._componentId = artifact.id;
      storyMeta._componentRoute = artifact.route;
      storyMeta._componentName = artifact.title;
      storyMeta._storyFile = path12.posix.relative(artifact.folderPath, path12.relative(root, absPath).replaceAll("\\", "/"));
    }
    discovery.stories[name] = storyMeta;
  }
  discovery._resolvedFlowRoutes = resolvedFlowRoutes;
  if (dataScopeConflicts.length) discovery._dataScopeConflicts = dataScopeConflicts;
  return discovery;
}
function generateModule(buildResult, root, applicationRoot = root, buildOptions = {}) {
  const discovery = buildDiscoveryResult(buildResult, root, applicationRoot, buildOptions);
  const declarations = [];
  const INDEX_KEYS = [
    ["flow", "flows"],
    ["object", "objects"],
    ["record", "records"],
    ["prototype", "prototypes"],
    ["folder", "folders"],
    ["canvas", "canvases"]
  ];
  const entries = { flow: [], object: [], record: [], prototype: [], folder: [], canvas: [] };
  const storyEntries = [];
  const resolvedFlowRoutes = discovery._resolvedFlowRoutes || {};
  let i = 0;
  for (const [suffix, key] of INDEX_KEYS) {
    for (const [name, parsed] of Object.entries(discovery[key])) {
      const varName = `_d${i++}`;
      if (suffix === "canvas" && parsed._jsxModule) {
        declarations.push(`const ${varName} = Object.assign(${JSON.stringify(parsed)}, { _jsxImport: () => import(${JSON.stringify(parsed._jsxModule)}) })`);
      } else {
        declarations.push(`const ${varName} = ${JSON.stringify(parsed)}`);
      }
      entries[suffix].push(`  ${JSON.stringify(name)}: ${varName}`);
    }
  }
  for (const [name, storyMeta] of Object.entries(discovery.stories || {})) {
    const varName = `_d${i++}`;
    declarations.push(
      `const ${varName} = Object.assign(${JSON.stringify(storyMeta)}, { _storyImport: () => import(${JSON.stringify(storyMeta._storyModule)}) })`
    );
    storyEntries.push(`  ${JSON.stringify(name)}: ${varName}`);
  }
  const imports = [
    `import { init } from '@dfosco/hypercanvas/core/data/loader'`,
    `import { initKnobs } from '@dfosco/hypercanvas/core/knobs/discovery'`
  ];
  const initCalls = [
    `init({ flows, objects, records, prototypes, folders, canvases, stories, scopeAliases })`,
    `initKnobs({ prototypeKnobs, componentKnobs })`
  ];
  const { unified: unifiedConfig, warnings: configWarnings } = buildUnifiedConfig(root, applicationRoot);
  for (const w of configWarnings) {
    console.warn(`[storyboard] \u26A0 ${w}`);
  }
  const { config } = readConfig(root, applicationRoot);
  generateNotebookExtensionMaps({ config, unifiedConfig, root, moduleRoot: applicationRoot, imports, declarations, portable: buildOptions.portable === true });
  imports.push(`import { initConfig } from '@dfosco/hypercanvas/core/stores/configStore'`);
  initCalls.push(`initConfig(${JSON.stringify(unifiedConfig)})`);
  if (config?.featureFlags && Object.keys(config.featureFlags).length > 0) {
    imports.push(`import { initFeatureFlags } from '@dfosco/hypercanvas/core/stores/featureFlags'`);
    initCalls.push(`initFeatureFlags(${JSON.stringify(config.featureFlags)})`);
  }
  if (config?.plugins && Object.keys(config.plugins).length > 0) {
    imports.push(`import { initPlugins } from '@dfosco/hypercanvas/core/stores/plugins'`);
    initCalls.push(`initPlugins(${JSON.stringify(config.plugins)})`);
  }
  if (config?.modes) {
    imports.push(`import { initModesConfig, registerMode, syncModeClasses, initTools } from '@dfosco/hypercanvas/core/modes/modes'`);
    initCalls.push(`initModesConfig(${JSON.stringify(config.modes)})`);
    if (config.modes.enabled) {
      imports.push(`import '@dfosco/hypercanvas/modes.css'`);
      const modesConfig = readModesConfig(root);
      const modes = config.modes.defaults || modesConfig.modes;
      for (const m of modes) {
        initCalls.push(`registerMode(${JSON.stringify(m.name)}, { label: ${JSON.stringify(m.label)} })`);
      }
      initCalls.push(`syncModeClasses()`);
    }
  }
  if (config?.ui) {
    imports.push(`import { initUIConfig } from '@dfosco/hypercanvas/core/stores/uiConfig'`);
    initCalls.push(`initUIConfig(${JSON.stringify(config.ui)})`);
  }
  if (config?.customerMode) {
    imports.push(`import { initCustomerModeConfig } from '@dfosco/hypercanvas/core/stores/customerModeConfig'`);
    initCalls.push(`initCustomerModeConfig(${JSON.stringify(config.customerMode)})`);
  }
  const clientToolbarPath = resolveConfigFilePath(root, "toolbar.config.json");
  let clientToolbarOverrides = null;
  try {
    if (fs11.existsSync(clientToolbarPath)) {
      const raw = fs11.readFileSync(clientToolbarPath, "utf-8");
      const errors = [];
      const parsed = parseJsonc5(raw, errors);
      if (parsed && errors.length === 0) {
        clientToolbarOverrides = parsed;
      }
    }
  } catch {
  }
  imports.push(`import { setClientToolbarOverrides } from '@dfosco/hypercanvas/core/stores/toolbarConfigStore'`);
  initCalls.push(`setClientToolbarOverrides(${JSON.stringify(clientToolbarOverrides)})`);
  const routeGroups = {};
  for (const [name, { route, isDefault }] of Object.entries(resolvedFlowRoutes)) {
    if (!routeGroups[route]) routeGroups[route] = [];
    routeGroups[route].push({ name, isDefault });
  }
  for (const [route, flows] of Object.entries(routeGroups)) {
    if (flows.length > 1) {
      const defaults = flows.filter((f) => f.isDefault);
      if (defaults.length > 1) {
        console.warn(
          `[storyboard-data] Warning: Route "${route}" has ${defaults.length} flows with meta.default: true.
  Only one flow per route should be marked as default.`
        );
      }
    }
  }
  return [
    imports.join("\n"),
    "",
    declarations.join("\n"),
    "",
    `const flows = {
${entries.flow.join(",\n")}
}`,
    `const objects = {
${entries.object.join(",\n")}
}`,
    `const records = {
${entries.record.join(",\n")}
}`,
    `const prototypes = {
${entries.prototype.join(",\n")}
}`,
    `const prototypeKnobs = ${JSON.stringify(discovery.prototypeKnobs || {})}`,
    `const componentKnobs = ${JSON.stringify(discovery.componentKnobs || {})}`,
    `const folders = {
${entries.folder.join(",\n")}
}`,
    `const canvases = {
${entries.canvas.join(",\n")}
}`,
    `const stories = {
${storyEntries.join(",\n")}
}`,
    "",
    `// Legacy basename \u2192 canonical ID aliases (only unique basenames)`,
    `const canvasAliases = ${JSON.stringify(discovery.canvasAliases || {})}`,
    `const scopeAliases = ${JSON.stringify(discovery.scopeAliases || {})}`,
    "",
    "// Backward-compatible alias",
    "const scenes = flows",
    "",
    initCalls.join("\n"),
    "",
    `export { flows, scenes, objects, records, prototypes, prototypeKnobs, componentKnobs, folders, canvases, canvasAliases, scopeAliases, stories, notebookWidgets, notebookToolHandlers }`,
    `export const index = { flows, scenes, objects, records, prototypes, prototypeKnobs, componentKnobs, folders, canvases, canvasAliases, scopeAliases, stories, notebookWidgets, notebookToolHandlers }`,
    `export default index`,
    "",
    "// Live-patch canvas data on Hypercanvas server events so SPA navigation shows fresh state",
    'if (typeof window !== "undefined") {',
    "  const storyModuleUrl = (modulePath, timestamp) => {",
    '    const relative = modulePath.replace("/@fs//", "/@fs/").replace(/^\\/+/, "")',
    "    const url = new URL(relative, new URL(import.meta.env.BASE_URL, window.location.origin))",
    '    if (timestamp) url.searchParams.set("t", timestamp)',
    "    return url.href",
    "  }",
    '  window.addEventListener("storyboard:canvas-file-changed", (event) => {',
    "    const data = event.detail",
    "    if (!data) return",
    "    const id = data.canvasId || data.name",
    "    if (data.removed) {",
    "      delete canvases[id]",
    "    } else if (data.metadata) {",
    "      // Merge into existing entry to preserve build-time fields (_jsxModule, _jsxImport, etc.)",
    "      canvases[id] = canvases[id]",
    "        ? Object.assign({}, canvases[id], data.metadata)",
    "        : data.metadata",
    "    }",
    "    init({ flows, objects, records, prototypes, folders, canvases, stories, scopeAliases })",
    "    initKnobs({ prototypeKnobs, componentKnobs })",
    '    document.dispatchEvent(new CustomEvent("storyboard:canvas-index-changed"))',
    "  })",
    '  window.addEventListener("storyboard:story-file-changed", (event) => {',
    "    const data = event.detail",
    "    if (!data) return",
    "    if (data.stories) {",
    "      for (const name of Object.keys(stories)) if (!(name in data.stories)) delete stories[name]",
    "      for (const [name, metadata] of Object.entries(data.stories)) {",
    "        // Keep untouched imports and React previews stable while reconciling the full index.",
    "        if (metadata._storyModule !== data.changedModule && JSON.stringify(stories[name]) === JSON.stringify(metadata)) continue",
    "        const moduleUrl = storyModuleUrl(metadata._storyModule, data.timestamp)",
    "        stories[name] = { ...metadata, _storyImport: () => import(/* @vite-ignore */ moduleUrl) }",
    "      }",
    "    } else if (data.removed) {",
    "      delete stories[data.name]",
    "    } else {",
    "      const moduleUrl = storyModuleUrl(data._storyModule, data.timestamp)",
    "      stories[data.name] = { ...stories[data.name], ...data,",
    "        _storyImport: () => import(/* @vite-ignore */ moduleUrl) }",
    "    }",
    "    init({ flows, objects, records, prototypes, folders, canvases, stories, scopeAliases })",
    "    initKnobs({ prototypeKnobs, componentKnobs })",
    '    document.dispatchEvent(new CustomEvent("storyboard:story-index-changed"))',
    "  })",
    "}",
    "",
    "// Filesystem watcher updates arrive through Vite custom HMR events.",
    'if (import.meta.hot && typeof window !== "undefined") {',
    '  import.meta.hot.on("storyboard:canvas-file-changed", (data) => window.dispatchEvent(new CustomEvent("storyboard:canvas-file-changed", { detail: data })))',
    '  import.meta.hot.on("storyboard:story-file-changed", (data) => window.dispatchEvent(new CustomEvent("storyboard:story-file-changed", { detail: data })))',
    '  import.meta.hot.on("storyboard:prototype-index-changed", () => document.dispatchEvent(new CustomEvent("storyboard:prototype-index-changed")))',
    "}"
  ].join("\n");
}

// packages/storyboard/src/internals/vite/prototype-css.js
import fs12 from "node:fs";
import path13 from "node:path";
import { parse as parseJsonc6 } from "jsonc-parser";
function inside2(root, file) {
  const relative = path13.relative(root, file);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path13.sep}`) && !path13.isAbsolute(relative);
}
function resolvePrototypeCss(directory, metadata) {
  const css = metadata?.css ?? metadata?.meta?.css;
  if (css === void 0) return null;
  if (!css || typeof css !== "object" || Array.isArray(css)) throw new Error("Prototype css must be an object with library and entry");
  if (Object.keys(css).some((key) => !["library", "entry"].includes(key))) throw new Error("Unknown prototype css option; use library and entry");
  const { library, entry } = css;
  if (typeof library !== "string" || !/^(?:css|(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+)$/.test(library)) {
    throw new Error('Prototype css.library must be "css" or an npm package name');
  }
  if (typeof entry !== "string" || !entry.startsWith("./") || !entry.endsWith(".css") || /[\0?#\\]/.test(entry)) {
    throw new Error("Prototype css.entry must be a relative ./stylesheet.css path");
  }
  const root = fs12.realpathSync(directory);
  const candidate = path13.resolve(root, entry);
  if (!inside2(root, candidate)) throw new Error("Prototype CSS entry must stay inside its prototype directory");
  if (!fs12.existsSync(candidate) || !fs12.statSync(candidate).isFile()) throw new Error(`Prototype CSS entry is missing: ${candidate}`);
  const file = fs12.realpathSync(candidate);
  if (!inside2(root, file)) throw new Error("Prototype CSS symlink escapes its prototype directory");
  let packageFile = null;
  if (library !== "css") {
    packageFile = path13.join(root, "package.json");
    if (!fs12.existsSync(packageFile)) throw new Error(`Declare ${library} in ${packageFile} and install it before loading this prototype`);
    const pkg = JSON.parse(fs12.readFileSync(packageFile, "utf8"));
    const version = pkg.dependencies?.[library] || pkg.devDependencies?.[library];
    if (typeof version !== "string" || !version.trim()) throw new Error(`Prototype package.json must explicitly declare its ${library} dependency`);
  }
  return { library, entry: file, packageFile };
}
function prototypeCssTransform(code, id) {
  const [file, query = ""] = id.split("?", 2);
  const params = new URLSearchParams(query);
  if (params.has("raw") || params.has("url") || params.has("worker")) return null;
  if (!/\.(?:[jt]sx?|mdx)$/.test(file) || !file.split(path13.sep).includes("prototypes")) return null;
  let directory = path13.dirname(file);
  while (directory !== path13.dirname(directory) && path13.basename(directory) !== "prototypes") {
    if (!fs12.existsSync(directory)) return null;
    const files = fs12.readdirSync(directory).filter((name) => /\.prototype\.jsonc?$/.test(name)).sort();
    const configured = files.flatMap((name) => {
      const metadataFile = path13.join(directory, name);
      const errors = [];
      const metadata = parseJsonc6(fs12.readFileSync(metadataFile, "utf8"), errors);
      if (errors.length) throw new Error(`Invalid prototype metadata: ${metadataFile}`);
      if (metadata?.css === void 0 && metadata?.meta?.css === void 0) return [];
      return [{ metadataFile, css: resolvePrototypeCss(directory, metadata) }];
    });
    if (configured.length > 1) throw new Error(`Only one CSS declaration is allowed per prototype directory: ${directory}`);
    if (configured.length === 1) {
      const { metadataFile, css } = configured[0];
      this?.addWatchFile?.(metadataFile);
      this?.addWatchFile?.(css.entry);
      if (css.packageFile) this?.addWatchFile?.(css.packageFile);
      const frontmatter = file.endsWith(".mdx") ? /^(?:---\r?\n)[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(code)?.[0] || "" : "";
      return { code: `${frontmatter}import ${JSON.stringify(css.entry)};
${code.slice(frontmatter.length)}`, map: null };
    }
    directory = path13.dirname(directory);
  }
  return null;
}

// packages/storyboard/src/internals/vite/statefullyCompatibility.js
function statefullyCompatibilityModule({ coreSource, reactSource, helperSource, react: react2 = false }) {
  if (react2) return `
import { createElement, useEffect, useMemo } from 'react';
import { PrototypeProvider as OriginalProvider } from ${JSON.stringify(reactSource)};
export * from ${JSON.stringify(reactSource)};
import { createSessionStore } from '@dfosco/statefully';
import { createCompatibleSession } from ${JSON.stringify(helperSource)};
export function PrototypeProvider(props) {
  const { session: supplied, prototype = null, dataset = null, route = null } = props;
  const session = useMemo(() => supplied ? createCompatibleSession(supplied) : createSessionStore({ namespace: 'statefully:' + (prototype ?? 'default') + ':' + (dataset ?? 'default'), route }), [supplied, prototype, dataset, route]);
  useEffect(() => () => { if (!supplied) session.dispose(); }, [session, supplied]);
  return createElement(OriginalProvider, { ...props, session });
}
`;
  return `
import * as core from ${JSON.stringify(coreSource)};
export * from ${JSON.stringify(coreSource)};
import { createCompatibleSession, updateParamString } from ${JSON.stringify(helperSource)};
export { updateParamString };
export const getDefaultSession = () => createCompatibleSession(core.getDefaultSession());
export const createSessionStore = options => createCompatibleSession(core.createSessionStore(options));
export const getParam = key => getDefaultSession().getParam(key);
export const getAllParams = () => getDefaultSession().getAllParams();
export const readParams = () => new URLSearchParams(getAllParams());
export const setParam = (key, value) => getDefaultSession().setParam(key, value);
export const removeParam = key => getDefaultSession().removeParam(key);
export const updateParams = changes => getDefaultSession().updateParams(changes);
export const createKnobStore = (definitions = [], options = {}) => core.createKnobStore(definitions, { ...options, session: createCompatibleSession(options.session || core.getDefaultSession()) });
const knobs = () => createKnobStore(core.listKnobs());
export const getKnob = (...args) => knobs().getKnob(...args);
export const setKnob = (...args) => knobs().setKnob(...args);
export const clearKnob = (...args) => knobs().clearKnob(...args);
export const resolveKnob = (id, options = {}) => knobs().resolve(id, options.route ?? options.scope);
export const applyKnobPreset = (values, options = {}) => knobs().applyPreset(values, options.route ?? options.scope);
export const resetKnobs = (options = {}) => knobs().reset(options.route ?? options.scope);
export const setKnobValue = (id, value, options = {}) => options.session || !options.target
  ? createKnobStore(options.definition ? [{ ...options.definition, id }] : core.listKnobs(), options).setKnob(id, value, options.route ?? options.scope)
  : core.setKnobValue(id, value, options);
export const clearKnobValue = (id, options = {}) => options.session || !options.target
  ? createKnobStore(options.definition ? [{ ...options.definition, id }] : core.listKnobs(), options).clearKnob(id, options.route ?? options.scope)
  : core.clearKnobValue(id, options);
`;
}

// packages/storyboard/src/core/stores/themeBootstrap.ts
var THEME_STORAGE_KEY = "sb-color-scheme";
var SYNC_STORAGE_KEY = "sb-theme-sync";
var SYNC_DEFAULTS_VERSION_KEY = "sb-theme-sync-defaults-version";
var SYNC_DEFAULTS_VERSION = "1";
var LEGACY_SURFACE_ATTR = {
  content: "data-sb-theme",
  toolbar: "data-sb-toolbar-theme",
  codeBoxes: "data-sb-code-theme"
};
function asRecord(value) {
  return value !== null && typeof value === "object" ? value : {};
}
function renderInlineBootstrapScript(themesCfg) {
  const config = asRecord(themesCfg);
  const inlined = JSON.stringify({
    themes: config.themes || {},
    surfaces: config.surfaces || {},
    default: config.default || "system"
  });
  const legacy = JSON.stringify(LEGACY_SURFACE_ATTR);
  const themeKey = JSON.stringify(THEME_STORAGE_KEY);
  const syncKey = JSON.stringify(SYNC_STORAGE_KEY);
  const syncDefaultsVersionKey = JSON.stringify(SYNC_DEFAULTS_VERSION_KEY);
  const syncDefaultsVersion = JSON.stringify(SYNC_DEFAULTS_VERSION);
  const hueVariables = JSON.stringify(themeHueVariables(config));
  return [
    "<style>",
    "  html { background-color: #ffffff; }",
    '  html[data-color-mode="dark"] { background-color: #0d1117; }',
    "  @media (prefers-color-scheme: dark) {",
    '    html[data-color-mode="auto"] { background-color: #0d1117; }',
    "  }",
    "</style>",
    "<script>",
    "(function(){",
    `  var CFG = ${inlined};`,
    `  var LEGACY = ${legacy};`,
    "  var doc = document; var root = doc.documentElement;",
    `  var HUES = ${hueVariables}; for (var hp in HUES) root.style.setProperty(hp, HUES[hp]);`,
    `  var stored = null; try { stored = localStorage.getItem(${themeKey}); } catch(_) {}`,
    '  var themeId = stored || CFG.default || "system";',
    '  var systemResolved = (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";',
    "  var nativePaint = window.top === window ? window.__HYPERCANVAS_NATIVE_APPEARANCE__ : null;",
    '  function paintMode(id) { var attr = ((CFG.themes[id] || {}).attrs || {})["data-color-mode"]; return attr === "light" || attr === "dark" ? attr : id.indexOf("dark") === 0 ? "dark" : id.indexOf("light") === 0 ? "light" : null; }',
    '  if ((nativePaint === "light" || nativePaint === "dark") && themeId !== "system" && paintMode(themeId) && paintMode(themeId) !== nativePaint) { var ids = Object.keys(CFG.themes); for (var n = 0; n < ids.length; n++) { if (paintMode(ids[n]) === nativePaint) { themeId = ids[n]; break; } } }',
    "  var resolved = themeId;",
    '  if (themeId === "system") {',
    "    resolved = systemResolved;",
    "  }",
    "  var syncMap = {};",
    "  var sIds = Object.keys(CFG.surfaces || {});",
    "  for (var i=0; i<sIds.length; i++) { syncMap[sIds[i]] = !!CFG.surfaces[sIds[i]].sync; }",
    `  try { var raw = localStorage.getItem(${syncKey}); if (raw) { var parsed = JSON.parse(raw); for (var k in parsed) if (typeof parsed[k] === "boolean") syncMap[k] = parsed[k]; var needsMigration = localStorage.getItem(${syncDefaultsVersionKey}) !== ${syncDefaultsVersion}; if (needsMigration && CFG.surfaces.toolbar && CFG.surfaces.toolbar.sync === true && parsed.toolbar === false) { syncMap.toolbar = true; localStorage.setItem(${syncKey}, JSON.stringify(syncMap)); } if (needsMigration) localStorage.setItem(${syncDefaultsVersionKey}, ${syncDefaultsVersion}); } } catch(_) {}`,
    "  var forced = null; var frameTheme = null;",
    "  try {",
    "    var params = new URLSearchParams(window.location.search);",
    '    forced = params.get("_sb_theme_target");',
    "    if (forced && Object.prototype.hasOwnProperty.call(syncMap, forced)) syncMap[forced] = true;",
    '    var requested = params.get("theme");',
    '    var transportTheme = params.get("_sb_canvas_theme");',
    '    if (requested && (requested === "system" || Object.prototype.hasOwnProperty.call(CFG.themes, requested))) frameTheme = requested === "system" ? systemResolved : requested;',
    '    else if (params.has("_sb_embed") && forced && Object.prototype.hasOwnProperty.call(syncMap, forced) && transportTheme && Object.prototype.hasOwnProperty.call(CFG.themes, transportTheme)) frameTheme = transportTheme;',
    "  } catch(_) {}",
    "  function setAttrIfChanged(el, name, val) { if (el.getAttribute(name) !== val) el.setAttribute(name, val); }",
    "  for (var j=0; j<sIds.length; j++) {",
    "    var sid = sIds[j];",
    "    var sidLower = sid.toLowerCase();",
    '    var res = sid === "content" && params.get("theme") && (params.get("theme") === "system" || Object.prototype.hasOwnProperty.call(CFG.themes, params.get("theme"))) ? (params.get("theme") === "system" ? systemResolved : params.get("theme")) : (sid === forced && frameTheme ? frameTheme : (syncMap[sid] ? resolved : "light"));',
    "    var themeDef = (CFG.themes && CFG.themes[res]) || {};",
    "    var attrs = themeDef.attrs || {};",
    '    var nodes = doc.querySelectorAll("[data-sb-surface=\\"" + sid + "\\"]");',
    "    for (var n=0; n<nodes.length; n++) {",
    '      setAttrIfChanged(nodes[n], "data-sb-" + sidLower + "-theme", res);',
    "      for (var ak in attrs) setAttrIfChanged(nodes[n], ak, attrs[ak]);",
    "    }",
    "    if (LEGACY[sid]) setAttrIfChanged(root, LEGACY[sid], res);",
    '    if (sid === "content") {',
    "      for (var ak2 in attrs) setAttrIfChanged(root, ak2, attrs[ak2]);",
    "    }",
    "  }",
    "})();",
    "</script>"
  ].join("\n");
}

// packages/storyboard/src/internals/notebook/vite.js
var IDS = ["virtual:storyboard-data-index", "virtual:hypercanvas-app-config", "virtual:hypercanvas-notebook-routes", "virtual:storyboard-notebook-prototype-routes", "virtual:hypercanvas-portable-notebook", "virtual:hypercanvas-prototype-wrapper"];
var RUNTIME_DATA = "@dfosco/statefully/data-runtime";
var core = fileURLToPath2(import.meta.resolve("@dfosco/statefully"));
var react = fileURLToPath2(import.meta.resolve("@dfosco/statefully/react"));
var dataRuntime = path14.join(path14.dirname(react), "core/data.js");
var helper = fileURLToPath2(import.meta.resolve("@dfosco/hypercanvas/notebook/statefully-compatibility"));
var blockedCore = /* @__PURE__ */ new Set(["mountStoryboardCore", "mountDevTools", "mountFlowDebug", "mountSceneDebug", "BranchSelect"]);
var escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
var encodedPath = (file) => file.split(path14.sep).map(encodeURIComponent).join("/");
var contained = (root, file) => {
  const relative = path14.relative(root, file);
  return relative !== ".." && !relative.startsWith(`..${path14.sep}`) && !path14.isAbsolute(relative);
};
var escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function prototypeHtml(source, artifact, base, build) {
  const folder = path14.resolve(source.root, artifact.folderPath);
  const file = path14.resolve(folder, artifact.entry || "");
  if (!contained(folder, file) || !contained(source.root, fs13.realpathSync(file))) throw new Error(`INVALID_PROTOTYPE_ENTRY: ${artifact.id}`);
  const relativeBase = base === "./" || base === "";
  const prefix = `${relativeBase ? "/" : base}${build ? "prototypes" : "__notebook/prototypes"}/${encodeURIComponent(artifact.id)}/`;
  let html = fs13.readFileSync(file, "utf8").replace(/(\b(?:src|href)\s*=\s*)(["'])([^"']+)\2/gi, (match, attribute, quote, value) => {
    if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(value)) return match;
    const url = new URL(value, "https://notebook.invalid/");
    const target = path14.resolve(path14.dirname(file), decodeURIComponent(value.split(/[?#]/, 1)[0]));
    if (!contained(folder, target) || !contained(folder, fs13.realpathSync(target))) throw new Error(`UNSAFE_PROTOTYPE_ASSET: ${artifact.id}: ${value}`);
    return `${attribute}${quote}/@fs/${encodedPath(target).replace(/^\//, "")}${url.search}${url.hash}${quote}`;
  });
  const restore = '<script>const q=new URLSearchParams(location.search);if(q.has("p")&&q.get("b")?.startsWith("/")&&!q.get("b").startsWith("//"))history.replaceState(null,"",q.get("b")+q.get("p"));</script>';
  const marker = `/${build ? "prototypes" : "__notebook/prototypes"}/${encodeURIComponent(artifact.id)}`;
  const bootstrap = `<script>globalThis.__HYPERCANVAS_NOTEBOOK_BASE__=${relativeBase ? `location.pathname.slice(0,location.pathname.lastIndexOf(${JSON.stringify(marker)}))+"/"` : JSON.stringify(base)};globalThis.__HYPERCANVAS_NOTEBOOK_PREVIEW__=${!build};globalThis.__HYPERCANVAS_NOTEBOOK_PRODUCTION__=${build};document.querySelector('base').href=globalThis.__HYPERCANVAS_NOTEBOOK_BASE__+${JSON.stringify(marker.slice(1) + "/")};</script>`;
  html = html.replace(/<head(?:\s[^>]*)?>/i, (match) => `${match}<base href="${escapeHtml(prefix)}">${restore}${bootstrap}`);
  return html;
}
function notebookVite({ notebookRoot, base = "/" } = {}) {
  if (!notebookRoot || !path14.isAbsolute(notebookRoot)) throw new TypeError("notebookVite requires an absolute notebookRoot.");
  notebookRoot = fs13.realpathSync(notebookRoot);
  const runtimeRoot = path14.dirname(fileURLToPath2(import.meta.resolve("@dfosco/hypercanvas/notebook/viewer")));
  const runtimeOutput = runtimeRoot.split(path14.sep).join("/");
  const compiledRuntimePattern = new RegExp(`^${escapeRegex(runtimeOutput)}(?:/[^?]*)?(?:\\?.*)?$`);
  const runtimePackageRoot = path14.resolve(runtimeRoot, "../..");
  const runtimeManifest = JSON.parse(fs13.readFileSync(path14.join(runtimeRoot, "runtime-manifest.json"), "utf8"));
  const relativeBase = base === "./";
  let projectRoot = "";
  let build = false;
  let source;
  const htmlInputs = /* @__PURE__ */ new Map();
  const capture = () => source = readNotebookSource({ root: notebookRoot, mode: "portable" });
  const state = statefully({ roots: [], identityProfile: "standalone" });
  const adapter = {
    name: "hypercanvas-portable-notebook",
    enforce: "pre",
    config(config, environment) {
      projectRoot = path14.resolve(config.root || process2.cwd());
      build = environment.command === "build";
      if (!build && base === "./") base = "/";
      const input = { notebook: path14.join(projectRoot, "index.html"), prototypes: path14.join(projectRoot, "prototypes.html") };
      for (const artifact of capture().snapshot.artifacts) {
        if (artifact.kind !== "prototype" || artifact.portable !== true || !artifact.available || !artifact.entry) continue;
        const id = path14.join(projectRoot, "prototypes", artifact.id, "index.html");
        htmlInputs.set(id, artifact);
        input[`prototype-${artifact.id}`] = id;
      }
      return { base, resolve: { dedupe: ["react", "react-dom", "@dfosco/statefully"] }, build: { rollupOptions: { input } }, optimizeDeps: { exclude: ["@dfosco/hypercanvas", "@dfosco/statefully"], include: ["react", "react-dom/client", "react-router-dom", "extend"] } };
    },
    configResolved(config) {
      projectRoot = config.root;
      const roots = [{ path: path14.join(notebookRoot, "src"), identityRoot: "src", identityProfile: "hypercanvas" }, ...capture().snapshot.artifacts.flatMap((artifact) => artifact.kind === "prototype" && artifact.portable === true && artifact.available ? [{ path: path14.join(notebookRoot, artifact.folderPath, "state"), identityRoot: "src", scope: artifact.id, identityProfile: "standalone" }] : [])];
      state.api.setRoots(roots.filter((root) => fs13.existsSync(root.path)));
    },
    resolveId(id, importer) {
      if (IDS.includes(id)) return `\0${id}`;
      if (htmlInputs.has(id)) return id;
      if (id === "@dfosco/statefully/react") return "\0hypercanvas-portable-statefully-react";
      if (["@dfosco/statefully", "@dfosco/statefully/core", "@dfosco/statefully/session", "@dfosco/statefully/knobs"].includes(id)) return "\0hypercanvas-portable-statefully-core";
      if (id === RUNTIME_DATA) return dataRuntime;
      if (id === "design-notebook/runtime/route") return this.resolve("@dfosco/hypercanvas/notebook/runtime/route", importer, { skipSelf: true });
      if (id === "design-notebook/runtime/react") return this.resolve("@dfosco/hypercanvas/notebook/runtime/react", importer, { skipSelf: true });
      if (id === "@dfosco/hypercanvas" || id.startsWith("@dfosco/hypercanvas/")) {
        const key = "." + id.slice("@dfosco/hypercanvas".length);
        const target = runtimeManifest.package.exports[key];
        const file = typeof target === "string" ? path14.resolve(runtimePackageRoot, target) : null;
        if (!file || !contained(runtimePackageRoot, file) || !runtimeManifest.files[target.replace(/^\.\//, "")] || key === "./notebook/vite") this.error(`UNSUPPORTED_NOTEBOOK_CAPABILITY: ${id} is not a portable browser export.`);
        return file;
      }
      if (id === "virtual:statefully-data-index") return "\0hypercanvas-portable-statefully-index";
      return null;
    },
    load(id) {
      if (htmlInputs.has(id)) return prototypeHtml(capture(), htmlInputs.get(id), base, true);
      if (id === "\0hypercanvas-portable-statefully-react" || id === "\0hypercanvas-portable-statefully-core") return statefullyCompatibilityModule({ coreSource: core, reactSource: react, helperSource: helper, react: id.endsWith("-react") });
      if (id === "\0hypercanvas-portable-statefully-index") return `import { init } from '${RUNTIME_DATA}';const index=${JSON.stringify(state.api.rebuild())};init(index);export default index;export {index};`;
      if (!id.startsWith("\0virtual:")) return null;
      if (id === "\0virtual:storyboard-data-index") return generateModule(buildIndex(notebookRoot, { contentOnly: true }), notebookRoot, projectRoot, { portable: true });
      if (id === "\0virtual:hypercanvas-app-config") return buildAppConfigModule(notebookRoot, projectRoot, { portable: true });
      if (id.endsWith("notebook-routes") || id.endsWith("notebook-prototype-routes")) return notebookSourceRoutes(capture());
      if (id.endsWith("prototype-wrapper")) {
        const candidates = ["src/_prototype.jsx", "src/_prototype.tsx", "_prototype.jsx", "_prototype.tsx"].map((file2) => path14.join(notebookRoot, file2));
        const file = candidates.find((file2) => fs13.existsSync(file2));
        return file ? `export {default} from ${JSON.stringify(file)}` : "export default function Wrapper({children}){return children}";
      }
      if (id.endsWith("portable-notebook")) {
        const input = capture();
        const catalog = { notebookId: input.snapshot.manifest?.id, title: input.snapshot.manifest?.title || "Notebook", navigation: input.snapshot.manifest?.navigation, tree: notebookSourceTree(input), pages: input.snapshot.pages, diagnostics: input.diagnostics, sites: input.sites, artifacts: input.snapshot.artifacts };
        const prototypes = input.snapshot.artifacts.filter((artifact) => artifact.kind === "prototype" && artifact.portable).map((artifact) => ({ id: artifact.id, route: artifact.route, available: artifact.available, diagnostics: artifact.diagnostics, href: `${base}${build ? "prototypes" : "__notebook/prototypes"}/${encodeURIComponent(artifact.id)}/` }));
        return `const captured=${JSON.stringify(catalog)};const supplied=globalThis.__HYPERCANVAS_NOTEBOOK_PUBLICATION__;export const catalog=supplied&&typeof supplied==='object'?{...captured,...supplied}:captured;export const prototypes=${JSON.stringify(prototypes)}.map(item=>({...item,get href(){return (globalThis.__HYPERCANVAS_NOTEBOOK_BASE__||${JSON.stringify(base)})+${JSON.stringify(build ? "prototypes/" : "__notebook/prototypes/")}+encodeURIComponent(item.id)+"/"}}));`;
      }
      return null;
    },
    transform(code, id) {
      const css = prototypeCssTransform.call(this, code, id);
      if (css) return css;
      if (path14.resolve(id.split("?")[0]) === react) return { code: code.replace(/(['"])\.\/core\/data\.js\1/g, `'${RUNTIME_DATA}'`), map: null };
      if (build) {
        for (const artifact of source.snapshot.artifacts) if (artifact.portable && artifact.kind === "prototype" && contained(path14.join(notebookRoot, artifact.folderPath), id.split("?")[0])) {
          if (code.includes("import.meta.env.BASE_URL")) return { code: code.replaceAll("import.meta.env.BASE_URL", `(globalThis.__HYPERCANVAS_NOTEBOOK_BASE__+${JSON.stringify(`prototypes/${encodeURIComponent(artifact.id)}/`)})`), map: null };
        }
      }
      for (const match of code.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]@dfosco\/hypercanvas\/core['"]/g)) for (const binding of match[1].split(",")) if (blockedCore.has(binding.trim().split(/\s+as\s+/)[0])) this.error(`UNSUPPORTED_NOTEBOOK_CAPABILITY: ${binding.trim()} requires the Hypercanvas host.`);
      return null;
    },
    transformIndexHtml(html) {
      const config = readConfig(notebookRoot, projectRoot).config;
      return html.replace("</head>", `${renderInlineBootstrapScript(config?.theming)}
</head>`);
    },
    configureServer(server) {
      server.watcher.add(notebookRoot);
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url || "/", "http://notebook.local").pathname;
        const prefix = `${base}__notebook/prototypes/`;
        if (!pathname.startsWith(prefix)) return next();
        const id = decodeURIComponent(pathname.slice(prefix.length).split("/")[0]);
        const artifact = capture().snapshot.artifacts.find((artifact2) => artifact2.kind === "prototype" && artifact2.id === id && artifact2.available);
        if (!artifact) {
          response.statusCode = 404;
          response.end("Prototype unavailable.");
          return;
        }
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(await server.transformIndexHtml(request.url, prototypeHtml(source, artifact, base, false)));
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url || "/", "http://notebook.local").pathname;
        const dist = path14.resolve(server.config.root, server.config.build.outDir);
        const html = request.headers.accept?.includes("text/html");
        if (!html && request.method !== "HEAD") return next();
        const prototype = source.snapshot.artifacts.find((artifact) => {
          if (artifact.kind !== "prototype" || artifact.portable !== true || !artifact.available) return false;
          const prefix = `${base}prototypes/${encodeURIComponent(artifact.id)}`;
          return pathname === prefix || pathname.startsWith(prefix + "/");
        });
        if (prototype) {
          const entry = path14.join(dist, "prototypes", prototype.id, "index.html");
          if (!contained(dist, entry) || !fs13.existsSync(entry)) return next();
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(fs13.readFileSync(entry));
          return;
        }
        if (!relativeBase) return next();
        const file = path14.resolve(dist, "." + pathname);
        if (pathname === "/" || !contained(dist, file) || fs13.existsSync(file)) return next();
        const fallback = path14.join(dist, "404.html");
        if (!fs13.existsSync(fallback)) return next();
        response.statusCode = 404;
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(fs13.readFileSync(fallback));
      });
    },
    handleHotUpdate(context) {
      if (contained(notebookRoot, context.file) && /\.(?:jsonc?|jsonl|mdx)$/.test(context.file)) {
        capture();
        state.api.rebuild();
        context.server.ws.send({ type: "full-reload" });
        return [];
      }
    }
  };
  return [adapter, reactPlugin({ exclude: [/\/node_modules\//, compiledRuntimePattern] }), tailwind(), documentsPlugin({ root: () => notebookRoot, mode: "static", renderer: "@dfosco/hypercanvas/docs" }), state];
}
export {
  notebookVite as default
};
