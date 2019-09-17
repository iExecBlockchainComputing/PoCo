import {
	IexecClerk               as IexecClerkContract,
	OrdersMatched            as OrdersMatchedEvent,
	SchedulerNotice          as SchedulerNoticeEvent,
	// BroadcastAppOrder        as BroadcastAppOrderEvent,
	// BroadcastDatasetOrder    as BroadcastDatasetOrderEvent,
	// BroadcastWorkerpoolOrder as BroadcastWorkerpoolOrderEvent,
	// BroadcastRequestOrder    as BroadcastRequestOrderEvent,
	// ClosedAppOrder           as ClosedAppOrderEvent,
	// ClosedDatasetOrder       as ClosedDatasetOrderEvent,
	// ClosedWorkerpoolOrder    as ClosedWorkerpoolOrderEvent,
	// ClosedRequestOrder       as ClosedRequestOrderEvent,
} from '../../generated/IexecClerk/IexecClerk'

import {
	Account,
	// AppOrder,
	// DatasetOrder,
	// WorkerpoolOrder,
	// RequestOrder,
	Deal,
	SchedulerNotice,
} from '../../generated/schema'

import {
	createEventID,
	fetchAccount,
	logTransaction,
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
	e.transaction = logTransaction(event).id
	e.timestamp   = event.block.timestamp
	e.workerpool  = event.params.workerpool.toHex()
	e.deal        = event.params.dealid.toHex()
	e.save()
}

// export function handleBroadcastAppOrder(event: BroadcastAppOrderEvent): void {
// 	let orderID = "<TODO>"
// 	let order = new AppOrder(orderID)
// 	// order
// 	order.save()
// }
// export function handleBroadcastDatasetOrder(event: BroadcastDatasetOrderEvent): void {
// 	let orderID = "<TODO>"
// 	let order = new DatasetOrder(orderID)
// 	// order
// 	order.save()
// }
// export function handleBroadcastWorkerpoolOrder(event: BroadcastWorkerpoolOrderEvent): void {
// 	let orderID = "<TODO>"
// 	let order = new WorkerpoolOrder(orderID)
// 	// order
// 	order.save()
// }
// export function handleBroadcastRequestOrder(event: BroadcastRequestOrderEvent): void {
// 	let orderID = "<TODO>"
// 	let order = new RequestOrder(orderID)
// 	// order
// 	order.save()
// }
//
// export function handleClosedAppOrder(event: ClosedAppOrderEvent): void {
// 	// Delete AppOrder(event.params.appHash)
// }
//
// export function handleClosedDatasetOrder(event: ClosedDatasetOrderEvent): void {
// 	// Delete DatasetOrder(event.params.datasetHash)
// }
//
// export function handleClosedWorkerpoolOrder(event: ClosedWorkerpoolOrderEvent): void {
// 	// Delete WorkerpoolOrder(event.params.workerpoolHash)
// }
//
// export function handleClosedRequestOrder(event: ClosedRequestOrderEvent): void {
// 	// Delete RequestOrder(event.params.requestHash)
// }
