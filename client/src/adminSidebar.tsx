import React, { useContext, createContext, useState, type ReactNode } from "react"
import { Box, BarChart2, ClipboardList, ChevronFirst, ChevronLast, LogOut, Home, Users, Bell } from "lucide-react"
import { useNavigate, useLocation } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from './firebase'
import './sidebar.css'
import { useAuth } from './hooks/useAuth'

const AdminSidebarContext = createContext<{ expanded: boolean }>({ expanded: true })

export default function AdminSidebar({ children }: { children?: ReactNode }) {
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
    try {
      document.documentElement.style.setProperty('--sidebar-width', expanded ? '16rem' : '4rem')
    } catch (e) {}
  }, [expanded])

  return (
    <aside className={`fixed left-0 top-0 h-screen z-20 transition-all duration-200 ${expanded ? 'w-64' : 'w-16'} themed-sidebar`}>
      <nav className="h-full flex flex-col bg-base-200 border-r border-base-300">
        {/* Header with toggle button */}
        <div className={`p-3 flex items-center ${expanded ? 'justify-between' : 'justify-center'}`}>
          <img className={`overflow-hidden transition-all ${expanded ? "w-32" : "w-0 hidden"}`} alt="" />
          <button
            onClick={() => setExpanded((curr) => !curr)}
            className="btn btn-sm btn-ghost btn-square"
          >
            {expanded ? <ChevronFirst size={20} /> : <ChevronLast size={20} />}
          </button>
        </div>

        <AdminSidebarContext.Provider value={{ expanded }}>
          <ul className={`menu flex-1 gap-1 ${expanded ? 'px-3' : 'px-2'}`}>
            {hasChildren ? children : (
              <>
                <AdminSidebarItem
                  icon={<Home size={20} />}
                  text="Dashboard"
                  active={location.pathname.startsWith('/admindashboard')}
                  onClick={() => navigate('/admindashboard')}
                />
                <AdminSidebarItem
                  icon={<Box size={20} />}
                  text="Inventory"
                  active={location.pathname.startsWith('/inventory')}
                  onClick={() => navigate('/inventory')}
                />
                <AdminSidebarItem
                  icon={<ClipboardList size={20} />}
                  text="Accountabilities"
                  active={location.pathname.startsWith('/admin/accountabilities')}
                  onClick={() => navigate('/admin/accountabilities')}
                />
                <AdminSidebarItem
                  icon={<BarChart2 size={20} />}
                  text="Analytics"
                  active={location.pathname.startsWith('/analytics')}
                  onClick={() => navigate('/analytics')}
                />
                <AdminSidebarItem
                  icon={<Bell size={20} />}
                  text="Announcements"
                  active={location.pathname.startsWith('/admin/announcements')}
                  onClick={() => navigate('/admin/announcements')}
                />
                <AdminSidebarItem
                  icon={<Users size={20} />}
                  text="Admin"
                  active={location.pathname.startsWith('/admin/users')}
                  onClick={() => navigate('/admin/users')}
                />
              </>
            )}
          </ul>
        </AdminSidebarContext.Provider>

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
            onClick={() => navigate('/admin/profile')}
            className={`border-t border-base-300 flex items-center w-full hover:bg-base-300 transition-colors cursor-pointer ${expanded ? 'p-3 gap-3' : 'p-2 justify-center'}`}
          >
            <div className="avatar">
              <div className="w-10 rounded-lg">
                <img
                  src={
                    user?.photoURL
                      ? user.photoURL
                      : `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          user?.displayName || user?.email?.split('@')[0] || 'Admin'
                        )}&background=c7d2fe&color=3730a3&bold=true`
                  }
                  alt={user?.displayName ?? user?.email ?? 'Admin'}
                />
              </div>
            </div>
            <div className={`flex-1 overflow-hidden transition-all ${expanded ? "" : "w-0 hidden"}`}>
              <div className="leading-4 text-left min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold truncate">{user?.displayName ?? (user?.email ? user.email.split('@')[0] : 'Admin')}</h4>
                  <span className={`badge badge-sm shrink-0 ${user?.isSuperAdmin ? 'badge-accent' : 'badge-secondary'}`}>
                    {user?.isSuperAdmin ? 'Super Admin' : 'Admin'}
                  </span>
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

export function AdminSidebarItem({ icon, text, active, alert, onClick }: { icon: ReactNode; text: string; active?: boolean; alert?: boolean; onClick?: () => void }) {
  const { expanded } = useContext(AdminSidebarContext)
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
        <span className={`overflow-hidden transition-all whitespace-nowrap ${expanded ? "flex-1" : "w-0 hidden"}`}>
          {text}
        </span>
        {alert && (
          <span className="badge badge-error badge-xs"></span>
        )}
      </a>
    </li>
  )
}
