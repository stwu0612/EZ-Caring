import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  // 取得用戶資訊
  const { data: member } = await supabase
    .from('members')
    .select('name')
    .eq('auth_user_id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar userName={member?.name || user.email || 'User'} />
      
      {/* 主內容區 */}
      <main className="ml-64 pt-16 p-6">
        {children}
      </main>
    </div>
  )
}
