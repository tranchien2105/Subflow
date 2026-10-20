
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Video } from './video.entity.js';
import { TranslationJob } from '../jobs/translation-job.entity.js';
import { SubtitleSegment } from '../subtitles/subtitle-segment.entity.js';
import { VideosController } from './videos.controller.js';
import { VideosService } from './videos.service.js';
import { VideoProcessingProcessor } from './video-processing.processor.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Video,
      TranslationJob,
      SubtitleSegment,
    ]),
    BullModule.registerQueue({
      name: 'video-processing',
    }),
  ],
  controllers: [VideosController],
  providers: [
    VideosService,
    VideoProcessingProcessor,
  ],
  exports: [VideosService],
})
export class VideosModule { }
