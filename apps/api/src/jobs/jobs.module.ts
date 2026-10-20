
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TranslationJob } from './translation-job.entity.js';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([TranslationJob]),
    ],
    controllers: [JobsController],
    providers: [JobsService],
    exports: [JobsService],
})
export class JobsModule { }
