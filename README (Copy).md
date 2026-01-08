# PX 體適能測試系統 - Web 管理後台

使用 Next.js 14 + Supabase + Vercel 建構的管理後台，用於同步和管理 Android App 的測試結果。

## 功能特色

- 🔐 **用戶認證** - 使用 Supabase Auth 進行登入管理
- 👥 **會員管理** - 管理系統操作員
- 🧑‍🤝‍🧑 **受測者管理** - 管理接受測試的人員
- 📊 **測試結果** - 查看和管理測試結果
- 🔄 **數據同步** - 透過 API 與 Android App 同步數據
- 📱 **響應式設計** - 支援桌面和平板瀏覽

## 技術棧

- **前端框架**: Next.js 14 (App Router)
- **樣式**: Tailwind CSS
- **數據庫**: Supabase (PostgreSQL)
- **認證**: Supabase Auth
- **部署**: Vercel

## 快速開始

### 1. 建立 Supabase 專案

1. 前往 [Supabase](https://supabase.com) 建立新專案
2. 在 SQL Editor 中執行 `supabase/schema.sql` 建立資料表
3. 從 Settings > API 取得 URL 和 Keys

### 2. 環境設定

```bash
# 複製環境變數範例
cp .env.example .env.local

# 編輯環境變數
nano .env.local
```

填入 Supabase 的設定：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. 安裝與執行

```bash
# 安裝依賴
npm install

# 開發模式
npm run dev

# 建置
npm run build

# 正式運行
npm start
```

### 4. 部署到 Vercel

1. 將專案推送到 GitHub
2. 在 [Vercel](https://vercel.com) 匯入專案
3. 設定環境變數
4. 部署完成

## API 文檔

### 同步測試結果

**POST** `/api/sync/results`

```json
{
  "device_id": "px-device-001",
  "results": [
    {
      "ulid": "01HQXXX...",
      "subject_ulid": "01HQYYY...",
      "test_type": "sit_stand",
      "test_name": "椅子坐站測試",
      "result_value": 12.5,
      "result_unit": "秒",
      "hls_stream_name": "exam-123456",
      "hls_start_time": "2024-01-01T10:00:00Z",
      "hls_end_time": "2024-01-01T10:01:00Z",
      "tested_at": "2024-01-01T10:00:30Z"
    }
  ]
}
```

**回應：**

```json
{
  "success": true,
  "synced": 1,
  "total": 1
}
```

### 同步受測者

**POST** `/api/sync/subjects`

```json
{
  "device_id": "px-device-001",
  "subjects": [
    {
      "ulid": "01HQXXX...",
      "name": "王小明",
      "id_number": "A123456789",
      "gender": "male",
      "birth_date": "1990-01-01",
      "age": 34,
      "height": 175.5,
      "weight": 70.0
    }
  ]
}
```

### 取得測試結果

**GET** `/api/sync/results?subject_ulid=xxx&since=2024-01-01&limit=100`

### 取得受測者

**GET** `/api/sync/subjects?since=2024-01-01&limit=100`

## 數據庫結構

### members (會員)
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UUID | 主鍵 |
| email | VARCHAR | 電子郵件 |
| name | VARCHAR | 姓名 |
| role | VARCHAR | 角色 (admin/operator/viewer) |
| status | VARCHAR | 狀態 (active/inactive/pending) |

### subjects (受測者)
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UUID | 主鍵 |
| ulid | VARCHAR | 與 App 同步用的 ID |
| name | VARCHAR | 姓名 |
| gender | VARCHAR | 性別 |
| age | INTEGER | 年齡 |
| test_count | INTEGER | 測試次數 |

### test_results (測試結果)
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UUID | 主鍵 |
| ulid | VARCHAR | 與 App 同步用的 ID |
| subject_id | UUID | 受測者 ID |
| test_type | VARCHAR | 測試類型 |
| result_value | DECIMAL | 結果數值 |
| result_unit | VARCHAR | 單位 |
| hls_stream_name | VARCHAR | HLS 錄影名稱 |
| tested_at | TIMESTAMP | 測試時間 |

## 支援的測試類型

| 代碼 | 名稱 | 單位 |
|------|------|------|
| sit_stand | 椅子坐站測試 | 秒 |
| walk_speed | 步行速度測試 | m/s |
| balance_foot | 平衡測試-雙腳並排 | 秒 |
| balance_half_foot | 平衡測試-半腳並排 | 秒 |
| balance_heel_toe | 平衡測試-足跟對足尖 | 秒 |
| one_leg_stand | 單腳站立測試 | 秒 |
| functional_reach | 功能性前伸測試 | cm |
| gait_standing | 步態分析 | 度 |

## Android App 整合

在 Android App 中添加同步功能：

```kotlin
// ApiService.kt
interface SyncApiService {
    @POST("api/sync/subjects")
    suspend fun syncSubjects(@Body request: SyncSubjectsRequest): SyncResponse

    @POST("api/sync/results")
    suspend fun syncResults(@Body request: SyncResultsRequest): SyncResponse
}

// 使用
val response = syncApi.syncResults(
    SyncResultsRequest(
        device_id = "px-device-001",
        results = localResults.map { it.toSyncFormat() }
    )
)
```

## 授權

© 2025 EZCaring. All rights reserved.
