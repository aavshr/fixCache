const { FixCache } = require('./fix-cache');
const { repoDB, putItems } = require('./base');
const { appOctokit } = require('./client');

// label name for labeling pull requests
const FIX_CACHE_LABEL_NAME = 'Fix Cache Warning :warning:'; 
// label color
const FIX_CACHE_LABEL_COLOR = 'e3ff00';

class EventHandler{
    #fixCache;
    #githubClient;
    #handlers;
    #trackedBranch;
    #prLabel;

    constructor(config){
        if (isNaN(config.cacheSize)){
            throw Error(`Cache size is not a number ${cacheSize}`)
        }
        this.#fixCache = new FixCache(config.cacheSize, config.fixKeywords);
        this.#githubClient = appOctokit;
        this.#trackedBranch = config.trackedBranch;

        // label info
        this.#prLabel = {
            name: FIX_CACHE_LABEL_NAME,
            color: FIX_CACHE_LABEL_COLOR,
        };

        // maps events to handlers 
        this.#handlers = {
            "PushEvent": this.pushEventHandler,
            "PullRequestEvent": this.pullRequestEventHandler,
        };

    }

    async handleEvent(event){
        if (req.body.installation){
            return installationEventHanlder(event);
        }
        return this.#handlers[event.type](event)
    }

    async installationEventHandler(event){
        var repos = [];

        if (req.body.action === "created"){
            repos = req.body.repositories;
        } else if(req.body.action === "added"){
            repos = req.body.repositories_added;
        // if 'deleted' or 'removed' action
        } else {
            return Promise.resolve(null);
        }

        return this.setupRepos(repos);
    } 

    async setupRepos(repos){
        var repoItems = [];
        try{
            repos.forEach(async repo => {
                const owner = repo.full_name.split('/')[0] // full_name = owner/repo-name
                repoItems.push({
                    key: `${repoID}`, 
                    name: repo.name,
                    owner: owner,
                });
                // create a label in the repo for FixCache
                await this.#githubClient.issues.createLabel({
                    owner: owner,
                    repo: repo.name,
                    name: this.#prLabel.name, 
                    color: this.#prLabel.color,
                })
            });
            // add repo meta data information about the repos
            await putItems(repoDB, repoItems);
        } catch(err){
            return Promise.reject(err);
        }
        return Promise.resolve(null);
    }

    /*
    // initializes cache with files based on previous fix commits
    // if no previous fix commits present, then initializes
    // cache with largest files upto CACHE_SIZE
    async initCache(repoID){
        // TODO: if no fix history 
        // get largest files (but how do we know if largest files are actually code files?)
        
        const repoMeta = await repoDB.get(repoID);
        if (!repoMeta){
            return Promise.resolve(null);
        }
        //   TODO: should not list all commits
        //   either list commits since a date or tag
        //   should be configurable
        
        const commits = await this.githubClient.repos.listCommits({
           owner: repoMeta.owner,  
           repo: repoMeta.name,
        }) 
        // TODO: handle commits
        // for each commit with a fix message
        // get commit to get the file name
    }
    */

    async pushEventHanlder(event) {
        // check if push event is in the tracked branch 
        if (event.payload.ref !== `refs/heads/${this.#trackedBranch}`){
            return Promise.resolve(null);
        }

        var files = [];

        event.payload.commits.forEach(commit => {
           if (this.#fixCache.isFixMessage(commit.message)){
                // commit.changes = temporal, spatial and changed-entity locality
                // commit.added = new-entity locality
                files = files.concat(commit.changes, commit.added);
           } 
        })
        return this.#fixCache.updateCache(event.repo.id, files);
    } 

    async pullRequestEventHanlder(event){
        // check if pr is opened to be merged to the right branch
        if (event.payload.action != "opened" || event.payload.pull_request.base.ref !== this.#trackedBranch){
            return Promise.resolve(null);
        }

        // pull request body to update it later
        var prBody = event.payload.pull_request.body;

        try{
            // get repo metadata
            const repoMeta = await repoDB.get(event.repo.id);      
            if (!repoMeta){
                return Promise.reject("repo meta data not found in database") 
            }

            // get pull request files 
            // TODO: handle pagination
            const pullRequestFiles = await this.#githubClient.pulls.listFiles({
                owner: repoMeta.owner,
                repo: repoMeta.name,
                pull_number: event.payload.number,
            })

            // get current cache
            const currentCache = await this.#fixCache.getCurrentCache(event.repo.id);

            // update pull request with info about files updated in the PR 
            // if hits in the fix-cache 
            // TODO: add a label
            var cacheHit = false;
            prBody += "Following files updated in the PR are present in the fix-cache:"
            pullRequestFiles.forEach(file => {
                if (currentCache[file.filename]){
                    cacheHit = true;
                    prBody += `\n- \`${file.filename}\` : *${currentCache[file.filename]}* hits`;
                }
            })

            if (cacheHit){
                // update PR body with fix cache info
                await this.#githubClient.pulls.update({
                    owner: repooMeta.owner, 
                    repo: repoMeta.name,
                    pull_number: event.payload.number,
                    body: prBody, 
                });

                // add the fix cache label to the pr
                await this.#githubClient.issues.addLabels({
                    owner: repoMeta.owner,
                    repo: repoMeta.name,
                    issue_number: event.payload.number,
                    labels: {
                        // git recommends an object with labels key
                        labels: [this.#prLabel.name],
                    }
                }) 
            }
            return Promise.resolve(null);
        } catch(err){
            return Promise.reject(err);
        }
    }
}

module.exports = { EventHandler };