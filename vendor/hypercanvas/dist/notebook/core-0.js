function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function deepMerge(target, source) {
  const targetRecord = target;
  const sourceRecord = source;
  const result = { ...targetRecord };
  for (const key of Object.keys(source)) {
    const sourceValue = sourceRecord[key];
    const targetValue = targetRecord[key];
    if (isRecord(sourceValue) && isRecord(targetValue)) {
      result[key] = deepMerge(targetValue, sourceValue);
    } else {
      result[key] = sourceValue;
    }
  }
  return result;
}
let dataIndex = { flows: {}, objects: {}, records: {}, prototypes: {}, folders: {}, canvases: {}, stories: {}, scopeAliases: {} };
function init(index) {
  if (!index || typeof index !== "object") {
    throw new Error("[storyboard-core] init() requires { flows, objects, records }");
  }
  const input = index;
  const flowData = input.flows || input.scenes;
  dataIndex = {
    flows: isRecord(flowData) ? flowData : {},
    objects: isRecord(input.objects) ? input.objects : {},
    records: isRecord(input.records) ? input.records : {},
    prototypes: isRecord(input.prototypes) ? input.prototypes : {},
    folders: isRecord(input.folders) ? input.folders : {},
    canvases: isRecord(input.canvases) ? input.canvases : {},
    stories: isRecord(input.stories) ? input.stories : {},
    // Scope aliases are lookup-only compatibility names. Keep one direct hop
    // and reset them on every init so HMR cannot retain removed migrations.
    scopeAliases: isRecord(input.scopeAliases) ? Object.fromEntries(Object.entries(input.scopeAliases).filter(
      ([from, to]) => from.trim() && typeof to === "string" && to.trim() && from !== to
    )) : {}
  };
}
function canonicalScope(scope) {
  return dataIndex.scopeAliases[scope] || scope;
}
function canonicalScopedName(name) {
  const slash = name.indexOf("/");
  if (slash <= 0) return name;
  const prefix = name.slice(0, slash);
  const canonical = dataIndex.scopeAliases[prefix];
  return canonical ? `${canonical}${name.slice(slash)}` : name;
}
function loadDataFile(name, type) {
  const canonicalName = canonicalScopedName(name);
  if (type && dataIndex[type]?.[canonicalName] != null) {
    return dataIndex[type][canonicalName];
  }
  if (!type) {
    for (const t of ["flows", "objects", "records"]) {
      if (dataIndex[t]?.[canonicalName] != null) {
        return dataIndex[t][canonicalName];
      }
    }
  }
  if (type === "flows" || !type) {
    const lower = name.toLowerCase();
    for (const key of Object.keys(dataIndex.flows)) {
      if (key.toLowerCase() === lower) {
        return dataIndex.flows[key];
      }
    }
  }
  const available = Object.keys(type ? dataIndex[type] : {});
  const scopedHints = available.filter((k) => k.includes("/")).slice(0, 5);
  const hint = scopedHints.length > 0 ? `
  Scoped names in index: ${scopedHints.join(", ")}` : "";
  throw new Error(`Data file not found: ${name}${type ? ` (type: ${type})` : ""}${hint}`);
}
function resolveRefs(node, seen = /* @__PURE__ */ new Set(), scope = null) {
  if (node === null || typeof node !== "object") return node;
  if (Array.isArray(node)) {
    return node.map((item) => resolveRefs(item, seen, scope));
  }
  const record = node;
  if (record.$ref && typeof record.$ref === "string") {
    const refName = record.$ref;
    const resolvedRef = scope ? resolveObjectName(scope, refName) : refName;
    if (seen.has(resolvedRef)) {
      throw new Error(`Circular $ref detected: ${refName}`);
    }
    seen.add(resolvedRef);
    const refData = loadDataFile(resolvedRef, "objects");
    return resolveRefs(refData, seen, scope);
  }
  const result = {};
  for (const [key, value] of Object.entries(record)) {
    result[key] = resolveRefs(value, seen, scope);
  }
  return result;
}
function listFlows() {
  return Object.keys(dataIndex.flows);
}
const listScenes = listFlows;
function getFlowsForPrototype(prototypeName) {
  if (!prototypeName) return [];
  const prefix = canonicalScope(prototypeName) + "/";
  return Object.keys(dataIndex.flows).filter((key) => key.startsWith(prefix)).map((key) => ({
    key,
    name: key.substring(prefix.length),
    meta: null
  }));
}
function flowExists(flowName) {
  const canonicalName = canonicalScopedName(flowName);
  if (dataIndex.flows[canonicalName] != null) return true;
  const lower = canonicalName.toLowerCase();
  for (const key of Object.keys(dataIndex.flows)) {
    if (key.toLowerCase() === lower) return true;
  }
  return false;
}
const sceneExists = flowExists;
function loadFlow(flowName = "default") {
  let flowData;
  const canonicalFlowName = canonicalScopedName(flowName);
  const scope = canonicalFlowName.includes("/") ? canonicalFlowName.split("/")[0] : null;
  try {
    const loaded = structuredClone(loadDataFile(canonicalFlowName, "flows"));
    if (!isRecord(loaded)) throw new Error(`Flow "${flowName}" must be an object`);
    flowData = loaded;
  } catch {
    const available = listFlows();
    const related = available.filter(
      (k) => k.endsWith("/" + flowName) || k.startsWith(flowName + "/")
    );
    const hint = related.length > 0 ? ` Did you mean: ${related.join(", ")}?` : "";
    throw new Error(`Failed to load flow: ${flowName}.${hint}`);
  }
  if (Array.isArray(flowData.$global)) {
    const globalNames = flowData.$global;
    delete flowData.$global;
    let mergedGlobals = {};
    for (const name of globalNames) {
      try {
        const resolvedName = scope ? resolveObjectName(scope, name) : name;
        const globalData = resolveRefs(loadDataFile(resolvedName), /* @__PURE__ */ new Set(), scope);
        if (!isRecord(globalData)) throw new Error(`Global data "${name}" must be an object`);
        mergedGlobals = deepMerge(mergedGlobals, globalData);
      } catch (err) {
        console.warn(`Failed to load $global: ${name}`, err);
      }
    }
    flowData = deepMerge(mergedGlobals, flowData);
  }
  const resolvedFlow = resolveRefs(flowData, /* @__PURE__ */ new Set(), scope);
  if (!isRecord(resolvedFlow)) throw new Error(`Flow "${flowName}" must resolve to an object`);
  return structuredClone(resolvedFlow);
}
const loadScene = loadFlow;
function loadRecord(recordName) {
  const canonicalName = canonicalScopedName(recordName);
  const data = dataIndex.records[canonicalName];
  if (data == null) {
    const available = Object.keys(dataIndex.records);
    const related = available.filter(
      (k) => k.endsWith("/" + recordName) || k.startsWith(recordName + "/")
    );
    const hint = related.length > 0 ? ` Did you mean: ${related.join(", ")}?` : "";
    throw new Error(`Record not found: ${recordName}.${hint}`);
  }
  if (!Array.isArray(data)) {
    throw new Error(`Record "${recordName}" must be an array, got ${typeof data}`);
  }
  return structuredClone(data);
}
function findRecord(recordName, id) {
  const records = loadRecord(recordName);
  return records.find((entry) => isRecord(entry) && entry.id === id) ?? null;
}
function loadObject(objectName, scope) {
  const resolved = scope ? resolveObjectName(canonicalScope(scope), objectName) : canonicalScopedName(objectName);
  const data = loadDataFile(resolved, "objects");
  return resolveRefs(structuredClone(data), /* @__PURE__ */ new Set(), scope);
}
function resolveFlowName(scope, name) {
  const canonicalName = canonicalScopedName(name);
  if (scope) {
    const scoped = `${canonicalScope(scope)}/${canonicalName}`;
    if (flowExists(scoped)) return scoped;
  }
  if (flowExists(canonicalName)) return canonicalName;
  return scope ? `${canonicalScope(scope)}/${canonicalName}` : canonicalName;
}
function resolveRecordName(scope, name) {
  const canonicalName = canonicalScopedName(name);
  if (scope) {
    const scoped = `${canonicalScope(scope)}/${canonicalName}`;
    if (dataIndex.records[scoped] != null) return scoped;
  }
  if (dataIndex.records[canonicalName] != null) return canonicalName;
  return scope ? `${canonicalScope(scope)}/${canonicalName}` : canonicalName;
}
function resolveObjectName(scope, name) {
  const canonicalName = canonicalScopedName(name);
  if (scope) {
    const scoped = `${canonicalScope(scope)}/${canonicalName}`;
    if (dataIndex.objects[scoped] != null) return scoped;
  }
  if (dataIndex.objects[canonicalName] != null) return canonicalName;
  return scope ? `${canonicalScope(scope)}/${canonicalName}` : canonicalName;
}
function listPrototypes() {
  return Object.keys(dataIndex.prototypes);
}
function getPrototypeMetadata(name) {
  return dataIndex.prototypes[name] ?? null;
}
function listFolders() {
  return Object.keys(dataIndex.folders);
}
function getFolderMetadata(name) {
  return dataIndex.folders[name] ?? null;
}
function listCanvases() {
  return Object.keys(dataIndex.canvases);
}
function getCanvasData(name) {
  return dataIndex.canvases[name] ?? null;
}
function listStories() {
  return Object.keys(dataIndex.stories);
}
function getStoryData(name) {
  if (dataIndex.stories[name]) return dataIndex.stories[name];
  if (name && name.includes("/")) {
    const basename = name.split("/").pop();
    if (basename && dataIndex.stories[basename]) return dataIndex.stories[basename];
  }
  return null;
}
export {
  deepMerge,
  findRecord,
  flowExists,
  getCanvasData,
  getFlowsForPrototype,
  getFolderMetadata,
  getPrototypeMetadata,
  getStoryData,
  init,
  listCanvases,
  listFlows,
  listFolders,
  listPrototypes,
  listScenes,
  listStories,
  loadFlow,
  loadObject,
  loadRecord,
  loadScene,
  resolveFlowName,
  resolveObjectName,
  resolveRecordName,
  sceneExists
};
