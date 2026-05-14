const Redis = require('ioredis');

/**
 * REDIS CONFIGURATION
 * 
 * Configures connection to Upstash Redis Cloud.
 * Automatically handles TLS for secure connections and BullMQ compatibility.
 */

const redisUrl = process.env.REDIS_URL;

const redisOptions = {
    maxRetriesPerRequest: null, // Required by BullMQ
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
            return true;
        }
        return false;
    }
};

// If using Upstash (usually starts with rediss:// for secure)
if (redisUrl && redisUrl.startsWith('rediss://')) {
    redisOptions.tls = {
        rejectUnauthorized: false // Often required for Upstash/managed Redis
    };
}

let redis;

try {
    if (redisUrl) {
        console.log('🔌 [REDIS] Initializing with connection string...');
        redis = new Redis(redisUrl, redisOptions);
    } else {
        // Fallback to local Memurai for development if URL is missing
        console.log('🔌 [REDIS] No REDIS_URL found. Falling back to local Memurai...');
        redis = new Redis({
            host: '127.0.0.1',
            port: 6379,
            ...redisOptions
        });
    }

    redis.on('connect', () => {
        console.log('✅ [REDIS] Connected to server.');
    });

    redis.on('error', (err) => {
        console.error('❌ [REDIS] Error:', err.message);
    });

} catch (error) {
    console.error('❌ [REDIS] Initialization failed:', error.message);
}

module.exports = redis;
