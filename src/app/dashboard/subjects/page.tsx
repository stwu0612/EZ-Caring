'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Subject } from '@/types'
import { Search, ChevronDown, Edit, Trash2, Eye, Plus, X } from 'lucide-react'
import { format } from 'date-fns'

// 產生 ULID
function generateULID(): string {
  const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  const TIME_LEN = 10
  const RANDOM_LEN = 16
  
  let now = Date.now()
  let timeStr = ''
  for (let i = 0; i < TIME_LEN; i++) {
    timeStr = ENCODING[now % 32] + timeStr
    now = Math.floor(now / 32)
  }
  
  let randomStr = ''
  for (let i = 0; i < RANDOM_LEN; i++) {
    randomStr += ENCODING[Math.floor(Math.random() * 32)]
  }
  
  return timeStr + randomStr
}

// Modal 元件
function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children 
}: { 
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode 
}) {
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  )
}

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
  
  // Modal 狀態
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)
  const [saving, setSaving] = useState(false)
  
  // 表單資料
  const [formData, setFormData] = useState({
    name: '',
    id_number: '',
    gender: '',
    birth_date: '',
    age: '',
    height: '',
    weight: '',
  })

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

  // 新增受測者
  const handleAdd = () => {
    setFormData({
      name: '',
      id_number: '',
      gender: '',
      birth_date: '',
      age: '',
      height: '',
      weight: '',
    })
    setShowAddModal(true)
  }

  const handleSaveAdd = async () => {
    if (!formData.name.trim()) {
      alert('請輸入姓名')
      return
    }
    
    setSaving(true)
    
    const { error } = await supabase
      .from('subjects')
      .insert({
        ulid: generateULID(),
        name: formData.name.trim(),
        id_number: formData.id_number.trim() || null,
        gender: formData.gender || null,
        birth_date: formData.birth_date || null,
        age: formData.age ? parseInt(formData.age) : null,
        height: formData.height ? parseFloat(formData.height) : null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        test_count: 0,
      })
    
    setSaving(false)
    
    if (error) {
      console.error('Error adding subject:', error)
      alert('新增失敗：' + error.message)
    } else {
      setShowAddModal(false)
      fetchSubjects()
    }
  }

  // 編輯受測者
  const handleEdit = (subject: Subject) => {
    setSelectedSubject(subject)
    setFormData({
      name: subject.name || '',
      id_number: subject.id_number || '',
      gender: subject.gender || '',
      birth_date: subject.birth_date || '',
      age: subject.age?.toString() || '',
      height: subject.height?.toString() || '',
      weight: subject.weight?.toString() || '',
    })
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedSubject) return
    if (!formData.name.trim()) {
      alert('請輸入姓名')
      return
    }
    
    setSaving(true)
    
    const { error } = await supabase
      .from('subjects')
      .update({
        name: formData.name.trim(),
        id_number: formData.id_number.trim() || null,
        gender: formData.gender || null,
        birth_date: formData.birth_date || null,
        age: formData.age ? parseInt(formData.age) : null,
        height: formData.height ? parseFloat(formData.height) : null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
      })
      .eq('id', selectedSubject.id)
    
    setSaving(false)
    
    if (error) {
      console.error('Error updating subject:', error)
      alert('更新失敗：' + error.message)
    } else {
      setShowEditModal(false)
      setSelectedSubject(null)
      fetchSubjects()
    }
  }

  // 查看受測者
  const handleView = (subject: Subject) => {
    setSelectedSubject(subject)
    setShowViewModal(true)
  }

  // 刪除受測者（軟刪除）
  const handleDelete = (subject: Subject) => {
    setSelectedSubject(subject)
    setShowDeleteModal(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedSubject) return
    
    setSaving(true)
    
    // 軟刪除
    const { error } = await supabase
      .from('subjects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', selectedSubject.id)
    
    setSaving(false)
    
    if (error) {
      console.error('Error deleting subject:', error)
      alert('刪除失敗：' + error.message)
    } else {
      setShowDeleteModal(false)
      setSelectedSubject(null)
      fetchSubjects()
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  // 表單元件
  const SubjectForm = ({ onSave, saveText }: { onSave: () => void; saveText: string }) => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          姓名 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="input-field"
          placeholder="請輸入姓名"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">身分證字號</label>
        <input
          type="text"
          value={formData.id_number}
          onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
          className="input-field"
          placeholder="請輸入身分證字號"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">性別</label>
          <select
            value={formData.gender}
            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
            className="input-field"
          >
            <option value="">請選擇</option>
            <option value="male">男</option>
            <option value="female">女</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">出生日期</label>
          <input
            type="date"
            value={formData.birth_date}
            onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
            className="input-field"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">年齡</label>
          <input
            type="number"
            value={formData.age}
            onChange={(e) => setFormData({ ...formData, age: e.target.value })}
            className="input-field"
            placeholder="歲"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">身高 (cm)</label>
          <input
            type="number"
            step="0.1"
            value={formData.height}
            onChange={(e) => setFormData({ ...formData, height: e.target.value })}
            className="input-field"
            placeholder="cm"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">體重 (kg)</label>
          <input
            type="number"
            step="0.1"
            value={formData.weight}
            onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
            className="input-field"
            placeholder="kg"
          />
        </div>
      </div>
      
      <div className="flex justify-end gap-3 pt-4">
        <button 
          onClick={() => {
            setShowAddModal(false)
            setShowEditModal(false)
          }} 
          className="btn-secondary"
          disabled={saving}
        >
          取消
        </button>
        <button 
          onClick={onSave} 
          className="btn-primary"
          disabled={saving}
        >
          {saving ? '儲存中...' : saveText}
        </button>
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">受測者資料管理</h1>
        <button onClick={handleAdd} className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          新增受測者
        </button>
      </div>

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
              placeholder="姓名或身分證字號"
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
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
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
          <div className="text-sm text-gray-500">
            共 {total} 筆資料
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
                          onClick={() => handleView(subject)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="查看"
                        >
                          <Eye size={18} className="text-gray-500" />
                        </button>
                        <button 
                          onClick={() => handleEdit(subject)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="編輯"
                        >
                          <Edit size={18} className="text-blue-500" />
                        </button>
                        <button 
                          onClick={() => handleDelete(subject)}
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
      </div>

      {/* 新增 Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="新增受測者">
        <SubjectForm onSave={handleSaveAdd} saveText="新增" />
      </Modal>

      {/* 編輯 Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="編輯受測者">
        <SubjectForm onSave={handleSaveEdit} saveText="儲存" />
      </Modal>

      {/* 查看 Modal */}
      <Modal isOpen={showViewModal} onClose={() => setShowViewModal(false)} title="受測者資料">
        {selectedSubject && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">姓名</div>
                <div className="font-medium">{selectedSubject.name}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">身分證字號</div>
                <div className="font-medium">{selectedSubject.id_number || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">性別</div>
                <div className="font-medium">
                  {selectedSubject.gender === 'male' ? '男' : selectedSubject.gender === 'female' ? '女' : '-'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">出生日期</div>
                <div className="font-medium">{selectedSubject.birth_date || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">年齡</div>
                <div className="font-medium">{selectedSubject.age ? `${selectedSubject.age} 歲` : '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">身高</div>
                <div className="font-medium">{selectedSubject.height ? `${selectedSubject.height} cm` : '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">體重</div>
                <div className="font-medium">{selectedSubject.weight ? `${selectedSubject.weight} kg` : '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">測試次數</div>
                <div className="font-medium">{selectedSubject.test_count} 次</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">ULID</div>
                <div className="font-medium text-xs text-gray-600">{selectedSubject.ulid}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">建立日期</div>
                <div className="font-medium">{format(new Date(selectedSubject.created_at), 'yyyy/MM/dd HH:mm')}</div>
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <button onClick={() => setShowViewModal(false)} className="btn-secondary">
                關閉
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 刪除確認 Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        title="確認刪除"
        message={`確定要刪除受測者「${selectedSubject?.name}」嗎？此操作無法復原。`}
        loading={saving}
      />
    </div>
  )
}
