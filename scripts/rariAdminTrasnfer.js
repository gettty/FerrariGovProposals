const { Contract } = require("@ethersproject/contracts");
const hre = require("hardhat");
const { TASK_NODE_CREATE_SERVER } = require('hardhat/builtin-tasks/task-names');
const jsonRpcUrl = 'http://localhost:8545';
const ethers = hre.ethers;
const GovAbi = require("../abis/GovernorBravoDelegate.json");
const TimelockAbi = require("../abis/RariTimelock.json");

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
    let currentProposalCount = await goveranceContract.proposalCount(); //expect 7
    //console.log("current number of proposals created: "+currentProposalCount);
    let currentTimelockAdmin = await timelockContract.pendingAdmin();
    console.log("current Timelock pendingAdmin: "+currentTimelockAdmin); //expect 0x91d9c2b5cf81d55a5f2ecc0fc84e62f9cd2cefd6 aka Rari Gov Bravo

    await goveranceContract.propose(["0x8ace03fc45139fddba944c6a4082b604041d19fc"],[0],["setPendingAdmin(address)"],["0x0000000000000000000000000bef27feb58e857046d630b2c03dfb7bae567494"],"hello");
    currentProposalCount = await goveranceContract.proposalCount();
    //console.log("current number of proposals created: "+currentProposalCount); //expect 8
    let proposalInfo = await goveranceContract.proposals(currentProposalCount);
    //console.log(proposalInfo);

    async function advanceBlockHeight(blocks) {
        const txns = [];
        for (let i = 0; i < blocks; i++) {
          txns.push(hre.network.provider.send('evm_mine'));
        }
        await Promise.all(txns);
      }
      
    await advanceBlockHeight(13141); // fast forward through review period

    await goveranceContract.castVote(8,1)

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
          await goveranceContract.connect(signer).castVote(8,1)
    }

    await advanceBlockHeight(19711); // fast forward through voting period

    await goveranceContract.queue(8);
    
    proposalInfo = await goveranceContract.proposals(8);
    //console.log(proposalInfo);

    await hre.network.provider.request({
        method: "evm_increaseTime",
        params: [172800],
      });

    await advanceBlockHeight(1) //after changing the time mine one block

    await goveranceContract.execute(8);

    proposalInfo = await goveranceContract.proposals(8);
    //console.log(proposalInfo); //expect "executed"

    console.log("current timelock pendingAdmin: "+await timelockContract.pendingAdmin()); //expect 0xbef27feb58e857046d630b2c03dfb7bae567494 aka Fei Gov
    console.log("current timelock admin: "+await timelockContract.admin());

    accountToInpersonate = "0xe0ac4559739bd36f0913fb0a3f5bfc19bcbacd52";
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [accountToInpersonate],
    });
    signer = await ethers.getSigner(accountToInpersonate)
    const GovAbiTribe = require("../abis/FeiDAO.json"); //0x0BEF27FEB58e857046d630B2c03dFb7bae567494
    const governanceContractTribe = new ethers.Contract("0x0BEF27FEB58e857046d630B2c03dFb7bae567494", GovAbiTribe, signer)
    let proposalToAcceptAdmin = await governanceContractTribe['propose(address[],uint256[],bytes[],string)'](["0x8ace03fc45139fddba944c6a4082b604041d19fc"],[0],["0x0e18b681"],"hello");

    await hre.network.provider.request({
      method: "evm_increaseTime",
      params: [1],
    });
    await advanceBlockHeight(1); // fast forward through review period
    let proposeEvents = await governanceContractTribe.queryFilter("0x7d84a6263ae0d98d3329bd7b46bb4e8d6f98cd35a7adb45c274c8b7fd5ebd5e0");
    let proposalNumber = proposeEvents[[proposeEvents.length-1]]["args"]["proposalId"];
    console.log("state: "+ await governanceContractTribe.state(proposalNumber))

    const prep = await governanceContractTribe.populateTransaction["castVote"](
      proposalNumber.toString(),
      "1"
    );
    const txn = await signer.sendTransaction(prep);
    //console.log(txn);

    largeVoters = [
        "0x107d1c9ef7a2ddb6a4aecfdcd6658355c7435a43",
        "0x486c33760ad3f6d9cf4a63493773e2b69635d602"
    ]
    
    for (let i = 0;i<largeVoters.length;i++){
        await signer.sendTransaction({to: largeVoters[i],value: ethers.utils.parseEther(".1")})
    }

    for (let i = 0; i<largeVoters.length;i++){
      await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [accountToInpersonate],
      });
      await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [largeVoters[i]],
        });
        accountToInpersonate = largeVoters[i];
        const signer = await ethers.getSigner(accountToInpersonate)
        const governanceContractTribe = new ethers.Contract("0x0BEF27FEB58e857046d630B2c03dFb7bae567494", GovAbi, signer)
        const prep = await governanceContractTribe.populateTransaction["castVote"](
          proposalNumber.toString(),
          "1"
        );
        const txn = await signer.sendTransaction(prep);
        //console.log(txn);
    }
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0xe0ac4559739bd36f0913fb0a3f5bfc19bcbacd52"],
    });
    await advanceBlockHeight(13000); // fast forward through voting period

    await governanceContractTribe['queue(uint256)'](proposalNumber);
    console.log("state: "+await governanceContractTribe.state(proposalNumber))
    
    await hre.network.provider.request({
        method: "evm_increaseTime",
        params: [86400],
      });

    await advanceBlockHeight(1) //after changing the time mine one block
    
    let execution = await governanceContractTribe['execute(uint256)'](proposalNumber);
    //console.log(execution);
    console.log("state: "+await governanceContractTribe.state(proposalNumber))
    console.log("timelock admin: "+await timelockContract.admin());
    console.log("timelock pending admin: "+await timelockContract.pendingAdmin());
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
