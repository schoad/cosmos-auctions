import { ethers } from 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.min.js';
import { contractAddress, contractABI } from './config.js';

document.addEventListener('DOMContentLoaded', async () => {
    const connectWalletBtn = document.getElementById('connectWalletBtn');
    const infuraUrl = 'https://mainnet.infura.io/v3/9f3245fc6233454e8dbe7f730f466324'; // Replace with your Infura project ID
    let provider = new ethers.JsonRpcProvider(infuraUrl); // Initial provider uses Infura
    let contract = new ethers.Contract(contractAddress, contractABI, provider);
    let pauseRequests = false; // Flag to pause requests

    // Function to fetch and display bids
    const fetchBids = async (useENS = false) => {
        if (pauseRequests) return; // Exit if requests are paused

        try {
            const bidsTableBody = document.getElementById('bidsTableBody');
            const bidResponse = await contract.getBids(0, 14);

            const amounts = bidResponse.amounts;
            const users = bidResponse.users;

            // If using ENS, resolve all names before updating the table
            let resolvedUsers = [];
            if (useENS) {
                resolvedUsers = await Promise.all(users.map(async (user) => {
                    try {
                        return await provider.lookupAddress(user) || user.slice(0, 6) + '...' + user.slice(-4);
                    } catch (error) {
                        console.error(`Error looking up ENS name for ${user}`, error);
                        return user.slice(0, 6) + '...' + user.slice(-4);
                    }
                }));
            } else {
                // If not using ENS, just map to truncated addresses
                resolvedUsers = users.map(user => user.slice(0, 6) + '...' + user.slice(-4));
            }

            // Update table in one go
            bidsTableBody.innerHTML = ''; // Clear existing rows
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

                bidderCell.innerText = resolvedUsers[i]; // Use resolved or truncated address

                row.appendChild(bidRankCell);
                row.appendChild(bidAmountCell);
                row.appendChild(bidderCell);
                bidsTableBody.appendChild(row);
            }

        } catch (error) {
            console.error('Error fetching bids', error);
            if (error.response && error.response.status === 403) {
                pauseRequests = true;
                alert('Requests are paused due to a 403 Forbidden error.');
            } else {
                alert('Failed to fetch bids: ' + error.message);
            }
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
        if (pauseRequests) return; // Exit if requests are paused

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
                if (pauseRequests) return; // Exit if requests are paused

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
            if (error.response && error.response.status === 403) {
                pauseRequests = true;
                alert('Requests are paused due to a 403 Forbidden error.');
            } else {
                alert("An error occurred while fetching auction time. Please try again.");
            }
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