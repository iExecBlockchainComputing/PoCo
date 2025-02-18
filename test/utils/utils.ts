import { IexecLibOrders_v5 } from "../../typechain";
import { ethers } from "hardhat";

export async function hashDomain(domain: IexecLibOrders_v5.EIP712DomainStructOutput) {
    return ethers.TypedDataEncoder.hashDomain({
        name: domain.name,
        version: domain.version,
        chainId: domain.chainId,
        verifyingContract: domain.verifyingContract,
    });
}
