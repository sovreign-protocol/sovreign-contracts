pragma solidity 0.7.6;

import "./interfaces/IMintBurnErc20.sol";
import "./interfaces/IPoolController.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract ReignToken is IMintBurnErc20 {
    using SafeMath for uint256;

    string public constant override name = "SoV-Reign Governance Token";
    string public constant override symbol = "REIGN";
    uint8 public constant override decimals = 18;
    uint256 public override totalSupply;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    address public controller;

    constructor(address _controller) {
        controller = _controller;
    }

    function setController(address _controller) public {
        require(msg.sender == controller, "Only Controller can do this");
        controller = _controller;
    }

    function _mint(address to, uint256 value) internal {
        totalSupply = totalSupply.add(value);
        balanceOf[to] = balanceOf[to].add(value);
        emit Transfer(address(0), to, value);
    }

    function _burn(address from, uint256 value) internal {
        balanceOf[from] = balanceOf[from].sub(value);
        totalSupply = totalSupply.sub(value);
        emit Transfer(from, address(0), value);
    }

    function mint(address to, uint256 value) external override returns (bool) {
        require(msg.sender == controller, "Only Controller can do this");

        _mint(to, value);
        emit Mint(to, value);
        return true;
    }

    function burnFrom(address from, uint256 value)
        external
        override
        returns (bool)
    {
        require(
            IPoolController(controller).isPool(msg.sender),
            "Only a Pool can do this"
        );

        _burn(from, value);
        emit Burn(from, value);
        return true;
    }

    function _approve(
        address owner,
        address spender,
        uint256 value
    ) private {
        allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

    function _transfer(
        address from,
        address to,
        uint256 value
    ) private {
        balanceOf[from] = balanceOf[from].sub(value);
        balanceOf[to] = balanceOf[to].add(value);
        emit Transfer(from, to, value);
    }

    function approve(address spender, uint256 value)
        external
        override
        returns (bool)
    {
        _approve(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value)
        external
        override
        returns (bool)
    {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external override returns (bool) {
        if (allowance[from][msg.sender] != uint256(-1)) {
            allowance[from][msg.sender] = allowance[from][msg.sender].sub(
                value
            );
        }
        _transfer(from, to, value);
        return true;
    }
}
