'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Subject, TestResult, TEST_TYPE_NAMES } from '@/types'
import { ArrowLeft, User, Calendar, Activity, AlertCircle, CheckCircle, AlertTriangle, Play, X, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

// SPPB 計算邏輯
const SPPBCalculator = {
  // 椅子坐站測試分數 (0-4分)
  calculateChairStandScore: (seconds: number | null): number => {
    if (seconds === null) return 0
    if (seconds < 11.0) return 4
    if (seconds < 14.0) return 3
    if (seconds < 17.0) return 2
    if (seconds <= 60.0) return 1
    return 0
  },

  // 步行速度測試分數 (0-4分)
  calculateWalkingSpeedScore: (seconds: number | null): number => {
    if (seconds === null) return 0
    if (seconds < 5.0) return 4
    if (seconds <= 6.2) return 3
    if (seconds <= 9.0) return 2
    return 1
  },

  // 步行速度 m/s
  calculateWalkingSpeedMps: (seconds: number | null): number | null => {
    if (seconds === null || seconds <= 0) return null
    return 4.0 / seconds
  },

  // 平衡測試-雙腳並排 (0-1分)
  calculateBalanceParallelScore: (seconds: number | null): number => {
    if (seconds === null) return 0
    return seconds >= 10.0 ? 1 : 0
  },

  // 平衡測試-半腳並排 (0-1分)
  calculateBalanceSemiTandemScore: (seconds: number | null): number => {
    if (seconds === null) return 0
    return seconds >= 10.0 ? 1 : 0
  },

  // 平衡測試-足跟對足尖 (0-2分)
  calculateBalanceFullTandemScore: (seconds: number | null): number => {
    if (seconds === null) return 0
    if (seconds > 10.0) return 2
    if (seconds >= 3.0) return 1
    return 0
  },

  // 握力是否達標
  isGripStrengthNormal: (gripStrength: number | null, isMale: boolean): boolean => {
    if (gripStrength === null) return false
    const threshold = isMale ? 28.0 : 18.0
    return gripStrength >= threshold
  },

  // 步行速度是否達標 (>= 0.8 m/s)
  isWalkingSpeedNormal: (walkingSpeedMps: number | null): boolean => {
    if (walkingSpeedMps === null) return false
    return walkingSpeedMps >= 0.8
  },

  // SPPB 是否達標 (> 9)
  isSPPBNormal: (sppbScore: number): boolean => {
    return sppbScore > 9
  }
}

// 風險等級
type RiskLevel = 'low' | 'medium' | 'high' | 'atypical' | 'incomplete'

const RiskLevelInfo: Record<RiskLevel, { text: string; color: string; bgColor: string; description: string }> = {
  low: {
    text: '低風險',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    description: '肌肉力量正常，步行速度和SPPB皆達標'
  },
  medium: {
    text: '中風險',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    description: '肌肉力量不足，但步行速度或SPPB其中一項達標'
  },
  high: {
    text: '高風險',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    description: '肌肉力量不足，步行速度和SPPB皆不達標'
  },
  atypical: {
    text: '非典型',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    description: '肌肉力量正常，但步行速度或SPPB不達標，可能有其他病症風險'
  },
  incomplete: {
    text: '資料不齊全',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    description: '測試資料不完整，無法進行風險評估'
  }
}

// 計算風險等級
function calculateRiskLevel(
  gripStrength: number | null,
  walkingSpeedMps: number | null,
  sppbScore: number | null,
  isMale: boolean
): RiskLevel {
  if (gripStrength === null || walkingSpeedMps === null || sppbScore === null) {
    return 'incomplete'
  }

  const gripNormal = SPPBCalculator.isGripStrengthNormal(gripStrength, isMale)
  const walkingNormal = SPPBCalculator.isWalkingSpeedNormal(walkingSpeedMps)
  const sppbNormal = SPPBCalculator.isSPPBNormal(sppbScore)

  if (gripNormal && walkingNormal && sppbNormal) return 'low'
  if (!gripNormal && !walkingNormal && !sppbNormal) return 'high'
  if (gripNormal && (!walkingNormal || !sppbNormal)) return 'atypical'
  if (!gripNormal) return 'medium'
  
  return 'incomplete'
}

// 影片播放 Modal
function VideoModal({ 
  videoUrl, 
  title, 
  onClose 
}: { 
  videoUrl: string
  title: string
  onClose: () => void 
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [publicUrl, setPublicUrl] = useState<string | null>(null)

  useEffect(() => {
    const fetchUrl = async () => {
      try {
        const response = await fetch('/api/video/s3', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoS3Url: videoUrl })
        })
        const data = await response.json()
        if (data.success) {
          setPublicUrl(data.videoUrl)
        } else {
          setError(data.error || '無法取得影片')
        }
      } catch (e) {
        setError('載入失敗')
      }
      setLoading(false)
    }
    fetchUrl()
  }, [videoUrl])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>
        <div className="p-4">
          <div className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center">
            {loading && (
              <div className="text-white text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <div>載入中...</div>
              </div>
            )}
            {error && (
              <div className="text-red-400 text-center">{error}</div>
            )}
            {publicUrl && !error && (
              <video 
                src={publicUrl} 
                controls 
                autoPlay
                className="w-full h-full rounded-lg"
                onLoadedData={() => setLoading(false)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SPPBReportPage() {
  const params = useParams()
  const router = useRouter()
  const ulid = params.ulid as string

  const [subject, setSubject] = useState<Subject | null>(null)
  const [results, setResults] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(true)
  
  // 手動輸入的數值
  const [gripStrength, setGripStrength] = useState<string>('')
  const [calfCircumference, setCalfCircumference] = useState<string>('')
  
  // 影片播放
  const [videoModal, setVideoModal] = useState<{ url: string; title: string } | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [ulid])

  const fetchData = async () => {
    setLoading(true)

    // 取得受測者資料
    const { data: subjectData } = await supabase
      .from('subjects')
      .select('*')
      .eq('ulid', ulid)
      .single()

    if (subjectData) {
      setSubject(subjectData)
    }

    // 取得該受測者的所有測試結果
    const { data: resultsData } = await supabase
      .from('test_results')
      .select('*')
      .eq('subject_ulid', ulid)
      .order('tested_at', { ascending: false })

    if (resultsData) {
      setResults(resultsData)
    }

    setLoading(false)
  }

  // 計算各項最佳成績
  const getBestResult = (testType: string): TestResult | null => {
    const filtered = results.filter(r => r.test_type === testType)
    if (filtered.length === 0) return null
    
    // 對於時間類測試，取最小值（最快）
    // 對於距離類測試（functional_reach），取最大值（最遠）
    if (testType === 'functional_reach') {
      return filtered.reduce((best, curr) => 
        curr.result_value > best.result_value ? curr : best
      )
    }
    return filtered.reduce((best, curr) => 
      curr.result_value < best.result_value ? curr : best
    )
  }

  const bestChairStand = getBestResult('sit_stand')
  const bestWalkSpeed = getBestResult('walk_speed')
  const bestBalanceFoot = getBestResult('balance_foot')
  const bestBalanceHalfFoot = getBestResult('balance_half_foot')
  const bestBalanceHeelToe = getBestResult('balance_heel_toe')
  const bestOneLegStand = getBestResult('one_leg_stand')
  const bestFunctionalReach = getBestResult('functional_reach')

  // 計算各項分數
  const chairStandScore = SPPBCalculator.calculateChairStandScore(bestChairStand?.result_value ?? null)
  const walkingSpeedScore = SPPBCalculator.calculateWalkingSpeedScore(bestWalkSpeed?.result_value ?? null)
  const balanceParallelScore = SPPBCalculator.calculateBalanceParallelScore(bestBalanceFoot?.result_value ?? null)
  const balanceSemiTandemScore = SPPBCalculator.calculateBalanceSemiTandemScore(bestBalanceHalfFoot?.result_value ?? null)
  const balanceFullTandemScore = SPPBCalculator.calculateBalanceFullTandemScore(bestBalanceHeelToe?.result_value ?? null)
  const balanceTotalScore = balanceParallelScore + balanceSemiTandemScore + balanceFullTandemScore

  // SPPB 總分
  const sppbScore = chairStandScore + walkingSpeedScore + balanceTotalScore

  // 步行速度 m/s
  const walkingSpeedMps = SPPBCalculator.calculateWalkingSpeedMps(bestWalkSpeed?.result_value ?? null)

  // 風險等級
  const gripValue = gripStrength ? parseFloat(gripStrength) : null
  const isMale = subject?.gender === 'male'
  const riskLevel = calculateRiskLevel(gripValue, walkingSpeedMps, sppbScore, isMale)
  const riskInfo = RiskLevelInfo[riskLevel]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    )
  }

  if (!subject) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">找不到受測者資料</p>
        <button onClick={() => router.back()} className="mt-4 btn-secondary">
          返回
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* 標題列 */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">SPPB 評估報告</h1>
      </div>

      {/* 受測者資訊卡片 */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
            subject.gender === 'male' ? 'bg-blue-100' : 'bg-pink-100'
          }`}>
            <User size={32} className={subject.gender === 'male' ? 'text-blue-600' : 'text-pink-600'} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">{subject.name}</h2>
            <div className="flex gap-4 text-sm text-gray-500 mt-1">
              <span>{subject.gender === 'male' ? '男性' : '女性'}</span>
              <span>{subject.age} 歲</span>
              {subject.height && <span>{subject.height} cm</span>}
              {subject.weight && <span>{subject.weight} kg</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">測試次數</div>
            <div className="text-2xl font-bold text-orange-500">{results.length}</div>
          </div>
        </div>
      </div>

      {/* SPPB 總分 */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">SPPB 總分</h3>
            <p className="text-sm text-gray-500">椅子坐站 + 步行速度 + 平衡測試</p>
          </div>
          <div className="text-center">
            <div className={`text-4xl font-bold ${sppbScore > 9 ? 'text-green-600' : sppbScore > 6 ? 'text-yellow-600' : 'text-red-600'}`}>
              {sppbScore}
            </div>
            <div className="text-sm text-gray-500">/ 12 分</div>
          </div>
        </div>
        
        {/* 分數條 */}
        <div className="mt-4">
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${
                sppbScore > 9 ? 'bg-green-500' : sppbScore > 6 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${(sppbScore / 12) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0</span>
            <span>6 (高風險)</span>
            <span>9 (中風險)</span>
            <span>12</span>
          </div>
        </div>
      </div>

      {/* 各項測試成績 */}
      <div className="card p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">測試項目與分數</h3>
        
        {/* 椅子坐站測試 */}
        <TestItemRow
          title="椅子坐站測試"
          result={bestChairStand}
          score={chairStandScore}
          maxScore={4}
          unit="秒"
          onPlayVideo={bestChairStand?.video_s3_url ? () => setVideoModal({
            url: bestChairStand.video_s3_url!,
            title: '椅子坐站測試'
          }) : undefined}
        />
        
        {/* 步行速度測試 */}
        <TestItemRow
          title="步行速度測試"
          result={bestWalkSpeed}
          score={walkingSpeedScore}
          maxScore={4}
          unit="秒"
          extraInfo={walkingSpeedMps ? `${walkingSpeedMps.toFixed(2)} m/s` : undefined}
          onPlayVideo={bestWalkSpeed?.video_s3_url ? () => setVideoModal({
            url: bestWalkSpeed.video_s3_url!,
            title: '步行速度測試'
          }) : undefined}
        />
        
        <div className="border-t my-4" />
        <div className="text-sm font-medium text-gray-600 mb-2">平衡測試（總分：{balanceTotalScore}/4）</div>
        
        {/* 平衡測試-雙腳並排 */}
        <TestItemRow
          title="雙腳並排"
          result={bestBalanceFoot}
          score={balanceParallelScore}
          maxScore={1}
          unit="秒"
          onPlayVideo={bestBalanceFoot?.video_s3_url ? () => setVideoModal({
            url: bestBalanceFoot.video_s3_url!,
            title: '平衡測試-雙腳並排'
          }) : undefined}
        />
        
        {/* 平衡測試-半腳並排 */}
        <TestItemRow
          title="半腳並排"
          result={bestBalanceHalfFoot}
          score={balanceSemiTandemScore}
          maxScore={1}
          unit="秒"
          onPlayVideo={bestBalanceHalfFoot?.video_s3_url ? () => setVideoModal({
            url: bestBalanceHalfFoot.video_s3_url!,
            title: '平衡測試-半腳並排'
          }) : undefined}
        />
        
        {/* 平衡測試-足跟對足尖 */}
        <TestItemRow
          title="足跟對足尖"
          result={bestBalanceHeelToe}
          score={balanceFullTandemScore}
          maxScore={2}
          unit="秒"
          onPlayVideo={bestBalanceHeelToe?.video_s3_url ? () => setVideoModal({
            url: bestBalanceHeelToe.video_s3_url!,
            title: '平衡測試-足跟對足尖'
          }) : undefined}
        />
      </div>

      {/* 其他測試 */}
      {(bestOneLegStand || bestFunctionalReach) && (
        <div className="card p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">其他測試項目</h3>
          
          {bestOneLegStand && (
            <TestItemRow
              title="單腳站立測試"
              result={bestOneLegStand}
              unit="秒"
              onPlayVideo={bestOneLegStand?.video_s3_url ? () => setVideoModal({
                url: bestOneLegStand.video_s3_url!,
                title: '單腳站立測試'
              }) : undefined}
            />
          )}
          
          {bestFunctionalReach && (
            <TestItemRow
              title="功能性前伸測試"
              result={bestFunctionalReach}
              unit="cm"
              onPlayVideo={bestFunctionalReach?.video_s3_url ? () => setVideoModal({
                url: bestFunctionalReach.video_s3_url!,
                title: '功能性前伸測試'
              }) : undefined}
            />
          )}
        </div>
      )}

      {/* 手動輸入區域 */}
      <div className="card p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">手動輸入數據</h3>
        
        <div className="grid grid-cols-2 gap-6">
          {/* 握力 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              握力 (kg)
              <span className="text-xs text-gray-400 ml-2">
                達標：{isMale ? '≥28 kg' : '≥18 kg'}
              </span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                value={gripStrength}
                onChange={(e) => setGripStrength(e.target.value)}
                placeholder="請輸入握力"
                className="input-field flex-1"
              />
              {gripStrength && (
                <span className={`text-sm font-medium ${
                  SPPBCalculator.isGripStrengthNormal(parseFloat(gripStrength), isMale) 
                    ? 'text-green-600' 
                    : 'text-red-600'
                }`}>
                  {SPPBCalculator.isGripStrengthNormal(parseFloat(gripStrength), isMale) ? '達標' : '未達標'}
                </span>
              )}
            </div>
          </div>
          
          {/* 小腿圍 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              小腿圍 (cm)
              <span className="text-xs text-gray-400 ml-2">參考值</span>
            </label>
            <input
              type="number"
              step="0.1"
              value={calfCircumference}
              onChange={(e) => setCalfCircumference(e.target.value)}
              placeholder="請輸入小腿圍"
              className="input-field"
            />
          </div>
        </div>
      </div>

      {/* 風險等級評估 */}
      <div className="card p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">肌少症風險評估</h3>
        
        <div className={`p-4 rounded-lg ${riskInfo.bgColor}`}>
          <div className="flex items-center gap-3">
            {riskLevel === 'low' && <CheckCircle className="text-green-600" size={28} />}
            {riskLevel === 'medium' && <AlertTriangle className="text-yellow-600" size={28} />}
            {riskLevel === 'high' && <AlertCircle className="text-red-600" size={28} />}
            {riskLevel === 'atypical' && <AlertCircle className="text-purple-600" size={28} />}
            {riskLevel === 'incomplete' && <AlertCircle className="text-gray-600" size={28} />}
            
            <div>
              <div className={`text-xl font-bold ${riskInfo.color}`}>{riskInfo.text}</div>
              <div className="text-sm text-gray-600 mt-1">{riskInfo.description}</div>
            </div>
          </div>
        </div>
        
        {/* 評估標準說明 */}
        <div className="mt-4 text-sm text-gray-500">
          <div className="font-medium mb-2">評估標準：</div>
          <ul className="list-disc list-inside space-y-1">
            <li>握力：男性 ≥ 28 kg，女性 ≥ 18 kg</li>
            <li>步行速度：≥ 0.8 m/s</li>
            <li>SPPB 總分：&gt; 9 分</li>
          </ul>
        </div>
      </div>

      {/* 建議 */}
      {riskLevel !== 'incomplete' && (
        <div className="card p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">專業建議</h3>
          <div className="text-gray-700 leading-relaxed">
            {riskLevel === 'low' && (
              <>
                <p className="mb-3">您的身體機能評估結果良好，維持目前的運動習慣，持續保持健康的生活方式。</p>
                <p>建議維持每週至少150分鐘的中等強度運動，並注意均衡飲食和充足睡眠。</p>
              </>
            )}
            {riskLevel === 'medium' && (
              <>
                <p className="mb-3">您的部分身體機能需要加強，建議增加適度的運動訓練，特別是針對下肢肌力和平衡能力的訓練。</p>
                <p>建議每週進行3-5次的肌力訓練和平衡訓練，並定期追蹤身體狀況。</p>
              </>
            )}
            {riskLevel === 'high' && (
              <>
                <p className="mb-3">您的身體機能評估顯示有跌倒風險，建議尋求專業醫療協助，並在安全環境下進行復健運動。</p>
                <p>建議儘快就醫進行詳細評估，並在專業人員指導下進行安全的復健運動。</p>
              </>
            )}
            {riskLevel === 'atypical' && (
              <>
                <p className="mb-3">您的握力正常，但步行速度或SPPB評分未達標準，可能存在其他健康問題。</p>
                <p>建議諮詢醫師進行進一步檢查，排除其他可能的病因。</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* 影片播放 Modal */}
      {videoModal && (
        <VideoModal
          videoUrl={videoModal.url}
          title={videoModal.title}
          onClose={() => setVideoModal(null)}
        />
      )}
    </div>
  )
}

// 測試項目行元件
function TestItemRow({
  title,
  result,
  score,
  maxScore,
  unit,
  extraInfo,
  onPlayVideo
}: {
  title: string
  result: TestResult | null
  score?: number
  maxScore?: number
  unit: string
  extraInfo?: string
  onPlayVideo?: () => void
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-gray-700">{title}</span>
        {onPlayVideo && (
          <button 
            onClick={onPlayVideo}
            className="p-1 hover:bg-green-50 rounded"
            title="播放影片"
          >
            <Play size={16} className="text-green-500" />
          </button>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        {result ? (
          <>
            <span className="font-medium">
              {result.result_value.toFixed(2)} {unit}
            </span>
            {extraInfo && (
              <span className="text-sm text-gray-500">({extraInfo})</span>
            )}
            {score !== undefined && maxScore !== undefined && (
              <span className="px-2 py-1 bg-gray-100 rounded text-sm">
                {score} / {maxScore} 分
              </span>
            )}
          </>
        ) : (
          <span className="text-gray-400">尚未測試</span>
        )}
      </div>
    </div>
  )
}
