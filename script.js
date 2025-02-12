import { ethers } from 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.min.js';
import { contractAddress, contractABI } from './config.js';
import { Cache } from './caching.js';

document.addEventListener('DOMContentLoaded', async () => {
    const connectWalletBtn = document.getElementById('connectWalletBtn');
    let provider = null;
    let web3Provider = null;
    let account = null;
    let contract = null;
    let isWalletConnected = false;
    let selectedWeek = 5;
    const weekSelectIndex = document.getElementById('weekSelectIndex');
    const bidsContainer = document.getElementById('bidsContainer');
    const noAuctionMessage = document.getElementById('noAuctionMessage');
    let auctionInterval;

    // Set default to Week 5
    weekSelectIndex.value = '5';

    // Global variable to keep track of the last update time
    window.lastUpdateTime = new Date(0); // Initialize to a very old date

    // Function to fetch and check for data updates
    async function checkForUpdates() {
        try {
            const url = `https://raw.githubusercontent.com/schoad/cosmos-auctions-data/main/data/index.json?timestamp=${new Date().getTime()}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Error fetching index.json');
            }

            const indexData = await response.json();
            const lastUpdated = new Date(indexData.lastUpdated);

            // Check if data has been updated
            if (lastUpdated > window.lastUpdateTime) {
                window.lastUpdateTime = lastUpdated;
                await fetchWeekData();  // Refresh the bids and auction time data
            }
        } catch (error) {
            console.error('Error checking for updates:', error);
        }
    }

    // Set an interval to check for updates every 15 seconds
    setInterval(checkForUpdates, 15000);

    // Fetch week data from GitHub
    async function fetchWeekData() {
        try {
            const weekIndex = selectedWeek - 1;
            const url = `https://raw.githubusercontent.com/schoad/cosmos-auctions-data/main/data/week_${weekIndex}.json?timestamp=${new Date().getTime()}`;
            console.log(`Fetching data from: ${url}`);
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('No data for this week');
            }

            const data = await response.json();
            console.log(`Fetched data for week ${selectedWeek}:`, data);

            await updateBids(data);
            await updateAuctionTime(data);
        } catch (error) {
            console.error('Error fetching week data:', error);
            bidsContainer.querySelector('table').classList.add('hidden');
            noAuctionMessage.classList.remove('hidden');
            noAuctionMessage.textContent = 'No auctions have started for this period.';
        }
    }

    // Separate function to update bids
    async function updateBids(data) {
        try {
            let processedBids;
            if (typeof data.bids.users[0] === 'string') {
                // Old format with user addresses as strings
                processedBids = data.bids.amounts.map((amount, index) => ({
                    amount: amount,
                    user: data.bids.users[index],
                    rawAddress: data.bids.users[index]
                }));
            } else {
                // New format with user objects
                processedBids = data.bids.amounts.map((amount, index) => ({
                    amount: amount,
                    user: data.bids.users[index].ensName || data.bids.users[index].address.slice(0, 6) + '...' + data.bids.users[index].address.slice(-4),
                    rawAddress: data.bids.users[index].address
                }));
            }

            await updateBidsTable(processedBids);
            noAuctionMessage.classList.add('hidden'); // Hide no auction message if data was fetched successfully
        } catch (error) {
            console.error('Error updating bids:', error);
            bidsContainer.querySelector('table').classList.add('hidden');
            noAuctionMessage.classList.remove('hidden');
            noAuctionMessage.textContent = 'No auctions have started for this period.';
        }
    }

    // Separate table update function
    async function updateBidsTable(bids) {
        const bidsTableBody = document.getElementById('bidsTableBody');
        const fragment = document.createDocumentFragment();
        bidsTableBody.innerHTML = '';

        for (let i = 0; i < bids.length; i++) {
            const { amount, user } = bids[i];
            const row = document.createElement('tr');
            
            const bidRankCell = document.createElement('td');
            const bidAmountCell = document.createElement('td');
            const bidderCell = document.createElement('td');

            bidRankCell.innerText = i + 1;
            bidAmountCell.innerText = amount; // Assuming amount is already in the format you need
            bidderCell.innerText = user || "undefined"; // Display ENS or address from JSON

            row.appendChild(bidRankCell);
            row.appendChild(bidAmountCell);
            row.appendChild(bidderCell);
            fragment.appendChild(row);
        }

        bidsTableBody.appendChild(fragment);
        bidsContainer.querySelector('table').classList.remove('hidden');
        noAuctionMessage.classList.add('hidden');
    }

    // Function to fetch and display auction time
    async function updateAuctionTime(data) {
        try {
            if (!data.auction || !data.auction.endTime) {
                throw new Error('Auction time data not available');
            }

            const endTime = data.auction.endTime * 1000; // Convert Unix timestamp to milliseconds
            
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
            console.error("Error fetching auction time from JSON:", error);
            document.getElementById('timeRemaining').innerText = "No Auction";
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

    // Optimized user bid fetching with caching
    const fetchUserBid = async () => {
        if (!account) return;

        try {
            const weekIndex = selectedWeek - 1;
            const userBid = await contract.getBidForUser(weekIndex, account);
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

    // Event listener for week selection
    weekSelectIndex.addEventListener('change', async () => {
        selectedWeek = parseInt(weekSelectIndex.value, 10);
        await fetchWeekData();
        if (isWalletConnected) {
            await fetchUserBid();
        }
    });

    // Wallet connection event listener
    connectWalletBtn.addEventListener('click', async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                web3Provider = new ethers.BrowserProvider(window.ethereum);
                const signer = await web3Provider.getSigner();
                contract = new ethers.Contract(contractAddress, contractABI, signer);
                
                provider = web3Provider;
                isWalletConnected = true;
                account = await signer.getAddress();
        
                if (account && typeof account === 'string') {
                    const accountENS = await resolveENS(account);
                    document.getElementById('walletAddressDisplay').innerText = accountENS;
                    
                    await fetchUserBid();
                    document.getElementById('userInfoTable').classList.remove('hidden');
                    connectWalletBtn.style.display = 'none';
                    await fetchWeekData();
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

    // Initial fetch of bids and auction time
    await fetchWeekData();

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
                await fetchWeekData();
            } else {
                account = accounts[0];
                await fetchUserBid();
            }
        });

        window.ethereum.on('chainChanged', () => {
            Cache.clear();
            window.location.reload();
        });
    }

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

    adjustIndexPageForMobile();
    window.addEventListener('resize', adjustIndexPageForMobile);
});