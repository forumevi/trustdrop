// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @dev Always returns true — etch this at PQ_VERIFIER for happy-path tests.
contract MockPQVerifierTrue {
    function verifySlhDsaSha2128s(
        bytes32, /*publicKey*/
        bytes memory, /*message*/
        bytes memory /*signature*/
    ) external pure returns (bool) {
        return true;
    }
}

/// @dev Always returns false — etch this at PQ_VERIFIER for invalid-sig tests.
contract MockPQVerifierFalse {
    function verifySlhDsaSha2128s(
        bytes32, /*publicKey*/
        bytes memory, /*message*/
        bytes memory /*signature*/
    ) external pure returns (bool) {
        return false;
    }
}
