/**
 * Schema smoke test: exercises core relations and constraints against a real
 * PostgreSQL database (DATABASE_URL). Runs inside a transaction that is rolled
 * back, so it leaves no data behind.
 *   pnpm --filter @vybora/api test:db
 */
import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

class Rollback extends Error {}

test('core social, messaging and ledger relations', async () => {
  await assert.rejects(
    prisma.$transaction(async (tx) => {
      const ana = await tx.user.create({ data: { username: 'ana.test', displayName: 'Ana' } });
      const raj = await tx.user.create({
        data: { username: 'raj.test', displayName: 'Raj', isPrivate: true },
      });
      assert.match(ana.id, /^[0-9a-f]{8}-[0-9a-f]{4}-7/, 'ids are UUIDv7');

      // Follow request to private account.
      await tx.follow.create({
        data: { followerId: ana.id, followingId: raj.id, status: 'PENDING' },
      });

      // Photo post with media, hashtag, like, threaded comment.
      const media = await tx.mediaAsset.create({
        data: {
          ownerId: raj.id,
          kind: 'IMAGE',
          storageKey: `u/${raj.id}/a.jpg`,
          mimeType: 'image/jpeg',
          status: 'READY',
        },
      });
      const tag = await tx.hashtag.create({ data: { name: 'sunset' } });
      const post = await tx.post.create({
        data: {
          authorId: raj.id,
          type: 'PHOTO',
          caption: 'Hello #sunset',
          media: { create: { mediaId: media.id, position: 0, altText: 'Sunset over sea' } },
          hashtags: { create: { hashtagId: tag.id } },
        },
      });
      await tx.postLike.create({ data: { userId: ana.id, postId: post.id } });
      const c = await tx.comment.create({
        data: { postId: post.id, authorId: ana.id, body: 'Wow' },
      });
      await tx.comment.create({
        data: { postId: post.id, authorId: raj.id, parentId: c.id, body: 'Thanks!' },
      });

      // Story with poll sticker + view.
      const story = await tx.story.create({
        data: {
          authorId: raj.id,
          type: 'TEXT',
          textContent: { text: 'Pick one' },
          expiresAt: new Date(Date.now() + 864e5),
          stickers: {
            create: { type: 'POLL', layout: { x: 0.5, y: 0.5 }, data: { options: ['A', 'B'] } },
          },
        },
        include: { stickers: true },
      });
      await tx.storyView.create({ data: { storyId: story.id, viewerId: ana.id } });
      await tx.stickerResponse.create({
        data: { stickerId: story.stickers[0]!.id, userId: ana.id, optionIndex: 1 },
      });

      // DM with idempotent clientMessageId.
      const convo = await tx.conversation.create({
        data: {
          type: 'DIRECT',
          directKey: [ana.id, raj.id].sort().join(':'),
          members: { create: [{ userId: ana.id }, { userId: raj.id, isRequest: true }] },
        },
      });
      await tx.message.create({
        data: {
          conversationId: convo.id,
          senderId: ana.id,
          clientMessageId: 'c1',
          type: 'TEXT',
          body: 'hi',
        },
      });

      // Double-entry ledger for a tip: debits == credits.
      const pay = await tx.payment.create({
        data: {
          payerId: ana.id,
          recipientId: raj.id,
          kind: 'TIP',
          provider: 'STRIPE',
          providerPaymentId: 'pi_test_1',
          amountMinor: 50000,
          currency: 'INR',
          idempotencyKey: 'k1',
          status: 'SUCCEEDED',
        },
      });
      const clearing = await tx.ledgerAccount.create({
        data: { type: 'PROVIDER_CLEARING', currency: 'INR' },
      });
      const creator = await tx.ledgerAccount.create({
        data: { type: 'CREATOR_PENDING', ownerUserId: raj.id, currency: 'INR' },
      });
      const platform = await tx.ledgerAccount.create({
        data: { type: 'PLATFORM_REVENUE', currency: 'INR' },
      });
      const txId = '0190a000-0000-7000-8000-000000000001';
      await tx.ledgerEntry.createMany({
        data: [
          {
            transactionId: txId,
            accountId: clearing.id,
            direction: 'DEBIT',
            amountMinor: 50000,
            currency: 'INR',
            paymentId: pay.id,
            description: 'tip',
          },
          {
            transactionId: txId,
            accountId: creator.id,
            direction: 'CREDIT',
            amountMinor: 40000,
            currency: 'INR',
            paymentId: pay.id,
            description: 'tip net',
          },
          {
            transactionId: txId,
            accountId: platform.id,
            direction: 'CREDIT',
            amountMinor: 10000,
            currency: 'INR',
            paymentId: pay.id,
            description: 'fee',
          },
        ],
      });

      // Reads back with relations.
      const full = await tx.post.findUniqueOrThrow({
        where: { id: post.id },
        include: {
          media: true,
          hashtags: { include: { hashtag: true } },
          likes: true,
          comments: { include: { replies: true } },
        },
      });
      assert.equal(full.media.length, 1);
      assert.equal(full.hashtags[0]!.hashtag.name, 'sunset');
      assert.equal(full.likes.length, 1);
      assert.equal(full.comments.find((x) => x.parentId === null)!.replies.length, 1);

      const sums = await tx.ledgerEntry.groupBy({
        by: ['direction'],
        where: { transactionId: txId },
        _sum: { amountMinor: true },
      });
      const debit = sums.find((s) => s.direction === 'DEBIT')!._sum.amountMinor;
      const credit = sums.find((s) => s.direction === 'CREDIT')!._sum.amountMinor;
      assert.equal(debit, credit, 'ledger transaction balances');

      // Same clientMessageId from same sender is rejected (idempotency).
      await assert.rejects(
        tx.message.create({
          data: {
            conversationId: convo.id,
            senderId: ana.id,
            clientMessageId: 'c1',
            type: 'TEXT',
            body: 'dup',
          },
        }),
      );
      throw new Rollback();
    }),
    Rollback,
  );

  assert.equal(
    await prisma.user.count({ where: { username: { in: ['ana.test', 'raj.test'] } } }),
    0,
    'rolled back',
  );
  await prisma.$disconnect();
});
