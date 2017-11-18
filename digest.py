#!/usr/bin/python

import os
import hashlib

NONCE_LENGTH = 16

class hash:
	def _hash(data, nonce): return hashlib.sha256(data+nonce).hexdigest()
	def raw  (data, nonce): return hash._hash(data,                    nonce)
	def str  (data, nonce): return hash._hash(data.encode(),           nonce)
	def file (data, nonce): return hash._hash(open(data, 'rb').read(), nonce)

class digest:
	def __init__(self, content, nonce=None, split="://"):
		if split not in content: raise ValueError
		self.content          = content
		self.type, self.value = content.split(split,1)
		self.nonce            = os.urandom(NONCE_LENGTH) if nonce is None else nonce
	def voteHash(self): return getattr(hash, self.type)(data=self.value, nonce=b""       )
	def signHash(self): return getattr(hash, self.type)(data=self.value, nonce=self.nonce)
	def privHash(self): return hash._hash              (data=b"",        nonce=self.nonce)

class contribution:
	def __init__(self, vote, sign, priv):
		self.vote = vote
		self.sign = sign
		self.priv = priv
	def make(content):
		dg = digest(content)
		tx = contribution(vote=dg.voteHash(), sign=dg.signHash(), priv=dg.privHash())
		return tx, dg.nonce
	def check(self, content, nonce):
		dg = digest(content, nonce)
		return self.vote == dg.voteHash() \
		   and self.sign == dg.signHash() \
		   and self.priv == dg.privHash()
	def __repr__(self):
		return "vote: %s\nsign: %s\npriv: %s" % (self.vote, self.sign, self.priv)




if __name__ == '__main__':

	content1 = "file:///home/amxx/todl.txt"
	content2 = "file:///home/amxx/todl2.txt"

	tx, nonce = contribution.make(content1)
	valid     = tx.check(content2, nonce)

	print(tx)
	print(nonce)
	print(valid)

	pass
