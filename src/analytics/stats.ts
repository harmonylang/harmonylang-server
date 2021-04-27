import io from '@pm2/io';
import {MetricMeasurements} from "@pm2/io/build/main/services/metrics";
import Histogram from "@pm2/io/build/main/utils/metrics/histogram";

interface IStat {
    incr(n?: number): void;
    startTime(): void;
    endTime(): void;
    name(): string;
    id(): string;
    extend(newName: string, ...tags: string[]): IStat;
}

const activeStats: Record<string, IStat> = {}

function makeHistogram(name: string, metric: MetricMeasurements, ...tags: string[]) {
    return io.histogram({
        name: `${name}: ${metric}`,
        id: ["timer", metric, ...tags].join("."),
        measurement: metric
    });
}

function internalMakeStats(name: string, ...baseTags: string[]): IStat {
    const tags = baseTags.map(x => x.replace('.', '_'));
    const id = tags.join(".");
    const counter = io.counter({name, id: ["counter", ...tags].join("."), historic: true});
    const latencies: Record<string, Histogram> = {
        p75: makeHistogram(name, MetricMeasurements.p75, ...tags),
        p95: makeHistogram(name, MetricMeasurements.p95, ...tags),
        p99: makeHistogram(name, MetricMeasurements.p99, ...tags),
        p999: makeHistogram(name, MetricMeasurements.p999, ...tags),
        min: makeHistogram(name, MetricMeasurements.min, ...tags),
        mean: makeHistogram(name, MetricMeasurements.mean, ...tags),
        max: makeHistogram(name, MetricMeasurements.max, ...tags),
        median: makeHistogram(name, MetricMeasurements.median, ...tags),
    }
    const startTimes: Record<string, number> = {};

    const iStat = {
        extend(newName: string, ...newTags: string[]): IStat {
            return internalMakeStats(newName, ...baseTags, ...newTags);
        },
        incr(n?: number): void {
            counter.inc(n);
        },
        name(): string {
            return name;
        },
        id(): string {
            return id;
        },
        startTime(): void {
            Object.keys(latencies).forEach(metric => {
                startTimes[metric] = Date.now();
            });
        },
        endTime(): void {
            Object.entries(latencies).forEach(([metric, histogram]) => {
                if (startTimes[metric] != null) {
                    histogram.update(Date.now() - startTimes[metric]);
                    delete startTimes[metric];
                }
            });
        },
    }
    activeStats[id] = iStat;
    return iStat;
}

export function MakeStats(name: string, baseID: string, ...ext: string[]): IStat {
    return internalMakeStats(name, baseID, ...ext);
}

export function getActiveStats(): Readonly<Record<string, IStat>> {
    return activeStats;
}
