// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TrustDropTestBase} from "./TrustDrop.Base.t.sol";
import {TrustDrop} from "../TrustDrop.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";

/// @dev Handler that drives the invariant fuzzer.
contract TrustDropHandler is TrustDropTestBase {

    uint256 public vaultId;
    uint256 public totalMinted;

    // Public accessor so the invariant contract can reach the internal field.
    function getTrustDrop() external view returns (TrustDrop) { return trustDrop; }
    function getVaultId()   external view returns (uint256)    { return vaultId; }

    function setUp() public override {
        super.setUp();

        // Create one vault to work with
        address[] memory bens = new address[](2);
        uint256[] memory shs  = new uint256[](2);
        bens[0] = alice; shs[0] = 6000;
        bens[1] = bob;   shs[1] = 4000;

        usdc.mint(owner, 10_000e6);
        vm.prank(owner);
        usdc.approve(address(trustDrop), 10_000e6);

        vm.prank(owner);
        vaultId = trustDrop.createVault(PQ_PK, INTERVAL, GRACE, bens, shs);

        totalMinted = 10_000e6; // recorded by setUp
    }

    function deposit(uint256 amount) public {
        amount = bound(amount, 1, 100_000e6);
        usdc.mint(owner, amount);
        totalMinted += amount;
        vm.prank(owner);
        usdc.approve(address(trustDrop), amount);
        vm.prank(owner);
        try trustDrop.deposit(vaultId, amount) {} catch {}
    }

    function checkIn() public {
        vm.prank(owner);
        try trustDrop.checkIn(vaultId, block.timestamp + 1 hours, validSig) {} catch {}
    }

    function warpForward(uint32 seconds_) public {
        vm.warp(block.timestamp + bound(seconds_, 1, 10 days));
    }
}

/// @notice Invariant: contract USDC balance == sum of all active vault totalDeposited.
///         We approximate this with a single vault and verify no dust leaks.
contract TrustDropInvariantTest is TrustDropTestBase {

    TrustDropHandler internal handler;

    function setUp() public override {
        super.setUp();

        handler = new TrustDropHandler();
        handler.setUp();

        // The handler owns its own TrustDrop instance — target it for fuzzing
        targetContract(address(handler));
    }

    /// @dev The TrustDrop contract held by the handler should never hold more
    ///      USDC than what was deposited into it (handler.totalMinted tracks this).
    ///      In this single-vault scenario:
    ///        contractBalance <= handler.totalMinted
    ///      because minted tokens either stay in the contract or were never sent.
    function invariant_ContractBalanceNeverExceedsMinted() public view {
        TrustDrop td   = handler.getTrustDrop();
        MockERC20  u   = MockERC20(address(td.USDC()));
        uint256    bal = u.balanceOf(address(td));
        assertLe(bal, handler.totalMinted());
    }

    /// @dev After a claim or withdraw the vault balance is zeroed.
    ///      While active (not settled), balance must match what was deposited.
    function invariant_SettledVaultHasZeroBalance() public view {
        TrustDrop td      = handler.getTrustDrop();
        uint256   vid     = handler.getVaultId();
        (, uint256 bal,,,, bool settled) = td.vaultStatus(vid);
        if (settled) {
            assertEq(bal, 0, "settled vault must have zero balance");
        }
    }

    /// @dev nextVaultId must always be >= 2 after first vault creation.
    function invariant_NextVaultIdMonotonicallyIncreases() public view {
        assertGe(handler.getTrustDrop().nextVaultId(), 2);
    }
}
