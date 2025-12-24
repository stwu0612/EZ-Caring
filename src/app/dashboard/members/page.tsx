'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Member } from '@/types'
import { ChevronDown, Edit, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  
  // 篩選條件
  const [filters, setFilters] = useState({
    status: '',
    registeredDate: '',
    keyword: '',
  })
  
  // 分頁
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const supabase = createClient()

  useEffect(() => {
    fetchMembers()
  }, [page, pageSize])

  const fetchMembers = async () => {
    setLoading(true)
    
    let query = supabase
      .from('members')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    // 套用篩選
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.keyword) {
      query = query.or(`name.ilike.%${filters.keyword}%,email.ilike.%${filters.keyword}%`)
    }
    if (filters.registeredDate) {
      query = query.gte('created_at', filters.registeredDate)
    }

    const { data, count, error } = await query

    if (error) {
      console.error('Error fetching members:', error)
    } else {
      setMembers(data || [])
      setTotal(count || 0)
    }
    
    setLoading(false)
  }

  const handleSearch = () => {
    setPage(1)
    fetchMembers()
  }

  const handleClear = () => {
    setFilters({ status: '', registeredDate: '', keyword: '' })
    setPage(1)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">啟用</span>
      case 'inactive':
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">停用</span>
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">待審核</span>
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">{status}</span>
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">會員資料管理</h1>

      {/* 搜尋區塊 */}
      <div className="card p-6 mb-6">
        <div className="text-lg font-medium mb-4">搜尋</div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* 關鍵字 */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">關鍵字</label>
            <input
              type="text"
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              placeholder="請輸入"
              className="input-field"
            />
          </div>

          {/* 註冊日期 */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">註冊日期</label>
            <input
              type="date"
              value={filters.registeredDate}
              onChange={(e) => setFilters({ ...filters, registeredDate: e.target.value })}
              className="input-field"
            />
          </div>

          {/* 狀態 */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">狀態</label>
            <div className="relative">
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="input-field appearance-none pr-10"
              >
                <option value="">請選擇</option>
                <option value="active">啟用</option>
                <option value="inactive">停用</option>
                <option value="pending">待審核</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={handleClear} className="btn-secondary">
            清除
          </button>
          <button onClick={handleSearch} className="btn-primary">
            搜尋
          </button>
        </div>
      </div>

      {/* 表格 */}
      <div className="card">
        {/* 分頁設定 */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">每頁</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span className="text-sm text-gray-600">筆</span>
          </div>
        </div>

        {/* 表格內容 */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">序</th>
                <th className="table-header">會員姓名</th>
                <th className="table-header">電子信箱</th>
                <th className="table-header">註冊日期</th>
                <th className="table-header">狀態</th>
                <th className="table-header">備註</th>
                <th className="table-header">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    載入中...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    沒有資料
                  </td>
                </tr>
              ) : (
                members.map((member, index) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="table-cell">{(page - 1) * pageSize + index + 1}</td>
                    <td className="table-cell font-medium">{member.name}</td>
                    <td className="table-cell">{member.email}</td>
                    <td className="table-cell">
                      {format(new Date(member.created_at), 'yyyy/MM/dd')}
                    </td>
                    <td className="table-cell">{getStatusBadge(member.status)}</td>
                    <td className="table-cell">{member.notes || '-'}</td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        <button 
                          className="p-1 hover:bg-gray-100 rounded"
                          title="編輯"
                        >
                          <Edit size={18} className="text-blue-500" />
                        </button>
                        <button 
                          className="p-1 hover:bg-gray-100 rounded"
                          title="刪除"
                        >
                          <Trash2 size={18} className="text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分頁 */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 flex justify-between items-center">
            <div className="text-sm text-gray-500">
              共 {total} 筆，第 {page} / {totalPages} 頁
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary disabled:opacity-50"
              >
                上一頁
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary disabled:opacity-50"
              >
                下一頁
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
