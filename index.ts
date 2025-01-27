import axios from "axios";
import { ethers } from "ethers";
import abi from "./vaultAbi.json";

const WSS_RPC_URL = process.env.WSS_RPC_URL; // => "secret"

const GALXE_API_KEY = process.env.GALXE_API_KEY;

const contractAddress = "0x342800D4462Fc6624c82b1496545cC566308ccA9";

if (!WSS_RPC_URL) {
  throw "WSS_RPC_URL NOT FOUND";
}

if (!WSS_RPC_URL) {
  throw "GALXE_API_KEY NOT FOUND";
}

async function asyncParallelFilter<T>(
  arr: T[],
  cb: (el: T) => Promise<boolean>,
): Promise<T[]> {
  const filtered: T[] = [];

  await Promise.all(
    arr.map(async (element) => {
      const needAdd = await cb(element);

      if (needAdd) {
        filtered.push(element);
      }
    }),
  );

  return filtered;
}

const connectWSS = () => {
  console.log(
    `[${new Date().toLocaleTimeString()}] Connecting via WebSocket...`,
  );
  const provider = new ethers.WebSocketProvider(WSS_RPC_URL);
  let network = provider.getNetwork();
  network.then((res) =>
    console.log(
      `[${new Date().toLocaleTimeString()}] Connected to chain ID ${res.chainId}`,
    ),
  );

  provider.on("block", async (blockNumber) => {
    const block = await provider.getBlock(blockNumber);
    const filterFunc = async (txHash: any) => {
      const tx = await provider.getTransaction(txHash);
      if (!tx || tx.to?.toLowerCase() !== contractAddress.toLowerCase()) {
        return false; // Skip if not related to our contract
      }
      return true;
    };

    let transactions = block?.transactions.map((i) => i);

    let txHashesInContract = await asyncParallelFilter(
      transactions || [],
      filterFunc,
    );

    console.log(txHashesInContract);

    txHashesInContract.forEach(async (transactionHash) => {
      console.log(transactionHash);
      const transaction = await provider.getTransaction(transactionHash);
      if (
        transaction?.data.includes(
          "d0e30db000000000000000000000000000000000000000000000000000000000",
        ) &&
        transaction?.data.includes("0xcb09f61f")
      ) {
        console.log("safe deposit");
        await sendAPIGalxe("506117822003281920", [transaction.from]);
      }

      if (
        transaction?.data.includes(
          "2e1a7d4d00000000000000000000000000000000000000000000000000",
        ) &&
        transaction?.data.includes("0xcb09f61f")
      ) {
        console.log("safe withdraw");
        await sendAPIGalxe("506118272668663808", [transaction.from]);
      }

      if (
        transaction?.data.includes("0xd0e30db0") &&
        !transaction?.data.includes("0xcb09f61f")
      ) {
        console.log("bypass deposit");
        await sendAPIGalxe("506118897137614848", [transaction.from]);
      }

      if (
        transaction?.data.includes("0x2e1a7d4d") &&
        !transaction?.data.includes("0xcb09f61f")
      ) {
        console.log("bypass withdraw");
        await sendAPIGalxe("506119420033105920", [transaction.from]);
      }
    });

    console.log("txContract:", txHashesInContract);
  });
};

try {
  connectWSS();
} catch (err) {
  console.log(err);
}

// // Replace these with your details
// const provider = new ethers.WebSocketProvider("");
// const iface = new ethers.Interface(abi);
//
// provider.on("pending", async (txHash: any) => {
//   try {
//     // Get transaction details
//     const tx = await provider.getTransaction(txHash);
//     if (!tx || tx.to?.toLowerCase() !== contractAddress.toLowerCase()) {
//       return; // Skip if not related to our contract
//     }
//
//     // Decode input data to check the function
//     const decoded = iface.parseTransaction({ data: tx.data });
//     console.log(decoded);
//     if (decoded?.name === "yourFunctionName") {
//       console.log(`Transaction found: ${txHash}, from: ${tx.from}`);
//
//       // Fetch the receipt to check the status
//       const receipt = await tx.wait();
//       if (receipt?.status === 1) {
//         console.log(`Transaction succeeded! User: ${tx.from}`);
//       } else {
//         console.log(`Transaction failed! User: ${tx.from}`);
//       }
//     }
//   } catch (error) {
//     console.error(`Error processing transaction ${txHash}:`, error);
//   }
// });
//

const sendAPIGalxe = async (credId: string, address: string[]) => {
  try {
    let result = await axios.post(
      "https://graphigo.prd.galaxy.eco/query",
      {
        operationName: "credentialItems",
        query: `
          mutation credentialItems($credId: ID!, $operation: Operation!, $items: [String!]!) {
            credentialItems(input: { credId: $credId, operation: $operation, items: $items }) {
              name
            }
          }
        `,
        variables: {
          credId: credId, // Ensure it's a string to avoid overflow
          operation: "APPEND",
          items: address,
        },
      },
      {
        headers: {
          "access-token": GALXE_API_KEY,
        },
      },
    );

    if (result.status != 200) {
      throw result;
    } else if (result.data.errors && result.data.errors.length > 0) {
      console.error(result.data.errors);
      throw new Error(result.data.errors);
    } else {
      console.log("Success:", result.data.data.credentialItems);
    }
  } catch (error) {
    console.error("Error:", error);
  }
};
