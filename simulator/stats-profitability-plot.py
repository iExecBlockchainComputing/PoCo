#!/usr/bin/python3

import numpy as np
from matplotlib import pyplot as plt
from matplotlib import ticker

colors      = [ c['color'] for c in plt.rcParams['axes.prop_cycle'] ]
xticks      = [ 0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001, 0.0005 ]
xticklabels = ["%.2f%%" % (100.0*x) for x in xticks]


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

###############################################################################
targets = [0.99, 0.999, 0.9999, 0.99999]
funds   = [0.0, 0.1, 0.2, 0.5, 1.0, 2.0]
pwd_in  = "/home/amxx/Work/iExec/PoCo_sandbox/simulator/data/100000x128"
pwd_out = "/home/amxx/Work/iExec/PoCo_sandbox/simulator/plot/100000x128"
###############################################################################
styles  = [':', '--', '-.', '-']
###############################################################################

if __name__ == '__main__':


	# ---------------------------------------------------------------------------

	initPlot()
	data_effect = dict()
	for target, style in zip(targets, styles):
		data_effect[target] = np.load("%s/effectiveness.trg-%f.npy" % (pwd_in, target))
		plt.plot(data_effect[target][:,0], data_effect[target][:,1], label="Confidence threshold: %.4f%%" % (target*100), color=colors[0], linestyle=style)
	plt.title("Attack effectiveness")
	plt.xlabel("Portion of the platform controlled by attackers")
	plt.ylabel("Attack success rate")
	plt.legend(loc='upper left')
	plt.grid(axis='y', linestyle='--')
	xmin = min(d[:,0].min() for d in data_effect.values())
	xmax = max(d[:,0].max() for d in data_effect.values())
	plt.xlim(left=xmin, right=xmax)
	plt.xscale('log')
	plt.xticks(xticks, xticklabels)
	plt.ylim(bottom=0)
	endPlot("%s/effectiveness.png" % (pwd_out))
	# endPlot()

	# ---------------------------------------------------------------------------

	initPlot()
	data_consensus = dict()
	for target, style in zip(targets, styles):
		data_consensus[target] = np.load("%s/consensus.trg-%f.npy" % (pwd_in, target))
		plt.plot(data_consensus[target][:,0], data_consensus[target][:,1], label="Confidence threshold: %.4f%%" % (target*100), color=colors[1], linestyle=style)
	plt.title("Number of contribution to consensus")
	plt.xlabel("Portion of the platform controlled by attackers")
	plt.ylabel("Mean number of votes")
	plt.legend(loc='upper left')
	plt.grid(axis='y', linestyle='--')
	xmin = min(d[:,0].min() for d in data_consensus.values())
	xmax = max(d[:,0].max() for d in data_consensus.values())
	plt.xlim(left=xmin, right=xmax)
	plt.xscale('log')
	plt.xticks(xticks, xticklabels)
	plt.ylim(bottom=0)
	endPlot("%s/consensus.png" % (pwd_out))
	# endPlot()

	# ---------------------------------------------------------------------------

	for f in funds:
		initPlot()
		data_profit = dict()
		for target, style in zip(targets, styles):
			data_profit[target] = np.load("%s/profitability.fund-%05.2f.trg-%f.npy" % (pwd_in, f, target))
			plt.plot(data_profit[target][:,0], data_profit[target][:,1], label="Confidence threshold: %.4f%% - Honest workers" % (target*100), color=colors[2], linestyle=style)
			plt.plot(data_profit[target][:,0], data_profit[target][:,2], label="Confidence threshold: %.4f%% - Attackers   " % (target*100), color=colors[3], linestyle=style)
		# plt.title("Profitability\n(committement funds %.2f, target credibility: %.4f%%)" % (f, target*100))
		plt.title("Profitability\n(staked amount: %.2f)" % (f))
		plt.xlabel("Portion of the platform controlled by attackers")
		plt.ylabel("Mean profit per contribution")
		plt.legend(loc='lower left')
		plt.grid(axis='y', which='major', linestyle='-')
		plt.grid(axis='y', which='minor', linestyle='--', alpha=0.3)
		xmin = min(            d[:,0].min()   for d in data_profit.values())
		xmax = max(            d[:,0].max()   for d in data_profit.values())
		ymax = max(np.absolute(d[:,1:]).max() for d in data_profit.values())
		plt.xlim(left=xmin, right=xmax)
		plt.xscale('log')
		plt.xticks(xticks, xticklabels)
		plt.ylim(bottom=-1.2*ymax, top=1.2*ymax)
		plt.axes().yaxis.set_minor_locator  (plt.axes().yaxis.get_major_locator())
		plt.axes().yaxis.set_minor_formatter(plt.axes().yaxis.get_major_formatter())
		plt.axes().yaxis.set_major_locator(ticker.MultipleLocator(10000000))
		plt.axes().yaxis.set_major_formatter(ticker.FormatStrFormatter(''))
		endPlot("%s/profitability.fund-%05.2f.png" % (pwd_out, f))
		# endPlot()
