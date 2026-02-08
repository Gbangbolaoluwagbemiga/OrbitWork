// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Mock USDC token for testing on Unichain testnet
 */
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {
        // Mint 1 million USDC (6 decimals) to deployer
        _mint(msg.sender, 1_000_000 * 10**6);
    }
    
    function decimals() public pure override returns (uint8) {
        return 6;
    }
    
    // Allow anyone to mint for testing
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
