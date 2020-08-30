const { FixCache } = require('./fix-cache');
const { repoDB, putItems } = require('./base');
const { newClient } = require('./client');

// label name for labeling pull requests
const FIX_CACHE_LABEL_NAME = 'Fix Cache Warning :warning:'; 
// label color
const FIX_CACHE_LABEL_COLOR = 'e00d0d';

class EventHandler{
    #fixCache;
    #handlers;
    #trackedBranch;
    #prLabel;
    #skipPaths;

    constructor(config){
        if (isNaN(config.cacheSize)){
            throw Error(`cache size is not a number ${cacheSize}`)
        }
        this.#fixCache = new FixCache(config.cacheSize, config.fixKeywords);
        this.#trackedBranch = config.trackedBranch;
        this.#skipPaths = config.skipPaths;

        // label info
        this.#prLabel = {
            name: FIX_CACHE_LABEL_NAME,
            color: FIX_CACHE_LABEL_COLOR,
        };

        // maps events to handlers 
        this.#handlers = {
            "installation": this.installationEventHandler.bind(this),
            "push": this.pushEventHandler.bind(this),
            "pull_request": this.pullRequestEventHandler.bind(this),
        };
    }

    handleEvent(event){
        const handler = this.#handlers[event.get('X-GitHub-Event')];
        if (handler){
            return handler(event.body);
        }
        return Promise.resolve(null);
    }

    installationEventHandler(event){
        var repos = [];

        if (event.action === "created"){
            repos = event.repositories;
        } else if(event.action === "added"){
            repos = event.repositories_added;
        // if 'deleted' or 'removed' action
        } else {
            return Promise.resolve(null);
        }

        return this.setupRepos(repos, event.installation.id);
    } 

    async setupRepos(repos, installationID){
        var repoItems = [];
        const client = newClient(installationID);
        try{
            repos.forEach(async repo => {
                const owner = repo.full_name.split('/')[0] // full_name = owner/repo-name
                repoItems.push({
                    key: `${repo.id}`, 
                    name: repo.name,
                    owner: owner,
                    installation_id: installationID,
                });
                // create a label in the repo for FixCache
                await client.issues.createLabel({
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

    // checks if path should be skipped
    isSkipPath(path) {
        this.#skipPaths.forEach(skipPath => {
            if (path.includes(skipPath)){
                return true
            }
        })
        return false
    }

    pushEventHandler(event) {
        // check if push event is in the tracked branch 
        if (event.ref !== `refs/heads/${this.#trackedBranch}`){
            return Promise.resolve(null);
        }

        var files = [];

        event.commits.forEach(commit => {
           if (this.#fixCache.isFixMessage(commit.message) && !this.isSkipPath()){
                // commit.modified= temporal, spatial and changed-entity locality
                // commit.added = new-entity locality
                commit.modified.forEach(file => {
                    if (!this.isSkipPath(file)){
                        files.push(file);
                    }
                })
                commit.added.forEach(file => {
                    if (!this.isSkipPath(file)){
                        files.push(file);
                    }
                })
           } 
        })
        return this.#fixCache.updateCache(event.repository.id, files);
    } 

    async pullRequestEventHandler(event){
        // check if pr is opened to be merged to the right branch
        if (event.action != "opened" || event.pull_request.base.ref !== this.#trackedBranch){
            return Promise.resolve(null);
        }

        try{
            // get repo metadata
            const repoMeta = await repoDB.get(`${event.repository.id}`);      
            if (!repoMeta){
                return Promise.reject("repo meta data not found in database") 
            }

            // get current cache
            const currentCache = await this.#fixCache.getCurrentCache(event.repository.id);
            var cacheHit = false;

            // get pull request files 
            // add comment to pull request with info about files updated in the PR
            // if hits in the fix-cache
            const client = newClient(repoMeta.installation_id);
            var commentBody = "Following files updated in the PR are present in the fix-cache:";
            
            // paginated
            client.paginate("GET /repos/:owner/:repo/pulls/:pull_number/files",{
                owner: repoMeta.owner,
                repo: repoMeta.name,
                pull_number: event.number,
            }).then((pullRequestFiles)=> {
                pullRequestFiles.data.forEach(file => {
                    if (currentCache[file.filename]){
                        cacheHit = true;
                        commentBody += `\n- \`${file.filename}\` : *${currentCache[file.filename]}* hits`;
                    }
                });
            });

            if (cacheHit){
                // add an issue comment with fix cache info
                client.issues.createComment({
                    owner: repoMeta.owner, 
                    repo: repoMeta.name,
                    issue_number: event.number,
                    body: commentBody, 
                });

                // add the fix cache label to the pr
                client.issues.addLabels({
                    owner: repoMeta.owner,
                    repo: repoMeta.name,
                    issue_number: event.number,
                    labels: [this.#prLabel.name],
                }) 
            }
            return Promise.resolve(null);
        } catch(err){
            return Promise.reject(err);
        }
    }
}

module.exports = { EventHandler };