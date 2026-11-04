import { s as setNavigationRouter, a as interceptHideParams } from "./chunks/sbNavigate-B3XfDwJj.js";
function installHashPreserver(router, basename = "") {
  const base = basename.replace(/\/+$/, "");
  setNavigationRouter(router, base);
  document.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const anchor = e.target.closest("a[href]");
    if (!anchor) return;
    if (anchor.target === "_blank") return;
    const targetUrl = new URL(anchor.href, window.location.origin);
    if (targetUrl.origin !== window.location.origin) return;
    const foreignBranch = targetUrl.pathname.match(/^\/branch--([a-z0-9._-]+)(\/|$)/i);
    if (foreignBranch) {
      const ownBranch = base.match(/\/branch--([a-z0-9._-]+)$/i)?.[1] ?? null;
      if (foreignBranch[1] !== ownBranch) {
        return;
      }
    }
    const currentHash = window.location.hash;
    const hasCurrentHash = currentHash && currentHash !== "#";
    const targetHasOwnHash = targetUrl.hash && targetUrl.hash !== "#";
    const hash = targetHasOwnHash ? targetUrl.hash : hasCurrentHash ? currentHash : "";
    let pathname = targetUrl.pathname;
    if (base && pathname.startsWith(base)) {
      pathname = pathname.slice(base.length) || "/";
    }
    e.preventDefault();
    router.navigate(pathname + targetUrl.search + hash);
    setTimeout(interceptHideParams, 0);
  });
  const originalNavigate = router.navigate.bind(router);
  router.navigate = (to, opts) => {
    const currentHash = window.location.hash;
    const hasCurrentHash = currentHash && currentHash !== "#";
    if (hasCurrentHash && typeof to === "string" && !to.includes("#")) {
      to = to + currentHash;
    }
    return originalNavigate(to, opts).then((result) => {
      interceptHideParams();
      return result;
    });
  };
}
export {
  installHashPreserver
};
