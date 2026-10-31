import { buildNotebookBrowserUrl, normalizeNotebookBrowserLinkOptions, resolveNotebookView } from '../../core/session/notebookView.js'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { getConfig } from '../../core/stores/configStore.js'
import { getNotebookViewSearch, isChromeHidden, subscribeToChromeVisibility } from '../../core/session/chromeVisibility.js'
import { coreApiPath, coreRequestJson, NOTEBOOK_SIDEBAR_EVENT, openNotebookSidebar } from '../../core/notebook/browserBridge.js'
import { getFlag, isCustomerHidingAllTools, isCustomerMode, subscribeToStorage } from '../../core/index.js'
import ArrowLeft from '../lucide/icons/arrow-left.js'
import ArrowRight from '../lucide/icons/arrow-right.js'
import ExternalLink from '../lucide/icons/external-link.js'
import PanelLeft from '../lucide/icons/panel-left.js'
import PanelRight from '../lucide/icons/panel-right.js'
import Settings2 from '../lucide/icons/settings.js'
import Activity from '../lucide/icons/chart-no-axes-combined.js'
import Ellipsis from '../lucide/icons/ellipsis.js'
import { Button } from '../chrome/ui/button.jsx'
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuAction,
  SidebarFooter,
  SidebarInput,
  SidebarSeparator,
  SidebarMenuButton,
} from '../chrome/ui/sidebar.jsx'
import { Input } from '../chrome/ui/input.jsx'
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbPage } from '../chrome/ui/breadcrumb.jsx'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuCheckboxItem } from '../chrome/ui/dropdown-menu.jsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../chrome/ui/dialog.jsx'
import { ChevronDownIcon, PlusIcon } from 'lucide-react'
import {
  artifactRouteStorageKey,
  buildArtifactRoute,
  getArtifactRouteLocation,
  matchesArtifactRoute,
} from '../artifactNavigation.js'
import CreateDialog from '../CommandPalette/CreateDialog.jsx'
import NotebookDialog from '../NotebookDialog/NotebookDialog.jsx'
import SettingsDialog from '../settings/SettingsDialog.jsx'
import BranchBar from '../BranchBar/BranchBar.jsx'
import { requestText, requestConfirmation } from '../../core/ui/userDialogs.js'
import { NotebookSidebarTree } from '../NotebookSidebarTree/NotebookSidebarTree.jsx'
import css from './NotebookShell.module.css'
import { SidebarNoticeContext } from './SidebarNoticeContext.js'

const TYPE_SINGULAR = { prototype: 'Prototype', canvas: 'Canvas', component: 'Component', site: 'Site' }
const LAYOUT_EVENT = 'storyboard:notebook-layout-updated'
const SIDEBAR_STATE_EVENT = 'storyboard:notebook-sidebar-state-changed'

export function lastVisitedPageStorageKey(notebookId) {
  return `hypercanvas:notebook:${notebookId}:last-page`
}

export { openNotebookSidebar }

function getStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch { return fallback }
}

function setStorage(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage may be disabled */ }
}

function routeMatches(page, pathname) {
  return matchesArtifactRoute(page, pathname) || (page?.type === 'canvas' && page?.route === pathname)
}

function hasRouteConflict(page) {
  return Boolean(page?.diagnostics?.some(item => item.code === 'PAGE_ROUTE_CONFLICT'))
}

