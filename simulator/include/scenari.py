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

def Ideal(marked_ratio=0):
	return WorkerDistribution([
		WorkerType(type='marked', ratio=marked_ratio,   answer=lambda: 0),
		WorkerType(type='-',      ratio=1-marked_ratio, answer=lambda: 0)
	])

def CoordinatedAttackers(attackers_ratio):
	return WorkerDistribution([
		WorkerType(type='attacker', ratio=attackers_ratio,   answer=lambda: -1),
		WorkerType(type='-',        ratio=1-attackers_ratio, answer=lambda:  0)
	])

def BadAPP(badanswer_ratio, marked_ratio=0):
	return WorkerDistribution([
		WorkerType(type='marked', ratio=marked_ratio,   answer=lambda: random() if random() < badanswer_ratio else 0),
		WorkerType(type='-',      ratio=1-marked_ratio, answer=lambda: random() if random() < badanswer_ratio else 0)
	])

def BadDAPPAttack(badanswer_ratio, attackers_ratio):
	return WorkerDistribution([
		WorkerType(type='attacker', ratio=attackers_ratio,   answer=lambda: 0),
		WorkerType(type='-',        ratio=1-attackers_ratio, answer=lambda: random() if random() < badanswer_ratio else 0)
	])
