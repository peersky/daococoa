import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  MULTIPASS_CONTRACT_VERSION,
  MULTIPASS_CONTRACT_NAME,
} from "../../test/utils";
import { ethers } from "hardhat";
import { BestOfInit } from "../../types/typechain/contracts/initializers/BestOfInit";
import { RankToken } from "../../types/typechain/contracts/tokens/RankToken";
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, diamond, getOrNull } = deployments;

  const { deployer } = await getNamedAccounts();

  if (
    !process.env.BLOCKS_PER_TURN ||
    !process.env.MAX_PLAYERS ||
    !process.env.MIN_PLAYERS ||
    !process.env.BLOCKS_TO_JOIN ||
    !process.env.GAME_PRICE_ETH ||
    !process.env.JOIN_GAME_PRICE_ETH ||
    !process.env.MAX_TURNS ||
    !process.env.NUM_WINNERS
  )
    throw new Error("Best of initializer variables not set");

  if (!process.env.BESTOF_CONTRACT_VERSION || !process.env.BESTOF_CONTRACT_NAME)
    throw new Error("EIP712 intializer args not set");
  const rankTokenDeployment = await deployments.getOrNull("RankToken");

  const rankToken = new ethers.Contract(
    rankTokenDeployment.address,
    rankTokenDeployment.abi,
    hre.ethers.provider
  ) as RankToken;
  if (!rankToken) throw new Error("rank token not deployed");

  const settings: BestOfInit.ContractInitializerStruct = {
    blocksPerTurn: process.env.BLOCKS_PER_TURN,
    maxTurns: process.env.MAX_TURNS,
    maxPlayersSize: process.env.MAX_PLAYERS,
    minPlayersSize: process.env.MIN_PLAYERS,
    rankTokenAddress: rankToken.address,
    blocksToJoin: process.env.BLOCKS_TO_JOIN,
    gamePrice: ethers.utils.parseEther(process.env.GAME_PRICE_ETH),
    joinGamePrice: ethers.utils.parseEther(process.env.JOIN_GAME_PRICE_ETH),
    numWinners: process.env.NUM_WINNERS,
  };

  const deployment = await diamond.deploy("BestOfGame", {
    log: true,
    from: deployer,
    owner: deployer,

    facets: [
      "BestOfFacet",
      "GameMastersFacet",
      "RequirementsFacet",
      "EIP712InspectorFacet",
      "BestOfInit",
    ],
    execute: {
      methodName: "init",
      args: [
        process.env.BESTOF_CONTRACT_NAME,
        process.env.BESTOF_CONTRACT_VERSION,
        [
          settings.blocksPerTurn,
          settings.maxPlayersSize,
          settings.minPlayersSize,
          settings.rankTokenAddress,
          settings.blocksToJoin,
          settings.gamePrice,
          settings.joinGamePrice,
          settings.maxTurns,
          settings.numWinners,
        ],
      ],
    },
  });
  const rOwner = await rankToken.owner();
  if (rOwner !== deployment.address) {
    await rankToken.transferOwnership(deployment.address);
  }
};

export default func;
func.tags = ["gameofbest", "gamediamond"];
