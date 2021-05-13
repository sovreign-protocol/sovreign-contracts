import { ethers } from 'hardhat';
import { BigNumber, Signer } from 'ethers';
import { expect } from 'chai';
import * as helpers from './helpers';

import { 
     UniswapPairOracle
} from '../../typechain';
import * as deploy from './deploy';

let factory = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"

export async function deployOracle (tokenA:string, tokenB:string, owner:string): Promise<UniswapPairOracle> {
    
    return (await deploy.deployContract("UniswapPairOracle",[factory,tokenA,tokenB,owner,owner]) as UniswapPairOracle);
}