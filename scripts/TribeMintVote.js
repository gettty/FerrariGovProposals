const { Contract } = require("@ethersproject/contracts");
const hre = require("hardhat");
const { TASK_NODE_CREATE_SERVER } = require('hardhat/builtin-tasks/task-names');
const jsonRpcUrl = 'http://localhost:8545';
const ethers = hre.ethers;
const GovAbi = require("../abis/FeiDAO.json"); //0x0BEF27FEB58e857046d630B2c03dFb7bae567494
const TimelockAbi = require("../abis/FeiDaoTimelock.json"); //0xd51dba7a94e1adea403553a8235c302cebf41a3c
const TribeAbi = require("../abis/Tribe.json");
const CoreAbi = require("../abis/FeiCore.json")

let accountToInpersonate = "0xe0ac4559739bd36f0913fb0a3f5bfc19bcbacd52";

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
    async function advanceBlockHeight(blocks) {
      const txns = [];
      for (let i = 0; i < blocks; i++) {
        txns.push(hre.network.provider.send('evm_mine'));
      }
      await Promise.all(txns);
    }
    const signer = await ethers.getSigner(accountToInpersonate)
    const governanceContract = new ethers.Contract("0x0BEF27FEB58e857046d630B2c03dFb7bae567494", GovAbi, signer)
    const timelockContract = new ethers.Contract("0xd51dba7a94e1adea403553a8235c302cebf41a3c", TimelockAbi, signer)
    const TribeToken = new ethers.Contract("0xc7283b66eb1eb5fb86327f08e1b5816b0720212b", TribeAbi, signer)
    const feiCore = new ethers.Contract("0x8d5ED43dCa8C2F7dFB20CF7b53CC7E593635d7b9", CoreAbi, signer)

    let balanceOfCore = await TribeToken.balanceOf("0x8d5ED43dCa8C2F7dFB20CF7b53CC7E593635d7b9");
    let balanceOfDest = await TribeToken.balanceOf("0x9B68c14e936104e9a7a24c712BEecdc220002984");
    console.log(balanceOfDest);

    console.log( await feiCore.isMinter("0x9B68c14e936104e9a7a24c712BEecdc220002984"))
    //transfer tribe - done
    //mint more tribe - done
    //set thing as a minter - done
    //console.log(proposeEvents[proposeEvents.length-1])
    let proposal = await governanceContract['propose(address[],uint256[],bytes[],string)'](["0x8d5ED43dCa8C2F7dFB20CF7b53CC7E593635d7b9","0xc7283b66eb1eb5fb86327f08e1b5816b0720212b","0x8d5ED43dCa8C2F7dFB20CF7b53CC7E593635d7b9"],[0,0,0],["0xeacdd9e80000000000000000000000009b68c14e936104e9a7a24c712beecdc220002984000000000000000000000000000000000000000000eee25a008530a464ed33d9","0x40c10f190000000000000000000000009b68c14e936104e9a7a24c712beecdc22000298400000000000000000000000000000000000000000000d3c21bcecceda1000000","0x261707fa0000000000000000000000009b68c14e936104e9a7a24c712beecdc220002984"],"hello");
    await hre.network.provider.request({
      method: "evm_increaseTime",
      params: [1],
    });
    await advanceBlockHeight(1); // fast forward through review period
    let proposeEvents = await governanceContract.queryFilter("0x7d84a6263ae0d98d3329bd7b46bb4e8d6f98cd35a7adb45c274c8b7fd5ebd5e0");
    let proposalNumber = proposeEvents[[proposeEvents.length-1]]["args"]["proposalId"];
    console.log("state: "+await governanceContract.state(proposalNumber))
    const prep = await governanceContract.populateTransaction["castVote"](
      proposalNumber.toString(),
      "1"
    );
    const txn = await signer.sendTransaction(prep);
    //console.log(txn);

    let largeVoters = [
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
        const governanceContract = new ethers.Contract("0x0BEF27FEB58e857046d630B2c03dFb7bae567494", GovAbi, signer)
        const prep = await governanceContract.populateTransaction["castVote"](
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

    await governanceContract['queue(uint256)'](proposalNumber);
    console.log("state: "+await governanceContract.state(proposalNumber))
    
    await hre.network.provider.request({
        method: "evm_increaseTime",
        params: [86400],
      });

    await advanceBlockHeight(1) //after changing the time mine one block

    let execution = await governanceContract['execute(uint256)'](proposalNumber);
    //console.log(execution);
    console.log("state: "+await governanceContract.state(proposalNumber))
    //console.log(await governanceContract.proposals(proposalNumber));


    balanceOfCore = await TribeToken.balanceOf("0x8d5ED43dCa8C2F7dFB20CF7b53CC7E593635d7b9");
    console.log("core:"+balanceOfCore);

    balanceOfDest = await TribeToken.balanceOf("0x9B68c14e936104e9a7a24c712BEecdc220002984");
    console.log("dest: "+balanceOfDest);
    console.log( await feiCore.isMinter("0x9B68c14e936104e9a7a24c712BEecdc220002984"))

  }

  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
