const express = require('express');

const { isDetaRuntime, verifySignature } = require('./util');
const { EventHandler } = require('./event-handler');

// configuration
const config = {
    // size of fix cache cache
    cacheSize: parseInt(process.env.CACHE_SIZE),
    // size of commit history in days to check on installation
    historySize: parseInt(process.env.HISTORY_SIZE), 
    // name of branch to track fix merges on
    trackedBranch: process.env.TRACKED_BRANCH,
    // keywords for fix commit messages
    fixKeywords: process.env.FIX_KEY_WORDS.split(','),
    // paths to skip in the cache
    skipPaths: process.env.SKIP_PATHS.split(','),
};

// express app
const app = express();

// webhook events handler
const eventHandler = new EventHandler(config);

// middlewares
app.use(express.json()); // parse body as application/json
app.use(verifySignature); // verify signature with webhook secret

// webhook main handler
app.post('/', async (req, res) => {
    await eventHandler.handleEvent(req);
    return res.send('ok');
});

if (isDetaRuntime()){
    module.exports = app;
} else {
    app.listen(9000, () => {
        console.log('Local server, listening at port:9000')
    });
}