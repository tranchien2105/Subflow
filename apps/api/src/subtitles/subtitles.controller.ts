
import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Query,
    Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { SubtitlesService } from './subtitles.service.js';
import { UpdateSubtitleDto } from './dto/update-subtitle.dto.js';

@Controller()
export class SubtitlesController {
    constructor(
        private readonly subtitlesService: SubtitlesService,
    ) { }

    @Get('videos/:videoId/subtitles')
    findByVideoId(
        @Param('videoId', ParseUUIDPipe) videoId: string,
    ) {
        return this.subtitlesService.findByVideoId(videoId);
    }

    @Patch('subtitles/:id')
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateSubtitleDto,
    ) {
        return this.subtitlesService.update(id, dto);
    }

    @Get('videos/:videoId/subtitles/download')
    async download(
        @Param('videoId', ParseUUIDPipe) videoId: string,
        @Query('format') format: string,
        @Res() response: Response,
    ) {
        const result = await this.subtitlesService.exportByVideoId(
            videoId,
            format,
        );

        response.setHeader(
            'Content-Type',
            format === 'vtt'
                ? 'text/vtt; charset=utf-8'
                : 'application/x-subrip; charset=utf-8',
        );

        response.setHeader(
            'Content-Disposition',
            `attachment; filename="${result.filename}"`,
        );

        response.send(result.content);
    }
}
