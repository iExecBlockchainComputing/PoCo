import {
	IexecClerk as IexecClerkContract,
	OrdersMatched as OrdersMatchedEvent,
} from '../../generated/IexecClerk/IexecClerk'

import {
	Account,
	Deal,
} from '../../generated/schema'

import {
	initAccount,
	toRLC,
} from '../utils'

export function handleOrdersMatched(event: OrdersMatchedEvent): void {
	let contract = IexecClerkContract.bind(event.address)
	let deal     = contract.viewDeal(event.params.dealid)

	initAccount(deal.requester.toHex())
	initAccount(deal.beneficiary.toHex())
	initAccount(deal.callback.toHex())

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
