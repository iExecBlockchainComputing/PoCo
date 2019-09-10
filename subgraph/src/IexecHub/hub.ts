import {
	IexecHub       as IexecHubContract,
	TaskInitialize as TaskInitializeEvent,
	TaskContribute as TaskContributeEvent,
	TaskConsensus  as TaskConsensusEvent,
	TaskReveal     as TaskRevealEvent,
	TaskReopen     as TaskReopenEvent,
	TaskFinalize   as TaskFinalizeEvent,
	TaskClaimed    as TaskClaimedEvent,
} from '../../generated/IexecHub/IexecHub'

import {
	Task,
	Contribution,
	TaskInitialize,
	TaskContribute,
	TaskConsensus,
	TaskReveal,
	TaskReopen,
	TaskFinalize,
	TaskClaimed,
} from '../../generated/schema'

import {
	createEventID,
	createContributionID,
} from '../utils'

export function handleTaskInitialize(event: TaskInitializeEvent): void {
	let contract = IexecHubContract.bind(event.address)
	let task     = contract.viewTask(event.params.taskid)

	let t = new Task(event.params.taskid.toHex())
	t.status               = 'ACTIVE'
	t.deal                 = task.dealid.toHex()
	t.index                = task.idx
	t.contributions        = new Array<string>();
	t.contributionDeadline = task.contributionDeadline
	t.finalDeadline        = task.finalDeadline
	t.save()

	let e = new TaskInitialize(createEventID(event));
	e.blockNumber   = event.block.number.toI32()
	e.transactionID = event.transaction.hash
	e.task          = event.params.taskid.toHex()
	e.workerpool    = event.params.workerpool.toHex()
	e.save()
}

export function handleTaskContribute(event: TaskContributeEvent): void {
	let contract     = IexecHubContract.bind(event.address)
	let contribution = contract.viewContribution(event.params.taskid, event.params.worker)

	let c = new Contribution(createContributionID(event.params.taskid.toHex(), event.params.worker.toHex()))
	c.status    = 'CONTRIBUTED'
	c.task      = event.params.taskid.toHex()
	c.worker    = event.params.worker.toHex()
	c.hash      = contribution.resultHash
	c.seal      = contribution.resultSeal
	c.challenge = contribution.enclaveChallenge
	c.save()

	let t = Task.load(event.params.taskid.toHex())
	let cs = t.contributions
	cs.push(c.id)
	t.contributions = cs
	t.save()

	let e = new TaskContribute(createEventID(event));
	e.blockNumber   = event.block.number.toI32()
	e.transactionID = event.transaction.hash
	e.task          = event.params.taskid.toHex()
	e.worker        = event.params.worker.toHex()
	e.hash          = event.params.hash
	e.save()
}

export function handleTaskConsensus(event: TaskConsensusEvent): void {
	let contract = IexecHubContract.bind(event.address)
	let task     = contract.viewTask(event.params.taskid)

	let t = new Task(event.params.taskid.toHex())
	t.status         = 'REVEALING'
	t.consensus      = task.consensusValue
	t.revealDeadline = task.revealDeadline
	t.save()

	let e = new TaskConsensus(createEventID(event));
	e.blockNumber   = event.block.number.toI32()
	e.transactionID = event.transaction.hash
	e.task          = event.params.taskid.toHex()
	e.consensus     = event.params.consensus
	e.save()
}

export function handleTaskReveal(event: TaskRevealEvent): void {
	let contract = IexecHubContract.bind(event.address)

	let t = new Task(event.params.taskid.toHex())
	t.resultDigest = event.params.digest
	t.save()

	let c = new Contribution(createContributionID(event.params.taskid.toHex(), event.params.worker.toHex()))
	c.status = 'PROVED'
	c.save()

	let e = new TaskReveal(createEventID(event));
	e.blockNumber   = event.block.number.toI32()
	e.transactionID = event.transaction.hash
	e.task          = event.params.taskid.toHex()
	e.worker        = event.params.worker.toHex()
	e.digest        = event.params.digest
	e.save()
}

export function handleTaskReopen(event: TaskReopenEvent): void {
	let contract = IexecHubContract.bind(event.address)

	let t = Task.load(event.params.taskid.toHex())
	let cids = t.contributions;
	for (let i = 0;  i < cids.length; ++i)
	{
		let c = Contribution.load(cids[i]);
		if (c.hash.toHex() == t.consensus.toHex())
		{
			c.status = 'REJECTED'
			c.save()
		}
	}
	// t.contributions.forEach(cid => {
	// 	let c = Contribution.load(cid);
	// 	if (c.hash.toHex() == t.consensus.toHex())
	// 	{
	// 		c.status = 'REJECTED'
	// 		c.save()
	// 	}
	// })
	t.status         = 'ACTIVE'
	t.consensus      = null
	t.revealDeadline = null
	t.save()

	let e = new TaskReopen(createEventID(event));
	e.blockNumber   = event.block.number.toI32()
	e.transactionID = event.transaction.hash
	e.task          = event.params.taskid.toHex()
	e.save()
}

export function handleTaskFinalize(event: TaskFinalizeEvent): void {
	let contract = IexecHubContract.bind(event.address)

	let t = Task.load(event.params.taskid.toHex())
	t.status  = 'COMPLETED'
	t.results = event.params.results
	t.save()

	let e = new TaskFinalize(createEventID(event));
	e.blockNumber   = event.block.number.toI32()
	e.transactionID = event.transaction.hash
	e.task          = event.params.taskid.toHex()
	e.results       = event.params.results
	e.save()
}

export function handleTaskClaimed(event: TaskClaimedEvent): void {
	let contract = IexecHubContract.bind(event.address)

	let t = Task.load(event.params.taskid.toHex())
	t.status = 'FAILLED'
	t.save()

	let e = new TaskClaimed(createEventID(event));
	e.blockNumber   = event.block.number.toI32()
	e.transactionID = event.transaction.hash
	e.task          = event.params.taskid.toHex()
	e.save()
}

// event AccurateContribution(address indexed worker, bytes32 indexed taskid);
// event FaultyContribution  (address indexed worker, bytes32 indexed taskid);
