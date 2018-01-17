pragma solidity ^0.4.18;
import './OwnableOZ.sol';
/**
 * WHITELIST AND BLACKLIST POLICY
 */
contract AuthorizedList is OwnableOZ
{

	enum ListPolicyEnum { WHITELIST, BLACKLIST }

	event PolicyChange(ListPolicyEnum oldPolicy,ListPolicyEnum newPolicy);
	event WhitelistChange(address actor, bool isWhitelisted);
	event BlacklistChange(address actor, bool isBlacklisted);

	ListPolicyEnum public policy = ListPolicyEnum.WHITELIST;

	mapping(address => bool) whitelist;
	mapping(address => bool) blacklist;

	modifier checkWhitelist(address _actor)
	{
		require(policy == ListPolicyEnum.BLACKLIST || whitelist[_actor] == true);
		_;
	}

	modifier checkBlacklist(address _actor)
	{
		require(policy == ListPolicyEnum.WHITELIST || blacklist[_actor] == false);
		_;
	}

	function changeListPolicy(ListPolicyEnum _policyEnum) public onlyOwner
	{
		PolicyChange(policy,_policyEnum);
		policy = _policyEnum;
	}

	function updateWhitelist(address _actor, bool _isWhitelisted) public onlyOwner
	{
		whitelist[_actor] = _isWhitelisted;
		WhitelistChange(_actor, _isWhitelisted);
	}

	function updateBlacklist(address _actor, bool _isBlacklisted) public onlyOwner
	{
			blacklist[_actor] = _isBlacklisted;
			BlacklistChange(_actor, _isBlacklisted);
	}

	function updateWhitelist(address[] _actors, bool _isWhitelisted) public onlyOwner
	{
		for (uint i = 0; i < _actors.length; ++i)
		{
			updateWhitelist(_actors[i], _isWhitelisted);
		}
	}

	function updateBlacklist(address[] _actors, bool _isBlacklisted) public onlyOwner
	{
		for (uint i = 0; i < _actors.length; ++i)
		{
			updateBlacklist(_actors[i], _isBlacklisted);
		}
	}

	function isWhitelisted(address _actor) public view returns (bool)
	{
		return whitelist[_actor];
	}

	function isblacklisted(address _actor) public view returns (bool)
	{
		return blacklist[_actor];
	}

	function isActorAllowed(address _actor) public view returns (bool)
	{
		if(policy == ListPolicyEnum.WHITELIST)
		{
			return isWhitelisted(_actor);
		}
		else
		{
			return !isblacklisted(_actor);
		}
	}
}
