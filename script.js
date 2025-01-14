import { contractAddress, contractABI } from './config.js';

document.addEventListener('DOMContentLoaded', async () => {
    const connectWalletBtn = document.getElementById('connectWalletBtn');

    connectWalletBtn.addEventListener('click', async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                const web3 = new Web3(window.ethereum);
               
                const contract = new web3.eth.Contract(contractABI, contractAddress);

                // Get the current account
                const accounts = await web3.eth.getAccounts();
                const account = accounts[0];

                // Display the wallet address
                document.getElementById('walletAddressDisplay').innerText = account.slice(0, 6) + '...' + account.slice(-4);

                // Set the wallet icon (you can use a placeholder or actual wallet icon URL)
                document.getElementById('walletIcon').src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=='; // Placeholder image

                // Fetch top bids
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

                // Fetch user's bid
                try {
                    const userBid = await contract.methods.getBidForUser(0, account).call();
                    document.getElementById('userBid').innerText = web3.utils.fromWei(userBid.amount.toString(), 'ether') + ' ETH';
                } catch (error) {
                    console.error("Error fetching user's bid:", error);
                    alert("An error occurred while fetching your bid. Please try again.");
                }

                // Re-enable auction time fetching
                try {
                    const auctionInfo = await contract.methods.getAuction(0).call();
                    const startTime = parseInt(auctionInfo[1]) * 1000; // Convert to milliseconds
                    const endTime = parseInt(auctionInfo[2]) * 1000; // Convert to milliseconds
                    const now = Date.now();

                    // Calculate remaining time
                    const timeLeft = endTime - now;
                    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

                    document.getElementById('timeRemaining').innerText = `${days} days, ${hours} hours, ${minutes} minutes`;

                    // Update auction time every minute
                    setInterval(async () => {
                        const now = Date.now();
                        const timeLeft = endTime - now;
                        if (timeLeft > 0) {
                            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                            document.getElementById('timeRemaining').innerText = `${days} days, ${hours} hours, ${minutes} minutes`;
                        } else {
                            document.getElementById('timeRemaining').innerText = 'Auction Ended';
                            clearInterval(this);
                        }
                    }, 60000); // Update every minute
                } catch (error) {
                    console.error("Error fetching auction time:", error);
                    alert("An error occurred while fetching auction time. Please try again.");
                }

                // Hide the connect wallet button after successful connection
                connectWalletBtn.style.display = 'none';

            } catch (error) {
                console.error("Error:", error);
                alert("An error occurred. Please try again.");
            }
        } else {
            alert("Please install MetaMask or another Web3 wallet to use this feature.");
        }
    });
});
