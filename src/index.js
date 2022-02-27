const Request = require('../lib/Request');

const makeRequest = (url) => new Request(url);

exports = makeRequest;
exports.Request = Request;
exports.default = makeRequest;
