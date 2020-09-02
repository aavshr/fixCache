const { FixCache } = require('./fix-cache');
const { repoDB, putItems } = require('./base');
const { newClient } = require('./client');

// label name for labeling pull requests
const FIX_CACHE_LABEL_NAME = 'fix cache'; 
// label color
const FIX_CACHE_LABEL_COLOR = 'ff4500';

class EventHandler{
    // file cache
    #fixCache;

    #historySize;
    #trackedBranch;
    #skipPaths;

    // handler functions
    #handlers;

    // pull request label
    #prLabel;

    constructor(config){
        if (isNaN(config.cacheSize)){
            throw Error(`cache size is not a number ${config.cacheSize}`)
        }
        if (isNaN(config.historySize)){
            throw Error(`history size is not a number ${config.historySize}`)
        }
        this.#fixCache = new FixCache(config.cacheSize, config.fixKeywords);
        this.#trackedBranch = config.trackedBranch;
        this.#skipPaths = config.skipPaths;
        this.#historySize = config.historySize;

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

    async handleEvent(event){
        const handler = this.#handlers[event.get('X-GitHub-Event')];
        if (handler){
            await handler(event.body);
            return Promise.resolve(null); 
        }
    }

    async installationEventHandler(event){
        var repos = [];

        if (event.action === "created"){
            repos = event.repositories;
        } else if(event.action === "added"){
            repos = event.repositories_added;
        // if 'deleted' or 'removed' action
        } else {
            return Promise.resolve(null);
        }
        await this.setupRepos(repos, event.installation.id);
        return Promise.resolve(null);
    } 

    async setupRepos(repos, installationID){
        var repoItems = [];
        const client = newClient(installationID);

        for(const repo of repos){
            const owner = repo.full_name.split('/')[0]; // full_name = owner/repo-name
            const repoMeta = {
                key: `${repo.id}`, 
                name: repo.name,
                owner: owner,
                installation_id: installationID,
            };
            repoItems.push(repoMeta);
            // create a label in the repo for FixCache
            await client.issues.createLabel({
                owner: owner,
                repo: repo.name,
                name: this.#prLabel.name, 
                color: this.#prLabel.color,
            })

            await this.initCache(client, repoMeta);
        }
        // add repo meta data information about the repos
        await putItems(repoDB, repoItems);
        return Promise.resolve(null);
    }

    // checks if path should be skipped
    isSkipPath(path) {
        this.#skipPaths.forEach(skipPath => {
            if (path.includes(skipPath)){
                return true
            }
        })
        return false
    }

   // get files from a commit object
    getFilesFromCommit(commit){
        var files = [];
        if (this.#fixCache.isFixMessage(commit.message, true)){
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
        return files;
    } 

    // substracts historySize from current date
    // returns date in iso 8601 format
    dateFromHistorySize(historySize){
        var since = new Date();
        since.setDate(since.getDate() - historySize)
        return since.toISOString();
    }

    // gets fix commit refs
    async getFixCommitRefs(client, repoMeta){
        // list commits since date based on history size 
        var commitRefs = [];
        const commits = await client.paginate("GET /repos/:owner/:repo/commits", {
            owner: repoMeta.owner,  
            repo: repoMeta.name,
            sha: this.#trackedBranch,
            since: this.dateFromHistorySize(this.#historySize), 
        });
        commits.forEach(commit => {
            const msg = commit.commit.message;
            // ignore commits if not fix commits or if merges
            if (!this.#fixCache.isFixMessage(msg, true)){
                return;
            }
            commitRefs.push(commit.sha);
        })
        return Promise.resolve(commitRefs);
    }

    // gets files from commit refs
    async getFilesFromCommitRefs(client, repoMeta, commitRefs){
        // get files modified/added in commits
        var files = [];
        for (const commitRef of commitRefs){
            const commit = await client.repos.getCommit({
                owner: repoMeta.owner,
                repo: repoMeta.name,
                ref: commitRef,
            }); 
            commit.data.files.forEach(file => {
                // do nothing if file was deleted or is a skip path 
                if (this.isSkipPath(file.filename) || file.status === "deleted"){
                    return
                }
                // if status is added or changed
                files.push(file.filename); 
            })
        }
        return Promise.resolve(files);
    }

    // initializes cache with files based on previous fix commits

    // TODO: if no previous fix commits present, then initialize
    //       cache with largest files upto CACHE_SIZE
    async initCache(client, repoMeta){
        const commitRefs = await this.getFixCommitRefs(client, repoMeta); 
        const files = await this.getFilesFromCommitRefs(client, repoMeta, commitRefs);
        return this.#fixCache.updateCache(parseInt(repoMeta.key), files);
    }

    async pushEventHandler(event) {
        // check if push event is in the tracked branch 
        if (event.ref !== `refs/heads/${this.#trackedBranch}`){
            return Promise.resolve(null);
        }

        var files = [];
        event.commits.forEach(commit => {
            files = files.concat(this.getFilesFromCommit(commit));  
        })
        return this.#fixCache.updateCache(event.repository.id, files);
    } 

    async pullRequestEventHandler(event){
        // check if pr is opened to be merged to the right branch
        if (event.action !== "opened" || event.pull_request.base.ref !== this.#trackedBranch){
            return Promise.resolve(null);
        }

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
        const pullRequestFiles = await client.paginate("GET /repos/:owner/:repo/pulls/:pull_number/files",{
            owner: repoMeta.owner,
            repo: repoMeta.name,
            pull_number: event.number,
        });

        for (const file of pullRequestFiles){
            if (currentCache[file.filename]){
                cacheHit = true;
                commentBody += `\n- \`${file.filename}\` : *${currentCache[file.filename]}* hits`;
            }
        }

        if (cacheHit){
            // add an issue comment with fix cache info
            await client.issues.createComment({
                owner: repoMeta.owner, 
                repo: repoMeta.name,
                issue_number: event.number,
                body: commentBody, 
            });

            // add the fix cache label to the pr
            await client.issues.addLabels({
                owner: repoMeta.owner,
                repo: repoMeta.name,
                issue_number: event.number,
                labels: [this.#prLabel.name],
            }) 
        }
        return Promise.resolve(null);
    }
}

module.exports = { EventHandler };