const { cacheDB, putItems } = require('./base.js');

class FixCache{
    #fileCache; // the file cache of probable bug files
    #cacheSize; // cache size
    #fixKeywords; // fix key words

    constructor(cacheSize, fixKeywords){
        this.#fileCache = cacheDB;
        this.cacheSize = cacheSize;
        this.#fixKeywords = fixKeywords;
    };

    /* initializes the file cache
    */
    async initCache(repoID, files){
        var newCache = [];
        files.forEach(file =>{
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
        const currentCache = this.#fileCache.fetch({"repo": repoID}, this.#cacheSize); 
        var cacheFiles = {};
        for await(const cacheItem of currentCache){
            cacheItem.forEach(item => {
                cacheFiles[item.file] = item.number_of_hits; 
            });
        }
        return Promise.resolve(cacheFiles); 
    }
   
    /* 
      updates cache with new files
      uses Least Recently Used (LRU) replacement method
    */
    async updateCache(repoID, files){
        if (files.length === 0) {
            return Promise.resolve(null);
        }
        // get current cache items from the database
        const asyncCurrentCache = this.#fileCache.fetch({"repo": repoID}, this.#cacheSize);

        var currentCache = [];
        for await (const values of asyncCurrentCache){
            values.forEach(value => {
                currentCache.push(value);
            });
        }

        // if cache is empty
        if (currentCache.length === 0){
            let newCache = {};
            files.forEach(file => {
                if (newCache[file]){
                    newCache[file]["last_hit"] = Date.now();
                    newCache[file]["number_of_hits"] +=1;
                } else{
                    newCache[file] = {
                        "repo": repoID,
                        "file": file,
                        "last_hit": Date.now(),
                        "number_of_hits":1,
                    }
                }
                // early stop if number of files is greater than cache size
                // TODO: better way of replacing files in this scneario
                // paper does not discuss a replacement policy in this scenario
                if (Object.keys(newCache).length === 25){
                    return;
                }
            });
            try {
                await putItems(this.#fileCache, Object.values(newCache));
                return Promise.resolve(null);
            } catch(err){
                return Promise.reject(err);
            }
        } 

        // sort cache by decreasing order by date of last hit 
        currentCache.sort((a, b) => {
            new Date(a.last_hit) > new Date(b.last_hit) ? 1 : -1;
        });

        // lookup table for improving complexity 
        var currentCacheLookupTable = {};
        currentCache.forEach(cacheItem => {
            currentCacheLookupTable[`${cacheItem.file}`] = cacheItem
        }) 

        // least recently used file index
        // init as last element as currentCache is sorted in decreasing order by date
        var leastHitIndex = currentCache.length-1;

        files.forEach(file => {
            // if already in cache, update cache item 
            if (currentCacheLookupTable[file]){
                currentCacheLookupTable[file].number_of_hits+=1;
                currentCacheLookupTable[file].last_hit = Date.now();
            } else{
                // add new file to cache
                currentCacheLookupTable[file] = {
                    "repo": repoID,
                    "file": file,
                    "last_hit": Date.now(),
                    "number_of_hits": 1,
                }
                // delete least recently hit file 
                // if number of cache items is already greater than cache size
                if (leastHitIndex > 0 && Object.keys(currentCacheLookupTable).length > this.#cacheSize){
                    const leastRecentlyHit = currentCache[leastHitIndex];
                    delete currentCacheLookupTable[leastRecentlyHit];
                    leastHitIndex--;
                    // early stop if there are no more files to replace but cache is already full
                    // TODO: think of a better way to handle this
                    // paper does not show a replacement policy for this scenario
                    if (leastHitIndex === 0 && Object.keys(currentCacheLookupTable).length === this.#cacheSize){
                        return;
                    }
                }
            }
        })

        // update the cache
        await putItems(this.#fileCache, Object.values(currentCacheLookupTable));
        return Promise.resolve(null);
    }

    isFixMessage(message){
        for (const keyword of this.#fixKeywords){
            if (message.toLowerCase().includes(keyword)){
                return true;
            }
        }
        return false; 
    }
}

module.exports = { FixCache };