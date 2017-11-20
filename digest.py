#!/usr/bin/python

# import mmap
import binascii
import os
import hashlib

SALT_LENGTH = 256

class hash:
	def raw(data, salt):
		return hashlib.sha256(salt+data).hexdigest()

	def str(data, salt):
		return hashlib.sha256(salt+data.encode()).hexdigest()

	def file (data, salt):
		block  = 65536
		hasher = hashlib.sha256()
		hasher.update(salt)
		with open(data, 'rb') as f:
			while True:
				buf = f.read(block)
				if not buf: break
				hasher.update(buf)
		return hasher.hexdigest()

class digest:
	def __init__(self, content, salt=None, split="://"):
		if split not in content: raise ValueError
		self.content          = content
		self.type, self.value = content.split(split,1)
		if   type(salt) is bytes : self.salt = salt
		elif type(salt) is str   : self.salt = binascii.unhexlify(salt)
		elif salt       is None  : self.salt = os.urandom(SALT_LENGTH)
		else                     : raise ValueError
	def hexSalt (self): return binascii.hexlify(self.salt).decode()
	def voteHash(self): return getattr(hash, self.type)(data=self.value, salt=b""      )
	def signHash(self): return getattr(hash, self.type)(data=self.value, salt=self.salt)
	def privHash(self): return hash.raw                (data=b"",        salt=self.salt)

class contribution:
	def __init__(self, vote, sign, priv):
		self.vote = vote
		self.sign = sign
		self.priv = priv
	def make(content):
		dg = digest(content)
		tx = contribution(vote=dg.voteHash(), sign=dg.signHash(), priv=dg.privHash())
		return tx, dg.hexSalt()
	def check(self, content, salt):
		dg = digest(content, salt)
		return self.vote == dg.voteHash() \
		   and self.sign == dg.signHash() \
		   and self.priv == dg.privHash()
	def __repr__(self):
		return "vote: %s\nsign: %s\npriv: %s" % (self.vote, self.sign, self.priv)





if __name__ == '__main__':

	content1 = "file:///home/amxx/todl.txt"
	content2 = "file:///home/amxx/todl2.txt"


	# dg = digest(content1, b"abc")
	# print(dg.voteHash())
	# print(dg.signHash())
	# print(dg.privHash())
	# print(dg.salt)

	tx, salt = contribution.make(content1)
	valid     = tx.check(content2, salt)

	print(tx)
	print(salt)
	print(valid)

	pass


