import { listPrototypes, listFolders, listCanvases, getPrototypeMetadata, listFlows, loadFlow, getFolderMetadata, getCanvasData } from "../core-0.js";
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}
function appendTokens(url, tokens) {
  if (!tokens || typeof tokens !== "object") return url;
  const reserved = /* @__PURE__ */ new Set(["flow", "scene"]);
  const entries = Object.entries(tokens).filter(
    ([k, v]) => v != null && !reserved.has(k) && typeof v !== "object"
  );
  if (entries.length === 0) return url;
  const sep = url.includes("?") ? "&" : "?";
  const qs = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  return `${url}${sep}${qs}`;
}
function resolveFlowRoute(flowName, knownRoutes = []) {
  let routeUrl;
  let data = null;
  const matchedRoute = knownRoutes.find((r) => r.toLowerCase() === flowName.toLowerCase());
  if (matchedRoute) {
    routeUrl = `/${matchedRoute}`;
  } else {
    try {
      data = loadFlow(flowName);
      const explicitRoute = data?.route || data?.meta?.route || data?.flowMeta?.route || data?.sceneMeta?.route;
      if (explicitRoute) {
        const normalized = explicitRoute.startsWith("/") ? explicitRoute : `/${explicitRoute}`;
        routeUrl = data?.meta?.default === true ? normalized : `${normalized}?flow=${encodeURIComponent(flowName)}`;
      } else if (data?._route) {
        routeUrl = data?.meta?.default === true ? data._route : `${data._route}?flow=${encodeURIComponent(flowName)}`;
      } else {
        routeUrl = `/?flow=${encodeURIComponent(flowName)}`;
      }
    } catch {
      routeUrl = `/?flow=${encodeURIComponent(flowName)}`;
    }
  }
  if (!data) {
    try {
      data = loadFlow(flowName);
    } catch {
    }
  }
  return appendTokens(routeUrl, data?.tokens);
}
const resolveSceneRoute = resolveFlowRoute;
function getFlowMeta(flowName) {
  try {
    const data = loadFlow(flowName);
    return data?.meta || data?.flowMeta || data?.sceneMeta || null;
  } catch {
    return null;
  }
}
const getSceneMeta = getFlowMeta;
function buildPrototypeIndex(knownRoutes = []) {
  const flows = listFlows();
  const protoMap = {};
  const globalFlows = [];
  for (const name of listPrototypes()) {
    const raw = getPrototypeMetadata(name);
    const meta = raw?.meta || raw || {};
    const isExternal = Boolean(raw?.url);
    const folder = raw?.folder || null;
    const isPrivate = raw?._isPrivate || false;
    protoMap[name] = {
      name: meta.title || name,
      dirName: name,
      description: meta.description || null,
      author: meta.author || null,
      gitAuthor: raw?.gitAuthor || null,
      lastModified: raw?.lastModified || null,
      icon: meta.icon || null,
      team: meta.team || null,
      tags: meta.tags || null,
      hideFlows: meta.hideFlows ?? raw?.hideFlows ?? true,
      folder,
      route: typeof raw?.route === "string" ? raw.route : null,
      isExternal,
      externalUrl: isExternal ? raw?.url || null : null,
      isPrivate,
      flows: []
    };
  }
  for (const flowName of flows) {
    const slashIdx = flowName.indexOf("/");
    if (slashIdx > 0) {
      const protoName = flowName.substring(0, slashIdx);
      const shortName = flowName.substring(slashIdx + 1);
      if (!protoMap[protoName]) {
        protoMap[protoName] = {
          name: protoName,
          dirName: protoName,
          description: null,
          author: null,
          gitAuthor: null,
          lastModified: null,
          icon: null,
          team: null,
          tags: null,
          hideFlows: true,
          folder: null,
          isExternal: false,
          externalUrl: null,
          isPrivate: false,
          flows: []
        };
      }
      protoMap[protoName].flows.push({
        key: flowName,
        name: shortName,
        route: resolveFlowRoute(flowName, knownRoutes),
        meta: getFlowMeta(flowName)
      });
    } else {
      globalFlows.push({
        key: flowName,
        name: flowName,
        route: resolveFlowRoute(flowName, knownRoutes),
        meta: getFlowMeta(flowName)
      });
    }
  }
  const folderMap = {};
  for (const folderName of listFolders()) {
    const raw = getFolderMetadata(folderName);
    const meta = raw?.meta || raw || {};
    folderMap[folderName] = {
      name: meta.title || folderName,
      dirName: folderName,
      description: meta.description || null,
      icon: meta.icon || null,
      isPrivate: !!raw?._isPrivate,
      prototypes: []
    };
  }
  const ungrouped = [];
  for (const proto of Object.values(protoMap)) {
    const folder = proto.folder ? folderMap[proto.folder] : void 0;
    if (folder) {
      folder.prototypes.push(proto);
    } else if (proto.folder) {
      folderMap[proto.folder] = {
        name: proto.folder,
        dirName: proto.folder,
        description: null,
        icon: null,
        isPrivate: false,
        prototypes: [proto]
      };
    } else {
      ungrouped.push(proto);
    }
  }
  const folders = Object.values(folderMap);
  const prototypes = ungrouped;
  const canvasEntries = [];
  const seenGroups = /* @__PURE__ */ new Map();
  const toTitleCase = (s) => s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  for (const canvasId of listCanvases()) {
    const data = getCanvasData(canvasId);
    if (!data) continue;
    const meta = data._canvasMeta;
    const group = data._group || null;
    const fileSegment = canvasId.split("/").pop();
    const pageName = data.title || toTitleCase(fileSegment);
    const pageEntry = {
      id: canvasId,
      name: pageName,
      route: data._route || `/canvas/${canvasId}`,
      isPrivate: !!data._isPrivate
    };
    if (group && seenGroups.has(group)) {
      const idx = seenGroups.get(group);
      if (idx === void 0) continue;
      const existing = canvasEntries[idx];
      if (!existing) continue;
      if (!existing.pages) {
        const firstId = existing.dirName;
        const firstData = getCanvasData(firstId);
        const firstSegment = firstId.split("/").pop() || firstId;
        const firstName = firstData?.title || toTitleCase(firstSegment);
        existing.pages = [{
          id: firstId,
          name: firstName,
          route: existing.route,
          isPrivate: !!firstData?._isPrivate
        }];
      }
      const incomingIsPrivate = !!data._isPrivate;
      if (existing.isPrivate && !incomingIsPrivate) {
        existing.name = meta?.title || data.title || canvasId;
        existing.dirName = canvasId;
        existing.description = meta?.description || data.description || null;
        existing.route = data._route || `/canvas/${canvasId}`;
        existing.folder = data._folder || existing.folder;
        existing.isPrivate = false;
        existing.author = meta?.author || data.author || existing.author || null;
        existing.gitAuthor = data.gitAuthor || existing.gitAuthor || null;
        existing._canvasMeta = meta || existing._canvasMeta || null;
      }
      existing.pages.push(pageEntry);
      continue;
    }
    const isPrivate = Boolean(data._isPrivate);
    const entry = {
      name: meta?.title || data.title || canvasId,
      dirName: canvasId,
      description: meta?.description || data.description || null,
      route: data._route || `/canvas/${canvasId}`,
      folder: data._folder || null,
      isCanvas: true,
      isPrivate,
      author: meta?.author || data.author || null,
      gitAuthor: data.gitAuthor || null,
      _canvasMeta: meta || null,
      _group: group
    };
    if (group) seenGroups.set(group, canvasEntries.length);
    canvasEntries.push(entry);
  }
  for (const entry of canvasEntries) {
    if (!entry.pages || !entry._canvasMeta?.pageOrder) continue;
    const orderMap = /* @__PURE__ */ new Map();
    entry._canvasMeta.pageOrder.forEach((p, idx) => {
      const key = typeof p === "string" ? p : p?.name;
      if (key) orderMap.set(key, idx);
    });
    const stripDraft = (k) => k.split("/").filter((seg) => seg !== "drafts").join("/");
    entry.pages.sort((a, b) => {
      const aKey = stripDraft(a.id ?? a.name);
      const bKey = stripDraft(b.id ?? b.name);
      const aIdx = orderMap.has(aKey) ? orderMap.get(aKey) : Infinity;
      const bIdx = orderMap.has(bKey) ? orderMap.get(bKey) : Infinity;
      return aIdx - bIdx;
    });
  }
  for (const canvas of canvasEntries) {
    if (canvas.folder) {
      const folder = folderMap[canvas.folder];
      if (folder) {
        if (!folder.canvases) folder.canvases = [];
        folder.canvases.push(canvas);
      } else {
        folderMap[canvas.folder] = {
          name: canvas.folder,
          dirName: canvas.folder,
          description: null,
          icon: null,
          isPrivate: false,
          prototypes: [],
          canvases: [canvas]
        };
      }
    }
  }
  const ungroupedCanvases = canvasEntries.filter((c) => !c.folder);
  const sortByTitle = (a, b) => (a.name || "").localeCompare(b.name || "");
  const sortByUpdated = (a, b) => {
    const aTime = a.lastModified ? new Date(a.lastModified).getTime() : 0;
    const bTime = b.lastModified ? new Date(b.lastModified).getTime() : 0;
    return bTime - aTime;
  };
  const folderByUpdated = (a, b) => {
    const aMax = Math.max(0, ...a.prototypes.map((p) => p.lastModified ? new Date(p.lastModified).getTime() : 0));
    const bMax = Math.max(0, ...b.prototypes.map((p) => p.lastModified ? new Date(p.lastModified).getTime() : 0));
    return bMax - aMax;
  };
  return {
    folders,
    prototypes,
    canvases: ungroupedCanvases,
    globalFlows,
    sorted: {
      title: {
        prototypes: [...prototypes].sort(sortByTitle),
        canvases: [...ungroupedCanvases].sort(sortByTitle),
        folders: [...folders].map((f) => ({
          ...f,
          prototypes: [...f.prototypes].sort(sortByTitle),
          canvases: [...f.canvases || []].sort(sortByTitle)
        })).sort(sortByTitle)
      },
      updated: {
        prototypes: [...prototypes].sort(sortByUpdated),
        canvases: [...ungroupedCanvases].sort(sortByTitle),
        folders: [...folders].map((f) => ({
          ...f,
          prototypes: [...f.prototypes].sort(sortByUpdated),
          canvases: [...f.canvases || []].sort(sortByTitle)
        })).sort(folderByUpdated)
      }
    }
  };
}
export {
  appendTokens as a,
  buildPrototypeIndex as b,
  getSceneMeta as c,
  resolveSceneRoute as d,
  getFlowMeta as g,
  hash as h,
  resolveFlowRoute as r
};
