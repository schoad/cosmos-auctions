// caching.js
export const Cache = {
    // ENS cache with 1-hour TTL
    ens: {
        data: new Map(),
        ttl: 3600000, // 1 hour in milliseconds
        get: function(address) {
            const cached = this.data.get(address);
            if (cached && Date.now() - cached.timestamp < this.ttl) {
                return cached.value;
            }
            return null;
        },
        set: function(address, name) {
            this.data.set(address, {
                value: name,
                timestamp: Date.now()
            });
        }
    },

    // Bids cache with 30-second TTL
    bids: {
        data: new Map(),
        ttl: 30000, // 30 seconds in milliseconds
        get: function(weekIndex) {
            const cached = this.data.get(weekIndex);
            if (cached && Date.now() - cached.timestamp < this.ttl) {
                return cached.value;
            }
            return null;
        },
        set: function(weekIndex, bids) {
            this.data.set(weekIndex, {
                value: bids,
                timestamp: Date.now()
            });
        }
    },

    // Clear all caches
    clear: function() {
        this.ens.data.clear();
        this.bids.data.clear();
    }
};