import { Injectable, Logger } from '@nestjs/common';
import { Mailer, type MailMessage } from './mailer.js';

/** Development only (refused in production by config): logs emails instead of sending. */
@Injectable()
export class ConsoleMailer extends Mailer {
  private readonly logger = new Logger('ConsoleMailer');
  async send(m: MailMessage): Promise<void> {
    this.logger.log(`to=${m.to} subject="${m.subject}"\n${m.text}`);
  }
}
