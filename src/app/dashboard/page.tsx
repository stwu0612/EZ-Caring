import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()

  // 取得統計數據
  const { count: membersCount } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })

  const { count: subjectsCount } = await supabase
    .from('subjects')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)

  const { count: testsCount } = await supabase
    .from('test_results')
    .select('*', { count: 'exact', head: true })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">儀表板</h1>

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6">
          <div className="text-gray-500 text-sm mb-2">會員總數</div>
          <div className="text-3xl font-bold text-primary-600">{membersCount || 0}</div>
        </div>

        <div className="card p-6">
          <div className="text-gray-500 text-sm mb-2">受測者總數</div>
          <div className="text-3xl font-bold text-primary-600">{subjectsCount || 0}</div>
        </div>

        <div className="card p-6">
          <div className="text-gray-500 text-sm mb-2">測試記錄總數</div>
          <div className="text-3xl font-bold text-primary-600">{testsCount || 0}</div>
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">快捷操作</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a href="/dashboard/subjects" className="btn-secondary text-center">
            受測者管理
          </a>
          <a href="/dashboard/members" className="btn-secondary text-center">
            會員管理
          </a>
          <a href="/dashboard/results" className="btn-secondary text-center">
            測試結果
          </a>
          <a href="/dashboard/reports" className="btn-secondary text-center">
            統計報表
          </a>
        </div>
      </div>
    </div>
  )
}
