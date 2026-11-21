import 'reflect-metadata';
import 'dotenv/config';

// Deterministic defaults so tests run with only DATABASE_URL / REDIS_URL set.
process.env.NODE_ENV ??= 'test';
process.env.LOG_LEVEL ??= 'silent';
