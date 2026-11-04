import { useCallback, useSyncExternalStore, useState, useEffect } from "react";
import { flushSync } from "react-dom";
import { u as useOverride } from "./useOverride-CmpCccmF.js";
import { l as subscribePaneGuards, m as hasPaneGuard, p as prepareOwnerPaneTransition } from "./Document-DbLUnVhy.js";
function useExpandOverride(widgetType, widgetId) {
  const path = `_${widgetType}_expanded_${widgetId}`;
  const [override, setOverride, clearOverride] = useOverride(path);
  const accepted = useGuardedExpandOverride(widgetId, override, setOverride, clearOverride);
  const setExpanded = useCallback((mode) => {
    if (mode) setOverride(mode);
    else clearOverride();
  }, [setOverride, clearOverride]);
  return [accepted, setExpanded];
}
function useGuardedExpandOverride(widgetId, override, setOverride, clearOverride) {
  const requested = override || null;
  const guarded = useSyncExternalStore(subscribePaneGuards, () => hasPaneGuard(widgetId), () => false);
  const [accepted, setAccepted] = useState(requested);
  if (!guarded && accepted !== requested) setAccepted(requested);
  const setExpanded = useCallback((mode) => {
    if (mode) setOverride(mode);
    else clearOverride();
  }, [setOverride, clearOverride]);
  useEffect(() => {
    if (!guarded || accepted === requested) return;
    let cancelled = false;
    void prepareOwnerPaneTransition(widgetId).then((unlock) => {
      try {
        if (!cancelled) flushSync(() => setAccepted(requested));
      } finally {
        unlock();
      }
    }).catch(() => {
      if (!cancelled) setExpanded(accepted);
    });
    return () => {
      cancelled = true;
    };
  }, [widgetId, guarded, accepted, requested, setExpanded]);
  return guarded ? accepted : requested;
}
export {
  useGuardedExpandOverride as a,
  useExpandOverride as u
};
