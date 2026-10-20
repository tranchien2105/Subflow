
import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SubtitleSegment } from './subtitle-segment.entity.js';
import { Video } from '../videos/video.entity.js';
import { UpdateSubtitleDto } from './dto/update-subtitle.dto.js';

type SubtitleFormat = 'srt' | 'vtt';

@Injectable()
export class SubtitlesService {
    constructor(
        @InjectRepository(SubtitleSegment)
        private readonly subtitleRepository: Repository<SubtitleSegment>,

        @InjectRepository(Video)
        private readonly videoRepository: Repository<Video>,
    ) { }

    async findByVideoId(videoId: string) {
        const video = await this.videoRepository.findOne({
            where: { id: videoId },
        });

        if (!video) {
            throw new NotFoundException('Không tìm thấy video');
        }

        return this.subtitleRepository.find({
            where: { videoId },
            order: { sequence: 'ASC' },
        });
    }

    async update(id: string, dto: UpdateSubtitleDto) {
        if (Object.keys(dto).length === 0) {
            throw new BadRequestException(
                'Cần cung cấp ít nhất một trường để cập nhật',
            );
        }

        const subtitle = await this.subtitleRepository.findOne({
            where: { id },
        });

        if (!subtitle) {
            throw new NotFoundException('Không tìm thấy đoạn phụ đề');
        }

        const nextStartMs = dto.startMs ?? subtitle.startMs;
        const nextEndMs = dto.endMs ?? subtitle.endMs;

        if (nextEndMs <= nextStartMs) {
            throw new BadRequestException(
                'endMs phải lớn hơn startMs',
            );
        }

        if (dto.startMs !== undefined) {
            subtitle.startMs = dto.startMs;
        }

        if (dto.endMs !== undefined) {
            subtitle.endMs = dto.endMs;
        }

        if (dto.originalText !== undefined) {
            subtitle.originalText = dto.originalText;
        }

        if (dto.translatedText !== undefined) {
            subtitle.translatedText = dto.translatedText;
        }

        return this.subtitleRepository.save(subtitle);
    }

    async exportByVideoId(videoId: string, format: string) {
        if (format !== 'srt' && format !== 'vtt') {
            throw new BadRequestException(
                'Định dạng chỉ hỗ trợ srt hoặc vtt',
            );
        }

        const video = await this.videoRepository.findOne({
            where: { id: videoId },
        });

        if (!video) {
            throw new NotFoundException('Không tìm thấy video');
        }

        const subtitles = await this.subtitleRepository.find({
            where: { videoId },
            order: { sequence: 'ASC' },
        });

        const formatTimestamp = (milliseconds: number) => {
            const hours = Math.floor(milliseconds / 3_600_000);
            const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
            const seconds = Math.floor((milliseconds % 60_000) / 1000);
            const ms = milliseconds % 1000;

            const base = [
                String(hours).padStart(2, '0'),
                String(minutes).padStart(2, '0'),
                String(seconds).padStart(2, '0'),
            ].join(':');

            return `${base}${format === 'srt' ? ',' : '.'}${String(ms).padStart(3, '0')}`;
        };

        const lines = subtitles.map((subtitle, index) => {
            const start = formatTimestamp(subtitle.startMs);
            const end = formatTimestamp(subtitle.endMs);

            return [
                format === 'srt' ? String(index + 1) : '',
                `${start} --> ${end}`,
                subtitle.translatedText,
            ]
                .filter((line) => line !== '')
                .join('\n');
        });

        const content = [
            ...(format === 'vtt' ? ['WEBVTT'] : []),
            ...lines,
        ].join('\n\n');

        return {
            content: `${content}\n`,
            format: format as SubtitleFormat,
            filename: `subflow-${videoId}.${format}`,
        };
    }
}
