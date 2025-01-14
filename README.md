# COSMOS Auction Viewer

**COSMOS** is a simple web application designed to display real-time information about an ongoing Ethereum-based auction for the COSMOS project. This application leverages blockchain technology to fetch and display auction details directly from a smart contract.

## Features

- **Auction Timer**: Shows the remaining time of the current auction in real-time.
- **Bid Leaderboard**: Displays the top bids in a table format, including:
  - Bid Rank
  - Bid Amount in ETH
  - Bidder's Address or ENS Name (if connected to a wallet)
- **User Interaction**:
  - **Connect Wallet**: Users can connect their Ethereum wallet (e.g., MetaMask) to interact with the auction.
  - **User Bid Information**: Once connected, users can see their own bid details directly on the page.

## How It Works

- **Without Wallet Connection**: 
  - The website fetches auction data through an Infura node, showing the auction timer and bid leaderboard with truncated Ethereum addresses.

- **With Wallet Connection**:
  - Users can connect their wallet to see their personal bid information.
  - ENS names are resolved for addresses when a wallet is connected, providing a more user-friendly display of bidder identities.

## Setup & Usage

1. **Clone the Repository**:
   git clone https://github.com/schoad/cosmos-auctions

2. **Install Dependencies**:
   - This project uses no backend, but you might need to update or install npm packages if there are any JavaScript dependencies:
   npm install

3. **Run the Application**:
   - Open the `index.html` file in a web browser that supports JavaScript and Web3 wallets like MetaMask.

4. **Wallet Integration**:
   - Install a Web3 wallet like MetaMask.
   - Connect your wallet on the website to interact with your auction participation.

## Technologies Used

- **HTML5** for structure
- **CSS3** for styling
- **JavaScript** with:
  - **Ethers.js** for interacting with wallet & Ethereum blockchain

## Contributing

Contributions are welcome! Please follow these steps:

- Fork the repository
- Create your feature branch (`git checkout -b feature/AmazingFeature`)
- Commit your changes (`git commit -m 'Add some AmazingFeature'`)
- Push to the branch (`git push origin feature/AmazingFeature`)
- Open a pull request

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
