pragma solidity ^0.5.0;

contract Once
{
	bool private _guard;

	constructor()
	internal
	{
		_guard = false;
	}

	modifier onlyOnce()
	{
		require(!_guard, "already-called");
		_;
		_guard = true;
	}
}
