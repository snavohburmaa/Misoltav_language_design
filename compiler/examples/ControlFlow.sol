// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ControlFlow {
    uint256 public count = 0;

    enum State { Idle, Active }

    function run() public {
        if ((count > 0)) {
            count = (count - 1);
        } else if ((count < 0)) {
            count = 0;
        } else {
            count = 1;
        }
        while ((count < 10)) {
            count = (count + 1);
        }
        for (uint256 i = 0; i < (5); i++) {
            count = (count + 1);
        }
        if (count == Idle) {
            return 0;
        }
        else if (count == Active) {
            return 1;
        }
    }

}