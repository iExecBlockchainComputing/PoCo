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
	fetchAccount(event.params.owner.toHexString()).save()

	let op           = new Deposit(createEventID(event))
	op.blockNumber   = event.block.number.toI32()
	op.transactionID = event.transaction.hash
	op.account       = event.params.owner.toHexString()
	op.value         = event.params.amount
	op.from          = event.params.owner.toHexString()
	op.save()
}

export function handleDepositFor(event: DepositForEvent): void {
	fetchAccount(event.params.target.toHexString()).save()
	fetchAccount(event.params.owner.toHexString()).save()

	let op           = new Deposit(createEventID(event))
	op.blockNumber   = event.block.number.toI32()
	op.transactionID = event.transaction.hash
	op.account       = event.params.target.toHexString()
	op.value         = event.params.amount
	op.from          = event.params.owner.toHexString()
	op.save()
}

export function handleWithdraw(event: WithdrawEvent): void {
	fetchAccount(event.params.owner.toHexString()).save()

	let op           = new Withdraw(createEventID(event))
	op.blockNumber   = event.block.number.toI32()
	op.transactionID = event.transaction.hash
	op.account       = event.params.owner.toHexString()
	op.value         = event.params.amount
	op.to            = event.params.owner.toHexString()
	op.save()
}

export function handleReward(event: RewardEvent): void {
	fetchAccount(event.params.user.toHexString()).save()

	let op           = new Reward(createEventID(event))
	op.blockNumber   = event.block.number.toI32()
	op.transactionID = event.transaction.hash
	op.account       = event.params.user.toHexString()
	op.value         = event.params.amount
	op.task          = event.params.ref.toHex()
	op.save()
}

export function handleSeize(event: SeizeEvent): void {
	fetchAccount(event.params.user.toHexString()).save()

	let op           = new Seize(createEventID(event))
	op.blockNumber   = event.block.number.toI32()
	op.transactionID = event.transaction.hash
	op.account       = event.params.user.toHexString()
	op.value         = event.params.amount
	op.task          = event.params.ref.toHex()
	op.save()
}

export function handleLock(event: LockEvent): void {
	fetchAccount(event.params.user.toHexString()).save()

	let op           = new Lock(createEventID(event))
	op.blockNumber   = event.block.number.toI32()
	op.transactionID = event.transaction.hash
	op.account       = event.params.user.toHexString()
	op.value         = event.params.amount
	op.save()
}

export function handleUnlock(event: UnlockEvent): void {
	fetchAccount(event.params.user.toHexString()).save()

	let op           = new Unlock(createEventID(event))
	op.blockNumber   = event.block.number.toI32()
	op.transactionID = event.transaction.hash
	op.account       = event.params.user.toHexString()
	op.value         = event.params.amount
	op.save()
}
