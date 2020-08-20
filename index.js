const { isDetaRuntime } = require('./util.js');

// load .env if not running on DETA
if (!isDetaRuntime()){
    require('dotenv').config();
}


const { appOctokit } = require('./client.js');
const { repoDB, putItems } = require('./base.js');

const express = require('express');

// express app
const app = express();
app.use(express.json());

// webhook handler
app.post('/', async (req, res) => {
    if (!req.body.installation){
        res.send('ok');
        return;
    }

    var repos = [];

    if (req.body.action === "created"){
        repos = req.body.repositories;
    } else if(req.body.action === "added"){
        repos = req.body.repositoreis_added;
    // if 'deleted' or 'removed' action
    } else {
        res.send('ok');
        return;
    }

    var repoItems = [];
    repos.forEach(repo => {
        repoItems.push({
        key: `${repo.id}`, 
        name: repo.name,
        owner: repo.full_name.split('/')[0] // full_name = owner/repo-name
        });
    })
    
    await putItems(repoDB, repoItems);
    res.send('ok');
    return;
});

if (isDetaRuntime()){
    module.exports = app;
} else {
    app.listen(9000, () => {
        console.log('Local server, listening at port:9000')
    });
}