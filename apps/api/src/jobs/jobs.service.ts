
import {
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TranslationJob } from './translation-job.entity.js';

@Injectable()
export class JobsService {
    constructor(
        @InjectRepository(TranslationJob)
        private readonly jobRepository: Repository<TranslationJob>,
    ) { }

    async findOne(id: string) {
        const job = await this.jobRepository.findOne({
            where: { id },
        });

        if (!job) {
            throw new NotFoundException('Không tìm thấy job');
        }

        return {
            id: job.id,
            videoId: job.videoId,
            status: job.status,
            progress: job.progress,
            currentStep: job.currentStep,
            processingSeconds: job.processingSeconds,
            errorMessage: job.errorMessage,
            createdAt: job.createdAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
        };
    }
}
