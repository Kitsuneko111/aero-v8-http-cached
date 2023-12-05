const path = require('path');
const undici = require('undici');
const { FormData, ProxyAgent, request: undiciRequest } = require('undici');
const qs = require('querystring');
const { URL, parse: urlParse } = require('url');
const { version } = require('../package');

const defaultRedirectCount = 21;
const seconds = 1000;

module.exports = class Request {

	constructor(url) {
		try {
			this.url = typeof url === 'string' ? new URL(url) : url;
		} catch {
			this.url = urlParse(url);
		}
		this.httpMethod = 'GET';
		this.data = null;
		this.sendDataAs = null;
		this.reqHeaders = {};
		this.streamEnabled = false;
		this.compressionEnabled = false;
		this.ua = `@aero.http/${version} (+https://npm.im/@aero/http) Node.js/${process.version.slice(1)} (+https://nodejs.org)`;
		this.coreOptions = {};

		this.timeoutDuration = 30 * seconds;

		this.redirectCount = defaultRedirectCount;
	}

	// OPTIONS

	query(a1, a2) {
		if (typeof a1 === 'object') {
			Object.keys(a1).forEach(queryKey => {
				this.url.searchParams.append(queryKey, a1[queryKey]);
			});
		}
		else
			this.url.searchParams.append(a1, a2);

		return this;
	}

	path(...relativePaths) {
		for (const relativePath of relativePaths)
			this.url.pathname = path.join(this.url.pathname, relativePath);

		return this;
	}

	body(data, sendAs) {
		this.sendDataAs = typeof data === 'object' && !sendAs && !Buffer.isBuffer(data) ? 'json' : sendAs ? sendAs.toLowerCase() : 'buffer';
		this.data = this.sendDataAs === 'form' ? qs.stringify(data) : this.sendDataAs === 'json' ? JSON.stringify(data) : data;

		if (sendAs === 'multipart') {
			const fd = new FormData();
			
			for (const key in data) {
				fd.append(key, data[key])
			}

			this.data = fd;
		}

		return this;
	}

	header(a1, a2) {
		if (typeof a1 === 'object') {
			Object.keys(a1).forEach(headerName => {
				this.reqHeaders[headerName.toLowerCase()] = a1[headerName];
			});
		}
		else
			this.reqHeaders[a1.toLowerCase()] = a2;

		return this;
	}

	timeout(timeout) {
		this.timeoutDuration = timeout * seconds;

		return this;
	}

	agent(...fragments) {
		this.ua = fragments.join(' ');

		return this;
	}

	options(a1, a2) {
		if (typeof a1 === 'object') {
			Object.keys(a1).forEach(option => {
				this.coreOptions[option] = a1[option];
			});
		}
		else
			this.coreOptions[a1] = a2;

		return this;
	}

	auth(token, type = 'Bearer') {
		/* eslint-disable-next-line dot-notation */
		if (type.toLowerCase() === 'basic')
			this.reqHeaders['authorization'] = `Basic ${Buffer.from(token).toString('base64')}`;
		else
			this.reqHeaders['authorization'] = type ? `${type} ${token}` : token;

		return this;
	}

	follow(countOrBool) {
		if (typeof countOrBool === 'number')
			this.redirectCount = countOrBool;

		else if (typeof countOrBool === 'boolean')
			if (countOrBool)
				this.redirectCount = defaultRedirectCount;
			else
				this.redirectCount = 0;

		return this;
	}

	proxy(uri, token) {
		const proxyAgent = new ProxyAgent({
			uri,
			token
		});

		this.options('dispatcher', proxyAgent);

		return this;
	}

	// HTTP METHODS

	method(method) {
		this.httpMethod = method;

		return this;
	}

	get() {
		return this.method('GET');
	}

	post() {
		return this.method('POST');
	}

	patch() {
		return this.method('PATCH');
	}

	put() {
		return this.method('PUT');
	}

	delete() {
		return this.method('DELETE');
	}

	// RESPONSE MODIFIERS

	json() {
		return this.send().then(res => res.body.json());
	}

	raw() {
		return this.send().then(res => res.body.arrayBuffer().then(Buffer.from));
	}

	text() {
		return this.send().then(res => res.body.text());
	}

	blob() {
		return this.send().then(res => res.body.blob());
	}

	send() {
		if (this.data) {
			if (!this.reqHeaders.hasOwnProperty('content-type')) {
				if (this.sendDataAs === 'json') this.reqHeaders['content-type'] = 'application/json';

				else if (this.sendDataAs === 'form') this.reqHeaders['content-type'] = 'application/x-www-form-urlencoded';
			}
		}

		this.header('user-agent', this.ua);

		const options = {
			body: this.data,
			method: this.httpMethod,
			headers: this.reqHeaders,
			bodyTimeout: this.timeoutDuration,
			maxRedirections: this.redirectCount,
			...this.coreOptions
		};

		const req = undiciRequest(this.url, options);

		return req;
	}

	then(...args) {
		return this.send().then(...args);
	}

	catch(...args) {
		return this.send().catch(...args);
	}

};
