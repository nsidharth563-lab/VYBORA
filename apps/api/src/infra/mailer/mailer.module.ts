import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';
import { ConsoleMailer } from './console.mailer.js';
import { Mailer } from './mailer.js';
import { SmtpMailer } from './smtp.mailer.js';

@Global()
@Module({
  providers: [
    {
      provide: Mailer,
      inject: [APP_CONFIG],
      useFactory: (c: AppConfig) => (c.MAIL_PROVIDER === 'console' ? new ConsoleMailer() : new SmtpMailer(c)),
    },
  ],
  exports: [Mailer],
})
export class MailerModule {}
