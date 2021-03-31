
export type CheckResponse = {
    jsonData: Record<string, unknown>;
    code: 200;
    status: "FAILURE";
    staticHtmlLocation?: string;
    duration?: number;
} | {
    status: "SUCCESS" | "ERROR" | "INTERNAL" | "COMPLETED";
    code: 400 | 500 | 404 | 200;
    message: string;
};
