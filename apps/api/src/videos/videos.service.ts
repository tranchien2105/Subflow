
import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { access, unlink } from 'node:fs/promises';

import { Video } from './video.entity.js';
import { TranslationJob } from '../jobs/translation-job.entity.js';
import { SubtitleSegment } from '../subtitles/subtitle-segment.entity.js';
import { ImportVideoDto } from './dto/import-video.dto.js';

@Injectable()
export class VideosService {
    constructor(
        @InjectRepository(Video)
        private readonly videoRepository: Repository<Video>,

        @InjectRepository(TranslationJob)
        private readonly jobRepository: Repository<TranslationJob>,

        @InjectRepository(SubtitleSegment)
        private readonly subtitleRepository: Repository<SubtitleSegment>,

        @InjectQueue('video-processing')
        private readonly videoQueue: Queue,
    ) { }

    async upload(file: Express.Multer.File) {
        if (!file?.path || !file.filename) {
            throw new BadRequestException('File upload không hợp lệ.');
        }

        let savedVideo: Video | null = null;

        try {
            savedVideo = await this.videoRepository.save(
                this.videoRepository.create({
                    title: file.originalname.slice(0, 255),
                    sourceType: 'upload',
                    sourceUrl: `upload://${file.filename}`,
                    sourcePath: file.path,
                    durationSeconds: null,
                }),
            );

            const savedJob = await this.jobRepository.save(
                this.jobRepository.create({
                    videoId: savedVideo.id,
                    status: 'queued',
                    progress: 0,
                    currentStep: 'queued',
                }),
            );

            await this.videoQueue.add(
                'process-video',
                { translationJobId: savedJob.id },
                {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 1000,
                    },
                    removeOnComplete: 100,
                    removeOnFail: 1000,
                },
            );

            const { sourcePath: _sourcePath, ...videoResponse } = savedVideo;

            return {
                message: 'Đã upload video và thêm vào hàng đợi xử lý',
                video: videoResponse,
                job: savedJob,
            };
        } catch (error) {
            if (savedVideo) {
                await this.videoRepository.delete(savedVideo.id);
            }

            await unlink(file.path).catch(() => undefined);
            throw error;
        }
    }

    async importUrl(dto: ImportVideoDto) {
        let parsedUrl: URL;

        try {
            parsedUrl = new URL(dto.sourceUrl);
        } catch {
            throw new BadRequestException('URL không hợp lệ');
        }

        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            throw new BadRequestException(
                'Chỉ hỗ trợ URL HTTP hoặc HTTPS',
            );
        }

        const video = this.videoRepository.create({
            title: null,
            sourceType: 'url',
            sourceUrl: parsedUrl.toString(),
            sourcePath: null,
            durationSeconds: null,
        });

        const savedVideo = await this.videoRepository.save(video);

        try {
            const job = this.jobRepository.create({
                videoId: savedVideo.id,
                status: 'queued',
                progress: 0,
                currentStep: 'queued',
            });

            const savedJob = await this.jobRepository.save(job);

            await this.videoQueue.add(
                'process-video',
                { translationJobId: savedJob.id },
                {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 1000,
                    },
                    removeOnComplete: 100,
                    removeOnFail: 1000,
                },
            );

            const { sourcePath: _sourcePath, ...videoResponse } = savedVideo;

            return {
                message: 'Đã thêm video vào hàng đợi xử lý',
                video: videoResponse,
                job: savedJob,
            };
        } catch (error) {
            await this.videoRepository.delete(savedVideo.id);
            throw error;
        }
    }

    async findAll() {
        const videos = await this.videoRepository.find({
            relations: {
                jobs: true,
            },
            order: {
                createdAt: 'DESC',
            },
            take: 20,
        });

        return videos.map((video) => {
            const { jobs, sourcePath: _sourcePath, ...videoData } = video;

            const latestJob = [...(jobs ?? [])].sort(
                (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime(),
            )[0];

            return {
                ...videoData,
                job: latestJob
                    ? {
                        id: latestJob.id,
                        status: latestJob.status,
                        progress: latestJob.progress,
                        currentStep: latestJob.currentStep,
                        processingSeconds: latestJob.processingSeconds,
                        errorMessage: latestJob.errorMessage,
                        createdAt: latestJob.createdAt,
                        startedAt: latestJob.startedAt,
                        completedAt: latestJob.completedAt,
                    }
                    : null,
            };
        });
    }

    async findOne(id: string) {
        const video = await this.videoRepository.findOne({
            where: { id },
        });

        if (!video) {
            throw new NotFoundException('Không tìm thấy video');
        }

        const { sourcePath: _sourcePath, ...videoData } = video;
        return videoData;
    }

    /**
     * Lấy đường dẫn file nội bộ để controller phát video.
     * Không trả sourcePath ra API metadata.
     */
    async getStreamFilePath(id: string): Promise<string> {
        const video = await this.videoRepository.findOne({
            where: { id },
            select: {
                id: true,
                sourceType: true,
                sourcePath: true,
            },
        });

        if (!video) {
            throw new NotFoundException('Không tìm thấy video');
        }

        if (video.sourceType !== 'upload' || !video.sourcePath) {
            throw new BadRequestException(
                'Video này chưa có file upload để phát trực tiếp.',
            );
        }

        try {
            await access(video.sourcePath);
        } catch {
            throw new NotFoundException(
                'File video không còn tồn tại trên máy chủ.',
            );
        }

        return video.sourcePath;
    }

    async findSubtitles(videoId: string) {
        const videoExists = await this.videoRepository.exists({
            where: { id: videoId },
        });

        if (!videoExists) {
            throw new NotFoundException('Không tìm thấy video');
        }

        return this.subtitleRepository.find({
            where: { videoId },
            select: {
                id: true,
                videoId: true,
                sequence: true,
                startMs: true,
                endMs: true,
                originalText: true,
                translatedText: true,
            },
            order: {
                sequence: 'ASC',
            },
        });
    }

    async updateSubtitle(
        videoId: string,
        segmentId: string,
        translatedText: string,
    ) {
        if (
            typeof translatedText !== 'string' ||
            !translatedText.trim()
        ) {
            throw new BadRequestException(
                'Bản dịch không được để trống.',
            );
        }

        const segment = await this.subtitleRepository.findOne({
            where: {
                id: segmentId,
                videoId,
            },
        });

        if (!segment) {
            throw new NotFoundException(
                'Không tìm thấy câu phụ đề của video này.',
            );
        }

        segment.translatedText = translatedText.trim();

        const updatedSegment =
            await this.subtitleRepository.save(segment);

        return {
            message: 'Đã cập nhật bản dịch.',
            subtitle: updatedSegment,
        };
    }
}
