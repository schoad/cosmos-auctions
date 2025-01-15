document.addEventListener('DOMContentLoaded', function() {
    const gallery = document.getElementById('nftGallery');
    const toggleSwitch = document.getElementById('columnToggle');
    const fullScreenImage = document.getElementById('fullScreenImage');

    // Function to set the number of columns
    const setColumns = (columns) => {
        gallery.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    };

    // Event listener for toggle switch
    toggleSwitch.addEventListener('change', () => {
        setColumns(toggleSwitch.checked ? 3 : 2);
    });

    // Function to adjust column count based on window size
    const adjustForWindowSize = () => {
        const width = window.innerWidth;
        if (width < 601) {
            setColumns(1);
        } else if (width < 901) {
            setColumns(2);
        } else {
            setColumns(toggleSwitch.checked ? 3 : 2);
        }
    };

    // Adjust columns when window is resized
    window.addEventListener('resize', adjustForWindowSize);

    // Initial call to set columns based on current window size
    adjustForWindowSize();

    // Add images to the gallery in descending order of token IDs
    for (let tokenId = 229; tokenId >= 216; tokenId--) {
        const img = document.createElement('img');
        img.src = `src/images/small/cosmos_${tokenId}_small.png`;
        img.alt = `NFT ${tokenId}`;
        img.onerror = function() {
            this.src = `src/images/small/cosmos_${tokenId}_small.gif`;
        };
        img.addEventListener('click', function() {
            displayFullScreenImage(tokenId);
        });
        gallery.appendChild(img);
    }

    // Function to display full screen image
    function displayFullScreenImage(tokenId) {
        const img = document.createElement('img');
        img.src = `src/images/original/cosmos_${tokenId}.png`;
        img.alt = `NFT ${tokenId} Full`;
        img.onerror = function() {
            this.src = `src/images/original/cosmos_${tokenId}.gif`;
        };
        img.addEventListener('click', closeFullScreenImage);

        while (fullScreenImage.firstChild) {
            fullScreenImage.removeChild(fullScreenImage.firstChild);
        }
        fullScreenImage.appendChild(img);
        fullScreenImage.style.display = 'flex';
    }

    // Function to close full screen image
    function closeFullScreenImage() {
        fullScreenImage.style.display = 'none';
        while (fullScreenImage.firstChild) {
            fullScreenImage.removeChild(fullScreenImage.firstChild);
        }
    }

    // Function to adjust height dynamically
    const adjustHeight = () => {
        const headerHeight = document.querySelector('.header-bar').offsetHeight;
        const footerHeight = document.querySelector('.back-btn')?.offsetHeight || 0;
        const content = document.querySelector('.gallery');
        const padding = parseInt(window.getComputedStyle(content).paddingTop, 10) * 2;
        
        content.style.maxHeight = `calc(100vh - ${headerHeight + footerHeight + padding}px)`;
    };

    adjustHeight();
    window.addEventListener('resize', adjustHeight);
});