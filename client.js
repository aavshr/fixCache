const { App } = require("@octokit/app");
const { request } = require("@octokit/request");
const { readFile, writeFile } = require("fs");
const { PassThrough } = require("stream");

const JWT_TOKEN_PATH = process.env.JWT_TOKEN_PATH

class GithubAPIClient {
    #jwt; 

    constructor(appID, privateKey){
        const app = new App({id: appID, privateKey:privateKey});

        // load jwt token from local file if stored
        readFile(JWT_TOKEN_PATH, (err, data) => {
            if (err){
                // get new token if any error
                this.#jwt = app.getSignedJsonWebToken();
                // save to path
                writeFile(JWT_TOKEN_PATH, this.#jwt, (err) => {return});
            } else {
                this.#jwt = data.toString();
            }
        })
    }

    authHeaders(){
        return {
            authorization: `Bearer ${this.#jwt}`,
            accept: "application/vnd.github.machine-man-preview+json",
        } 
    }
}

module.exports = { GithubAPIClient };