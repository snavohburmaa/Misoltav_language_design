// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Token {
    address public owner = msg.sender;
    string public name = "MisoToken";
    string public symbol = "MISO";
    uint256 public supply = 0;
    mapping(address => uint256) public balance;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address from, address to, uint256 amount);
    event Approval(address owner, address spender, uint256 amount);

    modifier onlyOwner() { require(msg.sender == owner, "Not authorized"); _; }

    function mint(address user, uint256 amount) public onlyOwner {
        balance[user] = balance[user] + amount;
        supply = supply + amount;
        emit Transfer(address(this), user, amount);
    }

    function transfer(address to, uint256 amount) public {
        require((balance[msg.sender] >= amount));
        balance[msg.sender] = balance[msg.sender] - amount;
        balance[to] = balance[to] + amount;
        emit Transfer(msg.sender, to, amount);
    }

    function approve(address spender, uint256 amount) public {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public {
        require((allowance[from][msg.sender] >= amount));
        require((balance[from] >= amount));
        allowance[from][msg.sender] = allowance[from][msg.sender] - amount;
        balance[from] = balance[from] - amount;
        balance[to] = balance[to] + amount;
        emit Transfer(from, to, amount);
    }

    function burn(uint256 amount) public {
        require((balance[msg.sender] >= amount));
        balance[msg.sender] = balance[msg.sender] - amount;
        supply = supply - amount;
    }

}