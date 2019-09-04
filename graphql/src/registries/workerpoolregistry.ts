import {
	EthereumEvent,
} from '@graphprotocol/graph-ts'

import {
	Workerpool as WorkerpoolContract,
} from '../../generated/WorkerpoolRegistry/Workerpool'

import {
	CreateWorkerpool as CreateWorkerpoolEvent,
} from '../../generated/WorkerpoolRegistry/WorkerpoolRegistry'

import {
	Workerpool,
} from '../../generated/schema'

function createEventID(event: EthereumEvent): string
{
	return event.block.number.toString().concat('-').concat(event.logIndex.toString())
}

// function fetchAccount(id: string): Account { return ( Account.load(id) || new Account(id) ) as Account }

export function handleCreateWorkerpool(event: CreateWorkerpoolEvent): void
{
	let contract = WorkerpoolContract.bind(event.params.workerpool)
	// let owner    = fetchAccount(contract.owner().toHex()); owner.save()

	let workerpool = new Workerpool(event.params.workerpool.toHex())
	// workerpool.owner                = owner.id
	workerpool.owner                = contract.owner().toHex()
	workerpool.description          = contract.m_workerpoolDescription()
	workerpool.workerStakeRatio     = contract.m_workerStakeRatioPolicy()
	workerpool.schedulerRewardRatio = contract.m_schedulerRewardRatioPolicy()
	workerpool.save()
}
