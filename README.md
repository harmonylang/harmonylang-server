
# HarmonyLang-Server

A server that hosts the (C)Harmony compiler implemented in C, a successor to the Harmony compiler implemented in Python.

## Development Setup

Make sure you have Node installed. Clone the repository and run `yarn install`.

You can then start the server by running `yarn dev`.

## Runbook

### Monitoring

Realtime metrics are captured on [PM2](https://app.pm2.io/bucket/605decfab6830e2a2e6e0679/backend/metrics-histograms?filter=memory&server=ip-172-31-29-15.us-east-2.compute.internal-5634&app=app). Logging is being done on [Firebase](https://console.firebase.google.com/u/0/project/harmonylang-server/firestore/data~2Fharmonylang-logs).

### High CPU Usage
This can be deteted on the AWS monitor. Contact [Anthony](mailto:contact@anthonyyang.dev) if this becomes an issue.

### **Last Resort Fix**: Restarting the Server Instance

Stop the instance on the AWS Console. After it stops, start the instance.

On Google Domains, where the `harmonylang.dev` domain is hosted, go to DNS and route requests to <https://www.harmonylang.dev>, <https://api.harmonylang.dev>, and <https://harmonylang.dev> to the public IP address given in the AWS Console.

SSH into the EC2 Instance, and start docker via `sudo service docker start`, and start the service `pm2 start harmonylang-server/out/index.js --name app`.

## Making Requests

The production server is deployed via AWS EC2 on <https://api.harmonylang.dev>.

The server exposes the following API endpoints:
- `POST /check`
- `GET /download/:id`

### POST /check

`POST /check` accepts form-data in the following format to run a Harmony program.

| Key | Value | Type
| - | - | - |
| file | A zip file containing the Harmony code | `File` |
| main | The Harmony program entry filename, relative to the root of the zip. The value is a JSON stringified array, e.g. `'["path", "to", "main.hny"]'`, where each element is a path component | `string` |
| source | The source of the API request call, e.g. the IDE | `"vscode" \| "web-ide"` |
| version | The version of the source sending the request, e.g. the version in `package.json` | `string` |
| options | Any CLI flags to be passed to the Harmony compiler. Only the `-c/--const` and `-m/--module` flags are accepted. All other flags will trigger an error response. | `string` |

When the request is successful, the response contains a JSON body with the `status` for the request, and another related value.

The `status` value may be one of `FAILURE`, `INTERNAL`, `COMPLETED`, `ERROR`, `TIMEOUT`, or `OUT OF MEMORY`.

The `INTERNAL` status is returned when an error related to the Harmony compiler occurs.

If the `status` value is `COMPLETED`, the model check was successful and no issues were found. If the status value is `ERROR`, then an error occurred while running the model checker. For these two statuses, the response body contains a `message` that gives more details about those statuses.

The `TIMEOUT` and `OUT OF MEMORY` statuses occur when a Harmony program exceeds the allotted timeout or memory respectively during execution.

If the status value is `FAILURE`, then the model checker caught a failed invariant in the Harmony program, which could include a failed assertion or deadlock.
A response body with this `status` contains a `jsonData` value, which is the contents of the `charm.json` file produced by the (C)Harmony compiler.
This `jsonData` can then be used for further analysis in some other application.

### GET /download/:id

`GET /download/:id` downloads the HTML file generated from running the Harmony uploaded via `POST /check`, if an model check error occurred. The `/download/:id` path is a value in the response body of `POST /check` request (in the `staticHtmlLocation` field with a value like `"/download/<id>"` or `undefined` if no hTML file was generated). Related, the download link is only available for a certain period of time, indicated in the `duration` field with a `number` value representing time in milliseconds (this is usually about 5 minutes).


## Sample Client Code

The following sample code is in TypeScript. For JavaScript, just remove the type declarations/definitions.

```ts
export type CheckResponse = {
    status: "FAILURE";
    jsonData: Record<string, unknown>;
    staticHtmlLocation?: string;
    duration?: number;
} | {
    status: "ERROR" | "INTERNAL" | "COMPLETED" | "TIMEOUT" | "OUT OF MEMORY";
    message: string;
};

export async function makeCheckApiRequest(
    mainFile: string[],
    zipData: Blob,
    source: "vscode" | "web-ide",
    version: string,
    options: string,
): Promise<CheckResponse> {
    const formData = new FormData();
    formData.append("file", zipData, "files.zip");
    formData.append('main', JSON.stringify(mainFile));
    formData.append('version', version);
    formData.append('source', source);
    formData.append('options', options);

    const response = await fetch("https://api.harmonylang.dev/check", {
        method: "POST",
        body: formData
    });
    if (response.ok) {
        return await response.json();
    }
    return Promise.reject(new Error("Failed to make Check API request."))
}
```
