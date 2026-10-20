
import {
    BadRequestException,
    Controller,
    Get,
    Post,
    Param,
    Body,
    Patch,
    ParseUUIDPipe,
    UploadedFile,
    UseInterceptors,
    Req,
    Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync, createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, resolve } from 'node:path';
import type { Request, Response } from 'express';

import { VideosService } from './videos.service.js';
import { ImportVideoDto } from './dto/import-video.dto.js';

const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

function getVideoStorageDirectory(): string {
    return resolve(process.cwd(), '..', '..', 'storage', 'videos');
}

@Controller('videos')
export class VideosController {
    constructor(private readonly videosService: VideosService) { }

    @Post('upload')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: (_request, _file, callback) => {
                    const directory = getVideoStorageDirectory();
                    mkdirSync(directory, { recursive: true });
                    callback(null, directory);
                },
                filename: (_request, file, callback) => {
                    callback(null, `${randomUUID()}.mp4`);
                },
            }),
            limits: {
                fileSize: MAX_VIDEO_SIZE,
                files: 1,
            },
            fileFilter: (_request, file, callback) => {
                const extension = extname(file.originalname).toLowerCase();
                const allowedMimeTypes = [
                    'video/mp4',
                    'application/octet-stream',
                ];

                if (
                    extension !== '.mp4' ||
                    !allowedMimeTypes.includes(file.mimetype)
                ) {
                    callback(
                        new BadRequestException('Chỉ chấp nhận file MP4 hợp lệ.'),
                        false,
                    );
                    return;
                }

                callback(null, true);
            },
        }),
    )
    upload(@UploadedFile() file: Express.Multer.File | undefined) {
        if (!file) {
            throw new BadRequestException(
                'Vui lòng chọn file MP4 để upload.',
            );
        }

        return this.videosService.upload(file);
    }

    @Post('import-url')
    importUrl(@Body() dto: ImportVideoDto) {
        return this.videosService.importUrl(dto);
    }

    @Get()
    findAll() {
        return this.videosService.findAll();
    }

    @Get(':id/subtitles')
    findSubtitles(@Param('id', ParseUUIDPipe) id: string) {
        return this.videosService.findSubtitles(id);
    }

    /**
     * Phát video và hỗ trợ tua bằng HTTP Range.
     */
    @Get(':id/stream')
    async stream(
        @Param('id', ParseUUIDPipe) id: string,
        @Req() request: Request,
        @Res() response: Response,
    ) {
        const filePath = await this.videosService.getStreamFilePath(id);
        const fileStat = await stat(filePath);
        const fileSize = fileStat.size;
        const range = request.headers.range;

        response.setHeader('Content-Type', 'video/mp4');
        response.setHeader('Accept-Ranges', 'bytes');
        response.setHeader('Cache-Control', 'private, no-cache');

        if (!range) {
            response.status(200);
            response.setHeader('Content-Length', fileSize);

            createReadStream(filePath)
                .on('error', (error) => {
                    if (!response.headersSent) {
                        response.status(500).end();
                    } else {
                        response.destroy(error);
                    }
                })
                .pipe(response);

            return;
        }

        const match = /^bytes=(\d*)-(\d*)$/.exec(range);

        if (!match || (!match[1] && !match[2])) {
            response.setHeader('Content-Range', `bytes */${fileSize}`);
            response.status(416).end();
            return;
        }

        let start: number;
        let end: number;

        if (!match[1]) {
            const suffixLength = Number(match[2]);

            if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
                response.setHeader('Content-Range', `bytes */${fileSize}`);
                response.status(416).end();
                return;
            }

            start = Math.max(fileSize - suffixLength, 0);
            end = fileSize - 1;
        } else {
            start = Number(match[1]);
            end = match[2] ? Number(match[2]) : fileSize - 1;
        }

        if (
            !Number.isSafeInteger(start) ||
            !Number.isSafeInteger(end) ||
            start < 0 ||
            start >= fileSize ||
            end < start
        ) {
            response.setHeader('Content-Range', `bytes */${fileSize}`);
            response.status(416).end();
            return;
        }

        end = Math.min(end, fileSize - 1);

        response.status(206);
        response.setHeader(
            'Content-Range',
            `bytes ${start}-${end}/${fileSize}`,
        );
        response.setHeader('Content-Length', end - start + 1);

        createReadStream(filePath, { start, end })
            .on('error', (error) => {
                if (!response.headersSent) {
                    response.status(500).end();
                } else {
                    response.destroy(error);
                }
            })
            .pipe(response);
    }

    @Patch(':id/subtitles/:segmentId')
    updateSubtitle(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('segmentId', ParseUUIDPipe) segmentId: string,
        @Body() body: { translatedText: string },
    ) {
        return this.videosService.updateSubtitle(
            id,
            segmentId,
            body?.translatedText,
        );
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.videosService.findOne(id);
    }
}
