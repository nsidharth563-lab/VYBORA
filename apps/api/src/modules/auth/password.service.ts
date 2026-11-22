import { createHash } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { AppException } from '../../common/api-exception.filter.js';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';

// argon2id, OWASP 2024 baseline: m=19 MiB, t=2, p=1 (also the library defaults).
const OPTS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class PasswordService {
  private readonly logger = new Logger('PasswordService');
  /** Verified against when the account doesn't exist, so response time doesn't reveal it. */
  private dummyHash: Promise<string>;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject('FETCH') private readonly fetchImpl: typeof fetch,
  ) {
    this.dummyHash = hash('vybora-timing-equalizer', OPTS);
  }

  hash(password: string): Promise<string> {
    return hash(password, OPTS);
  }

  async verify(passwordHash: string | null | undefined, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash ?? (await this.dummyHash), password);
    } catch {
      return false;
    }
  }

  /**
   * Rejects passwords seen in public breaches (Have I Been Pwned, k-anonymity:
   * only the first 5 hex chars of the SHA-1 leave the server). Fail-open on
   * network errors so an outage there never blocks sign-ups.
   */
  async assertNotBreached(password: string): Promise<void> {
    if (!this.config.PWNED_PASSWORD_CHECK) return;
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
    const [prefix, suffix] = [sha1.slice(0, 5), sha1.slice(5)];
    try {
      const res = await this.fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true', 'user-agent': 'vybora-api' },
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) return;
      const body = await res.text();
      const hit = body.split('\n').some((line) => {
        const [s, count] = line.trim().split(':');
        return s === suffix && Number(count) > 0;
      });
      if (hit) {
        throw new AppException(HttpStatus.BAD_REQUEST, 'PASSWORD_BREACHED', 'This password has appeared in a data breach. Please choose another.');
      }
    } catch (e) {
      if (e instanceof AppException) throw e;
      this.logger.warn(`breach check skipped: ${(e as Error).message}`);
    }
  }
}
