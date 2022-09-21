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
 import {
  deploy,
  getZkAppState,
  createLocalBlockchain,
  MultiSigZkApp,
  sendTo,
  Proposal,
  signProposal,
  fundNewAccount,
  createBerkeley,
  init,
  signProposalBatch,
} from './multisig.js';
import { Field, AccountUpdate, PrivateKey, shutdown, fetchAccount } from 'snarkyjs';

// local
const account = createLocalBlockchain();
const zkAppPrivateKey = PrivateKey.random();
const zkAppAddress = zkAppPrivateKey.toPublicKey();
// berkeley
// const account = createBerkeley()
// const zkAppPrivateKey = account;
// const zkAppAddress = zkAppPrivateKey.toPublicKey();
console.log(account.toPublicKey().toBase58())

// sendTo()
// await shutdown()

const zkAppInstance = new MultiSigZkApp(zkAppAddress);

let numSigners = 5

var receiver = PrivateKey.random().toPublicKey()
console.log("rec", receiver.toBase58())
console.log("zkapp", zkAppAddress.toBase58())

var signers = []
var signersPk = []
for(let i = 0 ; i < numSigners ; i++){
  let pk = PrivateKey.random();
  signersPk.push(pk)
  signers.push(pk.toPublicKey())
  console.log(i, pk.toPublicKey().toBase58())
}

console.log("Compiling MultiSig...")
// let verificationKey = await MultiSigZkApp.compile()

console.log('Deploying MultiSig...');
await deploy(zkAppInstance, zkAppPrivateKey, signers, account); //, verificationKey.verificationKey

// await shutdown()

// await fetchAccount({publicKey: zkAppAddress})
console.log('Balance:', getZkAppState(zkAppInstance).balance.toString());
// await init(account, zkAppInstance, zkAppPrivateKey, signers)
// await shutdown()

await fundNewAccount(account, receiver)
console.log('Balance Receiver: ', AccountUpdate.create(receiver).account.balance.get().toString());
console.log('Balance Account: ', AccountUpdate.create(account.toPublicKey()).account.balance.get().toString());

await sendTo(account, zkAppAddress)

console.log('Balance:', getZkAppState(zkAppInstance).balance.toString());
console.log('Balance Account: ', AccountUpdate.create(account.toPublicKey()).account.balance.get().toString());

let proposal = new Proposal(receiver, Field.fromNumber(1000))

console.log("pubkey0: ", signersPk[0].toBase58())
console.log("pubkey1: ", zkAppAddress.toBase58())








await signProposalBatch(proposal, [[0, 0], [1, 0]], [true, true], [signersPk[0], signersPk[1]], signers, account, zkAppAddress, zkAppPrivateKey)
console.log('Balance:', getZkAppState(zkAppInstance).balance.toString());

// await signProposal(proposal, [0, 0], true, signersPk[0], signers, account, zkAppAddress, zkAppPrivateKey)
// console.log('Balance:', getZkAppState(zkAppInstance).balance.toString());

// await signProposal(proposal, [1, 0], true, signersPk[1], signers, account, zkAppAddress, zkAppPrivateKey)
// console.log('Balance:', getZkAppState(zkAppInstance).balance.toString());

await signProposal(proposal, [2, 0], false, signersPk[3], signers, account, zkAppAddress, zkAppPrivateKey)
console.log('Balance:', getZkAppState(zkAppInstance).balance.toString());

await signProposal(proposal, [2, 1], false, signersPk[4], signers, account, zkAppAddress, zkAppPrivateKey)
console.log('Balance:', getZkAppState(zkAppInstance).balance.toString());

await signProposal(proposal, [2, 2], true, signersPk[2], signers, account, zkAppAddress, zkAppPrivateKey)
console.log('Balance:', getZkAppState(zkAppInstance).balance.toString());
console.log('Balance Receiver: ', AccountUpdate.create(receiver).account.balance.get().toString());

// cleanup
await shutdown();
