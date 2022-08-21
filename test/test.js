const { assert, expect } = require('chai');
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");


describe('MultiSig', function () {
    const oneEther = ethers.utils.parseEther("1");

    async function deployContactWithFunds() {
        let accounts = await ethers.provider.listAccounts();
        let firstFourAccounts = accounts.slice(0, 4);
        const MultiSig = await ethers.getContractFactory("MultiSig");
        let contract = await MultiSig.deploy(firstFourAccounts, 2);
        await contract.deployed();


        await ethers.provider.getSigner(0).sendTransaction(
            {to: contract.address, value: oneEther }
        );

        let balance = await ethers.provider.getBalance(contract.address);

        return { firstFourAccounts, contract, balance };
    }

    describe('Testing MultiSig', function () {
        it('should store the balance', async () => {
            const { balance } = await loadFixture(deployContactWithFunds);
            expect(balance).to.equal(oneEther);
        });

        describe('executing the first ether transaction', function() {
            let _firstFourAccounts, _contract, _originalBalance;

            before(async () => {
                const { firstFourAccounts, contract, balance } = await loadFixture(deployContactWithFunds);
                _firstFourAccounts = firstFourAccounts;
                _contract = contract;
                _originalBalance = balance;
                await contract.submitTransaction(firstFourAccounts[1], oneEther, "0x");
            })

            it('should NOT have removed the contract balance', async () => {
                expect(_originalBalance).to.equal(oneEther);
            });

            it('Should only have one approval', async () => {
                expect((await _contract.getConfirmations(0)).length).to.equal(1);
            })
        });
        describe('executing the second ether transaction', function() {
            let walletBalanceBefore;
            let _firstFourAccounts, _contract, _originalBalance;

            before(async () => {
                const { firstFourAccounts, contract, balance } = await loadFixture(deployContactWithFunds);
                _firstFourAccounts = firstFourAccounts;
                _contract = contract;
                _originalBalance = balance;
                walletBalanceBefore = await ethers.provider.getBalance(firstFourAccounts[1]);
                await contract.submitTransaction(firstFourAccounts[1], oneEther, "0x");
                await contract.connect(ethers.provider.getSigner(1)).confirmTransaction(0);
            })

            it('should have removed the contract balance', async () => {
                const contractBalance = await ethers.provider.getBalance(_contract.address);
                expect(contractBalance).to.equal(0);
            });

            it('Should have two approvals', async () => {
                expect((await _contract.getConfirmations(0)).length).to.equal(2);
            })
        });

        describe("Test Expiration", function() {
            let _firstFourAccounts, _contract, _originalBalance;
            const fiveDays = 60 * 60 * 24 * 5; 
            before(async () => {
                const { firstFourAccounts, contract, balance } = await loadFixture(deployContactWithFunds);
                _firstFourAccounts = firstFourAccounts;
                _contract = contract;
                _originalBalance = balance;
                walletBalanceBefore = await ethers.provider.getBalance(firstFourAccounts[1]);
                await contract.submitTransaction(firstFourAccounts[1], oneEther, "0x");
            });

            it("tx should not have expired yet", async () => {
                await time.increase(fiveDays - 100);
                await expect(_contract.connect(ethers.provider.getSigner(1)).confirmTransaction(0)).to.not.be.reverted; 
            })

            it("tx should have expired", async () => {
                await time.increase(fiveDays);
                await expect(_contract.connect(ethers.provider.getSigner(1)).confirmTransaction(0)).to.be.revertedWith("transaction has expired");
            })
        })
    });
    
});
