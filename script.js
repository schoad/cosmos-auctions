import { ethers } from 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.min.js';
import { contractAddress, contractABI } from './config.js';
import { Cache } from './caching.js';

document.addEventListener('DOMContentLoaded', async () => {
    const connectWalletBtn = document.getElementById('connectWalletBtn');
    const infuraUrl = 'https://mainnet.infura.io/v3/9f3245fc6233454e8dbe7f730f466324';
    let provider = new ethers.JsonRpcProvider(infuraUrl);
    let web3Provider = null;
    let account = null;
    let contract = new ethers.Contract(contractAddress, contractABI, provider);
    let isWalletConnected = false;
    let selectedWeek = 1;
    const weekSelectIndex = document.getElementById('weekSelectIndex');
    const bidsContainer = document.getElementById('bidsContainer');
    const noAuctionMessage = document.getElementById('noAuctionMessage');
    let auctionInterval;
    let infuraCheckInterval;
    let infuraRetryCount = 0;
    const MAX_RETRIES = 3;
    let pauseRequests = false;

    // Set default to Week 1
    weekSelectIndex.value = '1';

    // Function to test Infura connection
    async function testInfuraConnection() {
        try {
            const networkError = await provider.getNetwork().catch(e => e);
            if (networkError instanceof Error) {
                if (networkError.message.includes('server response 403')) {
                    console.error("Infura access denied. Stopping connection attempts.");
                    pauseRequests = true;
                    if (infuraCheckInterval) {
                        clearInterval(infuraCheckInterval);
                    }
                    return false;
                }
                
                if (networkError.message.includes('failed to detect network')) {
                    console.log("Network detection in progress, will retry...");
                    return false;
                }
                
                console.error("Network error:", networkError.message);
                return false;
            }

            const result = await contract.totalSupply();
            
            if (result !== undefined) {
                pauseRequests = false;
                console.log("Infura connection successful. Total supply:", result.toString());
                if (infuraCheckInterval) {
                    clearInterval(infuraCheckInterval);
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error("Error during Infura connection test:", error);
            
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

    // Batch request helper
    async function batchRequests(requests) {
        return Promise.all(requests.map(req => makeRequest(...req)));
    }

    // Wrapper for making requests
    async function makeRequest(fn, ...args) {
        if (!pauseRequests) {
            return fn(...args);
        } else {
            console.error("Requests are blocked due to failed initialization or paused.");
            return Promise.reject(new Error("Requests are blocked"));
        }
    }

    // Optimized ENS resolution with caching
    async function resolveENS(address) {
        const cachedName = Cache.ens.get(address);
        if (cachedName) {
            return cachedName;
        }

        try {
            const ensName = await provider.lookupAddress(address);
            const resolvedName = ensName || address.slice(0, 6) + '...' + address.slice(-4);
            Cache.ens.set(address, resolvedName);
            return resolvedName;
        } catch (error) {
            console.error(`Error looking up ENS name for ${address}`, error);
            const fallbackName = address.slice(0, 6) + '...' + address.slice(-4);
            Cache.ens.set(address, fallbackName);
            return fallbackName;
        }
    }

    // Optimized bid fetching with batching and caching
    const fetchBids = async (useENS = true) => {
        try {
            const weekIndex = selectedWeek - 1;
            
            const cachedBids = Cache.bids.get(weekIndex);
            if (cachedBids) {
                await updateBidsTable(cachedBids, useENS);
                return;
            }

            const [bidResponse, auctionInfo] = await batchRequests([
                [contract.getBids, weekIndex, 14],
                [contract.getAuction, weekIndex]
            ]);

            const { amounts, users } = bidResponse;
            let resolvedUsers = users;

            if (useENS) {
                resolvedUsers = await Promise.all(users.map(resolveENS));
            }

            const processedBids = amounts.map((amount, i) => ({
                amount,
                user: resolvedUsers[i],
                rawAddress: users[i]
            }));

            Cache.bids.set(weekIndex, processedBids);
            await updateBidsTable(processedBids, useENS);

        } catch (error) {
            console.error('Error fetching bids', error);
            if (error.message.includes('no auction')) {
                bidsContainer.querySelector('table').classList.add('hidden');
                noAuctionMessage.classList.remove('hidden');
            } else {
                alert('Failed to fetch bids: ' + error.message);
            }
        }
    };

    // Separate table update function
    async function updateBidsTable(bids, useENS = true) {
        const bidsTableBody = document.getElementById('bidsTableBody');
        const fragment = document.createDocumentFragment();
        bidsTableBody.innerHTML = '';

        for (let i = 0; i < bids.length; i++) {
            const { amount, user, rawAddress } = bids[i];
            const row = document.createElement('tr');
            
            const bidRankCell = document.createElement('td');
            const bidAmountCell = document.createElement('td');
            const bidderCell = document.createElement('td');

            bidRankCell.innerText = i + 1;

            try {
                const amountInEther = parseFloat(ethers.formatEther(amount)).toFixed(2);
                bidAmountCell.innerText = amountInEther;
            } catch (error) {
                console.error('Error parsing amount', error);
                bidAmountCell.innerText = 'Error';
            }

            bidderCell.innerText = useENS ? 
                await resolveENS(rawAddress) : 
                rawAddress.slice(0, 6) + '...' + rawAddress.slice(-4);

            row.appendChild(bidRankCell);
            row.appendChild(bidAmountCell);
            row.appendChild(bidderCell);
            fragment.appendChild(row);
        }

        bidsTableBody.appendChild(fragment);
        bidsContainer.querySelector('table').classList.remove('hidden');
        noAuctionMessage.classList.add('hidden');
    }

    // Optimized user bid fetching with caching
    const fetchUserBid = async () => {
        if (!account || pauseRequests) return;

        try {
            const weekIndex = selectedWeek - 1;
            const userBid = await makeRequest(contract.getBidForUser, weekIndex, account);
            document.getElementById('userBid').innerText = ethers.formatEther(userBid.amount);
            
            if (account) {
                await resolveENS(account);
            }
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
            const weekIndex = selectedWeek - 1;
            const auctionInfo = await makeRequest(contract.getAuction, weekIndex);
            const startTime = Number(auctionInfo[1]) * 1000;
            const endTime = Number(auctionInfo[2]) * 1000;
            
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

            if (auctionInterval) {
                clearInterval(auctionInterval);
            }

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
        await fetchBids();
        await fetchAuctionTime();
    }

    // Event listener for week selection
    weekSelectIndex.addEventListener('change', async () => {
        if (!pauseRequests) {
            selectedWeek = parseInt(weekSelectIndex.value, 10);
            Cache.bids.data.delete(selectedWeek - 1); // Clear cache for new week
            await fetchBids();
            await fetchAuctionTime();
            if (isWalletConnected) {
                await fetchUserBid();
            }
        } else {
            console.warn('Request paused due to Infura connection issues.');
        }
    });

    // Wallet connection event listener
    connectWalletBtn.addEventListener('click', async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                web3Provider = new ethers.BrowserProvider(window.ethereum);
                const signer = await web3Provider.getSigner();
                const contractWithSigner = contract.connect(signer);
                let accountENS = null;
        
                provider = web3Provider;
                contract = contractWithSigner;
                pauseRequests = false;
                isWalletConnected = true;
                account = await signer.getAddress();
        
                if (account && typeof account === 'string') {
                    accountENS = await resolveENS(account);
                    document.getElementById('walletAddressDisplay').innerText = accountENS;
                    
                    await fetchUserBid();
                    document.getElementById('userInfoTable').classList.remove('hidden');
                    connectWalletBtn.style.display = 'none';
                    await fetchBids(true);
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

    // Mobile adjustments
    function adjustIndexPageForMobile() {
        const container = document.querySelector('.container');
        const headerBar = document.querySelector('.header-bar');
        const buttonContainer = document.querySelector('.button-container');
        const padding = parseInt(getComputedStyle(container).paddingTop, 10) * 2;
        
        const availableTableHeight = window.innerHeight - headerBar.offsetHeight - buttonContainer.offsetHeight - padding;
        document.getElementById('bidsTable').style.maxHeight = `${availableTableHeight}px`;
        
        if (window.innerWidth <= 600) {
            document.querySelectorAll('table, th, td').forEach(el => {
                el.style.fontSize = '10px';
            });
        }
    }

    // Handle wallet events
    if (typeof window.ethereum !== 'undefined') {
        window.ethereum.on('accountsChanged', async (accounts) => {
            Cache.clear();
            if (accounts.length === 0) {
                isWalletConnected = false;
                account = null;
                document.getElementById('userInfoTable').classList.add('hidden');
                connectWalletBtn.style.display = 'block';
                document.getElementById('walletAddressDisplay').innerText = '';
                await fetchBids(false);
            } else {
                account = accounts[0];
                await fetchUserBid();
                await fetchBids(true);
            }
        });

        window.ethereum.on('chainChanged', () => {
            Cache.clear();
            window.location.reload();
        });
    }

    adjustIndexPageForMobile();
    window.addEventListener('resize', adjustIndexPageForMobile);
});