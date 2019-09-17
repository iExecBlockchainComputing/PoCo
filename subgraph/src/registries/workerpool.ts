import {
	EthereumEvent,
} from '@graphprotocol/graph-ts'

import {
	Workerpool as WorkerpoolContract,
	PolicyUpdate as PolicyUpdateEvent,
} from '../../generated/templates/Workerpool/Workerpool'

import {
	Account,
	Workerpool,
	PolicyUpdate,
} from '../../generated/schema'

import {
	createEventID,
	logTransaction,
} from '../utils'

export function handlePolicyUpdate(event: PolicyUpdateEvent): void
{
	let workerpool = Workerpool.load(event.address.toHex())
	workerpool.workerStakeRatio     = event.params.newWorkerStakeRatioPolicy
	workerpool.schedulerRewardRatio = event.params.newSchedulerRewardRatioPolicy
	workerpool.save()

	let policyupdate = new PolicyUpdate(createEventID(event))
	policyupdate.transaction              = logTransaction(event).id
	policyupdate.timestamp                = event.block.timestamp
	policyupdate.workerpool               = event.address.toHex()
	policyupdate.oldWorkerStakeRatio      = event.params.oldWorkerStakeRatioPolicy
	policyupdate.newWorkerStakeRatio      = event.params.oldSchedulerRewardRatioPolicy
	policyupdate.oldSchedulerRewardRatio  = event.params.newWorkerStakeRatioPolicy
	policyupdate.newSchedulerRewardRatio  = event.params.newSchedulerRewardRatioPolicy
	policyupdate.save()
}
