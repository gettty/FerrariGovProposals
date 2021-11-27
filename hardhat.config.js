require("@nomiclabs/hardhat-waffle");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.7.3",
  networks: {
    hardhat: {
      forking: {
        url: "https://eth-mainnet.alchemyapi.io/v2/IrlmaZDrudPpzaGZ7_fnoc3o78QGxCW3",
        blockNumber: 13692720
      }
    }
  }
};