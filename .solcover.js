module.exports = {
    skipFiles: [
      'interfaces/', 
      'mocks/Test2Facet.sol', 
      'mocks/ERC20Mock.sol',
      'libraries/UniswapV2Library.sol', 
      'libraries/UniswapV2OracleLibrary.sol'
    ],
    istanbulReporter:['html', 'lcov', 'text', 'json']
  };