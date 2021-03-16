const InterestStrategy = artifacts.require("InterestStrategy");

module.exports = function(deployer) {
  deployer.deploy(InterestStrategy, 5, 1);
};
