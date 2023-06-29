import { IexecLibOrders_v5 } from '../typechain';
import constants from './constants';

export function createEmptyAppOrder(): IexecLibOrders_v5.AppOrderStruct {
  return {
    app: constants.NULL.ADDRESS,
    appprice: 0,
    volume: 0,
    tag: constants.NULL.BYTES32,
    datasetrestrict: constants.NULL.ADDRESS,
    workerpoolrestrict: constants.NULL.ADDRESS,
    requesterrestrict: constants.NULL.ADDRESS,
    salt: constants.NULL.BYTES32,
    sign: constants.NULL.BYTES32,
  };
}

export function createEmptyRequestOrder(): IexecLibOrders_v5.RequestOrderStruct {
  return {
    app: constants.NULL.ADDRESS,
    appmaxprice: 0,
    dataset: constants.NULL.ADDRESS,
    datasetmaxprice: 0,
    workerpool: constants.NULL.ADDRESS,
    workerpoolmaxprice: 0,
    volume: 0,
    tag: constants.NULL.BYTES32,
    category: 0,
    trust: 0,
    requester: constants.NULL.ADDRESS,
    beneficiary: constants.NULL.ADDRESS,
    callback: constants.NULL.ADDRESS,
    params: '',
    salt: constants.NULL.BYTES32,
    sign: constants.NULL.BYTES32,
  };
}
