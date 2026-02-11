// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestToken
 * @dev Simple ERC20 token for testing Orbitwork escrow functionality
 * Initial supply: 100,000,000 tokens
 */
contract TestToken is ERC20, Ownable {
    constructor() ERC20("Orbitwork Test Token", "OWT") Ownable(msg.sender) {
        // Mint 100 million tokens to deployer
        _mint(msg.sender, 100_000_000 * 10**decimals());
    }

    /**
     * @dev Mint additional tokens (only owner)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Burn tokens
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
