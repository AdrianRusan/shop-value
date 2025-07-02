import { Queue } from 'bullmq';
import { redisConnection } from './queue';
import type { AlertJobData } from './alert-worker';

// Lazy alert queue initialization
let alertQueueInstance: Queue<AlertJobData> | null = null;

export const alertQueue = {
  get instance(): Queue<AlertJobData> {
    if (!alertQueueInstance) {
      alertQueueInstance = new Queue<AlertJobData>('price-alerts', {
        connection: redisConnection(),
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 25,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      });
    }
    return alertQueueInstance;
  },
  
  async add(name: string, data: AlertJobData, options?: any) {
    return this.instance.add(name, data, options);
  },
  
  async close() {
    if (alertQueueInstance) {
      await alertQueueInstance.close();
      alertQueueInstance = null;
    }
  }
};

export default alertQueue;