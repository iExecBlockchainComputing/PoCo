import {
	BigInt,
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
	Deposit,
	Withdraw,
	Reward,
	Seize,
	Lock,
	Unlock,
} from '../../generated/schema'

import {
	createEventID,
	fetchAccount,
} from '../utils'

export function handleDeposit(event: DepositEvent): void {
	let account = fetchAccount(event.params.owner.toHex())
	account.balance += event.params.amount
	account.save()

	let op           = new Deposit(createEventID(event))
	op.blockNumber   = event.block.number.toI32()
	op.transactionID = event.transaction.hash
	op.account       = event.params.owner.toHex()
	op.value         = event.params.amount
	op.from          = event.params.owner.toHex()
	op.save()
}

export function handleDepositFor(event: DepositForEvent): void {
	let account = fetchAccount(event.params.target.toHex())
	account.balance += event.params.amount
	account.save()

	fetchAccount(event.params.owner.toHex()).save()

	let op           = new Deposit(createEventID(event))
	op.blockNumber   = event.block.number.toI32()
	op.transactionID = event.transaction.hash
	op.account       = event.params.target.toHex()
	op.value         = event.params.amount
	op.from          = event.params.owner.toHex()
	op.save()
}

export function handleWithdraw(event: WithdrawEvent): void {
	let account = fetchAccount(event.params.owner.toHex())
	account.balance -= event.params.amount
	account.save()

	let op           = new Withdraw(createEventID(event))
	op.blockNumber   = event.block.number.toI32()
	op.transactionID = event.transaction.hash
	op.account       = event.params.owner.toHex()
	op.value         = event.params.amount
	op.to            = event.params.owner.toHex()
	op.save()
}

export function handleReward(event: RewardEvent): void {
	let account = fetchAccount(event.params.user.toHex())
	account.balance += event.params.amount
	account.save()

	let op           = new Reward(createEventID(event))
	op.blockNumber   = event.block.number.toI32()
	op.transactionID = event.transaction.hash
	op.account       = event.params.user.toHex()
	op.value         = event.params.amount
	op.task          = event.params.ref.toHex()
	op.save()
}

export function handleSeize(event: SeizeEvent): void {
	let account = fetchAccount(event.params.user.toHex())
	account.frozen -= event.params.amount
	account.save()

	let op           = new Seize(createEventID(event))
	op.blockNumber   = event.block.number.toI32()
	op.transactionID = event.transaction.hash
	op.account       = event.params.user.toHex()
	op.value         = event.params.amount
	op.task          = event.params.ref.toHex()
	op.save()
}

export function handleLock(event: LockEvent): void {
	let account = fetchAccount(event.params.user.toHex())
	account.balance -= event.params.amount
	account.frozen  += event.params.amount
	account.save()

	let op           = new Lock(createEventID(event))
	op.blockNumber   = event.block.number.toI32()
	op.transactionID = event.transaction.hash
	op.account       = event.params.user.toHex()
	op.value         = event.params.amount
	op.save()
}

export function handleUnlock(event: UnlockEvent): void {
	let account = fetchAccount(event.params.user.toHex())
	account.balance += event.params.amount
	account.frozen  -= event.params.amount
	account.save()

	let op           = new Unlock(createEventID(event))
	op.blockNumber   = event.block.number.toI32()
	op.transactionID = event.transaction.hash
	op.account       = event.params.user.toHex()
	op.value         = event.params.amount
	op.save()
}
