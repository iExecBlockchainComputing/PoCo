export const safeAbiImplementation = [
    {
        inputs: [
            {
                internalType: "address[]",
                name: "modules",
                type: "address[]",
            },
        ],
        name: "enableModules",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            { internalType: "address[]", name: "_owners", type: "address[]" },
            { internalType: "uint256", name: "_threshold", type: "uint256" },
            { internalType: "address", name: "to", type: "address" },
            { internalType: "bytes", name: "data", type: "bytes" },
            { internalType: "address", name: "fallbackHandler", type: "address" },
            { internalType: "address", name: "paymentToken", type: "address" },
            { internalType: "uint256", name: "payment", type: "uint256" },
            {
                internalType: "address payable",
                name: "paymentReceiver",
                type: "address",
            },
        ],
        name: "setup",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
];

export default safeAbiImplementation;
