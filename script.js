import { ethers } from 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.min.js';
import { contractAddress, contractABI } from './config.js';

document.addEventListener('DOMContentLoaded', async () => {
    const connectWalletBtn = document.getElementById('connectWalletBtn');
    const infuraUrl = 'https://mainnet.infura.io/v3/9f3245fc6233454e8dbe7f730f466324'; // Replace with your Infura project ID
    let provider = new ethers.JsonRpcProvider(infuraUrl); // Initial provider uses Infura
    let contract = new ethers.Contract(contractAddress, contractABI, provider);

    // Function to fetch and display bids
    const fetchBids = async (useENS = false) => {
        try {
            const bidsTableBody = document.getElementById('bidsTableBody');
            bidsTableBody.innerHTML = ''; // Clear existing rows
            const bidResponse = await contract.getBids(0, 14);

            const amounts = bidResponse.amounts;
            const users = bidResponse.users;

            for (let i = 0; i < amounts.length; i++) {
                const row = document.createElement('tr');
                const bidRankCell = document.createElement('td');
                const bidAmountCell = document.createElement('td');
                const bidderCell = document.createElement('td');

                bidRankCell.innerText = i + 1;

                try {
                    const amountInEther = parseFloat(ethers.formatEther(amounts[i])).toFixed(2);
                    bidAmountCell.innerText = amountInEther;
                } catch (error) {
                    console.error('Error parsing amount', error);
                    bidAmountCell.innerText = 'Error';
                }

                // Only perform ENS lookup if useENS is true
                if (useENS) {
                    let ensName = null;
                    try {
                        ensName = await provider.lookupAddress(users[i]);
                    } catch (error) {
                        console.error(`Error looking up ENS name for ${users[i]}`, error);
                    }

                    if (ensName) {
                        bidderCell.innerText = ensName;
                    } else {
                        bidderCell.innerText = users[i].slice(0, 6) + '...' + users[i].slice(-4);
                    }
                } else {
                    // If not using ENS, just show truncated address
                    bidderCell.innerText = users[i].slice(0, 6) + '...' + users[i].slice(-4);
                }

                row.appendChild(bidRankCell);
                row.appendChild(bidAmountCell);
                row.appendChild(bidderCell);
                bidsTableBody.appendChild(row);
            }
        } catch (error) {
            console.error('Error fetching bids', error);
            alert('Failed to fetch bids: ' + error.message);
        }
    };

    // Function to fetch and display user's bid
    const fetchUserBid = async (account) => {
        try {
            const userBid = await contract.getBidForUser(0, account);
            document.getElementById('userBid').innerText = ethers.formatEther(userBid.amount);
        } catch (error) {
            console.error("Error fetching user's bid:", error);
            alert("An error occurred while fetching your bid. Please try again.");
        }
    };

    // Function to fetch and display auction time
    const fetchAuctionTime = async () => {
        try {
            const auctionInfo = await contract.getAuction(0);
            const startTime = Number(auctionInfo[1]) * 1000; // Convert to milliseconds
            const endTime = Number(auctionInfo[2]) * 1000; // Convert to milliseconds
            const now = Date.now();

            // Calculate remaining time
            const timeLeft = endTime - now;
            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

            document.getElementById('timeRemaining').innerText = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            // Update auction time every second
            setInterval(async () => {
                const now = Date.now();
                const timeLeft = endTime - now;
                if (timeLeft > 0) {
                    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
                    document.getElementById('timeRemaining').innerText = 
                        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                } else {
                    document.getElementById('timeRemaining').innerText = 'Auction Ended';
                    clearInterval(this);
                }
            }, 1000); // Update every second
        } catch (error) {
            console.error("Error fetching auction time:", error);
            alert("An error occurred while fetching auction time. Please try again.");
        }
    };

    // Initial fetch of bids and auction time using Infura
    await fetchBids(); // Initially, we don't use ENS
    await fetchAuctionTime();

    connectWalletBtn.addEventListener('click', async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                const web3Provider = new ethers.BrowserProvider(window.ethereum);
                const signer = await web3Provider.getSigner();
                const contractWithSigner = contract.connect(signer);
        
                // Update provider and contract after wallet connection
                provider = web3Provider;
                contract = contractWithSigner;

                // Get the current account address from the signer
                const account = await signer.getAddress();
        
                console.log('Account:', account, typeof account);
        
                if (account && typeof account === 'string') {
                    // Display the wallet address
                    document.getElementById('walletAddressDisplay').innerText = account.slice(0, 6) + '...' + account.slice(-4);
        
                    // Fetch user's bid using the connected wallet
                    await fetchUserBid(account);
        
                    // Show the user info table
                    document.getElementById('userInfoTable').classList.remove('hidden');
        
                    // Hide the connect wallet button after successful connection
                    connectWalletBtn.style.display = 'none';

                    // Fetch bids again but now using ENS
                    await fetchBids(true); // Pass true to use ENS lookup
                } else {
                    console.error('Account is not a string or is undefined:', account);
                    alert('Failed to connect wallet. Please try again.');
                }
        
            } catch (error) {
                console.error("Error:", error);
                alert("An error occurred. Please try again.");
            }
        } else {
            alert("Please install MetaMask or another Web3 wallet to use this feature.");
        }
    });
});