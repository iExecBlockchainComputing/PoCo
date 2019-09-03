import { Deposit, DepositFor, Withdraw, Reward, Seize, Lock, Unlock } from '../generated/IexecClerk/IexecClerk'
import { AccountDeposit, AccountWithdraw, AccountReward, AccountSeize, AccountLock, AccountUnlock } from '../generated/schema'

export function handleDeposit(event: Deposit): void {
	let txhash  = event.transaction.hash.toHex()
	let evindex = event.transactionLogIndex

	let o     = new AccountDeposit(`${txhash}-${evindex}`)
	o.account = event.params.owner.toHex()
	o.value   = event.params.amount
	o.sender  = event.params.owner.toHex()
	o.save()
}

export function handleDepositFor(event: DepositFor): void {
	let txhash  = event.transaction.hash.toHex()
	let evindex = event.transactionLogIndex

	let o     = new AccountDeposit(`${txhash}-${evindex}`)
	o.account = event.params.target.toHex()
	o.value   = event.params.amount
	o.sender  = event.params.owner.toHex()
	o.save()
}

export function handleWithdraw(event: Withdraw): void {
	let txhash  = event.transaction.hash.toHex()
	let evindex = event.transactionLogIndex

	let o      = new AccountWithdraw(`${txhash}-${evindex}`)
	o.account  = event.params.owner.toHex()
	o.value    = event.params.amount
	o.receiver = event.params.owner.toHex()
	o.save()
}

export function handleReward(event: Reward): void {
	let txhash  = event.transaction.hash.toHex()
	let evindex = event.transactionLogIndex

	let o     = new AccountReward(`${txhash}-${evindex}`)
	o.account = event.params.user.toHex()
	o.value   = event.params.amount
	o.task    = event.params.ref.toHex()
	o.save()
}

export function handleSeize(event: Seize): void {
	let txhash  = event.transaction.hash.toHex()
	let evindex = event.transactionLogIndex

	let o     = new AccountSeize(`${txhash}-${evindex}`)
	o.account = event.params.user.toHex()
	o.value   = event.params.amount
	o.task    = event.params.ref.toHex()
	o.save()
}

export function handleLock(event: Lock): void {
	let txhash  = event.transaction.hash.toHex()
	let evindex = event.transactionLogIndex

	let o     = new AccountLock(`${txhash}-${evindex}`)
	o.account = event.params.user.toHex()
	o.value   = event.params.amount
	o.save()
}

export function handleUnlock(event: Unlock): void {
	let txhash  = event.transaction.hash.toHex()
	let evindex = event.transactionLogIndex

	let o     = new AccountUnlock(`${txhash}-${evindex}`)
	o.account = event.params.user.toHex()
	o.value   = event.params.amount
	o.save()
}
