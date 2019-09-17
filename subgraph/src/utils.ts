import {
	BigInt,
	BigDecimal,
	EthereumEvent,
} from '@graphprotocol/graph-ts'

import {
	Account,
	Transaction,
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

export function logTransaction(event: EthereumEvent): Transaction
{
	let tx = new Transaction(event.transaction.hash.toHex());
	tx.from        = fetchAccount(event.transaction.from.toHex()).id;
	tx.to          = fetchAccount(event.transaction.to.toHex()  ).id; // check event.transaction.to for null values ?
	tx.value       = event.transaction.value;
	tx.gasUsed     = event.transaction.gasUsed;
	tx.gasPrice    = event.transaction.gasPrice;
	tx.timestamp   = event.block.timestamp;
	tx.blockNumber = event.block.number;
	tx.save();
	return tx as Transaction;
}

export function toDate(timestamp: BigInt): Date
{
	return new Date(timestamp.toI32() * 1000)
}

export function toRLC(value: BigInt): BigDecimal
{
	return value.divDecimal(BigDecimal.fromString('1000000000'))
}
