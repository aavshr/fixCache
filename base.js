const { Deta } = require ('deta');

const deta = Deta(process.env.DETA_PROJECT_KEY);

/*
repoDB schema:
{
    "key": str, // repo id 
    "name": str, // repo name
    "owner": str, // repo owner
    "installation_id": int // installation id
}
*/
const repoDB = deta.Base('repos');

/*
cachedb schema:
{
    "key": str, // randomly generated
    "repo": int, // repo_id, foreign ref key in repoDB
    "file": str, // file name
    "last_hit": int // timestamp of last cache hit in epochs,
    "number_of_hits": int // number of cache hits
}
*/
const cacheDB = deta.Base('cache');

const putItems = async (db, items) => {
    const l = items.length;
    if (items.length <= 25) {
        return db.putMany(items);
    }
    // putMany op supports only 25 items max 
    // send in batches of 25 items if more than 25 items 
    let start = 0, end = 0;
    while(end != l){
        end += 25;
        if (end > l){
            end = l;
        }
        try {
            db.putMany(items.slice(start, end));
        } catch(err){
            return Promise.reject(err);
        }
        start = end;
    }
}

module.exports = { repoDB, cacheDB, putItems };