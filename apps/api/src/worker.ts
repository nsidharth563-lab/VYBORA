import './instrument.js';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { createPino, PinoNestLogger } from './common/logger.js';
import { ConfigError, loadConfig } from './config/config.js';
import { MediaWorker } from './modules/media/media.worker.js';

/**
 * Background worker entrypoint (no HTTP server). Scale separately from the API:
 *   node dist/worker.js
 */
let config;
try {
  config = loadConfig({ ...process.env, MEDIA_WORKER_INLINE: 'false' });
} catch (e) {
  if (e instanceof ConfigError) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}
const logger = createPino(config);
const app = await NestFactory.createApplicationContext(AppModule.forRoot(config), { logger: new PinoNestLogger(logger) });
app.enableShutdownHooks();
app.get(MediaWorker).start();
logger.info('VYBORA worker running (queues: media)');
