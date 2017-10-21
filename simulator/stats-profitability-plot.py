import numpy as np
from matplotlib import pyplot as plt
from matplotlib import ticker

# =============================================================================

colors = [ c['color'] for c in plt.rcParams['axes.prop_cycle'] ]

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

	targets = [0.99, 0.999, 0.9999]
	funds   = [0.0, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0, 10.0]

	# ---------------------------------------------------------------------------

	for target in targets:
		data = np.load("data/effectiveness.trg-%f.npy" % (target))
		initPlot()
		plt.plot(data[:,0], data[:,1], color=colors[0])
		plt.title("Attack effectiveness\n(target credibility: %4.2f%%)" % (target*100))
		plt.xlabel("Portion of the platform controlled by attackers")
		plt.ylabel("Attack success rate")
		plt.xlim(left=data[:,0].min(), right=data[:,0].max())
		plt.ylim(bottom=0)
		plt.grid(axis='y', linestyle='--')
		endPlot("plots/effectiveness.trg-%f.png" % (target))
		# endPlot()

	# ---------------------------------------------------------------------------

	for target in targets:
		data = np.load("data/consensus.trg-%f.npy" % (target))
		initPlot()
		plt.plot(data[:,0], data[:,1], color=colors[1])
		plt.title("Number of contribution to consensus\n(target credibility: %4.2f%%)" % (target*100))
		plt.xlabel("Portion of the platform controlled by attackers")
		plt.ylabel("Mean number of votes")
		plt.xlim(left=data[:,0].min(), right=data[:,0].max())
		plt.ylim(bottom=0)
		plt.grid(axis='y', which='major', linestyle='--')
		plt.grid(axis='y', which='minor', linestyle='--', alpha=0.3)
		endPlot("plots/consensus.trg-%f.png" % (target))
		# endPlot()

	# ---------------------------------------------------------------------------

	for target in targets:
		for f in funds:
			data = np.load("data/profitability.fund-%.2f.trg-%f.npy" % (f, target))
			initPlot()
			plt.plot(data[:,0], data[:,1], label="Good workers", color=colors[2])
			plt.plot(data[:,0], data[:,2], label="Attackers",    color=colors[3])
			plt.title("Profitability\n(committement funds %4.2f, target credibility: %4.2f%%)" % (f, target*100))
			plt.xlabel("Portion of the platform controlled by attackers")
			plt.ylabel("Mean profit per contribution")
			plt.xlim(left=data[:,0].min(), right=data[:,0].max())
			sup = np.absolute(data[:,1:]).max()
			plt.ylim(bottom=-1.2*sup, top=1.2*sup)
			plt.grid(axis='y', which='major', linestyle='-')
			plt.grid(axis='y', which='minor', linestyle='--', alpha=0.3)
			plt.axes().yaxis.set_minor_locator  (plt.axes().yaxis.get_major_locator())
			plt.axes().yaxis.set_minor_formatter(plt.axes().yaxis.get_major_formatter())
			plt.axes().yaxis.set_major_locator(ticker.MultipleLocator(10000000))
			plt.axes().yaxis.set_major_formatter(ticker.FormatStrFormatter(''))
			endPlot("plots/profitability.fund-%.2f.trg-%f.png" % (f, target))
			# endPlot()
