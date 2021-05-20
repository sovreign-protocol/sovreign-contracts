module.exports = {
    skipFiles: [
      'interfaces/', 
      'mocks/Test2Facet.sol', 
      'mocks/ERC20Mock.sol',
      'libraries/UniswapV2Library.sol', 
      'libraries/UniswapV2OracleLibrary.sol',
      'periphery/UniswapPairOracle.sol',
      'periphery/OracleVariants/'
    ],
    istanbulReporter:['html', 'lcov', 'text', 'json']
  };