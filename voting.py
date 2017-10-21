#!/usr/bin/python

import numpy
import random
import statistics
import sys
import uuid

# =============================================================================
import functools
import operator
def prod(factors):
  return functools.reduce(operator.mul, factors, 1)
# =============================================================================

# def CR(user):
#   k = { "P1": 0
#       , "P2": 6
#       , "P6": 6
#       , "P7": 125
#       , "P8": 3
#       , "P9": 200
#       }.get(user, 0)
#   return 1 - 0.2 / max(1,k)


class SarmentaVote:
  def __init__(self):
    self.groups = dict()
    self.users  = set()

  def addVote(self, user, result):
    if user in self.users: raise ValueError
    self.users.add(user)
    self.groups.setdefault(result, set()).add(user)

  def solve(self, Cr):
    PU_good     = { user:  Cr(user)                                     for user         in S.users          } # Proba of good user
    PG_good     = { group: prod(  PU_good[u] for u in users)            for group, users in S.groups.items() } # Proba of good group
    PG_bad      = { group: prod(1-PU_good[u] for u in users)            for group, users in S.groups.items() } # Proba of bad group
    PA_bad      = prod(PG_bad.values())                                                                        # Proba of all groups being bad
    PG_otherBad = { group: PA_bad/PG_bad[group]                         for group        in S.groups.keys()  } # Proba of all other groups being bad
    PA_combin   = PA_bad + sum( PG_good[group]*PG_otherBad[group]       for group        in S.groups.keys()  ) # Weight
    PG_valid    = { group: PG_good[group]*PG_otherBad[group]/PA_combin  for group        in S.groups.keys()  } # Credibility of group
    return PG_valid




if __name__ == '__main__':

  S = SarmentaVote()
  S.addVote(0, "E")
  S.addVote(1, "Z")
  S.addVote(2, "A")
  S.addVote(3, "A")
  S.addVote(4, "A")
  S.addVote(5, "A")
  S.addVote(6, "A")
  print(S.solve(Cr=lambda x: 0.8))
  exit(0)

  Credibility = lambda x: 0.99 if x[1] else 0.8
  Objective   = 0.999
  Attackers   = 0.5
  BadAnswer   = 0.03
  F_client    = 1
  F_worker    = 3

  results = []
  solve   = None
  for i in range(1000):
    S = SarmentaVote()
    while True:
      UUID = uuid.uuid4()
      if random.random() < Attackers: #isattacker
        S.addVote((UUID, True), True)
      else:
        value = random.random() if random.random() < BadAnswer else True
        S.addVote((UUID, False), value)
      solve = S.solve(Credibility)
      if max(solve.values()) > Objective: break

    # sys.stderr.write("====== Sarmenta's Vote ======\n")
    # for k,v in solve.items():
    #   sys.stderr.write("[%20s] %f %d\n" % (k, v, len(S.groups[k])))
    # sys.stderr.write("=============================\n")

    winning_answer    = sorted(S.solve(Credibility).items(), key=operator.itemgetter(1))[-1][0] # should be true
    # assert(winning_answer == True)
    users_total       = len(S.users)
    users_winners     = len(S.groups[winning_answer])
    users_losers      = users_total - users_winners
    attackers_total   = len([u for u in S.users                  if u[1]])
    attackers_winners = len([u for u in S.groups[winning_answer] if u[1]]) # should be attackers_total, unless True doesn't win
    attackers_losers  = attackers_total - attackers_winners # should be 0
    # assert(attackers_total == attackers_winners)
    weight_winners   = sum(Credibility(u) for u in S.groups[winning_answer]        )
    weight_attackers = sum(Credibility(u) for u in S.groups[winning_answer] if u[1])

    kitty             = F_worker * users_losers     + F_client
    attack_cost       = F_worker * attackers_losers + F_client
    attack_profit     = kitty * weight_attackers / weight_winners
    attack_margin     = attack_profit - attack_cost

    results.append(attack_margin)

  print("min: ", min(results))
  print("max: ", max(results))
  print("mean:", statistics.mean(results))
