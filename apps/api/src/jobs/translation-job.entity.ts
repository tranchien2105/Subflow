
import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    type Relation,
} from 'typeorm';

import { Video } from '../videos/video.entity.js';

@Entity('translation_jobs')
export class TranslationJob {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'video_id', type: 'uuid' })
    videoId: string;

    @Column({ type: 'varchar', length: 20, default: 'queued' })
    status: string;

    @Column({ type: 'integer', default: 0 })
    progress: number;

    @Column({
        name: 'current_step',
        type: 'varchar',
        length: 50,
        nullable: true,
    })
    currentStep: string | null;

    @Column({
        name: 'processing_seconds',
        type: 'double precision',
        nullable: true,
    })
    processingSeconds: number | null;

    @Column({
        name: 'error_message',
        type: 'text',
        nullable: true,
    })
    errorMessage: string | null;

    @CreateDateColumn({
        name: 'created_at',
        type: 'timestamptz',
    })
    createdAt: Date;

    @Column({
        name: 'started_at',
        type: 'timestamptz',
        nullable: true,
    })
    startedAt: Date | null;

    @Column({
        name: 'completed_at',
        type: 'timestamptz',
        nullable: true,
    })
    completedAt: Date | null;

    @ManyToOne(() => Video, (video) => video.jobs, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'video_id' })
    video: Relation<Video>;
}
