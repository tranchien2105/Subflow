import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    type Relation,
} from 'typeorm';

import { TranslationJob } from '../jobs/translation-job.entity.js';
import { SubtitleSegment } from '../subtitles/subtitle-segment.entity.js';

@Entity('videos')
export class Video {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'varchar',
        length: 255,
        nullable: true,
    })
    title: string | null;

    @Column({
        name: 'source_type',
        type: 'varchar',
        length: 20,
    })
    sourceType: string;

    @Column({
        name: 'source_url',
        type: 'text',
    })
    sourceUrl: string;

    @Column({
        name: 'source_path',
        type: 'text',
        nullable: true,
    })
    sourcePath: string | null;

    @Column({
        name: 'duration_seconds',
        type: 'integer',
        nullable: true,
    })
    durationSeconds: number | null;

    @CreateDateColumn({
        name: 'created_at',
        type: 'timestamptz',
    })
    createdAt: Date;

    @OneToMany(() => TranslationJob, (job) => job.video)
    jobs: Relation<TranslationJob>[];

    @OneToMany(() => SubtitleSegment, (segment) => segment.video)
    subtitleSegments: Relation<SubtitleSegment>[];
}