// load .env if not running on DETA
const isDetaRuntime = () => process.env.DETA_RUNTIME === "true"; 
if (!isDetaRuntime()){
    require('dotenv').config();
}

const express = require('express');
const { GithubAPIClient } = require('./client.js');
const { readFileSync } = require('fs');

const PRIVATE_KEY_PATH = process.env.PRIVATE_KEY_PATH;
const GITHUB_APP_ID = process.env.GITHUB_APP_ID;

// github api client
const githubClient = new GithubAPIClient(GITHUB_APP_ID, readFileSync(PRIVATE_KEY_PATH));

// express app
const app = express();

// webhook handler
app.post('/', (req, res) => {
    console.log(req.body);
    res.send('ok');
});

if (process.env.DETA_RUNTIME === "true"){
    module.exports = app;
} else {
    app.listen(9000, () => {
        console.log('Local server, listening at port:9000')
    });
}


