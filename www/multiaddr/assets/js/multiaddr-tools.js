var $         = require('jquery');
var multiaddr = require('multiaddr');

function hexToBytes(hex)
{
	for (var bytes = [], c = 0; c < hex.length; c += 2)
	bytes.push(parseInt(hex.substr(c, 2), 16));
	return bytes;
}

function bytesToHex(bytes)
{
	for (var hex = [], i = 0; i < bytes.length; i++) {
		hex.push((bytes[i] >>> 4).toString(16));
		hex.push((bytes[i] & 0xF).toString(16));
	}
	return hex.join("");
}

function encodeMultiaddr(addr)
{
	return "0x" + bytesToHex(multiaddr(addr).buffer);
}

function decodeMultiaddr(hex)
{
	return multiaddr(Buffer.from(hexToBytes(hex.substr(2)))).toString();
}

$("#submit-encode").click(() => {
	$("#multiaddr-hex").val(encodeMultiaddr($("#multiaddr-addr").val()));
});

$("#submit-decode").click(() => {
	$("#multiaddr-addr").val(decodeMultiaddr($("#multiaddr-hex").val()));
});
