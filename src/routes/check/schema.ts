
export type CheckResponse = {
    jsonData: Record<string, unknown>;
    code: 200;
    status: "FAILURE";
    staticHtmlLocation?: string;
    duration?: number;
} | {
    status: "SUCCESS" | "ERROR" | "INTERNAL" | "COMPLETED" | "TIMEOUT" | "OUT OF MEMORY";
    code: 400 | 500 | 404 | 200;
    message: string;
};
