const { isDetaRuntime } = require('./util.js');
const { Deta } = require ('deta');

const deta = isDetaRuntime()? Deta(): Deta(process.env.DETA_PROJECT_KEY);

/*
repoDB schema:
{
    "key": str, // repo id 
    "name": str, // repo name
    "owner": str, // repo owner
    "tracked-branch": str, //main branch
    "fix-commit-convention": str, // (TBD) 
}
*/
const repoDB = deta.Base('repos');

/*
cachedb schema:
{
    "key": str, // randomly generated
    "repo": str, // repo_id, foreign ref key in repoDB
    "file": str, // file name
    "last-hit": str // timestamp of last cache hit in rfc3339 format UTC,
    "number-of-hits": int // number of cache hits
}
*/
const cacheDB = deta.Base('cache');

const putItems = async (db, items) => {
    if (items.length <= 25) {
        return db.putMany(items);
    }
    // for now
    throw Error('more than 25 items');
}

module.exports = { repoDB, cacheDB, putItems };