import { a as getWidgetDefinition, b as getAllWidgetDefinitions } from "./_commonjsHelpers-CXnYerf6.js";
import "./canvasConfig-JhY60Ge2.js";
import "./localStorage-DulkrQ4k.js";
const variables$1 = { "label:duplicate": "Duplicate", "label:copy-link": "Copy widget link", "label:delete": "Delete", "label:open-ext": "Open in new tab", "label:edit": "Edit", "label:download": "Download image", "label:copy-png": "Copy as image", "label:copy-path": "Copy file path", "label:expand": "Expand", "label:copy-id": "Copy widget ID", "label:copy-text": "Copy text", "label:edit-source": "Edit source", "label:save": "Save", "label:rename": "Rename file" };
const connectorDefaults = { "controlOffset": 80, "orthogonalStemLength": 48, "orthogonalProximityThreshold": 48, "stroke": "var(--fgColor-accent, #0969da)", "strokeWidth": 4, "hoverStroke": "var(--fgColor-danger, #cf222e)", "hoverStrokeWidth": 5, "endpointRadius": 6, "endpointFill": "var(--fgColor-accent, #0969da)", "endpointStroke": "var(--bgColor-default, #ffffff)", "endpointStrokeWidth": 3, "hitAreaStrokeWidth": 16, "dragStroke": "var(--fgColor-accent, #0969da)", "dragStrokeWidth": 2, "dragDasharray": "6 4", "dragOpacity": 0.7, "startEndpoint": "circle", "endEndpoint": "circle" };
const widgets = /* @__PURE__ */ JSON.parse('{"sticky-note":{"label":"Sticky Note","icon":"sticky-note","resize":{"enabled":true,"prod":false},"props":{"text":{"type":"text","label":"Text","category":"content","default":""},"color":{"type":"select","label":"Color","category":"settings","default":"yellow","options":["yellow","blue","green","pink","purple","orange"]},"width":{"type":"number","label":"Width","category":"size","min":180,"default":270},"height":{"type":"number","label":"Height","category":"size","min":60,"default":170},"autoScaleText":{"type":"boolean","label":"Scale text with sticky size","category":"settings","default":false}},"features":[{"id":"color","type":"color-picker","prop":"color","multiSelection":{}},{"id":"toggle-text-scale","type":"action","action":"toggle-text-scale","label":"Scale text with size","icon":"typography","prod":true},{"id":"copy","type":"action","action":"copy","label":"$label:duplicate","icon":"copy"},{"id":"copy-text","type":"action","action":"copy-text","label":"$label:copy-text","icon":"unwrap","menu":true,"prod":true},{"id":"copy-link","type":"action","action":"copy-link","label":"$label:copy-link","icon":"link","menu":true,"prod":true,"alt":{"label":"$label:copy-id","action":"copy-widget-id"}},{"id":"delete","type":"action","action":"delete","label":"$label:delete","icon":"trash","menu":true}],"connectors":{"anchors":{"top":"available","bottom":"available","left":"available","right":"available"},"accept":["*"],"exclude":[]}},"markdown":{"label":"Markdown","icon":"primer/file","expandable":true,"splitScreen":true,"deleteConfirm":{"enabled":true,"title":"Delete markdown widget?","message":"This will remove the widget from the canvas. The widget\'s content is stored inline — it will not be saved anywhere else."},"resize":{"enabled":true,"prod":false},"props":{"content":{"type":"text","label":"Content","category":"content","default":""},"width":{"type":"number","label":"Width","category":"size","default":530,"min":200,"max":1200},"height":{"type":"number","label":"Height","category":"size","min":60}},"features":[{"id":"toggle-edit","type":"action","action":"toggle-edit","label":"Edit","icon":"edit","surfaces":["fullbar","splitbar"],"toggle":{"stateKey":"editing","activeIcon":"eye","activeLabel":"Preview"}},{"id":"expand","type":"action","action":"expand","label":"$label:expand","icon":"expand","prod":true},{"id":"toggle-collapse","type":"action","action":"toggle-collapse","label":"Collapse height","icon":"fold"},{"id":"copy","type":"action","action":"copy","label":"$label:duplicate","icon":"copy"},{"id":"copy-text","type":"action","action":"copy-text","label":"Copy Markdown","icon":"unwrap","menu":true,"prod":true},{"id":"copy-link","type":"action","action":"copy-link","label":"$label:copy-link","icon":"link","menu":true,"prod":true,"alt":{"label":"$label:copy-id","action":"copy-widget-id"}},{"id":"delete","type":"action","action":"delete","label":"$label:delete","icon":"trash","menu":true}],"connectors":{"anchors":{"top":"available","bottom":"available","left":"available","right":"available"},"accept":["*"],"exclude":[]}},"file":{"label":"File","icon":"primer/file-code","expandable":true,"splitScreen":true,"deleteConfirm":{"enabled":true,"title":"Delete file widget?","message":"This removes the widget from the canvas. The file itself stays on disk and will not be deleted.","confirmLabel":"Delete widget"},"resize":{"enabled":true,"prod":false},"props":{"path":{"type":"text","label":"File path","category":"content","default":""},"mode":{"type":"select","label":"Mode","category":"settings","default":"view","options":["view","edit"]},"width":{"type":"number","label":"Width","category":"size","default":560,"min":240,"max":1600},"height":{"type":"number","label":"Height","category":"size","default":360,"min":120,"max":1600}},"features":[{"id":"toggle-edit","type":"action","action":"toggle-edit","label":"Edit","icon":"edit","surfaces":["fullbar","splitbar"],"toggle":{"stateKey":"editing","activeIcon":"check","activeLabel":"Save"}},{"id":"expand","type":"action","action":"expand","label":"$label:expand","icon":"expand","prod":true},{"id":"rename","type":"action","action":"rename-file","label":"$label:rename","icon":"pencil","menu":true,"prod":true},{"id":"copy-path","type":"action","action":"copy-path","label":"$label:copy-path","icon":"unwrap","menu":true,"prod":true},{"id":"copy-link","type":"action","action":"copy-link","label":"$label:copy-link","icon":"link","menu":true,"prod":true,"alt":{"label":"$label:copy-id","action":"copy-widget-id"}},{"id":"delete","type":"action","action":"delete","label":"$label:delete","icon":"trash","menu":true}],"connectors":{"anchors":{"top":"available","bottom":"available","left":"available","right":"available"},"accept":["*"],"exclude":[]}},"prototype":{"label":"Prototype Frame","icon":"prototype","expandable":true,"splitScreen":true,"resize":{"enabled":true,"prod":false},"props":{"src":{"type":"url","label":"URL","category":"content","default":""},"originalSrc":{"type":"url","label":"Original URL","category":"content","default":""},"label":{"type":"text","label":"Label","category":"settings","default":""},"zoom":{"type":"number","label":"Zoom","category":"settings","default":100,"min":25,"max":200},"snapshot":{"type":"url","label":"Snapshot","category":"content","default":""},"snapshotDark":{"type":"url","label":"Dark snapshot","category":"content","default":""},"width":{"type":"number","label":"Width","category":"size","default":800,"min":200,"max":2000},"height":{"type":"number","label":"Height","category":"size","default":600,"min":200,"max":1500}},"features":[{"id":"frame-theme","type":"dropdown","action":"set-frame-theme","label":"Theme","icon":"primer/sun","multiSelection":{"exclusive":false},"items":[{"id":"theme-light","type":"radio","label":"Light","action":"set-frame-theme","value":"light","toggleValue":"inherit","stateProp":"frameThemeOverride","defaultValue":"inherit"},{"id":"theme-dark","type":"radio","label":"Dark","action":"set-frame-theme","value":"dark","toggleValue":"inherit","stateProp":"frameThemeOverride","defaultValue":"inherit"}]},{"id":"frame-device","type":"dropdown","action":"set-frame-device","label":"Device","icon":"iconoir/computer","multiSelection":{"exclusive":false},"items":[{"id":"device-desktop","type":"radio","label":"Desktop","action":"set-frame-device","value":"desktop","stateProp":"frameDevice","defaultValue":"desktop"},{"id":"device-mobile","type":"radio","label":"Mobile","action":"set-frame-device","value":"mobile","stateProp":"frameDevice","defaultValue":"desktop"},{"id":"clip-height-separator","type":"separator"},{"id":"clip-height","type":"checkbox","label":"Clip height","action":"set-frame-clip-height","stateProp":"frameClipHeight","defaultValue":false,"checkedValue":true}]},{"id":"open-external","type":"action","action":"open-external","label":"Open in browser","icon":"open-external","prod":true},{"id":"edit-url","type":"action","action":"edit","label":"Switch prototype","icon":"iconoir/arrow-separate"},{"id":"expand","type":"action","action":"expand","label":"$label:expand","icon":"expand","prod":true},{"id":"copy","type":"action","action":"copy","label":"$label:duplicate","icon":"copy"},{"id":"refresh-frame","type":"action","action":"refresh-frame","label":"Refresh frame","icon":"sync","menu":true,"prod":true},{"id":"copy-link","type":"action","action":"copy-link","label":"$label:copy-link","icon":"link","menu":true,"prod":true,"alt":{"label":"$label:copy-id","action":"copy-widget-id"}},{"id":"delete","type":"action","action":"delete","label":"$label:delete","icon":"trash","menu":true}],"connectors":{"anchors":{"top":"available","bottom":"available","left":"available","right":"available"},"accept":["*"],"exclude":[]}},"site-frame":{"label":"Site Frame","icon":"browser","interactGate":true,"expandable":true,"splitScreen":true,"resize":{"enabled":true,"prod":false},"props":{"siteId":{"type":"string","label":"Site ID","category":"content","default":""},"route":{"type":"string","label":"Route","category":"content","default":""},"title":{"type":"string","label":"Title","category":"content","default":""},"snapshot":{"type":"url","label":"Snapshot","category":"content","default":""},"snapshotDark":{"type":"url","label":"Dark snapshot","category":"content","default":""},"openUrl":{"type":"url","label":"Open URL (published)","category":"content","default":""},"width":{"type":"number","label":"Width","category":"size","default":800,"min":200,"max":2000},"height":{"type":"number","label":"Height","category":"size","default":600,"min":200,"max":1500}},"features":[{"id":"frame-device","type":"dropdown","action":"set-frame-device","label":"Device","icon":"iconoir/computer","multiSelection":{"exclusive":false},"items":[{"id":"device-desktop","type":"radio","label":"Desktop","action":"set-frame-device","value":"desktop","stateProp":"frameDevice","defaultValue":"desktop"},{"id":"device-mobile","type":"radio","label":"Mobile","action":"set-frame-device","value":"mobile","stateProp":"frameDevice","defaultValue":"desktop"},{"id":"clip-height-separator","type":"separator"},{"id":"clip-height","type":"checkbox","label":"Clip height","action":"set-frame-clip-height","stateProp":"frameClipHeight","defaultValue":false,"checkedValue":true}]},{"id":"expand","type":"action","action":"expand","label":"Fullscreen","icon":"expand"},{"id":"open-external","type":"action","action":"open-external","label":"$label:open-ext","icon":"open-external","prod":true},{"id":"copy","type":"action","action":"copy","label":"$label:duplicate","icon":"copy"},{"id":"refresh-frame","type":"action","action":"refresh-frame","label":"Refresh frame","icon":"sync","menu":true,"prod":true},{"id":"recapture-preview","type":"action","action":"recapture-preview","label":"Recapture preview","icon":"camera","menu":true},{"id":"copy-link","type":"action","action":"copy-link","label":"$label:copy-link","icon":"link","menu":true,"prod":true},{"id":"delete","type":"action","action":"delete","label":"$label:delete","icon":"trash","menu":true}],"connectors":{"anchors":{"top":"available","bottom":"available","left":"available","right":"available"},"accept":["*"],"exclude":[]}},"figma-embed":{"label":"Figma Embed","icon":"primer/paintbrush","expandable":true,"splitScreen":true,"resize":{"enabled":true,"prod":false},"props":{"url":{"type":"url","label":"URL","category":"content","default":""},"width":{"type":"number","label":"Width","category":"size","default":800,"min":200,"max":2000},"height":{"type":"number","label":"Height","category":"size","default":450,"min":150,"max":1500}},"features":[{"id":"open-external","type":"action","action":"open-external","label":"Open in browser","icon":"open-external","prod":true},{"id":"expand","type":"action","action":"expand","label":"$label:expand","icon":"expand","prod":true},{"id":"copy","type":"action","action":"copy","label":"$label:duplicate","icon":"copy"},{"id":"copy-link","type":"action","action":"copy-link","label":"$label:copy-link","icon":"link","menu":true,"prod":true,"alt":{"label":"$label:copy-id","action":"copy-widget-id"}},{"id":"delete","type":"action","action":"delete","label":"$label:delete","icon":"trash","menu":true}],"connectors":{"anchors":{"top":"available","bottom":"available","left":"available","right":"available"},"accept":["*"],"exclude":[]}},"codepen-embed":{"label":"CodePen Embed","icon":"feather/codepen","expandable":true,"splitScreen":true,"resize":{"enabled":true,"prod":false},"props":{"url":{"type":"url","label":"URL","category":"content","default":""},"width":{"type":"number","label":"Width","category":"size","default":800,"min":200,"max":2000},"height":{"type":"number","label":"Height","category":"size","default":450,"min":150,"max":1500}},"features":[{"id":"open-external","type":"action","action":"open-external","label":"$label:open-ext","icon":"open-external","prod":true},{"id":"expand","type":"action","action":"expand","label":"$label:expand","icon":"expand","prod":true},{"id":"copy","type":"action","action":"copy","label":"$label:duplicate","icon":"copy"},{"id":"copy-link","type":"action","action":"copy-link","label":"$label:copy-link","icon":"link","menu":true,"prod":true,"alt":{"label":"$label:copy-id","action":"copy-widget-id"}},{"id":"delete","type":"action","action":"delete","label":"$label:delete","icon":"trash","menu":true}],"connectors":{"anchors":{"top":"available","bottom":"available","left":"available","right":"available"},"accept":["*"],"exclude":[]}},"link-preview":{"label":"Link Preview","icon":"primer/link","expandable":true,"splitScreen":true,"resize":{"enabled":false,"prod":false},"props":{"url":{"type":"url","label":"URL","category":"content","default":""},"title":{"type":"text","label":"Title","category":"content","default":""},"description":{"type":"text","label":"Description","category":"content","default":""},"ogImage":{"type":"url","label":"OG Image","category":"content","default":""},"width":{"type":"number","label":"Width","category":"size","min":200,"default":320},"height":{"type":"number","label":"Height","category":"size","min":80}},"features":[{"id":"open-external","type":"action","action":"open-external","label":"$label:open-ext","icon":"open-external","prod":true},{"id":"expand","type":"action","action":"expand","label":"$label:expand","icon":"expand","prod":true},{"id":"toggle-collapse","type":"action","action":"toggle-collapse","label":"Collapse height","icon":"fold"},{"id":"refresh-github","type":"action","action":"refresh-github","label":"Refresh data","icon":"sync"},{"id":"copy","type":"action","action":"copy","label":"$label:duplicate","icon":"copy","menu":true},{"id":"copy-text","type":"action","action":"copy-text","label":"Copy Markdown","icon":"unwrap","menu":true,"prod":true},{"id":"copy-link","type":"action","action":"copy-link","label":"$label:copy-link","icon":"link","menu":true,"prod":true,"alt":{"label":"$label:copy-id","action":"copy-widget-id"}},{"id":"delete","type":"action","action":"delete","label":"$label:delete","icon":"trash","menu":true}],"connectors":{"anchors":{"top":"available","bottom":"available","left":"available","right":"available"},"accept":["*"],"exclude":[]}},"component":{"label":"Component","icon":"iconoir/keyframe","resize":{"enabled":true,"prod":false},"props":{"width":{"type":"number","label":"Width","category":"size","min":100},"height":{"type":"number","label":"Height","category":"size","min":60}},"features":[{"id":"frame-theme","type":"dropdown","action":"set-frame-theme","label":"Theme","icon":"primer/sun","multiSelection":{"exclusive":false},"items":[{"id":"theme-light","type":"radio","label":"Light","action":"set-frame-theme","value":"light","toggleValue":"inherit","stateProp":"frameThemeOverride","defaultValue":"inherit"},{"id":"theme-dark","type":"radio","label":"Dark","action":"set-frame-theme","value":"dark","toggleValue":"inherit","stateProp":"frameThemeOverride","defaultValue":"inherit"}]},{"id":"copy-link","type":"action","action":"copy-link","label":"$label:copy-link","icon":"link","menu":true,"prod":true,"alt":{"label":"$label:copy-id","action":"copy-widget-id"}}],"connectors":{"anchors":{"top":"available","bottom":"available","left":"available","right":"available"},"accept":["*"],"exclude":[]}},"story":{"label":"Story","icon":"primer/book","splitScreen":true,"resize":{"enabled":true,"prod":false},"props":{"storyId":{"type":"text","label":"Story","category":"content","default":""},"exportName":{"type":"text","label":"Export","category":"content","default":""},"width":{"type":"number","label":"Width","category":"size","min":100},"height":{"type":"number","label":"Height","category":"size","min":60},"showCode":{"type":"boolean","label":"Show code","category":"settings","default":false}},"features":[{"id":"frame-theme","type":"dropdown","action":"set-frame-theme","label":"Theme","icon":"primer/sun","multiSelection":{"exclusive":false},"items":[{"id":"theme-light","type":"radio","label":"Light","action":"set-frame-theme","value":"light","toggleValue":"inherit","stateProp":"frameThemeOverride","defaultValue":"inherit"},{"id":"theme-dark","type":"radio","label":"Dark","action":"set-frame-theme","value":"dark","toggleValue":"inherit","stateProp":"frameThemeOverride","defaultValue":"inherit"}]},{"id":"expand","type":"action","action":"expand","label":"$label:expand","icon":"expand","prod":true},{"id":"show-code","type":"action","action":"show-code","label":"Show code","icon":"code","prod":true},{"id":"edit-source","type":"action","action":"edit-source","label":"$label:edit-source","icon":"edit","prod":true},{"id":"copy","type":"action","action":"copy","label":"$label:duplicate","icon":"copy"},{"id":"open-external","type":"action","action":"open-external","label":"$label:open-ext","icon":"open-external","prod":true},{"id":"copy-code","type":"action","action":"copy-code","label":"Copy code","icon":"code","menu":true,"prod":true},{"id":"refresh-frame","type":"action","action":"refresh-frame","label":"Refresh frame","icon":"sync","menu":true,"prod":true},{"id":"copy-link","type":"action","action":"copy-link","label":"$label:copy-link","icon":"link","menu":true,"prod":true,"alt":{"label":"$label:copy-id","action":"copy-widget-id"}},{"id":"delete","type":"action","action":"delete","label":"$label:delete","icon":"trash","menu":true}],"connectors":{"anchors":{"top":"available","bottom":"available","left":"available","right":"available"},"accept":["*"],"exclude":[]},"expandable":true},"component-set":{"label":"Component Set","icon":"iconoir/view-grid","resize":{"enabled":true,"prod":false},"interactGate":true,"interactGateLabel":"Click to interact","props":{"storyId":{"type":"text","label":"Story","category":"content","default":""},"layout":{"type":"text","label":"Layout","category":"settings","default":"auto","enum":["auto","wide","tall"]},"selected":{"type":"text","label":"Selected export","category":"state","default":""},"width":{"type":"number","label":"Width","category":"size","min":200},"height":{"type":"number","label":"Height","category":"size","min":120}},"features":[{"id":"frame-theme","type":"dropdown","action":"set-frame-theme","label":"Theme","icon":"primer/sun","multiSelection":{"exclusive":false},"items":[{"id":"theme-light","type":"radio","label":"Light","action":"set-frame-theme","value":"light","toggleValue":"inherit","stateProp":"frameThemeOverride","defaultValue":"inherit"},{"id":"theme-dark","type":"radio","label":"Dark","action":"set-frame-theme","value":"dark","toggleValue":"inherit","stateProp":"frameThemeOverride","defaultValue":"inherit"}]},{"id":"expand","type":"action","action":"expand","label":"$label:expand","icon":"expand","prod":true},{"id":"edit-source","type":"action","action":"edit-source","label":"$label:edit-source","icon":"edit","prod":true},{"id":"copy","type":"action","action":"copy","label":"$label:duplicate","icon":"copy"},{"id":"open-external","type":"action","action":"open-external","label":"$label:open-ext","icon":"open-external","prod":true},{"id":"refresh-frame","type":"action","action":"refresh-frame","label":"Refresh frame","icon":"sync","menu":true,"prod":true},{"id":"copy-link","type":"action","action":"copy-link","label":"$label:copy-link","icon":"link","menu":true,"prod":true,"alt":{"label":"$label:copy-id","action":"copy-widget-id"}},{"id":"delete","type":"action","action":"delete","label":"$label:delete","icon":"trash","menu":true}],"connectors":{"anchors":{"top":"available","bottom":"available","left":"available","right":"available"},"accept":["*"],"exclude":[]},"expandable":true},"prompt":{"label":"Prompt","icon":"primer/zap","flag":"prompt-widget","resize":{"enabled":true,"prod":false},"execution":{"default":"copilot","agents":{"copilot":{"command":"copilot --agent prompt-agent -p \\"${prompt}\\" --allow-all"},"claude":{"command":"claude --agent prompt-agent -p \\"${prompt}\\" --dangerously-skip-permissions"}}},"props":{"agentId":{"type":"select","label":"Agent","category":"settings","default":"copilot","options":["copilot","claude"]},"text":{"type":"text","label":"Prompt text","category":"content","default":""},"status":{"type":"text","label":"Status","category":"settings","default":"idle"},"sessionId":{"type":"text","label":"Session ID","category":"settings","default":""},"resultWidgetId":{"type":"text","label":"Result Widget ID","category":"settings","default":""},"errorMessage":{"type":"text","label":"Error Message","category":"settings","default":""},"connections":{"type":"text","label":"Connections","category":"settings","default":""},"width":{"type":"number","label":"Width","category":"size","default":320,"min":200},"height":{"type":"number","label":"Height","category":"size","default":180,"min":80}},"features":[{"id":"copy","type":"action","action":"copy","label":"$label:duplicate","icon":"copy"},{"id":"expand-output","type":"action","action":"expand-output","label":"Show output","icon":"unfold"},{"id":"copy-link","type":"action","action":"copy-link","label":"$label:copy-link","icon":"link","menu":true,"prod":true},{"id":"delete","type":"action","action":"delete","label":"$label:delete","icon":"trash","menu":true}]},"image":{"label":"Image","icon":"primer/image","splitScreen":true,"expandable":true,"resize":{"enabled":true,"prod":false},"props":{"src":{"type":"text","label":"Source","category":"content","default":""},"private":{"type":"boolean","label":"Private","category":"settings","default":false},"width":{"type":"number","label":"Width","category":"size","min":100},"height":{"type":"number","label":"Height","category":"size","min":60}},"features":[{"id":"toggle-private","type":"action","action":"toggle-private","label":"Make private","icon":"eye"},{"id":"expand","type":"action","action":"expand","label":"$label:expand","icon":"expand"},{"id":"copy","type":"action","action":"copy","label":"$label:duplicate","icon":"copy"},{"id":"image-actions","type":"dropdown","icon":"image","label":"Image actions","items":[{"action":"crop-image","label":"Crop","icon":"crop"},{"action":"download-image","label":"$label:download","icon":"download"},{"action":"copy-as-png","label":"$label:copy-png","icon":"copy","alt":{"label":"$label:copy-path","action":"copy-file-path"}}]},{"id":"copy-link","type":"action","action":"copy-link","label":"$label:copy-link","icon":"link","menu":true,"prod":true,"alt":{"label":"$label:copy-id","action":"copy-widget-id"}},{"id":"delete","type":"action","action":"delete","label":"$label:delete","icon":"trash","menu":true}],"connectors":{"anchors":{"top":"available","bottom":"available","left":"available","right":"available"},"accept":["*"],"exclude":[]}},"knobs":{"label":"Knobs","icon":"iconoir/select-point-3d","interaction":{"selectable":true,"movable":true,"resize":{"enabled":true,"prod":true}},"connectors":{"anchors":{"top":"available","bottom":"available","left":"available","right":"available"},"accept":["*"]},"props":{"width":{"type":"number","label":"Width","category":"size","min":280,"default":360},"height":{"type":"number","label":"Height","category":"size","min":200,"default":420},"activeTarget":{"type":"text","label":"Active target","category":"state","default":""}},"features":[{"id":"copy","type":"action","action":"copy","label":"$label:duplicate","icon":"copy"},{"id":"copy-link","type":"action","action":"copy-link","label":"$label:copy-link","icon":"link","menu":true,"prod":true},{"id":"delete","type":"action","action":"delete","label":"$label:delete","icon":"trash","menu":true,"prod":true}]},"terminal":{"label":"Terminal","icon":"primer/terminal","expandable":true,"splitScreen":true,"resize":{"prod":false},"props":{"private":{"type":"boolean","label":"Private","category":"settings","default":false},"width":{"type":"number","label":"Width","category":"size","min":300,"default":800},"height":{"type":"number","label":"Height","category":"size","min":200,"default":450}},"features":[{"id":"refresh-terminal","type":"action","action":"refresh-terminal","label":"Refresh terminal","icon":"sync","menu":true,"prod":true},{"id":"toggle-private","type":"action","action":"toggle-private","label":"Make private","icon":"eye"},{"id":"expand","type":"action","action":"expand","label":"$label:expand","icon":"expand"},{"id":"copy","type":"action","action":"copy","label":"$label:duplicate","icon":"copy"},{"id":"code-context","type":"dropdown","label":"Code context","icon":"code","content":"widget"},{"id":"copy-link","type":"action","action":"copy-link","label":"$label:copy-link","icon":"link","menu":true,"alt":{"label":"$label:copy-id","action":"copy-widget-id"}},{"id":"delete","type":"action","action":"delete","label":"$label:delete","icon":"trash","menu":true}],"connectors":{"anchors":{"top":"available","bottom":"available","left":"available","right":"available"},"accept":["*"],"exclude":[]},"interactGate":false},"terminal-read":{"label":"Terminal","icon":"primer/terminal","expandable":true,"splitScreen":true,"resize":{"enabled":false,"prod":false},"props":{"width":{"type":"number","label":"Width","category":"size","min":300,"default":800},"height":{"type":"number","label":"Height","category":"size","min":200,"default":450}},"features":[{"id":"expand","type":"action","action":"expand","label":"$label:expand","icon":"expand"},{"id":"copy-link","type":"action","action":"copy-link","label":"$label:copy-link","icon":"link","menu":true,"alt":{"label":"$label:copy-id","action":"copy-widget-id"}}],"connectors":{"anchors":{"top":"available","bottom":"available","left":"available","right":"available"},"accept":["*"],"exclude":[]},"interactGate":false},"agent":{"label":"Agent","icon":"agents","expandable":true,"splitScreen":true,"resize":{"enabled":false,"prod":false},"props":{"agentId":{"type":"text","label":"Agent","category":"settings","default":""},"alias":{"type":"text","label":"Alias","category":"settings","default":""},"startupCommand":{"type":"text","label":"Startup Command","category":"settings","default":""},"width":{"type":"number","label":"Width","category":"size","min":300,"default":1200},"height":{"type":"number","label":"Height","category":"size","min":200,"default":450}},"features":[{"id":"refresh-terminal","type":"action","action":"refresh-terminal","label":"Refresh terminal","icon":"sync","menu":true,"prod":true},{"id":"expand","type":"action","action":"expand","label":"$label:expand","icon":"expand"},{"id":"code-context","type":"dropdown","label":"Code context","icon":"code","content":"widget"},{"id":"copy-link","type":"action","action":"copy-link","label":"$label:copy-link","icon":"link","menu":true,"alt":{"label":"$label:copy-id","action":"copy-widget-id"}},{"id":"delete","type":"action","action":"delete","label":"$label:delete","icon":"trash","menu":true}],"connectors":{"anchors":{"top":"available","bottom":"available","left":"available","right":"available"},"accept":["*"],"exclude":[]},"interactGate":false},"agent-chat":{"label":"Agent Chat","icon":"primer/comment-discussion","flag":"agent-chat-widget","expandable":true,"splitScreen":true,"resize":{"enabled":true,"prod":false},"props":{"agentId":{"type":"text","label":"Agent ID","category":"settings","default":""},"width":{"type":"number","label":"Width","category":"size","min":300,"default":575},"height":{"type":"number","label":"Height","category":"size","min":200,"default":820}},"features":[{"id":"expand","type":"action","action":"expand","label":"$label:expand","icon":"expand"},{"id":"copy","type":"action","action":"copy","label":"$label:duplicate","icon":"copy"},{"id":"copy-link","type":"action","action":"copy-link","label":"$label:copy-link","icon":"link","menu":true,"alt":{"label":"$label:copy-id","action":"copy-widget-id"}},{"id":"delete","type":"action","action":"delete","label":"$label:delete","icon":"trash","danger":true}]}}');
const widgetsConfig = {
  variables: variables$1,
  connectorDefaults,
  widgets
};
const DEFAULT_ORTHOGONAL_PROXIMITY_THRESHOLD = 96;
function normalizeOrthogonalProximityThreshold(value) {
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_ORTHOGONAL_PROXIMITY_THRESHOLD;
}
const variables = widgetsConfig.variables || {};
function resolveVar(value) {
  if (typeof value !== "string" || !value.startsWith("$")) return value;
  const key = value.slice(1);
  return variables[key] ?? value;
}
function resolveFeature(feature) {
  const resolved = {};
  for (const [key, val] of Object.entries(feature)) {
    if (key === "items" && Array.isArray(val)) {
      resolved[key] = val.map((item) => {
        const r = {};
        for (const [k, v] of Object.entries(item)) {
          if (k === "alt" && v && typeof v === "object") {
            const altResolved = {};
            for (const [ak, av] of Object.entries(v)) altResolved[ak] = resolveVar(av);
            r[k] = altResolved;
          } else {
            r[k] = resolveVar(v);
          }
        }
        return r;
      });
    } else if (key === "alt" && val && typeof val === "object") {
      const r = {};
      for (const [k, v] of Object.entries(val)) r[k] = resolveVar(v);
      resolved[key] = r;
    } else if (key === "toggle" && val && typeof val === "object") {
      resolved[key] = { ...val };
    } else if (key === "surfaces" && Array.isArray(val)) {
      resolved[key] = val;
    } else {
      resolved[key] = resolveVar(val);
    }
  }
  return resolved;
}
function configPropToSchema(propDef) {
  const schema = {
    type: propDef.type,
    label: propDef.label,
    category: propDef.category
  };
  if (propDef.default !== void 0) schema.defaultValue = propDef.default;
  if (propDef.options) schema.options = propDef.options;
  if (propDef.min !== void 0) schema.min = propDef.min;
  if (propDef.max !== void 0) schema.max = propDef.max;
  return schema;
}
function resolveDefinition(type) {
  const consumer = getWidgetDefinition(type);
  if (consumer) {
    return {
      ...consumer,
      features: (consumer.features || []).map(resolveFeature)
    };
  }
  const core = widgetsConfig.widgets[type];
  if (!core) return null;
  return {
    ...core,
    features: (core.features || []).map(resolveFeature)
  };
}
function resolveSchema(type) {
  const def = resolveDefinition(type) || consumerOrCorePropsOnly(type);
  if (!def?.props) return {};
  const schema = {};
  for (const [key, propDef] of Object.entries(def.props)) {
    schema[key] = configPropToSchema(propDef);
  }
  return schema;
}
function consumerOrCorePropsOnly(type) {
  const consumer = getWidgetDefinition(type);
  if (consumer?.props) return consumer;
  return widgetsConfig.widgets[type] || null;
}
function getAllTypes() {
  return /* @__PURE__ */ new Set([
    ...Object.keys(widgetsConfig.widgets),
    ...Object.keys(getAllWidgetDefinitions())
  ]);
}
const schemas = new Proxy({}, {
  get(_, type) {
    if (typeof type !== "string") return void 0;
    return resolveSchema(type);
  },
  has(_, type) {
    return typeof type === "string" && (!!widgetsConfig.widgets[type] || !!getWidgetDefinition(type));
  },
  ownKeys() {
    return [...getAllTypes()];
  },
  getOwnPropertyDescriptor(_, type) {
    if (typeof type !== "string") return void 0;
    if (!widgetsConfig.widgets[type] && !getWidgetDefinition(type)) return void 0;
    return { enumerable: true, configurable: true, value: resolveSchema(type) };
  }
});
function widgetTypesSnapshot() {
  const result = {};
  for (const type of getAllTypes()) {
    const def = resolveDefinition(type);
    if (def) result[type] = def;
  }
  return result;
}
new Proxy({}, {
  get(_, type) {
    if (typeof type !== "string") return void 0;
    return resolveDefinition(type) || void 0;
  },
  has(_, type) {
    return typeof type === "string" && (!!widgetsConfig.widgets[type] || !!getWidgetDefinition(type));
  },
  ownKeys() {
    return [...getAllTypes()];
  },
  getOwnPropertyDescriptor(_, type) {
    if (typeof type !== "string") return void 0;
    const def = resolveDefinition(type);
    if (!def) return void 0;
    return { enumerable: true, configurable: true, value: def };
  }
});
function readInteraction(def) {
  if (!def) return null;
  const i = def.interaction || {};
  let movable;
  if (i.movable === false) movable = false;
  else if (typeof i.movable === "object" && i.movable !== null) movable = i.movable;
  else movable = true;
  return {
    selectable: i.selectable !== false,
    // default true
    movable,
    // default true
    resize: i.resize ?? def.resize ?? null,
    expandable: i.expandable ?? def.expandable ?? false,
    splitScreen: i.splitScreen ?? def.splitScreen ?? false,
    interactGate: i.interactGate ?? def.interactGate ?? false,
    interactGateLabel: i.interactGateLabel ?? def.interactGateLabel ?? "Click to interact"
  };
}
function getInteractionOptions(type) {
  return readInteraction(resolveDefinition(type)) || {
    selectable: true,
    movable: true,
    resize: null,
    expandable: false,
    splitScreen: false,
    interactGate: false,
    interactGateLabel: "Click to interact"
  };
}
function getWidgetKnobs(type) {
  return resolveDefinition(type)?.knobs ?? [];
}
function getFeaturesForSurface(type, surface, { isLocalDev = true } = {}) {
  let features = resolveDefinition(type)?.features ?? [];
  if (globalThis.__HYPERCANVAS_NOTEBOOK_PRODUCTION__ || !isLocalDev) {
    features = features.filter((f) => f.prod);
  }
  return features.filter((f) => {
    const surfaces = f.surfaces || ["toolbar"];
    return surfaces.includes(surface);
  });
}
function getWidgetMeta(type) {
  const def = resolveDefinition(type);
  if (!def) return null;
  return { label: def.label, icon: def.icon };
}
function isSplitScreenCapable(type) {
  return getInteractionOptions(type).splitScreen === true;
}
function getConnectorConfig(type) {
  const def = resolveDefinition(type)?.connectors;
  return {
    anchors: def?.anchors ?? { top: "available", bottom: "available", left: "available", right: "available" },
    accept: def?.accept ?? ["*"],
    exclude: def?.exclude ?? [],
    defaults: def?.defaults
  };
}
function getConnectorDefaults() {
  const defaults = widgetsConfig.connectorDefaults ?? {};
  const orthogonalStemLength = defaults.orthogonalStemLength;
  const orthogonalProximityThreshold = defaults.orthogonalProximityThreshold;
  return {
    controlOffset: defaults.controlOffset ?? 80,
    orthogonalStemLength: Number.isFinite(orthogonalStemLength) ? Math.max(0, orthogonalStemLength) : 36,
    orthogonalProximityThreshold: normalizeOrthogonalProximityThreshold(orthogonalProximityThreshold),
    stroke: defaults.stroke ?? "var(--hc-color-foreground-accent, #0969da)",
    strokeWidth: defaults.strokeWidth ?? 4,
    hoverStroke: defaults.hoverStroke ?? "var(--hc-color-foreground-danger, #cf222e)",
    hoverStrokeWidth: defaults.hoverStrokeWidth ?? 5,
    endpointRadius: defaults.endpointRadius ?? 6,
    endpointFill: defaults.endpointFill ?? "var(--hc-color-foreground-accent, #0969da)",
    endpointStroke: defaults.endpointStroke ?? "var(--hc-color-background, #ffffff)",
    endpointStrokeWidth: defaults.endpointStrokeWidth ?? 3,
    hitAreaStrokeWidth: defaults.hitAreaStrokeWidth ?? 24,
    dragStroke: defaults.dragStroke ?? "var(--hc-color-foreground-accent, #0969da)",
    dragStrokeWidth: defaults.dragStrokeWidth ?? 2,
    dragDasharray: defaults.dragDasharray ?? "6 4",
    dragOpacity: defaults.dragOpacity ?? 0.7,
    startEndpoint: defaults.startEndpoint ?? "circle",
    endEndpoint: defaults.endEndpoint ?? "circle"
  };
}
export {
  DEFAULT_ORTHOGONAL_PROXIMITY_THRESHOLD as D,
  getFeaturesForSurface as a,
  getConnectorDefaults as b,
  getConnectorConfig as c,
  getWidgetKnobs as d,
  getWidgetMeta as g,
  isSplitScreenCapable as i,
  schemas as s,
  widgetTypesSnapshot as w
};
