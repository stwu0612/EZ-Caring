# Web - HLS 轉 S3 影片儲存遷移

## 變更摘要

從 AWS KVS HLS 串流遷移到 S3 直接儲存影片，簡化架構並降低成本。

### 架構變更

**舊架構 (HLS)**
```
Jetson → KVS (即時串流) → HLS → Web 播放
                      ↓
              KVS Archived Media API
```

**新架構 (S3)**
```
Jetson → 本地錄製 MP4 → S3 上傳 → Presigned URL → Web 播放
```

## 修改的檔案

### 1. 資料庫
- `supabase/migrations/001_add_video_s3_url.sql` - 新增 `video_s3_url` 欄位

執行方式：
```sql
-- 在 Supabase SQL Editor 執行
ALTER TABLE test_results 
ADD COLUMN IF NOT EXISTS video_s3_url VARCHAR(500);
```

### 2. Types
- `src/types/index.ts` - TestResult 新增 `video_s3_url` 欄位

### 3. API Routes
- `src/app/api/video/s3/route.ts` - **新增** S3 presigned URL API
- `src/app/api/sync/results/route.ts` - 支援 `video_s3_url` 欄位同步
- `src/app/api/kvs/hls/route.ts` - 保留，向下相容

### 4. 前端頁面
- `src/app/dashboard/results/page.tsx` - 影片播放改用原生 video，優先使用 S3

## 環境變數

新增到 `.env.local`：
```
AWS_S3_VIDEO_BUCKET=px-test-videos
```

## 部署步驟

1. **資料庫遷移**
   ```sql
   ALTER TABLE test_results ADD COLUMN IF NOT EXISTS video_s3_url VARCHAR(500);
   ```

2. **更新環境變數**
   - 確認 `AWS_S3_VIDEO_BUCKET` 設定正確

3. **部署 Web 應用**
   - 複製修改的檔案到專案
   - 重新部署

4. **Jetson 端更新**
   - 確認 Jetson 上傳影片到 S3 時使用正確的 bucket 和 key 格式
   - 同步時傳送 `video_s3_url` 欄位

## S3 影片路徑格式建議

```
s3://px-test-videos/{device_id}/{year}/{month}/{day}/{ulid}.mp4

範例:
s3://px-test-videos/jetson-001/2024/06/15/01HZ7XXXXX.mp4
```

## API 使用

### 取得影片 Presigned URL

```javascript
// POST /api/video/s3
const response = await fetch('/api/video/s3', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    videoS3Url: 's3://px-test-videos/device-001/2024/06/15/video.mp4'
  })
})

const { success, videoUrl } = await response.json()
// videoUrl 是有效期 1 小時的 presigned URL
```

### 同步測試結果（含 S3 影片）

```javascript
// POST /api/sync/results
{
  "device_id": "jetson-001",
  "results": [{
    "ulid": "01HZ7XXXXX",
    "subject_ulid": "01HY6YYYYY",
    "test_type": "sit_stand",
    "result_value": 12.5,
    "result_unit": "秒",
    "video_s3_url": "s3://px-test-videos/jetson-001/2024/06/15/01HZ7XXXXX.mp4",
    "tested_at": "2024-06-15T10:30:00Z"
  }]
}
```

## 向下相容

- 如果 `video_s3_url` 存在，優先使用 S3
- 如果只有 `hls_stream_name`，fallback 到 HLS
- 舊的測試結果仍然可以播放

## 移除 HLS.js 依賴

由於 S3 儲存的是標準 MP4 檔案，不再需要 HLS.js：

```bash
npm uninstall hls.js
```

如果需要保留 HLS 向下相容，可以保留但改為動態 import。
