import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import { TranslationJob } from '../jobs/translation-job.entity.js';
import { Video } from './video.entity.js';
import { SubtitleSegment } from '../subtitles/subtitle-segment.entity.js';

const execFileAsync = promisify(execFile);
const TRANSLATION_BATCH_SIZE = 4;
const DEFAULT_OLLAMA_TIMEOUT_MS = 300_000;
const OLLAMA_BATCH_RETRIES = 3;

type WhisperSegment = {
  startMs: number;
  endMs: number;
  originalText: string;
};

type WhisperResult = {
  language: string;
  languageProbability: number;
  durationSeconds: number;
  processingSeconds: number;
  segments: WhisperSegment[];
};

type OllamaResponse = {
  message?: {
    content?: string;
  };
};

type TranslationResponse = {
  translations: string[];
};

@Processor('video-processing')
export class VideoProcessingProcessor extends WorkerHost {
  private readonly projectRoot = resolve(process.cwd(), '..', '..');

  private readonly audioDirectory = resolve(
    this.projectRoot,
    'storage',
    'audio',
  );

  private readonly whisperScript = resolve(
    this.projectRoot,
    'workers',
    'whisper',
    'transcribe.py',
  );

  private readonly pythonExecutable =
    process.env.WHISPER_PYTHON ??
    resolve(this.projectRoot, '.venv-whisper', 'bin', 'python');

  private readonly ollamaUrl =
    process.env.OLLAMA_URL ?? 'http://localhost:11434';

  private readonly ollamaModel = process.env.OLLAMA_MODEL ?? 'qwen3:1.7b';

  private readonly ollamaTimeoutMs = Math.max(
    1_000,
    Number(process.env.OLLAMA_TIMEOUT_MS ?? DEFAULT_OLLAMA_TIMEOUT_MS) ||
      DEFAULT_OLLAMA_TIMEOUT_MS,
  );

  constructor(
    @InjectRepository(TranslationJob)
    private readonly jobRepository: Repository<TranslationJob>,

    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,

    @InjectRepository(SubtitleSegment)
    private readonly subtitleRepository: Repository<SubtitleSegment>,
  ) {
    super();
  }

  private log(translationJobId: string, message: string, data?: unknown): void {
    const prefix = `[VideoProcessing][job=${translationJobId}]`;

    if (data === undefined) {
      console.log(`${prefix} ${message}`);
      return;
    }

    console.log(`${prefix} ${message}`, data);
  }

  private logError(
    translationJobId: string,
    message: string,
    error: unknown,
  ): void {
    const details =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: (error as NodeJS.ErrnoException).code,
            stderr: (
              error as NodeJS.ErrnoException & {
                stderr?: string;
              }
            ).stderr,
            stdout: (
              error as NodeJS.ErrnoException & {
                stdout?: string;
              }
            ).stdout,
          }
        : error;

