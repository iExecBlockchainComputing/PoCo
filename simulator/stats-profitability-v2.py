#!/usr/bin/python3

import numpy

from argparse   import Namespace
from matplotlib import pyplot as plt
from matplotlib import ticker
from statistics import mean

from include  import consensus
from include  import scenari
from include  import simulation

# =============================================================================

def initPlot():
	plt.figure(figsize=(16,9))
	plt.axes().spines['right'].set_visible(False)
	plt.axes().spines['top'  ].set_visible(False)

def endPlot(fname=None):
	plt.legend()
	if fname == None:
		plt.show()
	else:
		plt.savefig(fname)

# =============================================================================

if __name__ == '__main__':

	funds  = [0.0, 0.1, 0.3, 1.0, 3.0, 10.0]
	runs   = 100
	points = 100

	settings           = Namespace()
	settings.C_target  = 0.99
	settings.C_cost    = 1
	settings.C_CR      = lambda x: 0.9
	settings.V_funds   = None

	# ---------------------------------------------------------------------------

	x        = numpy.linspace(0.5, 0.0, points, endpoint=False)[::-1]
	y_ratio  = numpy.empty(points)
	y_count  = numpy.empty((points, 3))
	y_profit = { f: numpy.empty((points,2)) for f in funds }

	for i in range(points):
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

	# ---------------------------------------------------------------------------

	colors = plt.rcParams['axes.color_cycle']

	initPlot()
	plt.plot(x, y_ratio, color=colors[0])
	plt.title("Attack effectiveness\n(target credibility: %4.2f%%)" % (settings.C_target*100))
	plt.xlabel("Portion of the platform controlled by attackers")
	plt.ylabel("Attack success rate")
	plt.xlim(left=x[0], right=x[-1])
	plt.ylim(bottom=0)
	plt.grid(axis='y', linestyle='--')
	endPlot("plots/effectiveness.trg-%f.png" % (settings.C_target))

	initPlot()
	plt.plot(x, y_count[:,0], color=colors[1])
	plt.title("Number of contribution to consensus\n(target credibility: %4.2f%%)" % (settings.C_target*100))
	plt.xlabel("Portion of the platform controlled by attackers")
	plt.ylabel("Mean number of votes")
	plt.xlim(left=x[0], right=x[-1])
	plt.ylim(bottom=0)
	plt.grid(axis='y', which='major', linestyle='--')
	plt.grid(axis='y', which='minor', linestyle='--', alpha=0.3)
	endPlot("plots/consensus.trg-%f.png" % (settings.C_target))

	for f in funds:
		sup = numpy.absolute(y_profit[f]).max()

		initPlot()
		plt.plot(x, y_profit[f][:,0], label="Good workers", color=colors[2])
		plt.plot(x, y_profit[f][:,1], label="Attackers",    color=colors[3])
		plt.title("Profitability\n(committement funds %4.2f, target credibility: %4.2f%%)" % (f, settings.C_target*100))
		plt.xlabel("Portion of the platform controlled by attackers")
		plt.ylabel("Mean profit per contribution")
		plt.xlim(left=x[0], right=x[-1])
		plt.ylim(bottom=-1.2*sup, top=1.2*sup)
		plt.grid(axis='y', which='major', linestyle='-')
		plt.grid(axis='y', which='minor', linestyle='--', alpha=0.3)
		plt.axes().yaxis.set_minor_locator  (plt.axes().yaxis.get_major_locator())
		plt.axes().yaxis.set_minor_formatter(plt.axes().yaxis.get_major_formatter())
		plt.axes().yaxis.set_major_locator(ticker.MultipleLocator(10000000))
		plt.axes().yaxis.set_major_formatter(ticker.FormatStrFormatter(''))
		endPlot("plots/profitability.fund-%.2f.trg-%f.png" % (f, settings.C_target))

	# plt.savefig("profitability.fund-%.2f.trg-%f.png" % (settings.V_funds, settings.C_target))
