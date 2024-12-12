// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

interface IMEVStake {
    event Staked(address indexed stakerAddress, uint256 amount);
    event Unstaked(address indexed stakerAddress);

    function stake() external;

    /// @notice Allows a user to unstake their tokens and claim rewards.
    function unstake() external;

    /// @notice Unlocks the caller's stake and resets their balance and rewards.
    function unlock() external;

    /// @notice Unlocks the stake for a specific address with a specified reward amount.
    /// @param _stakeAddress The address of the staker whose stake is to be unlocked.
    /// @param _reward The reward amount to assign to the staker.
    function unlockStake(address _stakeAddress, uint256 _reward) external;

    /// @notice Returns the stake balance of a specific address.
    /// @param _staker The address of the staker.
    /// @return The stake balance of the staker.
    function stakeBalance(address _staker) external view returns (uint256);

    /// @notice Checks if the stake of a specific address is locked.
    /// @param _staker The address of the staker.
    /// @return True if the stake is locked, otherwise false.
    function stakeLocked(address _staker) external view returns (bool);

    /// @notice Returns the reward balance of a specific address.
    /// @param _staker The address of the staker.
    /// @return The reward balance of the staker.
    function rewards(address _staker) external view returns (uint256);

    /// @notice Returns the address of the staking token.
    /// @return The address of the staking token.
    function STAKING_TOKEN() external view returns (address);

    /// @notice Returns the address of the MEV insurance pool contract.
    /// @return The address of the MEV insurance pool contract.
    function MEVInsurancePoolContract() external view returns (address);

    /// @notice Returns the fixed stake amount required for staking.
    /// @return The fixed stake amount.
    function STAKE_AMOUNT() external view returns (uint256);
}
