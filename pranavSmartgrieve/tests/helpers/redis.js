/**
 * Test Helper: Fake Redis
 * 
 * Re-exports the existing fakeRedis harness for BullMQ mocking.
 * Also provides ioredis-mock for direct Redis client tests.
 */
const { FakeQueue, FakeWorker, getWorker } = require('../harness/fakeRedis');

module.exports = { FakeQueue, FakeWorker, getWorker };
