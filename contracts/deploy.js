const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting NFT contract deployment...");

  // Contract configuration
  const contractName = "MacloNFT";
  const nftName = "Maclo Wallet Test NFT";
  const nftSymbol = "MWT";
  const baseTokenURI = "https://ipfs.io/ipfs/"; // You can change this to your IPFS gateway
  const maxSupply = 1000; // Set to 0 for unlimited
  const mintPrice = ethers.parseEther("0"); // Free minting

  // Get the contract factory
  const MacloNFT = await ethers.getContractFactory(contractName);
  
  // Deploy to Ethereum Sepolia
  console.log("\n=== Deploying to Ethereum Sepolia ===");
  const ethSepoliaNFT = await MacloNFT.deploy(
    nftName,
    nftSymbol,
    baseTokenURI,
    maxSupply,
    mintPrice
  );
  
  await ethSepoliaNFT.waitForDeployment();
  const ethSepoliaAddress = await ethSepoliaNFT.getAddress();
  console.log(`Ethereum Sepolia NFT deployed to: ${ethSepoliaAddress}`);

  // Deploy to Base Sepolia
  console.log("\n=== Deploying to Base Sepolia ===");
  const baseSepoliaNFT = await MacloNFT.deploy(
    nftName,
    nftSymbol,
    baseTokenURI,
    maxSupply,
    mintPrice
  );
  
  await baseSepoliaNFT.waitForDeployment();
  const baseSepoliaAddress = await baseSepoliaNFT.getAddress();
  console.log(`Base Sepolia NFT deployed to: ${baseSepoliaAddress}`);

  // Save deployment addresses
  const deploymentInfo = {
    ethereumSepolia: {
      address: ethSepoliaAddress,
      chainId: 11155111,
      name: "Ethereum Sepolia",
      blockExplorer: "https://sepolia.etherscan.io"
    },
    baseSepolia: {
      address: baseSepoliaAddress,
      chainId: 84532,
      name: "Base Sepolia",
      blockExplorer: "https://sepolia.basescan.org"
    },
    contractConfig: {
      name: nftName,
      symbol: nftSymbol,
      baseTokenURI,
      maxSupply,
      mintPrice: mintPrice.toString()
    }
  };

  // Write deployment info to file
  const deploymentPath = path.join(__dirname, "deployment.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to: ${deploymentPath}`);

  // Verify contracts (optional - requires API keys)
  console.log("\n=== Verification Info ===");
  console.log("To verify on Etherscan (Ethereum Sepolia):");
  console.log(`npx hardhat verify --network ethereumSepolia ${ethSepoliaAddress} "${nftName}" "${nftSymbol}" "${baseTokenURI}" ${maxSupply} ${mintPrice}`);
  
  console.log("\nTo verify on Basescan (Base Sepolia):");
  console.log(`npx hardhat verify --network baseSepolia ${baseSepoliaAddress} "${nftName}" "${nftSymbol}" "${baseTokenURI}" ${maxSupply} ${mintPrice}`);

  console.log("\n=== Deployment Complete ===");
  console.log("Contract addresses:");
  console.log(`Ethereum Sepolia: ${ethSepoliaAddress}`);
  console.log(`Base Sepolia: ${baseSepoliaAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
