
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

The server is deployed via Heroku on <https://harmonylang.herokuapp.com>. Alternatively, the server can be deployed locally using the instructions in the above section.

The server exposes one API endpoint `POST /check`, which accepts form-data containing a zip file of the Harmony files, and the name to the start of the Harmony program.

The `FormData` contains two fields: `file` and `main`. The value of `file` is a read stream of a zip file that contains the Harmony files. The value of `main` is the filepath name to the starting Harmony file, relative to the root of the zipped content.

An example of a request made via Postman:

![](images/postman-headers.png)

![](images/postman-formdata.png)

When the request is successful, the response contains a JSON body with the status value for the request, and another related value.

The `status` value may be one of `SUCCESS`, `FAILURE`, or `ERROR`.

If the `status` value is `SUCCESS`, the model check was successful and no issues were found. If the status value is `ERROR`, then an error occurred while running the model checker. For these two statuses, the response body contains a `message` that gives more details about those statuses.

If the status value is `FAILURE`, then the model checker caught a failed invariant in the Harmony program, which could include a failed assertion or deadlock.
A response body with this `status` contains a `jsonBody` value, which is the contents of the `charm.json` file produced by the (C)Harmony compiler.
This `jsonBody` can then be used for further analysis in some other application.
