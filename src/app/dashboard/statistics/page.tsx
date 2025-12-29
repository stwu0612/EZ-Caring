'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TEST_TYPE_NAMES, TestType } from '@/types'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts'

// 顏色配置
const COLORS = ['#FF6B35', '#004E89', '#2EC4B6', '#E71D36', '#7209B7', '#3A0CA3', '#4CC9F0', '#F72585']

export default function StatisticsPage() {
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  })
  
  // 統計數據
  const [stats, setStats] = useState({
    totalSubjects: 0,
    totalTests: 0,
    testsByType: [] as { name: string; count: number; type: string }[],
    testsByDay: [] as { date: string; count: number }[],
    averageScores: [] as { type: string; name: string; average: number }[],
    recentTests: [] as any[],
    sppbDistribution: [] as { level: string; count: number }[],
  })

  const supabase = createClient()

  useEffect(() => {
    fetchStatistics()
  }, [dateRange])

  const fetchStatistics = async () => {
    setLoading(true)
    
    try {
      // 1. 總受測者數
      const { count: subjectCount } = await supabase
        .from('subjects')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
      
      // 2. 總測試數（指定日期範圍）
      const { count: testCount } = await supabase
        .from('test_results')
        .select('*', { count: 'exact', head: true })
        .gte('tested_at', dateRange.from)
        .lte('tested_at', dateRange.to + 'T23:59:59')
      
      // 3. 各測試類型統計
      const { data: testsByType } = await supabase
        .from('test_results')
        .select('test_type')
        .gte('tested_at', dateRange.from)
        .lte('tested_at', dateRange.to + 'T23:59:59')
      
      const typeCount: Record<string, number> = {}
      testsByType?.forEach(t => {
        typeCount[t.test_type] = (typeCount[t.test_type] || 0) + 1
      })
      
      const testsByTypeData = Object.entries(typeCount).map(([type, count]) => ({
        type,
        name: TEST_TYPE_NAMES[type as TestType] || type,
        count,
      }))
      
      // 4. 每日測試趨勢
      const { data: dailyTests } = await supabase
        .from('test_results')
        .select('tested_at')
        .gte('tested_at', dateRange.from)
        .lte('tested_at', dateRange.to + 'T23:59:59')
      
      const dailyCount: Record<string, number> = {}
      dailyTests?.forEach(t => {
        const date = format(new Date(t.tested_at), 'MM/dd')
        dailyCount[date] = (dailyCount[date] || 0) + 1
      })
      
      const testsByDay = Object.entries(dailyCount)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
      
      // 5. 各測試類型平均分數
      const { data: allResults } = await supabase
        .from('test_results')
        .select('test_type, result_value')
        .gte('tested_at', dateRange.from)
        .lte('tested_at', dateRange.to + 'T23:59:59')
      
      const typeValues: Record<string, number[]> = {}
      allResults?.forEach(r => {
        if (!typeValues[r.test_type]) typeValues[r.test_type] = []
        typeValues[r.test_type].push(r.result_value)
      })
      
      const averageScores = Object.entries(typeValues).map(([type, values]) => ({
        type,
        name: TEST_TYPE_NAMES[type as TestType] || type,
        average: values.reduce((a, b) => a + b, 0) / values.length,
      }))
      
      // 6. SPPB 風險分佈
      const { data: sppbData } = await supabase
        .from('sppb_assessments')
        .select('risk_level')
        .gte('assessed_at', dateRange.from)
        .lte('assessed_at', dateRange.to + 'T23:59:59')
      
      const riskCount: Record<string, number> = { low: 0, moderate: 0, high: 0 }
      sppbData?.forEach(s => {
        if (s.risk_level) riskCount[s.risk_level]++
      })
      
      const sppbDistribution = [
        { level: '低風險', count: riskCount.low },
        { level: '中風險', count: riskCount.moderate },
        { level: '高風險', count: riskCount.high },
      ]
      
      setStats({
        totalSubjects: subjectCount || 0,
        totalTests: testCount || 0,
        testsByType: testsByTypeData,
        testsByDay,
        averageScores,
        recentTests: [],
        sppbDistribution,
      })
      
    } catch (error) {
      console.error('Error fetching statistics:', error)
    }
    
    setLoading(false)
  }

  // 自定義 Pie Chart Label
  const renderPieLabel = ({ name, percent }: { name: string; percent?: number }) => {
    const percentage = ((percent ?? 0) * 100).toFixed(0)
    return `${name} ${percentage}%`
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">統計報表</h1>

      {/* 日期篩選 */}
      <div className="card p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm text-gray-600">日期範圍：</span>
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
            className="input-field w-40"
          />
          <span>至</span>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
            className="input-field w-40"
          />
          <button
            onClick={() => setDateRange({
              from: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
              to: format(new Date(), 'yyyy-MM-dd'),
            })}
            className="btn-secondary text-sm"
          >
            近 7 天
          </button>
          <button
            onClick={() => setDateRange({
              from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
              to: format(new Date(), 'yyyy-MM-dd'),
            })}
            className="btn-secondary text-sm"
          >
            近 30 天
          </button>
          <button
            onClick={() => setDateRange({
              from: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
              to: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
            })}
            className="btn-secondary text-sm"
          >
            本月
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">載入中...</div>
      ) : (
        <>
          {/* 總覽卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="總受測者"
              value={stats.totalSubjects}
              unit="人"
              color="bg-blue-500"
            />
            <StatCard
              title="總測試數"
              value={stats.totalTests}
              unit="次"
              color="bg-green-500"
            />
            <StatCard
              title="測試類型"
              value={stats.testsByType.length}
              unit="種"
              color="bg-purple-500"
            />
            <StatCard
              title="日均測試"
              value={Math.round(stats.totalTests / 30)}
              unit="次/天"
              color="bg-orange-500"
            />
          </div>

          {/* 圖表區 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* 每日測試趨勢 */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">每日測試趨勢</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.testsByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#FF6B35" 
                    strokeWidth={2}
                    name="測試數"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 測試類型分佈 */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">測試類型分佈</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.testsByType}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={renderPieLabel}
                  >
                    {stats.testsByType.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 各測試類型平均值 */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">各測試類型平均值</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.averageScores} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip formatter={(value: number) => value.toFixed(2)} />
                  <Bar dataKey="average" fill="#FF6B35" name="平均值" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* SPPB 風險分佈 */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">SPPB 風險分佈</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.sppbDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="level" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" name="人數">
                    <Cell fill="#4CAF50" />
                    <Cell fill="#FF9800" />
                    <Cell fill="#F44336" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 測試類型詳細表格 */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">測試類型統計</h3>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">測試類型</th>
                  <th className="table-header text-right">測試次數</th>
                  <th className="table-header text-right">平均值</th>
                  <th className="table-header text-right">佔比</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stats.testsByType.map((item) => {
                  const avg = stats.averageScores.find(a => a.type === item.type)
                  return (
                    <tr key={item.type}>
                      <td className="table-cell">{item.name}</td>
                      <td className="table-cell text-right">{item.count}</td>
                      <td className="table-cell text-right">
                        {avg ? avg.average.toFixed(2) : '-'}
                      </td>
                      <td className="table-cell text-right">
                        {stats.totalTests > 0 
                          ? ((item.count / stats.totalTests) * 100).toFixed(1) 
                          : '0'}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// 統計卡片組件
function StatCard({ 
  title, 
  value, 
  unit, 
  color 
}: { 
  title: string
  value: number
  unit: string
  color: string 
}) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500">{title}</div>
          <div className="text-3xl font-bold mt-1">
            {value.toLocaleString()}
            <span className="text-lg font-normal text-gray-500 ml-1">{unit}</span>
          </div>
        </div>
        <div className={`w-12 h-12 rounded-full ${color} opacity-20`} />
      </div>
    </div>
  )
}
