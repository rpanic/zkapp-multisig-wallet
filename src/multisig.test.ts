import {
  deploy,
  getZkAppState,
  createLocalBlockchain,
  MultiSigZkApp,
  sendTo
} from './multisig';
import { isReady, shutdown, PrivateKey, PublicKey } from 'snarkyjs';
import {describe, expect, beforeEach, afterAll, it} from '@jest/globals';

describe('sudoku', () => {
  let zkAppInstance: MultiSigZkApp,
    zkAppPrivateKey: PrivateKey,
    zkAppAddress: PublicKey,
    signersPk: PrivateKey[],
    signers: PublicKey[],
    account: PrivateKey;

  let numSigners = 5

  beforeEach(async () => {
    await isReady;
    account = createLocalBlockchain();
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkAppInstance = new MultiSigZkApp(zkAppAddress);

    signers = []
    for(let i = 0 ; i < numSigners ; i++){
      let pk = PrivateKey.random();
      signersPk.push(pk)
      signers.push(pk.toPublicKey())
    }

    return;
  });

  afterAll(async () => {
    setTimeout(shutdown, 0);
  });

  /*it('generates and deploys sudoku', async () => {
    await deploy(zkAppInstance, zkAppPrivateKey, sudoku, account);

    let state = getZkAppState(zkAppInstance);
    expect(state).toBeDefined();
    expect(state.isSolved).toBe(false);
  });*/

  it('sign a transfer with n/2+1 signers', async () => {
    await deploy(zkAppInstance, zkAppPrivateKey, signers, account);

    let state = getZkAppState(zkAppInstance);
    expect(state).toBeDefined();
    expect(state.balance.toConstant()).toBe(0);

    await sendTo(account, zkAppAddress)

    state = getZkAppState(zkAppInstance);
    expect(state.balance.toConstant()).toBe(1000);

    // let solution = solveSudoku(sudoku);
    // if (solution === undefined) throw Error('cannot happen');
    // let accepted = await submitSolution(
    //   sudoku,
    //   solution,
    //   account,
    //   zkAppAddress,
    //   zkAppPrivateKey
    // );
    // expect(accepted).toBe(true);

    // let { isSolved } = getZkAppState(zkAppInstance);
    // expect(isSolved).toBe(true);
  });

  // it('rejects an incorrect solution', async () => {
  //   await deploy(zkAppInstance, zkAppPrivateKey, sudoku, account);

  //   let solution = solveSudoku(sudoku);
  //   if (solution === undefined) throw Error('cannot happen');

  //   let noSolution = cloneSudoku(solution);
  //   noSolution[0][0] = (noSolution[0][0] % 9) + 1;

  //   expect.assertions(1);
  //   try {
  //     await submitSolution(
  //       sudoku,
  //       noSolution,
  //       account,
  //       zkAppAddress,
  //       zkAppPrivateKey
  //     );
  //   } catch (e) {
  //     // A row, column  or 3x3 square will not have full range 1-9
  //     // This will cause an assert.
  //   }

  //   let { isSolved } = await getZkAppState(zkAppInstance);
  //   expect(isSolved).toBe(false);
  // });
});
