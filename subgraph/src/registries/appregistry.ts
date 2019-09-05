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

import {
	fetchAccount,
} from '../utils'

export function handleCreateApp(event: CreateAppEvent): void
{
	let contract = AppContract.bind(event.params.app)

	fetchAccount(contract.owner().toHex()).save()

	let app = new App(event.params.app.toHex())
	app.owner     = contract.owner().toHex()
	app.name      = contract.m_appName()
	app.type      = contract.m_appType()
	app.multiaddr = contract.m_appMultiaddr()
	app.checksum  = contract.m_appChecksum()
	app.mrenclave = contract.m_appMREnclave()
	app.save()
}
