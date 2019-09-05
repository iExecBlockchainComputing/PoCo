import {
	EthereumEvent,
} from '@graphprotocol/graph-ts'

import {
	Account,
	Task,
} from '../generated/schema'

export function createEventID(event: EthereumEvent): string
{
	return event.block.number.toString().concat('-').concat(event.logIndex.toString())
}

export function createContributionID(taskid: string, worker: string): string
{
	return taskid.concat('-').concat(worker)
}

export function fetchAccount(id: string): Account
{
	return ( Account.load(id) || new Account(id) ) as Account
}

export function fetchTask(id: string): Task
{
	return ( Task.load(id) || new Task(id) ) as Task
}
