const { Octokit } = require("@octokit/rest");
const { createAppAuth } = require("@octokit/auth-app");
const { readFileSync } = require('fs');
const { retry } = require("@octokit/plugin-retry");
const { throttling } = require("@octokit/plugin-throttling");

const PRIVATE_KEY_PATH = process.env.PRIVATE_KEY_PATH;
const GITHUB_APP_ID = process.env.GITHUB_APP_ID;

const readPrivateKey = () => {
    return readFileSync(PRIVATE_KEY_PATH);
};

const AppOctokit = Octokit.plugin(retry, throttling);
const appOctokit = new AppOctokit({
    authStrategy: createAppAuth,
    auth: {
        id: GITHUB_APP_ID,
        privateKey: readPrivateKey(),     
    },
    userAgent: 'fixCache v0.0.1',
    throttle: {
        onRateLimit: (retryAfter, options) => {
            appOctokit.log.warn(
                `Request quota exhausted for request ${options.method} ${options.url}`,
            );

            if (options.request.retryCount == 0){
                appOctokit.log.info(`Retrying after ${retryAfter} seconds!`);
                return true;
            }
        },
        onAbuseLimit: (retryAfter, options) => {
        // does not retry, only logs a warning
            myOctokit.log.warn(
                `Abuse detected for request ${options.method} ${options.url}`
            );
        },
    },
    retry: {
        // do not retry on 429 (too many requests) response from api
        doNotRetry: ["429"],
    },
});

module.exports = { appOctokit };