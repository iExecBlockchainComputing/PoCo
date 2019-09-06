import {
	BigInt,
	BigDecimal,
	EthereumEvent,
} from '@graphprotocol/graph-ts'

import {
	Account,
} from '../generated/schema'

export function createEventID(event: EthereumEvent): string
{
	return event.block.number.toString().concat('-').concat(event.logIndex.toString())
}

export function createContributionID(taskid: string, worker: string): string
{
	return taskid.concat('-').concat(worker)
}

export function initAccount(id: string): void
{
	let a = new Account(id)
	a.save()
}

export function fetchAccount(id: string): Account
{
	return (Account.load(id) || new Account(id)) as Account
}

export function toRLC(value: BigInt): BigDecimal
{
	return value.divDecimal(BigDecimal.fromString("1000000000"))
}
