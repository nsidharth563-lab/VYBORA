# Deployment (target: AWS)

Status: plan. Terraform modules are written in Phase 16.

| Component | Service |
|---|---|
| API (HTTP + WS) | ECS Fargate service behind ALB (sticky sessions not required — Socket.IO Redis adapter), AWS WAF |
| Workers | ECS Fargate services per queue group (media workers with FFmpeg image, larger CPU) |
| Database | RDS PostgreSQL 17, Multi-AZ, PITR backups, read replica at growth stage, RDS Proxy/PgBouncer |
| Cache/queues | ElastiCache Redis (separate clusters for cache and BullMQ at growth stage) |
| Media | S3 (`uploads` private, `media` private) + CloudFront with Origin Access Control; signed URLs for paid/private media |
| Secrets | AWS Secrets Manager → ECS task env |
| Admin | Vercel or ECS; restricted by staff auth + optional IP allow-list |
| Mobile | EAS Build & Submit; EAS Update for OTA JS updates |
| Observability | Sentry, PostHog, CloudWatch logs/metrics/alarms |

Environments: `local` → `staging` (prod-like, Stripe/Razorpay test mode) → `production`.
Migrations run as a one-off ECS task (`prisma migrate deploy`) before the new API version receives traffic.
