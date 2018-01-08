pragma solidity ^0.4.18;


import "./IDappHub.sol";
import "./IWorkerPoolHub.sol";
import "./IStake.sol";
import "./IScoring.sol";

contract IPoco is IDappHub , IWorkerPoolHub, IStake , IScoring  {
/*

  Introduction :

  Symbols :
   (w) = an account with a wallet key pair
   (s) = a smart contract created by (w)
   (p) = application to start ( like java prog xtremweb, geth  node, iexec-sdk  ...) on the responsability of (w) when used

  Actors :

  Poco(s) = poco smart contract

  D(w) = dapp Provider wallet
  D(s) = DappContract =  dapp smart contract created by D(w)
  D(p) = AppProvider =  provide app reference on the responsability of D(w). . (apps, datas for apps in xtremweb, docker hub for docker app etc ... )

  S(w) = Scheduler Provider wallet
  S(s) = WorkerPoolContract = worker pool smart contract owned by S(w)
  S(p) = Scheduler = application that schedule a worker pool activity and provide the task result for U(w). on the responsability of S(w). (works, tasks, datas for result in xtremweb)

  W(w) = Worker Provider wallet
  W(p) = Worker = xtremweb worker application today

  U(w) = dapp User wallet.

   MCD :
   Dapp : create by D(w)
   Task : created by U(w)
   Work : asked by S(w) for a W(w) to execute a Task given by U(w),

   off-chain uri(s) :
   D(w) has responsability to provide a working dapp uri. (quick solution xw datas xwapps of existing xtremweb, or IPFS, DockerHub etc ...). uri reference stored in D(s).
   S(w) has responsability to provide a working result uri (quick solution xw datas of existing xtremweb, or IPFS etc ...). uri is stored in MCD Task in S(s) when completeTask is call by S(w)


   accreditation :
   S(w) can white or black list D(s) in his S(s)
   S(w) can black list U(w) in his S(s) (see 'eth gas callback cost problem for the scheduler'  after )
   D(w) can white or black list S(s) in his D(s)
   D(w) can black list U(w) in his D(s)


   stake :
   D(w) have to stake a ratio of his dappPrice before a submit call of a user.
   S(w) have to stake a ratio of the taskCost when he acceptTask
   W(w) have to stake a ratio of the taskCost when he contribute to a task

  loose of stake :
  1) D(w) and S(w) loose the stake if an accepted task (by S(w)) never reach consensus. aka S(w) never call completeTask function.
  After a period, ( definied  in task param or in S(s) by default ? ), U(w) can claim and obtain this D(w) + S(w) stake.
  Possible reation for S(w) to protect himself the next time :
  - do not accepte this kind of U(w) task
  - black list this U(w)
  - black list this D(s)
  Possible reation for D(w) to protect himself the next time :
  - black list this S(s)
  - black list this U(w)
  2) At finalizedTask, wrong W(w) contribution can loose their stake for other W(w) and the S(w)
  Possible reation for W(w) to protect himself the next time :
  - leave this S(s) or be a better worker

   eth gas callback cost problem for the scheduler :
   S(w) will generate a bill (REQ network ) to U(w) with the tx hash callback proof.
   If U(w) do not pay his bills. S(w) has the power to black list U(w) submitTasks . ( has he can also black/white  dapps , workers ... )

  */



    function submitTask(address workerPool, string taskParam, uint taskCost, uint askedTrust, bool dappCallback)  public returns (bool);

    function finalizedTask(bytes32 _taskID,address dapp) public returns (bool);

    // add a scoreWinLooseTask for S(w) S(s) too ?

    function scoreWinTask(bytes32 _taskID,address _worker,uint _value) public returns (bool);

    function scoreLoseTask(bytes32 _taskID,address _worker,uint _value) public returns (bool);



}
