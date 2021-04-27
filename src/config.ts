import * as path from "path";

const PROJECT_DIR = path.resolve(path.join(__dirname, ".."));
export const ENV_PATH = path.join(PROJECT_DIR, ".env");
export const UPLOADS_DIR = path.join(PROJECT_DIR, "uploads");

export const PUBLIC_DIR = path.join(PROJECT_DIR, "public");
export const HTML_RESULTS_DIR = path.join(PUBLIC_DIR, "html_results");

export const AWS_HTTP_ENDPOINT = "https://harmonylang.dev"
export const SERVICE_NAME = "harmonylang-server";
export const SERVER_ORIGIN = "aws-ec2";
