const isDetaRuntime = () => process.env.DETA_RUNTIME === "true"; 

module.exports = { isDetaRuntime };