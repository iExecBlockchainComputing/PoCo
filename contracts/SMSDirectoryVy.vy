# contract OwnableImmutable():
# 	def m_owner() -> address: static

m_entries: map(address, bytes32)

@public
def getSMS(_ressource: address) -> bytes32:
	return self.m_entries[_ressource]

@public
def setSMS(_ressource: address, _sms: bytes32):
	assert _ressource == msg.sender #or _ressource.m_owner() == msg.sender
	self.m_entries[_ressource] = _sms
