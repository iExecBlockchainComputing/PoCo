import { CreateWorkerpoolCall } from '../generated/WorkerpoolRegistry/WorkerpoolRegistry'
import { Workerpool } from '../generated/schema'

export function handleCreateWorkerpoolCall(call: CreateWorkerpoolCall): void
{
	let workerpool = new Workerpool(call.outputs.value0.toHex())
	workerpool.owner       = call.inputs._workerpoolOwner.toHex()
	workerpool.description = call.inputs._workerpoolDescription
	workerpool.save()
}
