#!/usr/bin/python

import ipfsapi
import binascii
import hashlib
import os
import sys
from urllib.parse import urlparse

SALT_LENGTH = 256

# ============================== HASHING METHODS ==============================

class hash:
	def _raw(data, salt):
		vote = hashlib.sha256(     data).hexdigest()
		sign = hashlib.sha256(salt+data).hexdigest()
		return contribution(vote=vote, sign=sign)

	def _file(path, salt):
		vote = hashlib.sha256()
		sign = hashlib.sha256()
		sign.update(salt)
		with open(path, 'rb') as f:
			while True:
				buf = f.read(65536) # block size
				if not buf:
					break
				vote.update(buf)
				sign.update(buf)
		return contribution(vote=vote.hexdigest(), sign=sign.hexdigest())

	# FORMAT: str:xxxxxx
	def str(uri, salt):
		return hash._raw(data=uri.geturl()[4:].encode(), salt=salt)

	# FORMAT: file://xxxxxx
	def file(uri, salt):
		return hash._file(path=uri.geturl()[7:], salt=salt)

	# FORMAT: ipfs://xxxx(:xxxx)/xxxxxxxxxxx (host, port, hash)
	def ipfs(uri, salt):
		host = uri.hostname if uri.hostname else "localhost"
		port = uri.port     if uri.port     else 5001
		path = uri.path[1:]
		api  = ipfsapi.connect(host=host, port=port)
		# Large File - Download, hash, remove
		if True:
			api.get(path)
			result = hash._file(path, salt=salt)
			os.remove(path)
		# Small File - Download, hash, remove
		else:
			result = hash._raw(data=api.cat(path), salt=salt) # SMALL FILES
		return result

# =============================================================================

class contribution:
	def __init__(self, vote, sign):
		self.vote = vote
		self.sign = sign

	def verify(self, content, salt):
		return self == digest(content, salt).getContribution()

	def __eq__(self,other):
		return self.vote == other.vote \
		   and self.sign == other.sign

	def __ne__(self,other):
		return not self == other

	def __repr__(self):
		return "vote: %s\nsign: %s" % (self.vote, self.sign)

# =============================================================================

class digest:
	def __init__(self, uri, salt=None, split="://"):
		self.uri = urlparse(uri)
		if   type(salt) is bytes : self.salt = salt
		elif type(salt) is str   : self.salt = binascii.unhexlify(salt)
		elif salt       is None  : self.salt = os.urandom(SALT_LENGTH)
		else                     : raise ValueError

	def hexSalt(self):
		return binascii.hexlify(self.salt).decode()

	def getContribution(self):
		return getattr(hash, self.uri.scheme)(uri=self.uri, salt=self.salt)

# =============================================================================

class UI:
	def test_start(name):
		sys.stdout.write("Testing `%s`: " % name)
	def test_stop(result):
		if result:
			sys.stdout.write("success\n")
		else:
			sys.stdout.write("faillure\n")
			exit(1)


if __name__ == '__main__':

	# -------------------------------- FILE TEST --------------------------------
	if True:
		UI.test_start("Simple filesystem")
		file_1 = "file:///home/amxx/todl.txt"
		file_2 = "file://../../../todl.txt"
		dg     = digest(file_1)
		tx     = dg.getContribution()
		salt   = dg.hexSalt()
		valid  = tx.verify(file_2, salt)
		# print(tx)
		# print(salt)
		# print(valid)
		UI.test_stop(valid)

	# -------------------------------- IPFS TEST --------------------------------
	if True:
		UI.test_start("IPFS filesystem")
		ipfs   = "ipfs://localhost/QmWHggpsJiYsidE7je7rEyrGKegy7pfW8sKCeVixJKvwQy"
		file   = "file:///home/amxx/todl.txt"
		dg     = digest(ipfs)
		tx     = dg.getContribution()
		salt   = dg.hexSalt()
		valid  = tx.verify(file, salt)
		# print(tx)
		# print(salt)
		# print(valid)
		UI.test_stop(valid)


