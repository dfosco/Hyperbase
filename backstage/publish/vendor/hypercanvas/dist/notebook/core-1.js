import * as statefullyCore from "@dfosco/statefully/core";
const runtime = statefullyCore;
let prototypeKnobs = {};
let componentKnobs = {};
function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function flattenKnobs(knobs) {
  if (!Array.isArray(knobs)) return [];
  const createKnobStore = runtime.createKnobStore;
  if (typeof createKnobStore !== "function") {
    throw new TypeError("The installed Statefully runtime must expose createKnobStore().");
  }
  return createKnobStore(knobs).listKnobs();
}
function cloneKnobs(knobs) {
  return knobs.map((def) => ({ ...def }));
}
function readPrototypeKnobs(value) {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  const metadata = isRecord(value.meta) ? value.meta : void 0;
  if (Array.isArray(metadata?.knobs)) return metadata.knobs;
  if (Array.isArray(value.knobs)) return value.knobs;
  return [];
}
function readComponentKnobs(value) {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  const metadata = isRecord(value.meta) ? value.meta : void 0;
  if (Array.isArray(value.knobs)) return value.knobs;
  if (Array.isArray(metadata?.knobs)) return metadata.knobs;
  return [];
}
function preservePrototypeGlobalScope(knobs) {
  return knobs.map((value) => {
    if (!isRecord(value)) return value;
    if (Object.hasOwn(value, "scope") && value.scope !== void 0) return value;
    return { ...value, scope: null };
  });
}
function normalizeKnobMap(map, readKnobs) {
  const result = {};
  for (const [name, value] of Object.entries(map || {})) {
    result[name] = flattenKnobs(preservePrototypeGlobalScope(readKnobs(value)));
  }
  return result;
}
function initKnobs(index = {}) {
  prototypeKnobs = normalizeKnobMap(index.prototypeKnobs, readPrototypeKnobs);
  componentKnobs = normalizeKnobMap(index.componentKnobs, readComponentKnobs);
  if (typeof document !== "undefined") {
    document.dispatchEvent(new Event("storyboard:knobs-index-changed"));
  }
}
function getPrototypeKnobs(protoName) {
  return cloneKnobs(prototypeKnobs[protoName] || []);
}
function getComponentKnobs(componentName) {
  return cloneKnobs(componentKnobs[componentName] || []);
}
function resolveKnobDef(id, { route, knobs = [] } = {}) {
  const createKnobStore = runtime.createKnobStore;
  if (typeof createKnobStore !== "function") {
    throw new TypeError("The installed Statefully runtime must expose createKnobStore().");
  }
  const store = createKnobStore(knobs);
  return route === void 0 ? store.resolve(id) : store.resolve(id, route);
}
export {
  flattenKnobs,
  getComponentKnobs,
  getPrototypeKnobs,
  initKnobs,
  resolveKnobDef
};
