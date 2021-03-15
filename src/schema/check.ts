export type CheckRequest = {
    main?: string;
    version?: string;
    source?: string;
}

export type CheckResponse = {
    status: "SUCCESS" | "ERROR" | "INTERNAL";
    message: string;
} | {
    status: "FAILURE";
    jsonData: Record<string, unknown>;
    staticHtmlLocation?: string;
    duration?: number;
};
