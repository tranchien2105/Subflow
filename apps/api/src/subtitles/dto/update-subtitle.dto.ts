
import {
    IsInt,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';

export class UpdateSubtitleDto {
    @IsOptional()
    @IsInt()
    @Min(0)
    startMs?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    endMs?: number;

    @IsOptional()
    @IsString()
    originalText?: string;

    @IsOptional()
    @IsString()
    translatedText?: string;
}
