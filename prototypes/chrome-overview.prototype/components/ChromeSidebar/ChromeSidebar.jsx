import { useState } from 'react'
import { ChevronDown, File, Folder, Globe, LayoutDashboard, MoreHorizontal, Plus, Settings } from 'lucide-react'
import { Icon } from '@dfosco/hypercanvas'
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuAction, SidebarFooter, SidebarInput, SidebarSeparator } from '../ui/sidebar.jsx'
import { Button } from '../ui/button.jsx'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '../ui/empty.jsx'
import { ChromeMenus } from '../ChromeMenus/ChromeMenus.jsx'
import css from './ChromeSidebar.module.css'

const samplePages = [
  { id: 'chrome', title: 'Chrome Components', icon: LayoutDashboard },
  { id: 'onboarding', title: 'First run', icon: File },
  { id: 'navigation', title: 'Navigation studies', icon: Folder },
  { id: 'site', title: 'Marketing site', icon: Globe },
]
export function ChromeSidebar({ pages = samplePages, initialActive = 'chrome', onNavigate, onCreate }) {
  const [active, setActive] = useState(initialActive)
  const [search, setSearch] = useState('')
  const visible = pages.filter(page => page.title.toLowerCase().includes(search.toLowerCase()))
  return <section className={css.frame} aria-label="Notebook navigation preview">
    <SidebarProvider className="h-full min-h-0">
      <Sidebar collapsible="none" className="w-full">
        <SidebarHeader className="p-0" data-chrome-header>
          <SidebarMenu><SidebarMenuItem><SidebarMenuButton size="lg"><Icon name="mascot" size={16} className={css.mascotIcon} /><span>Hyperbase</span><ChevronDown className="ml-auto" /></SidebarMenuButton></SidebarMenuItem></SidebarMenu>
        </SidebarHeader>
        <SidebarSeparator data-chrome-divider />
        <SidebarContent><SidebarInput className="mx-2 mt-2 w-[calc(100%-1rem)]" aria-label="Search pages" placeholder="Search pages…" value={search} onChange={event => setSearch(event.target.value)} /><SidebarGroup>
          <SidebarGroupLabel>Notebook</SidebarGroupLabel>
          {visible.length ? <SidebarMenu>{visible.map(({ id, title, icon: Icon }) => <SidebarMenuItem key={id}>
            <SidebarMenuButton isActive={id === active} onClick={() => { setActive(id); onNavigate?.(id) }}><Icon /><span>{title}</span></SidebarMenuButton>
            <ChromeMenus trigger={<SidebarMenuAction aria-label={`Actions for ${title}`}><MoreHorizontal /></SidebarMenuAction>} />
          </SidebarMenuItem>)}</SidebarMenu> : <Empty><EmptyHeader><EmptyTitle>No pages</EmptyTitle><EmptyDescription>{search ? 'Try a different search.' : 'Start with a canvas or prototype.'}</EmptyDescription></EmptyHeader></Empty>}
        </SidebarGroup></SidebarContent>
        <SidebarFooter><Button onClick={onCreate}><Plus data-icon="inline-start" />New page</Button><SidebarMenu><SidebarMenuItem><SidebarMenuButton><Settings /><span>Settings</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  </section>
}
