import {CheckResponse} from "./schema";

export async function makeCheckApiRequest(
    mainFile: string[] | string,
    zipData: Blob,
    source: "vscode" | "web-ide",
    version: string
): Promise<CheckResponse> {
    const formData = new FormData();
    formData.append("file", zipData, "files.zip");
    formData.append('main', Array.isArray(mainFile) ? JSON.stringify(mainFile) : mainFile);
    formData.append('version', version);
    formData.append('source', source);

    const response = await fetch("https://api.harmonylang.dev/check", {
        method: "POST",
        body: formData
    });
    if (response.ok) {
        return await response.json();
    }
    return Promise.reject(new Error("Failed to make Check API request."))
}
