#!/usr/bin/python3

import datetime
import multiprocessing
import numpy as np
import os
import sys

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
targets = [0.99, 0.999, 0.9999, 0.99999]
funds   = [0.0, 0.1, 0.2, 0.5, 1.0, 2.0]
runs    = 100000
sample  = 128
pwd     = "/home/amxx/Work/iExec/PoCo_sandbox/simulator/data/%dx%d" % (runs, sample)
x       = np.logspace(np.log10(5e-4), np.log10(5e-1), sample)
###############################################################################

def run(xa): return simulation.SingleRun(scenario=scenari.CoordinatedAttackers(xa), settings=settings).consensus

if __name__ == '__main__':

	sys.stderr.write("#############################################\n")
	sys.stderr.write("# Start at %s\n" % datetime.datetime.now().isoformat())
	sys.stderr.write("# Will use %d cpu\n" % multiprocessing.cpu_count())
	sys.stderr.write("# ----------------------------------------- #\n")
	sys.stderr.write("# runs:    %d\n" % runs)
	sys.stderr.write("# sample:  %d\n" % sample)
	sys.stderr.write("#############################################\n")

	y_ratio  = np.zeros(sample)
	y_count  = np.zeros((sample, 3))
	y_profit = { f: np.zeros((sample,2)) for f in funds }

	# ---------------------------------------------------------------------------

	for target in targets:
		settings.C_target = target

		pool = multiprocessing.Pool()

		for i in range(sample):
			# cns = list(map(run, [ x[i] for _ in range(runs) ]))
			# cns = list(pool.map(run, [ x[i] for _ in range(runs) ]))
			cns = list(pool.imap_unordered(run, [ x[i] for _ in range(runs) ]))
			# cns = [ r.get() for r in [ pool.apply_async(run, [x[i]]) for _ in range(runs) ]]

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

			# Snapshot
			if (sample-i-1)%(sample // 16) == 0:
				sys.stderr.write("[ SNAPSHOT | %3d/%3d ] target: %f, attackers: %f, runs: %d\n" % (i+1, sample, target, x[i], runs))

				arr_ratio             = np.empty((i+1,2))
				arr_ratio[:i+1,0]     = x[:i+1]
				arr_ratio[:i+1,1]     = y_ratio[:i+1]
				np.save("%s/effectiveness.trg-%f.checkpoint" % (pwd, target), arr_ratio)

				arr_contrib           = np.empty((i+1,2))
				arr_contrib[:i+1,0]   = x[:i+1]
				arr_contrib[:i+1,1]   = y_count[:i+1,0]
				np.save("%s/consensus.trg-%f.checkpoint" % (pwd, target), arr_contrib)

				for f in funds:
					arr_profit          = np.empty((i+1,3))
					arr_profit[:i+1,0 ] = x[:i+1]
					arr_profit[:i+1,1:] = y_profit[f][:i+1]
					np.save("%s/profitability.fund-%05.2f.trg-%f.checkpoint" % (pwd, f, target), arr_profit)

		# Final
		os.rename("%s/effectiveness.trg-%f.checkpoint.npy" % (pwd, target),
		          "%s/effectiveness.trg-%f.npy"            % (pwd, target))
		os.rename("%s/consensus.trg-%f.checkpoint.npy"     % (pwd, target),
		          "%s/consensus.trg-%f.npy"                % (pwd, target))
		for f in funds:
			os.rename("%s/profitability.fund-%05.2f.trg-%f.checkpoint.npy" % (pwd, f, target),
			          "%s/profitability.fund-%05.2f.trg-%f.npy"            % (pwd, f, target))