function useNotebookCatalog(enabled, published) {
  const [catalog, setCatalog] = useState({ pages: [], navigation: null, tree: null, diagnostics: [], notebookId: null, generation: null, revision: null, description: '', sites: [] })
  const [error, setError] = useState('')
  const refresh = useCallback(async signal => {
    if (!enabled) return
    try {
      if (published) {
        const exported = window.__HYPERCANVAS_NOTEBOOK_PUBLICATION__
        if (!exported || !Array.isArray(exported.pages)) throw new Error('Published Notebook navigation data is missing.')
        if (signal?.aborted) return
        setCatalog({
          title: exported.title || 'Notebook',
          description: exported.description || '',
          pages: exported.pages,
          navigation: exported.navigation || null,
          tree: exported.tree || null,
          diagnostics: Array.isArray(exported.diagnostics) ? exported.diagnostics : [],
          notebookId: exported.notebookId || 'published',
          generation: 'published',
          revision: null,
          sites: [],
        })
        setError('')
        return
      }
      const [pagesData, navigationData, siteData] = await Promise.all([
        coreRequestJson('/_hypercanvas/notebook/pages', { cache: 'no-store', signal }),
        coreRequestJson('/_hypercanvas/notebook/navigation', { cache: 'no-store', signal }),
        published ? Promise.resolve({ sites: [] }) : coreRequestJson('/_hypercanvas/site/list', { cache: 'no-store', signal }).catch(() => ({ sites: [] })),
      ])
      if (signal?.aborted) return
      setCatalog({
        title: pagesData.title || navigationData.title || 'Notebook',
        description: pagesData.description || '',
        pages: Array.isArray(pagesData.pages) ? pagesData.pages : [],
        navigation: navigationData.navigation || null,
        tree: navigationData.tree || null,
        diagnostics: Array.isArray(navigationData.diagnostics) ? navigationData.diagnostics : [],
        notebookId: pagesData.notebookId || navigationData.notebookId || null,
        generation: pagesData.generation ?? navigationData.generation ?? null,
        revision: navigationData.revision || pagesData.revision || null,
        sites: Array.isArray(siteData.sites) ? siteData.sites : [],
      })
      setError('')
    } catch (cause) {
      if (!signal?.aborted) setError(cause?.message || 'Could not load Notebook pages.')
    }
  }, [enabled, published])

  useEffect(() => {
    if (!enabled) return undefined
    const controller = new AbortController()
    refresh(controller.signal)
    const timer = window.setInterval(() => refresh(controller.signal), 4000)
    const layoutUpdated = event => {
      const data = event.detail
      if (!data || data.notebookId !== catalog.notebookId || data.generation !== catalog.generation) return
      setCatalog(current => ({ ...current, navigation: data.navigation || current.navigation, revision: data.revision || current.revision }))
    }
    const catalogChanged = () => refresh(controller.signal)
    const orderChanged = event => {
      const data = event.detail
      if (!data || data.notebookId !== catalog.notebookId || data.generation !== catalog.generation) return
      refresh(controller.signal)
    }
    window.addEventListener(LAYOUT_EVENT, layoutUpdated)
    window.addEventListener('storyboard:notebook-order-changed', orderChanged)
    window.addEventListener('storyboard:sites-changed', catalogChanged)
    window.addEventListener('storyboard:site-removed', catalogChanged)
    return () => {
      controller.abort()
      window.clearInterval(timer)
      window.removeEventListener(LAYOUT_EVENT, layoutUpdated)
      window.removeEventListener('storyboard:notebook-order-changed', orderChanged)
      window.removeEventListener('storyboard:sites-changed', catalogChanged)
      window.removeEventListener('storyboard:site-removed', catalogChanged)
    }
  }, [catalog.generation, catalog.notebookId, enabled, refresh])

  return { catalog, setCatalog, error, refresh }
}

function siteRowState(sites, siteId) {
  const site = sites.find(item => item.id === siteId)
  return site ? { status: site.binding?.status || 'stopped', site } : { status: 'unknown', site: null }
}

