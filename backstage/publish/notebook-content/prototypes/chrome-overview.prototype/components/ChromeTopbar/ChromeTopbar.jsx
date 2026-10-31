import { ArrowLeft, ArrowRight, ExternalLink, PanelLeft, PanelRight, MoreHorizontal } from 'lucide-react'
import { Button } from '../ui/button.jsx'
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '../ui/breadcrumb.jsx'
import { Badge } from '../ui/badge.jsx'
import { ChromeMenus } from '../ChromeMenus/ChromeMenus.jsx'
import css from './ChromeTopbar.module.css'

export function ChromeTopbar({ title = 'Chrome Components', status = 'Saved', sidebarOpen = true, canGoBack = true, canGoForward = false, onBack, onForward, onToggleSidebar, onOpenBrowser }) {
  const SidebarIcon = sidebarOpen ? PanelLeft : PanelRight
  return <div className={css.frame}><header className={css.bar} aria-label="Page navigation" data-chrome-header>
    <Button className={css.sidebarToggle} variant="ghost" size="icon" aria-label={sidebarOpen ? 'Close notebook sidebar' : 'Open notebook sidebar'} onClick={onToggleSidebar}><SidebarIcon /></Button>
    <Breadcrumb className={css.breadcrumb}><BreadcrumbList><BreadcrumbItem className={css.notebook}><BreadcrumbLink>Hyperbase</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator className={css.notebook} /><BreadcrumbItem><BreadcrumbPage className="truncate">{title || 'Untitled page'}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
    <div className={css.actions}><Button variant="ghost" size="icon" aria-label="Back" disabled={!canGoBack} onClick={onBack}><ArrowLeft /></Button><Button variant="ghost" size="icon" aria-label="Forward" disabled={!canGoForward} onClick={onForward}><ArrowRight /></Button><Badge variant="secondary">{status}</Badge><Button variant="ghost" size="icon" aria-label="Open in browser" onClick={onOpenBrowser}><ExternalLink /></Button><ChromeMenus trigger={<Button variant="ghost" size="icon" aria-label="Page actions"><MoreHorizontal /></Button>} /></div>
  </header></div>
}
