import {makeCollection, RecordableObject} from "./firebase";
import config from "../config";

const firestoreLogs = makeCollection("harmonylang-logs");

export type HarmonyLogger = {
    INFO(message: string, kv?: RecordableObject): void,
    WARN(message: string, kv?: RecordableObject): void
    ERROR(message: string, kv?: RecordableObject): void
    WITH(kv: RecordableObject): HarmonyLogger
}

function makeLogger(kv?: RecordableObject): HarmonyLogger {
    const keyValues = Object.assign({}, kv);
    function makeBody(level: string, message: string, kv?: RecordableObject) {
        return {
            ...keyValues,
            ...kv || {},
            service: config.SERVICE_NAME,
            server: config.SERVER_ORIGIN,
            timestamp: new Date(),
            message,
            level,
        }
    }
    return {
        INFO(message: string, kv?: RecordableObject) {
            firestoreLogs.add(makeBody("INFO", message, kv));
        },
        WARN(message: string, kv?: RecordableObject) {
            firestoreLogs.add(makeBody("WARN", message, kv));
        },
        ERROR(message: string, kv?: RecordableObject) {
            firestoreLogs.add(makeBody("ERROR", message, kv));
        },
        WITH(kv: RecordableObject) {
            return makeLogger({...keyValues, ...kv});
        }
    }
}

export const logClient = makeLogger();

export const silentLogClient: HarmonyLogger = {
    ERROR(): void {},
    INFO(): void {},
    WARN(): void {},
    WITH(): HarmonyLogger {return this}
}
