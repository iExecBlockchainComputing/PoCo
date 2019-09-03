import { InitializeCall, TaskInitialize } from '../generated/IexecInterface/IexecInterface'
import { App, Dataset, Workerpool, Category, Deal, Task, Contribution } from '../generated/schema'

import { EthereumBlock } from '@graphprotocol/graph-ts'

export function handleBlock(block: EthereumBlock): void {
  let id = block.hash.toHex()
  let entity = new App(id)
  entity.save()
}



// export function handleInitialize(call: InitializeCall): void {
// 	let dealid = call.inputs._dealid.toHex()
// 	let index  = call.inputs.idx
// 	let taskid = call.outputs.value0.toHex()
//
// 	let deal = Deal.load(dealid) || new Deal(dealid)
// 	let task = Task.load(taskid) || new Task(taskid)
//
// 	task.status = "ACTIVE"
// 	task.index  = index
// 	task.dealid = dealid
//
// 	deal.save()
// 	task.save()
// }
//
// export function handleTaskInitialize(event: TaskInitialize): void {
// 	let taskid = event.params.taskid.toHex()
// 	let task = Task.load(taskid) || new Task(taskid)
// 	task.save()
// }
