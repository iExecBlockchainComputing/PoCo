var multiaddr = require('multiaddr')

function hexToBytes(hex) {
	for (var bytes = [], c = 0; c < hex.length; c += 2)
	bytes.push(parseInt(hex.substr(c, 2), 16));
	return bytes;
}

function bytesToHex(bytes) {
	for (var hex = [], i = 0; i < bytes.length; i++) {
		hex.push((bytes[i] >>> 4).toString(16));
		hex.push((bytes[i] & 0xF).toString(16));
	}
	return hex.join("");
}

function encodeMultiaddr(multiaddr)
{
	return "0x" + bytesToHex(multiaddr(multiaddr).buffer);
}

function decodeMultiaddr(hex)
{
	return multiaddr(hexToBytes(hex.substr(2))).toString();
}
