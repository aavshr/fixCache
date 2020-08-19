// load .env if not running on DETA
const isDetaRuntime = () => process.env.DETA_RUNTIME === "true"; 
if (!isDetaRuntime()){
    require('dotenv').config();
}

const { appOctokit } = require('./client.js');

const express = require('express');

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