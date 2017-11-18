#!/usr/bin/python

import os
import hashlib


class hash:
	def _hash(data, nonce): return hashlib.sha256(data+nonce).hexdigest()
	def raw  (data, nonce): return hash._hash(data,                    nonce)
	def str  (data, nonce): return hash._hash(data.encode(),           nonce)
	def file (data, nonce): return hash._hash(open(data, 'rb').read(), nonce)

class digest:
	def __init__(self, content, split="://"):
		if split not in content: raise ValueError
		self.content          = content
		self.type, self.value = content.split(split,1)
		self.nonce            = os.urandom(256)
	def voteHash     (self): return getattr(hash, self.type)(data=self.value, nonce=b""       )
	def signatureHash(self): return getattr(hash, self.type)(data=self.value, nonce=self.nonce)
	def privateHash  (self): return hash._hash              (data=b"",        nonce=self.nonce)

def printVote(digest):
	print("vote:     ", digest.voteHash())
	print("signature:", digest.signatureHash())
	print("private:  ", digest.privateHash())

def printContribution(digest):
	print("content:  ", digest.content)
	print("nonce:    ", digest.nonce)



if __name__ == '__main__':

	d = digest("file:///home/amxx/todl.txt")

	printVote(d)
	printContribution(d)

	pass
