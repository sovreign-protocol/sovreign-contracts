import { ethers } from 'hardhat';

const _gov = '0xC9aaC94a462816608D0e8F6d0Dd9D6474A19109f'; // todo: change address
const _reign = '0x36afDAc28ec7b41065E88FF914d72AbE23702251'; // todo: change address

async function main () {
    const reignOwnership=  await ethers.getContractAt('OwnershipFacet', _reign);
    await reignOwnership.transferOwnership(_gov);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
