'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Subject } from '@/types'
import { Search, ChevronDown, Edit, Trash2, Eye } from 'lucide-react'
import { format } from 'date-fns'

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  
  // 篩選條件
  const [filters, setFilters] = useState({
    gender: '',
    createdDate: '',
    keyword: '',
  })
  
  // 分頁
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const supabase = createClient()

  useEffect(() => {
    fetchSubjects()
  }, [page, pageSize])

  const fetchSubjects = async () => {
    setLoading(true)
    
    let query = supabase
      .from('subjects')
      .select('*, members!created_by(name)', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    // 套用篩選
    if (filters.gender) {
      query = query.eq('gender', filters.gender)
    }
    if (filters.keyword) {
      query = query.or(`name.ilike.%${filters.keyword}%,id_number.ilike.%${filters.keyword}%`)
    }
    if (filters.createdDate) {
      query = query.gte('created_at', filters.createdDate)
    }

    const { data, count, error } = await query

    if (error) {
      console.error('Error fetching subjects:', error)
    } else {
      setSubjects(data?.map(s => ({
        ...s,
        created_by_name: s.members?.name
      })) || [])
      setTotal(count || 0)
    }
    
    setLoading(false)
  }

  const handleSearch = () => {
    setPage(1)
    fetchSubjects()
  }

  const handleClear = () => {
    setFilters({ gender: '', createdDate: '', keyword: '' })
    setPage(1)
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">受測者資料管理</h1>

      {/* 搜尋區塊 */}
      <div className="card p-6 mb-6">
        <div className="text-lg font-medium mb-4">搜尋</div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* 性別 */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">性別</label>
            <div className="relative">
              <select
                value={filters.gender}
                onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                className="input-field appearance-none pr-10"
              >
                <option value="">請選擇</option>
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            </div>
          </div>

          {/* 建立日期 */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">建立日期</label>
            <input
              type="date"
              value={filters.createdDate}
              onChange={(e) => setFilters({ ...filters, createdDate: e.target.value })}
              className="input-field"
            />
          </div>

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
                <th className="table-header">受測者姓名</th>
                <th className="table-header">身分證字號</th>
                <th className="table-header">性別</th>
                <th className="table-header">年齡</th>
                <th className="table-header">測試次數</th>
                <th className="table-header">建立者</th>
                <th className="table-header">建立日期</th>
                <th className="table-header">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-500">
                    載入中...
                  </td>
                </tr>
              ) : subjects.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-500">
                    沒有資料
                  </td>
                </tr>
              ) : (
                subjects.map((subject, index) => (
                  <tr key={subject.id} className="hover:bg-gray-50">
                    <td className="table-cell">{(page - 1) * pageSize + index + 1}</td>
                    <td className="table-cell font-medium">{subject.name}</td>
                    <td className="table-cell">{subject.id_number || '-'}</td>
                    <td className="table-cell">
                      {subject.gender === 'male' ? '男' : subject.gender === 'female' ? '女' : '-'}
                    </td>
                    <td className="table-cell">{subject.age || '-'}</td>
                    <td className="table-cell">{subject.test_count}</td>
                    <td className="table-cell">{subject.created_by_name || '-'}</td>
                    <td className="table-cell">
                      {format(new Date(subject.created_at), 'yyyy/MM/dd')}
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        <button 
                          className="p-1 hover:bg-gray-100 rounded"
                          title="查看"
                        >
                          <Eye size={18} className="text-gray-500" />
                        </button>
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
