import {
	IexecHub as IexecHubContract,
	TaskInitialize as TaskInitializeEvent,
	TaskContribute as TaskContributeEvent,
	TaskConsensus  as TaskConsensusEvent,
	TaskReveal     as TaskRevealEvent,
	TaskReopen     as TaskReopenEvent,
	TaskFinalize   as TaskFinalizeEvent,
	TaskClaimed    as TaskClaimedEvent,
} from '../../generated/IexecHub/IexecHub'

import {
	Account,
	Task,
	Contribution,
} from '../../generated/schema'

import {
	createContributionID,
} from '../utils'

export function handleTaskInitialize(event: TaskInitializeEvent): void {
	let contract = IexecHubContract.bind(event.address)
	let task     = contract.viewTask(event.params.taskid)

	let t = new Task(event.params.taskid.toHex())
	t.status               = 'ACTIVE'
	t.deal                 = task.dealid.toHex()
	t.index                = task.idx
	t.contributionDeadline = task.contributionDeadline
	t.finalDeadline        = task.finalDeadline
	t.save()
}

export function handleTaskContribute(event: TaskContributeEvent): void {
	let contract     = IexecHubContract.bind(event.address)
	let contribution = contract.viewContribution(event.params.taskid, event.params.worker)

	let c = new Contribution(createContributionID(event.params.taskid.toHex(), event.params.worker.toHex()))
	c.status    = 'CONTRIBUTED'
	c.task      = event.params.taskid.toHex()
	c.worker    = event.params.worker.toHex()
	c.hash      = contribution.resultHash.toHex()
	c.seal      = contribution.resultSeal.toHex()
	c.challenge = contribution.enclaveChallenge.toHex()
	c.save()
}

export function handleTaskConsensus(event: TaskConsensusEvent): void {
	let contract = IexecHubContract.bind(event.address)
	let task     = contract.viewTask(event.params.taskid)

	let t = new Task(event.params.taskid.toHex())
	t.status         = 'REVEALING'
	t.consensus      = task.consensusValue.toHex()
	t.revealDeadline = task.revealDeadline
	t.save()
}

export function handleTaskReveal(event: TaskRevealEvent): void {
	let contract = IexecHubContract.bind(event.address)

	let t = new Task(event.params.taskid.toHex())
	t.resultDigest = event.params.digest.toHex()
	t.save()

	let c = new Contribution(createContributionID(event.params.taskid.toHex(), event.params.worker.toHex()))
	c.status = 'PROVED'
	c.save()
}

export function handleTaskReopen(event: TaskReopenEvent): void {
	let contract = IexecHubContract.bind(event.address)

	let t = Task.load(event.params.taskid.toHex())
	// let cids = t.contributions;
	// for (let i = 0;  i < cids.length; ++i)
	// {
	// 	let c = Contribution.load(cids[i]);
	// 	if (c.hash == t.consensus)
	// 	{
	// 		c.status = 'REJECTED'
	// 		c.save()
	// 	}
	// }
	t.contributions.forEach(cid => {
		let c = Contribution.load(cid);
		if (c.hash == t.consensus)
		{
			c.status = 'REJECTED'
			c.save()
		}
	})

	t.status         = 'ACTIVE'
	t.consensus      = null;
	t.revealDeadline = null;
	t.save()
}

export function handleTaskFinalize(event: TaskFinalizeEvent): void {
	let contract = IexecHubContract.bind(event.address)

	let t = Task.load(event.params.taskid.toHex())
	t.status  = 'COMPLETED'
	t.results = event.params.results.toHex()
	t.save()
}

export function handleTaskClaimed(event: TaskClaimedEvent): void {
	let contract = IexecHubContract.bind(event.address)

	let t = Task.load(event.params.taskid.toHex())
	t.status = 'FAILLED'
	t.save()
}

// event AccurateContribution(address indexed worker, bytes32 indexed taskid);
// event FaultyContribution  (address indexed worker, bytes32 indexed taskid);
