const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

/**
 * Connect to the in-memory database.
 */
const connect = async () => {
    // Prevent Mongoose from using strictQuery warning
    mongoose.set('strictQuery', false);
    
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    await mongoose.connect(uri);
};

/**
 * Drop database, close the connection and stop mongod.
 */
const closeDatabase = async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
    }
    if (mongoServer) {
        await mongoServer.stop();
    }
};

/**
 * Remove all the data for all db collections.
 */
const clearDatabase = async () => {
    const collections = mongoose.connection.collections;

    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
    }
};

module.exports = {
    connect,
    closeDatabase,
    clearDatabase
};
