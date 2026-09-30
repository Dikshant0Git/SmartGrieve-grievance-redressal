/**
 * Fake Redis / BullMQ for testing without a real Redis instance.
 */
const EventEmitter = require('events');

class FakeQueue extends EventEmitter {
    constructor(name) {
        super();
        this.name = name;
        this.jobs = [];
    }
    
    async add(jobName, data, opts) {
        const job = { id: Date.now().toString(), name: jobName, data, opts };
        this.jobs.push(job);
        return job;
    }

    async getJob(jobId) {
        return this.jobs.find(j => j.id === jobId);
    }
}

const workers = new Map();

class FakeWorker extends EventEmitter {
    constructor(queueName, processor) {
        super();
        this.queueName = queueName;
        this.processor = processor;
        workers.set(queueName, this);
    }
    
    // Test helper to process a job synchronously in the test environment
    async simulateJobProcessing(job) {
        try {
            const result = await this.processor(job);
            this.emit('completed', job, result);
            return result;
        } catch (error) {
            this.emit('failed', job, error);
            throw error;
        }
    }
}

const getWorker = (queueName) => workers.get(queueName);

module.exports = {
    FakeQueue,
    FakeWorker,
    getWorker
};
