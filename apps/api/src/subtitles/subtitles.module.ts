
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SubtitleSegment } from './subtitle-segment.entity.js';
import { Video } from '../videos/video.entity.js';
import { SubtitlesController } from './subtitles.controller.js';
import { SubtitlesService } from './subtitles.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubtitleSegment, Video]),
  ],
  controllers: [SubtitlesController],
  providers: [SubtitlesService],
  exports: [SubtitlesService],
})
export class SubtitlesModule { }
