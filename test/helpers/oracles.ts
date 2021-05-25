import { ethers } from 'hardhat';
import { BigNumber, Signer } from 'ethers';
import { expect } from 'chai';
import * as helpers from './helpers';
import {DeployConfig} from "../../scripts/config";

import { 
     UniswapPairOracle
} from '../../typechain';
import * as deploy from './deploy';


export async function deployOracle (c: DeployConfig, tokenA:string, tokenB:string, owner:string): Promise<UniswapPairOracle> {

    
    return (await deploy.deployContract("UniswapPairOracle",[c.uniswapFactoryAddr,tokenA,tokenB,owner,owner]) as UniswapPairOracle);
}