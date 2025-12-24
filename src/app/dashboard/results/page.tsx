'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TestResult, TEST_TYPE_NAMES } from '@/types'
import { ChevronDown, Play, Eye, X } from 'lucide-react'
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
  
  // 彈窗狀態
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showVideoModal, setShowVideoModal] = useState(false)

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
  
  const handleViewDetail = (result: TestResult) => {
    setSelectedResult(result)
    setShowDetailModal(true)
  }
  
  const handlePlayVideo = (result: TestResult) => {
    setSelectedResult(result)
    setShowVideoModal(true)
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
                          onClick={() => handleViewDetail(result)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="查看詳情"
                        >
                          <Eye size={18} className="text-gray-500" />
                        </button>
                        {result.hls_stream_name && (
                          <button 
                            onClick={() => handlePlayVideo(result)}
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
      
      {/* 詳情彈窗 */}
      {showDetailModal && selectedResult && (
        <DetailModal 
          result={selectedResult} 
          onClose={() => setShowDetailModal(false)} 
        />
      )}
      
      {/* 影片播放彈窗 */}
      {showVideoModal && selectedResult && (
        <VideoModal 
          result={selectedResult} 
          onClose={() => setShowVideoModal(false)} 
        />
      )}
    </div>
  )
}

// 詳情彈窗組件
function DetailModal({ result, onClose }: { result: TestResult; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* 標題 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">測試結果詳情</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>
        
        {/* 內容 */}
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">受測者</div>
              <div className="font-medium">{result.subject?.name || '-'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">測試類型</div>
              <div className="font-medium">
                {TEST_TYPE_NAMES[result.test_type as keyof typeof TEST_TYPE_NAMES] || result.test_type}
              </div>
            </div>
          </div>
          
          <div className="bg-orange-50 p-4 rounded-lg text-center">
            <div className="text-sm text-orange-600 mb-1">測試結果</div>
            <div className="text-3xl font-bold text-orange-600">
              {result.result_value} <span className="text-lg">{result.result_unit}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">測試時間</div>
              <div>{format(new Date(result.tested_at), 'yyyy/MM/dd HH:mm:ss')}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">設備 ID</div>
              <div>{result.device_id || '-'}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">同步時間</div>
              <div>{result.synced_at ? format(new Date(result.synced_at), 'yyyy/MM/dd HH:mm:ss') : '-'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">HLS 串流名稱</div>
              <div className="truncate text-sm">{result.hls_stream_name || '-'}</div>
            </div>
          </div>
          
          {result.hls_start_time && result.hls_end_time && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">錄影開始</div>
                <div className="text-sm">{format(new Date(result.hls_start_time), 'HH:mm:ss')}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">錄影結束</div>
                <div className="text-sm">{format(new Date(result.hls_end_time), 'HH:mm:ss')}</div>
              </div>
            </div>
          )}
          
          <div>
            <div className="text-sm text-gray-500 mb-1">ULID</div>
            <div className="text-xs text-gray-400 font-mono break-all">{result.ulid}</div>
          </div>
        </div>
        
        {/* 底部按鈕 */}
        <div className="p-4 border-t flex justify-end">
          <button onClick={onClose} className="btn-secondary">
            關閉
          </button>
        </div>
      </div>
    </div>
  )
}

// 影片播放彈窗組件
function VideoModal({ result, onClose }: { result: TestResult; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hlsUrl, setHlsUrl] = useState<string | null>(null)
  
  useEffect(() => {
    // TODO: 這裡需要呼叫 AWS KVS API 取得 HLS URL
    // 目前先顯示提示訊息
    setLoading(false)
    setError('HLS 影片播放功能需要配置 AWS KVS')
  }, [result.hls_stream_name])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4">
        {/* 標題 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">
            錄影回放 - {TEST_TYPE_NAMES[result.test_type as keyof typeof TEST_TYPE_NAMES] || result.test_type}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>
        
        {/* 影片區域 */}
        <div className="p-4">
          <div className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center">
            {loading ? (
              <div className="text-white">載入中...</div>
            ) : error ? (
              <div className="text-center text-white p-4">
                <div className="mb-2">{error}</div>
                <div className="text-sm text-gray-400">
                  串流名稱: {result.hls_stream_name}
                </div>
              </div>
            ) : hlsUrl ? (
              <video 
                controls 
                autoPlay 
                className="w-full h-full rounded-lg"
                src={hlsUrl}
              >
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="text-gray-400">無法載入影片</div>
            )}
          </div>
          
          {/* 影片資訊 */}
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-500">受測者</div>
              <div className="font-medium">{result.subject?.name || '-'}</div>
            </div>
            <div>
              <div className="text-gray-500">測試時間</div>
              <div>{format(new Date(result.tested_at), 'yyyy/MM/dd HH:mm')}</div>
            </div>
            <div>
              <div className="text-gray-500">測試結果</div>
              <div className="font-medium text-orange-600">
                {result.result_value} {result.result_unit}
              </div>
            </div>
          </div>
        </div>
        
        {/* 底部按鈕 */}
        <div className="p-4 border-t flex justify-end">
          <button onClick={onClose} className="btn-secondary">
            關閉
          </button>
        </div>
      </div>
    </div>
  )
}
