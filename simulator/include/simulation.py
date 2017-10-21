from uuid import uuid4

from . import consensus

def SingleRun(scenario, settings):
	job = consensus.Sarmenta(cost=settings.C_cost, minCommit=0, target=settings.C_target)
	while not job.resolve(CR=settings.C_CR):
		w      = scenario.select()
		user   = w.type, uuid4()
		funds  = settings.V_funds
		answer = w.answer()
		job.add(consensus.Vote(user=user, funds=funds, result=answer))
	return job