    console.error(
      `[VideoProcessing][job=${translationJobId}] ${message}`,
      details,
    );
  }

  private async translateBatch(
    texts: string[],
    translationJobId: string,
    batchIndex: number,
  ): Promise<string[]> {
    this.log(translationJobId, 'Bắt đầu dịch batch', {
      batchIndex: batchIndex + 1,
      sentenceCount: texts.length,
      model: this.ollamaModel,
      ollamaUrl: this.ollamaUrl,
    });

    for (let attempt = 1; attempt <= OLLAMA_BATCH_RETRIES; attempt++) {
      try {
        const translationsSchema = {
          type: 'object',
          properties: {
            translations: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['translations'],
          additionalProperties: false,
        };
        const response = await fetch(`${this.ollamaUrl}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.ollamaModel,
            stream: false,
            think: false,
            format: translationsSchema,
            keep_alive: '10m',
            options: {
              temperature: 0,
              num_predict: Math.min(
                2048,
                Math.max(
                  256,
                  texts.reduce((total, text) => total + [...text].length, 0) *
                    2,
                ),
              ),
            },
            messages: [
              {
                role: 'system',
                content:
                  'Bạn là dịch giả tiếng Nhật sang tiếng Việt. ' +
                  'Dịch tự nhiên, đúng ngữ cảnh, giữ nguyên ý nghĩa. ' +
                  'Không thêm thông tin không có trong bản gốc. ' +
                  'Giữ nguyên thứ tự các câu. ' +
                  'Chỉ trả về JSON có cấu trúc ' +
                  '{"translations":["bản dịch 1","bản dịch 2"]}. ' +
                  'Mỗi câu đầu vào phải có đúng một bản dịch đầu ra.',
              },
              {
                role: 'user',
                content:
                  'Dịch lần lượt các câu tiếng Nhật sau sang tiếng Việt:\n' +
                  JSON.stringify(texts),
              },
            ],
          }),
          signal: AbortSignal.timeout(this.ollamaTimeoutMs),
        });

        if (!response.ok) {
          const responseText = await response.text();

          this.logError(translationJobId, 'Ollama trả về HTTP error', {
            status: response.status,
            response: responseText,
          });

          throw new Error(
            `Ollama trả về HTTP ${response.status}: ${responseText}`,
          );
        }

        const payload = (await response.json()) as OllamaResponse;
        const content = payload.message?.content;

        if (!content) {
          throw new Error('Ollama không trả về nội dung bản dịch.');
        }

        let result: TranslationResponse;

        try {
          result = JSON.parse(content) as TranslationResponse;
        } catch {
          this.logError(translationJobId, 'Ollama trả về JSON không hợp lệ', {
            content,
          });

          throw new Error('Ollama trả về JSON bản dịch không hợp lệ.');
        }

        if (
          !Array.isArray(result.translations) ||
          result.translations.length !== texts.length ||
          result.translations.some(
            (text) => typeof text !== 'string' || !text.trim(),
          )
        ) {
          this.logError(
            translationJobId,
            'Kết quả dịch không khớp dữ liệu đầu vào',
            {
              expected: texts.length,
              actual: result.translations?.length,
              translations: result.translations,
            },
          );

          throw new Error(`Số bản dịch không khớp: cần ${texts.length} câu.`);
        }

        this.log(translationJobId, 'Dịch batch thành công', {
          batchIndex: batchIndex + 1,
          translatedCount: result.translations.length,
        });

        return result.translations.map((text) => text.trim());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const nonRetryableHttp = /Ollama trả về HTTP 4(?!08|29)\d/.test(
          message,
        );
        if (attempt >= OLLAMA_BATCH_RETRIES || nonRetryableHttp) throw error;

        const delayMs = 1_000 * 2 ** (attempt - 1);
        this.logError(translationJobId, 'Dịch batch lỗi, sẽ thử lại', {
          batchIndex: batchIndex + 1,
          attempt,
          nextAttempt: attempt + 1,
          delayMs,
          error: message,
        });
        await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
      }
    }

    throw new Error('Không thể dịch batch sau nhiều lần thử.');
  }

  async process(job: Job<{ translationJobId: string }>): Promise<void> {
    const { translationJobId } = job.data;

    this.log(translationJobId, 'Bắt đầu xử lý job', {
      queueJobId: job.id,
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts.attempts ?? 1,
      projectRoot: this.projectRoot,
      audioDirectory: this.audioDirectory,
      pythonExecutable: this.pythonExecutable,
      whisperScript: this.whisperScript,
    });

    const translationJob = await this.jobRepository.findOne({
      where: { id: translationJobId },
    });

    if (!translationJob) {
      throw new Error(`Không tìm thấy translation job: ${translationJobId}`);
    }

    const video = await this.videoRepository.findOne({
      where: { id: translationJob.videoId },
    });

    if (!video) {
      throw new Error(`Không tìm thấy video: ${translationJob.videoId}`);
    }

    const startedAt = new Date();

    const audioPath = resolve(this.audioDirectory, `${translationJobId}.wav`);
    const transcriptionPath = resolve(
      this.audioDirectory,
      `${translationJobId}.json`,
    );

    this.log(translationJobId, 'Đã tải thông tin video', {
      videoId: video.id,
      sourceType: video.sourceType,
      sourcePath: video.sourcePath,
      existingDurationSeconds: video.durationSeconds,
    });

    try {
      if (video.sourceType !== 'upload' || !video.sourcePath) {
        throw new Error(
          'Worker hiện chỉ xử lý video upload. Video nhập bằng URL chưa được hỗ trợ.',
        );
      }

      await this.jobRepository.update(translationJobId, {
        status: 'processing',
        startedAt: translationJob.startedAt ?? startedAt,
        errorMessage: null,
      });

      // CHECKPOINT 1: Giữ nguyên phụ đề đã nhận diện trong DB.
      let savedSegments = await this.subtitleRepository.find({
        where: { videoId: video.id },
        order: { sequence: 'ASC' },
      });

      this.log(translationJobId, 'Kiểm tra checkpoint phụ đề', {
        existingSegments: savedSegments.length,
      });

      if (savedSegments.length === 0) {
        await this.jobRepository.update(translationJobId, {
          progress: 5,
          currentStep: 'extracting_audio',
        });
        await job.updateProgress(5);

        await mkdir(this.audioDirectory, { recursive: true });

        this.log(translationJobId, 'Bắt đầu FFmpeg trích xuất audio', {
          input: video.sourcePath,
          output: audioPath,
        });

        const ffmpegResult = await execFileAsync(
          'ffmpeg',
          [
            '-y',
            '-i',
            video.sourcePath,
            '-vn',
            '-ar',
            '16000',
            '-ac',
            '1',
            audioPath,
          ],
          {
            timeout: 30 * 60 * 1000,
            maxBuffer: 10 * 1024 * 1024,
          },
        );

        this.log(translationJobId, 'FFmpeg hoàn tất', {
          stdout: ffmpegResult.stdout,
          stderr: ffmpegResult.stderr,
        });

        const audioStats = await stat(audioPath);

        this.log(translationJobId, 'Kiểm tra file WAV', {
          path: audioPath,
          sizeBytes: audioStats.size,
          sizeMB: Number((audioStats.size / (1024 * 1024)).toFixed(2)),
        });

        if (audioStats.size === 0) {
          throw new Error('FFmpeg tạo file WAV rỗng.');
        }

        await this.jobRepository.update(translationJobId, {
          progress: 25,
          currentStep: 'transcribing_japanese',
        });
        await job.updateProgress(25);

        this.log(translationJobId, 'Bắt đầu Whisper', {
          executable: this.pythonExecutable,
          script: this.whisperScript,
          audio: audioPath,
          model: 'base',
          language: 'ja',
        });

        let stdout: string;
        let stderr: string;

        try {
          await rm(transcriptionPath, { force: true });
          const whisperResult = await execFileAsync(
            this.pythonExecutable,
            [
              this.whisperScript,
              audioPath,
              '--model',
              'base',
              '--output',
              transcriptionPath,
            ],
            {
              timeout: 30 * 60 * 1000,
              maxBuffer: 4 * 1024 * 1024,
            },
          );

          stdout = await readFile(transcriptionPath, 'utf8');
          stderr = whisperResult.stderr;
          this.log(translationJobId, 'Whisper stdout summary', {
            stdoutLength: whisperResult.stdout.length,
            stdoutPreview: whisperResult.stdout.slice(0, 500),
            resultLength: stdout.length,
          });
        } catch (error) {
          this.logError(translationJobId, 'Lệnh Whisper thất bại', error);
          throw error;
        }

        this.log(translationJobId, 'Whisper stderr diagnostics', {
          stderr: stderr || '(không có stderr)',
        });

        this.log(translationJobId, 'Whisper stdout summary', {
          stdoutLength: stdout.length,
          stdoutPreview: stdout.slice(0, 1500),
        });

        let result: WhisperResult;

        try {
          result = JSON.parse(stdout) as WhisperResult;
        } catch (error) {
          this.logError(translationJobId, 'Không parse được JSON từ Whisper', {
            error,
            stdoutPreview: stdout.slice(0, 3000),
            stderr,
          });

          throw new Error('Whisper không trả về JSON hợp lệ.');
        }

        this.log(translationJobId, 'Whisper trả về kết quả', {
          language: result.language,
          languageProbability: result.languageProbability,
          durationSeconds: result.durationSeconds,
          processingSeconds: result.processingSeconds,
          segmentsCount: Array.isArray(result.segments)
            ? result.segments.length
            : null,
          firstSegments: Array.isArray(result.segments)
            ? result.segments.slice(0, 5)
            : [],
        });

        if (result.language !== 'ja' || !Array.isArray(result.segments)) {
          this.logError(
            translationJobId,
            'Kết quả Whisper không hợp lệ',
            result,
          );

          throw new Error(
            `Kết quả Whisper không hợp lệ hoặc không phải tiếng Nhật: ${result.language}`,
          );
        }

        const validSegments = result.segments.filter(
          (segment) =>
            Number.isFinite(segment.startMs) &&
            Number.isFinite(segment.endMs) &&
            segment.startMs >= 0 &&
            segment.endMs > segment.startMs &&
            typeof segment.originalText === 'string' &&
            segment.originalText.trim().length > 0,
        );

        this.log(translationJobId, 'Kết quả lọc segment', {
          totalSegments: result.segments.length,
          validSegments: validSegments.length,
          rejectedSegments: result.segments.length - validSegments.length,
          rejectedExamples: result.segments
            .filter(
              (segment) =>
                !Number.isFinite(segment.startMs) ||
                !Number.isFinite(segment.endMs) ||
                segment.startMs < 0 ||
                segment.endMs <= segment.startMs ||
                typeof segment.originalText !== 'string' ||
                !segment.originalText.trim(),
            )
            .slice(0, 5),
        });

        if (validSegments.length === 0) {
          throw new Error(
            'Whisper không nhận diện được đoạn thoại nào trong video.',
          );
        }

        // Lưu checkpoint nhận diện trước khi gọi Ollama.
        savedSegments = await this.subtitleRepository.save(
          validSegments.map((segment, index) =>
            this.subtitleRepository.create({
              videoId: video.id,
              sequence: index + 1,
              startMs: segment.startMs,
              endMs: segment.endMs,
              originalText: segment.originalText,
              translatedText: '',
            }),
          ),
        );

        this.log(translationJobId, 'Đã lưu phụ đề gốc', {
          savedCount: savedSegments.length,
          firstSegment: savedSegments[0]
            ? {
                sequence: savedSegments[0].sequence,
                startMs: savedSegments[0].startMs,
                endMs: savedSegments[0].endMs,
                originalText: savedSegments[0].originalText,
              }
            : null,
        });

        await this.videoRepository.update(video.id, {
          durationSeconds: Math.round(result.durationSeconds),
        });
      }

      const totalSegments = savedSegments.length;

      this.log(translationJobId, 'Chuẩn bị dịch', {
        totalSegments,
      });

      if (totalSegments === 0) {
        throw new Error('Không có đoạn phụ đề để dịch.');
      }

      // CHECKPOINT 2: Chỉ dịch những câu chưa có bản dịch.
      const pendingSegments = savedSegments.filter(
        (segment) => !segment.translatedText?.trim(),
      );

      const alreadyTranslated = totalSegments - pendingSegments.length;

      this.log(translationJobId, 'Trạng thái bản dịch', {
        totalSegments,
        alreadyTranslated,
        pendingTranslations: pendingSegments.length,
      });

      if (pendingSegments.length === 0) {
        await this.jobRepository.update(translationJobId, {
          status: 'completed',
          progress: 100,
          currentStep: 'translation_completed',
          processingSeconds:
            (Date.now() - (translationJob.startedAt ?? startedAt).getTime()) /
            1000,
          completedAt: new Date(),
          errorMessage: null,
        });

        await job.updateProgress(100);

        this.log(
          translationJobId,
          'Job hoàn tất: tất cả segment đã được dịch từ trước',
        );

        return;
      }

      await this.jobRepository.update(translationJobId, {
        progress: Math.max(
          70,
          70 + Math.floor((alreadyTranslated / totalSegments) * 25),
        ),
        currentStep: 'translating_vietnamese',
      });

      const totalBatches = Math.ceil(
        pendingSegments.length / TRANSLATION_BATCH_SIZE,
      );

      this.log(translationJobId, 'Bắt đầu dịch các batch', {
        totalBatches,
        batchSize: TRANSLATION_BATCH_SIZE,
      });

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * TRANSLATION_BATCH_SIZE;

        const batch = pendingSegments.slice(
          start,
          start + TRANSLATION_BATCH_SIZE,
        );

        const translations = await this.translateBatch(
          batch.map((segment) => segment.originalText),
          translationJobId,
          batchIndex,
        );

        for (let index = 0; index < batch.length; index++) {
          batch[index].translatedText = translations[index];
        }

        // Lưu từng batch ngay khi dịch xong.
        await this.subtitleRepository.save(batch);

        const translatedCount =
          alreadyTranslated +
          Math.min(
            (batchIndex + 1) * TRANSLATION_BATCH_SIZE,
            pendingSegments.length,
          );

        const progress = Math.min(
          95,
          70 + Math.floor((translatedCount / totalSegments) * 25),
        );

        await this.jobRepository.update(translationJobId, {
          progress,
          currentStep: 'translating_vietnamese',
        });

        await job.updateProgress(progress);

        this.log(translationJobId, 'Đã lưu batch bản dịch', {
          batch: batchIndex + 1,
          totalBatches,
          translatedCount,
          totalSegments,
          progress,
        });
      }

      const completedAt = new Date();

      await this.jobRepository.update(translationJobId, {
        status: 'completed',
        progress: 100,
        currentStep: 'translation_completed',
        processingSeconds:
          (completedAt.getTime() -
            (translationJob.startedAt ?? startedAt).getTime()) /
          1000,
        completedAt,
        errorMessage: null,
      });

      await job.updateProgress(100);

      this.log(translationJobId, 'Job hoàn tất thành công', {
        totalSegments,
        processingSeconds:
          (completedAt.getTime() -
            (translationJob.startedAt ?? startedAt).getTime()) /
          1000,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Lỗi xử lý không xác định';

      this.logError(translationJobId, 'Job xử lý thất bại', error);

      const maxAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;

      await this.jobRepository.update(translationJobId, {
        status: isFinalAttempt ? 'failed' : 'queued',
        currentStep: isFinalAttempt ? 'failed' : 'retrying',
        errorMessage,
        ...(isFinalAttempt ? { completedAt: new Date() } : {}),
      });

      this.log(translationJobId, 'Cập nhật trạng thái sau lỗi', {
        errorMessage,
        attemptsMade: job.attemptsMade,
        maxAttempts,
        isFinalAttempt,
        nextStatus: isFinalAttempt ? 'failed' : 'queued',
      });

      throw error;
    } finally {
      await rm(transcriptionPath, { force: true }).catch((error) => {
        this.logError(
          translationJobId,
          'Không xóa được file kết quả Whisper tạm',
          error,
        );
      });
      await rm(audioPath, { force: true }).catch((error) => {
        this.logError(translationJobId, 'Không xóa được file audio tạm', error);
      });
    }
  }
}
