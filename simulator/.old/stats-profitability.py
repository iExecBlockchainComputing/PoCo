#!/usr/bin/python3

import numpy

from argparse   import Namespace
from matplotlib import pyplot as plt
from matplotlib import ticker
from statistics import mean

from include            import simulation
from include            import scenari
from include.statistics import TXS

# =============================================================================

def Simulate(settings, samples):
	logs = []
	for _ in range(samples):
		C   = simulation.SingleRun(scenario=settings.scenario, settings=settings)
		G   = C.consensus.result == 0
		Wc  = TXS.count(C, selector=lambda w: w[0] == '-'       )
		Wt  = TXS.total(C, selector=lambda w: w[0] == '-'       )
		Ac  = TXS.count(C, selector=lambda w: w[0] == 'attacker')
		At  = TXS.total(C, selector=lambda w: w[0] == 'attacker')
		logs.append((G,Wc,Wt,Ac,At))
	return logs

class Analyse:
	def success (logs): return sum ( 1     for G,Wc,Wt,Ac,At in logs if G     )
	def failures(logs): return sum ( 1     for G,Wc,Wt,Ac,At in logs if not G )
	def Aset    (logs): return     { Ac    for G,Wc,Wt,Ac,At in logs if G     }

	def Amin    (logs): return min ( Ac    for G,Wc,Wt,Ac,At in logs          )
	def Wmin    (logs): return min (    Wc for G,Wc,Wt,Ac,At in logs          )
	def Cmin    (logs): return min ( Ac+Wc for G,Wc,Wt,Ac,At in logs          )
	def Amax    (logs): return max ( Ac    for G,Wc,Wt,Ac,At in logs          )
	def Wmax    (logs): return max (    Wc for G,Wc,Wt,Ac,At in logs          )
	def Cmax    (logs): return max ( Ac+Wc for G,Wc,Wt,Ac,At in logs          )
	def Amean   (logs): return mean( Ac    for G,Wc,Wt,Ac,At in logs          )
	def Wmean   (logs): return mean(    Wc for G,Wc,Wt,Ac,At in logs          )
	def Cmean   (logs): return mean( Ac+Wc for G,Wc,Wt,Ac,At in logs          )
	def Asum    (logs): return sum ( Ac    for G,Wc,Wt,Ac,At in logs          )
	def Wsum    (logs): return sum (    Wc for G,Wc,Wt,Ac,At in logs          )
	def Csum    (logs): return sum ( AC+Wc for G,Wc,Wt,Ac,At in logs          )

	def AprofitT(logs): return sum ( At    for G,Wc,Wt,Ac,At in logs          )
	def WprofitT(logs): return sum ( Wt    for G,Wc,Wt,Ac,At in logs          )
	def AprofitM(logs): return Analyse.AprofitT(logs) / Analyse.Asum(logs)
	def WprofitM(logs): return Analyse.WprofitT(logs) / Analyse.Wsum(logs)

# =============================================================================

if __name__ == '__main__':

	runs   = 10000
	points = 100

	settings           = Namespace()
	settings.C_target  = 0.999
	settings.C_cost    = 1
	settings.C_CR      = lambda x: 0.9
	settings.V_funds   = 0.1

	# ---------------------------------------------------------------------------

	x = numpy.linspace(0.5, 0.0, points, endpoint=False)[::-1]
	y = numpy.empty((points, 7))

	for i in range(points):
		settings.scenario  = scenari.CoordinatedAttackers(x[i])

		log   = Simulate(settings, runs)

		y[i,0] = Analyse.failures(log) / runs
		y[i,1] = Analyse.WprofitM(log)
		y[i,2] = Analyse.AprofitM(log)
		y[i,3] = Analyse.Cmin (log)
		y[i,4] = Analyse.Cmax (log)
		y[i,5] = Analyse.Cmean(log)

	# ---------------------------------------------------------------------------


	fig, (ax1,ax2,ax3) = plt.subplots(3, sharex=True)

	fig.set_size_inches((12,12))
	fig.subplots_adjust(hspace=.05)

	colors = plt.rcParams['axes.color_cycle']
	ax1.plot        (x, y[:,0], label="Attack success rate",  color=colors[0])
	ax2.plot        (x, y[:,1], label="Good workers",         color=colors[2])
	ax2.plot        (x, y[:,2], label="Attackers",            color=colors[3])
	ax3.plot        (x, y[:,5], label="Mean number of votes", color=colors[1])
	# ax3.fill_between(x, y[:,3], y[:,4], label="Voters (Range)",      color=colors[1], alpha=0.3)

	ax1.set_title("Profit of a coordinated attack\n(committement funds %.2f, target credibility: %f)" % (settings.V_funds, settings.C_target))
	ax1.set_ylabel("Attack success rate")
	ax2.set_ylabel("Mean profit per contribution")
	ax3.set_ylabel("Votes required to reach consensus")
	ax3.set_xlabel("Portion of the platform controlled by attackers")

	sup = numpy.absolute(y[:,1:3]).max()

	ax1.set_xlim(left=x[0], right=x[-1])
	ax1.set_ylim(bottom=0)
	ax2.set_ylim(bottom=-1.2*sup, top=+1.2*sup)
	ax3.set_ylim(bottom=0)
	# ax3.set_yscale('log')

	for ax in [ax1, ax2, ax3]:
		ax.legend(loc='lower right')
		ax.spines['right'].set_visible(False)
		ax.spines['top'  ].set_visible(False)
		ax.grid(axis='y', which='major', linestyle='--', alpha=1.0)
		ax.grid(axis='y', which='minor', linestyle='--', alpha=0.3)

	plt.savefig("profitability.fund-%.2f.trg-%f.png" % (settings.V_funds, settings.C_target))
	# plt.show()
