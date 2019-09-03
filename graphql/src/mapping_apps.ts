import { CreateAppCall } from '../generated/AppRegistry/AppRegistry'
import { App } from '../generated/schema'

export function handleCreateAppCall(call: CreateAppCall): void
{
	let app = new App(call.outputs.value0.toHex())
	app.owner     = call.inputs._appOwner.toHex()
	app.name      = call.inputs._appName
	app.type      = call.inputs._appType
	app.multiaddr = call.inputs._appMultiaddr
	app.checksum  = call.inputs._appChecksum.toHex()
	app.mrenclave = call.inputs._appMREnclave
	app.save()
}
