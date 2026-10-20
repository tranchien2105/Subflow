import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';

import { Video } from '../videos/video.entity.js';

@Entity('subtitle_segments')
export class SubtitleSegment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'video_id', type: 'uuid' })
    videoId: string;

    @Column({ type: 'integer' })
    sequence: number;

    @Column({ name: 'start_ms', type: 'integer' })
    startMs: number;

    @Column({ name: 'end_ms', type: 'integer' })
    endMs: number;

    @Column({ name: 'original_text', type: 'text' })
    originalText: string;

    @Column({ name: 'translated_text', type: 'text' })
    translatedText: string;

    @ManyToOne(() => Video, (video) => video.subtitleSegments, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'video_id' })
    video: Relation<Video>;
}
