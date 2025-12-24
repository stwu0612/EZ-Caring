'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TestResult, TEST_TYPE_NAMES } from '@/types'
import { ChevronDown, Play, Eye } from 'lucide-react'
import { format } from 'date-fns'

export default function ResultsPage() {
  const [results, setResults] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  
  // 篩選條件
  const [filters, setFilters] = useState({
    testType: '',
    dateFrom: '',
    dateTo: '',
    keyword: '',
  })
  
  // 分頁
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const supabase = createClient()

  useEffect(() => {
    fetchResults()
  }, [page, pageSize])

  const fetchResults = async () => {
    setLoading(true)
    
    let query = supabase
      .from('test_results')
      .select(`
        *,
        subjects!subject_id (name, ulid)
      `, { count: 'exact' })
      .order('tested_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    // 套用篩選
    if (filters.testType) {
      query = query.eq('test_type', filters.testType)
    }
    if (filters.dateFrom) {
      query = query.gte('tested_at', filters.dateFrom)
    }
    if (filters.dateTo) {
      query = query.lte('tested_at', filters.dateTo + 'T23:59:59')
    }

    const { data, count, error } = await query

    if (error) {
      console.error('Error fetching results:', error)
    } else {
      setResults(data?.map(r => ({
        ...r,
        subject: r.subjects
      })) || [])
      setTotal(count || 0)
    }
    
    setLoading(false)
  }

  const handleSearch = () => {
    setPage(1)
    fetchResults()
  }

  const handleClear = () => {
    setFilters({ testType: '', dateFrom: '', dateTo: '', keyword: '' })
    setPage(1)
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">測試結果</h1>

      {/* 搜尋區塊 */}
      <div className="card p-6 mb-6">
        <div className="text-lg font-medium mb-4">搜尋</div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* 測試類型 */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">測試類型</label>
            <div className="relative">
              <select
                value={filters.testType}
                onChange={(e) => setFilters({ ...filters, testType: e.target.value })}
                className="input-field appearance-none pr-10"
              >
                <option value="">全部</option>
                {Object.entries(TEST_TYPE_NAMES).map(([key, name]) => (
                  <option key={key} value={key}>{name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            </div>
          </div>

          {/* 開始日期 */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">開始日期</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="input-field"
            />
          </div>

          {/* 結束日期 */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">結束日期</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="input-field"
            />
          </div>

          {/* 關鍵字 */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">受測者姓名</label>
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
                <th className="table-header">受測者</th>
                <th className="table-header">測試類型</th>
                <th className="table-header">結果</th>
                <th className="table-header">測試時間</th>
                <th className="table-header">設備</th>
                <th className="table-header">同步時間</th>
                <th className="table-header">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    載入中...
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    沒有資料
                  </td>
                </tr>
              ) : (
                results.map((result, index) => (
                  <tr key={result.id} className="hover:bg-gray-50">
                    <td className="table-cell">{(page - 1) * pageSize + index + 1}</td>
                    <td className="table-cell font-medium">
                      {result.subject?.name || '-'}
                    </td>
                    <td className="table-cell">
                      {TEST_TYPE_NAMES[result.test_type as keyof typeof TEST_TYPE_NAMES] || result.test_type}
                    </td>
                    <td className="table-cell">
                      <span className="font-mono">
                        {result.result_value} {result.result_unit}
                      </span>
                    </td>
                    <td className="table-cell">
                      {format(new Date(result.tested_at), 'yyyy/MM/dd HH:mm')}
                    </td>
                    <td className="table-cell text-gray-500 text-sm">
                      {result.device_id || '-'}
                    </td>
                    <td className="table-cell text-gray-500 text-sm">
                      {result.synced_at ? format(new Date(result.synced_at), 'MM/dd HH:mm') : '-'}
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        <button 
                          className="p-1 hover:bg-gray-100 rounded"
                          title="查看詳情"
                        >
                          <Eye size={18} className="text-gray-500" />
                        </button>
                        {result.hls_stream_name && (
                          <button 
                            className="p-1 hover:bg-gray-100 rounded"
                            title="播放錄影"
                          >
                            <Play size={18} className="text-green-500" />
                          </button>
                        )}
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
