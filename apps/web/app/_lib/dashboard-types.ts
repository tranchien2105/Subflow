
export type Job = {
  id: string;
  status: string;
  progress: number;
  currentStep: string | null;
  processingSeconds: number | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type Video = {
  id: string;
  title: string | null;
  sourceType: string;
  sourceUrl: string;
  durationSeconds: number | null;
  createdAt: string;
  job: Job | null;
};

export type SubtitleSegment = {
  id: string;
  videoId: string;
  sequence: number;
  startMs: number;
  endMs: number;
  originalText: string;
  translatedText: string;
};

export type VideoDetail = Omit<Video, 'job'>;

export type ImportResponse = {
  message: string;
  video: Video;
  job: Job;
};
