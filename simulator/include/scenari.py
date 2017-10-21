import bisect
import itertools

from collections import namedtuple
from random      import random

from .consensus import Vote

# =============================================================================

WorkerType = namedtuple('WorkerType', 'type ratio answer')
class WorkerDistribution:
	def __init__(self, choices):
		self.choices = list(choices)
		_totalratio  = sum (c.ratio                                  for c in self.choices)
		self.weights = list(itertools.accumulate(c.ratio/_totalratio for c in self.choices))
	def select(self):
		return self.choices[bisect.bisect_right(self.weights, random())]

# =============================================================================

def Ideal():
	return WorkerDistribution([
		WorkerType(type='-', ratio=1.0, answer=lambda: 0)
	])

def GoodAttackers(attackers_ratio):
	return WorkerDistribution([
		WorkerType(type='attacker', ratio=attackers_ratio,   answer=lambda: 0),
		WorkerType(type='-',        ratio=1-attackers_ratio, answer=lambda: 0)
	])

def CoordinatedAttackers(attackers_ratio):
	return WorkerDistribution([
		WorkerType(type='attacker', ratio=attackers_ratio,   answer=lambda: -1),
		WorkerType(type='-',        ratio=1-attackers_ratio, answer=lambda:  0)
	])

def BadAPP(badanswer_ratio):
	return WorkerDistribution([
		WorkerType(type='-', ratio=1, answer=lambda: random() if random() < badanswer_ratio else 0)
	])

def BadDAPPAttack(attackers_ratio, badanswer_ratio):
	return WorkerDistribution([
		WorkerType(type='attacker', ratio=attackers_ratio,   answer=lambda: 0),
		WorkerType(type='-',        ratio=1-attackers_ratio, answer=lambda: random() if random() < badanswer_ratio else 0)
	])
