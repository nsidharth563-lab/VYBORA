import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, type Job, type Processor } from 'bullmq';
import { Redis } from 'ioredis';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';

export const QUEUES = { media: 'media' } as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/**
 * BullMQ queues on Redis. API instances enqueue; workers (node dist/worker.js,
 * or inline in dev/tests) process. Jobs are retried with exponential backoff.
 */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger('QueueService');
  private readonly queues = new Map<string, Queue>();
  private readonly workers: Worker[] = [];
  private readonly connections: Redis[] = [];

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  private connection(): Redis {
    // BullMQ requires maxRetriesPerRequest: null on its connections.
    const c = new Redis(this.config.REDIS_URL, { maxRetriesPerRequest: null, connectionName: 'vybora-queue' });
    c.on('error', (e: Error) => this.logger.warn(`queue redis: ${e.message}`));
    this.connections.push(c);
    return c;
  }

  queue(name: QueueName): Queue {
    let q = this.queues.get(name);
    if (!q) {
      q = new Queue(name, {
        connection: this.connection(),
        defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 1000, removeOnFail: 5000 },
      });
      this.queues.set(name, q);
    }
    return q;
  }

  /** Idempotent: the same jobId is only queued once. */
  async add<T extends object>(name: QueueName, jobName: string, data: T, jobId?: string): Promise<void> {
    await this.queue(name).add(jobName, data, jobId ? { jobId } : undefined);
  }

  startWorker<T>(name: QueueName, processor: Processor<T>, concurrency = 4): Worker<T> {
    const w = new Worker<T>(name, processor, { connection: this.connection(), concurrency });
    w.on('failed', (job: Job<T> | undefined, err: Error) => this.logger.error({ err, jobId: job?.id, queue: name }, 'job failed'));
    this.workers.push(w as Worker);
    return w;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled(this.workers.map((w) => w.close()));
    await Promise.allSettled([...this.queues.values()].map((q) => q.close()));
    for (const c of this.connections) c.disconnect();
  }
}
