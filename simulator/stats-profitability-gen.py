#!/usr/bin/python3

import numpy

from argparse   import Namespace
from statistics import mean

from include  import consensus
from include  import scenari
from include  import simulation

###############################################################################
settings           = Namespace()
settings.C_target  = None          # set by experience
settings.C_cost    = 1
settings.C_CR      = lambda x: 0.9
settings.V_funds   = None          # set by experience
###############################################################################

if __name__ == '__main__':

	targets = [0.99, 0.999, 0.9999]
	funds   = [0.0, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0, 10.0]
	runs    = 100000
	sample  = 64

	# ---------------------------------------------------------------------------

	x        = numpy.linspace(0.5, 0.0, sample, endpoint=False)[::-1]
	x_smooth = numpy.linspace(x.min(), x.max(), 300)

	y_ratio  = numpy.empty(sample)
	y_count  = numpy.empty((sample, 3))
	y_profit = { f: numpy.empty((sample,2)) for f in funds }

	# ---------------------------------------------------------------------------

	for target in targets:
		settings.C_target = target

		for i in range(sample):
			cns = [ simulation.SingleRun(scenario=scenari.CoordinatedAttackers(x[i]), settings=settings).consensus for _ in range(runs) ]

			y_ratio[i]   = sum (1 for cn in cns if cn.result != 0) / runs
			y_count[i,0] = mean(len(cn.contribs) for cn in cns)
			y_count[i,1] = min (len(cn.contribs) for cn in cns)
			y_count[i,2] = max (len(cn.contribs) for cn in cns)

			for f in funds:
				Wc = 0
				Wt = 0
				Ac = 0
				At = 0
				for cn in cns:
					for vote in cn.contribs:
						vote.funds = f
					txs = consensus.listTXS(cn)
					Wc += sum(1  for (t,_), tx in txs.items() if t == '-'       )
					Wt += sum(tx for (t,_), tx in txs.items() if t == '-'       )
					Ac += sum(1  for (t,_), tx in txs.items() if t == 'attacker')
					At += sum(tx for (t,_), tx in txs.items() if t == 'attacker')
				y_profit[f][i,0] = Wt/Wc
				y_profit[f][i,1] = At/Ac

		arr_ratio      = numpy.empty((sample,2))
		arr_ratio[:,0] = x
		arr_ratio[:,1] = y_ratio
		numpy.save("data/effectiveness.trg-%f" % (target), arr_ratio)

		arr_contrib      = numpy.empty((sample,2))
		arr_contrib[:,0] = x
		arr_contrib[:,1] = y_count[:,0]
		numpy.save("data/consensus.trg-%f" % (target), arr_contrib)

		for f in funds:
			arr_profit       = numpy.empty((sample,3))
			arr_profit[:,0]  = x
			arr_profit[:,1:] = y_profit[f]
			numpy.save("data/profitability.fund-%.2f.trg-%f" % (f, target), arr_profit)
