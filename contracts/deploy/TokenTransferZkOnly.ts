import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

dotenv.config();

const BREIS_REQUEST_SEPOLIA = '0x4a97B63b27576d774b6BD288Fa6aAe24F086B84c';
const MEV_STAKE = '0xD222b11158932fb4E3c8A02214E2c5E7a0A996CA';
const REWARD = ethers.parseEther('250');
const VKHASH = '0x06138691d11a5d1111e2b83963ff143620d3db948ff205c5eaaeeb816e830d57';

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const args: any[] = [BREIS_REQUEST_SEPOLIA, MEV_STAKE, REWARD, VKHASH];
  const deployment = await deploy('DextrZK', {
    from: deployer,
    log: true,
    args: args
  });

  await hre.run('verify:verify', {
    address: deployment.address,
    constructorArguments: args ?? deployment.args
  });
};

deployFunc.tags = ['TokenTransferZkOnly'];
deployFunc.dependencies = [];
export default deployFunc;
