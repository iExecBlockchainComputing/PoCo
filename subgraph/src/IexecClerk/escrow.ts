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
	logTransaction,
	toRLC,
} from '../utils'

export function handleDeposit(event: DepositEvent): void {
	let value = toRLC(event.params.amount)

	let account = fetchAccount(event.params.owner.toHex())
	account.balance += value
	account.save()

	let op         = new Deposit(createEventID(event))
	op.transaction = logTransaction(event).id
	op.timestamp   = event.block.timestamp
	op.account     = event.params.owner.toHex()
	op.value       = value
	op.from        = event.params.owner.toHex()
	op.save()
}

export function handleDepositFor(event: DepositForEvent): void {
	let value = toRLC(event.params.amount)

	let account = fetchAccount(event.params.target.toHex())
	account.balance += value
	account.save()

	fetchAccount(event.params.owner.toHex()).save()

	let op         = new Deposit(createEventID(event))
	op.transaction = logTransaction(event).id
	op.timestamp   = event.block.timestamp
	op.account     = event.params.target.toHex()
	op.value       = value
	op.from        = event.params.owner.toHex()
	op.save()
}

export function handleWithdraw(event: WithdrawEvent): void {
	let value = toRLC(event.params.amount)

	let account = fetchAccount(event.params.owner.toHex())
	account.balance -= value
	account.save()

	let op         = new Withdraw(createEventID(event))
	op.transaction = logTransaction(event).id
	op.timestamp   = event.block.timestamp
	op.account     = event.params.owner.toHex()
	op.value       = value
	op.to          = event.params.owner.toHex()
	op.save()
}

export function handleReward(event: RewardEvent): void {
	let value = toRLC(event.params.amount)

	let account = fetchAccount(event.params.user.toHex())
	account.balance += value
	account.save()

	let op         = new Reward(createEventID(event))
	op.transaction = logTransaction(event).id
	op.timestamp   = event.block.timestamp
	op.account     = event.params.user.toHex()
	op.value       = value
	op.task        = event.params.ref.toHex()
	op.save()
}

export function handleSeize(event: SeizeEvent): void {
	let value = toRLC(event.params.amount)

	let account = fetchAccount(event.params.user.toHex())
	account.frozen -= value
	account.save()

	let op         = new Seize(createEventID(event))
	op.transaction = logTransaction(event).id
	op.timestamp   = event.block.timestamp
	op.account     = event.params.user.toHex()
	op.value       = value
	op.task        = event.params.ref.toHex()
	op.save()
}

export function handleLock(event: LockEvent): void {
	let value = toRLC(event.params.amount)

	let account = fetchAccount(event.params.user.toHex())
	account.balance -= value
	account.frozen  += value
	account.save()

	let op         = new Lock(createEventID(event))
	op.transaction = logTransaction(event).id
	op.timestamp   = event.block.timestamp
	op.account     = event.params.user.toHex()
	op.value       = value
	op.save()
}

export function handleUnlock(event: UnlockEvent): void {
	let value = toRLC(event.params.amount)

	let account = fetchAccount(event.params.user.toHex())
	account.balance += value
	account.frozen  -= value
	account.save()

	let op         = new Unlock(createEventID(event))
	op.transaction = logTransaction(event).id
	op.timestamp   = event.block.timestamp
	op.account     = event.params.user.toHex()
	op.value       = value
	op.save()
}
