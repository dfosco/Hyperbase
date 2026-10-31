/**
 * storyboard-core — framework-agnostic data layer.
 *
 * This barrel exports all core utilities that have zero framework dependencies.
 * Any frontend (React, Vue, Alpine, vanilla JS) can use these directly.
 */
export { init } from './data/loader.js';
export { loadFlow, listFlows, flowExists, getFlowsForPrototype, loadRecord, findRecord, loadObject, deepMerge } from './data/loader.js';
export { resolveFlowName, resolveRecordName, resolveObjectName } from './data/loader.js';
export { listPrototypes, getPrototypeMetadata } from './data/loader.js';
export { listFolders, getFolderMetadata } from './data/loader.js';
export { listCanvases, getCanvasData } from './data/loader.js';
export { listStories, getStoryData } from './data/loader.js';
export { loadScene, listScenes, sceneExists } from './data/loader.js';
export { getByPath, setByPath, deepClone } from './data/dotPath.js';
export { getParam, setParam, getAllParams, removeParam } from './session/session.js';
export { getLocal, setLocal, removeLocal, getAllLocal, subscribeToStorage, getStorageSnapshot, notifyChange } from './session/localStorage.js';
export { isHideMode, activateHideMode, deactivateHideMode, getShadow, setShadow, removeShadow, getAllShadows, pushSnapshot, getOverrideHistory, getCurrentSnapshot, getCurrentRoute, getCurrentIndex, getNextIndex, canUndo, canRedo, undo, redo, syncHashToHistory, installHistorySync } from './session/hideMode.js';
export { interceptHideParams, installHideParamListener } from './session/interceptHideParams.js';
export { subscribeToHash, getHashSnapshot } from './session/hashSubscribe.js';
export { installBodyClassSync, setFlowClass, syncOverrideClasses } from './session/bodyClasses.js';
export { setSceneClass } from './session/bodyClasses.js';
export { registerMode, unregisterMode, getRegisteredModes, getCurrentMode, activateMode, deactivateMode, subscribeToMode, getModeSnapshot, syncModeClasses, on, off, emit, initModesConfig, isModesEnabled, getLockedMode, isModeSwitcherVisible } from './modes/modes.js';
export { initTools, setToolAction, setToolState, getToolState, getToolsForMode, subscribeToTools, getToolsSnapshot } from './modes/modes.js';
export { mountDevTools } from './devtools/devtools-consumer.js';
export { mountFlowDebug } from './devtools/sceneDebug.js';
export { mountSceneDebug } from './devtools/sceneDebug.js';
export { mountStoryboardCore } from './mountStoryboardCore.js';
export { hash, resolveFlowRoute, getFlowMeta, buildPrototypeIndex, appendTokens } from './data/viewfinder.js';
export { resolveSceneRoute, getSceneMeta } from './data/viewfinder.js';
export { initFeatureFlags, getFlag, setFlag, toggleFlag, getAllFlags, resetFlags, getFlagKeys, syncFlagBodyClasses } from './stores/featureFlags.js';
export * from './knobs/index.js';
export { initCommandActions, registerCommandAction, unregisterCommandAction, setDynamicActions, clearDynamicActions, getActionsForMode, executeAction, getActionChildren, hasChildrenProvider, subscribeToCommandActions, getCommandActionsSnapshot, setRoutingBasePath, isExcludedByRoute } from './stores/commandActions.js';
export { initPlugins, isPluginEnabled, getPluginsConfig } from './stores/plugins.js';
export { initUIConfig, isMenuHidden, getHiddenItems, addHiddenItems } from './stores/uiConfig.js';
export { initToolRegistry, registerToolModule, setToolComponent, setToolGuardResult, getToolComponent, getToolModule, getToolsForToolbar, getToolConfig, getAllToolConfigs, subscribeToToolRegistry, getToolRegistrySnapshot } from './stores/toolRegistry.js';
export { initToolbarConfig, setPrototypeToolbarConfig, clearPrototypeToolbarConfig, getToolbarConfig, subscribeToToolbarConfig, getToolbarConfigSnapshot, setClientToolbarOverrides, consumeClientToolbarOverrides } from './stores/toolbarConfigStore.js';
export { TOOL_STATES, initToolbarToolStates, setToolbarToolState, getToolbarToolState, isToolbarToolLocalOnly, subscribeToToolbarToolStates, getToolbarToolStatesSnapshot } from './stores/toolStateStore.js';
export { initCommentsConfig, getCommentsConfig, isCommentsEnabled } from './comments/config.js';
export { AUTO_PLACE_DEFAULTS, initCanvasConfig, getPasteRules, getTerminalConfig, getAgentsConfig, isTerminalResizable, getTerminalDimensions, getCanvasZoom, getCanvasProduction, isCanvasProductionEnabled } from './stores/canvasConfig.js';
export { getCommandPaletteConfig, initCommandPaletteConfig } from './stores/commandPaletteConfig.js';
export { initConfig, getConfig, setOverrides, clearOverrides, clearAllOverrides, subscribeToConfig, getConfigSnapshot } from './stores/configStore.js';
export { initCustomerModeConfig, getCustomerModeConfig, isCustomerMode, getCustomerModeHomepage, resolveHomepageTarget, isCustomerHidingHomepage, isCustomerHidingAllTools, isCustomerHidingCommandPalette, isCustomerHidingBranchBar, isCustomerToolHidden, } from './stores/customerModeConfig.js';
export { initPresentation, setPresentation, getPresentation, subscribeToPresentation, getPresentationSnapshot, } from './stores/presentationStore.js';
export { initWidgetRegistry, registerWidget, unregisterWidget, getWidgetDefinition, getAllWidgetDefinitions, subscribeToWidgetRegistry, getWidgetRegistrySnapshot, } from './stores/widgetRegistry.js';
export { initCanvasInteraction, setCanvasInteraction, getCanvasInteraction, subscribeToCanvasInteraction, getCanvasInteractionSnapshot, } from './stores/canvasInteractionStore.js';
export { setTheme, getTheme, themeState, themeSyncState, THEMES, getThemeSyncTargets, setThemeSyncTarget, getSurfaceSync, setSurfaceSync, surfaceSyncState, getResolvedFor, } from './stores/themeStore.js';
export { trackRecent, getRecent, clearRecent, subscribeToRecent, getRecentSnapshot } from './stores/recentArtifacts.js';
export { scoreMatch } from './utils/fuzzySearch.js';
export { default as Icon, default as IconDefault } from './ui/Icon.jsx';
export { default as BranchSelect } from './ui/BranchSelect.jsx';
export { sbNavigate, setNavigationRouter, getNavigationRouter } from './navigation/sbNavigate.js';
export { normalizeSiteId, normalizeSiteRoute, normalizeSiteUrl, resolveSiteUrl } from './site/contract.js';
export { createPublishedSiteFrame, normalizeSiteReference, siteCaptureKey } from './site/publish.js';
export { buildPublishedSiteManifest, renderPublishedSiteFrame } from './site/published.js';
