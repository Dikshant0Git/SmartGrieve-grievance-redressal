/**
 * Test Helper: In-Memory Database
 * 
 * Wraps mongodb-memory-server for test isolation.
 * Re-exports the existing harness with a stable API.
 */
const { connect, closeDatabase, clearDatabase } = require('../harness/inMemoryDb');

module.exports = { connect, closeDatabase, clearDatabase };
