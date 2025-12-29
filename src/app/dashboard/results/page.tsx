'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TestResult, TEST_TYPE_NAMES, TEST_TYPE_UNITS } from '@/types'
import { ChevronDown, Play, Eye, X, Loader2, Trash2, Clock, User, Activity } from 'lucide-react'
import { format } from 'date-fns'
import Hls from 'hls.js'

// 確認刪除 Modal
function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  loading
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  loading: boolean
}) {
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-2">{title}</h3>
          <p className="text-gray-600 mb-6">{message}</p>
          <div className="flex justify-end gap-3">
            <button 
              onClick={onClose} 
              className="btn-secondary"
              disabled={loading}
            >
              取消
            </button>
            <button 
              onClick={onConfirm} 
              className="btn-primary bg-red-500 hover:bg-red-600"
              disabled={loading}
            >
              {loading ? '刪除中...' : '確認刪除'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// 測試結果卡片（類似 Android 顯示格式）
function ResultCard({ 
  result, 
  onView, 
  onPlay, 
  onDelete 
}: { 
  result: TestResult
  onView: () => void
  onPlay: () => void
  onDelete: () => void
}) {
  const testTypeName = TEST_TYPE_NAMES[result.test_type as keyof typeof TEST_TYPE_NAMES] || result.test_type
  
  // 根據測試類型決定顏色
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'sit_stand':
        return 'bg-blue-500'
      case 'walk_speed':
        return 'bg-green-500'
      case 'balance_foot':
      case 'balance_half_foot':
      case 'balance_heel_toe':
        return 'bg-purple-500'
      case 'one_leg_stand':
        return 'bg-orange-500'
      case 'functional_reach':
        return 'bg-pink-500'
      case 'gait_standing':
        return 'bg-cyan-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* 頂部色條 */}
      <div className={`h-1 ${getTypeColor(result.test_type)}`} />
      
      <div className="p-4">
        {/* 測試類型和時間 */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-gray-800">{testTypeName}</h3>
            <div className="flex items-center text-sm text-gray-500 mt-1">
              <Clock size={14} className="mr-1" />
              {format(new Date(result.tested_at), 'yyyy/MM/dd HH:mm')}
            </div>
          </div>
          <div className={`px-2 py-1 rounded text-xs text-white ${getTypeColor(result.test_type)}`}>
            {result.synced_at ? '已同步' : '未同步'}
          </div>
        </div>
        
        {/* 受測者 */}
        <div className="flex items-center text-sm text-gray-600 mb-3">
          <User size={14} className="mr-1" />
          <span>{result.subject?.name || '未知受測者'}</span>
        </div>
        
        {/* 測試結果 - 大字顯示 */}
        <div className="bg-gray-50 rounded-lg p-4 mb-3 text-center">
          <div className="text-3xl font-bold text-orange-600">
            {result.result_value}
            <span className="text-lg font-normal text-gray-500 ml-1">
              {result.result_unit}
            </span>
          </div>
        </div>
        
        {/* 設備資訊 */}
        {result.device_id && (
          <div className="text-xs text-gray-400 mb-3">
            設備: {result.device_id}
          </div>
        )}
        
        {/* 操作按鈕 */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button 
            onClick={onView}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="查看詳情"
          >
            <Eye size={18} className="text-gray-500" />
          </button>
          {result.hls_stream_name && (
            <button 
              onClick={onPlay}
              className="p-2 hover:bg-green-50 rounded-lg transition-colors"
              title="播放錄影"
            >
              <Play size={18} className="text-green-500" />
            </button>
          )}
          <button 
            onClick={onDelete}
            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
            title="刪除"
          >
            <Trash2 size={18} className="text-red-500" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ResultsPage() {
  const [results, setResults] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  
  // 顯示模式
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card')
  
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
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  const handleDelete = (result: TestResult) => {
    setSelectedResult(result)
    setShowDeleteModal(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedResult) return
    
    setDeleting(true)
    
    const { error } = await supabase
      .from('test_results')
      .delete()
      .eq('id', selectedResult.id)
    
    setDeleting(false)
    
    if (error) {
      console.error('Error deleting result:', error)
      alert('刪除失敗：' + error.message)
    } else {
      setShowDeleteModal(false)
      setSelectedResult(null)
      fetchResults()
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">測試結果</h1>
        <div className="flex gap-2">
          <button 
            onClick={() => setViewMode('card')}
            className={`px-3 py-1 rounded ${viewMode === 'card' ? 'bg-orange-500 text-white' : 'bg-gray-100'}`}
          >
            卡片
          </button>
          <button 
            onClick={() => setViewMode('table')}
            className={`px-3 py-1 rounded ${viewMode === 'table' ? 'bg-orange-500 text-white' : 'bg-gray-100'}`}
          >
            表格
          </button>
        </div>
      </div>

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

      {/* 統計資訊 */}
      <div className="mb-4 flex justify-between items-center">
        <div className="text-sm text-gray-500">
          共 {total} 筆測試結果
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">每頁</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value={12}>12</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <span className="text-sm text-gray-600">筆</span>
        </div>
      </div>

      {/* 內容區 */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          載入中...
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Activity className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          沒有測試結果
        </div>
      ) : viewMode === 'card' ? (
        /* 卡片模式 */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {results.map((result) => (
            <ResultCard
              key={result.id}
              result={result}
              onView={() => handleViewDetail(result)}
              onPlay={() => handlePlayVideo(result)}
              onDelete={() => handleDelete(result)}
            />
          ))}
        </div>
      ) : (
        /* 表格模式 */
        <div className="card">
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
                  <th className="table-header">同步狀態</th>
                  <th className="table-header">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {results.map((result, index) => (
                  <tr key={result.id} className="hover:bg-gray-50">
                    <td className="table-cell">{(page - 1) * pageSize + index + 1}</td>
                    <td className="table-cell font-medium">
                      {result.subject?.name || '-'}
                    </td>
                    <td className="table-cell">
                      {TEST_TYPE_NAMES[result.test_type as keyof typeof TEST_TYPE_NAMES] || result.test_type}
                    </td>
                    <td className="table-cell">
                      <span className="font-mono font-semibold text-orange-600">
                        {result.result_value} {result.result_unit}
                      </span>
                    </td>
                    <td className="table-cell">
                      {format(new Date(result.tested_at), 'yyyy/MM/dd HH:mm')}
                    </td>
                    <td className="table-cell text-gray-500 text-sm">
                      {result.device_id || '-'}
                    </td>
                    <td className="table-cell">
                      {result.synced_at ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">已同步</span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs">未同步</span>
                      )}
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
                        <button 
                          onClick={() => handleDelete(result)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="刪除"
                        >
                          <Trash2 size={18} className="text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 分頁 */}
      {totalPages > 1 && (
        <div className="mt-4 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            第 {page} / {totalPages} 頁
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

      {/* 刪除確認 Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        title="確認刪除"
        message={`確定要刪除「${selectedResult?.subject?.name || '未知'}」的「${TEST_TYPE_NAMES[selectedResult?.test_type as keyof typeof TEST_TYPE_NAMES] || selectedResult?.test_type}」測試結果嗎？此操作無法復原。`}
        loading={deleting}
      />
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
              <div>{result.synced_at ? format(new Date(result.synced_at), 'yyyy/MM/dd HH:mm:ss') : '未同步'}</div>
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
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    
    const fetchHlsUrl = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch('/api/kvs/hls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            streamName: result.hls_stream_name,
            startTime: result.hls_start_time,
            endTime: result.hls_end_time,
            testedAt: result.tested_at,
          }),
        })
        
        const data = await response.json()
        
        if (!data.success) {
          setError(data.error || '無法取得影片')
          setLoading(false)
          return
        }
        
        const hlsUrl = data.hlsUrl
        console.log('HLS URL:', hlsUrl)
        console.log('Debug info:', data.debug)
        
        // 設定 15 秒超時
        timeoutId = setTimeout(() => {
          if (loading) {
            setError('影片載入超時，請稍後再試')
            setLoading(false)
            if (hlsRef.current) {
              hlsRef.current.destroy()
            }
          }
        }, 15000)
        
        // 使用 HLS.js 播放
        if (videoRef.current) {
          if (Hls.isSupported()) {
            const hls = new Hls({
              maxBufferLength: 30,
              maxMaxBufferLength: 60,
              startLevel: -1,
              debug: false,
            })
            hlsRef.current = hls
            
            hls.loadSource(hlsUrl)
            hls.attachMedia(videoRef.current)
            
            hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
              console.log('HLS Manifest parsed, levels:', data.levels.length)
              clearTimeout(timeoutId)
              setLoading(false)
              videoRef.current?.play().catch(e => console.log('Autoplay blocked:', e))
            })
            
            hls.on(Hls.Events.ERROR, (event, data) => {
              console.error('HLS Error:', data)
              if (data.fatal) {
                clearTimeout(timeoutId)
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    setError('網路錯誤，無法載入影片')
                    break
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    setError('媒體格式錯誤')
                    hls.recoverMediaError()
                    return
                  default:
                    setError('影片載入失敗: ' + data.details)
                }
                setLoading(false)
              }
            })
            
            hls.on(Hls.Events.FRAG_LOADED, () => {
              clearTimeout(timeoutId)
              setLoading(false)
            })
          } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari 原生支援 HLS
            videoRef.current.src = hlsUrl
            videoRef.current.addEventListener('loadedmetadata', () => {
              clearTimeout(timeoutId)
              setLoading(false)
              videoRef.current?.play().catch(e => console.log('Autoplay blocked:', e))
            })
            videoRef.current.addEventListener('error', () => {
              clearTimeout(timeoutId)
              setError('影片載入失敗')
              setLoading(false)
            })
          } else {
            setError('瀏覽器不支援 HLS 播放')
            setLoading(false)
          }
        }
      } catch (err: any) {
        console.error('Fetch HLS URL error:', err)
        setError(err.message || '載入失敗')
        setLoading(false)
      }
    }
    
    if (result.hls_stream_name) {
      fetchHlsUrl()
    } else {
      setError('沒有錄影資料')
      setLoading(false)
    }
    
    // 清理
    return () => {
      clearTimeout(timeoutId)
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [result.hls_stream_name, result.hls_start_time, result.hls_end_time, result.tested_at])

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
          <div className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center relative overflow-hidden">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                <div className="text-center text-white">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <div>載入中...</div>
                </div>
              </div>
            )}
            
            {error && (
              <div className="text-center text-white p-4">
                <div className="mb-2 text-red-400">{error}</div>
                <div className="text-sm text-gray-400">
                  串流名稱: {result.hls_stream_name}
                </div>
              </div>
            )}
            
            <video 
              ref={videoRef}
              controls 
              className="w-full h-full rounded-lg"
              style={{ display: error ? 'none' : 'block' }}
            >
              Your browser does not support the video tag.
            </video>
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
