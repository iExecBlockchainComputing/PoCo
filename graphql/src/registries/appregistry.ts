import {
	EthereumEvent,
} from '@graphprotocol/graph-ts'

import {
	App as AppContract,
} from '../../generated/AppRegistry/App'

import {
	CreateApp as CreateAppEvent,
} from '../../generated/AppRegistry/AppRegistry'

import {
	Account,
	App,
} from '../../generated/schema'

function createEventID(event: EthereumEvent): string  { return event.block.number.toString().concat('-').concat(event.logIndex.toString()) }
function fetchAccount (id:    string       ): Account { return ( Account.load(id) || new Account(id) ) as Account }

export function handleCreateApp(event: CreateAppEvent): void
{
	let contract = AppContract.bind(event.params.app)
	let owner    = fetchAccount(contract.owner().toHex()); owner.save()

	let app = new App(event.params.app.toHex())
	app.owner     = owner.id
	app.name      = contract.m_appName()
	app.type      = contract.m_appType()
	app.multiaddr = contract.m_appMultiaddr()
	app.checksum  = contract.m_appChecksum().toHex()
	app.mrenclave = contract.m_appMREnclave()
	app.save()
}
