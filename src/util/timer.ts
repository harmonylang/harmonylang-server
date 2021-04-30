
const timeouts: Record<number, NodeJS.Timeout> = {};
const intervals: Record<number, NodeJS.Timeout> = {};

const timer = {
    setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): number {
        const key = Math.max(...Object.keys(timeouts).map(x => Number.parseInt(x))) + 1;

        timeouts[key] = setTimeout((...args: any[]) => {
            callback(...args);
            delete timeouts[key];
        }, ms, ...args);

        return key;
    },
    setInterval(callback: (...args: any[]) => void, ms: number, ...args: any[]): number {
        const key = Math.max(...Object.keys(intervals).map(x => Number.parseInt(x))) + 1;

        intervals[key] = setInterval((...args: any[]) => {
            callback(...args);
        }, ms, ...args);

        return key;
    },
    clearTimeout(timeoutID: number): void {
        clearTimeout(timeoutID);
        delete timeouts[timeoutID];
    },
    clearInterval(intervalID: number): void {
        clearInterval(intervalID);
        delete intervals[intervalID];
    },
    clearAllTimeout() {
        Object.keys(timeouts).forEach(k => {
            const key = Number.parseInt(k)
            clearTimeout(timeouts[key]);
            delete timeouts[key];
        });
    },
    clearAllInterval() {
        Object.keys(intervals).forEach(k => {
            const key = Number.parseInt(k)
            clearTimeout(intervals[key]);
            delete intervals[key];
        });
    }
}
