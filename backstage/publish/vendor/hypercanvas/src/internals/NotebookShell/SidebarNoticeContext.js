import { createContext } from 'react'

// The shell surrounds the route provider. Share only its in-flow notice slot;
// pending state and reload authorization stay with the document provider.
export const SidebarNoticeContext = createContext(null)
