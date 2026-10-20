export type Language = 'vi' | 'en';

export const translations = {
  vi: {
    workspace: 'KHÔNG GIAN LÀM VIỆC',
    dashboard: 'Bảng điều khiển',
    myVideos: 'Video của tôi',
    localEnvironment: 'Môi trường cục bộ',
    development: 'SubFlow bản phát triển',
    localDev: 'BẢN LOCAL',
    videoWorkspace: 'KHÔNG GIAN VIDEO',
    description: 'Quản lý video và quy trình phụ đề tại một nơi.',
    refresh: '↻ Làm mới',
    totalVideos: 'Tổng số video',
    latestVideos: 'Video mới nhất trong không gian làm việc',
    processingPipeline: 'Đang xử lý',
    asyncJobs: 'Video đang chờ hoặc xử lý',
    completedVideos: 'Đã hoàn thành',
    completedDetails: 'Video xử lý thành công',
    subtitleFormats: 'Định dạng phụ đề',
    subtitleDetails: 'Có thể chỉnh sửa và tải xuống',
    importVideo: 'Tải video lên',
    importDescription: 'Chọn video MP4 trên máy tính để tạo phụ đề.',
    videoUrl: 'Tệp video',
    importing: 'Đang tải lên…',
    importButton: '+ Tải video lên',
    urlHint: 'Chỉ hỗ trợ file MP4, dung lượng tối đa 500 MB.',
    importSuccess: (id: string) =>
      `Đã tải video vào hàng đợi xử lý. Mã tác vụ: ${id}`,
    apiError: 'Không kết nối được API. Hãy kiểm tra backend tại localhost:3001.',
    requiredUrl: 'Vui lòng chọn một file video.',
    importError: 'Đã xảy ra lỗi khi tải video lên.',
    recentVideos: 'Video gần đây',
    recentDescription: 'Các video mới được thêm gần đây.',
    videoCount: (count: number) => `${count} video`,
    video: 'VIDEO',
    source: 'NGUỒN',
    status: 'TRẠNG THÁI',
    added: 'NGÀY THÊM',
    duration: 'THỜI LƯỢNG',
    loading: 'Đang tải video…',
    empty: 'Chưa có video. Hãy tải video đầu tiên lên ở phía trên.',
    untitled: 'Video chưa có tiêu đề',
    minutes: 'ph',
    seconds: 'giây',
    queued: 'Đang chờ',
    processing: 'Đang xử lý',
    completed: 'Hoàn thành',
    failed: 'Thất bại',
    unknown: 'Chưa có tác vụ',
    progress: 'Tiến trình',
    currentStep: 'Bước hiện tại',
    processingTime: 'Thời gian xử lý',
    tableFooter: 'Hiển thị tối đa 20 video mới được thêm gần đây.',
    footerTitle: 'SubFlow · Dịch video & Phân tích',
    footerNote: 'Dành cho môi trường phát triển cục bộ',
    autoRefresh: 'Tự động cập nhật mỗi 5 giây',
    demoWarning: 'Worker hiện tại vẫn đang chạy chế độ demo.',
    language: 'Ngôn ngữ',
  },
  en: {
    workspace: 'WORKSPACE',
    dashboard: 'Dashboard',
    myVideos: 'My videos',
    localEnvironment: 'Local environment',
    development: 'SubFlow development',
    localDev: 'LOCAL DEV',
    videoWorkspace: 'VIDEO WORKSPACE',
    description: 'Manage your videos and subtitle workflow in one place.',
    refresh: '↻ Refresh',
    totalVideos: 'Total videos',
    latestVideos: 'Latest videos from your workspace',
    processingPipeline: 'In progress',
    asyncJobs: 'Queued or processing videos',
    completedVideos: 'Completed',
    completedDetails: 'Successfully processed videos',
    subtitleFormats: 'Subtitle formats',
    subtitleDetails: 'Editable and downloadable',
    importVideo: 'Upload a video',
    importDescription: 'Select an MP4 video from your computer to generate subtitles.',
    videoUrl: 'Video file',
    importing: 'Uploading…',
    importButton: '+ Upload video',
    urlHint: 'MP4 files only, maximum size 500 MB.',
    importSuccess: (id: string) =>
      `Video added to the processing queue. Job ID: ${id}`,
    apiError: 'Could not connect to the API. Check that the backend is running at localhost:3001.',
    requiredUrl: 'Please select a video file.',
    importError: 'An error occurred while uploading the video.',
    recentVideos: 'Recent videos',
    recentDescription: 'Your recently uploaded videos.',
    videoCount: (count: number) =>
      `${count} ${count === 1 ? 'video' : 'videos'}`,
    video: 'VIDEO',
    source: 'SOURCE',
    status: 'STATUS',
    added: 'ADDED',
    duration: 'DURATION',
    loading: 'Loading videos…',
    empty: 'No videos yet. Upload your first video above.',
    untitled: 'Untitled video',
    minutes: 'm',
    seconds: 's',
    queued: 'Queued',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    unknown: 'No job',
    progress: 'Progress',
    currentStep: 'Current step',
    processingTime: 'Processing time',
    tableFooter: 'Showing up to 20 most recently added videos.',
    footerTitle: 'SubFlow · Video Translation & Analytics',
    footerNote: 'Built for local development',
    autoRefresh: 'Auto-refreshes every 5 seconds',
    demoWarning: 'The current worker is still running in demo mode.',
    language: 'Language',
  },
} satisfies Record<Language, object>;

export type Copy = (typeof translations)[Language];

export function getStatusLabel(status: string | undefined, copy: Copy): string {
  switch (status) {
    case 'queued':
      return copy.queued;
    case 'processing':
      return copy.processing;
    case 'completed':
      return copy.completed;
    case 'failed':
      return copy.failed;
    default:
      return copy.unknown;
  }
}

export function getStatusColor(status: string | undefined): string {
  switch (status) {
    case 'queued':
      return '#a16207';
    case 'processing':
      return '#2563eb';
    case 'completed':
      return '#15803d';
    case 'failed':
      return '#dc2626';
    default:
      return '#64748b';
  }
}

export function formatDuration(seconds: number | null, copy: Copy): string {
  if (seconds == null) {
    return '—';
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return minutes > 0
    ? `${minutes}${copy.minutes} ${remainingSeconds}${copy.seconds}`
    : `${remainingSeconds}${copy.seconds}`;
}