/** Shared authoring shell. It stays outside StoryboardProvider so route-level provider branches cannot replace it. */
export default function NotebookShell({ children, onRepairNestedArtifact }) {
  const location = useLocation()
  const navigate = useNavigate()
  const navigationType = useNavigationType()
  const published = import.meta.env.VITE_NOTEBOOK_PUBLISHED === '1'
  const storedChromeHidden = useSyncExternalStore(subscribeToChromeVisibility, isChromeHidden, () => false)
  // History presentation updates need not navigate or remount the router.
  const viewSearch = useSyncExternalStore(subscribeToChromeVisibility, getNotebookViewSearch, () => '')
  const view = resolveNotebookView(viewSearch)
  const embedded = view.embed || new URLSearchParams(location.search).has('_sb_embed')
  const chromeHidden = storedChromeHidden || !view.notebookVisible
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  const deprecatedWorkspace = location.pathname === `${base}/workspace` || location.pathname.startsWith(`${base}/workspace/`)
  const customerHidden = isCustomerMode() && isCustomerHidingAllTools()
  const enabled = !embedded && !deprecatedWorkspace && !customerHidden
  const { catalog, setCatalog, error, refresh } = useNotebookCatalog(enabled, published)
  const [open, setOpen] = useState(true)
  const [browserLink, setBrowserLink] = useState(() => normalizeNotebookBrowserLinkOptions(getConfig().notebookBrowserLink))
  const [noticeSlot, setNoticeSlot] = useState(null)
  const [search, setSearch] = useState('')
  const [mutationError, setMutationError] = useState('')
  const [createType, setCreateType] = useState(null)
  const [createContext, setCreateContext] = useState(null)
  const [focusedFolderPath, setFocusedFolderPath] = useState('')
  const [notebookDialogOpen, setNotebookDialogOpen] = useState(false)
  const [notebookEditOpen, setNotebookEditOpen] = useState(false)
  const [notebookTitle, setNotebookTitle] = useState('')
  const [notebookDescription, setNotebookDescription] = useState('')
  const [notebookSaveError, setNotebookSaveError] = useState('')
  const [notebookSaving, setNotebookSaving] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const [diagnostics, setDiagnostics] = useState(null)
  const [activePageOverride, setActivePageOverride] = useState(null)
  const [, setFeatureFlagRevision] = useState(0)
  const [artifactHistory, setArtifactHistory] = useState({ index: 0, length: 0 })
  const artifactHistoryRef = useRef({ entries: [], index: -1 })
  const navRef = useRef(null)

  useEffect(() => subscribeToStorage(() => setFeatureFlagRevision(revision => revision + 1)), [])
  const pageById = useMemo(() => new Map(catalog.pages.map(page => [page.id, page])), [catalog.pages])
  const routeMatchesHere = catalog.pages.filter(page => routeMatches(page, location.pathname))
  const routePageId = new URLSearchParams(location.search).get('_notebookPage')
  const routePage = routeMatchesHere.find(page => page.id === routePageId) || routeMatchesHere[0] || null
  const activePageId = location.pathname.startsWith('/docs/') ? routePage?.id || null : activePageOverride && pageById.has(activePageOverride) ? activePageOverride : routePage?.id || null
  const activePage = activePageId ? pageById.get(activePageId) : null
  const showSidebarSearch = getFlag('notebook-sidebar-search')
  const activeSearch = showSidebarSearch ? search : ''
  const localPrefKey = catalog.notebookId ? `hypercanvas:notebook:${catalog.notebookId}:sidebar` : null
  const saveOpen = useCallback(next => {
    setOpen(next)
    document.documentElement.dataset.notebookSidebarOpen = String(Boolean(enabled && next && !chromeHidden))
    if (localPrefKey) setStorage(localPrefKey, { ...getStorage(localPrefKey, {}), open: next })
    window.dispatchEvent(new CustomEvent(SIDEBAR_STATE_EVENT, { detail: { open: Boolean(enabled && next && !chromeHidden) } }))
  }, [chromeHidden, enabled, localPrefKey])

  const artifactPage = activePage && ['site', 'prototype', 'component'].includes(activePage.type) ? activePage : null
  const hasArtifactNavigation = Boolean(artifactPage && activePage?.available !== false)
  const artifactIdentity = artifactPage
    ? `${artifactPage.type}:${artifactPage.type === 'site' ? artifactPage.siteId : artifactPage.id}`
    : null
  const artifactHistoryLocation = `${location.pathname}${location.search || ''}${location.hash || ''}`

  useEffect(() => {
    const root = document.documentElement
    root.dataset.notebookSidebarOpen = String(Boolean(enabled && open && !chromeHidden))
    root.classList.toggle('sb-notebook-sidebar-open', enabled && open && !chromeHidden && activePage?.type === 'canvas')
    root.classList.toggle('sb-artifact-navigation-open', Boolean(enabled && artifactPage && !chromeHidden))
    window.dispatchEvent(new CustomEvent(SIDEBAR_STATE_EVENT, { detail: { open: Boolean(enabled && open && !chromeHidden) } }))
    return () => {
      root.classList.remove('sb-notebook-sidebar-open')
      root.classList.remove('sb-artifact-navigation-open')
      delete root.dataset.notebookSidebarOpen
    }
  }, [activePage?.type, artifactIdentity, artifactPage, chromeHidden, enabled, open])

  useEffect(() => {
    const current = { key: location.key, href: artifactHistoryLocation }
    const previous = artifactHistoryRef.current
    let next
    if (previous.index < 0) {
      next = { entries: [current], index: 0 }
    } else if (navigationType === 'POP') {
      const found = previous.entries.findIndex(entry => entry.key === current.key)
      const matchingHref = found >= 0 ? found : previous.entries.findIndex(entry => entry.href === current.href)
      next = matchingHref >= 0
        ? { ...previous, index: matchingHref }
        : { entries: [current], index: 0 }
    } else if (navigationType === 'REPLACE') {
      const entries = [...previous.entries]
      entries[previous.index] = current
      next = { ...previous, entries }
    } else if (previous.entries[previous.index]?.key !== current.key) {
      next = {
        entries: [...previous.entries.slice(0, previous.index + 1), current],
        index: previous.index + 1,
      }
    } else {
      next = previous
    }
    artifactHistoryRef.current = next
    setArtifactHistory({ index: next.index, length: next.entries.length })

    if (artifactPage) {
      const key = artifactRouteStorageKey(artifactPage)
      const route = getArtifactRouteLocation(artifactPage, location.pathname, location.search, location.hash)
      if (key && route !== null) setStorage(key, route)
    }
  }, [artifactHistoryLocation, artifactPage, location.key, location.pathname, location.search, location.hash, navigationType])

  useEffect(() => {
    if (!localPrefKey) return
    const preferences = getStorage(localPrefKey, null)
    if (preferences && typeof preferences === 'object') {
      setOpen(preferences.open !== false)
      setSearch(typeof preferences.search === 'string' ? preferences.search : '')
    }
    const lastPage = getStorage(lastVisitedPageStorageKey(catalog.notebookId), null)
    if (lastPage && pageById.has(lastPage)) setActivePageOverride(lastPage)
  }, [catalog.notebookId, localPrefKey, pageById])

  useEffect(() => {
    if (localPrefKey) setStorage(localPrefKey, { ...getStorage(localPrefKey, {}), search })
  }, [localPrefKey, search])

  useEffect(() => {
    if (routePage) {
      setActivePageOverride(routePage.id)
      if (catalog.notebookId) setStorage(lastVisitedPageStorageKey(catalog.notebookId), routePage.id)
    }
  }, [catalog.notebookId, location.pathname, location.search, routePage])

  useEffect(() => {
    if (!routePage || !['site', 'prototype', 'component'].includes(routePage.type) || location.state?.restoreArtifactRoute !== true) return
    if (location.pathname.replace(/\/$/, '') !== routePage.route.replace(/\/$/, '')) return
    const key = artifactRouteStorageKey(routePage)
    const savedRoute = key ? getStorage(key, '') : ''
    if (typeof savedRoute !== 'string' || !savedRoute) return
    const nextLocation = buildArtifactRoute(routePage, savedRoute)
    if (!nextLocation || nextLocation === location.pathname + location.search + location.hash) return
    navigate(nextLocation, { replace: true, state: null })
  }, [location.hash, location.pathname, location.search, location.state, navigate, routePage])

  useEffect(() => {
    if (!enabled) return undefined
    const openSidebar = event => {
      if (!view.recoveryAvailable) return
      saveOpen(true)
      setSearch('')
      const focusType = event?.detail?.focusType
      requestAnimationFrame(() => {
        const target = focusType
          ? navRef.current?.querySelector(`[data-page-type="${focusType}"] [data-tree-key]`)
          : navRef.current?.querySelector('button, a')
        target?.scrollIntoView?.({ block: 'nearest' })
        ;(target || navRef.current?.querySelector('button, a'))?.focus()
      })
    }
    const toggleSidebar = () => { if (view.recoveryAvailable) saveOpen(!open) }
    const openSettings = () => { if (view.toolPanelsAvailable) setSettingsOpen(true) }
    window.addEventListener(NOTEBOOK_SIDEBAR_EVENT, openSidebar)
    window.addEventListener('storyboard:toggle-notebook-sidebar', toggleSidebar)
    window.addEventListener('storyboard:open-settings', openSettings)
    return () => {
      window.removeEventListener(NOTEBOOK_SIDEBAR_EVENT, openSidebar)
      window.removeEventListener('storyboard:toggle-notebook-sidebar', toggleSidebar)
      window.removeEventListener('storyboard:open-settings', openSettings)
    }
  }, [enabled, localPrefKey, open, saveOpen, view.recoveryAvailable, view.toolPanelsAvailable])

  const repairNestedArtifact = async diagnostic => {
    if (published || !catalog.notebookId || catalog.generation == null || !catalog.revision) {
      throw new Error('Notebook repair is unavailable without the current authoring scope and revision.')
    }
    const nestedArtifact = diagnostic?.nestedArtifact
    const containingArtifact = diagnostic?.containingArtifact
    if (!nestedArtifact?.kind || !nestedArtifact?.path || !containingArtifact?.kind || !containingArtifact?.path || typeof diagnostic.proposedDestination !== 'string') {
      throw new Error('This nesting diagnostic is incomplete. Refresh the Notebook tree before retrying.')
    }
    const body = {
      notebookId: catalog.notebookId,
      generation: catalog.generation,
      expectedRevision: catalog.revision,
      nestedArtifact: { kind: nestedArtifact.kind, path: nestedArtifact.path },
      containingArtifact: { kind: containingArtifact.kind, path: containingArtifact.path },
      expectedProposedDestination: diagnostic.proposedDestination,
    }
    try {
      const repaired = await coreRequestJson('/_hypercanvas/notebook/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      await refresh()
      return repaired
    } catch (cause) {
      await refresh()
      if (cause?.data?.moved === true) {
        const fromPath = cause.data.fromPath || nestedArtifact.path
        const toPath = cause.data.toPath || diagnostic.proposedDestination
        setMutationError(`${cause.message || 'Repair reconciliation failed after the artifact moved.'} The artifact moved from ${fromPath} to ${toPath}. Refresh the Notebook before taking further action.`)
      }
      throw cause
    }
  }

  const openPage = page => {
    setActivePageOverride(page.id)
    if (catalog.notebookId) setStorage(lastVisitedPageStorageKey(catalog.notebookId), page.id)
    if (page.route) {
      const routeKey = artifactRouteStorageKey(page)
      const savedRoute = routeKey ? getStorage(routeKey, '') : ''
      const route = routeKey ? buildArtifactRoute(page, savedRoute) : page.route
      const routeUrl = new URL(route || page.route, window.location.origin)
      const params = new URLSearchParams(routeUrl.search)
      if (hasRouteConflict(page)) params.set('_notebookPage', page.id)
      else params.delete('_notebookPage')
      const query = params.toString()
      const nextLocation = `${routeUrl.pathname}${query ? `?${query}` : ''}${routeUrl.hash}`
      const currentLocation = `${location.pathname}${location.search || ''}${location.hash || ''}`
      if (nextLocation !== currentLocation) navigate(nextLocation)
    }
  }

  const startCreate = (type, contextOverride = createContext) => {
    const initialValues = {}
    const parentPath = typeof contextOverride === 'string' ? contextOverride : contextOverride?.parentPath ?? focusedFolderPath
    if (typeof parentPath === 'string') initialValues.parentPath = parentPath
    setCreateContext(initialValues)
    setCreateType(type)
  }

  const onCreate = (type, { parentPath } = {}) => startCreate(type, { parentPath })

  const deletePage = async page => {
    if (published) return
    const artifactName = page.type === 'site' ? page.siteId
      : page.type === 'canvas' ? String(page.path || '').split('/').at(-1)?.replace(/\.canvas\.jsonl$/, '')
        : String(page.path || '').split('/').at(-1) || page.title
    const initial = await fetch(coreApiPath('/_hypercanvas/artifact/'), {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: page.type, name: artifactName }),
    })
    const result = await initial.json().catch(() => ({}))
    if (initial.status === 409 && result.code === 'CONFIRMATION_REQUIRED') {
      const detail = result.affectedFiles?.length
        ? `\n\nAffected files:\n${result.affectedFiles.map(file => `• ${file}`).join('\n')}`
        : ''
      if (!await requestConfirmation(`${result.error || `Delete ${page.title}?`}${detail}`)) return
      const confirmed = await fetch(coreApiPath('/_hypercanvas/artifact/'), {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: page.type, name: artifactName,
          ...(page.type === 'site' ? { confirmed: true } : { confirmedFiles: result.affectedFiles || [] }),
        }),
      })
      const data = await confirmed.json().catch(() => ({}))
      if (!confirmed.ok) throw new Error(data.error || 'Could not delete page.')
      setActivePageOverride(null)
      await refresh()
      return
    }
    if (!initial.ok) throw new Error(result.error || 'Could not delete page.')
    await refresh()
  }

  const renamePage = async page => {
    if (published) return
    const title = await requestText('Page title', page.title || '')
    if (!title?.trim() || title.trim() === page.title) return
    const artifactName = page.type === 'site' ? page.siteId
      : page.type === 'canvas' ? String(page.path || '').split('/').at(-1)?.replace(/\.canvas\.jsonl$/, '')
        : String(page.path || '').split('/').at(-1) || page.title
    const response = await fetch(coreApiPath('/_hypercanvas/artifact/'), {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: page.type, name: artifactName, title: title.trim() }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'Could not rename page.')
    await refresh()
  }

  const runSiteAction = async (page, action) => {
    const response = await fetch(coreApiPath(`/_hypercanvas/site/${encodeURIComponent(page.siteId)}/${action}`), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmed: true }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || `Could not ${action} Site.`)
    await refresh()
  }

  const showInFinder = async page => {
    setMutationError('')
    await coreRequestJson('/_hypercanvas/system/show-in-finder', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: page.folderPath || page.path }),
    })
  }

  const rowActions = page => {
    const site = page.type === 'site' ? siteRowState(catalog.sites, page.siteId) : null
    return (
      <DropdownMenu>
        <DropdownMenuTrigger render={<SidebarMenuAction aria-label={`Actions for ${page.title}`} title="Page actions" onClick={event => event.stopPropagation()}><Ellipsis size={16} /></SidebarMenuAction>} />
        <DropdownMenuContent align="end" className="hc-w-56" onClick={event => event.stopPropagation()}>
          <DropdownMenuGroup>
            <DropdownMenuLabel>{page.title}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => openPage(page)}>Open</DropdownMenuItem>
            <DropdownMenuItem onClick={() => showInFinder(page).catch(error => setMutationError(error.message))}>Show in Finder</DropdownMenuItem>
            {!['site', 'doc'].includes(page.type) && <DropdownMenuItem onClick={() => renamePage(page).catch(error => setMutationError(error.message))}>Rename</DropdownMenuItem>}
            {page.type === 'site' && <>
              <DropdownMenuItem onClick={() => runSiteAction(page, site?.status === 'running' ? 'stop' : 'start').catch(error => setMutationError(error.message))}>{site?.status === 'running' ? 'Stop' : 'Start'}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => runSiteAction(page, 'restart').catch(error => setMutationError(error.message))}>Restart</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`${page.route}?edit=true`)}>Edit Site</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`${page.route}?rebind=true`)}>Rebind directory</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`${page.route}?terminal=true`)}>Terminal</DropdownMenuItem>
              {page.productionUrl && <DropdownMenuItem onClick={() => window.open(page.productionUrl, '_blank', 'noopener,noreferrer')}>Open production URL</DropdownMenuItem>}
            </>}
          </DropdownMenuGroup>
          {page.type !== 'doc' && <><DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onClick={() => deletePage(page).catch(error => setMutationError(error.message))}>Delete page…</DropdownMenuItem>
          </DropdownMenuGroup></>}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const fetchDiagnostics = async () => {
    setDiagnosticsOpen(true)
    try { setDiagnostics(await coreRequestJson('/_hypercanvas/diagnostics', { cache: 'no-store' })) }
    catch (cause) { setDiagnostics({ error: cause?.message || 'Could not load diagnostics.' }) }
  }

  const openNotebookEdit = () => {
    setNotebookTitle(catalog.title || '')
    setNotebookDescription(catalog.description || '')
    setNotebookSaveError('')
    setNotebookEditOpen(true)
  }

  const saveNotebookMetadata = async event => {
    event.preventDefault()
    if (!catalog.notebookId || !notebookTitle.trim() || notebookSaving) return
    setNotebookSaving(true)
    setNotebookSaveError('')
    try {
      const updated = await coreRequestJson('/_hypercanvas/notebook/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebookId: catalog.notebookId,
          generation: catalog.generation,
          expectedRevision: catalog.revision,
          title: notebookTitle,
          description: notebookDescription,
        }),
      })
      setCatalog(current => ({ ...current, title: updated.title, description: updated.description, revision: updated.revision }))
      setNotebookEditOpen(false)
    } catch (cause) {
      setNotebookSaveError(cause?.message || 'Could not save Notebook details.')
      await refresh()
    } finally {
      setNotebookSaving(false)
    }
  }

  const createDialogInitialValues = createContext && Object.keys(createContext).length ? createContext : null
  const canGoBack = artifactHistory.index > 0
  const canGoForward = artifactHistory.index >= 0 && artifactHistory.index < artifactHistory.length - 1

  if (!enabled) return children

  return (
    <SidebarNoticeContext.Provider value={noticeSlot}>
    <div className={`${css.shell} ${open ? css.shellOpen : css.shellClosed} ${chromeHidden ? css.chromeHidden : ''}`}>
      {open && !chromeHidden && <Button type="button" variant="ghost" className={`${css.mobileScrim} hc-h-auto hc-w-auto`} aria-label="Close notebook sidebar" onClick={() => saveOpen(false)} />}
      {!chromeHidden && <SidebarProvider className={`${css.sidebarProvider} hc-h-full hc-min-h-0`} open={open} onOpenChange={saveOpen}>
      <Sidebar data-hc-surface="toolbar" className={css.sidebar} collapsible="none" aria-label="Notebook pages" aria-hidden={!open}>
        <SidebarHeader className={css.sidebarHeader}>
          {published
            ? <SidebarMenu><SidebarMenuItem><SidebarMenuButton size="lg" className={css.notebookButton} disabled><span className={css.notebookIcon} aria-hidden="true" /><span>{catalog.title || 'Notebook'}</span><ChevronDownIcon className="hc-ml-auto" /></SidebarMenuButton></SidebarMenuItem></SidebarMenu>
            : <DropdownMenu>
              <SidebarMenu><SidebarMenuItem><DropdownMenuTrigger render={<SidebarMenuButton size="lg" className={css.notebookButton} title="Notebook options"><span className={css.notebookIcon} aria-hidden="true" /><span>{catalog.title || 'Notebook'}</span><ChevronDownIcon className="hc-ml-auto" /></SidebarMenuButton>} /></SidebarMenuItem></SidebarMenu>
              <DropdownMenuContent align="start" className="hc-min-w-[180px] hc-font-sans">
                <DropdownMenuItem disabled={!catalog.notebookId} onClick={openNotebookEdit}>Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setNotebookDialogOpen(true)}>Switch Notebook</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>}
          {(!artifactPage || activePage?.available === false) && <Button variant="ghost" size="icon" aria-label="Close notebook sidebar" title="Close sidebar" onClick={() => saveOpen(false)}><PanelLeft size={17} /></Button>}
        </SidebarHeader>
        <SidebarSeparator className={css.sidebarDivider} />
        {showSidebarSearch && <SidebarInput aria-label="Search pages" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search pages…" className={css.sidebarSearch} />}
        {error && <p className={css.error} role="alert">{error}</p>}
        {mutationError && <p className={css.error} role="alert">{mutationError}</p>}
        <SidebarContent ref={navRef} className={css.pageNavigation} role="navigation" aria-label="Primary pages">
          <NotebookSidebarTree
            tree={catalog.tree}
            diagnostics={catalog.diagnostics}
            diagnosticScopeKey={JSON.stringify([catalog.notebookId, catalog.generation])}
            pages={catalog.pages}
            sites={catalog.sites}
            activePageId={activePageId}
            published={published}
            search={activeSearch}
            onSearch={setSearch}
            onOpenPage={openPage}
            onContextChange={setFocusedFolderPath}
            onRepair={onRepairNestedArtifact || repairNestedArtifact}
            renderArtifactActions={rowActions}
          />
        </SidebarContent>
        {!published && <div ref={setNoticeSlot} className={css.reloadNoticeSlot} data-slot="sidebar-reload-notice" />}
        <SidebarFooter className={css.sidebarFooter}>
          {!published && <BranchBar notebookId={catalog.notebookId} generation={catalog.generation} />}
          {!published && <DropdownMenu>
            <DropdownMenuTrigger render={<Button className={css.newPageButton}><PlusIcon data-icon="inline-start" />New page</Button>} />
            <DropdownMenuContent align="end" side="top" className="hc-w-56">
              {['prototype', 'canvas', 'component', 'site'].map(type => <DropdownMenuItem key={type} onClick={() => onCreate(type, { parentPath: focusedFolderPath })}>New {TYPE_SINGULAR[type]}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>}
          {!published && <>
            <div className={css.sidebarActions}>
              <SidebarMenu className={css.footerMenu}><SidebarMenuItem><SidebarMenuButton onClick={() => setSettingsOpen(true)}><Settings2 size={16} /><span>Settings</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu>
              <Button variant="ghost" size="icon" aria-label="Diagnostics" title="Diagnostics" onClick={fetchDiagnostics}><Activity size={16} /></Button>
            </div>
          </>}
          <span className={css.pageCount}>{catalog.pages.length} {catalog.pages.length === 1 ? 'page' : 'pages'}</span>
        </SidebarFooter>
      </Sidebar>
      </SidebarProvider>}
      {!chromeHidden && !open && !hasArtifactNavigation && <Button variant="ghost" size="icon" className={css.reopenButton} onClick={() => saveOpen(true)} aria-label="Open notebook sidebar" title="Open notebook sidebar"><span className={css.notebookIcon} aria-hidden="true" /></Button>}
      <main className={`${css.content} ${artifactPage ? css.contentArtifact : ''}`}>
        {!chromeHidden && artifactPage && activePage?.available !== false && <div className={css.artifactNavigation} aria-label={`${TYPE_SINGULAR[artifactPage.type] || 'Artifact'} navigation`}>
          <Button variant="ghost" size="icon" className={css.artifactSidebarToggle} onClick={() => saveOpen(!open)} aria-label={open ? 'Close notebook sidebar' : 'Open notebook sidebar'} title={open ? 'Close sidebar' : 'Open sidebar'}>
            {open ? <PanelLeft size={17} /> : <PanelRight size={17} />}
          </Button>
          <Breadcrumb className={css.artifactTitle}><BreadcrumbList><BreadcrumbItem><BreadcrumbPage>{artifactPage.title || artifactPage.id}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
          <div className={css.artifactNavigationActions}>
            <Button variant="ghost" size="icon" aria-label="Back" title="Back" disabled={!canGoBack} onClick={() => navigate(-1)}><ArrowLeft size={16} /></Button>
            <Button variant="ghost" size="icon" aria-label="Forward" title="Forward" disabled={!canGoForward} onClick={() => navigate(1)}><ArrowRight size={16} /></Button>
            <div role="group" aria-label="Open in browser controls" className={css.browserLaunchGroup}>
              <Button variant="ghost" className={css.openBrowserButton} onClick={() => window.open(buildNotebookBrowserUrl(window.location.href, browserLink), '_blank', 'noopener,noreferrer')}><ExternalLink data-icon="inline-start" />Open in browser</Button>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className={css.browserOptionsButton} aria-label="Browser viewing options"><ChevronDownIcon aria-hidden="true" /></Button>} />
                <DropdownMenuContent align="end" className={css.browserOptions} aria-label="Browser viewing options">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Notebook UI</DropdownMenuLabel>
                    <DropdownMenuRadioGroup aria-label="Notebook UI" value={browserLink.mode} onValueChange={mode => setBrowserLink(current => ({ ...current, mode }))}>
                      <DropdownMenuRadioItem value="visible" closeOnClick={false}>Shown</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="hidden" closeOnClick={false}>Hidden</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="removed" closeOnClick={false}>Removed</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup aria-label="Tools">
                    <DropdownMenuCheckboxItem checked={browserLink.showTools} onCheckedChange={showTools => setBrowserLink(current => ({ ...current, showTools }))} closeOnClick={false}>Show tools in any link</DropdownMenuCheckboxItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>}
        <div className={artifactPage ? css.artifactViewer : undefined}>
        {activePage && !activePage.available ? (
          <section className={css.unavailable} role="status">
            <p className={css.unavailableEyebrow}>{TYPE_SINGULAR[activePage.type] || 'Page'}</p>
            <h1>{activePage.title || activePage.id}</h1>
            <p>This page is registered, but its source is unavailable or has a conflict.</p>
            <ul>{(activePage.diagnostics || []).map((item, index) => <li key={`${item.code}:${index}`}><strong>{item.code}</strong>: {item.message}</li>)}</ul>
            {!published && <Button type="button" onClick={() => { setActivePageOverride(null); void refresh() }}>Refresh page status</Button>}
          </section>
        ) : children}
        </div>
      </main>
      {!published && (view.toolPanelsAvailable) && <CreateDialog type={createType} basePath={import.meta.env.BASE_URL} initialValues={createDialogInitialValues} onClose={() => { setCreateType(null); setCreateContext(null) }} />}
      {!published && <NotebookDialog open={!chromeHidden && notebookDialogOpen} onOpenChange={setNotebookDialogOpen} />}
      {!published && <Dialog open={!chromeHidden && notebookEditOpen} onOpenChange={setNotebookEditOpen}>
        <DialogContent className={css.notebookEditDialog}>
          <DialogHeader><DialogTitle>Edit Notebook</DialogTitle><DialogDescription>Update this Notebook&apos;s name and description.</DialogDescription></DialogHeader>
          <form className={css.notebookEditForm} onSubmit={saveNotebookMetadata}>
            <label>Name<Input value={notebookTitle} onChange={event => setNotebookTitle(event.target.value)} required maxLength={200} /></label>
            <label>Description<textarea value={notebookDescription} onChange={event => setNotebookDescription(event.target.value)} rows={4} maxLength={2000} /></label>
            {notebookSaveError && <p className={css.error} role="alert">{notebookSaveError}</p>}
            <div className={css.notebookEditActions}>
              <Button type="button" variant="outline" onClick={() => setNotebookEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={notebookSaving || !notebookTitle.trim()}>{notebookSaving ? 'Saving…' : 'Save'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>}
      {!published && <SettingsDialog open={(view.toolPanelsAvailable) && settingsOpen} onOpenChange={setSettingsOpen} />}
      {!published && <Dialog open={!chromeHidden && diagnosticsOpen} onOpenChange={setDiagnosticsOpen}>
        <DialogContent><DialogHeader><DialogTitle>Notebook diagnostics</DialogTitle><DialogDescription>Current notebook and route diagnostics.</DialogDescription></DialogHeader>
          <pre className={css.diagnosticsOutput}>{JSON.stringify(diagnostics || { loading: true }, null, 2)}</pre>
        </DialogContent>
      </Dialog>}
    </div>
    </SidebarNoticeContext.Provider>
  )
}
