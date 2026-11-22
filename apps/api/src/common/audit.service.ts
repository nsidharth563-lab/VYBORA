import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../infra/prisma/prisma.service.js';
import type { ClientContext } from './client-context.js';

/** Append-only security/audit trail. Never stores raw IPs, passwords, codes or tokens. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');
  constructor(private readonly prisma: PrismaService) {}

  async log(
    action: string,
    opts: { actorId?: string | null; actorType?: 'USER' | 'STAFF' | 'SYSTEM'; entityType?: string; entityId?: string; ctx?: ClientContext; metadata?: Prisma.InputJsonValue },
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          actorType: opts.actorType ?? (opts.actorId ? 'USER' : 'SYSTEM'),
          actorId: opts.actorId ?? null,
          entityType: opts.entityType,
          entityId: opts.entityId,
          ipHash: opts.ctx?.ipHash,
          requestId: opts.ctx?.requestId,
          metadata: opts.metadata,
        },
      });
    } catch (e) {
      // Auditing must never break the user flow; surface it in logs/Sentry instead.
      this.logger.error({ err: e, action }, 'audit write failed');
    }
  }
}
