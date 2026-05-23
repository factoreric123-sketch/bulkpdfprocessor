// Worker pool for managing multiple Web Workers
import { logger } from '../logger';

interface WorkerTask {
  id: string;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timeout?: NodeJS.Timeout;
}

export class WorkerPool {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private taskQueue: Array<{ message: any; task: WorkerTask }> = [];
  private activeTasks = new Map<Worker, WorkerTask>();
  private workerPath: string;
  private maxWorkers: number;
  private taskTimeout: number;

  constructor(workerPath: string, maxWorkers: number = navigator.hardwareConcurrency || 4, taskTimeout: number = 30000) {
    this.workerPath = workerPath;
    this.maxWorkers = Math.min(maxWorkers, 8); // Cap at 8 workers
    this.taskTimeout = taskTimeout;
    this.initializeWorkers();
  }

  private initializeWorkers() {
    for (let i = 0; i < this.maxWorkers; i++) {
      this.createWorker();
    }
  }

  private createWorker() {
    try {
      const worker = new Worker(this.workerPath, { type: 'module' });
      
      worker.addEventListener('message', (event) => {
        const task = this.activeTasks.get(worker);
        if (task) {
          if (task.timeout) {
            clearTimeout(task.timeout);
          }
          
          this.activeTasks.delete(worker);
          
          if (event.data.success) {
            task.resolve(event.data.result);
          } else {
            task.reject(new Error(event.data.error || 'Worker error'));
          }
          
          this.releaseWorker(worker);
        }
      });

      worker.addEventListener('error', (error) => {
        logger.error('Worker error:', error);
        const task = this.activeTasks.get(worker);
        if (task) {
          if (task.timeout) {
            clearTimeout(task.timeout);
          }
          task.reject(new Error('Worker crashed'));
          this.activeTasks.delete(worker);
        }
        
        // Replace crashed worker
        this.workers = this.workers.filter(w => w !== worker);
        this.availableWorkers = this.availableWorkers.filter(w => w !== worker);
        worker.terminate();
        this.createWorker();
      });

      this.workers.push(worker);
      this.availableWorkers.push(worker);
    } catch (error) {
      logger.error('Failed to create worker:', error);
    }
  }

  async execute<T>(message: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const task: WorkerTask = {
        id: message.id || crypto.randomUUID(),
        resolve,
        reject,
      };

      const worker = this.getAvailableWorker();
      if (worker) {
        this.executeTask(worker, message, task);
      } else {
        this.taskQueue.push({ message, task });
      }
    });
  }

  private getAvailableWorker(): Worker | null {
    return this.availableWorkers.shift() || null;
  }

  private executeTask(worker: Worker, message: any, task: WorkerTask) {
    this.activeTasks.set(worker, task);
    
    // Set timeout
    task.timeout = setTimeout(() => {
      this.activeTasks.delete(worker);
      task.reject(new Error('Task timeout'));
      
      // Terminate and recreate worker
      const index = this.workers.indexOf(worker);
      if (index !== -1) {
        worker.terminate();
        this.workers.splice(index, 1);
        this.createWorker();
      }
    }, this.taskTimeout);
    
    worker.postMessage(message);
  }

  private releaseWorker(worker: Worker) {
    // Process next task in queue if any
    const nextTask = this.taskQueue.shift();
    if (nextTask) {
      this.executeTask(worker, nextTask.message, nextTask.task);
    } else {
      this.availableWorkers.push(worker);
    }
  }

  terminate() {
    // Clear all timeouts
    for (const task of this.activeTasks.values()) {
      if (task.timeout) {
        clearTimeout(task.timeout);
      }
    }
    
    // Terminate all workers
    for (const worker of this.workers) {
      worker.terminate();
    }
    
    // Reject all pending tasks
    for (const task of this.activeTasks.values()) {
      task.reject(new Error('Worker pool terminated'));
    }
    
    for (const { task } of this.taskQueue) {
      task.reject(new Error('Worker pool terminated'));
    }
    
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
    this.activeTasks.clear();
  }

  getStats() {
    return {
      totalWorkers: this.workers.length,
      availableWorkers: this.availableWorkers.length,
      activeTasks: this.activeTasks.size,
      queuedTasks: this.taskQueue.length,
    };
  }
}

// Singleton instance
let workerPool: WorkerPool | null = null;

export function getWorkerPool(): WorkerPool {
  if (!workerPool) {
    // Create worker pool with path to the worker script
    workerPool = new WorkerPool(
      new URL('./pdfWorker.ts', import.meta.url).href
    );
  }
  return workerPool;
}

export function terminateWorkerPool() {
  if (workerPool) {
    workerPool.terminate();
    workerPool = null;
  }
}