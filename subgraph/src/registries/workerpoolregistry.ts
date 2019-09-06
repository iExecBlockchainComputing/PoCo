import {
	EthereumEvent,
} from '@graphprotocol/graph-ts'

import {
	Workerpool as WorkerpoolTemplate
} from '../../generated/templates'

import {
	Workerpool as WorkerpoolContract,
} from '../../generated/WorkerpoolRegistry/Workerpool'

import {
	CreateWorkerpool as CreateWorkerpoolEvent,
} from '../../generated/WorkerpoolRegistry/WorkerpoolRegistry'

import {
	Account,
	Workerpool,
} from '../../generated/schema'

import {
	fetchAccount,
} from '../utils'

export function handleCreateWorkerpool(event: CreateWorkerpoolEvent): void
{
	let contract = WorkerpoolContract.bind(event.params.workerpool)

	fetchAccount(contract.owner().toHex()).save()

	let workerpool = new Workerpool(event.params.workerpool.toHex())
	workerpool.owner                = contract.owner().toHex()
	workerpool.description          = contract.m_workerpoolDescription()
	workerpool.workerStakeRatio     = contract.m_workerStakeRatioPolicy()
	workerpool.schedulerRewardRatio = contract.m_schedulerRewardRatioPolicy()
	workerpool.save()

	WorkerpoolTemplate.create(event.params.workerpool)
}
