/**
 * Register the smooth-corners CSS Houdini paint worklet.
 *
 * Inlined from smooth-corners (MIT) to avoid Vite-specific ?url import
 * that breaks when this source is consumed from node_modules.
 *
 * Safe to call multiple times — the worklet is only registered once.
 */
let registered = false;
let fallbackRegistered = false;
function registerSmoothCornersMaskFallback() {
    if (fallbackRegistered || typeof document === 'undefined')
        return;
    fallbackRegistered = true;
    // PaintWorklet is unavailable in WKWebView. Keep the same superellipse
    // silhouette as a scalable SVG alpha mask for those browsers.
    const exponent = 4;
    const steps = 128;
    const points = Array.from({ length: steps }, (_, index) => {
        const angle = (index / steps) * Math.PI * 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const x = 50 + 50 * Math.sign(cos) * Math.abs(cos) ** (2 / exponent);
        const y = 50 + 50 * Math.sign(sin) * Math.abs(sin) ** (2 / exponent);
        return `${x.toFixed(2)} ${y.toFixed(2)}`;
    });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path fill="white" d="M${points.join(' L')} Z"/></svg>`;
    const mask = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    document.documentElement.style.setProperty('--sb--smooth-corners-mask', mask);
}
export function registerSmoothCorners() {
    registerSmoothCornersMaskFallback();
    if (registered)
        return;
    if (typeof CSS === 'undefined' || !('paintWorklet' in CSS))
        return;
    registered = true;
    try {
        const worklet = `class P{static get inputProperties(){return["--sb--smooth-corners"]}superellipse(a,b,nX=4,nY){if(Number.isNaN(nX))nX=4;if(typeof nY==="undefined"||Number.isNaN(nY))nY=nX;if(nX>100)nX=100;if(nY>100)nY=100;if(nX<1e-11)nX=1e-11;if(nY<1e-11)nY=1e-11;const nX2=2/nX,nY2=nY?2/nY:nX2,steps=360,step=(2*Math.PI)/steps;return Array.from({length:steps},(_,i)=>{const t=i*step,cosT=Math.cos(t),sinT=Math.sin(t);return{x:Math.abs(cosT)**nX2*a*Math.sign(cosT),y:Math.abs(sinT)**nY2*b*Math.sign(sinT)}})}paint(ctx,geom,props){const[nX,nY]=props.get("--sb--smooth-corners").toString().replace(/ /g,"").split(",");const w=geom.width/2,h=geom.height/2,s=this.superellipse(w,h,parseFloat(nX),parseFloat(nY));ctx.fillStyle="#000";ctx.setTransform(1,0,0,1,w,h);ctx.beginPath();for(let i=0;i<s.length;i++){const{x,y}=s[i];i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)}ctx.closePath();ctx.fill()}}try{registerPaint("smooth-corners",P)}catch(e){}`;
        const blob = new Blob([worklet], { type: 'application/javascript' });
        const paintWorklet = CSS.paintWorklet;
        void paintWorklet.addModule(URL.createObjectURL(blob));
    }
    catch { /* empty */ }
}
