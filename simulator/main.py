#!/usr/bin/python3

import numpy                  as np
from matplotlib import pyplot as plt
from matplotlib import ticker

from argparse   import Namespace
from operator   import itemgetter
from statistics import mean

from include import consensus
from include import scenari
from include import simulation


def initPlot():
	plt.figure(figsize=(16,9))
	plt.axes().spines['right'].set_visible(False)
	plt.axes().spines['top'  ].set_visible(False)

def endPlot(fname=None):
	if fname == None:
		plt.show()
	else:
		plt.savefig(fname)
	plt.close()

def profit        (cn, selector): return sum(value for vote, value in consensus.listTXS(cn).items() if selector(vote))
def profit_wlaunch(cn, selector): return sum(value for vote, value in consensus.listTXS(cn).items() if selector(vote)) - cn.cost


###############################################################################
settings           = Namespace()
settings.C_target  = .99
settings.C_cost    = 1
settings.C_CR      = lambda v: 0.9
# settings.C_CR      = lambda v: 0.95 if v.user[0] == 'attacker' else 0.9
settings.V_funds   = .5
###############################################################################
control_ratio      = .2
badanswer_ratio    = .1
###############################################################################

if __name__ == '__main__':

	samples  = 10000
	raw      = np.zeros(shape=(samples, 3))

	raw[:,0] = [ profit        (simulation.SingleRun(scenario=scenari.Ideal        (                 control_ratio), settings=settings).consensus, lambda v: v[0] == 'marked'  ) for _ in range(samples) ]
	raw[:,1] = [ profit        (simulation.SingleRun(scenario=scenari.BadAPP       (badanswer_ratio, control_ratio), settings=settings).consensus, lambda v: v[0] == 'marked'  ) for _ in range(samples) ]
	raw[:,2] = [ profit_wlaunch(simulation.SingleRun(scenario=scenari.BadDAPPAttack(badanswer_ratio, control_ratio), settings=settings).consensus, lambda v: v[0] == 'attacker') for _ in range(samples) ]

	base   = ['Good DAAP', 'Bad DAAP', 'Bad DAAP attack']
	labels = [ "%s\nmean: %.4f" % args for args in zip(base, np.mean(raw, axis=0)) ]

	initPlot()
	plt.boxplot(raw, sym='k+', labels=labels, showfliers=True, showmeans=True)
	plt.title("Expected profit for a pool of workers controlling %.2f%% of the platform" % control_ratio)
	plt.xlabel("Scenario")
	plt.ylabel("Profit per run (for the controled pool)")
	plt.grid(axis='y', which='major', linestyle='solid')
	plt.grid(axis='y', which='minor', linestyle='dashed')
	plt.axes().yaxis.set_major_locator(ticker.MultipleLocator(100))
	plt.axes().yaxis.set_major_formatter(ticker.FormatStrFormatter(''))
	plt.axes().yaxis.set_minor_locator(ticker.MultipleLocator(0.5))
	plt.axes().yaxis.set_minor_formatter(ticker.FormatStrFormatter('%.2f'))
	# endPlot("/home/amxx/Work/iExec/sandbox/simulator/plot/badDAAPattack.png")
	endPlot()
