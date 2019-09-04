import {
	EthereumEvent,
} from '@graphprotocol/graph-ts'

import {
	Deposit    as DepositEvent,
	DepositFor as DepositForEvent,
	Withdraw   as WithdrawEvent,
	Reward     as RewardEvent,
	Seize      as SeizeEvent,
	Lock       as LockEvent,
	Unlock     as UnlockEvent,
} from '../../generated/IexecClerk/Escrow'

import {
	Account,
	Task,
	Deposit,
	Withdraw,
	Reward,
	Seize,
	Lock,
	Unlock,
} from '../../generated/schema'

function createEventID(event: EthereumEvent): string
{
	return event.block.number.toString().concat('-').concat(event.logIndex.toString())
}

function fetchAccount(id: string): Account { return ( Account.load(id) || new Account(id) ) as Account }
function fetchTask   (id: string): Task    { return ( Task.load(id)    || new Task(id)    ) as Task    }

export function handleDeposit(event: DepositEvent): void {
	let account = fetchAccount(event.params.owner.toHexString()); account.save()

	let op           = new Deposit(createEventID(event))
	op.blockNumber   = event.block.number.toI32()
	op.transactionID = event.transaction.hash
	op.account       = account.id
	op.value         = event.params.amount
	op.from          = account.id
	op.save()
}

export function handleDepositFor(event: DepositForEvent): void {
	let account = fetchAccount(event.params.target.toHexString());	account.save()
	let from    = fetchAccount(event.params.owner.toHexString()); from.save()

	let op           = new Deposit(createEventID(event))
	op.blockNumber   = event.block.number.toI32()
	op.transactionID = event.transaction.hash
	op.account       = account.id
	op.value         = event.params.amount
	op.from          = from.id
	op.save()
}

export function handleWithdraw(event: WithdrawEvent): void {
	let account = fetchAccount(event.params.owner.toHexString()); account.save()

	let op           = new Withdraw(createEventID(event))
	op.blockNumber   = event.block.number.toI32()
	op.transactionID = event.transaction.hash
	op.account       = account.id
	op.value         = event.params.amount
	op.to            = account.id
	op.save()
}

export function handleReward(event: RewardEvent): void {
	let account = fetchAccount(event.params.user.toHexString()); account.save()
	let task    = fetchTask(event.params.ref.toHex()); task.save()

	let op           = new Reward(createEventID(event))
	op.blockNumber   = event.block.number.toI32()
	op.transactionID = event.transaction.hash
	op.account       = account.id
	op.value         = event.params.amount
	op.task          = task.id
	op.save()
}

export function handleSeize(event: SeizeEvent): void {
	let account = fetchAccount(event.params.user.toHexString()); account.save()
	let task    = fetchTask(event.params.ref.toHex()); task.save()

	let op           = new Seize(createEventID(event))
	op.blockNumber   = event.block.number.toI32()
	op.transactionID = event.transaction.hash
	op.account       = account.id
	op.value         = event.params.amount
	op.task          = task.id
	op.save()
}

export function handleLock(event: LockEvent): void {
	let account = fetchAccount(event.params.user.toHexString()); account.save()

	let op           = new Lock(createEventID(event))
	op.blockNumber   = event.block.number.toI32()
	op.transactionID = event.transaction.hash
	op.account       = account.id
	op.value         = event.params.amount
	op.save()
}

export function handleUnlock(event: UnlockEvent): void {
	let account = fetchAccount(event.params.user.toHexString()); account.save()

	let op           = new Unlock(createEventID(event))
	op.blockNumber   = event.block.number.toI32()
	op.transactionID = event.transaction.hash
	op.account       = account.id
	op.value         = event.params.amount
	op.save()
}
