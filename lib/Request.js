const path = require('path');
let undici = null;
try {
	undici = require('undici');
} catch {}
const qs = require('querystring');
const { URL } = require('url');
const { version } = require('../package');

const defaultRedirectCount = 21;
const seconds = 1000;

const redirectHeaders = [301, 302, 303, 307, 308];

module.exports = class Request {
	static cache = new Map();
	static defaultTTL = 30000

	static queue = [];
	static maxRequests = 100;
	static perMilliseconds = 10000;
	static current = 0;

	static resetTimer = setInterval(() => {
		Request.current = 0;
		while( Request.queue.length > 0 && Request.current < Request.maxRequests) {
			const { resolve, reject, fn } = Request.queue.shift();
			fn().then(resolve).catch(reject);
			Request.current++;
		}
		if(Request.current === Request.maxRequests && Request.queue.length > 0) {
			console.warn(`Request queue is still full, ${Request.queue.length} requests are waiting to be processed.`);
		}
	}, Request.perMilliseconds);

	constructor(url) {
		this.url = typeof url === 'string' ? new URL(url) : url;
		this.httpMethod = 'GET';
		this.data = null;
		this.sendDataAs = null;
		this.reqHeaders = {};
		this.streamEnabled = false;
		this.compressionEnabled = false;
		this.ua = `@kitsuneko.cached-http/${version} (+https://npm.im/@kitsuneko/cached-http) Node.js/${process.version.slice(1)} (+https://nodejs.org)`;
		this.coreOptions = {};
		this.ttl = null;
		this.bypass = false;

		this.timeoutDuration = 30 * seconds;

		this.redirectCount = defaultRedirectCount;

		this.requestAdapter = typeof fetch === 'function'
			? 'fetch'
			: 'undici';

		if (this.requestAdapter === 'undici' && !undici)
			throw new Error('undici is not installed, and native fetch is not available, no remaining request adapters');
	}

	// CACHE
	cache(ttl) { this.ttl = ttl || Request.defaultTTL; return this; }
	noCache() { this.bypass = true; return this; }
	bypassCache = () => this.noCache();
	ignoreCache = () => this.noCache(); 
	force = () => this.noCache();
	static clearCache() {
		this.cache.clear();
	}

	_getKey() {
		return JSON.stringify({
			url: this.url.toString(),
			method: this.httpMethod,
			body: this.data || {},
			headers: this.reqHeaders
		});
	}

	// OPTIONS

	query(a1, a2) {
		if (a1 instanceof Map || Array.isArray(a1)) {
			for (const [key, value] of a1) {
				this.url.searchParams.append(key, value);
			}
		}
		else if (typeof a1 === 'object') {
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
			const FD = typeof FormData === 'function' ? FormData : undici?.FormData;
			const fd = new FD();
			
			for (const key in data) {
				fd.append(key, data[key])
			}

			this.data = fd;
		}

		return this;
	}

	header(a1, a2) {
		if (a1 instanceof Map || Array.isArray(a1)) {
			for (const [key, value] of a1) {
				this.reqHeaders[key.toLowerCase()] = value;
			}
		}
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

	auth(token, type = 'Bearer', key = "authorization") {
		/* eslint-disable-next-line dot-notation */
		if (type.toLowerCase() === 'basic')
			this.reqHeaders[key] = `Basic ${Buffer.from(token).toString('base64')}`;
		else
			this.reqHeaders[key] = type ? `${type} ${token}` : token;

		return this;
	}

	follow(countOrBool) {
		if (typeof countOrBool === 'number') {
			this.redirectCount = countOrBool;
		}

		else if (typeof countOrBool === 'boolean')
			if (countOrBool)
				this.redirectCount = defaultRedirectCount;
			else
				this.redirectCount = 0;

		return this;
	}

	proxy(uri, token) {
		if (this.requestAdapter !== 'undici')
			throw new Error('Proxying is only supported with the undici adapter');

		const { ProxyAgent } = undici;

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

	_body() {
		return this.send().then(res =>
			this.requestAdapter === 'undici'
				? res.body
				: res
		);
	}

	json() {
		return this._body().then(res => res.json());
	}

	raw() {
		return this._body().then(res => res.arrayBuffer().then(Buffer.from));
	}

	text() {
		return this._body().then(res => res.text());
	}

	blob() {
		return this._body().then(res => res.blob());
	}

	// ADAPTERS

	adapter(adapter) {
		this.requestAdapter = adapter;

		return this;
	}

	undici() {
		return this.adapter('undici');
	}

	fetch() {
		return this.adapter('fetch');
	}

	native() {
		return this.adapter('fetch');
	}

	// SEND

	send() {
		// Cache handling

		
		return new Promise((resolve, reject) => {
			const executeRequest = () => {
				const key = this._getKey();
				if (!this.bypass && Request.cache.has(key)) {
					const entry = Request.cache.get(key);
					if (entry && Date.now() < entry.expiry) {
						return resolve(entry.response);
					}
				}

				const promise = this._sendRequest();

				promise.then(res => Request.cache.set(key, {
					response: res,
					expiry: Date.now() + (this.ttl ?? Request.defaultTTL)
				}))

				return promise;
			};

			if (Request.current < Request.maxRequests) {
				Request.current++;
				executeRequest()
					.then(resolve)
					.catch(reject);
			} else {
				Request.queue.push({ resolve, reject, executeRequest });
			}
		})
	}

	then(...args) {
		return this.send().then(...args);
	}

	catch(...args) {
		return this.send().catch(...args);
	}

	_sendRequest() {
		if (this.data) {
			if (!this.reqHeaders.hasOwnProperty('content-type')) {
				if (this.sendDataAs === 'json') this.reqHeaders['content-type'] = 'application/json';

				else if (this.sendDataAs === 'form') this.reqHeaders['content-type'] = 'application/x-www-form-urlencoded';
			}
		}

		this.header('user-agent', this.ua);

		// use native fetch if exists
		switch (this.requestAdapter) {
			case 'fetch':
				return fetchRequest(this.url, this.redirectCount, this.timeoutDuration, {
					body: this.data,
					method: this.httpMethod,
					headers: this.reqHeaders,
					...this.coreOptions
				}).then(res => proxyHeaders(res));
				break;
			case 'undici':
				return undici.request(this.url, {
					body: this.data,
					method: this.httpMethod,
					headers: this.reqHeaders,
					bodyTimeout: this.timeoutDuration,
					maxRedirections: this.redirectCount,
					...this.coreOptions
				});
				break;
			default:
				throw new Error('Invalid request adapter');
		}
	}
}

function fetchRequest(url, redirectCount, timeoutDuration, options) {
	const timeoutController = new AbortController();
	const timeout = setTimeout(() => timeoutController.abort(), timeoutDuration);

	return fetch(url, {
		signal: timeoutController.signal,
		redirect: 'manual',
		...options
	})
	.then(res => {
		if (redirectHeaders.includes(res.status)) {
			url = new URL(res.headers.get('location'), url);

			if (redirectCount > 0)
				return fetchRequest(url, redirectCount - 1, timeoutDuration, options);
			else
				return res;
		}
		else
			return res;
	})
	.finally(() => {
		clearTimeout(timeout)
	});
}

// use Proxy() to turn headers[x] to headers.get(x)
function proxyHeaders(res) {
	return new Proxy(res, {
		get(target, prop) {
			if (prop === 'headers') {
				const bannedProps = Object.getOwnPropertyNames(Object.getPrototypeOf(target.headers));
				return new Proxy(target.headers, {
					get(target, prop) {
						if (bannedProps.includes(prop) || typeof prop !== 'string')
							return target[prop];
						else
							return target.get(prop);
					}
				});
			}
			else
				return target[prop];
		}
	});
}