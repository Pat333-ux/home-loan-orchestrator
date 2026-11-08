// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

contract LucrMortgageEscrow {
    IERC20 public immutable lucrToken;
    address public treasuryOperator;

    struct LoanEscrow {
        address borrower;
        uint256 lockedLucr;
        uint256 usdCentsTarget;
        bool settled;
    }

    mapping(bytes32 => LoanEscrow) public escrows;

    event PayoffLocked(bytes32 indexed loanIdHash, address indexed borrower, uint256 lucrAmount, uint256 usdCents);
    event PayoffSettled(bytes32 indexed loanIdHash, string achTraceId);

    constructor(address _lucrToken, address _treasuryOperator) {
        lucrToken = IERC20(_lucrToken);
        treasuryOperator = _treasuryOperator;
    }

    function lockTokensForMortgage(bytes32 loanIdHash, uint256 lucrAmount, uint256 usdCents) external {
        require(!escrows[loanIdHash].settled, "Loan already settled");
        require(lucrToken.transferFrom(msg.sender, address(this), lucrAmount), "LUCR transfer failed");

        escrows[loanIdHash] = LoanEscrow({
            borrower: msg.sender,
            lockedLucr: lucrAmount,
            usdCentsTarget: usdCents,
            settled: false
        });

        emit PayoffLocked(loanIdHash, msg.sender, lucrAmount, usdCents);
    }

    function finalizeFiatSettlement(bytes32 loanIdHash, string calldata achTraceId) external {
        require(msg.sender == treasuryOperator, "Unauthorized operator");
        LoanEscrow storage item = escrows[loanIdHash];
        require(item.lockedLucr > 0 && !item.settled, "Invalid escrow state");

        item.settled = true;
        require(lucrToken.transfer(treasuryOperator, item.lockedLucr), "Treasury sweep failed");

        emit PayoffSettled(loanIdHash, achTraceId);
    }
}
