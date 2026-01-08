'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Users, 
  UserCheck, 
  ClipboardList, 
  BarChart3, 
  Settings,
  LogOut,
  Menu,
  X
} from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface SidebarProps {
  userName?: string
}

export default function Sidebar({ userName = 'User' }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  const menuItems = [
    {
      title: '會員資料管理',
      icon: Users,
      children: [
        { title: '會員資料管理', href: '/dashboard/members', icon: Users },
        { title: '受測者資料管理', href: '/dashboard/subjects', icon: UserCheck },
      ]
    },
    {
      title: '測試結果',
      icon: ClipboardList,
      href: '/dashboard/results',
    },
    {
      title: '統計報表',
      icon: BarChart3,
      href: '/dashboard/reports',
    },
  ]

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <>
      {/* 側邊欄 */}
      <aside className={`fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-40 ${
        collapsed ? 'w-16' : 'w-64'
      }`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {!collapsed && (
            <span className="text-xl font-bold text-primary-600">Logo</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            {collapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
        </div>

        {/* 選單 */}
        <nav className="p-4 space-y-2">
          {menuItems.map((item, index) => (
            <div key={index}>
              {item.children ? (
                // 有子選單
                <div>
                  <div className={`flex items-center gap-3 px-4 py-3 text-primary-600 font-medium ${
                    collapsed ? 'justify-center' : ''
                  }`}>
                    <item.icon size={20} />
                    {!collapsed && <span>{item.title}</span>}
                  </div>
                  {!collapsed && (
                    <div className="ml-4 space-y-1">
                      {item.children.map((child, childIndex) => (
                        <Link
                          key={childIndex}
                          href={child.href}
                          className={`sidebar-item ${
                            pathname === child.href ? 'active' : ''
                          }`}
                        >
                          <child.icon size={18} />
                          <span>{child.title}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // 無子選單
                <Link
                  href={item.href!}
                  className={`sidebar-item ${
                    pathname === item.href ? 'active' : ''
                  } ${collapsed ? 'justify-center' : ''}`}
                >
                  <item.icon size={20} />
                  {!collapsed && <span>{item.title}</span>}
                </Link>
              )}
            </div>
          ))}
        </nav>

        {/* 底部：App Center */}
        {!collapsed && (
          <div className="absolute bottom-20 left-0 right-0 px-4">
            <Link
              href="/dashboard/settings"
              className="sidebar-item"
            >
              <Settings size={20} />
              <span>App Center</span>
            </Link>
          </div>
        )}
      </aside>

      {/* 頂部導航 */}
      <header className={`fixed top-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-30 transition-all duration-300 ${
        collapsed ? 'left-16' : 'left-64'
      }`}>
        <button className="p-2 hover:bg-gray-100 rounded-lg">
          <Menu size={20} className="text-primary-600" />
        </button>

        <div className="flex items-center gap-4">
          <span className="text-primary-600">{userName}</span>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
            title="登出"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>
    </>
  )
}
