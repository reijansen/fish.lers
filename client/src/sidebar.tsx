import { ChevronLast, ChevronFirst, Home, FilePlus, ClipboardList, MapPin, User, LogOut } from "lucide-react"
import React, { useContext, createContext, useState, type ReactNode } from "react"
import { useNavigate, useLocation } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from './firebase'
import './sidebar.css'
import { useAuth } from './hooks/useAuth'

const SidebarContext = createContext<{ expanded: boolean }>({ expanded: true })

export default function Sidebar({ children }: { children?: ReactNode }) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = React.Children.count(children) > 0
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  async function handleLogout() {
    try {
      await signOut(auth)
      navigate('/login')
    } catch (e) {
      console.error('Sign out failed', e)
    }
  }

  React.useEffect(() => {
    // expose the sidebar width to the rest of the app via CSS variable
    try {
      document.documentElement.style.setProperty('--sidebar-width', expanded ? '16rem' : '4rem')
    } catch (e) {
      // ignore (server-side rendering / non-browser)
    }
  }, [expanded])
  
  return (
    <aside className={`fixed left-0 top-0 h-screen z-20 transition-all duration-200 ${expanded ? 'w-64' : 'w-16'} themed-sidebar`}>
      <nav className="h-full flex flex-col bg-base-200 border-r border-base-300">
        {/* Header with toggle button */}
        <div className={`p-3 flex items-center ${expanded ? 'justify-between' : 'justify-center'}`}>
          <img
            // src="https://img.logoipsum.com/243.svg"
            className={`overflow-hidden transition-all ${
              expanded ? "w-32" : "w-0 hidden"
            }`}
            alt=""
          />
          <button
            onClick={() => setExpanded((curr) => !curr)}
            className="btn btn-sm btn-ghost btn-square"
          >
            {expanded ? <ChevronFirst size={20} /> : <ChevronLast size={20} />}
          </button>
        </div>

        <SidebarContext.Provider value={{ expanded }}>
          <ul className={`menu flex-1 gap-1 ${expanded ? 'px-3' : 'px-2'}`}>
            {hasChildren ? children : (
              <>
                <SidebarItem
                  icon={<Home size={20} />}
                  text="Dashboard"
                  active={location.pathname === '/' || location.pathname.startsWith('/student')}
                  onClick={() => navigate('/student')}
                />
                <SidebarItem
                  icon={<FilePlus size={20} />}
                  text="Request Form"
                  active={location.pathname.startsWith('/request') || location.pathname.startsWith('/requestpage')}
                  onClick={() => navigate('/requestpage')}
                />
                <SidebarItem
                  icon={<ClipboardList size={20} />}
                  text="Accountabilities"
                  active={location.pathname.startsWith('/accountabilities')}
                  onClick={() => navigate('/accountabilities')}
                />
                <SidebarItem
                  icon={<MapPin size={20} />}
                  text="Tracking"
                  active={location.pathname.startsWith('/tracking')}
                  onClick={() => navigate('/tracking')}
                />
                {/* Logout moved to footer area so it's visible above the user info */}
              </>
            )}
          </ul>
        </SidebarContext.Provider>

        {/* logout button placed directly above the user info so it's visible when collapsed or expanded */}
        <div 
          className={`py-2 flex ${expanded ? 'px-3' : 'justify-center'} tooltip tooltip-right`}
          data-tip={expanded ? undefined : "Logout"}
        >
          <button 
            onClick={handleLogout} 
            className={`btn btn-ghost ${expanded ? 'w-full justify-start gap-3' : 'btn-square'}`}
          >
            <LogOut size={20} />
            <span className={`overflow-hidden transition-all text-left whitespace-nowrap ${expanded ? "flex-1" : "w-0 hidden"}`}>
              Logout
            </span>
          </button>
        </div>

        <div 
          className="tooltip tooltip-right"
          data-tip={expanded ? undefined : "View profile"}
        >
          <button
            onClick={() => navigate('/profile')}
            className={`border-t border-base-300 flex items-center w-full text-left hover:bg-base-300 cursor-pointer transition-colors ${expanded ? 'p-3 gap-3' : 'p-2 justify-center'}`}
            title="View profile"
          >
            <div className="avatar">
              <div className="w-10 rounded-lg">
                <img
                  src={
                    user?.photoURL
                      ? user.photoURL
                      : `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          user?.displayName || user?.email?.split('@')[0] || 'User'
                        )}&background=c7d2fe&color=3730a3&bold=true`
                  }
                  alt={user?.displayName ?? user?.email ?? 'User'}
                />
              </div>
            </div>
            <div
              className={`
                flex-1 overflow-hidden transition-all ${expanded ? "" : "w-0 hidden"}
            `}
            >
              <div className="leading-4 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold truncate">{user?.displayName ?? (user?.email ? user.email.split('@')[0] : 'User')}</h4>
                  <span className="badge badge-primary badge-sm shrink-0">Student</span>
                </div>
                <span className="text-xs text-base-content/60 truncate block">{user?.email ?? ''}</span>
              </div>
            </div>
          </button>
        </div>
      </nav>
    </aside>
  )
}

export function SidebarItem({ icon, text, active, alert, onClick }: { icon: ReactNode; text: string; active?: boolean; alert?: boolean; onClick?: () => void }) {
  const { expanded } = useContext(SidebarContext)
  
  return (
    <li
      className={`tooltip tooltip-right ${!expanded ? 'flex justify-center' : ''}`}
      data-tip={expanded ? undefined : text}
    >
      <a
        className={`flex items-center ${active ? 'active' : ''} ${expanded ? 'gap-3' : 'px-3 py-3'}`}
        onClick={onClick}
      >
        {icon}
        <span
          className={`overflow-hidden transition-all whitespace-nowrap ${
            expanded ? "flex-1" : "w-0 hidden"
          }`}
        >
          {text}
        </span>
        {alert && (
          <span className="badge badge-error badge-xs"></span>
        )}
      </a>
    </li>
  )
}
