import { ethers } from 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.min.js';
import { contractAddress, contractABI } from './config.js';

document.addEventListener('DOMContentLoaded', async () => {
    const connectWalletBtn = document.getElementById('connectWalletBtn');
    const infuraUrl = 'https://mainnet.infura.io/v3/9f3245fc6233454e8dbe7f730f466324'; // Replace with your Infura project ID
    let provider = new ethers.JsonRpcProvider(infuraUrl); // Initial provider uses Infura
    let web3Provider = null; // Global declaration for web3Provider
    let account = null; // Global declaration for account
    let contract = new ethers.Contract(contractAddress, contractABI, provider);
    let isWalletConnected = false; // New variable to track wallet connection
    let selectedWeek = 1; // Global declaration, initialized to 1
    const weekSelectIndex = document.getElementById('weekSelectIndex');
    const bidsContainer = document.getElementById('bidsContainer');
    const noAuctionMessage = document.getElementById('noAuctionMessage');
    let auctionInterval;
    // Global variables for Infura connection management
    let infuraCheckInterval;
    let infuraRetryCount = 0;
    const MAX_RETRIES = 3;
    let pauseRequests = false;

    // Set default to Week 1
    weekSelectIndex.value = '1'; 

    // Function to test Infura connection
    async function testInfuraConnection() {
        try {
            // First try to detect network
            const networkError = await provider.getNetwork().catch(e => e);
            if (networkError instanceof Error) {
                // Check if it's a 403 error with specific message
                if (networkError.message.includes('server response 403')) {
                    console.error("Infura access denied. Stopping connection attempts.");
                    pauseRequests = true;
                    if (infuraCheckInterval) {
                        clearInterval(infuraCheckInterval);
                    }
                    return false;
                }
                
                // If it's a network detection error, allow retry
                if (networkError.message.includes('failed to detect network')) {
                    console.log("Network detection in progress, will retry...");
                    return false;
                }
                
                // For other errors, increment retry count
                console.error("Network error:", networkError.message);
                return false;
            }

            // If we get here, network is detected, try contract call
            const result = await contract.totalSupply();
            
            if (result !== undefined) {
                pauseRequests = false;
                console.log("Infura connection successful. Total supply:", result.toString());
                // Clear any existing interval
                if (infuraCheckInterval) {
                    clearInterval(infuraCheckInterval);
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error("Error during Infura connection test:", error);
            
            // Check for specific project ID rejection
            if (error?.error?.message === "rejected due to project ID settings" || 
                error?.message?.includes("rejected due to project ID settings")) {
                console.error("Infura project ID rejected. Stopping connection attempts.");
                pauseRequests = true;
                if (infuraCheckInterval) {
                    clearInterval(infuraCheckInterval);
                }
                return false;
            }

            pauseRequests = true;
            return false;
        }
    }

    // Only set up interval if first connection fails
    const initialCheck = await testInfuraConnection();
    if (!initialCheck && !isWalletConnected) {
        infuraCheckInterval = setInterval(async () => {
            // Don't increment retry count for network detection errors
            const error = await provider.getNetwork().catch(e => e);
            if (!(error instanceof Error) || !error.message.includes('failed to detect network')) {
                infuraRetryCount++;
            }
            
            if (infuraRetryCount >= MAX_RETRIES) {
                console.error(`Failed to connect after ${MAX_RETRIES} attempts. Stopping retries.`);
                clearInterval(infuraCheckInterval);
                return;
            }
            await testInfuraConnection();
        }, 60000);
    }

    // Wrapper for making requests, which will check if requests are allowed
    async function makeRequest(fn, ...args) {
        if (!pauseRequests) {
            return fn(...args);
        } else {
            console.error("Requests are blocked due to failed initialization or paused.");
            return Promise.reject(new Error("Requests are blocked"));
        }
    }

    // Function to fetch and display bids
    const fetchBids = async (useENS = true) => {
        try {
            // Use the global selectedWeek here
            const weekIndex = selectedWeek - 1; // Convert to 0-based index
            const bidsTableBody = document.getElementById('bidsTableBody');
            const bidResponse = await makeRequest(contract.getBids, weekIndex, 14);

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

            // Show table, hide message
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
            bidsContainer.querySelector('table').classList.remove('hidden');
            noAuctionMessage.classList.add('hidden');

        } catch (error) {
            console.error('Error fetching bids', error);
            if (error.message.includes('no auction')) {
                // If no auction for this period
                bidsContainer.querySelector('table').classList.add('hidden');
                noAuctionMessage.classList.remove('hidden');
            } else {
                alert('Failed to fetch bids: ' + error.message);
            }
        }
    };

    // Function to fetch and display user's bid
    const fetchUserBid = async () => {
        try {
            // Use the global selectedWeek here
            const weekIndex = selectedWeek - 1; // Convert to 0-based index
            const userBid = await makeRequest(contract.getBidForUser, weekIndex, account);
            document.getElementById('userBid').innerText = ethers.formatEther(userBid.amount);
            
        } catch (error) {
            console.error("Error fetching user's bid:", error);
            if (error.message.includes('no auction')) {
                document.getElementById('userBid').innerText = "No Auction";
            } else {
                alert("An error occurred while fetching your bid. Please try again.");
            }
        }
    };

    // Function to fetch and display auction time
    const fetchAuctionTime = async () => {
        try {
            const weekIndex = selectedWeek - 1; // Convert to 0-based index
            const auctionInfo = await makeRequest(contract.getAuction, weekIndex);
            const startTime = Number(auctionInfo[1]) * 1000; // Convert to milliseconds
            const endTime = Number(auctionInfo[2]) * 1000; // Convert to milliseconds
            const now = Date.now();

            const updateAuctionTime = () => {
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
                    clearInterval(auctionInterval);
                }
            };

            // Clear any existing interval before setting a new one
            if (auctionInterval) {
                clearInterval(auctionInterval);
            }

            // Update auction time immediately and then every second
            updateAuctionTime();
            auctionInterval = setInterval(updateAuctionTime, 1000);

        } catch (error) {
            console.error("Error fetching auction time:", error);
            if (error.message.includes('no auction')) {
                document.getElementById('timeRemaining').innerText = "No Auction";
            } else {
                alert("An error occurred while fetching auction time. Please try again.");
            }
        }
    };

    // Initial fetch of bids and auction time if Infura is available
    if (!pauseRequests) {
        await fetchBids(); // Initially, we don't use ENS
        await fetchAuctionTime();
    }

    // Event listener for week selection
    weekSelectIndex.addEventListener('change', async () => {
        if (!pauseRequests) {
            // Update the global selectedWeek when the user changes the selection
            selectedWeek = parseInt(weekSelectIndex.value, 10); // Ensure the week value is correctly parsed
            await fetchBids();
            await fetchAuctionTime();
            if (isWalletConnected) {
                await fetchUserBid(); // Use global account
            }
        } else {
            console.warn('Request paused due to Infura connection issues.');
        }
    });

    connectWalletBtn.addEventListener('click', async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                web3Provider = new ethers.BrowserProvider(window.ethereum); // Assign to global web3Provider
                const signer = await web3Provider.getSigner();
                const contractWithSigner = contract.connect(signer);
                let accountENS = null;
        
                // Update provider and contract after wallet connection
                provider = web3Provider;
                contract = contractWithSigner; // Use wallet's provider for contract calls

                // Reset pauseRequests to false after successful wallet connection
                pauseRequests = false;

                // Set wallet connection status
                isWalletConnected = true;

                // Get the current account address from the signer
                account = await signer.getAddress(); // Assign to global account
        
                console.log('Account:', account, typeof account);
        
                if (account && typeof account === 'string') {
                    // Display the wallet address
        
                    accountENS = await provider.lookupAddress(account);
                    if(accountENS !== null) {
                        document.getElementById('walletAddressDisplay').innerText = accountENS;
                    } else {
                        document.getElementById('walletAddressDisplay').innerText = account.slice(0, 6) + '...' + account.slice(-4);
                    }
                                            
                    // Fetch user's bid using the connected wallet
                    await fetchUserBid();
        
                    // Show the user info table
                    document.getElementById('userInfoTable').classList.remove('hidden');
        
                    // Hide the connect wallet button after successful connection
                    connectWalletBtn.style.display = 'none';

                    // Refresh bids with ENS names using the new provider
                    await fetchBids(true); // Pass true to use ENS lookup

                    // Refresh auction time using the new provider
                    await fetchAuctionTime();

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

    // Function for mobile adjustments
    function adjustIndexPageForMobile() {
        const container = document.querySelector('.container');
        const headerBar = document.querySelector('.header-bar');
        const buttonContainer = document.querySelector('.button-container');
        const padding = parseInt(getComputedStyle(container).paddingTop, 10) * 2;
        
        // Calculate available height for the table
        const availableTableHeight = window.innerHeight - headerBar.offsetHeight - buttonContainer.offsetHeight - padding;
        
        // Adjust table max-height
        document.getElementById('bidsTable').style.maxHeight = `${availableTableHeight}px`;
        
        // Adjust font size if needed
        if (window.innerWidth <= 600) {
            document.querySelectorAll('table, th, td').forEach(el => {
                el.style.fontSize = '10px';
            });
        }
    }

    adjustIndexPageForMobile();
    window.addEventListener('resize', adjustIndexPageForMobile);
});