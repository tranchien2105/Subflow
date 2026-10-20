
import {
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
} from '@nestjs/common';

import { JobsService } from './jobs.service.js';

@Controller('jobs')
export class JobsController {
    constructor(
        private readonly jobsService: JobsService,
    ) { }

    @Get(':id')
    findOne(
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.jobsService.findOne(id);
    }
}
