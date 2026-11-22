import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';
import { QueueService } from '../../infra/queue/queue.service.js';
import { MediaService } from './media.service.js';

/** Consumes the `media` queue. Starts inline in dev/tests; in production via dist/worker.js. */
@Injectable()
export class MediaWorker implements OnApplicationBootstrap {
  private readonly logger = new Logger('MediaWorker');
  private started = false;

  constructor(
    private readonly queues: QueueService,
    private readonly media: MediaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.MEDIA_WORKER_INLINE) this.start();
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.queues.startWorker<{ mediaId: string }>('media', async (job) => this.media.process(job.data.mediaId), 4);
    this.logger.log('media worker started');
  }
}
