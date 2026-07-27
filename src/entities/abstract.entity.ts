import { Column, CreateDateColumn, DeleteDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Common audit + soft-delete columns. Does NOT declare `id` — primary key strategy/constraint
 * naming varies per table, so each entity declares its own `@PrimaryColumn`/`@PrimaryGeneratedColumn`.
 */
export abstract class AbstractEntity {
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'created_by', type: 'text', nullable: true })
  createdBy?: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'updated_by', type: 'text', nullable: true })
  updatedBy?: string;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date | null;
}
