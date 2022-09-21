/**
 * This file specifies how to run the `SudokuZkApp` smart contract locally using the `Mina.LocalBlockchain()` method.
 * The `Mina.LocalBlockchain()` method specifies a ledger of accounts and contains logic for updating the ledger.
 *
 * Please note that this deployment is local and does not deploy to a live network.
 * If you wish to deploy to a live network, please use the zkapp-cli to deploy.
 *
 * To run locally:
 * Build the project: `$ npm run build`
 * Run with node:     `$ node build/src/run.js`.
 */

import { Field, AccountUpdate, PrivateKey, shutdown, fetchAccount, Bool, Proof } from 'snarkyjs';
import { createLocalBlockchain, deploy, fundNewAccount, getZkAppState, MultiSigProof, MultiSigState, MultiSigZkApp, MultiSigZkProgram, Proposal, ProposalState, sendTo, SignerList, signProposal, signWithProof } from './multisig-recursive.js';
import { tic, toc } from './tictoc.js';


var receiver = PrivateKey.random().toPublicKey()
console.log("rec", receiver.toBase58())

let numSigners = 4

var signers = []
var signersPk = []
for(let i = 0 ; i < numSigners ; i++){
  let pk = PrivateKey.random();
  signersPk.push(pk)
  signers.push(pk.toPublicKey())
  console.log(i, pk.toPublicKey().toBase58())
}

let signerList = new SignerList(signers)

// await shutdown()

// local
const account = createLocalBlockchain();
const zkAppPrivateKey = PrivateKey.random();
const zkAppAddress = zkAppPrivateKey.toPublicKey();
// berkeley
// const account = createBerkeley()
// const zkAppPrivateKey = account;
// const zkAppAddress = zkAppPrivateKey.toPublicKey();
console.log(account.toPublicKey().toBase58())

const zkAppInstance = new MultiSigZkApp(zkAppAddress);

console.log("Compiling MultiSig...")
// let verificationKey = await MultiSigZkApp.compile()

console.log('Deploying MultiSig...');
await deploy(zkAppInstance, zkAppPrivateKey, signers, account); //, verificationKey.verificationKey

// // await shutdown()

// // await fetchAccount({publicKey: zkAppAddress})
// console.log('Balance:', getZkAppState(zkAppInstance).balance.toString());
// // await init(account, zkAppInstance, zkAppPrivateKey, signers)
// // await shutdown()

await fundNewAccount(account, receiver)
console.log('Balance Receiver: ', AccountUpdate.create(receiver).account.balance.get().toString());
console.log('Balance Account: ', AccountUpdate.create(account.toPublicKey()).account.balance.get().toString());

await sendTo(account, zkAppAddress)

console.log('Balance:', getZkAppState(zkAppInstance).balance.toString());
console.log('Balance Account: ', AccountUpdate.create(account.toPublicKey()).account.balance.get().toString());

console.log("pubkey0: ", signersPk[0].toBase58())
console.log("pubkey1: ", zkAppAddress.toBase58())

// ------- Proof -----------

tic("Compiling")
await MultiSigZkProgram.compile();
toc()

let proposal = new Proposal(receiver, Field.fromNumber(1000))
let firstProposalState = new ProposalState([proposal.hash(), Field.zero, Field.zero])
let proposalStateBefore = firstProposalState
let proposalStateAfter = firstProposalState //doesnt matter, will be set in the loop

tic("Prove init")
let initialState = new MultiSigState(signerList.hash(), firstProposalState.hash(), firstProposalState.hash())
let initialProof = await MultiSigZkProgram.init(initialState, signerList, firstProposalState.hash())
toc()

let votes = [true, false]

let lastProof: MultiSigProof = initialProof

for(let i = 0; i < votes.length ; i++){
  let vote = votes[i]

  proposalStateAfter = new ProposalState([proposal.hash(), proposalStateBefore.proposalState[1].add(vote ? 1 : 0),proposalStateBefore.proposalState[2].add(!vote ? 1 : 0)])
  console.log("Votes after:", [proposalStateAfter.proposalState[1].toString(), proposalStateAfter.proposalState[2].toString()])

  tic("Prove sig " + i + ", voting " + (vote ? "yes" : "no"))

  let state1 = new MultiSigState(signerList.hash(), proposalStateAfter.hash(), firstProposalState.hash())
  let proof1 = await MultiSigZkProgram.approve(state1, proposal, signersPk[i], signerList, proposalStateBefore, Bool(vote), lastProof);
  lastProof = proof1

  toc()

  proposalStateBefore = proposalStateAfter

}

// tic("Prove first sig")
// let state1 = new MultiSigState(signerList.hash(), proposalStateAfter.hash())
// let proof1 = await MultiSigZkProgram.approve(state1, proposal, signersPk[0], signerList, proposalStateBefore, Bool(true), initialProof);
// toc()

// tic("Prove second sig")
// let proposalState2 = new ProposalState([proposal.hash(), Field.fromNumber(2), Field.zero])
// let state2 = new MultiSigState(signerList.hash(), proposalState2.hash())
// let proof2 = await MultiSigZkProgram.approve(state2, proposal, signersPk[1], signerList, proposalStateAfter, Bool(true), proof1);
// toc()

// ---------- SC

console.log(lastProof.publicInput.proposalsHash.toString() + " = " + proposalStateAfter.hash())

await signWithProof(lastProof, proposal, proposalStateAfter, account, zkAppPrivateKey, zkAppAddress)

console.log('Balance:', getZkAppState(zkAppInstance).balance.toString());
console.log('ProposalHash:', getZkAppState(zkAppInstance).proposal.toString());
console.log('Balance Receiver: ', AccountUpdate.create(receiver).account.balance.get().toString());

//Proving 2nd yes vote
await signProposal(proposal, [1, 1], true, signersPk[2], signers, account, zkAppAddress, zkAppPrivateKey)

console.log('Balance:', getZkAppState(zkAppInstance).balance.toString());
console.log('ProposalHash:', getZkAppState(zkAppInstance).proposal.toString());
console.log('Balance Receiver: ', AccountUpdate.create(receiver).account.balance.get().toString());

// cleanup
await shutdown();
