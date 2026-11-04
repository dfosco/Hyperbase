import { C, D, f, g, a, r, s } from "./chunks/Canvas-kSVAzYPO.js";
import { useCallback } from "react";
function useResetCanvas({ reload = false } = {}) {
  return useCallback(() => {
    try {
      localStorage.removeItem("tiny-canvas-queue");
    } catch (error) {
      console.error("Error clearing canvas state:", error);
    }
    if (reload) {
      window.location.reload();
    }
  }, [reload]);
}
export {
  C as Canvas,
  D as Draggable,
  f as findDragId,
  g as generateDragId,
  a as getQueue,
  r as refreshStorage,
  s as saveDrag,
  useResetCanvas
};
