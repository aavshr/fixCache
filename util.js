const crypto = require('crypto');

const isDetaRuntime = () => process.env.DETA_RUNTIME === "true"; 

// load .env if not running on DETA
if (!isDetaRuntime()){
    require('dotenv').config();
}

const verifySignature = (req, res, next) => {
    // needs 'express.json()' middleware to stringify
    const payload = JSON.stringify(req.body);

    const secret = process.env.WEBHOOK_SECRET;
    
    const signature = 'sha1=' + crypto.createHmac('sha1', secret).update(payload).digest('hex');

    if (signature !== req.get('X-Hub-Signature')){
        return res.sendStatus(401);
    }
    next();
};

module.exports = { verifySignature, isDetaRuntime };