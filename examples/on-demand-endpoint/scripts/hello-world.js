
const base64Encoder = library.load('abab')

function helloWorld({ parameters }) {
	const requestBody = base64Encoder.atob(parameters.requestBody)
	const requestObject = JSON.parse(requestBody)
	console.log(`Got requestBody=${requestBody}`)
	return new HttpResponse(200, [{ name: 'Content-Type', value: 'application/json' }], JSON.stringify({ result: `hello world result v2 query=${requestObject.query}` }));
}

class HttpResponse {
	constructor(statusCode, headers, body) {
		this.statusCode = statusCode;
		this.headers = headers;
		this.body = encode(body);
	}
}

function encode(result) {
	return base64Encoder.btoa(result);
}