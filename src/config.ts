import * as path from "path";

const PROJECT_DIR = path.resolve(path.join(__dirname, ".."));
export const UPLOADS_DIR = path.join(PROJECT_DIR, "uploads");
export const HARMONY_DIR = path.join(PROJECT_DIR, "harmony-master");

export const PUBLIC_DIR = path.join(PROJECT_DIR, "public");
export const HTML_RESULTS_DIR = path.join(PUBLIC_DIR, "html_results");

export const AWS_HTTP_ENDPOINT = "http://ec2-3-142-239-249.us-east-2.compute.amazonaws.com:8080"
