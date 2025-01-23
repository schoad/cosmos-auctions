// caching.js
export const Cache = {
    // ENS cache with 30-day TTL (approximately 2592000000 milliseconds)
    ens: {
        data: new Map(),
        ttl: 2592000000, // 30 days in milliseconds
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
        },
        invalidate: function(address) {
            this.data.delete(address);
        }
    },

    // Clear all caches
    clear: function() {
        this.ens.data.clear();
    }
};