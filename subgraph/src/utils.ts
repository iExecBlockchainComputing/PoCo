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

export function fetchAccount(id: string): Account
{
	let account = Account.load(id)
	if (account == null)
	{
		account = new Account(id)
		account.balance = BigDecimal.fromString('0')
		account.frozen  = BigDecimal.fromString('0')
	}
	return account as Account
}

export function toRLC(value: BigInt): BigDecimal
{
	return value.divDecimal(BigDecimal.fromString('1000000000000000000'))
}
