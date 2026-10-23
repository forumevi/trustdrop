// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IArcPQVerifier {
    function verifySlhDsaSha2128s(bytes32 publicKey, bytes memory message, bytes memory signature) external view returns (bool);
}

contract TrustDrop is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public constant USDC = IERC20(0x3600000000000000000000000000000000000000);
    address public constant PQ_VERIFIER = 0x1800000000000000000000000000000000000004;

    uint256 public constant SLH_DSA_SIGNATURE_LENGTH = 7856;
    uint256 public constant SLH_DSA_PUBLIC_KEY_LENGTH = 32;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    error VaultNotFound();
    error NotOwner();
    error AlreadySettled();
    error NotLapsed();
    error StillLapsed();
    error InvalidShares();
    error InvalidBeneficiaries();
    error InvalidInterval();
    error ZeroAmount();
    error DeadlineExpired();
    error InvalidPQSignature();
    error PQVerifierUnavailable();

    event VaultCreated(
        uint256 indexed vaultId,
        address indexed owner,
        uint256 amount,
        uint256 checkInInterval,
        uint256 graceWindow
    );
    event CheckedIn(uint256 indexed vaultId, uint256 indexed nonce, uint256 timestamp);
    event Claimed(uint256 indexed vaultId, address indexed claimedBy, uint256 totalAmount);
    event Withdrawn(uint256 indexed vaultId, address indexed owner, uint256 amount);
    event Deposited(uint256 indexed vaultId, uint256 amount);

    struct Vault {
        address owner;
        bytes32 pqPublicKey;
        uint256 totalDeposited;
        uint256 checkInInterval;
        uint256 lastCheckIn;
        uint256 graceWindow;
        bool settled;
        address[] beneficiaries;
        uint256[] shares;
        uint256 nonce;
    }

    uint256 public nextVaultId = 1;
    mapping(uint256 vaultId => Vault vault) private _vaults;

    function createVault(
        bytes32 pqPublicKey,
        uint256 checkInInterval,
        uint256 graceWindow,
        address[] calldata beneficiaries,
        uint256[] calldata shares
    ) external returns (uint256 vaultId) {
        if (checkInInterval == 0) revert InvalidInterval();
        if (beneficiaries.length == 0 || beneficiaries.length != shares.length) revert InvalidBeneficiaries();

        uint256 totalShares;
        uint256 length = shares.length;
        for (uint256 i = 0; i < length; ++i) {
            totalShares += shares[i];
        }
        if (totalShares != BPS_DENOMINATOR) revert InvalidShares();

        vaultId = nextVaultId++;
        Vault storage vault = _vaults[vaultId];

        vault.owner = msg.sender;
        vault.pqPublicKey = pqPublicKey;
        vault.checkInInterval = checkInInterval;
        vault.lastCheckIn = block.timestamp;
        vault.graceWindow = graceWindow;

        for (uint256 i = 0; i < length; ++i) {
            vault.beneficiaries.push(beneficiaries[i]);
            vault.shares.push(shares[i]);
        }

        uint256 ownerBalance = USDC.balanceOf(msg.sender);
        uint256 ownerAllowance = USDC.allowance(msg.sender, address(this));
        uint256 initialAmount = ownerBalance < ownerAllowance ? ownerBalance : ownerAllowance;

        if (initialAmount > 0) {
            USDC.safeTransferFrom(msg.sender, address(this), initialAmount);
            vault.totalDeposited = initialAmount;
        }

        emit VaultCreated(vaultId, msg.sender, initialAmount, checkInInterval, graceWindow);
    }

    function deposit(uint256 vaultId, uint256 amount) external {
        Vault storage vault = _getVault(vaultId);
        if (msg.sender != vault.owner) revert NotOwner();
        if (vault.settled) revert AlreadySettled();
        if (amount == 0) revert ZeroAmount();

        USDC.safeTransferFrom(msg.sender, address(this), amount);
        vault.totalDeposited += amount;

        emit Deposited(vaultId, amount);
    }

    function checkIn(uint256 vaultId, uint256 deadline, bytes calldata pqSignature) external {
        Vault storage vault = _getVault(vaultId);
        if (msg.sender != vault.owner) revert NotOwner();
        if (vault.settled) revert AlreadySettled();

        uint256 currentNonce = vault.nonce;
        _validateProof(vault.pqPublicKey, "TRUSTDROP_CHECKIN_V1", vaultId, currentNonce, deadline, pqSignature);

        vault.lastCheckIn = block.timestamp;
        vault.nonce = currentNonce + 1;

        emit CheckedIn(vaultId, currentNonce, block.timestamp);
    }

    function isLapsed(uint256 vaultId) public view returns (bool) {
        Vault storage vault = _getVault(vaultId);
        if (vault.settled) return false;

        uint256 lapseDeadline = vault.lastCheckIn + vault.checkInInterval + vault.graceWindow;
        return block.timestamp > lapseDeadline;
    }

    function claim(uint256 vaultId) external nonReentrant {
        Vault storage vault = _getVault(vaultId);
        if (vault.settled) revert AlreadySettled();
        if (!isLapsed(vaultId)) revert NotLapsed();

        vault.settled = true;

        uint256 totalAmount = vault.totalDeposited;
        vault.totalDeposited = 0;

        uint256 distributed;
        uint256 length = vault.beneficiaries.length;
        for (uint256 i = 0; i < length; ++i) {
            uint256 payout = (i == length - 1)
                ? (totalAmount - distributed)
                : (totalAmount * vault.shares[i]) / BPS_DENOMINATOR;

            distributed += payout;
            if (payout > 0) {
                USDC.safeTransfer(vault.beneficiaries[i], payout);
            }
        }

        emit Claimed(vaultId, msg.sender, totalAmount);
    }

    function withdraw(uint256 vaultId, uint256 deadline, bytes calldata pqSignature) external nonReentrant {
        Vault storage vault = _getVault(vaultId);
        if (msg.sender != vault.owner) revert NotOwner();
        if (vault.settled) revert AlreadySettled();
        if (isLapsed(vaultId)) revert StillLapsed();

        uint256 currentNonce = vault.nonce;
        _validateProof(vault.pqPublicKey, "TRUSTDROP_WITHDRAW_V1", vaultId, currentNonce, deadline, pqSignature);

        vault.nonce = currentNonce + 1;
        vault.settled = true;

        uint256 amount = vault.totalDeposited;
        vault.totalDeposited = 0;

        if (amount > 0) {
            USDC.safeTransfer(vault.owner, amount);
        }

        emit Withdrawn(vaultId, vault.owner, amount);
    }

    function vaultStatus(
        uint256 vaultId
    )
        external
        view
        returns (address owner, uint256 balance, uint256 lastCheckIn, uint256 nextDeadline, bool lapsed, bool settled)
    {
        Vault storage vault = _getVault(vaultId);

        owner = vault.owner;
        balance = vault.totalDeposited;
        lastCheckIn = vault.lastCheckIn;
        nextDeadline = vault.lastCheckIn + vault.checkInInterval + vault.graceWindow;
        lapsed = !vault.settled && block.timestamp > nextDeadline;
        settled = vault.settled;
    }

    function getBeneficiaries(uint256 vaultId) external view returns (address[] memory beneficiaries, uint256[] memory shares) {
        Vault storage vault = _getVault(vaultId);
        beneficiaries = vault.beneficiaries;
        shares = vault.shares;
    }

    function _getVault(uint256 vaultId) internal view returns (Vault storage vault) {
        vault = _vaults[vaultId];
        if (vault.owner == address(0)) revert VaultNotFound();
    }

    function _validateProof(
        bytes32 pqPublicKey,
        string memory action,
        uint256 vaultId,
        uint256 nonce,
        uint256 deadline,
        bytes calldata pqSignature
    ) internal view {
        if (deadline < block.timestamp) revert DeadlineExpired();
        if (pqSignature.length != SLH_DSA_SIGNATURE_LENGTH) revert InvalidPQSignature();

        bytes32 digest = keccak256(abi.encode(action, vaultId, nonce, deadline, block.chainid));
        bytes memory message = abi.encodePacked(digest);

        bool ok = _verifyWithPrecompile(pqPublicKey, message, pqSignature);
        if (!ok) revert InvalidPQSignature();
    }

    function _verifyWithPrecompile(
        bytes32 publicKey,
        bytes memory message,
        bytes calldata signature
    ) internal view returns (bool ok) {
        (bool success, bytes memory returnData) = PQ_VERIFIER.staticcall(
            abi.encodeCall(IArcPQVerifier.verifySlhDsaSha2128s, (publicKey, message, signature))
        );

        if (!success || returnData.length != 32) revert PQVerifierUnavailable();

        ok = abi.decode(returnData, (bool));
    }
}
