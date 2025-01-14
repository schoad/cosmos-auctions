import { contractAddress, contractABI } from './config.js';

let web3;
let contract;
let account;

document.addEventListener('DOMContentLoaded', async () => {
    const connectWalletBtn = document.getElementById('connectWalletBtn');

    connectWalletBtn.addEventListener('click', async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                web3 = new Web3(window.ethereum);
               
                contract = new web3.eth.Contract(contractABI, contractAddress);

                // Get the current account
                const accounts = await web3.eth.getAccounts();
                account = accounts[0];

                // Display the wallet address
                document.getElementById('walletAddressDisplay').innerText = account;

                // Fetch top bids
                await fetchTopBids();

                // Fetch user's bid
                await fetchUserBid();

                // Re-enable auction time fetching
                await fetchAuctionTime();

                // Hide the connect wallet button after successful connection
                connectWalletBtn.style.display = 'none';

                // Update bid buttons
                await updateBidButtons();

            } catch (error) {
                console.error("Error:", error);
                alert("An error occurred. Please try again.");
            }
        } else {
            alert("Please install MetaMask or another Web3 wallet to use this feature.");
        }
    });
});

async function fetchTopBids() {
    try {
        const bidsTableBody = document.getElementById('bidsTableBody');
        const bidResponse = await contract.methods.getBids(0, 14).call();

        const amounts = bidResponse.amounts;
        const users = bidResponse.users;

        for (let i = 0; i < amounts.length; i++) {
            const row = document.createElement('tr');
            const bidRankCell = document.createElement('td');
            const bidAmountCell = document.createElement('td');
            const bidderCell = document.createElement('td');

            bidRankCell.innerText = i + 1;

            try {
                const amountInEther = parseFloat(web3.utils.fromWei(amounts[i].toString(), 'ether')).toFixed(2);
                bidAmountCell.innerText = amountInEther;
            } catch (error) {
                console.error('Error parsing amount', error);
                bidAmountCell.innerText = 'Error';
            }

            bidderCell.innerText = users[i].slice(0, 6) + '...' + users[i].slice(-4);

            row.appendChild(bidRankCell);
            row.appendChild(bidAmountCell);
            row.appendChild(bidderCell);
            bidsTableBody.appendChild(row);
        }
    } catch (error) {
        console.error('Error fetching bids', error);
        alert('Failed to fetch bids: ' + error.message);
    }
}

async function fetchUserBid() {
    try {
        const userBid = await contract.methods.getBidForUser(0, account).call();
        document.getElementById('userBid').innerText = web3.utils.fromWei(userBid.amount.toString(), 'ether') + ' ETH';
    } catch (error) {
        console.error("Error fetching user's bid:", error);
        alert("An error occurred while fetching your bid. Please try again.");
    }
}

async function fetchAuctionTime() {
    try {
        const auctionInfo = await contract.methods.getAuction(0).call();
        const startTime = parseInt(auctionInfo[1]) * 1000; // Convert to milliseconds
        const endTime = parseInt(auctionInfo[2]) * 1000; // Convert to milliseconds
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
}

document.getElementById('placeBidBtn').addEventListener('click', showBidInputMask);
document.getElementById('raiseBidBtn').addEventListener('click', showBidInputMask);
document.getElementById('submitBidBtn').addEventListener('click', submitBid);

function showBidInputMask() {
    document.getElementById('bidInputMask').style.display = 'block';
}

async function submitBid() {
    const bidAmount = document.getElementById('bidAmount').value;
    const auctionId = 0; // Assuming auctionId is 0

    if (bidAmount < 0.01) {
        alert('Bid amount must be at least 0.01 ETH');
        return;
    }

    try {
        await enterBid(account, auctionId, bidAmount);
        alert('Bid submitted successfully');
    } catch (error) {
        console.error('Error submitting bid:', error);
        alert('Error submitting bid');
    }
}

async function enterBid(account, auctionId, payableAmount) {
    const weiAmount = web3.utils.toWei(payableAmount, 'ether');
    await contract.methods.enterBid(auctionId).send({
        from: account,
        value: weiAmount
    });
}

async function updateBidButtons() {
    try {
        const userBid = await contract.methods.getBidForUser(0, account).call();

        if (!userBid.amount || userBid.amount === '0') {
            document.getElementById('placeBidBtn').style.display = 'block';
        } else {
            const bidResponse = await contract.methods.getBids(0, 14).call();
            const amounts = bidResponse.amounts;
            const minBid = Math.min(...amounts.map(amount => parseFloat(web3.utils.fromWei(amount, 'ether'))));
            document.getElementById('bidAmount').min = (minBid + 0.01).toFixed(2);

            if (!amounts.includes(userBid.amount)) {
                document.getElementById('raiseBidBtn').style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error updating bid buttons', error);
    }
}
