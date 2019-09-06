import {
	IexecClerk as IexecClerkContract,
	OrdersMatched as OrdersMatchedEvent,
	SchedulerNotice as SchedulerNoticeEvent,
} from '../../generated/IexecClerk/IexecClerk'

import {
	Account,
	Deal,
	SchedulerNotice,
} from '../../generated/schema'

import {
	createEventID,
	fetchAccount,
	toRLC,
} from '../utils'

export function handleOrdersMatched(event: OrdersMatchedEvent): void {
	let contract = IexecClerkContract.bind(event.address)
	let deal     = contract.viewDeal(event.params.dealid)

	fetchAccount(deal.requester.toHex()).save()
	fetchAccount(deal.beneficiary.toHex()).save()
	fetchAccount(deal.callback.toHex()).save()

	let d = new Deal(event.params.dealid.toHex())
	d.app                  = deal.app.pointer.toHex()
	d.appOwner             = deal.app.owner.toHex()
	d.appPrice             = toRLC(deal.app.price)
	d.dataset              = deal.dataset.pointer.toHex()
	d.datasetOwner         = deal.dataset.owner.toHex()
	d.datasetPrice         = toRLC(deal.dataset.price)
	d.workerpool           = deal.workerpool.pointer.toHex()
	d.workerpoolOwner      = deal.workerpool.owner.toHex()
	d.workerpoolPrice      = toRLC(deal.workerpool.price)
	d.trust                = deal.trust
	d.category             = deal.category.toString()
	d.tag                  = deal.tag
	d.requester            = deal.requester.toHex()
	d.beneficiary          = deal.beneficiary.toHex()
	d.callback             = deal.callback.toHex()
	d.params               = deal.params
	d.startTime            = deal.startTime
	d.botFirst             = deal.botFirst
	d.botSize              = deal.botSize
	d.workerStake          = deal.workerStake
	d.schedulerRewardRatio = deal.schedulerRewardRatio
	d.save()
}

export function handleSchedulerNotice(event: SchedulerNoticeEvent): void {
	let e = new SchedulerNotice(createEventID(event))
	e.workerpool = event.params.workerpool.toHex()
	e.deal       = event.params.dealid.toHex()
	e.save()
}
