import { useMemo, useSyncExternalStore, useEffect } from "react";
import { createPrototypeRouteBinding } from "./runtime-route.js";
function usePrototypeRoute({ basePath } = {}) {
  const binding = useMemo(() => createPrototypeRouteBinding({ basePath }), [basePath]);
  const location = useSyncExternalStore(binding.subscribe, binding.getSnapshot, binding.getSnapshot);
  useEffect(() => () => binding.dispose(), [binding]);
  return { ...location, navigate: binding.navigate, subscribe: binding.subscribe, getSnapshot: binding.getSnapshot };
}
export {
  usePrototypeRoute
};
