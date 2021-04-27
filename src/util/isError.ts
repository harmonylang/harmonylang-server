
export default function ifError(
    e: unknown,
    then: (e: Error) => void,
    otherwise?: (e: unknown) => void
): void {
    if (e instanceof Error) {
        then(e);
    } else if (otherwise) {
        otherwise(e);
    }
}


export function objectifyError(e: unknown): {
    errorMessage: string;
    errorName: string;
    stack: string;
    analysis: "complete";
    message: string,
} | {
    error: string;
    message: string;
    analysis: "partial"
} {
    if (e instanceof Error) {
        return {
            errorMessage: e.message,
            errorName: e.name,
            stack: e.stack ?? "",
            analysis: "complete",
            message: e.message
        };
    } else {
        const message = JSON.stringify(e) ?? "unknown";
        return {
            error: message,
            message: message,
            analysis: "partial",
        };
    }
}
