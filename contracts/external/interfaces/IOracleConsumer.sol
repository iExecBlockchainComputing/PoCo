// SPDX-License-Identifier: Apache-2.0

/******************************************************************************
 * Copyright 2023 IEXEC BLOCKCHAIN TECH                                       *
 *                                                                            *
 * Licensed under the Apache License, Version 2.0 (the "License");            *
 * you may not use this file except in compliance with the License.           *
 * You may obtain a copy of the License at                                    *
 *                                                                            *
 *     http://www.apache.org/licenses/LICENSE-2.0                             *
 *                                                                            *
 * Unless required by applicable law or agreed to in writing, software        *
 * distributed under the License is distributed on an "AS IS" BASIS,          *
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.   *
 * See the License for the specific language governing permissions and        *
 * limitations under the License.                                             *
 ******************************************************************************/

pragma solidity ^0.8.0;

/**
 * @title Predefined interface of a contract that consumes the callback value
 * submitted through a push result operation.
 */
interface IOracleConsumer {
    /**
     * Function called by PoCo contracts to consume the callback value.
     * @param taskId id of the task.
     * @param resultsCallback payload of the callback value.
     */
    function receiveResult(bytes32 taskId, bytes calldata resultsCallback) external;
}
