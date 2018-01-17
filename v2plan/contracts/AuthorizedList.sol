pragma solidity ^0.4.18;
import './OwnableOZ.sol';
/**
 * WHITELIST AND BLACKLIST POLICY
 */
contract AuthorizedList is OwnableOZ
{
	enum ListPolicyEnum { WHITELIST, BLACKLIST }

	/**
	 * Members
	 */
	ListPolicyEnum           public m_policy = ListPolicyEnum.WHITELIST;
	mapping(address => bool) public m_whitelist;
	mapping(address => bool) public m_blacklist;

	/**
	 * Events
	 */
	event PolicyChange   (ListPolicyEnum oldPolicy, ListPolicyEnum newPolicy);
	event WhitelistChange(address actor, bool isWhitelisted);
	event BlacklistChange(address actor, bool isBlacklisted);

	/**
	 * Methods
	 */
	modifier checkWhitelist(address _actor)
	{
		require(m_policy == ListPolicyEnum.BLACKLIST || m_whitelist[_actor] == true);
		_;
	}

	modifier checkBlacklist(address _actor)
	{
		require(m_policy == ListPolicyEnum.WHITELIST || m_blacklist[_actor] == false);
		_;
	}

	function changeListPolicy(ListPolicyEnum _policyEnum) public onlyOwner
	{
		PolicyChange(m_policy, _policyEnum);
		m_policy = _policyEnum;
	}

	function updateWhitelist(address _actor, bool _isWhitelisted) public onlyOwner
	{
		m_whitelist[_actor] = _isWhitelisted;
		WhitelistChange(_actor, _isWhitelisted);
	}

	function updateBlacklist(address _actor, bool _isBlacklisted) public onlyOwner
	{
		m_blacklist[_actor] = _isBlacklisted;
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
		return m_whitelist[_actor];
	}

	function isblacklisted(address _actor) public view returns (bool)
	{
		return m_blacklist[_actor];
	}

	function isActorAllowed(address _actor) public view returns (bool)
	{
		if (m_policy == ListPolicyEnum.WHITELIST)
		{
			return isWhitelisted(_actor);
		}
		else
		{
			return !isblacklisted(_actor);
		}
	}
}
