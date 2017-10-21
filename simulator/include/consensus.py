import functools
import operator

# =============================================================================
def _prod(factors): return functools.reduce(operator.mul, factors, 1)
# =============================================================================

class Vote:
	def __init__(self, user, result, funds):
		self.user     = user
		self.result   = result
		self.funds    = funds

class Consensus:
	def __init__(self, result, score, cost, contribs):
		self.result   = result
		self.score    = score
		self.cost     = cost
		self.contribs = contribs

class Sarmenta:
	def __init__(self, cost, target=0.999, **kwargs):
		self.cost      = cost
		self.target    = target
		self.votes     = []
		self.consensus = None

	def add(self, vote):
		if any(True for v in self.votes if v.user == vote.user):
			raise ValueError
		self.votes.append(vote)

	def resolve(self, CR):
		if not self.votes: return False
		# Compute consensus status
		groups         = { v.result                                                         for v in self.votes } # set of result (use set to remove duplicate)
		PU_good        = { v.user: CR(v)                                                    for v in self.votes } # Proba of good user
		PG_good        = { g: _prod(  PU_good[v.user] for v in self.votes if v.result == g) for g in groups     } # Proba of good group
		PG_bad         = { g: _prod(1-PU_good[v.user] for v in self.votes if v.result == g) for g in groups     } # Proba of good group
		PG_otherBad    = { g: _prod(PG_bad[o]         for o in groups     if o        != g) for g in groups     } # Proba of all other groups being bad
		PA_allProba    = (1 + sum(PG_good[g]/PG_bad[g] for g in groups)) * _prod(PG_bad.values())                 # Weight
		PG_valid       = { g: PG_good[g]*PG_otherBad[g]/PA_allProba                         for g in groups     } # Credibility of group
		result, score  = max(PG_valid.items(), key=operator.itemgetter(1))
		# Check consensus
		if score < self.target: return False
		# Build summary
		contribs       = { v: PU_good[v.user] for v in self.votes }
		self.consensus = Consensus(result=result, score=score, cost=self.cost, contribs=contribs)
		return True

def listTXS(consensus):
	kitty  = sum(v.funds for v,cr in consensus.contribs.items() if v.result != consensus.result) + consensus.cost
	weight = sum(cr      for v,cr in consensus.contribs.items() if v.result == consensus.result)
	txs    = { v.user: kitty*cr/weight if v.result == consensus.result else -v.funds for v,cr in consensus.contribs.items() }
	return txs
