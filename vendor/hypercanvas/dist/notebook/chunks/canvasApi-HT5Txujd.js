const BASE = "/_hypercanvas/canvas";
function getApiBase() {
  const base = (globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/").replace(/\/$/, "");
  return base + BASE;
}
async function request(path, method, body) {
  const url = getApiBase() + path;
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : void 0,
    body: body ? JSON.stringify(body) : void 0
  });
  return res.json();
}
function uploadImage(dataUrl, canvasId, filename) {
  const body = { dataUrl, canvasName: canvasId };
  if (filename) body.filename = filename;
  return request("/image", "POST", body);
}
function toggleImagePrivacy(filename) {
  return request("/image/toggle-private", "POST", { filename });
}
async function cropAndUpload(imageSrc, cropRect, canvasId) {
  const imageUrl = (() => {
    const base = (globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/").replace(/\/$/, "");
    return `${base}/_hypercanvas/canvas/images/${imageSrc}`;
  })();
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = imageUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cropRect.width);
  canvas.height = Math.round(cropRect.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(
    img,
    Math.round(cropRect.x),
    Math.round(cropRect.y),
    Math.round(cropRect.width),
    Math.round(cropRect.height),
    0,
    0,
    canvas.width,
    canvas.height
  );
  const srcBase = imageSrc.includes("/") ? imageSrc.slice(imageSrc.lastIndexOf("/") + 1) : imageSrc;
  const ext = srcBase.split(".").pop()?.toLowerCase() || "png";
  const mimeMap = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };
  const mime = mimeMap[ext] || "image/png";
  const dataUrl = canvas.toDataURL(mime, 0.92);
  const privacyPrefix = srcBase.startsWith("~") ? "~" : "";
  const baseName = srcBase.replace(/^~/, "");
  const withoutCrop = baseName.replace(/--cropped--\d{4}-\d{2}-\d{2}--\d{2}-\d{2}-\d{2}/, "");
  const nameWithoutExt = withoutCrop.replace(/\.\w+$/, "");
  const now = /* @__PURE__ */ new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}--${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const croppedFilename = `${privacyPrefix}${nameWithoutExt}--cropped--${ts}.${ext}`;
  return uploadImage(dataUrl, canvasId, croppedFilename);
}
export {
  cropAndUpload as c,
  toggleImagePrivacy as t,
  uploadImage as u
};
