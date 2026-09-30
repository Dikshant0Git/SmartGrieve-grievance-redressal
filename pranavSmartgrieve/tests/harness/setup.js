const { connect, closeDatabase, clearDatabase } = require('./inMemoryDb');

// Increase timeout for MongoDB Memory Server download if needed
jest.setTimeout(60000);

/**
 * Connect to a new in-memory database before running any tests.
 */
beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test_secret_key';
    
    await connect();
});

/**
 * Clear all test data after every test.
 */
afterEach(async () => {
    await clearDatabase();
    jest.clearAllMocks();
});

/**
 * Remove and close the db and server.
 */
afterAll(async () => {
    await closeDatabase();
});
