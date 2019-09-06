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
	Account,
	Dataset,
} from '../../generated/schema'

import {
	fetchAccount,
} from '../utils'

export function handleCreateDataset(event: CreateDatasetEvent): void
{
	let contract = DatasetContract.bind(event.params.dataset)

	fetchAccount(contract.owner().toHex()).save()

	let dataset = new Dataset(event.params.dataset.toHex())
	dataset.owner     = contract.owner().toHex()
	dataset.name      = contract.m_datasetName()
	dataset.multiaddr = contract.m_datasetMultiaddr()
	dataset.checksum  = contract.m_datasetChecksum()
	dataset.save()
}
