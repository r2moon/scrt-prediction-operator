/* eslint-disable @typescript-eslint/prefer-for-of */
/* eslint-disable @typescript-eslint/naming-convention */
import {/* inject, */ BindingScope, injectable} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  encodeSecp256k1Pubkey,
  EnigmaUtils,
  pubkeyToAddress,
  Secp256k1Pen,
  SigningCosmWasmClient,
} from 'secretjs';
import {Round, RoundStatus, State} from '../models';
import {RoundRepository} from '../repositories';
require('dotenv').config();

@injectable({scope: BindingScope.TRANSIENT})
export class MainService {
  constructor(
    @repository(RoundRepository)
    private roundRepository: RoundRepository,
  ) {}

  /*
   * Add service methods here
   */
  private async getClient(): Promise<SigningCosmWasmClient> {
    const mnemonic = process.env.MNEMONIC;
    if (!mnemonic) {
      throw Error('No Mnemonic');
    }
    const signingPen = await Secp256k1Pen.fromMnemonic(mnemonic);

    // Get the public key
    const pubkey = encodeSecp256k1Pubkey(signingPen.pubkey);

    // get the wallet address
    const accAddress = pubkeyToAddress(pubkey, 'secret');

    const txEncryptionSeed = EnigmaUtils.GenerateNewSeed();

    const client = new SigningCosmWasmClient(
      process.env.SECRET_REST_URL ?? '',
      accAddress,
      signBytes => signingPen.sign(signBytes),
      txEncryptionSeed,
      // customFees
    );

    return client;
  }

  private async fetchState(client: SigningCosmWasmClient): Promise<State> {
    const stateRaw = await client.queryContractSmart(
      process.env.PREDICTION_CONTRACT ?? '',
      {
        state: {},
      },
    );
    const state = new State();
    state.epoch = Number(stateRaw.epoch);
    state.totalFee = stateRaw.total_fee;
    state.paused = stateRaw.paused;
    return state;
  }

  private async fetchRound(
    client: SigningCosmWasmClient,
    epoch: number,
    oldRound: Round | undefined | null,
  ): Promise<Round | null> {
    try {
      const roundRaw = await client.queryContractSmart(
        process.env.PREDICTION_CONTRACT ?? '',
        {
          round: {epoch: epoch.toString()},
        },
      );
      const round: Round = oldRound ?? new Round();
      round.epoch = epoch;
      round.startTime = roundRaw.start_time;
      round.lockTime = roundRaw.lock_time;
      round.endTime = roundRaw.end_time;
      if (roundRaw.open_price) {
        round.openPrice = roundRaw.open_price;
      }
      if (roundRaw.close_price) {
        round.closePrice = roundRaw.close_price;
      }
      round.totalAmount = roundRaw.total_amount;
      round.rewardAmount = roundRaw.rewardAmount;
      round.upAmount = roundRaw.up_amount;
      round.downAmount = roundRaw.down_amount;
      round.isGenesis = roundRaw.is_genesis;
      if (round.closePrice) {
        round.status = RoundStatus.ENDED;
      } else if (round.openPrice) {
        round.status = RoundStatus.LOCKED;
      } else {
        round.status = RoundStatus.STARTED;
      }

      return round;
    } catch (err) {
      return null;
    }
  }

  async checkRound() {
    const executingRound = await this.roundRepository.findOne({
      where: {
        status: RoundStatus.EXECUTING,
      },
    });
    if (executingRound) {
      // If there is executing round, then return
      return;
    }

    let lockedRound = await this.roundRepository.findOne({
      where: {
        status: RoundStatus.LOCKED,
      },
    });
    if (lockedRound) {
      // If there is locked round, then check if it is ready to execute
      if (lockedRound.endTime >= Date.now() / 1000) {
        lockedRound.status = RoundStatus.EXECUTING;
        await this.roundRepository.save(lockedRound);
        // TODO: Execute
        const client = await this.getClient();
        try {
          const receipt = await client.execute(
            process.env.PREDICTION_CONTRACT ?? '',
            {
              execute_round: {},
            },
          );
          let updatedRound = await this.fetchRound(
            client,
            lockedRound.epoch,
            lockedRound,
          );
          if (updatedRound) {
            lockedRound = updatedRound;
            lockedRound.status = RoundStatus.ENDED;
            lockedRound.executeTx = receipt.transactionHash;
            await this.roundRepository.save(lockedRound);
          }

          let lastRound = await this.roundRepository.findOne({
            where: {
              epoch: lockedRound.epoch + 1,
            },
          });

          updatedRound = await this.fetchRound(
            client,
            lockedRound.epoch + 1,
            lastRound,
          );
          if (updatedRound) {
            lastRound = updatedRound;
            await this.roundRepository.save(lockedRound);
          }
        } catch (err) {
          lockedRound.status = RoundStatus.LOCKED;
          await this.roundRepository.save(lockedRound);
        }
      }
      return;
    }

    const client = await this.getClient();
    const lastTwoRounds = await this.roundRepository.find({
      order: ['epoch DESC'],
      limit: 2,
    });
    let fetchingEpoch =
      lastTwoRounds.length > 0 ? lastTwoRounds[0].epoch + 1 : 1;

    for (let i = 0; i < lastTwoRounds.length; i += 1) {
      const updatedRound = await this.fetchRound(
        client,
        fetchingEpoch,
        lastTwoRounds[i],
      );
      if (updatedRound) {
        await this.roundRepository.save(updatedRound);
      }
    }
    const state = await this.fetchState(client);
    for (; fetchingEpoch <= state.epoch; fetchingEpoch += 1) {
      const round = await this.fetchRound(client, fetchingEpoch, null);
      if (round) {
        await this.roundRepository.create(round);
      }
    }
  }
}
