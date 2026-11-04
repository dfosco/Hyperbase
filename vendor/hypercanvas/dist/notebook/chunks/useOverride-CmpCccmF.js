import { useContext, useCallback, useSyncExternalStore } from "react";
import { S as StoryboardContext } from "./StoryboardContext-a5DglSkK.js";
import { g as getByPath } from "./dotPath-CXf9dtnn.js";
import { o as isHideMode, l as getParam, m as getShadow, u as setShadow, t as setParam, s as removeShadow, q as removeParam } from "./hideMode-DxxH-PW9.js";
import { s as subscribeToHash } from "./hashSubscribe-Bi9R_rI0.js";
import { s as subscribeToStorage, b as getStorageSnapshot } from "./localStorage-DulkrQ4k.js";
function useOverride(path) {
  const context = useContext(StoryboardContext);
  const data = context?.data;
  const hidden = isHideMode();
  const sceneDefault = data != null ? getByPath(data, path) : void 0;
  const getHashSnap = useCallback(() => getParam(path), [path]);
  const hashValue = useSyncExternalStore(subscribeToHash, getHashSnap);
  useSyncExternalStore(subscribeToStorage, getStorageSnapshot);
  let value;
  if (hidden) {
    const shadowValue = getShadow(path);
    value = shadowValue !== null ? shadowValue : sceneDefault;
  } else {
    value = hashValue !== null ? hashValue : sceneDefault;
  }
  const setValue = useCallback(
    (newValue) => {
      if (isHideMode()) {
        setShadow(path, newValue);
      } else {
        setParam(path, newValue);
        setShadow(path, newValue);
      }
    },
    [path]
  );
  const clearValue = useCallback(() => {
    if (isHideMode()) {
      removeShadow(path);
    } else {
      removeParam(path);
      removeShadow(path);
    }
  }, [path]);
  return [value, setValue, clearValue];
}
export {
  useOverride as u
};
