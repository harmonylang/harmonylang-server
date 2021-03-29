
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
} | {error: string} {
    return e instanceof Error ? {
        errorMessage: e.message,
        errorName: e.name,
        stack: e.stack ?? "",
    } : {error: JSON.stringify(e) ?? "unknown"};
}
