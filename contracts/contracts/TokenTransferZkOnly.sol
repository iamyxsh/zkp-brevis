// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./lib/BrevisAppZkOnly.sol";
import {IMEVStake} from "./interfaces/IMEVStake.sol";
import "hardhat/console.sol";

// Only accept ZK-attested results.
contract DextrZK is BrevisAppZkOnly, Ownable {
    bytes32 public vkHash;
    uint256 public immutable Reward;
    IMEVStake public mevStake;
    event Positive(address challengerAddress, bytes32 orderHash);
    event Negative(address challengerAddress, bytes32 orderHash);

    constructor(
        address _brevisRequest,
        IMEVStake _mevStake,
        uint256 _reward,
        bytes32 _vkHash
    ) BrevisAppZkOnly(_brevisRequest) Ownable(0x0E2fc85E732C7e355b1CF9b8E0549D6De8dA563e) {
        mevStake = _mevStake;
        Reward = _reward;
        vkHash = _vkHash;
    }

    // BrevisQuery contract will call our callback once Brevis backend submits the proof.
    // This method is called with once the proof is verified.
    function handleProofResult(bytes32 _vkHash, bytes calldata _circuitOutput) internal override {
        require(vkHash == _vkHash, "invalid vk");
        (bool ok, address challengerAddress, bytes32 orderHash) = decodeOutput(_circuitOutput);

        if (ok) {
            mevStake.unlockStake(challengerAddress, Reward);
            emit Positive(challengerAddress, orderHash);
        } else {
            emit Negative(challengerAddress, orderHash);
        }
    }

    function decodeOutput(bytes calldata o) public pure returns (bool, address, bytes32) {
        require(o.length >= 65, "Invalid input length");

        bool isGreater = o[0] != 0;

        address challengerAddress = address(bytes20(o[1:21]));

        bytes32 orderHash = bytes32(o[33:65]);

        return (isGreater, challengerAddress, orderHash);
    }

    function setVkHash(bytes32 _vkHash) external onlyOwner {
        vkHash = _vkHash;
    }

    function setMevStake(address _mevStake) external onlyOwner {
        mevStake = IMEVStake(_mevStake);
    }
}
