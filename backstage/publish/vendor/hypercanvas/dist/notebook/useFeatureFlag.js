import { useSyncExternalStore } from "react";
import { getFlag } from "./core-3.js";
import { s as subscribeToStorage, b as getStorageSnapshot } from "./chunks/localStorage-DulkrQ4k.js";
function useFeatureFlag(key) {
  useSyncExternalStore(subscribeToStorage, getStorageSnapshot);
  return getFlag(key);
}
export {
  useFeatureFlag
};
