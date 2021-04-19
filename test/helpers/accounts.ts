import {ethers} from 'hardhat';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

export async function getAccount(accountAddressToSearch: string): Promise<SignerWithAddress> {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    for (let signer of signers) {
        const signerAddress: string = await signer.getAddress();
        if (signerAddress === accountAddressToSearch) {
            return signer;
        }
    }
    throw new Error('Could not find the required address in the Signers');
}