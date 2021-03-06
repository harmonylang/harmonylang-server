import events from 'events';

type Job = () => Promise<void>;

export interface JobQueueRunner {
    register(e: Job): void;
    wait(): Promise<void>;
}

/**
 * A queue runner for running multiple events at some limit.
 * This works because Node runs a single thread at a time in the event loop.
 * @param maxInParallel
 */
export function BuildJobQueueRunner(maxInParallel: number): JobQueueRunner {
    let runningProcesses = 0;
    const maximum = Math.max(maxInParallel, 1);
    const queue: Job[] = [];
    const waiting: (() => void)[] = [];
    const eventEmitter = new events.EventEmitter({captureRejections: true});

    eventEmitter.on("run-next", async () => {
        if (runningProcesses < maximum) {
            const event = queue.shift();
            if (event) {
                runningProcesses++;
                await event();
                eventEmitter.emit("complete");
            }
        }
    });
    eventEmitter.on("complete", async () => {
        runningProcesses--;
        if (queue.length === 0) {
            waiting.forEach(w => w());
            waiting.length = 0;
        }
        eventEmitter.emit("run-next");
    });
    const register = (event: Job) => {
        queue.push(event);
        eventEmitter.emit("run-next");
    }
    const wait = async (): Promise<void> => {
        return new Promise(resolve => {
            if (queue.length === 0) {
                resolve();
            }
            waiting.push(resolve);
        })
    }
    return {register, wait};
}
