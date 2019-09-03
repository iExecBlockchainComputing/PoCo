import { CreateDatasetCall } from '../generated/DatasetRegistry/DatasetRegistry'
import { Dataset } from '../generated/schema'

export function handleCreateDatasetCall(call: CreateDatasetCall): void
{
	let dataset = new Dataset(call.outputs.value0.toHex())
	dataset.owner     = call.inputs._datasetOwner.toHex()
	dataset.name      = call.inputs._datasetName
	dataset.multiaddr = call.inputs._datasetMultiaddr
	dataset.checksum  = call.inputs._datasetChecksum.toHex()
	dataset.save()
}
