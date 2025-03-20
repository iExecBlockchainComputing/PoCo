
import { encodeFunctionData, encodePacked, parseAbi, size } from "viem";
import { safeAbiImplementation } from "./safeAbi.mjs";

const SAFE_MODULE_SETUP_ADDRESS = "0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47";
const SAFE_4337_MODULE_ADDRESS = "0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226";

export const getSafeModuleSetupData = () => {
    const enable4337ModuleCallData = encodeFunctionData({
        abi: safeAbiImplementation,
        functionName: "enableModules",
        args: [[SAFE_4337_MODULE_ADDRESS]],
    });

    const encodedMultiSendTransaction = encodePacked(
        ["uint8", "address", "uint256", "uint256", "bytes"],
        [
            1,
            SAFE_MODULE_SETUP_ADDRESS,
            0n,
            BigInt(size(enable4337ModuleCallData)),
            enable4337ModuleCallData,
        ],
    );

    const safeModuleSetupCallData = encodeFunctionData({
        abi: parseAbi(["function multiSend(bytes)"]),
        functionName: "multiSend",
        args: [encodedMultiSendTransaction],
    });

    return safeModuleSetupCallData;
};

export default getSafeModuleSetupData;
