const { Contract } = require("@ethersproject/contracts");
const hre = require("hardhat");
const { TASK_NODE_CREATE_SERVER } = require('hardhat/builtin-tasks/task-names');
const jsonRpcUrl = 'http://localhost:8545';
const ethers = hre.ethers;
const GovAbi = require("../abis/GovernorBravoDelegate.json");
const TimelockAbi = require("../abis/RariTimelock.json");

const RariGovernanceTokenUniswapDistributorAbi = require ("../abis/RariGovernanceTokenUniswapDistributor.json");
const RariPoolControllerAbi = require ("../abis/RariPoolController.json");


let accountToInpersonate = "0x961bcb93666e0ea73b6d88a03817cb36f93a6dd9";

// Set up localhost fork with Hardhat
(async function () {
    console.log(`\nRunning a hardhat localhost fork of mainnet at ${jsonRpcUrl}\n`);
  
    const jsonRpcServer = await hre.run(TASK_NODE_CREATE_SERVER, {
      hostname: 'localhost',
      port: 8545,
      provider: hre.network.provider,
    });
  
    await jsonRpcServer.listen();  
  })().catch(console.error)

  async function main() {  
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [accountToInpersonate],
    });
    let signer = await ethers.getSigner(accountToInpersonate)
  
    const goveranceContract = new ethers.Contract("0x91d9c2b5cF81D55a5f2Ecc0fC84E62f9cd2ceFd6", GovAbi, signer)
    const timelockContract = new ethers.Contract("0x8ace03fc45139fddba944c6a4082b604041d19fc", TimelockAbi, signer)

    const RariGovernanceTokenUniswapDistributor = new ethers.Contract("0x1FA69a416bCF8572577d3949b742fBB0a9CD98c7", RariGovernanceTokenUniswapDistributorAbi, signer);
    const RariPoolControllerUSDC = new ethers.Contract("0x66f4856f1bbd1eb09e1c8d9d646f5a3a193da569", RariPoolControllerAbi, signer);
    const RariPoolManager = new ethers.Contract("0x59FA438cD0731EBF5F4cDCaf72D4960EFd13FCe6", RariPoolControllerAbi, signer);
    const RariPoolControllerETH = new ethers.Contract("0x3F4931A8E9D4cdf8F56e7E8A8Cfe3BeDE0E43657", RariPoolControllerAbi, signer);
    const RariPoolManager2 = new ethers.Contract("0xD6e194aF3d9674b62D1b30Ec676030C23961275e", RariPoolControllerAbi, signer);
    const RariPoolControllerDAI = new ethers.Contract("0xaFD2AaDE64E6Ea690173F6DE59Fc09F5C9190d74", RariPoolControllerAbi, signer);
    const RariPoolManagerDAI = new ethers.Contract("0xB465BAF04C087Ce3ed1C266F96CA43f4847D9635", RariPoolControllerAbi, signer);


    
    console.log(await RariPoolManagerDAI.owner());
    


    //console.log(await goveranceContract.proposalCount());
    await goveranceContract.propose(
        ["0x1FA69a416bCF8572577d3949b742fBB0a9CD98c7","0x66f4856f1bbd1eb09e1c8d9d646f5a3a193da569","0x59FA438cD0731EBF5F4cDCaf72D4960EFd13FCe6","0x3F4931A8E9D4cdf8F56e7E8A8Cfe3BeDE0E43657","0xD6e194aF3d9674b62D1b30Ec676030C23961275e","0xaFD2AaDE64E6Ea690173F6DE59Fc09F5C9190d74","0xB465BAF04C087Ce3ed1C266F96CA43f4847D9635"],
        [0,0,0,0,0,0,0],
        ["transferOwnership(address)","transferOwnership(address)","transferOwnership(address)","transferOwnership(address)","transferOwnership(address)","transferOwnership(address)","transferOwnership(address)"],
        ["0x000000000000000000000000d51dba7a94e1adea403553a8235c302cebf41a3c","0x000000000000000000000000d51dba7a94e1adea403553a8235c302cebf41a3c","0x000000000000000000000000d51dba7a94e1adea403553a8235c302cebf41a3c","0x000000000000000000000000d51dba7a94e1adea403553a8235c302cebf41a3c","0x000000000000000000000000d51dba7a94e1adea403553a8235c302cebf41a3c","0x000000000000000000000000d51dba7a94e1adea403553a8235c302cebf41a3c","0x000000000000000000000000d51dba7a94e1adea403553a8235c302cebf41a3c"],
        "hello");
    currentProposalCount = await goveranceContract.proposalCount();
    //console.log(currentProposalCount);
    //let proposalInfo = await goveranceContract.proposals(currentProposalCount);

    async function advanceBlockHeight(blocks) {
        const txns = [];
        for (let i = 0; i < blocks; i++) {
          txns.push(hre.network.provider.send('evm_mine'));
        }
        await Promise.all(txns);
      }
      
    await advanceBlockHeight(13141); // fast forward through review period

    await goveranceContract.castVote(currentProposalCount,1);


    let largeVoters = [
        "0xdbc46c788f7249251fa6b49303babcb1c519f608",
    ]

    for (let i = 0; i<largeVoters.length;i++){
        await signer.sendTransaction({to: largeVoters[i],value: ethers.utils.parseEther(".1")})
    }

    for (let i = 0; i<largeVoters.length;i++){
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [largeVoters[i]],
          });
          const signer = await ethers.getSigner(largeVoters[i])
          await goveranceContract.connect(signer).castVote(currentProposalCount,1)
    }

    await advanceBlockHeight(19711); // fast forward through voting period

    await goveranceContract.queue(currentProposalCount);
    
    proposalInfo = await goveranceContract.proposals(currentProposalCount);
    //console.log(proposalInfo);

    await hre.network.provider.request({
        method: "evm_increaseTime",
        params: [172800],
      });

    await advanceBlockHeight(1) //after changing the time mine one block
    await goveranceContract.execute(currentProposalCount);
    console.log(await RariGovernanceTokenUniswapDistributor.owner());
    console.log(await RariPoolControllerUSDC.owner());
    console.log(await RariPoolManager.owner());
    console.log(await RariPoolControllerETH.owner());
    console.log(await RariPoolManager2.owner());
    console.log(await RariPoolControllerDAI.owner());


    //proposalInfo = await goveranceContract.proposals(currentProposalCount);
    //console.log(proposalInfo); //expect "executed"

  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
