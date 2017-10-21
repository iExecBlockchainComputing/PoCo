#!/usr/bin/python3

import numpy                  as np
from matplotlib import pyplot as plt
from matplotlib import ticker

from argparse   import Namespace
from operator   import itemgetter
from statistics import mean

from include            import simulation
from include            import scenari
from include.statistics import TXS



if __name__ == '__main__':

	settings = Namespace()
	settings.C_target  = 0.999
	settings.C_cost    = 1
	settings.C_CR      = lambda x: 0.8
	settings.V_funds   = 0.5

	samples = 1000
	logs    = []

	for _ in range(samples):
		C      = simulation.SingleRun(scenario=scenari.CoordinatedAttackers(0.2), settings=settings)
		G      = C.consensus.result == 0
		W      = TXS.count(C, selector=lambda w: w[0] == '-'       )
		Wtotal = TXS.total(C, selector=lambda w: w[0] == '-'       )
		A      = TXS.count(C, selector=lambda w: w[0] == 'attacker')
		Atotal = TXS.total(C, selector=lambda w: w[0] == 'attacker')
		logs.append((G,W,Wtotal,A,Atotal))

	W      = sum(W      for G,W,Wtotal,A,Atotal in logs)
	Wtotal = sum(Wtotal for G,W,Wtotal,A,Atotal in logs)
	A      = sum(A      for G,W,Wtotal,A,Atotal in logs)
	Atotal = sum(Atotal for G,W,Wtotal,A,Atotal in logs)

	print("Success:                    ", sum(1 for G,_,_,_,_ in logs if G    ))
	print("Failures:                   ", sum(1 for G,_,_,_,_ in logs if not G))
	print("Profit for workers   (total)", Wtotal                               )
	print("Profit for workers   (mean) ", Wtotal / W                           )
	print("Profit for attackers (total)", Atotal                               )
	print("Profit for attackers (mean) ", Atotal / A                           )

	Acounts = { A for G,_,_,A,_ in logs if G }
	for a in Acounts:
		print(a, '→', mean(Wtotal/W for G,W,Wtotal,A,Atotal in logs if G and A == a))

	exit(0)

	samples  = 1000
	raw      = np.zeros(shape=(samples, 3))
	# raw[:,0] = [ Measures.mean(simulation.SingleRun(scenario=scenari.Ideal (),                    settings=settings), selector=lambda x: True) for _ in range(samples) ]
	# raw[:,1] = [ Measures.mean(simulation.SingleRun(scenario=scenari.BadAPP(badanswer_ratio=0.3), settings=settings), selector=lambda x: True) for _ in range(samples) ]

	raw[:,0] = [ Measures.total(simulation.SingleRun(scenario=scenari.GoodAttackers       (0.1), settings=settings), selector=lambda w: w[0] == 'attacker') for _ in range(samples) ]
	raw[:,1] = [ Measures.total(simulation.SingleRun(scenario=scenari.CoordinatedAttackers(0.1), settings=settings), selector=lambda w: w[0] == 'attacker') for _ in range(samples) ]


	# exit(0)

	# raw[:,0] = [ Measures.profit(simulation.SingleRun(settings=settings), selector=lambda w: w[0]=='bad') for _ in range(samples) ] # Good DAPP
	# raw[:,1] = [ Measures.profit        (simulation.SingleRun(scenario=scenari.BadDAPP,       settings=settings), selector=itemgetter(0)) for _ in range(samples) ] # Bad DAPP
	# raw[:,2] = [ Measures.profit_wlaunch(simulation.SingleRun(scenario=scenari.BadDAPPAttack, settings=settings), selector=itemgetter(0)) for _ in range(samples) ] # Bad DAPP Attack

	base   = ['Good DAAP', 'Bad DAAP', 'Bad DAAP attack']
	labels = [ "%s\nmean: %.4f" % args for args in zip(base, np.mean(raw, axis=0)) ]
	plt.boxplot(raw, sym='k+', labels=labels, showfliers=True, showmeans=True)

	plt.title("Expected profit for a group of workers controlling 10% of the platform")
	plt.xlabel("Scenario")
	plt.ylabel("Profit per run")

	plt.grid(axis='y', which='major', linestyle='solid')
	plt.axes().yaxis.set_major_locator(ticker.MultipleLocator(100))
	plt.axes().yaxis.set_major_formatter(ticker.FormatStrFormatter(''))
	plt.grid(axis='y', which='minor', linestyle='dashed')
	plt.axes().yaxis.set_minor_locator(ticker.MultipleLocator(0.5))
	plt.axes().yaxis.set_minor_formatter(ticker.FormatStrFormatter('%.2f'))

	plt.axes().spines['right'].set_visible(False)
	plt.axes().spines['top'  ].set_visible(False)



	plt.show()
