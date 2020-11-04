// SPDX-License-Identifier: Apache-2.0

/******************************************************************************
 * Copyright 2020 IEXEC BLOCKCHAIN TECH                                       *
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

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../DelegateBase.sol";


contract IexecERC20Core is DelegateBase
{
	using SafeMathExtended for uint256;

	event Transfer(address indexed from, address indexed to, uint256 value);
	event Approval(address indexed owner, address indexed spender, uint256 value);

	function _isAuthorized(address)
	internal virtual returns (bool)
	{
		return true;
	}

	function _beforeTokenTransfer(address from, address to, uint256 amount)
	internal virtual
	{
	}

	function _transferUnchecked(address sender, address recipient, uint256 amount)
	internal
	{
		require(sender != address(0), 'ERC20: transfer from the zero address');
		require(recipient != address(0), 'ERC20: transfer to the zero address');

		m_balances[sender] = m_balances[sender].sub(amount);
		m_balances[recipient] = m_balances[recipient].add(amount);
		emit Transfer(sender, recipient, amount);
	}

	function _transfer(address sender, address recipient, uint256 amount)
	internal
	{
		_beforeTokenTransfer(sender, recipient, amount);
		_transferUnchecked(sender, recipient, amount);
	}

	function _mint(address account, uint256 amount)
	internal
	{
		require(account != address(0), 'ERC20: mint to the zero address');

		_beforeTokenTransfer(address(0), account, amount);

		m_totalSupply = m_totalSupply.add(amount);
		m_balances[account] = m_balances[account].add(amount);
		emit Transfer(address(0), account, amount);
	}

	function _burn(address account, uint256 amount)
	internal
	{
		require(account != address(0), 'ERC20: burn from the zero address');

		_beforeTokenTransfer(account, address(0), amount);

		m_totalSupply = m_totalSupply.sub(amount);
		m_balances[account] = m_balances[account].sub(amount);
		emit Transfer(account, address(0), amount);
	}

	function _approve(address owner, address spender, uint256 amount)
	internal
	{
		require(owner != address(0), 'ERC20: approve from the zero address');
		require(spender != address(0), 'ERC20: approve to the zero address');

		m_allowances[owner][spender] = amount;
		emit Approval(owner, spender, amount);
	}

	/***************************************************************************
	 *                        Escrow methods: internal                         *
	 ***************************************************************************/
	event Reward(address owner, uint256 amount, bytes32 ref);
	event Seize (address owner, uint256 amount, bytes32 ref);
	event Lock  (address owner, uint256 amount);
	event Unlock(address owner, uint256 amount);

	function reward(address user, uint256 amount, bytes32 ref)
	internal /* returns (bool) */
	{
		_transferUnchecked(address(this), user, amount); // prevent locking task
		emit Reward(user, amount, ref);
		/* return true; */
	}

	function seize(address user, uint256 amount, bytes32 ref)
	internal /* returns (bool) */
	{
		m_frozens[user] = m_frozens[user].sub(amount);
		emit Seize(user, amount, ref);
		/* return true; */
	}

	function lock(address user, uint256 amount)
	internal /* returns (bool) */
	{
		_transferUnchecked(user, address(this), amount);
		m_frozens[user] = m_frozens[user].add(amount);
		emit Lock(user, amount);
		/* return true; */
	}

	function unlock(address user, uint256 amount)
	internal /* returns (bool) */
	{
		_transferUnchecked(address(this), user, amount); // prevent locking task
		m_frozens[user] = m_frozens[user].sub(amount);
		emit Unlock(user, amount);
		/* return true; */
	}

	/***************************************************************************
	 *                    Escrow overhead for contribution                     *
	 ***************************************************************************/
	function lockContribution(bytes32 _dealid, address _worker)
	internal
	{
		lock(_worker, m_deals[_dealid].workerStake);
	}

	function unlockContribution(bytes32 _dealid, address _worker)
	internal
	{
		unlock(_worker, m_deals[_dealid].workerStake);
	}

	function rewardForContribution(address _worker, uint256 _amount, bytes32 _taskid)
	internal
	{
		reward(_worker, _amount, _taskid);
	}

	function seizeContribution(bytes32 _dealid, address _worker, bytes32 _taskid)
	internal
	{
		seize(_worker, m_deals[_dealid].workerStake, _taskid);
	}

	function rewardForScheduling(bytes32 _dealid, uint256 _amount, bytes32 _taskid)
	internal
	{
		reward(m_deals[_dealid].workerpool.owner, _amount, _taskid);
	}
}
