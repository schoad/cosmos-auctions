document.addEventListener('DOMContentLoaded', function() {
    const gallery = document.getElementById('nftGallery');
    const toggleSwitch = document.getElementById('columnToggle');
    const fullScreenImage = document.getElementById('fullScreenImage');
    const weekSelect = document.getElementById('weekSelect');

    // Prevent double-tap zoom on iOS
    document.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.target.click();
    }, false);

    // Function to set the number of columns
    const setColumns = (columns) => {
        gallery.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    };

    // Event listener for toggle switch
    toggleSwitch.addEventListener('change', () => {
        setColumns(toggleSwitch.checked ? 5 : 3); // Changed logic here
        refreshGallery(); // Refresh the gallery when changing columns
    });

    // Function to adjust column count based on window size
    const adjustForWindowSize = () => {
        const width = window.innerWidth;
        if (width < 601) {
            setColumns(3);
        } else if (width < 901) {
            setColumns(4);
        } else {
            setColumns(toggleSwitch.checked ? 5 : 3); // Changed default to 3
        }
        refreshGallery(); // Refresh the gallery when resizing
    };

    // Function to display images based on selected week
    function refreshGallery() {
        // Change: Since weekSelect values are now strings, we remove the parseInt call
        const selectedWeek = weekSelect.value;
        // Adjust calculation for token IDs since weeks are now string values
        const startTokenId = (parseInt(selectedWeek) - 1) * 14 + 216; // Adjust start based on week
        const endTokenId = startTokenId + 13;

        // Clear existing images
        gallery.innerHTML = '';
        gallery.style.display = 'block'; // Reset display for single image
        gallery.style.overflow = 'hidden'; // Prevent scrolling

        if (selectedWeek === '1') { // Only Week 1 has available images
            gallery.style.display = 'grid'; // Revert to grid for multiple images
            gallery.style.height = 'auto'; // Let it adjust to content
            for (let tokenId = startTokenId; tokenId <= endTokenId; tokenId++) {
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
        } else {
            // For all other weeks, show a single centered "not eligible" image
            const img = document.createElement('img');
            img.src = 'src/images/cosmos_not_eligible.gif';
            img.alt = 'NFTs not available for this week';
            img.style.display = 'block';
            img.style.margin = 'auto';
            img.style.maxHeight = 'calc(100vh - 140px)'; // Adjust based on your layout
            img.style.maxWidth = '100%';
            gallery.appendChild(img);
            
            // Adjust gallery height to fit the image without scrolling
            gallery.style.height = `${img.clientHeight}px`;
        }

        adjustGalleryHeight();
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

    // Adjust gallery height dynamically based on content
    function adjustGalleryHeight() {
        const headerHeight = document.querySelector('.header-bar').offsetHeight;
        const footerHeight = document.querySelector('.back-btn')?.offsetHeight || 0;
        const galleryPadding = parseInt(getComputedStyle(gallery).paddingTop) * 2; // Assuming top and bottom padding are equal
        const availableHeight = window.innerHeight - headerHeight - footerHeight - galleryPadding;
        
        gallery.style.maxHeight = `${availableHeight}px`;
        gallery.style.overflow = 'auto';

    }

    // Event listener for week selection - no need for parseInt since values are strings
    weekSelect.addEventListener('change', refreshGallery);

    // Adjust columns and gallery height when window is resized
    window.addEventListener('resize', () => {
        adjustForWindowSize();
        adjustGalleryHeight();
    });

    // Initial setup
    setColumns(3); // Set default to 3 columns
    adjustForWindowSize();
    refreshGallery(); // Display images for the initially selected week

    adjustGalleryHeight();
});