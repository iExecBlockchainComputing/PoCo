import {
	EthereumEvent,
} from '@graphprotocol/graph-ts'

import {
	Dataset as DatasetContract,
} from '../../generated/DatasetRegistry/Dataset'

import {
	CreateDataset as CreateDatasetEvent,
} from '../../generated/DatasetRegistry/DatasetRegistry'

import {
	Dataset,
} from '../../generated/schema'

function createEventID(event: EthereumEvent): string
{
	return event.block.number.toString().concat('-').concat(event.logIndex.toString())
}

// function fetchAccount(id: string): Account { return ( Account.load(id) || new Account(id) ) as Account }

export function handleCreateDataset(event: CreateDatasetEvent): void
{
	let contract = DatasetContract.bind(event.params.dataset)
	// let owner    = fetchAccount(contract.owner().toHex()); owner.save()

	let dataset = new Dataset(event.params.dataset.toHex())
	// dataset.owner     = owner.id
	dataset.owner     = contract.owner().toHex()
	dataset.name      = contract.m_datasetName()
	dataset.multiaddr = contract.m_datasetMultiaddr()
	dataset.checksum  = contract.m_datasetChecksum().toHex()
	dataset.save()
}
