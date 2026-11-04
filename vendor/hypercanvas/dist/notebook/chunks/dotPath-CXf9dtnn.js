function getByPath(obj, path) {
  if (obj == null || typeof path !== "string" || path === "") return void 0;
  const segments = path.split(".");
  let current = obj;
  for (const segment of segments) {
    if (current == null || typeof current !== "object") return void 0;
    current = Reflect.get(current, segment);
  }
  return current;
}
function deepClone(val) {
  if (Array.isArray(val)) return val.map((item) => deepClone(item));
  if (val !== null && typeof val === "object") {
    const out = {};
    for (const key of Object.keys(val)) out[key] = deepClone(Reflect.get(val, key));
    return out;
  }
  return val;
}
function setByPath(obj, path, value) {
  const segments = path.split(".");
  if (segments.some((segment) => ["__proto__", "constructor", "prototype"].includes(segment))) return;
  let current = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const next = current[segment];
    if (next == null || typeof next !== "object") {
      current[segment] = /^\d+$/.test(segments[i + 1]) ? [] : {};
    }
    current = current[segment];
  }
  const finalSegment = segments[segments.length - 1];
  if (finalSegment !== void 0) current[finalSegment] = value;
}
export {
  deepClone as d,
  getByPath as g,
  setByPath as s
};
