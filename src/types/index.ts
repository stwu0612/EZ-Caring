// 會員
export interface Member {
  id: string
  email: string
  name: string
  role: 'admin' | 'operator' | 'viewer'
  status: 'active' | 'inactive' | 'pending'
  notes?: string
  created_at: string
  updated_at: string
  auth_user_id?: string
}

// 受測者
export interface Subject {
  id: string
  ulid: string
  name: string
  id_number?: string
  gender?: 'male' | 'female'
  birth_date?: string
  age?: number
  height?: number
  weight?: number
  test_count: number
  created_by?: string
  created_by_name?: string
  created_at: string
  updated_at: string
  deleted_at?: string
  latest_test_at?: string
}

// 測試類型
export type TestType = 
  | 'sit_stand'
  | 'walk_speed'
  | 'balance_foot'
  | 'balance_half_foot'
  | 'balance_heel_toe'
  | 'one_leg_stand'
  | 'functional_reach'
  | 'gait_standing'

// 測試類型中文名稱
export const TEST_TYPE_NAMES: Record<TestType, string> = {
  sit_stand: '椅子坐站測試',
  walk_speed: '步行速度測試',
  balance_foot: '平衡測試-雙腳並排',
  balance_half_foot: '平衡測試-半腳並排',
  balance_heel_toe: '平衡測試-足跟對足尖',
  one_leg_stand: '單腳站立測試',
  functional_reach: '功能性前伸測試',
  gait_standing: '步態分析',
}

// 測試類型單位
export const TEST_TYPE_UNITS: Record<TestType, string> = {
  sit_stand: '秒',
  walk_speed: 'm/s',
  balance_foot: '秒',
  balance_half_foot: '秒',
  balance_heel_toe: '秒',
  one_leg_stand: '秒',
  functional_reach: 'cm',
  gait_standing: '度',
}

// 測試結果
export interface TestResult {
  id: string
  ulid: string
  subject_id?: string
  subject_ulid: string
  test_type: TestType
  test_name?: string
  result_value: number
  result_unit: string
  hls_stream_name?: string
  hls_start_time?: string
  hls_end_time?: string
  device_id?: string
  tested_at: string
  synced_at?: string
  created_at: string
  raw_data?: any
  
  // 關聯
  subject?: Subject
}

// SPPB 評估
export interface SPPBAssessment {
  id: string
  subject_id: string
  chair_stand_score: number
  walking_speed_score: number
  balance_score: number
  total_score: number
  risk_level: 'low' | 'moderate' | 'high'
  assessed_at: string
  created_at: string
}

// 同步日誌
export interface SyncLog {
  id: string
  source: 'android_app' | 'web_admin'
  device_id?: string
  sync_type: 'subjects' | 'test_results' | 'full'
  records_synced: number
  status: 'success' | 'partial' | 'failed'
  error_message?: string
  synced_at: string
}

// API 響應
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// 分頁
export interface PaginationParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// 搜尋過濾
export interface SubjectFilter {
  keyword?: string
  gender?: string
  createdDateFrom?: string
  createdDateTo?: string
}

export interface MemberFilter {
  keyword?: string
  status?: string
  registeredDateFrom?: string
  registeredDateTo?: string
}

export interface TestResultFilter {
  subjectId?: string
  testType?: string
  dateFrom?: string
  dateTo?: string
}
