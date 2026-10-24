// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TrustDropTestBase} from "./TrustDrop.Base.t.sol";
import {TrustDrop} from "../TrustDrop.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice Tests for checkInECDSA and the new security-fix validations in createVault.
///         Uses vm.sign with makeAddrAndKey so the ECDSA owner key is known.
contract TrustDropCheckInECDSATest is TrustDropTestBase {

    // ── ECDSA actor: ownerKey is the private key, ecOwner is the derived address ──
    uint256 internal ownerKey;
    address internal ecOwner;

    function setUp() public override {
        super.setUp();
        // Derive a deterministic address+key pair so we can sign with vm.sign.
        (ecOwner, ownerKey) = makeAddrAndKey("ecOwner");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ──────────────────────────────────────────────────────────────────────────

    /// @dev Create a vault whose owner is ecOwner (not the base `owner`).
    function _createECVault(uint256 initialDeposit) internal returns (uint256 vaultId) {
        address[] memory bens = new address[](1);
        uint256[] memory shs  = new uint256[](1);
        bens[0] = alice;
        shs[0]  = BPS;

        if (initialDeposit > 0) {
            usdc.mint(ecOwner, initialDeposit);
            vm.prank(ecOwner);
            usdc.approve(address(trustDrop), initialDeposit);
        }

        vm.prank(ecOwner);
        vaultId = trustDrop.createVault(PQ_PK, INTERVAL, GRACE, bens, shs);
    }

    /// @dev Build a valid EIP-191 signature for checkInECDSA given the vault's
    ///      current nonce.  The vault nonce is read directly from CheckedIn events
    ///      counting; we accept it as a parameter so callers control it explicitly.
    function _signCheckIn(
        uint256 vaultId,
        uint256 nonce,
        uint256 deadline,
        uint256 signerKey
    ) internal view returns (bytes memory sig) {
        bytes32 digest = keccak256(
            abi.encode("TRUSTDROP_CHECKIN_ECDSA_V1", vaultId, nonce, deadline, block.chainid)
        );
        bytes32 messageHash = MessageHashUtils.toEthSignedMessageHash(digest);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, messageHash);
        sig = abi.encodePacked(r, s, v);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Happy-path: checkInECDSA
    // ──────────────────────────────────────────────────────────────────────────

    function test_CheckInECDSA_UpdatesLastCheckIn() public {
        uint256 vaultId  = _createECVault(0);
        uint256 warpTo   = block.timestamp + 10 days;
        vm.warp(warpTo);

        uint256 dl  = _deadline();
        bytes memory sig = _signCheckIn(vaultId, 0, dl, ownerKey);

        vm.prank(ecOwner);
        trustDrop.checkInECDSA(vaultId, dl, sig);

        (, , uint256 lastCI,,, ) = trustDrop.vaultStatus(vaultId);
        assertEq(lastCI, warpTo, "lastCheckIn should be updated to current timestamp");
    }

    function test_CheckInECDSA_IncrementsNonce() public {
        uint256 vaultId = _createECVault(0);

        // First check-in — nonce 0 → expect event nonce=0
        uint256 dl0  = _deadline();
        bytes memory sig0 = _signCheckIn(vaultId, 0, dl0, ownerKey);

        vm.prank(ecOwner);
        vm.expectEmit(true, true, false, true, address(trustDrop));
        emit TrustDrop.CheckedIn(vaultId, 0, block.timestamp);
        trustDrop.checkInECDSA(vaultId, dl0, sig0);

        // Second check-in — nonce 1 → expect event nonce=1
        uint256 dl1  = _deadline();
        bytes memory sig1 = _signCheckIn(vaultId, 1, dl1, ownerKey);

        vm.prank(ecOwner);
        vm.expectEmit(true, true, false, false, address(trustDrop));
        emit TrustDrop.CheckedIn(vaultId, 1, block.timestamp);
        trustDrop.checkInECDSA(vaultId, dl1, sig1);
    }

    function test_CheckInECDSA_EmitsCheckedIn() public {
        uint256 vaultId = _createECVault(0);
        uint256 dl      = _deadline();
        bytes memory sig = _signCheckIn(vaultId, 0, dl, ownerKey);

        vm.prank(ecOwner);
        vm.expectEmit(true, true, false, true, address(trustDrop));
        emit TrustDrop.CheckedIn(vaultId, 0, block.timestamp);
        trustDrop.checkInECDSA(vaultId, dl, sig);
    }

    function test_CheckInECDSA_ResetsLapseWindow() public {
        uint256 vaultId = _createECVault(0);

        // Warp close to lapse boundary
        vm.warp(block.timestamp + INTERVAL + GRACE - 1 hours);
        assertFalse(trustDrop.isLapsed(vaultId));

        uint256 dl  = _deadline();
        bytes memory sig = _signCheckIn(vaultId, 0, dl, ownerKey);

        vm.prank(ecOwner);
        trustDrop.checkInECDSA(vaultId, dl, sig);

        // Warp interval + grace from the NEW lastCheckIn — should not be lapsed
        vm.warp(block.timestamp + INTERVAL + GRACE - 1 hours);
        assertFalse(trustDrop.isLapsed(vaultId));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Revert: checkInECDSA — NotOwner
    // ──────────────────────────────────────────────────────────────────────────

    function test_CheckInECDSA_RevertsNotOwner() public {
        uint256 vaultId = _createECVault(0);
        uint256 dl      = _deadline();
        // Sign with a valid key, but call from a different address
        bytes memory sig = _signCheckIn(vaultId, 0, dl, ownerKey);

        vm.prank(stranger);
        vm.expectRevert(TrustDrop.NotOwner.selector);
        trustDrop.checkInECDSA(vaultId, dl, sig);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Revert: checkInECDSA — AlreadySettled
    // ──────────────────────────────────────────────────────────────────────────

    function test_CheckInECDSA_RevertsAlreadySettled() public {
        uint256 vaultId = _createECVault(100e6);
        _warpPastLapse();
        // Anyone can claim to settle
        vm.prank(stranger);
        trustDrop.claim(vaultId);

        uint256 dl  = _deadline();
        bytes memory sig = _signCheckIn(vaultId, 0, dl, ownerKey);

        vm.prank(ecOwner);
        vm.expectRevert(TrustDrop.AlreadySettled.selector);
        trustDrop.checkInECDSA(vaultId, dl, sig);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Revert: checkInECDSA — VaultLapsed (after lapse time)
    // ──────────────────────────────────────────────────────────────────────────

    function test_CheckInECDSA_RevertsVaultLapsed() public {
        uint256 vaultId = _createECVault(0);
        _warpPastLapse();

        assertTrue(trustDrop.isLapsed(vaultId), "precondition: vault must be lapsed");

        uint256 dl  = _deadline();
        bytes memory sig = _signCheckIn(vaultId, 0, dl, ownerKey);

        vm.prank(ecOwner);
        vm.expectRevert(TrustDrop.VaultLapsed.selector);
        trustDrop.checkInECDSA(vaultId, dl, sig);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Revert: checkInECDSA — DeadlineExpired
    // ──────────────────────────────────────────────────────────────────────────

    function test_CheckInECDSA_RevertsDeadlineExpired() public {
        uint256 vaultId    = _createECVault(0);
        uint256 pastDeadline = block.timestamp - 1;
        bytes memory sig   = _signCheckIn(vaultId, 0, pastDeadline, ownerKey);

        vm.prank(ecOwner);
        vm.expectRevert(TrustDrop.DeadlineExpired.selector);
        trustDrop.checkInECDSA(vaultId, pastDeadline, sig);
    }

    function test_CheckInECDSA_AcceptsDeadlineExactlyNow() public {
        // Contract guard is `deadline < block.timestamp` — equality is NOT expired.
        uint256 vaultId = _createECVault(0);
        uint256 dl      = block.timestamp; // exactly now — should succeed
        bytes memory sig = _signCheckIn(vaultId, 0, dl, ownerKey);

        vm.prank(ecOwner);
        trustDrop.checkInECDSA(vaultId, dl, sig); // must not revert

        (, , uint256 lastCI,,, ) = trustDrop.vaultStatus(vaultId);
        assertEq(lastCI, block.timestamp);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Revert: checkInECDSA — InvalidECDSASignature
    // ──────────────────────────────────────────────────────────────────────────

    function test_CheckInECDSA_RevertsWrongSigner() public {
        uint256 vaultId = _createECVault(0);
        uint256 dl      = _deadline();

        // Sign with a different key (stranger's key) — recovered signer ≠ ecOwner
        (, uint256 strangerKey) = makeAddrAndKey("stranger");
        bytes memory sig = _signCheckIn(vaultId, 0, dl, strangerKey);

        vm.prank(ecOwner);
        vm.expectRevert(TrustDrop.InvalidECDSASignature.selector);
        trustDrop.checkInECDSA(vaultId, dl, sig);
    }

    function test_CheckInECDSA_RevertsWrongNonce() public {
        uint256 vaultId = _createECVault(0);
        uint256 dl      = _deadline();

        // Sign with nonce=1 instead of the current nonce=0
        bytes memory sig = _signCheckIn(vaultId, 1, dl, ownerKey);

        vm.prank(ecOwner);
        vm.expectRevert(TrustDrop.InvalidECDSASignature.selector);
        trustDrop.checkInECDSA(vaultId, dl, sig);
    }

    function test_CheckInECDSA_RevertsWrongVaultId() public {
        uint256 vaultId = _createECVault(0);
        uint256 dl      = _deadline();

        // Sign for vaultId+1 (a different vault id)
        bytes memory sig = _signCheckIn(vaultId + 1, 0, dl, ownerKey);

        vm.prank(ecOwner);
        vm.expectRevert(TrustDrop.InvalidECDSASignature.selector);
        trustDrop.checkInECDSA(vaultId, dl, sig);
    }

    function test_CheckInECDSA_RevertsWrongChainId() public {
        uint256 vaultId = _createECVault(0);
        uint256 dl      = _deadline();

        // Manually build a signature for a different chainId
        bytes32 badDigest = keccak256(
            abi.encode("TRUSTDROP_CHECKIN_ECDSA_V1", vaultId, uint256(0), dl, block.chainid + 1)
        );
        bytes32 badMessageHash = MessageHashUtils.toEthSignedMessageHash(badDigest);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, badMessageHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(ecOwner);
        vm.expectRevert(TrustDrop.InvalidECDSASignature.selector);
        trustDrop.checkInECDSA(vaultId, dl, sig);
    }

    function test_CheckInECDSA_RevertsSignatureReplayOnNextNonce() public {
        uint256 vaultId = _createECVault(0);
        uint256 dl      = _deadline();

        // Build and use a valid nonce=0 signature
        bytes memory sig0 = _signCheckIn(vaultId, 0, dl, ownerKey);
        vm.prank(ecOwner);
        trustDrop.checkInECDSA(vaultId, dl, sig0);

        // Replaying the same sig for the new nonce=1 must fail
        vm.prank(ecOwner);
        vm.expectRevert(TrustDrop.InvalidECDSASignature.selector);
        trustDrop.checkInECDSA(vaultId, dl, sig0);
    }

    function test_CheckInECDSA_RevertsVaultNotFound() public {
        uint256 dl  = _deadline();
        bytes memory sig = _signCheckIn(999, 0, dl, ownerKey);

        vm.prank(ecOwner);
        vm.expectRevert(TrustDrop.VaultNotFound.selector);
        trustDrop.checkInECDSA(999, dl, sig);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Security fix: createVault — >10 beneficiaries → InvalidBeneficiaries
    // ──────────────────────────────────────────────────────────────────────────

    function test_CreateVault_RevertsMoreThanTenBeneficiaries() public {
        uint256 count = 11;
        address[] memory bens = new address[](count);
        uint256[] memory shs  = new uint256[](count);

        // Give each beneficiary an equal share; last one absorbs any rounding.
        uint256 shareEach = BPS / count; // 909 bps each for 11 → 9999 total
        uint256 sumSoFar;
        for (uint256 i = 0; i < count - 1; ++i) {
            bens[i] = makeAddr(string(abi.encodePacked("ben", i)));
            shs[i]  = shareEach;
            sumSoFar += shareEach;
        }
        bens[count - 1] = alice;
        shs[count - 1]  = BPS - sumSoFar; // remainder to make shares sum to BPS

        vm.prank(owner);
        vm.expectRevert(TrustDrop.InvalidBeneficiaries.selector);
        trustDrop.createVault(PQ_PK, INTERVAL, GRACE, bens, shs);
    }

    function test_CreateVault_RevertsExactlyElevenBeneficiaries() public {
        uint256 count = 11;
        address[] memory bens = new address[](count);
        uint256[] memory shs  = new uint256[](count);
        uint256 shareEach = BPS / count;
        uint256 sumSoFar;
        for (uint256 i = 0; i < count - 1; ++i) {
            bens[i] = makeAddr(string(abi.encodePacked("b", i)));
            shs[i]  = shareEach;
            sumSoFar += shareEach;
        }
        bens[count - 1] = alice;
        shs[count - 1]  = BPS - sumSoFar;

        vm.prank(owner);
        vm.expectRevert(TrustDrop.InvalidBeneficiaries.selector);
        trustDrop.createVault(PQ_PK, INTERVAL, GRACE, bens, shs);
    }

    function test_CreateVault_AcceptsExactlyTenBeneficiaries() public {
        uint256 count = 10;
        address[] memory bens = new address[](count);
        uint256[] memory shs  = new uint256[](count);
        uint256 shareEach = BPS / count; // 1000 each → sums to exactly 10000
        for (uint256 i = 0; i < count; ++i) {
            bens[i] = makeAddr(string(abi.encodePacked("b10", i)));
            shs[i]  = shareEach;
        }

        vm.prank(owner);
        uint256 vaultId = trustDrop.createVault(PQ_PK, INTERVAL, GRACE, bens, shs);
        assertGt(vaultId, 0, "vault with 10 beneficiaries must succeed");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Security fix: createVault — address(0) beneficiary → InvalidBeneficiaries
    // ──────────────────────────────────────────────────────────────────────────

    function test_CreateVault_RevertsZeroAddressBeneficiary() public {
        address[] memory bens = new address[](2);
        uint256[] memory shs  = new uint256[](2);
        bens[0] = alice;
        bens[1] = address(0); // invalid
        shs[0]  = 5000;
        shs[1]  = 5000;

        vm.prank(owner);
        vm.expectRevert(TrustDrop.InvalidBeneficiaries.selector);
        trustDrop.createVault(PQ_PK, INTERVAL, GRACE, bens, shs);
    }

    function test_CreateVault_RevertsZeroAddressFirstBeneficiary() public {
        address[] memory bens = new address[](1);
        uint256[] memory shs  = new uint256[](1);
        bens[0] = address(0);
        shs[0]  = BPS;

        vm.prank(owner);
        vm.expectRevert(TrustDrop.InvalidBeneficiaries.selector);
        trustDrop.createVault(PQ_PK, INTERVAL, GRACE, bens, shs);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Security fix: checkIn — VaultLapsed after lapse
    // ──────────────────────────────────────────────────────────────────────────

    function test_CheckIn_RevertsVaultLapsed() public {
        uint256 vaultId = _createSimpleVault(0);
        _warpPastLapse();

        assertTrue(trustDrop.isLapsed(vaultId), "precondition: vault must be lapsed");

        vm.prank(owner);
        vm.expectRevert(TrustDrop.VaultLapsed.selector);
        trustDrop.checkIn(vaultId, _deadline(), validSig);
    }

    function test_CheckIn_RevertsVaultLapsedAtExactBoundaryPlusOne() public {
        uint256 vaultId = _createSimpleVault(0);
        vm.warp(block.timestamp + INTERVAL + GRACE + 1);

        vm.prank(owner);
        vm.expectRevert(TrustDrop.VaultLapsed.selector);
        trustDrop.checkIn(vaultId, _deadline(), validSig);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Fuzz: checkInECDSA accepts any future deadline
    // ──────────────────────────────────────────────────────────────────────────

    function testFuzz_CheckInECDSA_AcceptsFutureDeadline(uint32 offset) public {
        uint256 vaultId = _createECVault(0);
        uint256 future  = block.timestamp + bound(offset, 1, 365 days);
        bytes memory sig = _signCheckIn(vaultId, 0, future, ownerKey);

        vm.prank(ecOwner);
        trustDrop.checkInECDSA(vaultId, future, sig);

        (, , uint256 lastCI,,, ) = trustDrop.vaultStatus(vaultId);
        assertEq(lastCI, block.timestamp);
    }

    /// @dev Any past deadline must be rejected, regardless of signature validity.
    function testFuzz_CheckInECDSA_RejectsStaleDeadline(uint32 age) public {
        uint256 vaultId     = _createECVault(0);
        uint256 pastDeadline = block.timestamp - bound(age, 1, block.timestamp);
        bytes memory sig    = _signCheckIn(vaultId, 0, pastDeadline, ownerKey);

        vm.prank(ecOwner);
        vm.expectRevert(TrustDrop.DeadlineExpired.selector);
        trustDrop.checkInECDSA(vaultId, pastDeadline, sig);
    }

    /// @dev Signature signed by a random key must always produce InvalidECDSASignature.
    function testFuzz_CheckInECDSA_WrongKeyAlwaysReverts(uint256 badKey) public {
        // Ensure badKey is a valid secp256k1 private key (non-zero, < curve order)
        uint256 curveOrder = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        badKey = bound(badKey, 1, curveOrder - 1);
        vm.assume(badKey != ownerKey);

        uint256 vaultId = _createECVault(0);
        uint256 dl      = _deadline();
        bytes memory sig = _signCheckIn(vaultId, 0, dl, badKey);

        // If the derived address happens to match ecOwner, the test is vacuous; skip.
        address recovered = ECDSA.recover(
            MessageHashUtils.toEthSignedMessageHash(
                keccak256(abi.encode("TRUSTDROP_CHECKIN_ECDSA_V1", vaultId, uint256(0), dl, block.chainid))
            ),
            sig
        );
        vm.assume(recovered != ecOwner);

        vm.prank(ecOwner);
        vm.expectRevert(TrustDrop.InvalidECDSASignature.selector);
        trustDrop.checkInECDSA(vaultId, dl, sig);
    }
}
