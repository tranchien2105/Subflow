# SubFlow

**SubFlow** là ứng dụng web giúp tải video lên, nhận diện lời thoại tiếng Nhật bằng Whisper, dịch phụ đề sang tiếng Việt bằng Ollama, rồi xem và chỉnh sửa kết quả trên trình duyệt.

> Giao diện web gửi yêu cầu đến API. API lưu thông tin video, đưa công việc vào hàng đợi và trả trạng thái để giao diện theo dõi trong lúc xử lý.

## Mục lục

- [Tổng quan kiến trúc](#tổng-quan-kiến-trúc)
- [Công nghệ](#công-nghệ)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Yêu cầu](#yêu-cầu)
- [Chạy môi trường phát triển](#chạy-môi-trường-phát-triển)
- [Cấu hình](#cấu-hình)
- [Luồng xử lý video](#luồng-xử-lý-video)
- [API chính](#api-chính)
- [Lưu ý hiện tại](#lưu-ý-hiện-tại)

## Tổng quan kiến trúc

```mermaid
flowchart LR
    User[Người dùng] --> Web[Web Next.js\nlocalhost:3000]
    Web --> API[API NestJS\nlocalhost:3001]
    API --> DB[(PostgreSQL)]
    API --> Queue[(Redis / BullMQ)]
    Queue --> Worker[Worker xử lý video]
    Worker --> FFmpeg[FFmpeg\nTách âm thanh]
    Worker --> Whisper[Whisper\nNhận diện tiếng Nhật]
    Worker --> Ollama[Ollama\nDịch sang tiếng Việt]
    Worker --> DB
    API --> Storage[(storage/videos)]
    Worker --> Storage
    Web -->|Xem video, phụ đề, tiến độ| API
```

PostgreSQL và Redis được khởi chạy bằng Docker Compose. API và web chạy bằng Node.js; Whisper chạy trong môi trường Python riêng; Ollama là dịch vụ cần được cài và khởi chạy riêng.

## Công nghệ

| Thành phần | Công nghệ | Vai trò |
| --- | --- | --- |
| Giao diện | Next.js, React, TypeScript | Trang tổng quan, tải video, xem và sửa phụ đề |
| API | NestJS, TypeScript | Upload, dữ liệu video, phụ đề và trạng thái công việc |
| Hàng đợi | BullMQ, Redis | Xử lý video nền và thử lại khi gặp lỗi |
| Cơ sở dữ liệu | PostgreSQL | Lưu video, công việc dịch và từng đoạn phụ đề |
| Nhận diện giọng nói | faster-whisper | Chuyển lời thoại tiếng Nhật thành văn bản có mốc thời gian |
| Xử lý âm thanh | FFmpeg | Trích xuất âm thanh mono 16 kHz từ video |
| Dịch | Ollama | Dịch từng nhóm câu tiếng Nhật sang tiếng Việt |

## Cấu trúc thư mục

```text
subflow/
├── apps/
│   ├── api/                  # NestJS API và worker BullMQ
│   │   ├── database/         # SQL khởi tạo schema
│   │   └── src/
│   │       ├── jobs/         # Trạng thái và API công việc
│   │       ├── subtitles/    # Đọc và sửa phụ đề
│   │       └── videos/       # Upload, video và xử lý nền
│   ├── web/                  # Giao diện Next.js
│   └── docker-compose.yml    # PostgreSQL và Redis
├── storage/
│   ├── videos/               # Video tải lên
│   └── audio/                # Âm thanh tạm khi xử lý
└── workers/
    └── whisper/
        └── transcribe.py     # Worker nhận diện tiếng Nhật
```

## Yêu cầu

- Node.js và npm
- Docker Compose
- Python 3 và `pip`
- FFmpeg có thể chạy từ dòng lệnh bằng `ffmpeg`
- Ollama đã chạy và có model dịch, mặc định là `qwen3:1.7b`

## Chạy môi trường phát triển

### 1. Khởi động PostgreSQL và Redis

Từ thư mục gốc dự án:

```bash
cd apps
docker compose up -d
cd ..
```

Compose mở PostgreSQL tại `localhost:5433` và Redis tại `localhost:6380`.

### 2. Tạo bảng trong PostgreSQL

Schema được quản lý bằng các file SQL, TypeORM không tự tạo bảng. Áp dụng migration ban đầu và migration hỗ trợ upload:

```bash
psql "postgresql://subflow:subflow_local_dev@localhost:5433/subflow" \
  -f apps/api/database/migrations/001_initial_schema.sql

psql "postgresql://subflow:subflow_local_dev@localhost:5433/subflow" \
  -f apps/api/database/migrations/002_video_upload.sql
```

### 3. Cài và chuẩn bị Whisper

```bash
python3 -m venv .venv-whisper
source .venv-whisper/bin/activate
python -m pip install --upgrade pip faster-whisper
deactivate
```

Lần đầu chạy model Whisper `base`, thư viện có thể cần tải model về máy. Có thể đặt đường dẫn Python khác bằng biến `WHISPER_PYTHON`.

### 4. Chuẩn bị Ollama

Khởi động Ollama, sau đó tải model mặc định:

```bash
ollama pull qwen3:1.7b
```

Nếu Ollama chạy ở máy hoặc địa chỉ khác, cấu hình `OLLAMA_URL` cho API.

### 5. Cài dependencies và chạy API

Mở terminal:

```bash
cd apps/api
npm install
npm run start:dev
```

API mặc định chạy tại `http://localhost:3001`.

### 6. Chạy giao diện web

Mở terminal khác:

```bash
cd apps/web
npm install
npm run dev
```

Mở `http://localhost:3000` để sử dụng SubFlow.

## Cấu hình

API đọc các biến môi trường sau; nếu không đặt, các giá trị mặc định trong cột cuối sẽ được dùng:

| Biến | Ý nghĩa | Mặc định |
| --- | --- | --- |
| `PORT` | Cổng API | `3001` |
| `DB_HOST` | Máy chủ PostgreSQL | `localhost` |
| `DB_PORT` | Cổng PostgreSQL | `5433` |
| `DB_USERNAME` | Tài khoản PostgreSQL | `subflow` |
| `DB_PASSWORD` | Mật khẩu PostgreSQL môi trường phát triển | `subflow_local_dev` |
| `DB_DATABASE` | Tên cơ sở dữ liệu | `subflow` |
| `REDIS_HOST` | Máy chủ Redis | `localhost` |
| `REDIS_PORT` | Cổng Redis | `6380` |
| `OLLAMA_URL` | Địa chỉ API Ollama | `http://localhost:11434` |
| `OLLAMA_MODEL` | Model dịch | `qwen3:1.7b` |
| `OLLAMA_TIMEOUT_MS` | Thời gian chờ mỗi yêu cầu dịch | `300000` |
| `WHISPER_PYTHON` | Đường dẫn Python chạy faster-whisper | `.venv-whisper/bin/python` trong cấu hình mặc định |

Giao diện web dùng `NEXT_PUBLIC_API_URL`, mặc định là `http://localhost:3001`.

Nếu API chạy trong container, `localhost` là chính container đó. Khi ấy hãy đặt địa chỉ PostgreSQL, Redis và Ollama theo hostname có thể truy cập từ container. Không commit file `.env` có thông tin bí mật.

## Luồng xử lý video

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant W as Web
    participant A as API
    participant D as PostgreSQL
    participant R as Redis / BullMQ
    participant P as Worker
    participant F as FFmpeg
    participant H as Whisper
    participant O as Ollama

    U->>W: Chọn và tải file MP4
    W->>A: POST /videos/upload
    A->>A: Lưu file vào storage/videos
    A->>D: Lưu video và công việc
    A->>R: Thêm công việc vào hàng đợi
    A-->>W: Trả thông tin video và job
    R->>P: Worker nhận job
    P->>F: Trích xuất WAV mono 16 kHz
    F-->>P: File âm thanh
    P->>H: Nhận diện tiếng Nhật
    H-->>P: Câu thoại và mốc thời gian
    P->>D: Lưu phụ đề gốc
    loop Từng nhóm tối đa 4 câu
        P->>O: Yêu cầu dịch tiếng Việt
        O-->>P: Danh sách bản dịch
        P->>D: Lưu checkpoint của nhóm
    end
    W->>A: Lấy tiến độ và phụ đề
    A->>D: Đọc trạng thái, video, phụ đề
    A-->>W: Trả kết quả để hiển thị
```

Job được đưa vào hàng đợi nên phản hồi upload có nghĩa là video đã được nhận và xếp hàng; quá trình nhận diện, dịch sẽ tiếp tục chạy nền. Worker lưu phụ đề gốc và từng nhóm bản dịch để có thể tiếp tục từ dữ liệu đã lưu nếu job phải chạy lại.

## API chính

| Phương thức | Đường dẫn | Mô tả |
| --- | --- | --- |
| `POST` | `/videos/upload` | Tải lên một file MP4 (tối đa 500 MB) và tạo job |
| `POST` | `/videos/import-url` | Tạo video từ URL HTTP hoặc HTTPS |
| `GET` | `/videos` | Danh sách video và trạng thái job mới nhất |
| `GET` | `/videos/:id` | Thông tin video |
| `GET` | `/videos/:id/stream` | Phát video, hỗ trợ tua bằng HTTP Range |
| `GET` | `/videos/:id/subtitles` | Danh sách phụ đề |
| `PATCH` | `/videos/:id/subtitles/:segmentId` | Cập nhật bản dịch của một đoạn |
| `GET` | `/jobs/:id` | Chi tiết và tiến độ job |

Các trạng thái job thường gặp: `queued`, `processing`, `completed`, `failed`. Khi job lỗi, xem `errorMessage` và log API có tiền tố `[VideoProcessing]` cùng mã job.

## Lưu ý hiện tại

- Worker hiện xử lý video upload; luồng xử lý video nhập bằng URL chưa được hỗ trợ dù API đã có endpoint nhận URL.
- Whisper hiện cấu hình nhận diện tiếng Nhật (`ja`) và Ollama dịch sang tiếng Việt.
- `apps/docker-compose.yml` chỉ chạy PostgreSQL và Redis, không chạy Ollama.
- File upload được lưu trong `storage/videos`; cần giữ thư mục này cùng dữ liệu PostgreSQL để video vẫn phát được.
