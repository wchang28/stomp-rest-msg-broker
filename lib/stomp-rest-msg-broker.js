var url = require('url');

var DEFAULT_HTTP_PORT = 80;
var DEFAULT_HTTPS_PORT = 443;

function getDefaultPort(protocol) {return (protocol === 'https' ? DEFAULT_HTTPS_PORT : DEFAULT_HTTP_PORT);}

// parse destination url into protocol, http options and destination(queue/topic/dsub)
function parseDestinationUrl(destinationUrl) {
	if (typeof destinationUrl !== 'string' || destinationUrl.length == 0) throw "routed message has no destination url";
	var parts = url.parse(destinationUrl);
	var protocol = parts['protocol'];
	protocol = protocol.substr(0, protocol.length - 1);
	var options =
	{
		hostname: parts['hostname']
		,port: (parts['port'] ? parts['port'] : getDefaultPort(protocol))
		,path: parts['path']
	};
	if (typeof parts['auth'] === 'string' && parts['auth'].length > 0) options['auth'] = parts['auth'];
	var path = parts['path'];
	var destination = null;
	var x = path.indexOf('/queue/');
	if (x != -1)
		destination = path.substr(x);
	else {
		x = path.indexOf('/topic/');
		if (x != -1)
			destination = path.substr(x);
		else {
			x = path.indexOf('/dsub/');
			if (x != -1) destination = path.substr(x);
		}
	}
	return {protocol: protocol, options: options, destination: destination};
}

var DEFAULT_HOSTNAME = "127.0.0.1";

function makeDestinationUrl(protocol, options) {
	if (typeof protocol !== 'string' || protocol.length == 0) protocol = 'http';
	if (!options) options = {"hostname": DEFAULT_HOSTNAME};
	if (typeof options["hostname"] !== 'string' || options["hostname"].length == 0) options["hostname"] = DEFAULT_HOSTNAME;
	var s = protocol;
	s += "://"
	if (typeof options["auth"] === 'string' && options["auth"].length > 0) s += options["auth"] + "@"
	s += options["hostname"];
	s += ":";
	s += (options["port"] ? options["port"] : getDefaultPort(protocol)).toString();
	s += (typeof options["path"] === 'string' && options["path"].length > 0 ? options["path"] : '/');
	return s;
}

function StompRESTMsgBroker() {
	this.send = function(destination, headers, message, onDone) {
		if (!destination) throw "no destination specified";
		var destinationUrl = (typeof destination === 'string' ? destination : destination.destination);
		if (typeof destinationUrl !== 'string' || destinationUrl.length == 0) throw "no destination specified";
		var pd = parseDestinationUrl(destinationUrl);
		var additionalOptions = (typeof destination === 'string' ? null : destination.additionalOptions);
		if (!additionalOptions) additionalOptions = null;
		var options = pd.options;
		options.method = "POST";
		if (!options.headers) options.headers = {};
		options.headers['Content-Type'] = 'application/json';
		if (additionalOptions) {
			for (var fld in additionalOptions)
				options[fld] = additionalOptions[fld];
		}
		var httpModule = require(pd.protocol);
		var req = httpModule.request(options, function(res) {
			res.setEncoding('utf8');
			var s = "";
			res.on('data', function(d) {
				s += d;
			});
			res.on('end', function() {
				try {
					if (res.statusCode != 200) throw "http returns status code of " + res.statusCode;
					var o = JSON.parse(s);
					if (o.exception) throw o.exception;
					if (typeof onDone === 'function') onDone(null, o.receipt_id);
				} catch(e) {
					if (typeof onDone === 'function') onDone(e, null);
				}
			});
		});
		req.on('error', function(err) {
			if (typeof onDone === 'function') onDone(err, null);
		});
		var o = {message: message};
		if (headers) o.headers = headers;
		req.end(JSON.stringify(o));
	};
}

// static functions
StompRESTMsgBroker.parseDestinationUrl = parseDestinationUrl;
StompRESTMsgBroker.makeDestinationUrl = makeDestinationUrl;

module.exports = StompRESTMsgBroker;