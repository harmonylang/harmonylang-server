import events from 'events';

type Event = () => Promise<void>;

/**
 * A queue runner for running multiple events at some limit.
 * This works because Node runs a single thread at a time in the event loop.
 * @param maxInParallel
 */
function BuilderQueueRunner(maxInParallel: number) {
    let runningProcesses = 0;
    const queue: Event[] = [];
    const eventEmitter = new events.EventEmitter({captureRejections: true});

    eventEmitter.on("run-next", async () => {
        const event = queue.pop();
        if (event && runningProcesses <= maxInParallel) {
            runningProcesses++;
            await event();
            eventEmitter.emit("complete");
        }
    });
    eventEmitter.on("complete", async () => {
        runningProcesses--;
        eventEmitter.emit("run-next");
    });

    function register(event: Event): void {
        queue.push(event);
        eventEmitter.emit("run-next");
    }
    return {register};
}

