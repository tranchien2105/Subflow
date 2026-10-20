
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

import { Video } from './videos/video.entity.js';
import { TranslationJob } from './jobs/translation-job.entity.js';
import { SubtitleSegment } from './subtitles/subtitle-segment.entity.js';
import { VideosModule } from './videos/videos.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { SubtitlesModule } from './subtitles/subtitles.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DB_HOST', 'localhost'),
        port: Number(config.get('DB_PORT', 5433)),
        username: config.get<string>('DB_USERNAME', 'subflow'),
        password: config.get<string>('DB_PASSWORD', 'subflow_local_dev'),
        database: config.get<string>('DB_DATABASE', 'subflow'),
        entities: [Video, TranslationJob, SubtitleSegment],
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: Number(config.get('REDIS_PORT', 6380)),
        },
      }),
    }),

    VideosModule,
    JobsModule,
    SubtitlesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
