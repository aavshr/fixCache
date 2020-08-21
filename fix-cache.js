const { cacheDB, putItems } = require('./base.js');

class FixCache{
    #fileCache; // the file cache of probable bug files
    #cacheSize; // cache size

    constructor(cacheSize){
        this.#repoMeta = repoDB;
        this.#fileCache = cacheDB;
        this.#cacheSize = cacheSize;
    };

    /* initializes the file cache
    */
    async initCache(repoID, files){
        var newCache = [];
        files.foreach(file =>{
            newCache.Push({
                "repo": repoID,
                "file": file,
                "last_hit": Date.now(),
                "number_of_hits": 1,
            });
        });
        await this.#fileCache.putItems(newCache);
        return Promise.resolve(null);
    }

    /* gets the current file cache
       returns objects with {"file_name": number of hits}
    */
    async getCurrentCache(repoID){
        const currentCache = await this.#fileCache.fetch(({"repo": repoID}, limit=this.#cacheSize)); 
        var cacheFiles = {};
        currentCache.foreach(cacheItem => {
           cacheFiles[cacheItem.file] = cacheItem.number_of_hits; 
        })
        return Promise.resolve(cacheFiles); 
    }
   
    /* 
      updates cache with new files
      uses Least Recently Used (LRU) replacement method
    */
    async updateCache(repoID, files){
        // get current cache items from the database
        const currentCache = await this.#fileCache.fetch({"repo": repoID}, limit=this.#cacheSize);

        // sort cache by last hit
        currentCache.sort((a, b) => {
            new Date(a.last_hit) > new Date(b.last_hit) ? 1 : -1;
        });

        // least recently used file index
        var leastHitIndex = currentCache().length-1;

        // file lookup table for improving complexity 
        var fileLookupTable = {};
        currentCache.foreach(cacheItem => {
            fileLookupTable[`${cacheItem.file}`] = cacheItem
        }) 

        files.foreach(file => {
            // if already seen, update cache params
            if (fileLookupTable[file]){
                fileLookupTable[file].number_of_hits+=1;
                fileLookupTable[file].last_hit = Date.now();
            } else{
                // else delete least recently hit file 
                // and add new file to cache
                leastRecentlyHit = currentCache[leastHitIndex];
                delete fileLookupTable[leastRecentlyHit];
                fileLookupTable[file] = {
                    "repo": repoID,
                    "file": file,
                    "last_hit": Date.now(),
                    "number_of_hits": 1,
                }
                // update hit index 
                lastHitIndex--;
            }
        })

        // update the cache
        var newCache = [];
        for (var key of Object.keys(fileLookupTable)){
            newCache.push(fileLookupTable[key])
        }
        await putItems(this.#fileCache, newCache);
        return Promise.resolve(null);
    }
}

module.exports = { FixCache };