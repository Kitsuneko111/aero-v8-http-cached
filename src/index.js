const Request = require('../lib/Request');

const makeRequest = (url) => new Request(url);

module.exports = makeRequest;
module.exports.Request = Request;
module.exports.default = makeRequest;
