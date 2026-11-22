import { Injectable, Logger } from '@nestjs/common';
import { SmsSender } from './sms.js';

/** Development only (refused in production by config): logs SMS instead of sending. */
@Injectable()
export class ConsoleSms extends SmsSender {
  private readonly logger = new Logger('ConsoleSms');
  async send(to: string, body: string): Promise<void> {
    this.logger.log(`to=${to} ${body}`);
  }
}
