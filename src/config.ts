import * as path from "path";
const PROJECT_DIR = path.resolve(path.join(__dirname, ".."));
const ENV_PATH = path.join(PROJECT_DIR, ".env");

import dotenv from 'dotenv';
dotenv.config({path: ENV_PATH});

const UPLOADS_DIR = path.join(PROJECT_DIR, "uploads");

const PUBLIC_DIR = path.join(PROJECT_DIR, "public");
const HTML_RESULTS_DIR = path.join(PUBLIC_DIR, "html_results");

const AWS_HTTP_ENDPOINT = "https://harmonylang.dev"
const SERVICE_NAME = "harmonylang-server";
const SERVER_ORIGIN = "aws-ec2";


const FIREBASE_CREDENTIALS = {
    type: "service_account",
    project_id: "harmonylang-server",
    private_key_id: process.env.PRIVATE_KEY_ID ?? "",
    private_key: process.env.PRIVATE_KEY?.replace(/\\n/g, '\n') ?? "",
    client_email: process.env.CLIENT_EMAIL ?? "",
    client_id: process.env.CLIENT_ID ?? "",
    client_x509_cert_url: process.env.CLIENT_X509_CERT_URL ?? "",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
};


type NodeEnv = "production" | "staging" | "development";
const NODE_ENV: NodeEnv = (() => {
    const env = process.env.NODE_ENV?.toLowerCase()?.trim();
    if (env === 'production' || env === 'development' || env === 'staging') {
        return env;
    }
    return "development";
})();

const SUPPRESS_LOGS = process.env.SUPPRESS_LOGS != null && process.env.SUPPRESS_LOGS.trim().toLowerCase() === "true";

const HTTP_PORT = process.env.HTTP_PORT && Number.parseInt(process.env.HTTP_PORT) || 8080;

export default {
    PROJECT_DIR, ENV_PATH, UPLOADS_DIR,
    PUBLIC_DIR, HTML_RESULTS_DIR,
    AWS_HTTP_ENDPOINT, SERVICE_NAME,
    SERVER_ORIGIN, SUPPRESS_LOGS,
    FIREBASE_CREDENTIALS,
    HTTP_PORT,
    isProduction() {
        return NODE_ENV === 'production';
    },
    isStaging() {
        return NODE_ENV === 'staging';
    },
    isDevelopment() {
        return NODE_ENV === 'development';
    },
};
